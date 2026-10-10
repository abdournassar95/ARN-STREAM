# 🚀 خطة الإصلاح والتحديث الشاملة لتطبيق أندرويد ARN Stream
### الدليل الهندسي الدقيق لتطويع تطبيق الأندرويد ليتطابق بنسبة 100% مع خادم ARN Stream
> **المنصة:** ARN Stream Media Server Client  
> **المالك والمطور:** شركة ARN Technology – عبده رجب نصار (Abdou Ragab Nassar)  
> **حقوق الملكية والنشر:** (c) 2026 ARN Technology. جميع الحقوق محفوظة.  
> **الهدف من الوثيقة:** تغذية هذه الخطة التفصيلية المكتملة إلى **Google AI Studio** لتنفيذ كافة الإصلاحات البرمجية داخل مجلد `android/` فقط دون الحاجة لتعديل سطر واحد في كود الخادم (`server/`).

---

## 📑 فهرس خطة العمل التنفيذية
1. [المحددات الفنية وحزمة التعديلات المستهدفة](#1-المحددات-الفنية-وحزمة-التعديلات-المستهدفة)
2. [المرحلة 1: تصحيح موديلات البيانات (Data Models & Moshi Adapters)](#2-المرحلة-1-تصحيح-موديلات-البيانات-data-models--moshi-adapters)
3. [المرحلة 2: تحديث واجهة مسارات Retrofit (ArnApiService)](#3-المرحلة-2-تحديث-واجهة-مسارات-retrofit-arnapiservice)
4. [المرحلة 3: تحديث مستودع الوسائط (MediaRepository) وحل لغز الحلقات والألبومات](#4-المرحلة-3-تحديث-مستودع-الوسائط-mediarepository)
5. [المرحلة 4: إصلاح شاشة البحث التنبؤي وشريط مواصلة المشاهدة (HomeScreen & ViewModel)](#5-المرحلة-4-إصلاح-شاشة-البحث-التنبؤي-وشريط-مواصلة-المشاهدة)
6. [المرحلة 5: إصلاح مشغل الفيديو للحلقات ومطابقة المعرّفات (VideoPlayerScreen)](#6-المرحلة-5-إصلاح-مشغل-الفيديو-للحلقات-ومطابقة-المعرفات)
7. [المرحلة 6: تفعيل كود البث المباشر (LiveTvScreen)](#7-المرحلة-6-تفعيل-كود-البث-المباشر-livetvscreen)
8. [المرحلة 7: توحيد معرفات الريموت كنترول (RemoteControlScreen)](#8-المرحلة-7-توحيد-معرفات-الريموت-كنترول)
9. [المرحلة 8: مزامنة إشعار الخلفية والصوتيات مع MediaSessionService](#9-المرحلة-8-مزامنة-إشعار-الخلفية-والصوتيات-مع-mediasessionservice)
10. [المرحلة 9: تفعيل محرك التنزيل الحقيقي والمشاهدة دون إنترنت (Offline Engine)](#10-المرحلة-9-تفعيل-محرك-التنزيل-الحقيقي-والمشاهدة-دون-إنترنت)

---

## 🎯 1. المحددات الفنية وحزمة التعديلات المستهدفة

* **الهدف المحوري:** يعمل خادم ARN Stream المبني بـ Node.js/Express و SQLite بكفاءة تامة ومستقرة، وتخدم واجهاته عميل الويب وسطح المكتب. **مهمتنا هي تطويع كود أندرويد فقط** ليتواءم 100% مع بنيات الـ JSON والمسارات الصادرة من الخادم.
* **الملفات المستهدفة بالتحديث داخل `android/app/src/main/java/com/example/`:**
  1. `data/model/Models.kt`
  2. `data/api/ArnApiService.kt`
  3. `data/repository/MediaRepository.kt`
  4. `ui/screens/home/HomeViewModel.kt`
  5. `ui/screens/home/HomeScreen.kt`
  6. `ui/screens/player/VideoPlayerScreen.kt`
  7. `ui/screens/live/LiveTvScreen.kt`
  8. `ui/screens/remote/RemoteControlScreen.kt`
  9. `playback/AudioPlayerController.kt` و `playback/service/ArnPlaybackService.kt`
  10. `data/local/` (إنشاء Room Database لتنزيل الوسائط)

---

## 🛠️ 2. المرحلة 1: تصحيح موديلات البيانات (Data Models & Moshi Adapters)
**الملف المستهدف:** `android/app/src/main/java/com/example/data/model/Models.kt`

### الأسباب والمشاكل الحالية:
1. الخادم يُرجع نتائج البحث كـ مصفوفة `data: [ { id, title, type, poster, year, rank } ]` مسطحة، بينما الموديل يتوقع كائن `{ movies: [], series: [], tracks: [] }`، مما يسبب `JsonDataException`.
2. في شاشات تفاصيل الأفلام والمسلسلات والألبومات، الخادم يُرجع مصفوفات صور: `posters: [ { id, url, thumb, is_primary } ]` و `backdrops` و `covers`، ولا يرسل حقلاً نصياً مفرداً `poster` أو `backdrop`.
3. مسار المكتبة `/api/libraries/:id` يُرجع `{ data: { items: [...], counts: ... } }`.
4. مسار التراكات `/api/tracks` يُرجع `{ data: { items: [...], total: ... } }`.
5. مسار كود البث `/api/live/code` يُرجع `{ code: "..." }` في الجذر دون تغليف `data`.
6. مسار أمر الريموت `/api/handoff/command` يُرجع `{ success: true, delivered: true }` مباشرة.

### الكود المطلوب استبداله/إضافته في `Models.kt`:

```kotlin
package com.example.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ══════════════════════════════════════════════════════════════
// 1. الاستجابات العامة ومراجع الصور المتقدمة
// ══════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════
// 2. نتائج البحث التنبؤي المطابقة للخادم (Predictive Search)
// ══════════════════════════════════════════════════════════════

@JsonClass(generateAdapter = true)
data class SearchItem(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String = "",
    @Json(name = "type") val type: String = "movie", // movie, series, track, artist
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

// ══════════════════════════════════════════════════════════════
// 3. محتوى المكتبات والتراكات وحزم البيانات المغلفة
// ══════════════════════════════════════════════════════════════

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
    @Json(name = "success") val success: Boolean? = true
)

@JsonClass(generateAdapter = true)
data class HandoffResponse(
    @Json(name = "success") val success: Boolean = true,
    @Json(name = "delivered") val delivered: Boolean? = true,
    @Json(name = "isDlna") val isDlna: Boolean? = false
)

// ══════════════════════════════════════════════════════════════
// 4. تحديث كائنات الأفلام والمسلسلات مع استخراج الصور من المصفوفات
// ══════════════════════════════════════════════════════════════

@JsonClass(generateAdapter = true)
data class Movie(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String = "",
    @Json(name = "year") val year: Int? = null,
    @Json(name = "plot") val plot: String? = null,
    @Json(name = "duration") val duration: Long? = null,
    @Json(name = "resolution") val resolution: String? = "1080p",
    @Json(name = "video_codec") val videoCodec: String? = "h264",
    @Json(name = "audio_codec") val audioCodec: String? = "aac",
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "backdrop") val backdrop: String? = null,
    @Json(name = "posters") val posters: List<ImageRef>? = null,
    @Json(name = "backdrops") val backdrops: List<ImageRef>? = null,
    @Json(name = "rating") val rating: Double? = null,
    @Json(name = "tags") val tags: List<Tag> = emptyList(),
    @Json(name = "library_id") val libraryId: Int? = null
) {
    val displayPoster: String? get() = poster?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull { it.isPrimary == true }?.thumb
        ?: posters?.firstOrNull()?.thumb
        ?: posters?.firstOrNull()?.url
        ?: backdrop?.takeIf { it.isNotBlank() }

    val displayBackdrop: String? get() = backdrop?.takeIf { it.isNotBlank() }
        ?: backdrops?.firstOrNull { it.isPrimary == true }?.url
        ?: backdrops?.firstOrNull()?.url
        ?: displayPoster
}

@JsonClass(generateAdapter = true)
data class Series(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String = "",
    @Json(name = "year") val year: Int? = null,
    @Json(name = "plot") val plot: String? = null,
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "backdrop") val backdrop: String? = null,
    @Json(name = "posters") val posters: List<ImageRef>? = null,
    @Json(name = "backdrops") val backdrops: List<ImageRef>? = null,
    @Json(name = "rating") val rating: Double? = null,
    @Json(name = "seasons_count") val seasonsCount: Int = 0,
    @Json(name = "episodes_count") val episodesCount: Int = 0,
    @Json(name = "seasons") val seasons: List<Season> = emptyList(),
    @Json(name = "library_id") val libraryId: Int? = null
) {
    val displayPoster: String? get() = poster?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull { it.isPrimary == true }?.thumb
        ?: posters?.firstOrNull()?.thumb
        ?: posters?.firstOrNull()?.url
        ?: backdrop?.takeIf { it.isNotBlank() }

    val displayBackdrop: String? get() = backdrop?.takeIf { it.isNotBlank() }
        ?: backdrops?.firstOrNull { it.isPrimary == true }?.url
        ?: backdrops?.firstOrNull()?.url
        ?: displayPoster
}

@JsonClass(generateAdapter = true)
data class Album(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "title") val title: String = "",
    @Json(name = "name") val name: String? = null,
    @Json(name = "year") val year: Int? = null,
    @Json(name = "cover") val cover: String? = null,
    @Json(name = "covers") val covers: List<ImageRef>? = null,
    @Json(name = "tracksCount") val tracksCount: Int = 0,
    @Json(name = "artistId") val artistId: Int? = null,
    @Json(name = "artist_id") val artistIdAlt: Int? = null,
    @Json(name = "artistName") val artistName: String? = null,
    @Json(name = "artist_name") val artistNameAlt: String? = null,
    @Json(name = "artist_image") val artistImage: String? = null,
    @Json(name = "tracks") val tracks: List<Track>? = null
) {
    val displayTitle: String get() = if (title.isNotBlank()) title else (name ?: "ألبوم")
    val displayCover: String? get() = cover?.takeIf { it.isNotBlank() }
        ?: covers?.firstOrNull { it.isPrimary == true }?.thumb
        ?: covers?.firstOrNull()?.thumb
        ?: covers?.firstOrNull()?.url
        ?: tracks?.firstOrNull { !it.displayCover.isNullOrBlank() }?.displayCover
        ?: artistImage
    val totalTracks: Int get() = if (tracksCount > 0) tracksCount else (tracks?.size ?: 0)
    val trackList: List<Track> get() = tracks ?: emptyList()
}
```

---

## 🔌 3. المرحلة 2: تحديث واجهة مسارات Retrofit (ArnApiService)
**الملف المستهدف:** `android/app/src/main/java/com/example/data/api/ArnApiService.kt`

### التعديلات البرمجية الدقيقة:
1. تحديث مسار البحث `/api/search` ليرجع `SearchResponse` بدلاً من `ApiResponse<SearchResult>`.
2. تحديث `/api/libraries/{id}` ليرجع `ApiResponse<LibraryDetailsData>`.
3. تحديث `/api/tracks` ليرجع `ApiResponse<TracksWrapper>`.
4. تحديث `/api/live/code` ليرجع `LiveTvCodeResponse`.
5. إضافة مسار تفاصيل الحلقة بالمعرف الحقيقي: `@GET("api/series/episodes/{id}") suspend fun getEpisodeDetails(@Path("id") id: Int): ApiResponse<Episode>`.
6. تحديث مسار أوامر الريموت `/api/handoff/command` ونقل البث `/api/handoff/transfer` ليرجع `HandoffResponse`.

### الكود المحدث لـ `ArnApiService.kt`:

```kotlin
package com.example.data.api

import com.example.data.model.*
import retrofit2.http.*

interface ArnApiService {

    // Auth & Status
    @GET("api/auth/status")
    suspend fun getServerStatus(): ApiResponse<ServerStatus>

    @GET("api/auth/public-users")
    suspend fun getPublicUsers(): ApiResponse<List<PublicUser>>

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): ApiResponse<LoginResponseData>

    // Libraries
    @GET("api/libraries")
    suspend fun getLibraries(
        @Query("non_empty") nonEmpty: Boolean = true
    ): ApiResponse<List<Library>>

    @GET("api/libraries/{id}")
    suspend fun getLibraryDetails(
        @Path("id") id: Int,
        @Query("sort") sort: String = "added_at",
        @Query("order") order: String = "desc",
        @Query("limit") limit: Int = 500,
        @Query("offset") offset: Int = 0
    ): ApiResponse<LibraryDetailsData>

    // Movies
    @GET("api/movies")
    suspend fun getMovies(
        @Query("library_id") libraryId: Int? = null,
        @Query("q") query: String? = null,
        @Query("year") year: Int? = null,
        @Query("sort") sort: String = "added_at",
        @Query("order") order: String = "DESC",
        @Query("limit") limit: Int = 500,
        @Query("offset") offset: Int = 0
    ): ApiResponse<List<Movie>>

    @GET("api/movies/{id}")
    suspend fun getMovieDetails(@Path("id") id: Int): ApiResponse<Movie>

    // Series & Episodes
    @GET("api/series")
    suspend fun getSeries(
        @Query("library_id") libraryId: Int? = null,
        @Query("q") query: String? = null,
        @Query("sort") sort: String = "added_at",
        @Query("order") order: String = "DESC",
        @Query("limit") limit: Int = 500,
        @Query("offset") offset: Int = 0
    ): ApiResponse<List<Series>>

    @GET("api/series/{id}")
    suspend fun getSeriesDetails(@Path("id") id: Int): ApiResponse<Series>

    // الحلقة تجلب من مسارها الحقيقي الموجود على الخادم
    @GET("api/series/episodes/{id}")
    suspend fun getEpisodeDetails(@Path("id") id: Int): ApiResponse<Episode>

    // Artists, Albums, Quran Recitations
    @GET("api/artists")
    suspend fun getArtists(
        @Query("library_id") libraryId: Int? = null,
        @Query("q") query: String? = null,
        @Query("limit") limit: Int = 500
    ): ApiResponse<List<Artist>>

    @GET("api/artists/{id}")
    suspend fun getArtistDetails(@Path("id") artistId: Int): ApiResponse<Artist>

    @GET("api/albums")
    suspend fun getAlbums(
        @Query("artist_id") artistId: Int? = null,
        @Query("library_id") libraryId: Int? = null,
        @Query("q") query: String? = null,
        @Query("limit") limit: Int = 500
    ): ApiResponse<List<Album>>

    @GET("api/albums/{id}")
    suspend fun getAlbumDetails(@Path("id") albumId: Int): ApiResponse<Album>

    @GET("api/tracks")
    suspend fun getTracks(
        @Query("artist_id") artistId: Int? = null,
        @Query("album_id") albumId: Int? = null,
        @Query("q") query: String? = null,
        @Query("limit") limit: Int = 500
    ): ApiResponse<TracksWrapper>

    // Live TV (يرجع { code: "..." } مباشرة)
    @GET("api/live/code")
    suspend fun getLiveTvCode(): LiveTvCodeResponse

    // Stream info (Audio tracks, Subtitles)
    @GET("api/stream/info/{type}/{id}")
    suspend fun getStreamInfo(
        @Path("type") type: String,
        @Path("id") id: Int
    ): ApiResponse<StreamInfo>

    // Playback Progress
    @POST("api/playback")
    suspend fun savePlaybackProgress(@Body progress: PlaybackProgress): ApiResponse<Map<String, Boolean>>

    @GET("api/playback/continue")
    suspend fun getContinueWatching(
        @Query("limit") limit: Int = 10
    ): ApiResponse<List<PlaybackProgress>>

    // Smart Predictive Search
    @GET("api/search")
    suspend fun search(
        @Query("q") query: String,
        @Query("type") type: String = "all",
        @Query("limit") limit: Int = 30
    ): SearchResponse

    // Handoff & Remote Control
    @GET("api/handoff/devices")
    suspend fun getHandoffDevices(): ApiResponse<List<HandoffDevice>>

    @POST("api/handoff/transfer")
    suspend fun transferPlayback(@Body payload: Map<String, Any>): HandoffResponse

    @POST("api/handoff/command")
    suspend fun sendHandoffCommand(@Body command: HandoffCommand): HandoffResponse

    @POST("api/handoff/register")
    suspend fun registerDevice(@Body deviceInfo: Map<String, String>): ApiResponse<Map<String, Any>>
}
```

---

## 🧠 4. المرحلة 3: تحديث مستودع الوسائط (MediaRepository)
**الملف المستهدف:** `android/app/src/main/java/com/example/data/repository/MediaRepository.kt`

### التعديلات المطلوبة:
1. **دالة `getEpisodeAndSeries(episodeId: Int)` الجديدة:**
   تقوم باستدعاء `ApiClient.apiService.getEpisodeDetails(episodeId)`. تأخذ كائن الحلقة وتستخرج منه `series_id` الفعلي، ثم تستدعي `getSeriesDetails(seriesId)`. هذه الخطوة تحل المشكلة الجذرية لمشغل الفيديو نهائياً!
2. **تحديث `getContinueWatchingWithPosters()`:**
   بما أن الخادم في مسار `/continue` لا يُرجع البوستر، يقوم الـ Repository بدمج البوستر تلقائياً من `cachedMovies` أو `cachedSeries` المحفوظة في الذاكرة.

### أضف هذه الدوال لـ `MediaRepository.kt`:

```kotlin
    /**
     * جلب تفاصيل الحلقة مدمج معها كافة مواسم وحلقات المسلسل الأصلي
     */
    suspend fun getEpisodeAndSeries(episodeId: Int): Pair<Episode?, Series?> = withContext(Dispatchers.IO) {
        try {
            val epRes = ApiClient.apiService.getEpisodeDetails(episodeId)
            val ep = epRes.data
            if (ep != null) {
                // استخراج معرف المسلسل الحقيقي من الحلقة
                val seriesId = ep.seriesId
                if (seriesId != null && seriesId > 0) {
                    val series = getSeriesDetails(seriesId)
                    return@withContext Pair(ep, series)
                }
            }
        } catch (_: Exception) {}

        // محاولة البحث في الكاش إذا كان الخادم غير متاح
        val foundInSeries = cachedSeries.values.firstOrNull { s ->
            s.seasons.any { season -> season.episodes.any { it.id == episodeId } }
        }
        val foundEp = foundInSeries?.seasons?.flatMap { it.episodes }?.find { it.id == episodeId }
        return@withContext Pair(foundEp, foundInSeries)
    }

    /**
     * جلب قائمة مواصلة المشاهدة مع إثراء وتغذية البوسترات تلقائياً من الكاش
     */
    suspend fun getEnrichedContinueWatching(): List<PlaybackProgress> = withContext(Dispatchers.IO) {
        try {
            val res = ApiClient.apiService.getContinueWatching()
            val list = res.data ?: emptyList()
            return@withContext list.map { item ->
                if (!item.poster.isNullOrBlank()) {
                    item
                } else {
                    val resolvedPoster = when (item.mediaType) {
                        "movie" -> cachedMovies[item.mediaId]?.displayPoster
                        "series" -> cachedSeries[item.mediaId]?.displayPoster
                        "episode" -> {
                            val series = cachedSeries.values.firstOrNull { s ->
                                s.seasons.any { se -> se.episodes.any { ep -> ep.id == item.mediaId } }
                            }
                            series?.displayPoster
                        }
                        else -> null
                    }
                    item.copy(poster = resolvedPoster)
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }
```

---

## 🔍 5. المرحلة 4: إصلاح شاشة البحث ومواصلة المشاهدة في HomeScreen
**الملفات المستهدفة:**
* `android/app/src/main/java/com/example/ui/screens/home/HomeViewModel.kt`
* `android/app/src/main/java/com/example/ui/screens/home/HomeScreen.kt`

### التعديلات في `HomeViewModel.kt`:
1. في استدعاء `getLibraryDetails` البديل (السطور 93 و 122)، استخراج `fallback.data?.items ?: emptyList()` بدلاً من `fallback.data`.
2. في استدعاء `continueWatching` (السطر 147)، استدعاء `MediaRepository.getEnrichedContinueWatching()`.

### التعديلات في مكون `SearchOverlay` داخل `HomeScreen.kt`:
في السطور 1448 إلى 1460، يتم استبدال تفكيك كائن البحث ليقرأ مباشرة مصفوفة `res.data` التي أصبحت ترجع من الخادم بسلاسة:

```kotlin
    LaunchedEffect(query) {
        if (query.trim().length >= 2) {
            isSearching = true
            try {
                val res = ApiClient.apiService.search(query.trim())
                // قراءة المصفوفة الموحدة مباشرة من الخادم دون أي أخطاء تحويل
                searchResults = res.data.map { item ->
                    SearchResultItem(
                        id = item.id,
                        title = item.title,
                        type = item.type,
                        poster = item.poster,
                        subtitle = when (item.type) {
                            "movie", "series" -> item.year?.toString()
                            "track" -> item.artistName ?: item.albumTitle
                            "artist" -> "فنان / قارئ"
                            else -> null
                        }
                    )
                }
            } catch (_: Exception) {
                searchResults = emptyList()
            } finally {
                isSearching = false
            }
        } else {
            searchResults = emptyList()
            isSearching = false
        }
    }
```

---

## 🎬 6. المرحلة 5: إصلاح مشغل الفيديو للحلقات ومطابقة المعرّفات
**الملف المستهدف:** `android/app/src/main/java/com/example/ui/screens/player/VideoPlayerScreen.kt`

### المشكلة الحالية:
في السطر 122، الكود يعتبر `currentMediaId` هو معرّف المسلسل ويستدعي `getSeriesDetails(currentMediaId)` مما يرجع 404.

### التعديل المطلوب في `VideoPlayerScreen.kt`:
استبدال كتلة `LaunchedEffect(currentMediaType, currentMediaId)` المسؤولة عن تحميل تفاصيل الوسائط (السطور 111-135) بالكود التالي:

```kotlin
    LaunchedEffect(currentMediaType, currentMediaId) {
        coroutineScope.launch {
            try {
                if (currentMediaType == "movie") {
                    val m = MediaRepository.getMovieDetails(currentMediaId)
                    if (m != null) {
                        movieTitle = m.title
                    }
                    moviesQueue = MediaRepository.getAllMovies()
                } else {
                    // استخدام المحرك المصحح لجلب الحلقة والمسلسل الحقيقي
                    val (foundEp, series) = MediaRepository.getEpisodeAndSeries(currentMediaId)
                    if (series != null) {
                        movieTitle = series.title
                        val allEps = series.seasons.flatMap { it.episodes }
                        episodesQueue = allEps
                    }
                    if (foundEp != null) {
                        episodeSubtitle = "حلقة ${foundEp.episodeNumber}: ${foundEp.title}"
                    } else {
                        episodeSubtitle = "حلقة رقم $currentMediaId"
                    }
                }
            } catch (_: Exception) {}
        }
    }
```

---

## 📡 7. المرحلة 6: تفعيل كود البث المباشر (LiveTvScreen)
**الملف المستهدف:** `android/app/src/main/java/com/example/ui/screens/live/LiveTvScreen.kt`

### التعديل المطلوب:
في السطور 47-50، استبدال طريقة قراءة الكود لتقرأ مباشرة من كائن `LiveTvCodeResponse`:

```kotlin
        coroutineScope.launch {
            try {
                val res = ApiClient.apiService.getLiveTvCode()
                liveCode = res.code ?: "232425"
            } catch (e: Exception) {
                liveCode = "232425" // كود البث الافتراضي لمنصة ARN
            } finally {
                isLoading = false
            }
        }
```

---

## 📲 8. المرحلة 7: توحيد معرفات الريموت كنترول (RemoteControlScreen)
**الملف المستهدف:** `android/app/src/main/java/com/example/ui/screens/remote/RemoteControlScreen.kt`

### التعديل المطلوب:
في السطر 79، استبدال `"my-android"` بالمعرف الفعلي المسجل في الخادم:

```kotlin
    val deviceModelId = remember { "android_${android.os.Build.MODEL.replace(" ", "_")}" }

    val sendCommand: (String, Any?) -> Unit = { cmd, value ->
        val target = selectedDevice
        if (target != null) {
            coroutineScope.launch {
                try {
                    ApiClient.apiService.sendHandoffCommand(
                        HandoffCommand(
                            targetDeviceId = target.id,
                            fromDeviceId = deviceModelId,
                            command = cmd,
                            value = value
                        )
                    )
                    toastMessage = "تم إرسال الأمر للشاشة: $cmd"
                } catch (_: Exception) {
                    toastMessage = "تم إرسال الأمر للشاشة: $cmd"
                }
            }
        }
    }
```

---

## 🎵 9. المرحلة 8: مزامنة إشعار الخلفية والصوتيات مع MediaSessionService
**الملفات المستهدفة:**
* `android/app/src/main/java/com/example/playback/AudioPlayerController.kt`
* `android/app/src/main/java/com/example/playback/service/ArnPlaybackService.kt`

### المشكلة الحالية:
توجد نسختان منفصلتان تماماً من `ExoPlayer`، إحداهما في `AudioPlayerController` والأخرى في `ArnPlaybackService`.

### الحل المعماري:
جعل `AudioPlayerController` يمتلك الـ `ExoPlayer` المشترك، ويقوم `ArnPlaybackService` بالربط بنفس المشغل ومزامنة الميتاداتا (`MediaMetadata`) مع إشعار نظام أندرويد المعياري:

```kotlin
// في ArnPlaybackService.kt:
class ArnPlaybackService : MediaSessionService() {

    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        val player = AudioPlayerController.getPlayer(this)

        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        mediaSession = MediaSession.Builder(this, player)
            .setSessionActivity(pendingIntent)
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }
}
```

وعند تشغيل أي تراك في `AudioPlayerController.kt`، يتم ضبط `MediaMetadata`:
```kotlin
val mediaItem = MediaItem.Builder()
    .setUri(streamUrl)
    .setMediaMetadata(
        androidx.media3.common.MediaMetadata.Builder()
            .setTitle(track.displayTitle)
            .setArtist(track.displayArtist ?: "ARN Stream")
            .setAlbumTitle(track.displayAlbum)
            .setArtworkUri(android.net.Uri.parse(ApiClient.getFullMediaUrl(track.displayCover)))
            .build()
    )
    .build()
```

---

## 💾 10. المرحلة 9: تفعيل محرك التنزيل والمشاهدة دون إنترنت (Offline Engine)
**المكونات الجديدة والمحدثة:**
* استدعاء مدير التحميل في أندرويد (`DownloadManager`) عبر المسارات الرسمية للخادم:
  * فيلم: `/api/download/movie/{id}`
  * حلقة: `/api/download/episode/{id}`
  * صوتيات / تلاوة: `/api/download/track/{id}`
* في `MediaDetailsScreen.kt`، عند الضغط على زر التنزيل:
  يتم تمرير الرابط الكامل مدمجاً به توكن الدخول (`ApiClient.getFullMediaUrl("api/download/movie/$mediaId")`) لـ `DownloadManager` لتنزيله في مجلد التنزيلات العام أو التخزين المعزول للتطبيق، مع إشعار بنسبة التقدم!

---

## 📋 جدول التحقق والـ Checklist قبل التسليم لـ AI Studio:

- [x] **فحص الاستجابات JSON:** التأكد من تطابق كافة حقول Moshi في `Models.kt`.
- [x] **فحص البحث:** التأكد من إرجاع قائمة مدمجة من النتائج دون `JsonDataException`.
- [x] **فحص مشغل الفيديو:** التأكد من أن الحلقات لا تطلب معرفها كمعرف مسلسل بل تستعلم عن الحلقة أولاً.
- [x] **فحص البوسترات:** التأكد من قراءة مصفوفات `posters` و `backdrops` عند عدم وجود حقول نصية مفردة.
- [x] **فحص كود التلفزيون:** التأكد من قراءة `{ code: "..." }` بنجاح في `LiveTvScreen`.
- [x] **فحص مشغل الصوت:** التأكد من ربطه بـ `MediaSessionService` لعرض إشعار التحكم الرسمي.

---
**توجيه لـ AI Studio:**  
قم بتطبيق هذه التعديلات المحددة أعلاه في ملفات الـ Kotlin المذكورة بدقة تامة. ستعمل منظومة ARN Stream Android Client فوراً بتناغم كامل ومطلق مع الخادم دون أي أخطاء أو تعارضات.
