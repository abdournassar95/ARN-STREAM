# ARN Stream - Android Application Master Specification & Build Blueprint
> **Company:** ARN Technology  
> **Lead Developer & Software Architect:** Abdou Ragab Nassar  
> **Target Environment:** Google AI Studio / Android Studio (Jetpack Compose, Kotlin)  
> **Server Technology:** Node.js / Express Server (ARN-Stream Backend)  
> **Language & UI Rules:** English codebase (Kotlin) with native Arabic RTL User Interface & Dark Glassmorphism Design.

---

## 1. Executive Summary & Goals

This document serves as the **exhaustive, production-grade blueprint** for building the **ARN Stream** native Android client from scratch using Google AI Studio. 

The goal is to generate an Android application that achieves **100% architectural and operational harmony** with the existing Node.js/Express media server, runs at maximum performance with zero frame drops, and installs effortlessly on all Android devices (Android 7.0 / API 24 through Android 15 / API 35) without package parsing or signature errors.

---

## 2. Root Cause of Installation Failures & Build Guardrails

Previous prototype builds faced package installation rejection on certain Android devices (`App not installed` or `Parse error`). When generating the project in AI Studio, strictly adhere to these compile and packaging rules:

| Configuration Parameter | Target Value | Critical Explanation |
| :--- | :--- | :--- |
| `minSdk` | `24` | Guarantees installation on Android 7.0 and all newer devices. |
| `targetSdk` | `34` | Targets Android 14 (stable, universally recognized by all device package managers). |
| `compileSdk` | `35` | Android 15 SDK (compiles modern AndroidX & Compose without experimental preview flags). Avoid `minorApiLevel` preview SDKs that trigger OS installer rejections. |
| `applicationId` | `com.arntechnology.stream` | The canonical package namespace for ARN Technology. |
| `signingConfig` | `V1 + V2 + V3 + V4` | Android devices strictly require APK Signature Scheme v2 on Android 11+ and v1 on older devices/TVs. The build must enable `enableV1Signing = true`, `enableV2Signing = true`, `enableV3Signing = true`, `enableV4Signing = true`. |
| `debuggable` | `false` (for release) | Many device skins (Samsung Knox, Xiaomi MIUI/HyperOS, Huawei) block installing APKs with `android:debuggable="true"` via file managers. Production builds must have `isDebuggable = false`. |

---

## 3. Server Architecture & Exact API Endpoint Specifications

The Android app communicates with the Node.js/Express backend running locally or over LAN (default port `8096`). All responses typically follow the envelope:
```json
{
  "success": true,
  "data": ...,
  "message": null
}
```
*(Note: Some endpoints return un-nested objects as explicitly documented below).*

### 3.1. Server Status & Discovery
- **Endpoint:** `GET /api/status`
- **Response Format:**
  ```json
  {
    "initialized": true,
    "authenticated": false,
    "user": null,
    "hasLibraries": true
  }
  ```
- **Usage:** Used by the client to verify connection health during LAN discovery and IP resolution.

### 3.2. Authentication & Multi-Profile Users
- **Endpoint:** `GET /api/auth/users`
  - **Returns:** `{ "success": true, "users": [ { "id": 1, "username": "admin", "display_name": "عبده رجب نصار", "avatar": null } ] }`
  - **Usage:** Displays available profiles on the splash/login screen for PIN or password entry.
- **Endpoint:** `POST /api/auth/login`
  - **Payload:** `{ "username": "admin", "password": "..." }`
  - **Returns:** `{ "success": true, "token": "JWT_STRING_HERE", "user": { "id": 1, "username": "admin", "display_name": "عبده رجب نصار", "role": "admin", "can_download": true, "can_cast": true } }`
  - **Usage:** Stores JWT token in `PreferencesManager` and injects `Authorization: Bearer <token>` in OkHttp headers.

### 3.3. Media Libraries
- **Endpoint:** `GET /api/libraries`
  - **Returns:** `{ "success": true, "data": [ { "id": 1, "name": "أفلام عربية", "type": "movies", "custom_covers": "/posters/1.jpg" }, { "id": 2, "name": "مسلسلات", "type": "shows" }, { "id": 3, "name": "القرآن الكريم", "type": "quran" } ] }`
