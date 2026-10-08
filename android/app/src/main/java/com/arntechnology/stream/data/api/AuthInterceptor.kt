package com.arntechnology.stream.data.api

import com.arntechnology.stream.data.local.SessionPreferences
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val prefs: SessionPreferences) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val token = runBlocking { prefs.getAuthToken() }

        val requestBuilder = original.newBuilder()
            .header("Accept", "application/json")
            .header("User-Agent", "ARN-Stream-Android/1.0.0 (Linux; Android)")

        if (!token.isNullOrEmpty() && original.header("Authorization") == null) {
            requestBuilder.header("Authorization", "Bearer $token")
        }

        return chain.proceed(requestBuilder.build())
    }
}
