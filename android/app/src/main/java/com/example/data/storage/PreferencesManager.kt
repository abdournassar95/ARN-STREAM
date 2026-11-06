package com.example.data.storage

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.example.data.model.FavoriteMediaItem
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "arn_stream_settings")

/**
 * تخزين محلي بسيط (DataStore) لـ:
 *  - عنوان الخادم وآخر الخوادم المستخدمة
 *  - جلسة الدخول (رمز + اسم المستخدم)
 *  - قائمة "قائمتي" (المفضلة) لكل مستخدم على الجهاز
 *
 * ملاحظة أمنية: هذا التخزين خاص بالتطبيق (sandbox) وليس مشفراً؛ لا يُستخدم
 * لتخزين كلمات المرور، فقط رمز الجلسة القابل للإبطال من الخادم.
 */
class PreferencesManager(private val context: Context) {

    companion object {
        val KEY_SERVER_URL = stringPreferencesKey("server_url")
        val KEY_RECENT_SERVERS = stringPreferencesKey("recent_servers")
        val KEY_AUTH_TOKEN = stringPreferencesKey("auth_token")
        val KEY_USER_NAME = stringPreferencesKey("user_name")
        val KEY_USER_ID = stringPreferencesKey("user_id")
        val KEY_FAVORITES = stringPreferencesKey("favorite_items")

        private val moshi: Moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
        private val favoritesAdapter: com.squareup.moshi.JsonAdapter<List<FavoriteMediaItem>> =
            moshi.adapter(Types.newParameterizedType(List::class.java, FavoriteMediaItem::class.java))
    }

    // ── الخادم ────────────────────────────────────────────────────────────
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

    // ── جلسة الدخول ───────────────────────────────────────────────────────
    val authToken: Flow<String?> = context.dataStore.data.map { it[KEY_AUTH_TOKEN] }

    val userName: Flow<String?> = context.dataStore.data.map { it[KEY_USER_NAME] }

    suspend fun saveAuth(token: String, userId: Int, displayName: String?) {
        context.dataStore.edit { preferences ->
            preferences[KEY_AUTH_TOKEN] = token
            preferences[KEY_USER_ID] = userId.toString()
            if (!displayName.isNullOrBlank()) {
                preferences[KEY_USER_NAME] = displayName
            }
        }
    }

    suspend fun clearAuth() {
        context.dataStore.edit { preferences ->
            preferences.remove(KEY_AUTH_TOKEN)
            preferences.remove(KEY_USER_ID)
            preferences.remove(KEY_USER_NAME)
        }
    }

    // ── قائمتي (المفضلة) ──────────────────────────────────────────────────
    val favoriteItems: Flow<List<FavoriteMediaItem>> = context.dataStore.data.map { preferences ->
        decodeFavorites(preferences[KEY_FAVORITES])
    }

    fun isFavorite(type: String, id: Int): Flow<Boolean> = favoriteItems.map { items ->
        items.any { it.type == type && it.id == id }
    }

    /** يضيف العنصر أو يزيله، ويعيد `true` إذا أصبح مفضّلاً. */
    suspend fun toggleFavorite(item: FavoriteMediaItem): Boolean {
        var nowFavorite = false
        context.dataStore.edit { preferences ->
            val current = decodeFavorites(preferences[KEY_FAVORITES]).toMutableList()
            val existing = current.firstOrNull { it.type == item.type && it.id == item.id }
            if (existing != null) {
                current.remove(existing)
                nowFavorite = false
            } else {
                current.add(0, item)
                nowFavorite = true
            }
            preferences[KEY_FAVORITES] = favoritesAdapter.toJson(current)
        }
        return nowFavorite
    }

    suspend fun removeFavorite(type: String, id: Int) {
        context.dataStore.edit { preferences ->
            val current = decodeFavorites(preferences[KEY_FAVORITES])
                .filterNot { it.type == type && it.id == id }
            preferences[KEY_FAVORITES] = favoritesAdapter.toJson(current)
        }
    }

    private fun decodeFavorites(raw: String?): List<FavoriteMediaItem> {
        if (raw.isNullOrBlank()) return emptyList()
        return try {
            favoritesAdapter.fromJson(raw) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }
}
