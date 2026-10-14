package com.example.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ══════════════════════════════════════════════════════════════
// 1. الاستجابات العامة ومراجع الصور
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

// ══════════════════════════════════════════════════════════════
// 4. المستخدمون والمصادقة
// ══════════════════════════════════════════════════════════════

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
data class PublicUser(
    @Json(name = "id") val id: Int,
    @Json(name = "username") val username: String,
    @Json(name = "display_name") val displayName: String,
    @Json(name = "avatar") val avatar: String? = null
)

@JsonClass(generateAdapter = true)
data class LoginRequest(
    @Json(name = "username") val username: String,
    @Json(name = "password") val password: String
)

@JsonClass(generateAdapter = true)
data class LoginResponseData(
    @Json(name = "token") val token: String,
    @Json(name = "user") val user: User
)

// ══════════════════════════════════════════════════════════════
// 5. المكتبات والوسوم
// ══════════════════════════════════════════════════════════════

@JsonClass(generateAdapter = true)
data class Library(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "type") val type: String, // movies, shows, music, quran, live
    @Json(name = "icon") val icon: String? = null,
    @Json(name = "custom_covers") val customCovers: String? = null,
    @Json(name = "movies_count") val moviesCount: Int = 0,
    @Json(name = "shows_count") val showsCount: Int = 0,
    @Json(name = "tracks_count") val tracksCount: Int = 0
)

@JsonClass(generateAdapter = true)
data class Tag(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "name") val name: String = "",
    @Json(name = "color") val color: String? = "#ef4444"
)

// ══════════════════════════════════════════════════════════════
// 6. الأفلام
// ══════════════════════════════════════════════════════════════

@JsonClass(generateAdapter = true)
data class Movie(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String = "",
    @Json(name = "year") val year: Int? = null,
    @Json(name = "plot") val plot: String? = null,
    @Json(name = "duration") val duration: Long? = null, // seconds
    @Json(name = "resolution") val resolution: String? = "1080p",
    @Json(name = "video_codec") val videoCodec: String? = "h264",
    @Json(name = "audio_codec") val audioCodec: String? = "aac",
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "poster_path") val posterPath: String? = null,
    @Json(name = "cover") val cover: String? = null,
    @Json(name = "cover_url") val coverUrl: String? = null,
    @Json(name = "image") val image: String? = null,
    @Json(name = "image_url") val imageUrl: String? = null,
    @Json(name = "thumbnail") val thumbnail: String? = null,
    @Json(name = "thumbnail_url") val thumbnailUrl: String? = null,
    @Json(name = "poster_url") val posterUrl: String? = null,
    @Json(name = "pic") val pic: String? = null,
    @Json(name = "banner") val banner: String? = null,
    @Json(name = "banner_url") val bannerUrl: String? = null,
    @Json(name = "backdrop") val backdrop: String? = null,
    @Json(name = "backdrop_path") val backdropPath: String? = null,
    @Json(name = "fanart") val fanart: String? = null,
    @Json(name = "fanart_url") val fanartUrl: String? = null,
    @Json(name = "backdrop_url") val backdropUrl: String? = null,
    @Json(name = "posters") val posters: List<ImageRef>? = null,
    @Json(name = "backdrops") val backdrops: List<ImageRef>? = null,
    @Json(name = "rating") val rating: Double? = null,
    @Json(name = "tags") val tags: List<Tag> = emptyList(),
    @Json(name = "library_id") val libraryId: Int? = null
) {
    val displayPoster: String? get() = poster?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull { it.isPrimary == true }?.thumb?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull()?.thumb?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull()?.url?.takeIf { it.isNotBlank() }
        ?: posterPath?.takeIf { it.isNotBlank() }
        ?: cover?.takeIf { it.isNotBlank() }
        ?: coverUrl?.takeIf { it.isNotBlank() }
        ?: image?.takeIf { it.isNotBlank() }
        ?: imageUrl?.takeIf { it.isNotBlank() }
        ?: thumbnail?.takeIf { it.isNotBlank() }
        ?: thumbnailUrl?.takeIf { it.isNotBlank() }
        ?: posterUrl?.takeIf { it.isNotBlank() }
        ?: pic?.takeIf { it.isNotBlank() }
        ?: backdrop?.takeIf { it.isNotBlank() }
        ?: "/api/image/placeholder"

    val displayBackdrop: String? get() = backdrop?.takeIf { it.isNotBlank() }
        ?: backdrops?.firstOrNull { it.isPrimary == true }?.url?.takeIf { it.isNotBlank() }
        ?: backdrops?.firstOrNull()?.url?.takeIf { it.isNotBlank() }
        ?: backdropPath?.takeIf { it.isNotBlank() }
        ?: backdropUrl?.takeIf { it.isNotBlank() }
        ?: fanart?.takeIf { it.isNotBlank() }
        ?: fanartUrl?.takeIf { it.isNotBlank() }
        ?: banner?.takeIf { it.isNotBlank() }
        ?: bannerUrl?.takeIf { it.isNotBlank() }
        ?: displayPoster
}

