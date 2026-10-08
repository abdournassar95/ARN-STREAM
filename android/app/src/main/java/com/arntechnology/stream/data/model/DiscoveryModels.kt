package com.arntechnology.stream.data.model

data class DiscoveredServer(
    val name: String,
    val host: String,
    val port: Int = 8096,
    val baseUrl: String = "http://$host:$port",
    val isAutoDiscovered: Boolean = true
)
