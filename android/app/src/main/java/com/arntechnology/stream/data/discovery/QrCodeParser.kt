package com.arntechnology.stream.data.discovery

import android.net.Uri

object QrCodeParser {

    /**
     * التحقق من صحة رابط السيرفر المستخرج من رمز الـ QR
     * وتنسيقه بالشكل القياسي http://ip:port
     */
    fun parseServerUrl(rawQrData: String): String? {
        val trimmed = rawQrData.trim()
        return try {
            val uri = Uri.parse(trimmed)
            val scheme = uri.scheme ?: "http"
            val host = uri.host ?: return null
            val port = if (uri.port != -1) uri.port else 8096

            if (scheme.startsWith("http")) {
                "$scheme://$host:$port"
            } else {
                null
            }
        } catch (_: Exception) {
            null
        }
    }
}