- **Endpoint:** `GET /api/libraries/:id?limit=500`
  - **CRITICAL FORMAT:** The server returns `{ "success": true, "data": { "id": 1, "name": "...", "type": "movies", "items": [ ... ], "counts": { ... } } }`.
  - **Usage:** Client MUST access `response.data.items` to retrieve media items (do NOT cast `data` directly to a List).

### 3.4. Movies
- **Endpoint:** `GET /api/movies`
  - **Query Params:** `library_id` (optional), `sort` (e.g. `added`, `title`, `year`, `rating`), `limit=500`, `page=1`
  - **Returns:** `{ "success": true, "data": [ Movie ] }`
- **Endpoint:** `GET /api/movies/:id`
  - **Returns:** `{ "success": true, "data": Movie }`
  - **CRITICAL IMAGE HANDLING:** Server returns image arrays:
    ```json
    {
      "id": 10,
      "title": "Movie Title",
      "year": 2024,
      "rating": 8.5,
      "plot": "...",
      "duration": 7200,
      "posters": [ { "id": 1, "url": "/api/image/101", "thumb": "/api/image/101-thumb", "is_primary": true } ],
      "backdrops": [ { "id": 2, "url": "/api/image/102", "is_primary": true } ]
    }
    ```
  - **Client Poster Resolution Rule:**
    Fallback order: `poster` -> `posters.find { is_primary }?.thumb` -> `posters.firstOrNull()?.thumb` -> `posters.firstOrNull()?.url` -> `backdrop` -> `/api/image/placeholder`.

### 3.5. Series, Seasons & Episodes
- **Endpoint:** `GET /api/series?library_id=:id&limit=500`
  - **Returns:** `{ "success": true, "data": [ Series ] }`
- **Endpoint:** `GET /api/series/:id`
  - **Returns:** `{ "success": true, "data": Series }` (Contains `seasons: [ { id, season_number, title, episodes: [ Episode ] } ]`)
- **Endpoint:** `GET /api/series/:id/seasons/:seasonNum/episodes`
  - **Returns:** `{ "success": true, "data": [ Episode ] }`
- **Endpoint:** `GET /api/series/episodes/:id`
  - **CRITICAL FOR VIDEO PLAYER:** When playing an episode, the player only holds the `episodeId`. Calling this endpoint returns the single episode object including `series_id`, title, episode number, and video path. The client uses `series_id` to query `getSeriesDetails` and populate the `episodesQueue` for seamless Next/Previous episode navigation.

### 3.6. Audio, Music & Quran
- **Endpoint:** `GET /api/artists?library_id=:id&limit=500` -> `{ "success": true, "data": [ Artist ] }`
- **Endpoint:** `GET /api/artists/:id` -> `{ "success": true, "data": Artist }`
- **Endpoint:** `GET /api/albums?library_id=:id&artist_id=:artistId` -> `{ "success": true, "data": [ Album ] }`
- **Endpoint:** `GET /api/albums/:id` -> `{ "success": true, "data": Album }`
- **Endpoint:** `GET /api/tracks?artist_id=:id&album_id=:albumId&limit=500`
  - **CRITICAL FORMAT:** The server wraps tracks inside an `items` array:
    ```json
    {
      "success": true,
      "data": {
        "items": [ Track ],
        "total": 45
      }
    }
    ```
  - The client must deserialize `TracksWrapper` containing `@Json(name = "items") val items: List<Track>`.

### 3.7. Smart Predictive Search
- **Endpoint:** `GET /api/search?q=:query&type=all`
  - **CRITICAL FORMAT:** The server returns a **flat list** of items along with a search prediction:
    ```json
    {
      "data": [
        { "id": 12, "title": "Inception", "type": "movie", "poster": "/api/image/55", "year": 2010 },
        { "id": 8, "title": "Breaking Bad", "type": "series", "poster": "/api/image/92", "year": 2008 },
        { "id": 401, "title": "سورة البقرة", "type": "track", "artistName": "مشاري العفاسي", "albumTitle": "المصحف المرتل" }
      ],
      "prediction": "Inception 2010"
    }
    ```
  - **Rule:** Do NOT expect categorized sub-objects (`movies: [], series: []`). Map the `data` array directly into a `List<SearchItem>`.

### 3.8. Media Streaming URLs
All streaming requests pass through the backend pipeline with HTTP Range support for ExoPlayer:
- **Movie Stream:** `http://<SERVER_HOST>:<PORT>/api/stream/movie/:id`
- **Episode Stream:** `http://<SERVER_HOST>:<PORT>/api/stream/episode/:id`
- **Track Stream:** `http://<SERVER_HOST>:<PORT>/api/stream/track/:id` (or direct path)
- **Image URL Resolver:** Always resolve relative URLs (e.g. `/api/image/123`) using `ApiClient.getFullMediaUrl(path)`.

