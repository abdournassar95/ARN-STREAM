package com.arntechnology.stream.playback.player

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.arntechnology.stream.data.model.TrackItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AudioPlayerManager private constructor(context: Context) {

    companion object {
        @Volatile
        private var instance: AudioPlayerManager? = null

        fun getInstance(context: Context): AudioPlayerManager {
            return instance ?: synchronized(this) {
                instance ?: AudioPlayerManager(context.applicationContext).also { instance = it }
            }
        }
    }

    private val player: ExoPlayer = ExoPlayer.Builder(context).build()

    private val _currentTrack = MutableStateFlow<TrackItem?>(null)
    val currentTrack: StateFlow<TrackItem?> = _currentTrack.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition: StateFlow<Long> = _currentPosition.asStateFlow()

    private val _duration = MutableStateFlow(0L)
    val duration: StateFlow<Long> = _duration.asStateFlow()

    private var queue: List<TrackItem> = emptyList()
    private var currentIndex = 0
    private var serverBaseUrl = ""

    init {
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                _isPlaying.value = playing
            }

            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) {
                    _duration.value = player.duration.coerceAtLeast(0L)
                } else if (state == Player.STATE_ENDED) {
                    playNext()
                }
            }
        })
    }

    fun playTrackList(tracks: List<TrackItem>, startIndex: Int, baseUrl: String) {
        if (tracks.isEmpty()) return
        queue = tracks
        currentIndex = startIndex.coerceIn(0, tracks.lastIndex)
        serverBaseUrl = baseUrl

        playCurrentIndex()
    }

    private fun playCurrentIndex() {
        val track = queue.getOrNull(currentIndex) ?: return
        _currentTrack.value = track

        val streamUrl = "${serverBaseUrl.trimEnd('/')}/api/stream/track/${track.id}"
        val mediaMetadata = MediaMetadata.Builder()
            .setTitle(track.title)
            .setArtist(track.artistName ?: "")
            .setAlbumTitle(track.albumTitle ?: "")
            .build()

        val mediaItem = MediaItem.Builder()
            .setUri(Uri.parse(streamUrl))
            .setMediaMetadata(mediaMetadata)
            .build()

        player.setMediaItem(mediaItem)
        player.prepare()
        player.playWhenReady = true
    }

    fun togglePlayPause() {
        if (player.isPlaying) {
            player.pause()
        } else {
            player.play()
        }
    }

    fun playNext() {
        if (currentIndex < queue.lastIndex) {
            currentIndex++
            playCurrentIndex()
        }
    }

    fun playPrevious() {
        if (player.currentPosition > 3000) {
            player.seekTo(0)
        } else if (currentIndex > 0) {
            currentIndex--
            playCurrentIndex()
        }
    }

    fun seekTo(positionMs: Long) {
        player.seekTo(positionMs)
    }

    fun updateProgress() {
        if (player.isPlaying) {
            _currentPosition.value = player.currentPosition
            _duration.value = player.duration.coerceAtLeast(0L)
        }
    }
}
