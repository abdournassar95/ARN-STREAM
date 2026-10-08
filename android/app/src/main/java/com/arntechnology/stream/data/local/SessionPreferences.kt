package com.arntechnology.stream.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "arn_stream_prefs")

class SessionPreferences(private val context: Context) {

    companion object {
        val KEY_SERVER_URL = stringPreferencesKey("server_url")
        val KEY_AUTH_TOKEN = stringPreferencesKey("auth_token")
        val KEY_USER_ID = stringPreferencesKey("user_id")
        val KEY_USERNAME = stringPreferencesKey("username")
        val KEY_DISPLAY_NAME = stringPreferencesKey("display_name")
        val KEY_DEVICE_ID = stringPreferencesKey("device_id")
    }

    val serverUrlFlow: Flow<String?> = context.dataStore.data.map { it[KEY_SERVER_URL] }
    val authTokenFlow: Flow<String?> = context.dataStore.data.map { it[KEY_AUTH_TOKEN] }
    val displayNameFlow: Flow<String?> = context.dataStore.data.map { it[KEY_DISPLAY_NAME] }

    suspend fun getServerUrl(): String? = serverUrlFlow.first()
    suspend fun getAuthToken(): String? = authTokenFlow.first()

    suspend fun saveServerUrl(url: String) {
        val cleanUrl = if (url.endsWith("/")) url else "$url/"
        context.dataStore.edit { it[KEY_SERVER_URL] = cleanUrl }
    }

    suspend fun saveAuthSession(token: String, userId: Int, username: String, displayName: String?) {
        context.dataStore.edit {
            it[KEY_AUTH_TOKEN] = token
            it[KEY_USER_ID] = userId.toString()
            it[KEY_USERNAME] = username
            if (displayName != null) it[KEY_DISPLAY_NAME] = displayName
        }
    }

    suspend fun getOrCreateDeviceId(): String {
        val current = context.dataStore.data.map { it[KEY_DEVICE_ID] }.first()
        if (!current.isNullOrEmpty()) return current
        val newId = "ARN-Android-" + java.util.UUID.randomUUID().toString().take(8)
        context.dataStore.edit { it[KEY_DEVICE_ID] = newId }
        return newId
    }

    suspend fun clearSession() {
        context.dataStore.edit {
            it.remove(KEY_AUTH_TOKEN)
            it.remove(KEY_USER_ID)
            it.remove(KEY_USERNAME)
            it.remove(KEY_DISPLAY_NAME)
        }
    }
}
