package com.example.data.api

import com.squareup.moshi.FromJson
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.Moshi
import com.squareup.moshi.ToJson
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

class FlexibleBooleanAdapter {
    @FromJson
    fun fromJson(reader: JsonReader): Boolean {
        return when (reader.peek()) {
            JsonReader.Token.BOOLEAN -> reader.nextBoolean()
            JsonReader.Token.NUMBER -> reader.nextInt() != 0
            JsonReader.Token.STRING -> {
                val str = reader.nextString()
                str == "1" || str.equals("true", ignoreCase = true)
            }
            JsonReader.Token.NULL -> {
                reader.nextNull<Unit>()
                false
            }
            else -> {
                reader.skipValue()
                false
            }
        }
    }

    @ToJson
    fun toJson(writer: JsonWriter, value: Boolean?) {
        writer.value(value)
    }
}

class FlexibleDoubleAdapter {
    @FromJson
    fun fromJson(reader: JsonReader): Double? {
        return when (reader.peek()) {
            JsonReader.Token.NUMBER -> reader.nextDouble()
            JsonReader.Token.STRING -> {
                val str = reader.nextString()
                str.toDoubleOrNull()
            }
            JsonReader.Token.NULL -> {
                reader.nextNull<Unit>()
                null
            }
            else -> {
                reader.skipValue()
                null
            }
        }
    }

    @ToJson
    fun toJson(writer: JsonWriter, value: Double?) {
        writer.value(value)
    }
}

class FlexibleLongAdapter {
    @FromJson
    fun fromJson(reader: JsonReader): Long? {
        return when (reader.peek()) {
            JsonReader.Token.NUMBER -> {
                try {
                    reader.nextLong()
                } catch (_: Exception) {
                    try {
                        reader.nextDouble().toLong()
                    } catch (_: Exception) {
                        null
                    }
                }
            }
            JsonReader.Token.STRING -> {
                val str = reader.nextString().trim()
                str.toLongOrNull() ?: str.toDoubleOrNull()?.toLong()
            }
            JsonReader.Token.NULL -> {
                reader.nextNull<Unit>()
                null
            }
            else -> {
                reader.skipValue()
                null
            }
        }
    }

    @ToJson
    fun toJson(writer: JsonWriter, value: Long?) {
        writer.value(value)
    }
}

class FlexibleIntAdapter {
    @FromJson
    fun fromJson(reader: JsonReader): Int? {
        return when (reader.peek()) {
            JsonReader.Token.NUMBER -> {
                try {
                    reader.nextInt()
                } catch (_: Exception) {
                    try {
                        reader.nextDouble().toInt()
                    } catch (_: Exception) {
                        null
                    }
                }
            }
            JsonReader.Token.STRING -> {
                val str = reader.nextString().trim()
                str.toIntOrNull() ?: str.toDoubleOrNull()?.toInt()
            }
            JsonReader.Token.NULL -> {
                reader.nextNull<Unit>()
                null
            }
            else -> {
                reader.skipValue()
                null
            }
        }
    }

    @ToJson
    fun toJson(writer: JsonWriter, value: Int?) {
        writer.value(value)
    }
}

