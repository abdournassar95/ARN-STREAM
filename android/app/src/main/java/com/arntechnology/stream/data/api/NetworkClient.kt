package com.arntechnology.stream.data.api

import android.content.Context
import com.arntechnology.stream.data.local.SessionPreferences
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

class NetworkClient(private val context: Context) {

    private val prefs = SessionPreferences(context)
    private var currentBaseUrl: String? = null
    private var currentService: ArnApiService? = null

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(prefs))
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.HEADERS
            })
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    suspend fun getApiService(): ArnApiService {
        val savedUrl = prefs.getServerUrl() ?: "http://127.0.0.1:8096/"
        return getApiServiceForUrl(savedUrl)
    }

    fun getApiServiceForUrl(baseUrl: String): ArnApiService {
        val normalizedUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
        if (currentService != null && currentBaseUrl == normalizedUrl) {
            return currentService!!
        }

        val retrofit = Retrofit.Builder()
            .baseUrl(normalizedUrl)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

        currentBaseUrl = normalizedUrl
        currentService = retrofit.create(ArnApiService::class.java)
        return currentService!!
    }
}
