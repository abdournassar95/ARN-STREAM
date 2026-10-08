package com.arntechnology.stream.data.handoff

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import okhttp3.*
import java.util.concurrent.TimeUnit

class HandoffWebSocketClient(
    private val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .pingInterval(15, TimeUnit.SECONDS)
        .build()
) {
    private var webSocket: WebSocket? = null
    private val _messagesFlow = MutableSharedFlow<String>(extraBufferCapacity = 64)
    val messagesFlow: SharedFlow<String> = _messagesFlow

    fun connect(serverBaseUrl: String, deviceId: String) {
        disconnect()

        val wsUrl = serverBaseUrl.replace("http://", "ws://")
            .replace("https://", "wss://")
            .trimEnd('/') + "/ws/handoff?deviceId=$deviceId"

        val request = Request.Builder().url(wsUrl).build()

        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                // Connected successfully
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                _messagesFlow.tryEmit(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                // Handle retry or reconnection
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(code, reason)
            }
        })
    }

    fun send(message: String): Boolean {
        return webSocket?.send(message) ?: false
    }

    fun disconnect() {
        webSocket?.close(1000, "App closed")
        webSocket = null
    }
}