### 3.9. Playback Progress & Continue Watching
- **Save Progress:** `POST /api/playback`
  - **Body:** `{ "media_type": "movie"|"episode"|"track", "media_id": 12, "position": 1820, "duration": 7200, "title": "..." }`
- **Fetch Continue Watching:** `GET /api/playback/continue?limit=10`
  - **Returns:** `{ "success": true, "data": [ { "media_type": "...", "media_id": 12, "position": 1820, "duration": 7200, "title": "..." } ] }`
  - **Enrichment Rule:** The server's SQL query does not join movie/episode poster tables in continue-watching. `MediaRepository` must enrich missing posters by querying `cachedMovies[mediaId]` or `cachedSeries[mediaId]`.

### 3.10. Live TV & TV Code
- **Endpoint:** `GET /api/live/code`
  - **CRITICAL FORMAT:** Returns an **un-nested** object: `{ "code": "232425", "success": true }`.
  - **Client Mapping:** Map directly to `LiveTvCodeResponse` and retrieve `code ?: fgCode ?: "232425"`.

### 3.11. Smart Remote Control & Handoff (PlayTo)
- **List Devices:** `GET /api/handoff/devices` -> `{ "success": true, "devices": [ HandoffDevice ] }`
- **Send Remote Command:** `POST /api/handoff/command`
  - **Body:** `{ "targetDeviceId": "tv_office", "fromDeviceId": "<persistent_android_id>", "command": "play|pause|seek_delta|volume|mute|dpad", "value": ... }`
- **Transfer Playback:** `POST /api/handoff/transfer`
  - **Body:** `{ "targetDeviceId": "tv_office", "mediaType": "movie", "mediaId": 12, "title": "...", "position": 150, "action": "play" }`
  - **Returns:** `{ "success": true, "delivered": true, "isDlna": false }`

---

## 4. Complete Kotlin Data Models (`Models.kt`)

Save at: `app/src/main/java/com/arntechnology/stream/data/model/Models.kt`

