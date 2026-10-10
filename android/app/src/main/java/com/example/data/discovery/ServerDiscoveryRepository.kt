package com.example.data.discovery

import android.content.Context
import android.net.ConnectivityManager
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import com.example.data.model.DiscoveredServer
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

class ServerDiscoveryRepository(private val context: Context) {

    private val commonPorts = intArrayOf(8096, 3000, 8080, 5000, 8000, 80)

    private val verifyClient = OkHttpClient.Builder()
        .connectTimeout(1500, TimeUnit.MILLISECONDS)
        .readTimeout(2000, TimeUnit.MILLISECONDS)
        .followRedirects(true)
        .build()

    suspend fun discoverServers(): Flow<DiscoveredServer> = channelFlow {
        val foundServers = ConcurrentHashMap<String, DiscoveredServer>()

        fun emitIfNew(server: DiscoveredServer) {
            val normalized = if (server.baseUrl.endsWith("/")) server.baseUrl.dropLast(1) else server.baseUrl
            if (foundServers.putIfAbsent(normalized, server) == null) {
                trySend(server)
            }
        }

        // 1. Probe Host / Emulator loopbacks (10.0.2.2 for Android Studio Emulator, 127.0.0.1)
        launch(Dispatchers.IO) {
            val specialHosts = listOf("10.0.2.2", "127.0.0.1", "localhost")
            for (host in specialHosts) {
                for (port in commonPorts) {
                    launch(Dispatchers.IO) {
                        probeHostAndPort(host, port) { emitIfNew(it) }
                    }
                }
            }
        }

        // 2. Multicast Lock + UPnP SSDP Discovery
        val ssdpJob = launch(Dispatchers.IO) {
            discoverViaSsdp { server ->
                emitIfNew(server)
            }
        }

        // 3. Android Network Service Discovery (mDNS / Zeroconf)
        val mDnsJob = launch(Dispatchers.IO) {
            discoverViaMdns { server ->
                emitIfNew(server)
            }
        }

        // 4. Scan the actual device's local network subnet(s)
        val subnetJob = launch(Dispatchers.IO) {
            val activeSubnets = getActiveDeviceSubnets()
            val semaphore = Semaphore(40) // Controlled concurrency to avoid network flooding

            for (subnet in activeSubnets) {
                for (hostNum in 1..254) {
                    val ip = "$subnet$hostNum"
                    // Check default media ports on this IP
                    for (port in listOf(8096, 3000, 8080)) {
                        launch(Dispatchers.IO) {
                            semaphore.withPermit {
                                // Fast socket ping first (< 250ms)
                                if (isPortOpen(ip, port, 250)) {
                                    probeHostAndPort(ip, port) { emitIfNew(it) }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Keep scanner active for up to 8 seconds
        delay(8000)
        ssdpJob.cancel()
        mDnsJob.cancel()
        subnetJob.cancel()
    }

    private fun isPortOpen(host: String, port: Int, timeoutMs: Int): Boolean {
        return try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(host, port), timeoutMs)
                true
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun probeHostAndPort(
        host: String,
        port: Int,
        onFound: (DiscoveredServer) -> Unit
    ) {
        val testPaths = listOf(
            "/api/auth/status",
            "/api/status",
            "/api/libraries",
            "/"
        )

        for (path in testPaths) {
            val url = "http://$host:$port$path"
            try {
                val request = Request.Builder()
                    .url(url)
                    .header("Accept", "application/json, text/html, */*")
                    .build()
                val response = verifyClient.newCall(request).execute()
                val code = response.code
                val body = response.body?.string() ?: ""

                // Check if response indicates ARN Stream, Media Server, or valid API endpoint
                val isArnOrMedia = body.contains("ARN", ignoreCase = true) ||
                        body.contains("MediaServer", ignoreCase = true) ||
                        body.contains("stream", ignoreCase = true) ||
                        body.contains("initialized", ignoreCase = true) ||
                        body.contains("\"data\"", ignoreCase = true) ||
                        body.contains("\"success\"", ignoreCase = true) ||
                        body.contains("jellyfin", ignoreCase = true) ||
                        body.contains("emby", ignoreCase = true) ||
                        code in 200..299

                if (isArnOrMedia) {
                    val serverName = if (body.contains("ARN", ignoreCase = true)) {
                        "خادم ARN Stream ($host:$port)"
                    } else {
                        "خادم وسائط ARN ($host:$port)"
                    }

                    onFound(
                        DiscoveredServer(
                            name = serverName,
                            host = host,
                            port = port,
                            baseUrl = "http://$host:$port"
                        )
                    )
                    break
                }
            } catch (_: Exception) {}
        }
    }

    private fun discoverViaSsdp(onFound: (DiscoveredServer) -> Unit) {
        val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        val multicastLock = wifiManager?.createMulticastLock("arn_multicast_lock")
        try {
            multicastLock?.setReferenceCounted(true)
            multicastLock?.acquire()
        } catch (_: Exception) {}

        var socket: DatagramSocket? = null
        try {
            val ssdpQueries = listOf(
                "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n",
                "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: urn:schemas-upnp-org:device:MediaServer:1\r\n\r\n"
            )

            socket = DatagramSocket()
            socket.soTimeout = 2500
            socket.broadcast = true

            val targetGroup = InetAddress.getByName("239.255.255.250")
            for (query in ssdpQueries) {
                val data = query.toByteArray()
                val packet = DatagramPacket(data, data.size, targetGroup, 1900)
                socket.send(packet)
            }

            val receiveBuf = ByteArray(2048)
            val receivePacket = DatagramPacket(receiveBuf, receiveBuf.size)
            val endTime = System.currentTimeMillis() + 4000

            while (System.currentTimeMillis() < endTime) {
                try {
                    socket.receive(receivePacket)
                    val response = String(receivePacket.data, 0, receivePacket.length)
                    val host = receivePacket.address.hostAddress ?: ""
                    if (host.isNotEmpty()) {
                        // Extract port if location header is present
                        var port = 8096
                        val locLine = response.lines().firstOrNull { it.startsWith("LOCATION:", ignoreCase = true) }
                        if (locLine != null) {
                            val uri = runCatching { URI(locLine.substringAfter(":").trim()) }.getOrNull()
                            if (uri != null && uri.port > 0) port = uri.port
                        }
                        probeHostAndPort(host, port, onFound)
                    }
                } catch (_: Exception) {
                    break
                }
            }
        } catch (_: Exception) {
        } finally {
            try {
                socket?.close()
                if (multicastLock?.isHeld == true) multicastLock.release()
            } catch (_: Exception) {}
        }
    }

    private fun discoverViaMdns(onFound: (DiscoveredServer) -> Unit) {
        val nsdManager = context.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return
        val serviceTypes = listOf("_http._tcp.", "_arn._tcp.", "_media._tcp.")

        for (serviceType in serviceTypes) {
            try {
                val discoveryListener = object : NsdManager.DiscoveryListener {
                    override fun onDiscoveryStarted(regType: String) {}
                    override fun onServiceFound(service: NsdServiceInfo) {
                        nsdManager.resolveService(service, object : NsdManager.ResolveListener {
                            override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
                            override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
                                val host = serviceInfo.host?.hostAddress
                                val port = serviceInfo.port
                                if (!host.isNullOrEmpty() && port > 0) {
                                    probeHostAndPort(host, port, onFound)
                                }
                            }
                        })
                    }
                    override fun onServiceLost(service: NsdServiceInfo) {}
                    override fun onDiscoveryStopped(serviceType: String) {}
                    override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
                    override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
                }
                nsdManager.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, discoveryListener)
            } catch (_: Exception) {}
        }
    }

    private fun getActiveDeviceSubnets(): Set<String> {
        val subnets = mutableSetOf<String>()
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (iface.isLoopback || !iface.isUp) continue
                val addresses = iface.inetAddresses
                while (addresses.hasMoreElements()) {
                    val addr = addresses.nextElement()
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        val hostAddr = addr.hostAddress ?: continue
                        val prefix = hostAddr.substringBeforeLast(".") + "."
                        subnets.add(prefix)
                    }
                }
            }
        } catch (_: Exception) {}

        // Add common home router subnets and emulator subnet
        subnets.add("192.168.1.")
        subnets.add("192.168.0.")
        subnets.add("10.0.2.") // Android emulator subnet
        return subnets
    }
}
