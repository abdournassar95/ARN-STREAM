package com.arntechnology.stream.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LibrariesResponse(
    val data: List<LibraryItem> = emptyList()
)

@Serializable
data class LibraryItem(
    val id: Int,
    val name: String,
    val type: String, // movies, shows, music
    val icon: String? = null,
    @SerialName("custom_covers") val customCovers: String? = null,
    @SerialName("movies_count") val moviesCount: Int = 0,
    @SerialName("shows_count") val showsCount: Int = 0,
    @SerialName("tracks_count") val tracksCount: Int = 0
)

@Serializable
data class MoviesResponse(
    val data: List<MovieItem> = emptyList(),
    val meta: PaginationMeta? = null
)

@Serializable
data class MovieItem(
    val id: Int,
    val title: String,
    val year: Int? = null,
    val plot: String? = null,
    val duration: Long? = null,
    val resolution: String? = null,
    @SerialName("video_codec") val videoCodec: String? = null,
    @SerialName("audio_codec") val audioCodec: String? = null,
    val poster: String? = null,
    val backdrop: String? = null,
    val rating: Double? = null,
    val tags: List<TagItem> = emptyList()
)

@Serializable
data class MovieDetailsResponse(
    val data: MovieItem? = null
)

@Serializable
data class SeriesResponse(
    val data: List<SeriesItem> = emptyList(),
    val meta: PaginationMeta? = null
)

@Serializable
data class SeriesItem(
    val id: Int,
    val title: String,
    val year: Int? = null,
    val plot: String? = null,
    val poster: String? = null,
    val backdrop: String? = null,
    val rating: Double? = null,
    @SerialName("seasons_count") val seasonsCount: Int = 0,
    @SerialName("episodes_count") val episodesCount: Int = 0,
    val seasons: List<SeasonItem> = emptyList(),
    val tags: List<TagItem> = emptyList()
)

@Serializable
data class SeriesDetailsResponse(
    val data: SeriesItem? = null
)

@Serializable
data class SeasonItem(
    val id: Int,
    @SerialName("season_number") val seasonNumber: Int,
    val title: String? = null,
    @SerialName("episodes_count") val episodesCount: Int = 0
)

@Serializable
data class SeasonEpisodesResponse(
    val data: List<EpisodeItem> = emptyList()
)

@Serializable
data class EpisodeItem(
    val id: Int,
    @SerialName("episode_number") val episodeNumber: Int,
    @SerialName("season_number") val seasonNumber: Int? = null,
    val title: String? = null,
    val duration: Long? = null,
    val resolution: String? = null,
    val poster: String? = null
)

@Serializable
data class ArtistsResponse(
    val data: List<ArtistItem> = emptyList()
)

@Serializable
data class ArtistItem(
    val id: Int,
    val name: String,
    val image: String? = null,
    val albumsCount: Int = 0,
    val tracksCount: Int = 0,
    val year: Int? = null
)

@Serializable
data class AlbumsResponse(
    val data: List<AlbumItem> = emptyList()
)

@Serializable
data class AlbumItem(
    val id: Int,
    val title: String,
    val year: Int? = null,
    @SerialName("cover_path") val coverPath: String? = null,
    val cover: String? = null,
    val tracks: List<TrackItem> = emptyList()
)

@Serializable
data class AlbumDetailsResponse(
    val data: AlbumItem? = null
)

@Serializable
data class TrackItem(
    val id: Int,
    val title: String,
    @SerialName("track_number") val trackNumber: Int? = null,
    val duration: Long? = null,
    @SerialName("bit_rate") val bitRate: Int? = null,
    val format: String? = null,
    @SerialName("artist_name") val artistName: String? = null,
    @SerialName("album_title") val albumTitle: String? = null,
    val cover: String? = null
)

@Serializable
data class TagItem(
    val id: Int,
    val name: String,
    val color: String? = null
)

@Serializable
data class PaginationMeta(
    val total: Int = 0,
    val limit: Int = 50,
    val offset: Int = 0
)

@Serializable
data class SearchResponse(
    val data: List<SearchResultItem> = emptyList()
)

@Serializable
data class SearchResultItem(
    val id: Int,
    val title: String,
    val year: Int? = null,
    val type: String, // movie, series, track
    val poster: String? = null,
    @SerialName("libraryName") val libraryName: String? = null,
    @SerialName("artistName") val artistName: String? = null,
    @SerialName("albumTitle") val albumTitle: String? = null
)

@Serializable
data class StreamInfoResponse(
    val success: Boolean = false,
    val data: StreamInfoData? = null
)

@Serializable
data class StreamInfoData(
    val strategy: StreamStrategy? = null,
    val audioTracks: List<AudioTrackInfo> = emptyList(),
    val subtitles: List<SubtitleTrackInfo> = emptyList()
)

@Serializable
data class StreamStrategy(
    val mode: String = "direct", // direct, remux, transcode
    val videoCodec: String? = null,
    val audioCodec: String? = null,
    val duration: Long? = null
)

@Serializable
data class AudioTrackInfo(
    val id: Int,
    val title: String? = null,
    val language: String? = null,
    val codec: String? = null
)

@Serializable
data class SubtitleTrackInfo(
    val id: String,
    val title: String? = null,
    val language: String? = null,
    val format: String? = null,
    val isLocal: Boolean = false,
    val path: String? = null
)

@Serializable
data class ContinueWatchingResponse(
    val data: List<PlaybackStateItem> = emptyList()
)

@Serializable
data class PlaybackStateItem(
    val id: Int? = null,
    @SerialName("media_type") val mediaType: String,
    @SerialName("media_id") val mediaId: Int,
    val title: String? = null,
    val position: Long = 0,
    val duration: Long? = null
)

@Serializable
data class PlaybackStateRequest(
    @SerialName("media_type") val mediaType: String,
    @SerialName("media_id") val mediaId: Int,
    val position: Long,
    val duration: Long? = null
)

@Serializable
data class LiveTvCodeResponse(
    val code: String = "232425"
)