class FlexibleTagsAdapter {
    @FromJson
    fun fromJson(reader: JsonReader): List<com.example.data.model.Tag> {
        val tags = mutableListOf<com.example.data.model.Tag>()
        when (reader.peek()) {
            JsonReader.Token.BEGIN_ARRAY -> {
                reader.beginArray()
                while (reader.hasNext()) {
                    when (reader.peek()) {
                        JsonReader.Token.STRING -> {
                            val str = reader.nextString().trim()
                            if (str.isNotEmpty()) tags.add(com.example.data.model.Tag(id = tags.size + 1, name = str))
                        }
                        JsonReader.Token.BEGIN_OBJECT -> {
                            var id = tags.size + 1
                            var name = ""
                            var color: String? = null
                            reader.beginObject()
                            while (reader.hasNext()) {
                                when (reader.nextName()) {
                                    "id" -> id = try { reader.nextInt() } catch (_: Exception) { tags.size + 1 }
                                    "name" -> name = try { reader.nextString() } catch (_: Exception) { "" }
                                    "color" -> color = try { reader.nextString() } catch (_: Exception) { null }
                                    else -> reader.skipValue()
                                }
                            }
                            reader.endObject()
                            if (name.isNotEmpty()) tags.add(com.example.data.model.Tag(id = id, name = name, color = color))
                        }
                        else -> reader.skipValue()
                    }
                }
                reader.endArray()
            }
            JsonReader.Token.STRING -> {
                val str = reader.nextString()
                str.split(",", "•", "|", "-").forEach { part ->
                    val trimmed = part.trim()
                    if (trimmed.isNotEmpty()) tags.add(com.example.data.model.Tag(id = tags.size + 1, name = trimmed))
                }
            }
            JsonReader.Token.NULL -> {
                reader.nextNull<Unit>()
            }
            else -> {
                reader.skipValue()
            }
        }
        return tags
    }

    @ToJson
    fun toJson(writer: JsonWriter, value: List<com.example.data.model.Tag>?) {
        writer.beginArray()
        value?.forEach { tag ->
            writer.beginObject()
            writer.name("id").value(tag.id)
            writer.name("name").value(tag.name)
            writer.name("color").value(tag.color)
            writer.endObject()
        }
        writer.endArray()
    }
}

object ApiClient {
    private var currentBaseUrl: String = ""
    private var authToken: String? = null
    private var isConfigured: Boolean = false

    private val moshi: Moshi = Moshi.Builder()
        .add(FlexibleBooleanAdapter())
        .add(FlexibleIntAdapter())
        .add(FlexibleLongAdapter())
        .add(FlexibleDoubleAdapter())
        .add(FlexibleTagsAdapter())
        .addLast(KotlinJsonAdapterFactory())
        .build()

    private val authInterceptor = Interceptor { chain ->
        val original = chain.request()
        val builder = original.newBuilder()
            .header("Accept", "application/json")
            .header("User-Agent", "ARN-Stream-Android/1.0 (Abdou Ragab Nassar)")

        authToken?.let { token ->
            if (token.isNotEmpty()) {
                builder.header("Authorization", "Bearer $token")
            }
        }

        chain.proceed(builder.build())
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.HEADERS
    }

    val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private var retrofit: Retrofit = buildRetrofit("http://127.0.0.1:8096/")
    var apiService: ArnApiService = retrofit.create(ArnApiService::class.java)
        private set

    fun updateConfig(baseUrl: String, token: String? = null) {
        if (baseUrl.isBlank()) return
        val normalized = if (baseUrl.endsWith("/")) baseUrl.trim() else "${baseUrl.trim()}/"
        currentBaseUrl = normalized
        isConfigured = true
        authToken = token
        retrofit = buildRetrofit(normalized)
        apiService = retrofit.create(ArnApiService::class.java)
    }

    fun isServerConfigured(): Boolean = isConfigured && currentBaseUrl.isNotEmpty()

    fun setToken(token: String?) {
        authToken = token
    }

    fun getBaseUrl(): String = currentBaseUrl

    fun getFullMediaUrl(path: String?): String {
        if (path.isNullOrBlank()) return ""
        val url = if (path.startsWith("http://") || path.startsWith("https://")) {
            path
        } else {
            val cleanPath = if (path.startsWith("/")) path.substring(1) else path
            if (currentBaseUrl.isEmpty()) cleanPath else "$currentBaseUrl$cleanPath"
        }
        val token = authToken
        return if (!token.isNullOrBlank() && !url.contains("token=") && !url.contains("api_key=")) {
            if (url.contains("?")) "$url&token=$token" else "$url?token=$token"
        } else {
            url
        }
    }

    private fun buildRetrofit(url: String): Retrofit {
        val safeUrl = if (url.startsWith("http://") || url.startsWith("https://")) url else "http://$url"
        val finalUrl = if (safeUrl.endsWith("/")) safeUrl else "$safeUrl/"
        return Retrofit.Builder()
            .baseUrl(finalUrl)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
    }
}