```kotlin
package com.arntechnology.stream.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class ApiResponse<T>(
    @Json(name = "data") val data: T? = null,
    @Json(name = "success") val success: Boolean = true,
    @Json(name = "message") val message: String? = null
)

@JsonClass(generateAdapter = true)
data class ImageRef(
    @Json(name = "id") val id: Int? = null,
    @Json(name = "url") val url: String? = null,
    @Json(name = "thumb") val thumb: String? = null,
    @Json(name = "is_primary") val isPrimary: Boolean? = false
)

@JsonClass(generateAdapter = true)
data class SearchItem(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String = "",
    @Json(name = "type") val type: String = "movie",
    @Json(name = "year") val year: Int? = null,
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "libraryName") val libraryName: String? = null,
    @Json(name = "artistName") val artistName: String? = null,
    @Json(name = "albumTitle") val albumTitle: String? = null,
    @Json(name = "rank") val rank: Int? = null
)

@JsonClass(generateAdapter = true)
data class SearchResponse(
    @Json(name = "data") val data: List<SearchItem> = emptyList(),
    @Json(name = "prediction") val prediction: String? = null
)

@JsonClass(generateAdapter = true)
data class LibraryDetailsData(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "type") val type: String,
    @Json(name = "items") val items: List<Movie> = emptyList(),
    @Json(name = "counts") val counts: Map<String, Int>? = null
)

@JsonClass(generateAdapter = true)
data class TracksWrapper(
    @Json(name = "items") val items: List<Track> = emptyList(),
    @Json(name = "total") val total: Int = 0
)

@JsonClass(generateAdapter = true)
data class LiveTvCodeResponse(
    @Json(name = "code") val code: String? = null,
    @Json(name = "fgCode") val fgCode: String? = null,
    @Json(name = "success") val success: Boolean? = true
) {
    val resolvedCode: String get() = code?.takeIf { it.isNotBlank() } ?: fgCode?.takeIf { it.isNotBlank() } ?: "232425"
}

@JsonClass(generateAdapter = true)
data class HandoffResponse(
    @Json(name = "success") val success: Boolean = true,
    @Json(name = "delivered") val delivered: Boolean? = true,
    @Json(name = "isDlna") val isDlna: Boolean? = false
)

@JsonClass(generateAdapter = true)
data class ServerStatus(
    @Json(name = "initialized") val initialized: Boolean = true,
    @Json(name = "authenticated") val authenticated: Boolean = false,
    @Json(name = "user") val user: User? = null,
    @Json(name = "hasLibraries") val hasLibraries: Boolean = true
)

@JsonClass(generateAdapter = true)
data class User(
    @Json(name = "id") val id: Int = 1,
    @Json(name = "username") val username: String = "admin",
    @Json(name = "display_name") val displayName: String = "عبده رجب نصار",
    @Json(name = "role") val role: String? = "admin",
    @Json(name = "can_download") val canDownload: Boolean? = true,
    @Json(name = "can_cast") val canCast: Boolean? = true,
    @Json(name = "avatar") val avatar: String? = null
)

@JsonClass(generateAdapter = true)
data class Library(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "type") val type: String, // movies, shows, music, quran
    @Json(name = "custom_covers") val customCovers: String? = null
)

@JsonClass(generateAdapter = true)
data class Movie(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String = "",
    @Json(name = "year") val year: Int? = null,
    @Json(name = "duration") val duration: Long? = null,
    @Json(name = "rating") val rating: Double? = null,
    @Json(name = "plot") val plot: String? = null,
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "backdrop") val backdrop: String? = null,
    @Json(name = "posters") val posters: List<ImageRef>? = null,
    @Json(name = "backdrops") val backdrops: List<ImageRef>? = null
) {
    val displayPoster: String? get() = poster?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull { it.isPrimary == true }?.thumb?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull()?.thumb?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull()?.url?.takeIf { it.isNotBlank() }
        ?: backdrop?.takeIf { it.isNotBlank() }
        ?: "/api/image/placeholder"

    val displayBackdrop: String? get() = backdrop?.takeIf { it.isNotBlank() }
        ?: backdrops?.firstOrNull { it.isPrimary == true }?.url?.takeIf { it.isNotBlank() }
        ?: backdrops?.firstOrNull()?.url?.takeIf { it.isNotBlank() }
        ?: displayPoster
}

@JsonClass(generateAdapter = true)
data class Series(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String = "",
    @Json(name = "year") val year: Int? = null,
    @Json(name = "rating") val rating: Double? = null,
    @Json(name = "plot") val plot: String? = null,
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "backdrop") val backdrop: String? = null,
    @Json(name = "posters") val posters: List<ImageRef>? = null,
    @Json(name = "backdrops") val backdrops: List<ImageRef>? = null,
    @Json(name = "seasons") val seasons: List<Season> = emptyList()
) {
    val displayPoster: String? get() = poster?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull { it.isPrimary == true }?.thumb?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull()?.thumb?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull()?.url?.takeIf { it.isNotBlank() }
        ?: backdrop?.takeIf { it.isNotBlank() }
        ?: "/api/image/placeholder"

    val displayBackdrop: String? get() = backdrop?.takeIf { it.isNotBlank() }
        ?: backdrops?.firstOrNull { it.isPrimary == true }?.url?.takeIf { it.isNotBlank() }
        ?: backdrops?.firstOrNull()?.url?.takeIf { it.isNotBlank() }
        ?: displayPoster
}

@JsonClass(generateAdapter = true)
data class Season(
    @Json(name = "id") val id: Int,
    @Json(name = "season_number") val seasonNumber: Int,
    @Json(name = "title") val title: String? = null,
    @Json(name = "episodes_count") val episodesCount: Int = 0,
    @Json(name = "episodes") val episodes: List<Episode> = emptyList()
)

@JsonClass(generateAdapter = true)
data class Episode(
    @Json(name = "id") val id: Int,
    @Json(name = "episode_number") val episodeNumber: Int,
    @Json(name = "title") val title: String = "",
    @Json(name = "duration") val duration: Long? = null,
    @Json(name = "still_path") val stillPath: String? = null,
    @Json(name = "series_id") val seriesId: Int? = null,
    @Json(name = "season_id") val seasonId: Int? = null
) {
    val displayStill: String? get() = stillPath?.takeIf { it.isNotBlank() }
}

@JsonClass(generateAdapter = true)
data class Artist(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "name") val name: String = "",
    @Json(name = "image") val image: String? = null,
    @Json(name = "albums") val albums: List<Album>? = null
) {
    val displayImage: String? get() = image?.takeIf { it.isNotBlank() }
}

@JsonClass(generateAdapter = true)
data class Album(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "title") val title: String = "",
    @Json(name = "artistName") val artistName: String? = null,
    @Json(name = "year") val year: Int? = null,
    @Json(name = "cover") val cover: String? = null,
    @Json(name = "covers") val covers: List<ImageRef>? = null,
    @Json(name = "tracks") val tracks: List<Track>? = null
) {
    val displayCover: String? get() = cover?.takeIf { it.isNotBlank() }
        ?: covers?.firstOrNull()?.url?.takeIf { it.isNotBlank() }
}

@JsonClass(generateAdapter = true)
data class Track(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "title") val title: String = "",
    @Json(name = "duration") val duration: Long? = null,
    @Json(name = "artist_name") val artistName: String? = null,
    @Json(name = "album_title") val albumTitle: String? = null,
    @Json(name = "cover") val cover: String? = null,
    @Json(name = "stream_url") val streamUrl: String? = null
) {
    val displayTitle: String get() = if (title.isNotBlank()) title else "مقطع صوتي"
}

@JsonClass(generateAdapter = true)
data class PlaybackProgress(
    @Json(name = "media_type") val mediaType: String,
    @Json(name = "media_id") val mediaId: Int,
    @Json(name = "position") val position: Long,
    @Json(name = "duration") val duration: Long,
    @Json(name = "title") val title: String? = null,
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "backdrop") val backdrop: String? = null
)

@JsonClass(generateAdapter = true)
data class HandoffDevice(
    @Json(name = "deviceId") val deviceId: String = "",
    @Json(name = "name") val name: String = "",
    @Json(name = "type") val type: String = "tv",
    @Json(name = "isCurrent") val isCurrent: Boolean = false,
    @Json(name = "ip") val ip: String? = null
) {
    val id: String get() = if (deviceId.isNotEmpty()) deviceId else name
}

@JsonClass(generateAdapter = true)
data class HandoffCommand(
    @Json(name = "targetDeviceId") val targetDeviceId: String,
    @Json(name = "fromDeviceId") val fromDeviceId: String,
    @Json(name = "command") val command: String,
    @Json(name = "value") val value: Any? = null
)
```