@JsonClass(generateAdapter = true)
data class MoviesResponse(
    @Json(name = "data") val data: List<Movie> = emptyList()
)

// ══════════════════════════════════════════════════════════════
// 7. المسلسلات والمواسم والحلقات
// ══════════════════════════════════════════════════════════════

@JsonClass(generateAdapter = true)
data class Series(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String = "",
    @Json(name = "year") val year: Int? = null,
    @Json(name = "plot") val plot: String? = null,
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "poster_path") val posterPath: String? = null,
    @Json(name = "cover") val cover: String? = null,
    @Json(name = "cover_url") val coverUrl: String? = null,
    @Json(name = "image") val image: String? = null,
    @Json(name = "image_url") val imageUrl: String? = null,
    @Json(name = "thumbnail") val thumbnail: String? = null,
    @Json(name = "thumbnail_url") val thumbnailUrl: String? = null,
    @Json(name = "poster_url") val posterUrl: String? = null,
    @Json(name = "pic") val pic: String? = null,
    @Json(name = "banner") val banner: String? = null,
    @Json(name = "banner_url") val bannerUrl: String? = null,
    @Json(name = "backdrop") val backdrop: String? = null,
    @Json(name = "backdrop_path") val backdropPath: String? = null,
    @Json(name = "fanart") val fanart: String? = null,
    @Json(name = "fanart_url") val fanartUrl: String? = null,
    @Json(name = "backdrop_url") val backdropUrl: String? = null,
    @Json(name = "posters") val posters: List<ImageRef>? = null,
    @Json(name = "backdrops") val backdrops: List<ImageRef>? = null,
    @Json(name = "rating") val rating: Double? = null,
    @Json(name = "seasons_count") val seasonsCount: Int = 0,
    @Json(name = "episodes_count") val episodesCount: Int = 0,
    @Json(name = "seasons") val seasons: List<Season> = emptyList(),
    @Json(name = "library_id") val libraryId: Int? = null
) {
    val displayPoster: String? get() = poster?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull { it.isPrimary == true }?.thumb?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull()?.thumb?.takeIf { it.isNotBlank() }
        ?: posters?.firstOrNull()?.url?.takeIf { it.isNotBlank() }
        ?: posterPath?.takeIf { it.isNotBlank() }
        ?: cover?.takeIf { it.isNotBlank() }
        ?: coverUrl?.takeIf { it.isNotBlank() }
        ?: image?.takeIf { it.isNotBlank() }
        ?: imageUrl?.takeIf { it.isNotBlank() }
        ?: thumbnail?.takeIf { it.isNotBlank() }
        ?: thumbnailUrl?.takeIf { it.isNotBlank() }
        ?: posterUrl?.takeIf { it.isNotBlank() }
        ?: pic?.takeIf { it.isNotBlank() }
        ?: backdrop?.takeIf { it.isNotBlank() }
        ?: "/api/image/placeholder"

    val displayBackdrop: String? get() = backdrop?.takeIf { it.isNotBlank() }
        ?: backdrops?.firstOrNull { it.isPrimary == true }?.url?.takeIf { it.isNotBlank() }
        ?: backdrops?.firstOrNull()?.url?.takeIf { it.isNotBlank() }
        ?: backdropPath?.takeIf { it.isNotBlank() }
        ?: backdropUrl?.takeIf { it.isNotBlank() }
        ?: fanart?.takeIf { it.isNotBlank() }
        ?: fanartUrl?.takeIf { it.isNotBlank() }
        ?: banner?.takeIf { it.isNotBlank() }
        ?: bannerUrl?.takeIf { it.isNotBlank() }
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
    @Json(name = "resolution") val resolution: String? = "1080p",
    @Json(name = "path") val path: String? = null,
    @Json(name = "still_path") val stillPath: String? = null,
    @Json(name = "image") val image: String? = null,
    @Json(name = "thumbnail") val thumbnail: String? = null,
    @Json(name = "cover") val cover: String? = null,
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "series_id") val seriesId: Int? = null,
    @Json(name = "seriesId") val seriesIdAlt: Int? = null,
    @Json(name = "series_title") val seriesTitle: String? = null,
    @Json(name = "season_id") val seasonId: Int? = null,
    @Json(name = "season_number") val seasonNumber: Int? = null
) {
    val resolvedSeriesId: Int? get() = seriesId ?: seriesIdAlt

    val displayStill: String? get() = stillPath?.takeIf { it.isNotBlank() }
        ?: image?.takeIf { it.isNotBlank() }
        ?: thumbnail?.takeIf { it.isNotBlank() }
        ?: cover?.takeIf { it.isNotBlank() }
        ?: poster?.takeIf { it.isNotBlank() }
}

