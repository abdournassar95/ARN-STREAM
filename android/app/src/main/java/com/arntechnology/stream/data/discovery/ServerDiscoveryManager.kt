package com.arntechnology.stream.data.discovery

import android.content.Context
import android.net.wifi.WifiManager
import com.arntechnology.stream.data.model.DiscoveredServer
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.channelFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

class ServerDiscoveryManager(
    private val context: Context,
    private val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(600, TimeUnit.MILLISECONDS)
        .readTimeout(800, TimeUnit.MILLISECONDS)
        .build()
) {
    private val foundServers = ConcurrentHashMap<String, Boolean>()

    fun startDiscovery(): Flow<DiscoveredServer> = channelFlow {
        foundServers.clear()

        // 1. تشغيل مسار اكتشاف SSDP M-SEARCH (UPnP Multicast)
        val ssdpJob = launch(Dispatchers.IO) {
            discoverViaSsdp { server ->
                if (foundServers.putIfAbsent(server.baseUrl, true) == null) {
                    trySend(server)
                }
            }
        }

        // 2. تشغيل مسار الفحص التفرعي السريع (Subnet Fast Ping Scanner)
        val subnetJob = launch(Dispatchers.IO) {
            discoverViaSubnetFastScan { server ->
                if (foundServers.putIfAbsent(server.baseUrl, true) == null) {
                    trySend(server)
                }
            }
        }

        // إبقاء القناة مفتوحة حتى يتم الإلغاء
        awaitClose {
            ssdpJob.cancel()
            subnetJob.cancel()
        }
    }

    private suspend fun discoverViaSubnetFastScan(onFound: (DiscoveredServer) -> Unit) = coroutineScope {
        val wifiIp = getLocalWifiIpAddress() ?: return@coroutineScope
        val parts = wifiIp.split(".")
        if (parts.size != 4) return@coroutineScope
        val subnetPrefix = "${parts[0]}.${parts[1]}.${parts[2]}."

        // فحص العناوين من 1 إلى 254 بتوازي كامل عبر Coroutines
        (1..254).map { host ->
            launch(Dispatchers.IO) {
                val testIp = "$subnetPrefix$host"
                val testUrl = "http://$testIp:8096/api/auth/status"
                try {
                    val request = Request.Builder().url(testUrl).build()
                    val response = okHttpClient.newCall(request).execute()
                    if (response.isSuccessful && response.body?.string()?.contains("initialized") == true) {
                        onFound(
                            DiscoveredServer(
                                name = "ARN Stream ($testIp)",
                                host = testIp,
                                port = 8096,
                                baseUrl = "http://$testIp:8096"
                            )
                        )
                    }
                } catch (_: Exception) {}
            }
        }.joinAll()
    }

    private fun discoverViaSsdp(onFound: (DiscoveredServer) -> Unit) {
        var multicastLock: WifiManager.MulticastLock? = null
        var socket: DatagramSocket? = null

        try {
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            multicastLock = wifiManager?.createMulticastLock("arn_stream_discovery")?.apply {
                setReferenceCounted(true)
                acquire()
            }

            socket = DatagramSocket()
            socket.broadcast = true
            socket.soTimeout = 3000

            val query = """
                M-SEARCH * HTTP/1.1
                HOST: 239.255.255.250:1900
                MAN: "ssdp:discover"
                MX: 2
                ST: urn:schemas-upnp-org:device:MediaServer:1
            """.trimIndent().replace("\n", "\r\n") + "\r\n\r\n"

            val queryBytes = query.toByteArray()
            val packet = DatagramPacket(
                queryBytes,
                queryBytes.size,
                InetAddress.getByName("239.255.255.250"),
                1900
            )

            // إرسال حزمة M-SEARCH
            socket.send(packet)

            val receiveBuf = ByteArray(2048)
            val receivePacket = DatagramPacket(receiveBuf, receiveBuf.size)

            val startTime = System.currentTimeMillis()
            while (System.currentTimeMillis() - startTime < 4000) {
                try {
                    socket.receive(receivePacket)
                    val response = String(receivePacket.data, 0, receivePacket.length)

                    if (response.contains("PersonalStream") || response.contains("MediaServer:1") || response.contains(":8096")) {
                        val hostIp = receivePacket.address.hostAddress ?: continue
                        onFound(
                            DiscoveredServer(
                                name = "ARN Stream ($hostIp)",
                                host = hostIp,
                                port = 8096,
                                baseUrl = "http://$hostIp:8096"
                            )
                        )
                    }
                } catch (_: Exception) {
                    break
                }
            }
        } catch (_: Exception) {
        } finally {
            socket?.close()
            try { multicastLock?.release() } catch (_: Exception) {}
        }
    }

    @Suppress("DEPRECATION")
    private fun getLocalWifiIpAddress(): String? {
        val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return null
        val ipInt = wifiManager.connectionInfo.ipAddress
        if (ipInt == 0) return null
        return String.format(
            "%d.%d.%d.%d",
            ipInt and 0xff,
            ipInt shr 8 and 0xff,
            ipInt shr 16 and 0xff,
            ipInt shr 24 and 0xff
        )
    }
}
