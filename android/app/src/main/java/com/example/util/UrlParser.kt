package com.example.util

import android.net.Uri

object UrlParser {
    /**
     * Parses any scanned raw string (e.g. from QR code or user input)
     * and normalizes it into a valid ARN Stream server HTTP URL.
     *
     * Handles:
     * - http://10.133.9.152:8096 -> http://10.133.9.152:8096
     * - 10.133.9.152:8096 -> http://10.133.9.152:8096
     * - 10.133.9.152 -> http://10.133.9.152:8096
     * - http://10.133.9.152:8096/ -> http://10.133.9.152:8096
     * - http://10.133.9.152:8096/login -> http://10.133.9.152:8096
     * - {"url": "http://10.133.9.152:8096"} -> http://10.133.9.152:8096
     * - ws://10.133.9.152:8096 -> http://10.133.9.152:8096
     */
    fun normalizeServerUrl(rawInput: String, defaultPort: Int = 8096): String {
        var input = rawInput.trim()

        // Extract URL from json if present
        if (input.contains("\"url\"")) {
            val regex = Regex("\"url\"\\s*:\\s*\"([^\"]+)\"")
            regex.find(input)?.groupValues?.get(1)?.let {
                input = it.trim()
            }
        }

        // Extract URL or IP pattern from input if there's surrounding text
        val urlRegex = Regex("(https?://[^\\s]+)")
        val match = urlRegex.find(input)
        if (match != null) {
            input = match.value.trim()
        }

        // Clean ws/wss protocols to http/https
        if (input.startsWith("ws://")) {
            input = "http://" + input.removePrefix("ws://")
        } else if (input.startsWith("wss://")) {
            input = "https://" + input.removePrefix("wss://")
        }

        // Prepend http if protocol is missing
        if (!input.startsWith("http://") && !input.startsWith("https://")) {
            input = "http://$input"
        }

        return try {
            val uri = Uri.parse(input)
            val scheme = uri.scheme ?: "http"
            val host = uri.host ?: return input.removeSuffix("/")
            val port = if (uri.port != -1) uri.port else defaultPort

            "$scheme://$host:$port"
        } catch (_: Exception) {
            input.removeSuffix("/")
        }
    }
}