// ══════════════════════════════════════════════════════════════
// 8. الصوتيات والقرآن الكريم
// ══════════════════════════════════════════════════════════════

@JsonClass(generateAdapter = true)
data class Artist(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "name") val name: String = "",
    @Json(name = "image") val image: String? = null,
    @Json(name = "cover") val cover: String? = null,
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "albumsCount") val albumsCount: Int = 0,
    @Json(name = "albums_count") val albumsCountAlt: Int? = null,
    @Json(name = "tracksCount") val tracksCount: Int = 0,
    @Json(name = "tracks_count") val tracksCountAlt: Int? = null,
    @Json(name = "year") val year: Int? = null,
    @Json(name = "bio") val bio: String? = null,
    @Json(name = "category") val category: String? = null,
    @Json(name = "library_id") val libraryId: Int? = null,
    @Json(name = "albums") val albums: List<Album>? = null,
    @Json(name = "tracks") val tracks: List<Track>? = null
) {
    val displayImage: String? get() = image ?: cover ?: poster
    val totalAlbums: Int get() = if (albumsCount > 0) albumsCount else (albumsCountAlt ?: (albums?.size ?: 0))
    val totalTracks: Int get() = if (tracksCount > 0) tracksCount else (tracksCountAlt ?: (tracks?.size ?: 0))
}