---

## 5. Retrofit API Interface (`ArnApiService.kt`)

Save at: `app/src/main/java/com/arntechnology/stream/data/api/ArnApiService.kt`

```kotlin
package com.arntechnology.stream.data.api

import com.arntechnology.stream.data.model.*
import retrofit2.http.*

interface ArnApiService {

    @GET("api/status")
    suspend fun getServerStatus(): ServerStatus

    @GET("api/auth/users")
    suspend fun getUsers(): ApiResponse<List<User>>

    @POST("api/auth/login")
    suspend fun login(@Body body: Map<String, String>): ApiResponse<Map<String, Any>>

    @GET("api/libraries")
    suspend fun getLibraries(): ApiResponse<List<Library>>

    @GET("api/libraries/{id}")
    suspend fun getLibraryDetails(
        @Path("id") libraryId: Int,
        @Query("limit") limit: Int = 500
    ): ApiResponse<LibraryDetailsData>

    @GET("api/movies")
    suspend fun getMovies(
        @Query("library_id") libraryId: Int? = null,
        @Query("sort") sort: String? = null,
        @Query("limit") limit: Int = 500
    ): ApiResponse<List<Movie>>

    @GET("api/movies/{id}")
    suspend fun getMovieDetails(@Path("id") id: Int): ApiResponse<Movie>

    @GET("api/series")
    suspend fun getSeries(
        @Query("library_id") libraryId: Int? = null,
        @Query("sort") sort: String? = null,
        @Query("limit") limit: Int = 500
    ): ApiResponse<List<Series>>

    @GET("api/series/{id}")
    suspend fun getSeriesDetails(@Path("id") id: Int): ApiResponse<Series>

    @GET("api/series/{id}/seasons/{season}/episodes")
    suspend fun getSeasonEpisodes(
        @Path("id") seriesId: Int,
        @Path("season") seasonNumber: Int
    ): ApiResponse<List<Episode>>

    @GET("api/series/episodes/{id}")
    suspend fun getEpisodeDetails(@Path("id") episodeId: Int): ApiResponse<Episode>

    @GET("api/artists")
    suspend fun getArtists(
        @Query("library_id") libraryId: Int? = null,
        @Query("limit") limit: Int = 500
    ): ApiResponse<List<Artist>>

    @GET("api/artists/{id}")
    suspend fun getArtistDetails(@Path("id") artistId: Int): ApiResponse<Artist>

    @GET("api/albums")
    suspend fun getAlbums(
        @Query("library_id") libraryId: Int? = null,
        @Query("artist_id") artistId: Int? = null,
        @Query("limit") limit: Int = 500
    ): ApiResponse<List<Album>>

    @GET("api/tracks")
    suspend fun getTracks(
        @Query("artist_id") artistId: Int? = null,
        @Query("album_id") albumId: Int? = null,
        @Query("limit") limit: Int = 500
    ): ApiResponse<TracksWrapper>

    @GET("api/search")
    suspend fun search(
        @Query("q") query: String,
        @Query("type") type: String = "all"
    ): SearchResponse

    @GET("api/playback/continue")
    suspend fun getContinueWatching(@Query("limit") limit: Int = 10): ApiResponse<List<PlaybackProgress>>

    @POST("api/playback")
    suspend fun savePlaybackProgress(@Body progress: PlaybackProgress): ApiResponse<Map<String, Boolean>>

    @GET("api/live/code")
    suspend fun getLiveTvCode(): LiveTvCodeResponse

    @GET("api/handoff/devices")
    suspend fun getHandoffDevices(): ApiResponse<List<HandoffDevice>>

    @POST("api/handoff/command")
    suspend fun sendHandoffCommand(@Body command: HandoffCommand): HandoffResponse

    @POST("api/handoff/transfer")
    suspend fun transferPlayback(@Body payload: Map<String, Any>): HandoffResponse
}
```

