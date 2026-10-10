package com.example.data.storage

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "arn_stream_prefs")

class PreferencesManager(private val context: Context) {

    companion object {
        private val KEY_SERVER_URL = stringPreferencesKey("server_url")
        private val KEY_AUTH_TOKEN = stringPreferencesKey("auth_token")
        private val KEY_USER_NAME = stringPreferencesKey("user_name")
        private val KEY_USER_ID = intPreferencesKey("user_id")
        private val KEY_SELECTED_LIBRARY_ID = intPreferencesKey("selected_library_id")
        private val KEY_IS_OFFLINE_MODE = booleanPreferencesKey("is_offline_mode")
        private val KEY_FAVORITES_JSON = stringPreferencesKey("favorite_items_json")
    }

    val serverUrl: Flow<String?> = context.dataStore.data.map { it[KEY_SERVER_URL] }
    val authToken: Flow<String?> = context.dataStore.data.map { it[KEY_AUTH_TOKEN] }
    val userName: Flow<String?> = context.dataStore.data.map { it[KEY_USER_NAME] }
    val selectedLibraryId: Flow<Int> = context.dataStore.data.map { it[KEY_SELECTED_LIBRARY_ID] ?: 1 }
    val isOfflineMode: Flow<Boolean> = context.dataStore.data.map { it[KEY_IS_OFFLINE_MODE] ?: false }

    val favoriteItems: Flow<List<com.example.data.model.FavoriteMediaItem>> = context.dataStore.data.map { prefs ->
        val json = prefs[KEY_FAVORITES_JSON] ?: ""
        parseFavorites(json)
    }

    fun isFavorite(type: String, id: Int): Flow<Boolean> = favoriteItems.map { list ->
        list.any { it.type == type && it.id == id }
    }

    suspend fun toggleFavorite(item: com.example.data.model.FavoriteMediaItem): Boolean {
        var isNowFavorite = false
        context.dataStore.edit { prefs ->
            val json = prefs[KEY_FAVORITES_JSON] ?: ""
            val currentList = parseFavorites(json).toMutableList()
            val existingIndex = currentList.indexOfFirst { it.type == item.type && it.id == item.id }
            if (existingIndex >= 0) {
                currentList.removeAt(existingIndex)
                isNowFavorite = false
            } else {
                currentList.add(0, item)
                isNowFavorite = true
            }
            prefs[KEY_FAVORITES_JSON] = serializeFavorites(currentList)
        }
        return isNowFavorite
    }

    suspend fun removeFavorite(type: String, id: Int) {
        context.dataStore.edit { prefs ->
            val json = prefs[KEY_FAVORITES_JSON] ?: ""
            val currentList = parseFavorites(json).filterNot { it.type == type && it.id == id }
            prefs[KEY_FAVORITES_JSON] = serializeFavorites(currentList)
        }
    }

    private fun parseFavorites(json: String): List<com.example.data.model.FavoriteMediaItem> {
        if (json.isBlank()) return emptyList()
        val list = mutableListOf<com.example.data.model.FavoriteMediaItem>()
        try {
            val array = org.json.JSONArray(json)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                list.add(
                    com.example.data.model.FavoriteMediaItem(
                        id = obj.getInt("id"),
                        type = obj.getString("type"),
                        title = obj.getString("title"),
                        poster = if (obj.has("poster") && !obj.isNull("poster")) obj.getString("poster") else null,
                        rating = if (obj.has("rating") && !obj.isNull("rating")) obj.getDouble("rating") else null,
                        year = if (obj.has("year") && !obj.isNull("year")) obj.getInt("year") else null,
                        addedAt = if (obj.has("addedAt")) obj.getLong("addedAt") else System.currentTimeMillis()
                    )
                )
            }
        } catch (_: Exception) {}
        return list
    }

    private fun serializeFavorites(items: List<com.example.data.model.FavoriteMediaItem>): String {
        val array = org.json.JSONArray()
        for (item in items) {
            val obj = org.json.JSONObject()
            obj.put("id", item.id)
            obj.put("type", item.type)
            obj.put("title", item.title)
            obj.put("poster", item.poster)
            if (item.rating != null) obj.put("rating", item.rating)
            if (item.year != null) obj.put("year", item.year)
            obj.put("addedAt", item.addedAt)
            array.put(obj)
        }
        return array.toString()
    }

    suspend fun saveServerUrl(url: String) {
        context.dataStore.edit { it[KEY_SERVER_URL] = url }
    }

    suspend fun saveAuth(token: String, userId: Int, userName: String) {
        context.dataStore.edit {
            it[KEY_AUTH_TOKEN] = token
            it[KEY_USER_ID] = userId
            it[KEY_USER_NAME] = userName
        }
    }

    suspend fun setSelectedLibrary(libraryId: Int) {
        context.dataStore.edit { it[KEY_SELECTED_LIBRARY_ID] = libraryId }
    }

    suspend fun setOfflineMode(enabled: Boolean) {
        context.dataStore.edit { it[KEY_IS_OFFLINE_MODE] = enabled }
    }

    suspend fun clearSession() {
        context.dataStore.edit {
            it.remove(KEY_AUTH_TOKEN)
            it.remove(KEY_USER_NAME)
            it.remove(KEY_USER_ID)
        }
    }
}