@JsonClass(generateAdapter = true)
data class Album(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "title") val title: String = "",
    @Json(name = "name") val name: String? = null,
    @Json(name = "year") val year: Int? = null,
    @Json(name = "cover") val cover: String? = null,
    @Json(name = "cover_url") val coverUrl: String? = null,
    @Json(name = "image") val image: String? = null,
    @Json(name = "image_url") val imageUrl: String? = null,
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "poster_url") val posterUrl: String? = null,
    @Json(name = "artwork") val artwork: String? = null,
    @Json(name = "artwork_url") val artworkUrl: String? = null,
    @Json(name = "album_art") val albumArt: String? = null,
    @Json(name = "albumArt") val albumArtAlt: String? = null,
    @Json(name = "thumbnail") val thumbnail: String? = null,
    @Json(name = "thumb") val thumb: String? = null,
    @Json(name = "picture") val picture: String? = null,
    @Json(name = "cover_path") val coverPath: String? = null,
    @Json(name = "album_cover") val albumCover: String? = null,
    @Json(name = "covers") val covers: List<ImageRef>? = null,
    @Json(name = "tracksCount") val tracksCount: Int = 0,
    @Json(name = "tracks_count") val tracksCountAlt: Int? = null,
    @Json(name = "artistId") val artistId: Int? = null,
    @Json(name = "artist_id") val artistIdAlt: Int? = null,
    @Json(name = "artistName") val artistName: String? = null,
    @Json(name = "artist") val artistNameAlt: String? = null,
    @Json(name = "artist_image") val artistImage: String? = null,
    @Json(name = "tracks") val tracks: List<Track>? = null
) {
    val displayTitle: String get() = if (title.isNotBlank()) title else (name ?: "ألبوم")
    val displayCover: String? get() = cover?.takeIf { it.isNotBlank() }
        ?: covers?.firstOrNull { it.isPrimary == true }?.thumb?.takeIf { it.isNotBlank() }
        ?: covers?.firstOrNull()?.thumb?.takeIf { it.isNotBlank() }
        ?: covers?.firstOrNull()?.url?.takeIf { it.isNotBlank() }
        ?: coverUrl?.takeIf { it.isNotBlank() }
        ?: image?.takeIf { it.isNotBlank() }
        ?: imageUrl?.takeIf { it.isNotBlank() }
        ?: poster?.takeIf { it.isNotBlank() }
        ?: posterUrl?.takeIf { it.isNotBlank() }
        ?: artwork?.takeIf { it.isNotBlank() }
        ?: artworkUrl?.takeIf { it.isNotBlank() }
        ?: albumCover?.takeIf { it.isNotBlank() }
        ?: albumArt?.takeIf { it.isNotBlank() }
        ?: albumArtAlt?.takeIf { it.isNotBlank() }
        ?: thumb?.takeIf { it.isNotBlank() }
        ?: thumbnail?.takeIf { it.isNotBlank() }
        ?: picture?.takeIf { it.isNotBlank() }
        ?: coverPath?.takeIf { it.isNotBlank() }
        ?: tracks?.firstOrNull { !it.displayCover.isNullOrBlank() }?.displayCover
        ?: artistImage
    val totalTracks: Int get() = if (tracksCount > 0) tracksCount else (tracksCountAlt ?: (tracks?.size ?: 0))
    val trackList: List<Track> get() = tracks ?: emptyList()
}

@JsonClass(generateAdapter = true)
data class Track(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "title") val title: String = "",
    @Json(name = "name") val name: String? = null,
    @Json(name = "track_number") val trackNumber: Int? = null,
    @Json(name = "trackNumber") val trackNumberAlt: Int? = null,
    @Json(name = "duration") val duration: Long? = null, // seconds
    @Json(name = "bit_rate") val bitRate: Int? = null,
    @Json(name = "bitrate") val bitRateAlt: Int? = null,
    @Json(name = "format") val format: String? = "mp3",
    @Json(name = "artist_name") val artistName: String? = null,
    @Json(name = "artist") val artistNameAlt: String? = null,
    @Json(name = "album_title") val albumTitle: String? = null,
    @Json(name = "album") val albumTitleAlt: String? = null,
    @Json(name = "cover") val cover: String? = null,
    @Json(name = "image") val image: String? = null,
    @Json(name = "artwork") val artwork: String? = null,
    @Json(name = "album_cover") val albumCover: String? = null,
    @Json(name = "path") val path: String? = null,
    @Json(name = "url") val url: String? = null,
    @Json(name = "stream_url") val streamUrl: String? = null,
    @Json(name = "library_type") val libraryType: String? = null
) {
    val displayTitle: String get() = if (title.isNotBlank()) title else (name ?: "مقطع صوتي")
    val displayCover: String? get() = cover?.takeIf { it.isNotBlank() }
        ?: image?.takeIf { it.isNotBlank() }
        ?: albumCover?.takeIf { it.isNotBlank() }
        ?: artwork?.takeIf { it.isNotBlank() }
    val displayArtist: String? get() = artistName ?: artistNameAlt
    val displayAlbum: String? get() = albumTitle ?: albumTitleAlt
    val playUrl: String? get() = streamUrl ?: url ?: path
}