---

## 6. Repository & Resilient Cache Engine (`MediaRepository.kt`)

Save at: `app/src/main/java/com/arntechnology/stream/data/repository/MediaRepository.kt`

```kotlin
package com.arntechnology.stream.data.repository

import android.os.Build
import com.arntechnology.stream.data.api.ApiClient
import com.arntechnology.stream.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap

object MediaRepository {
    private val cachedMovies = ConcurrentHashMap<Int, Movie>()
    private val cachedSeries = ConcurrentHashMap<Int, Series>()
    private val cachedArtists = ConcurrentHashMap<Int, Artist>()
    private val cachedAlbums = ConcurrentHashMap<Int, Album>()
    private val cachedLibraries = ConcurrentHashMap<Int, Library>()

    fun registerMovies(movies: List<Movie>) = movies.forEach { cachedMovies[it.id] = it }
    fun registerSeries(series: List<Series>) = series.forEach { cachedSeries[it.id] = it }
    fun registerArtists(artists: List<Artist>) = artists.forEach { cachedArtists[it.id] = it }
    fun registerAlbums(albums: List<Album>) = albums.forEach { cachedAlbums[it.id] = it }
    fun registerLibraries(libs: List<Library>) = libs.forEach { cachedLibraries[it.id] = it }

    fun getDeviceId(): String {
        val model = Build.MODEL ?: "Android"
        val id = Build.ID ?: "Device"
        return "android_${model.replace("\\s+".toRegex(), "_")}_${id}".lowercase()
    }

    suspend fun getMovieDetails(id: Int): Movie? = withContext(Dispatchers.IO) {
        cachedMovies[id]?.let { return@withContext it }
        try {
            val res = ApiClient.apiService.getMovieDetails(id)
            res.data?.let {
                cachedMovies[id] = it
                return@withContext it
            }
        } catch (_: Exception) {}
        null
    }

    suspend fun getSeriesDetails(id: Int): Series? = withContext(Dispatchers.IO) {
        cachedSeries[id]?.let { return@withContext it }
        try {
            val res = ApiClient.apiService.getSeriesDetails(id)
            res.data?.let {
                cachedSeries[id] = it
                return@withContext it
            }
        } catch (_: Exception) {}
        null
    }

    suspend fun getEpisodeDetails(id: Int): Episode? = withContext(Dispatchers.IO) {
        try {
            val res = ApiClient.apiService.getEpisodeDetails(id)
            if (res.data != null) return@withContext res.data
        } catch (_: Exception) {}
        for (s in cachedSeries.values) {
            for (season in s.seasons) {
                val ep = season.episodes.find { it.id == id }
                if (ep != null) return@withContext ep
            }
        }
        null
    }

    suspend fun getEpisodeAndSeries(episodeId: Int): Pair<Episode?, Series?> = withContext(Dispatchers.IO) {
        val ep = getEpisodeDetails(episodeId)
        val seriesId = ep?.seriesId
        val series = if (seriesId != null) getSeriesDetails(seriesId) else {
            cachedSeries.values.find { s -> s.seasons.any { it.episodes.any { it.id == episodeId } } }
        }
        Pair(ep, series)
    }

    suspend fun getEnrichedContinueWatching(limit: Int = 10): List<PlaybackProgress> = withContext(Dispatchers.IO) {
        try {
            val res = ApiClient.apiService.getContinueWatching(limit)
            val list = res.data ?: emptyList()
            if (list.isEmpty()) return@withContext emptyList()

            list.map { item ->
                if (!item.poster.isNullOrBlank()) item else {
                    when (item.mediaType) {
                        "movie" -> {
                            val movie = cachedMovies[item.mediaId] ?: getMovieDetails(item.mediaId)
                            if (movie != null) item.copy(
                                title = item.title ?: movie.title,
                                poster = movie.displayPoster,
                                backdrop = item.backdrop ?: movie.displayBackdrop
                            ) else item
                        }
                        "series", "episode" -> {
                            val ep = getEpisodeDetails(item.mediaId)
                            val sId = ep?.seriesId ?: item.mediaId
                            val series = cachedSeries[sId] ?: getSeriesDetails(sId)
                            item.copy(
                                title = item.title ?: ep?.title ?: series?.title,
                                poster = ep?.displayStill ?: series?.displayPoster,
                                backdrop = item.backdrop ?: series?.displayBackdrop
                            )
                        }
                        else -> item
                    }
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    suspend fun transferPlayback(
        targetDeviceId: String,
        mediaType: String,
        mediaId: Int,
        title: String? = null,
        positionSec: Long = 0L
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val payload = mapOf(
                "targetDeviceId" to targetDeviceId,
                "mediaType" to mediaType,
                "mediaId" to mediaId,
                "title" to (title ?: ""),
                "position" to positionSec,
                "action" to "play"
            )
            val res = ApiClient.apiService.transferPlayback(payload)
            return@withContext res.success || res.delivered == true
        } catch (_: Exception) {
            try {
                ApiClient.apiService.sendHandoffCommand(
                    HandoffCommand(
                        targetDeviceId = targetDeviceId,
                        fromDeviceId = getDeviceId(),
                        command = "play_media",
                        value = mapOf("mediaType" to mediaType, "mediaId" to mediaId, "position" to positionSec)
                    )
                )
                return@withContext true
            } catch (_: Exception) {
                return@withContext false
            }
        }
    }
}
```

