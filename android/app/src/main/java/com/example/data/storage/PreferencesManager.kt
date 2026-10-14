package com.example.data.storage

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "arn_stream_settings")

class PreferencesManager(private val context: Context) {

    companion object {
        val KEY_SERVER_URL = stringPreferencesKey("server_url")
        val KEY_RECENT_SERVERS = stringPreferencesKey("recent_servers")
    }

    val serverUrl: Flow<String?> = context.dataStore.data.map { preferences ->
        preferences[KEY_SERVER_URL]
    }

    val recentServers: Flow<List<String>> = context.dataStore.data.map { preferences ->
        preferences[KEY_RECENT_SERVERS]?.split(",")?.filter { it.isNotBlank() } ?: emptyList()
    }

    suspend fun saveServerUrl(url: String) {
        val cleanUrl = url.trim().removeSuffix("/")
        context.dataStore.edit { preferences ->
            preferences[KEY_SERVER_URL] = cleanUrl

            val currentRecents = preferences[KEY_RECENT_SERVERS]?.split(",")?.filter { it.isNotBlank() }?.toMutableList() ?: mutableListOf()
            currentRecents.remove(cleanUrl)
            currentRecents.add(0, cleanUrl)
            if (currentRecents.size > 5) {
                preferences[KEY_RECENT_SERVERS] = currentRecents.take(5).joinToString(",")
            } else {
                preferences[KEY_RECENT_SERVERS] = currentRecents.joinToString(",")
            }
        }
    }

    suspend fun clearServerUrl() {
        context.dataStore.edit { preferences ->
            preferences.remove(KEY_SERVER_URL)
        }
    }
}
