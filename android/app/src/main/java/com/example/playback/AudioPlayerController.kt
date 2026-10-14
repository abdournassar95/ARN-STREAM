package com.example.playback

import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.example.data.api.ApiClient
import com.example.data.model.Track
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object AudioPlayerController {

    private var exoPlayer: ExoPlayer? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var progressJob: Job? = null

    private val _currentTrack = MutableStateFlow<Track?>(null)
    val currentTrack: StateFlow<Track?> = _currentTrack.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _isStopped = MutableStateFlow(true)
    val isStopped: StateFlow<Boolean> = _isStopped.asStateFlow()

    private val _isDismissed = MutableStateFlow(false)
    val isDismissed: StateFlow<Boolean> = _isDismissed.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition: StateFlow<Long> = _currentPosition.asStateFlow()

    private val _duration = MutableStateFlow(0L)
    val duration: StateFlow<Long> = _duration.asStateFlow()

    private val _playlist = MutableStateFlow<List<Track>>(emptyList())
    val playlist: StateFlow<List<Track>> = _playlist.asStateFlow()

    fun initialize(context: Context) {
        if (exoPlayer == null) {
            val dataSourceFactory = androidx.media3.datasource.okhttp.OkHttpDataSource.Factory(ApiClient.okHttpClient)
            val mediaSourceFactory = androidx.media3.exoplayer.source.DefaultMediaSourceFactory(dataSourceFactory)
            exoPlayer = ExoPlayer.Builder(context.applicationContext)
                .setMediaSourceFactory(mediaSourceFactory)
                .build().apply {
                    addListener(object : Player.Listener {
                        override fun onIsPlayingChanged(playing: Boolean) {
                            _isPlaying.value = playing
                            if (playing) {
                                _isStopped.value = false
                                _isDismissed.value = false
                                startProgressPolling()
                            } else {
                                stopProgressPolling()
                            }
                        }

                        override fun onPlaybackStateChanged(playbackState: Int) {
                            if (playbackState == Player.STATE_READY) {
                                _duration.value = (exoPlayer?.duration ?: 0L).coerceAtLeast(0L)
                                _isStopped.value = false
                            } else if (playbackState == Player.STATE_ENDED) {
                                val current = _currentTrack.value
                                val list = _playlist.value
                                val currentIndex = list.indexOfFirst { it.id == current?.id }
                                if (currentIndex != -1 && currentIndex + 1 < list.size) {
                                    playNext()
                                } else {
                                    _isPlaying.value = false
                                    _isStopped.value = true
                                    _isDismissed.value = true
                                    stopProgressPolling()
                                }
                            } else if (playbackState == Player.STATE_IDLE) {
                                _isStopped.value = true
                            }
                        }
                    })
                }
        }
    }

    fun playTrack(track: Track, newPlaylist: List<Track> = emptyList()) {
        if (newPlaylist.isNotEmpty()) {
            _playlist.value = newPlaylist
        }
        _currentTrack.value = track
        _isDismissed.value = false
        _isStopped.value = false

        val player = exoPlayer ?: return
        val streamUrl = ApiClient.getFullMediaUrl("api/stream/track/${track.id}")
        val mediaItem = MediaItem.fromUri(streamUrl)
        player.setMediaItem(mediaItem)
        player.prepare()
        player.play()
    }

    fun dismissPlayer() {
        _isDismissed.value = true
    }

    fun stopPlayer() {
        exoPlayer?.stop()
        _isPlaying.value = false
        _isStopped.value = true
        _isDismissed.value = true
        stopProgressPolling()
    }

    fun closePlayer() {
        stopPlayer()
        _currentTrack.value = null
    }

    fun togglePlayPause() {
        val player = exoPlayer ?: return
        if (player.isPlaying) {
            player.pause()
        } else {
            player.play()
        }
    }

    fun seekTo(positionMs: Long) {
        exoPlayer?.seekTo(positionMs)
        _currentPosition.value = positionMs
    }

    fun seekDelta(deltaSeconds: Int) {
        val current = exoPlayer?.currentPosition ?: 0L
        val target = (current + deltaSeconds * 1000L).coerceAtLeast(0L)
        exoPlayer?.seekTo(target)
    }

    fun playNext() {
        val current = _currentTrack.value ?: return
        val list = _playlist.value
        val currentIndex = list.indexOfFirst { it.id == current.id }
        if (currentIndex != -1 && currentIndex + 1 < list.size) {
            playTrack(list[currentIndex + 1])
        }
    }

    fun playPrevious() {
        val current = _currentTrack.value ?: return
        val list = _playlist.value
        val currentIndex = list.indexOfFirst { it.id == current.id }
        if (currentIndex > 0) {
            playTrack(list[currentIndex - 1])
        }
    }

    private fun startProgressPolling() {
        stopProgressPolling()
        progressJob = scope.launch {
            while (isActive) {
                exoPlayer?.let { player ->
                    _currentPosition.value = player.currentPosition
                    if (player.duration > 0) {
                        _duration.value = player.duration
                    }
                }
                delay(500)
            }
        }
    }

    private fun stopProgressPolling() {
        progressJob?.cancel()
        progressJob = null
    }

    fun release() {
        stopProgressPolling()
        exoPlayer?.release()
        exoPlayer = null
    }
}
