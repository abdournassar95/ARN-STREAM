package com.arntechnology.stream.data.api

import com.arntechnology.stream.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ArnApiService {

    // ─── 1. المصادقة والتحقق ──────────────────────────────────────────────────
    @GET("api/auth/status")
    suspend fun getServerStatus(): Response<ServerStatusResponse>

    @GET("api/auth/public-users")
    suspend fun getPublicUsers(): Response<PublicUsersResponse>

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    // ─── 2. المكتبات والأقسام ─────────────────────────────────────────────────
    @GET("api/libraries")
    suspend fun getLibraries(
        @Query("non_empty") nonEmpty: Boolean = true
    ): Response<LibrariesResponse>

    // ─── 3. الأفلام ──────────────────────────────────────────────────────────
    @GET("api/movies")
    suspend fun getMovies(
        @Query("q") query: String? = null,
        @Query("year") year: Int? = null,
        @Query("library_id") libraryId: Int? = null,
        @Query("sort") sort: String = "added_at",
        @Query("order") order: String = "DESC",
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0
    ): Response<MoviesResponse>

    @GET("api/movies/{id}")
    suspend fun getMovieDetails(@Path("id") id: Int): Response<MovieDetailsResponse>

    // ─── 4. المسلسلات والمواسم والحلقات ─────────────────────────────────────
    @GET("api/series")
    suspend fun getSeries(
        @Query("q") query: String? = null,
        @Query("library_id") libraryId: Int? = null,
        @Query("sort") sort: String = "added_at",
        @Query("order") order: String = "DESC",
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0
    ): Response<SeriesResponse>

    @GET("api/series/{id}")
    suspend fun getSeriesDetails(@Path("id") id: Int): Response<SeriesDetailsResponse>

    @GET("api/series/{id}/season/{seasonNumber}")
    suspend fun getSeasonEpisodes(
        @Path("id") seriesId: Int,
        @Path("seasonNumber") seasonNumber: Int
    ): Response<SeasonEpisodesResponse>

    // ─── 5. الصوتيات والقرآن الكريم ─────────────────────────────────────────
    @GET("api/artists")
    suspend fun getArtists(
        @Query("q") query: String? = null,
        @Query("library_id") libraryId: Int? = null,
        @Query("sort") sort: String = "name",
        @Query("order") order: String = "asc",
        @Query("limit") limit: Int = 100
    ): Response<ArtistsResponse>

    @GET("api/artists/{id}/albums")
    suspend fun getArtistAlbums(@Path("id") artistId: Int): Response<AlbumsResponse>

    @GET("api/albums/{id}")
    suspend fun getAlbumDetails(@Path("id") albumId: Int): Response<AlbumDetailsResponse>

    // ─── 6. البحث الذكي التنبؤي ──────────────────────────────────────────────
    @GET("api/search")
    suspend fun search(
        @Query("q") query: String,
        @Query("type") type: String = "all",
        @Query("limit") limit: Int = 30
    ): Response<SearchResponse>

    // ─── 7. معلومات البث والترجمات ──────────────────────────────────────────
    @GET("api/stream/info/{type}/{id}")
    suspend fun getStreamInfo(
        @Path("type") type: String,
        @Path("id") id: Int
    ): Response<StreamInfoResponse>

    // ─── 8. استئناف المشاهدة وحفظ التقدم ────────────────────────────────────
    @GET("api/playback/continue")
    suspend fun getContinueWatching(
        @Query("limit") limit: Int = 15
    ): Response<ContinueWatchingResponse>

    @POST("api/playback")
    suspend fun updatePlaybackState(
        @Body request: PlaybackStateRequest
    ): Response<GenericSuccessResponse>

    // ─── 9. البث المباشر (Live TV) ───────────────────────────────────────────
    @GET("api/live/code")
    suspend fun getLiveTvCode(): Response<LiveTvCodeResponse>

    // ─── 10. الريموت كنترول والبث للأجهزة (PlayTo / Handoff) ─────────────────
    @GET("api/handoff/devices")
    suspend fun getConnectedDevices(
        @Query("currentDeviceId") currentDeviceId: String? = null
    ): Response<DiscoveredDevicesResponse>

    @POST("api/handoff/register")
    suspend fun registerDevice(
        @Body request: RegisterDeviceRequest
    ): Response<GenericSuccessResponse>

    @POST("api/handoff/command")
    suspend fun sendRemoteCommand(
        @Body request: RemoteCommandRequest
    ): Response<GenericSuccessResponse>

    @POST("api/handoff/transfer")
    suspend fun transferPlayback(
        @Body request: HandoffTransferRequest
    ): Response<GenericSuccessResponse>
}