// ══════════════════════════════════════════════════════════════
// 9. استئناف المشاهدة والتدفق
// ══════════════════════════════════════════════════════════════

@JsonClass(generateAdapter = true)
data class PlaybackProgress(
    @Json(name = "media_type") val mediaType: String, // movie, episode, track
    @Json(name = "media_id") val mediaId: Int,
    @Json(name = "position") val position: Long, // seconds
    @Json(name = "duration") val duration: Long,
    @Json(name = "title") val title: String? = null,
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "backdrop") val backdrop: String? = null
)

@JsonClass(generateAdapter = true)
data class SubtitleTrack(
    @Json(name = "id") val id: String,
    @Json(name = "title") val title: String,
    @Json(name = "language") val language: String = "ar",
    @Json(name = "format") val format: String = "vtt",
    @Json(name = "isLocal") val isLocal: Boolean = true
)

@JsonClass(generateAdapter = true)
data class AudioTrackItem(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String,
    @Json(name = "language") val language: String = "ara",
    @Json(name = "codec") val codec: String = "aac"
)

@JsonClass(generateAdapter = true)
data class StreamInfo(
    @Json(name = "audioTracks") val audioTracks: List<AudioTrackItem> = emptyList(),
    @Json(name = "subtitles") val subtitles: List<SubtitleTrack> = emptyList()
)

// Legacy compatibility for SearchResult
@JsonClass(generateAdapter = true)
data class SearchResult(
    @Json(name = "movies") val movies: List<Movie> = emptyList(),
    @Json(name = "series") val series: List<Series> = emptyList(),
    @Json(name = "tracks") val tracks: List<Track> = emptyList()
)

// ══════════════════════════════════════════════════════════════
// 10. الريموت كنترول والاكتشاف والمفضلة
// ══════════════════════════════════════════════════════════════

@JsonClass(generateAdapter = true)
data class HandoffDevice(
    @Json(name = "deviceId") val deviceId: String = "",
    @Json(name = "name") val name: String = "",
    @Json(name = "type") val type: String = "tv", // tv, web, mobile
    @Json(name = "isCurrent") val isCurrent: Boolean = false,
    @Json(name = "lastActive") val lastActive: String? = null,
    @Json(name = "id") val idAlt: String? = null,
    @Json(name = "ip") val ip: String? = null
) {
    val id: String get() = if (deviceId.isNotEmpty()) deviceId else (idAlt ?: name.ifEmpty { "device_1" })
}

@JsonClass(generateAdapter = true)
data class HandoffCommand(
    @Json(name = "targetDeviceId") val targetDeviceId: String,
    @Json(name = "fromDeviceId") val fromDeviceId: String,
    @Json(name = "command") val command: String, // play, pause, seek_delta, volume, mute, dpad, send_string
    @Json(name = "value") val value: Any? = null
)

@JsonClass(generateAdapter = true)
data class DiscoveredServer(
    val name: String,
    val host: String,
    val port: Int = 8096,
    val baseUrl: String
)

@JsonClass(generateAdapter = true)
data class FavoriteMediaItem(
    @Json(name = "id") val id: Int,
    @Json(name = "type") val type: String, // "movie" or "series"
    @Json(name = "title") val title: String,
    @Json(name = "poster") val poster: String? = null,
    @Json(name = "rating") val rating: Double? = null,
    @Json(name = "year") val year: Int? = null,
    @Json(name = "addedAt") val addedAt: Long = System.currentTimeMillis()
)
