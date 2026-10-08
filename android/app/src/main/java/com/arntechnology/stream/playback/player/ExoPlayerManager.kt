package com.arntechnology.stream.playback.player

import android.content.Context
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import com.arntechnology.stream.data.api.NetworkClient
import com.arntechnology.stream.data.model.SubtitleTrackInfo
import okhttp3.OkHttpClient

class ExoPlayerManager(
    private val context: Context,
    okHttpClient: OkHttpClient = NetworkClient(context).okHttpClient
) {
    private val dataSourceFactory = OkHttpDataSource.Factory(okHttpClient)
    private val mediaSourceFactory = DefaultMediaSourceFactory(context).setDataSourceFactory(dataSourceFactory)

    val player: ExoPlayer = ExoPlayer.Builder(context)
        .setMediaSourceFactory(mediaSourceFactory)
        .build()

    fun prepareAndPlay(
        streamUrl: String,
        startPositionMs: Long = 0,
        subtitles: List<SubtitleTrackInfo> = emptyList(),
        serverBaseUrl: String = ""
    ) {
        val subtitleConfigs = subtitles.mapNotNull { sub ->
            val subUri = if (!sub.path.isNullOrEmpty()) {
                val encodedPath = Uri.encode(sub.path)
                Uri.parse("${serverBaseUrl.trimEnd('/')}/api/subtitles/serve?path=$encodedPath")
            } else null

            subUri?.let {
                MediaItem.SubtitleConfiguration.Builder(it)
                    .setMimeType(MimeTypes.TEXT_VTT)
                    .setLanguage(sub.language ?: "ar")
                    .setLabel(sub.title ?: "ترجمة عربية")
                    .setSelectionFlags(if (sub.language == "ar") C.SELECTION_FLAG_DEFAULT else 0)
                    .build()
            }
        }

        val mediaItem = MediaItem.Builder()
            .setUri(Uri.parse(streamUrl))
            .setSubtitleConfigurations(subtitleConfigs)
            .build()

        player.setMediaItem(mediaItem, startPositionMs)
        player.prepare()
        player.playWhenReady = true
    }

    fun seekRelative(seconds: Long) {
        val newPos = (player.currentPosition + (seconds * 1000)).coerceAtLeast(0)
            .coerceAtMost(player.duration.coerceAtLeast(0))
        player.seekTo(newPos)
    }

    fun setSubtitleTrack(trackGroupIndex: Int, trackIndex: Int) {
        val tracks = player.currentTracks
        for (group in tracks.groups) {
            if (group.type == C.TRACK_TYPE_TEXT) {
                val override = TrackSelectionOverride(group.mediaTrackGroup, trackIndex)
                player.trackSelectionParameters = player.trackSelectionParameters
                    .buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                    .setOverrideForType(override)
                    .build()
                return
            }
        }
    }

    fun disableSubtitles() {
        player.trackSelectionParameters = player.trackSelectionParameters
            .buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            .build()
    }

    fun release() {
        player.release()
    }
}
