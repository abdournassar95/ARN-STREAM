package com.example.data.api

import com.example.data.model.*
import okhttp3.ResponseBody
import retrofit2.Response
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

    @GET("api/series/episodes/{id}")
    suspend fun getEpisodeDetails(@Path("id") id: Int): ApiResponse<Episode>

    @GET("api/series/seasons/{seasonId}")
    suspend fun getSeasonDetails(@Path("seasonId") seasonId: Int): ApiResponse<Season>

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
    suspend fun getArtistAlbums(@Query("artist_id") artistId: Int): ApiResponse<List<Album>>

    @GET("api/tracks")
    suspend fun getArtistTracks(@Query("artist_id") artistId: Int): ApiResponse<TracksWrapper>

    @GET("api/albums")
    suspend fun getAlbums(
        @Query("artist_id") artistId: Int? = null,
        @Query("artist") artist: String? = null,
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
        @Query("artist") artist: String? = null,
        @Query("q") query: String? = null,
        @Query("limit") limit: Int = 500
    ): ApiResponse<TracksWrapper>

    @GET("api/artists/{id}/albums")
    suspend fun getArtistAlbumsRaw(@Path("id") artistId: Int): Response<ResponseBody>

    @GET("api/artists/{id}")
    suspend fun getArtistRaw(@Path("id") artistId: Int): Response<ResponseBody>

    @GET("api/albums")
    suspend fun getAlbumsRaw(@Query("artist_id") artistId: Int? = null): Response<ResponseBody>

    // Live TV
    @GET("api/live/code")
    suspend fun getLiveTvCode(): LiveTvCodeResponse

    // Stream info (Audio tracks, Subtitles)
    @GET("api/stream/info/{type}/{id}")
    suspend fun getStreamInfo(
        @Path("type") type: String, // movie or episode
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
