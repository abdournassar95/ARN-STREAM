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

/**
 * خادم مكتشَف عبر SSDP/mDNS أو الفحص المباشر.
 *
 * كان مُعرَّفاً مرتين (Models.kt + ServerModels.kt) بنفس الاسم والحزمة، وهو ما
 * كان يُسقط البناء عند KSP (تعارض `DiscoveredServerJsonAdapter`). هذا هو
 * التعريف الوحيد الآن، ويوفّر الحقول التي كانت مستخدمة في الملفين معاً.
 */
@JsonClass(generateAdapter = true)
data class DiscoveredServer(
    val name: String = "ARN Stream Server",
    val host: String,
    val port: Int = 8096,
    val latencyMs: Long = 0L,
    val isOnline: Boolean = true
) {
    val ip: String get() = host
    val baseUrl: String get() = "http://$host:$port"
    val url: String get() = "http://$host:$port"
}