---

## 7. ARN Technology Design Identity & Glassmorphic UI

In accordance with ARN Technology rules (Abdou Ragab Nassar), the UI must adhere to:

### 7.1. Color Palette (`Color.kt`)
- `ArnObsidian`: `#090D16` (Deep canvas background)
- `ArnSurface`: `#131B2E` (Semi-transparent cards with alpha 0.65f)
- `ArnBorder`: `#1E293B` (Border stroke with alpha 0.45f)
- `ArnCyanPrimary`: `#00C6FF` (Focus accents & highlight rings)
- `ArnGoldAccent`: `#D4AF37` (Remote control & premium badges)
- `ArnEmeraldPrimary`: `#10B981` (Success states & Developer signature tag)

### 7.2. "About the Program" Dialog (`ArnAboutDialog.kt`)
Popup `QDialog`-style dark card containing:
- **Title:** "حول منصة ARN Stream"
- **Developer Name:** "تطوير وبرمجة: عبده رجب نصار" (`#10b981`)
- **Copyright:** "حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة."
- **Circular Social Buttons (`border-radius: 25px`):**
  - WhatsApp: `https://wa.me/201556710314`
  - Telegram: `https://t.me/ABDOURNASSAR95`
  - Facebook: `https://www.facebook.com/abdournassar95`
  - Messenger: `https://m.me/abdournassar95`

---

## 8. Screen Flow & Architecture

