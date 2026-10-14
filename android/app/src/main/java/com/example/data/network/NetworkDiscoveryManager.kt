package com.example.data.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import com.example.data.model.DiscoveredServer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface
import java.util.Collections
import java.util.concurrent.TimeUnit

class NetworkDiscoveryManager(private val context: Context) {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(500, TimeUnit.MILLISECONDS)
        .readTimeout(800, TimeUnit.MILLISECONDS)
        .build()

    suspend fun testServerConnection(url: String): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        val formatted = if (!url.startsWith("http://") && !url.startsWith("https://")) {
            "http://$url"
        } else {
            url
        }.removeSuffix("/")

        val targetUrl = "$formatted/api/auth/status"
        try {
            val request = Request.Builder()
                .url(targetUrl)
                .addHeader("User-Agent", "ARNStreamAndroidClient/1.0")
                .build()

            val startTime = System.currentTimeMillis()
            httpClient.newCall(request).execute().use { response ->
                val duration = System.currentTimeMillis() - startTime
                if (response.isSuccessful || response.code in 200..399) {
                    Pair(true, "متصل بنجاح (${duration}ms)")
                } else {
                    Pair(true, "استجاب الخادم برمز ${response.code}")
                }
            }
        } catch (e: Exception) {
            Pair(false, e.localizedMessage ?: "فشل الاتصال بالخادم")
        }
    }

    suspend fun scanLocalSubnet(
        onProgress: (Int, Int) -> Unit,
        onServerFound: (DiscoveredServer) -> Unit
    ) = withContext(Dispatchers.IO) {
        val candidates = linkedSetOf<String>()

        // 1. Device's own network interfaces (Active IP ranges)
        val deviceIps = getDeviceIpAddresses()
        for (ip in deviceIps) {
            val parts = ip.split(".")
            if (parts.size == 4) {
                val prefix = "${parts[0]}.${parts[1]}.${parts[2]}"
                // Scan the subnet of the device
                for (i in 1..254) {
                    candidates.add("$prefix.$i")
                }
            }
        }

        // 2. Common private home networks
        listOf("192.168.1", "192.168.0", "192.168.100", "10.0.0").forEach { prefix ->
            listOf(1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 100, 150, 152, 200, 254).forEach { host ->
                candidates.add("$prefix.$host")
            }
        }

        // 3. Android Emulator hosts & Loopbacks
        candidates.add("10.0.2.2")
        candidates.add("127.0.0.1")

        val total = candidates.size
        var completed = 0

        val chunkList = candidates.toList()
        val chunkSize = 35

        for (chunk in chunkList.chunked(chunkSize)) {
            val deferreds = chunk.map { ip ->
                async {
                    val found = pingArnServer(ip, 8096)
                    if (found != null) {
                        withContext(Dispatchers.Main) {
                            onServerFound(found)
                        }
                    }
                }
            }
            deferreds.awaitAll()
            completed += chunk.size
            withContext(Dispatchers.Main) {
                onProgress(completed.coerceAtMost(total), total)
            }
        }
    }

    private fun pingArnServer(ip: String, port: Int): DiscoveredServer? {
        val targetUrl = "http://$ip:$port/api/auth/status"
        return try {
            val start = System.currentTimeMillis()
            val request = Request.Builder()
                .url(targetUrl)
                .addHeader("User-Agent", "ARNStreamAndroidClient/1.0")
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful || response.code in 200..399) {
                    val latency = System.currentTimeMillis() - start
                    DiscoveredServer(
                        ip = ip,
                        port = port,
                        name = "ARN Stream Server ($ip)",
                        latencyMs = latency,
                        isOnline = true
                    )
                } else null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun getDeviceIpAddresses(): List<String> {
        val list = mutableListOf<String>()
        try {
            val interfaces = Collections.list(NetworkInterface.getNetworkInterfaces())
            for (intf in interfaces) {
                if (intf.isLoopback || !intf.isUp) continue
                val addrs = Collections.list(intf.inetAddresses)
                for (addr in addrs) {
                    if (!addr.isLoopbackAddress && addr is Inet4Address) {
                        val host = addr.hostAddress
                        if (!host.isNullOrBlank() && !host.startsWith("127.")) {
                            list.add(host)
                        }
                    }
                }
            }
        } catch (_: Exception) {
        }
        return list
    }
}
