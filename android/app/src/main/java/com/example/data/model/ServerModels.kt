package com.example.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class ServerStatusResponse(
    @Json(name = "data") val data: ServerStatusData? = null
)

@JsonClass(generateAdapter = true)
data class ServerStatusData(
    @Json(name = "initialized") val initialized: Boolean? = null,
    @Json(name = "authenticated") val authenticated: Boolean? = null,
    @Json(name = "hasLibraries") val hasLibraries: Boolean? = null
)

@JsonClass(generateAdapter = true)
data class DiscoveredServer(
    val ip: String,
    val port: Int = 8096,
    val name: String = "ARN Stream Server",
    val latencyMs: Long = 0L,
    val isOnline: Boolean = true
) {
    val url: String
        get() = "http://$ip:$port"
}