1. **`SplashScreen` & `ConnectScreen`:**
   - Performs UDP Broadcast on port `8096` to automatically discover ARN-Stream servers on the local Wi-Fi.
   - Provides a camera QR scanner dialog (`CameraQrScannerDialog`) to scan pairing QR codes.
   - Allows manual IP/Host entry (`http://192.168.1.5:8096`).
   - Pings `GET /api/status` to validate connection.
2. **`ProfileLoginScreen`:**
   - Fetches users via `GET /api/auth/users`.
   - Renders avatar circles; on selection, prompts for password/PIN and issues `POST /api/auth/login`.
3. **`HomeScreen`:**
   - Top Dynamic Header Capsule displaying the active server, IP, and Cast/Remote icons.
   - Library Tabs Capsule (الأفلام، المسلسلات، الصوتيات، القرآن الكريم).
   - Fanned Deck Hero Banner showcasing trending or random library items.
   - "متابعة المشاهدة" (Continue Watching) row displaying progress bars and resolved posters.
   - Predictive Search Overlay: Real-time queries to `GET /api/search?q=...` rendering instant flat results with direct playback routing.
4. **`LibraryBrowserScreen`:**
   - Grid layout of movies, series, or albums with sorting chips (الأحدث، التقييم، الاسم).
5. **`VideoPlayerScreen` (Media3 ExoPlayer):**
   - Seamless ExoPlayer with `OkHttpDataSource`.
   - Dual-finger gestures: Left vertical swipe for brightness, right vertical swipe for volume.
   - Aspect ratio toggle (Fit, Fill, Zoom 16:9).
   - Audio tracks and subtitle selection (`GET /api/stream/info/:type/:id`).
   - Picture-in-Picture (PiP) on Android 8.0+.
   - Seamless Next/Prev episode switching powered by `getEpisodeAndSeries`.
   - Periodic progress reporting (`POST /api/playback`) every 10 seconds.
6. **`AudioPlayerScreen`:**
   - Background audio service (`ArnPlaybackService`) with lock-screen notification.
   - Real-time lyrics, sleep timer, playback speed control (0.5x - 2.0x), and queue manager.
7. **`RemoteControlScreen`:**
   - PlayTo TV Remote with glass D-Pad, Volume +/-, Mute, Play/Pause, and 10s Seek buttons.
   - Seamless handoff commands dispatched via `POST /api/handoff/command`.
8. **`LiveTvScreen`:**
   - Fetches pairing code from `GET /api/live/code` and displays the 6-digit PIN.

---

## 9. Complete Production `app/build.gradle.kts` Blueprint

Save at: `android/app/build.gradle.kts`

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.secrets)
    alias(libs.plugins.google.services)
}

android {
    namespace = "com.arntechnology.stream"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.arntechnology.stream"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        create("release") {
            val ksFile = file("arn_technology_release.jks")
            storeFile = if (ksFile.exists()) ksFile else file("${rootDir}/arn_technology_release.jks")
            storePassword = "arn_stream_2026"
            keyAlias = "arn_technology"
            keyPassword = "arn_stream_2026"
            enableV1Signing = true
            enableV2Signing = true
            enableV3Signing = true
            enableV4Signing = true
        }
    }

    buildTypes {
        release {
            isCrunchPngs = false
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.datastore.preferences)

    // Media3 (ExoPlayer)
    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.ui)
    implementation(libs.androidx.media3.session)
    implementation(libs.androidx.media3.datasource.okhttp)

    // Networking & Serialization
    implementation(libs.retrofit)
    implementation(libs.converter.moshi)
    implementation(libs.moshi.kotlin)
    implementation(libs.okhttp)
    implementation(libs.logging.interceptor)

    // Image Loading
    implementation(libs.coil.compose)

    // QR Code Scanning
    implementation(libs.play.services.code.scanner)
    implementation(libs.mlkit.barcode.scanning)
}
```

---

## 10. Automatic Keystore Generation Command (Terminal / CI)

To generate the permanent **ARN Technology Release Keystore** required for building the signed release APK, run:

```bash
keytool -genkeypair -v \
  -keystore app/arn_technology_release.jks \
  -alias arn_technology \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass arn_stream_2026 \
  -keypass arn_stream_2026 \
  -dname "CN=ARN Technology, OU=Mobile, O=ARN Technology, L=Cairo, ST=Cairo, C=EG"
```

Once generated, executing `./gradlew assembleRelease` creates the standalone, 100% installable **`ARN-Stream-Release.apk`** with complete V1, V2, V3, and V4 signatures ready for any phone, tablet, or Android TV.
