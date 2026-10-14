package com.example.ui.screens.player

import android.app.Activity
import android.content.Context
import android.media.AudioManager
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.example.data.api.ApiClient
import com.example.data.model.Episode
import com.example.data.model.Movie
import com.example.data.model.PlaybackProgress
import com.example.data.repository.MediaRepository
import com.example.ui.components.CastSelectionDialog
import com.example.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(UnstableApi::class)
@Composable
fun VideoPlayerScreen(
    mediaType: String,
    mediaId: Int,
    onBack: () -> Unit,
    onCastToTv: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val activity = context as? Activity
    val audioManager = remember { context.getSystemService(Context.AUDIO_SERVICE) as AudioManager }
    val maxAudioVolume = remember { audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1) }

    var currentMediaId by remember { mutableStateOf(mediaId) }
    var currentMediaType by remember { mutableStateOf(mediaType) }
    var movieTitle by remember { mutableStateOf("مشاهدة الفيديو") }
    var episodeSubtitle by remember { mutableStateOf<String?>(null) }

    // Playlist / Episodes queue for Next and Previous actions
    var episodesQueue by remember { mutableStateOf<List<Episode>>(emptyList()) }
    var moviesQueue by remember { mutableStateOf<List<Movie>>(emptyList()) }

    var isPlaying by remember { mutableStateOf(true) }
    var currentPosition by remember { mutableStateOf(0L) }
    var totalDuration by remember { mutableStateOf(0L) }
    var areControlsVisible by remember { mutableStateOf(true) }
    var isTouchLocked by remember { mutableStateOf(false) }
    var resizeMode by remember { mutableStateOf(AspectRatioFrameLayout.RESIZE_MODE_FIT) }
    var playbackSpeed by remember { mutableStateOf(1.0f) }
    var showSpeedDialog by remember { mutableStateOf(false) }
    var showTrackSheet by remember { mutableStateOf(false) }
    var showCastDialog by remember { mutableStateOf(false) }

    // Volume & Brightness HUD state
    var currentVolume by remember { mutableStateOf(audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)) }
    var showVolumeHud by remember { mutableStateOf(false) }
    var showBrightnessHud by remember { mutableStateOf(false) }
    var currentBrightness by remember {
        val windowBrightness = activity?.window?.attributes?.screenBrightness ?: -1f
        mutableStateOf(if (windowBrightness >= 0f) windowBrightness else 0.5f)
    }

    // Auto-hide HUD indicators
    LaunchedEffect(showVolumeHud) {
        if (showVolumeHud) {
            delay(1500)
            showVolumeHud = false
        }
    }

    LaunchedEffect(showBrightnessHud) {
        if (showBrightnessHud) {
            delay(1500)
            showBrightnessHud = false
        }
    }

    // Load media details and queue
    LaunchedEffect(currentMediaType, currentMediaId) {
        coroutineScope.launch {
            try {
                if (currentMediaType == "movie") {
                    val m = MediaRepository.getMovieDetails(currentMediaId)
                    if (m != null) {
                        movieTitle = m.title
                    }
                    val allMovies = MediaRepository.getAllMovies()
                    moviesQueue = allMovies
                } else {
                    val (ep, s) = MediaRepository.getEpisodeAndSeries(currentMediaId)
                    if (s != null) {
                        movieTitle = s.title
                        val allEps = s.seasons.flatMap { it.episodes }
                        episodesQueue = allEps
                    }
                    if (ep != null) {
                        episodeSubtitle = "حلقة ${ep.episodeNumber}: ${ep.title}"
                    } else {
                        val foundEp = episodesQueue.find { it.id == currentMediaId }
                        if (foundEp != null) {
                            episodeSubtitle = "حلقة ${foundEp.episodeNumber}: ${foundEp.title}"
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    val exoPlayer = remember {
        val dataSourceFactory = androidx.media3.datasource.okhttp.OkHttpDataSource.Factory(ApiClient.okHttpClient)
        val mediaSourceFactory = androidx.media3.exoplayer.source.DefaultMediaSourceFactory(dataSourceFactory)
        ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .build()
    }

    // Prepare and play media whenever currentMediaType or currentMediaId changes
    LaunchedEffect(currentMediaType, currentMediaId) {
        val streamUrl = ApiClient.getFullMediaUrl("api/stream/$currentMediaType/$currentMediaId")
        val mediaItem = MediaItem.fromUri(streamUrl)
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.playbackParameters = PlaybackParameters(playbackSpeed)
        exoPlayer.prepare()
        exoPlayer.playWhenReady = true
    }

    // Auto update progress and report state
    LaunchedEffect(exoPlayer) {
        exoPlayer.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) {
                    totalDuration = exoPlayer.duration.coerceAtLeast(0L)
                }
            }
        })

        while (true) {
            currentPosition = exoPlayer.currentPosition.coerceAtLeast(0L)
            if (exoPlayer.duration > 0) {
                totalDuration = exoPlayer.duration
            }
            delay(500)
        }
    }

    // Periodic server playback progress sync
    LaunchedEffect(Unit) {
        while (true) {
            delay(10000)
            if (exoPlayer.isPlaying) {
                try {
                    ApiClient.apiService.savePlaybackProgress(
                        PlaybackProgress(
                            mediaType = currentMediaType,
                            mediaId = currentMediaId,
                            position = exoPlayer.currentPosition / 1000L,
                            duration = exoPlayer.duration / 1000L,
                            title = movieTitle
                        )
                    )
                } catch (_: Exception) {}
            }
        }
    }

    // Auto-hide overlay controls
    LaunchedEffect(areControlsVisible, isPlaying) {
        if (areControlsVisible && isPlaying && !isTouchLocked) {
            delay(4500)
            areControlsVisible = false
        }
    }

    // Navigation functions for Previous and Next
    val playPreviousMedia: () -> Unit = {
        if (currentPosition > 5000L) {
            // If already played more than 5s, seek back to beginning first
            exoPlayer.seekTo(0L)
        } else {
            if (currentMediaType == "series" || currentMediaType == "episode") {
                val idx = episodesQueue.indexOfFirst { it.id == currentMediaId }
                if (idx > 0) {
                    val prevEp = episodesQueue[idx - 1]
                    currentMediaId = prevEp.id
                    episodeSubtitle = "حلقة ${prevEp.episodeNumber}: ${prevEp.title}"
                } else {
                    exoPlayer.seekTo(0L)
                }
            } else {
                val idx = moviesQueue.indexOfFirst { it.id == currentMediaId }
                if (idx > 0) {
                    val prevMovie = moviesQueue[idx - 1]
                    currentMediaId = prevMovie.id
                    movieTitle = prevMovie.title
                } else {
                    exoPlayer.seekTo(0L)
                }
            }
        }
    }

    val playNextMedia: () -> Unit = {
        if (currentMediaType == "series" || currentMediaType == "episode") {
            val idx = episodesQueue.indexOfFirst { it.id == currentMediaId }
            if (idx != -1 && idx + 1 < episodesQueue.size) {
                val nextEp = episodesQueue[idx + 1]
                currentMediaId = nextEp.id
                episodeSubtitle = "حلقة ${nextEp.episodeNumber}: ${nextEp.title}"
            } else {
                // Seek to end or notify
                exoPlayer.seekTo(totalDuration)
            }
        } else {
            val idx = moviesQueue.indexOfFirst { it.id == currentMediaId }
            if (idx != -1 && idx + 1 < moviesQueue.size) {
                val nextMovie = moviesQueue[idx + 1]
                currentMediaId = nextMovie.id
                movieTitle = nextMovie.title
            } else {
                exoPlayer.seekTo(totalDuration)
            }
        }
    }

    BackHandler {
        exoPlayer.stop()
        exoPlayer.release()
        onBack()
    }

    DisposableEffect(Unit) {
        onDispose {
            exoPlayer.stop()
            exoPlayer.release()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        // ExoPlayer AndroidView
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = false
                    this.resizeMode = resizeMode
                    layoutParams = FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }
            },
            update = { playerView ->
                playerView.resizeMode = resizeMode
            },
            modifier = Modifier.fillMaxSize()
        )

        // Gesture Detection Overlay: Left half controls Brightness, Right half controls Volume
        if (!isTouchLocked) {
            Row(modifier = Modifier.fillMaxSize()) {
                // Left Half: Brightness drag & Double-tap rewind 10s
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .pointerInput(Unit) {
                            detectTapGestures(
                                onTap = { areControlsVisible = !areControlsVisible },
                                onDoubleTap = {
                                    val target = (exoPlayer.currentPosition - 10000L).coerceAtLeast(0L)
                                    exoPlayer.seekTo(target)
                                }
                            )
                        }
                        .pointerInput(Unit) {
                            detectVerticalDragGestures { _, dragAmount ->
                                // Swiping up decreases dragAmount (negative)
                                val delta = -dragAmount / 700f
                                val newBrightness = (currentBrightness + delta).coerceIn(0.05f, 1.0f)
                                currentBrightness = newBrightness
                                activity?.let { act ->
                                    val lp = act.window.attributes
                                    lp.screenBrightness = newBrightness
                                    act.window.attributes = lp
                                }
                                showBrightnessHud = true
                            }
                        }
                )

                // Right Half: Volume drag & Double-tap forward 10s
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .pointerInput(Unit) {
                            detectTapGestures(
                                onTap = { areControlsVisible = !areControlsVisible },
                                onDoubleTap = {
                                    val target = (exoPlayer.currentPosition + 10000L).coerceAtMost(exoPlayer.duration)
                                    exoPlayer.seekTo(target)
                                }
                            )
                        }
                        .pointerInput(Unit) {
                            detectVerticalDragGestures { _, dragAmount ->
                                val deltaSteps = (-dragAmount / 40f).toInt()
                                if (deltaSteps != 0) {
                                    val newVol = (currentVolume + deltaSteps).coerceIn(0, maxAudioVolume)
                                    if (newVol != currentVolume) {
                                        currentVolume = newVol
                                        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, newVol, 0)
                                        showVolumeHud = true
                                    }
                                }
                            }
                        }
                )
            }
        }

        // Floating Volume HUD
        AnimatedVisibility(
            visible = showVolumeHud,
            enter = fadeIn() + scaleIn(),
            exit = fadeOut() + scaleOut(),
            modifier = Modifier.align(Alignment.Center)
        ) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color(0xCC0F172A),
                border = androidx.compose.foundation.BorderStroke(1.dp, ArnEmeraldPrimary.copy(alpha = 0.6f)),
                modifier = Modifier.padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = if (currentVolume == 0) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                        contentDescription = null,
                        tint = ArnEmeraldPrimary,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "مستوى الصوت: ${((currentVolume.toFloat() / maxAudioVolume) * 100).toInt()}%",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        LinearProgressIndicator(
                            progress = { currentVolume.toFloat() / maxAudioVolume },
                            modifier = Modifier
                                .width(130.dp)
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp)),
                            color = ArnEmeraldPrimary,
                            trackColor = Color(0x4DFFFFFF)
                        )
                    }
                }
            }
        }

        // Floating Brightness HUD
        AnimatedVisibility(
            visible = showBrightnessHud,
            enter = fadeIn() + scaleIn(),
            exit = fadeOut() + scaleOut(),
            modifier = Modifier.align(Alignment.Center)
        ) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color(0xCC0F172A),
                border = androidx.compose.foundation.BorderStroke(1.dp, ArnGoldAccent.copy(alpha = 0.6f)),
                modifier = Modifier.padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.BrightnessMedium,
                        contentDescription = null,
                        tint = ArnGoldAccent,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "سطوع الشاشة: ${(currentBrightness * 100).toInt()}%",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        LinearProgressIndicator(
                            progress = { currentBrightness },
                            modifier = Modifier
                                .width(130.dp)
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp)),
                            color = ArnGoldAccent,
                            trackColor = Color(0x4DFFFFFF)
                        )
                    }
                }
            }
        }

        // On-screen Overlay Controls
        AnimatedVisibility(
            visible = areControlsVisible || isTouchLocked,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.fillMaxSize()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(if (isTouchLocked) Color.Transparent else Color(0x66000000))
            ) {
                if (isTouchLocked) {
                    // Touch Lock Unlock Button
                    IconButton(
                        onClick = { isTouchLocked = false },
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(24.dp)
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(ArnColorMovies)
                    ) {
                        Icon(Icons.Default.Lock, contentDescription = "فتح القفل", tint = Color.White)
                    }
                } else {
                    // TOP BAR
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.TopCenter)
                            .background(
                                Brush.verticalGradient(listOf(Color(0xCC000000), Color.Transparent))
                            )
                            .padding(top = 36.dp, start = 16.dp, end = 16.dp, bottom = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            IconButton(onClick = {
                                exoPlayer.stop()
                                exoPlayer.release()
                                onBack()
                            }) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع", tint = Color.White)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = movieTitle,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    maxLines = 1
                                )
                                if (!episodeSubtitle.isNullOrEmpty()) {
                                    Text(
                                        text = episodeSubtitle ?: "",
                                        color = ArnEmeraldPrimary,
                                        fontSize = 12.sp,
                                        maxLines = 1
                                    )
                                }
                            }
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            // Speed Toggle
                            TextButton(onClick = { showSpeedDialog = true }) {
                                Text(
                                    text = "${playbackSpeed}x",
                                    color = ArnGoldAccent,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }

                            // Aspect Ratio
                            IconButton(onClick = {
                                resizeMode = when (resizeMode) {
                                    AspectRatioFrameLayout.RESIZE_MODE_FIT -> AspectRatioFrameLayout.RESIZE_MODE_FILL
                                    AspectRatioFrameLayout.RESIZE_MODE_FILL -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                                    else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
                                }
                            }) {
                                Icon(Icons.Outlined.AspectRatio, contentDescription = "أبعاد الشاشة", tint = Color.White)
                            }

                            // Subtitles & Audio Tracks
                            IconButton(onClick = { showTrackSheet = true }) {
                                Icon(Icons.Outlined.Subtitles, contentDescription = "الترجمات والصوت", tint = Color.White)
                            }

                            // Smart Cast to TV
                            IconButton(onClick = {
                                exoPlayer.pause()
                                showCastDialog = true
                            }) {
                                Icon(Icons.Outlined.Cast, contentDescription = "بث للشاشة", tint = ArnGoldAccent)
                            }

                            // Lock Touches
                            IconButton(onClick = { isTouchLocked = true }) {
                                Icon(Icons.Outlined.LockOpen, contentDescription = "قفل اللمس", tint = Color.White)
                            }
                        }
                    }

                    // CENTER PLAYBACK CONTROLS (Previous, Replay10, Play/Pause, Forward10, Next)
                    Row(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalArrangement = Arrangement.spacedBy(22.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // PREVIOUS BUTTON (السابق)
                        IconButton(
                            onClick = { playPreviousMedia() },
                            modifier = Modifier
                                .size(50.dp)
                                .clip(CircleShape)
                                .background(Color(0x33FFFFFF))
                        ) {
                            Icon(
                                imageVector = Icons.Default.SkipPrevious,
                                contentDescription = "السابق",
                                tint = Color.White,
                                modifier = Modifier.size(32.dp)
                            )
                        }

                        // REPLAY 10s (رجوع 10 ثوان)
                        IconButton(
                            onClick = { exoPlayer.seekTo((exoPlayer.currentPosition - 10000L).coerceAtLeast(0L)) },
                            modifier = Modifier.size(52.dp)
                        ) {
                            Icon(Icons.Default.Replay10, contentDescription = "رجوع 10 ثوان", tint = Color.White, modifier = Modifier.size(40.dp))
                        }

                        // PLAY / PAUSE (تشغيل / إيقاف)
                        IconButton(
                            onClick = {
                                if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
                            },
                            modifier = Modifier
                                .size(74.dp)
                                .clip(CircleShape)
                                .background(ArnColorMovies)
                        ) {
                            Icon(
                                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = if (isPlaying) "إيقاف مؤقت" else "تشغيل",
                                tint = Color.White,
                                modifier = Modifier.size(44.dp)
                            )
                        }

                        // FORWARD 10s (تقديم 10 ثوان)
                        IconButton(
                            onClick = { exoPlayer.seekTo((exoPlayer.currentPosition + 10000L).coerceAtMost(exoPlayer.duration)) },
                            modifier = Modifier.size(52.dp)
                        ) {
                            Icon(Icons.Default.Forward10, contentDescription = "تقديم 10 ثوان", tint = Color.White, modifier = Modifier.size(40.dp))
                        }

                        // NEXT BUTTON (القادم / التالي)
                        IconButton(
                            onClick = { playNextMedia() },
                            modifier = Modifier
                                .size(50.dp)
                                .clip(CircleShape)
                                .background(Color(0x33FFFFFF))
                        ) {
                            Icon(
                                imageVector = Icons.Default.SkipNext,
                                contentDescription = "القادم / التالي",
                                tint = Color.White,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }

                    // BOTTOM CONTROLS (Timeline, Time labels, & Volume Bar)
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.BottomCenter)
                            .background(
                                Brush.verticalGradient(listOf(Color.Transparent, Color(0xCC000000)))
                            )
                            .padding(bottom = 20.dp, start = 20.dp, end = 20.dp, top = 16.dp)
                    ) {
                        // Time labels & Next/Prev indicator
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = formatTime(currentPosition),
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )

                            // Quick Volume Control Bar right in the player!
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 8.dp)
                            ) {
                                IconButton(
                                    onClick = {
                                        if (currentVolume > 0) {
                                            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, 0, 0)
                                            currentVolume = 0
                                        } else {
                                            val half = (maxAudioVolume / 2).coerceAtLeast(1)
                                            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, half, 0)
                                            currentVolume = half
                                        }
                                    },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(
                                        imageVector = if (currentVolume == 0) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                                        contentDescription = "الصوت",
                                        tint = ArnEmeraldPrimary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }

                                Slider(
                                    value = currentVolume.toFloat() / maxAudioVolume,
                                    onValueChange = { frac ->
                                        val newVol = (frac * maxAudioVolume).toInt()
                                        currentVolume = newVol
                                        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, newVol, 0)
                                    },
                                    modifier = Modifier.width(90.dp),
                                    colors = SliderDefaults.colors(
                                        thumbColor = ArnEmeraldPrimary,
                                        activeTrackColor = ArnEmeraldPrimary,
                                        inactiveTrackColor = Color(0x33FFFFFF)
                                    )
                                )
                            }

                            Text(
                                text = formatTime(totalDuration),
                                color = ArnTextSecondary,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }

                        // Progress Seekbar
                        Slider(
                            value = if (totalDuration > 0) currentPosition.toFloat() / totalDuration.toFloat() else 0f,
                            onValueChange = { frac ->
                                val target = (frac * totalDuration).toLong()
                                exoPlayer.seekTo(target)
                            },
                            colors = SliderDefaults.colors(
                                thumbColor = ArnColorMovies,
                                activeTrackColor = ArnColorMovies,
                                inactiveTrackColor = Color(0x4DFFFFFF)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }

        // Speed Selection Dialog
        if (showSpeedDialog) {
            AlertDialog(
                onDismissRequest = { showSpeedDialog = false },
                containerColor = Color(0xFF0F172A),
                title = { Text("سرعة التشغيل", color = Color.White, fontWeight = FontWeight.Bold) },
                text = {
                    Column {
                        val speeds = listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
                        speeds.forEach { sp ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        playbackSpeed = sp
                                        exoPlayer.playbackParameters = PlaybackParameters(sp)
                                        showSpeedDialog = false
                                    }
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = playbackSpeed == sp,
                                    onClick = {
                                        playbackSpeed = sp
                                        exoPlayer.playbackParameters = PlaybackParameters(sp)
                                        showSpeedDialog = false
                                    }
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = if (sp == 1.0f) "عادية (1.0x)" else "${sp}x",
                                    color = if (playbackSpeed == sp) ArnGoldAccent else Color.White,
                                    fontWeight = if (playbackSpeed == sp) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { showSpeedDialog = false }) {
                        Text("إلغاء", color = ArnTextSecondary)
                    }
                }
            )
        }

        // Subtitles Sheet
        if (showTrackSheet) {
            AlertDialog(
                onDismissRequest = { showTrackSheet = false },
                containerColor = Color(0xFF0F172A),
                title = { Text("الترجمة والصوتيات", color = Color.White, fontWeight = FontWeight.Bold) },
                text = {
                    Column {
                        Text("الترجمات المتاحة:", color = ArnEmeraldPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = true, onClick = {})
                            Text("العربية (الأصلية المدمجة)", color = Color.White)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = false, onClick = {})
                            Text("English Subtitles", color = Color.White)
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("المسارات الصوتية والدبلجة:", color = ArnGoldAccent, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = true, onClick = {})
                            Text("صوت عربي (Dolby 5.1)", color = Color.White)
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = { showTrackSheet = false },
                        colors = ButtonDefaults.buttonColors(containerColor = ArnColorMovies)
                    ) {
                        Text("تم")
                    }
                }
            )
        }

        // Smart Cast Dialog
        if (showCastDialog) {
            CastSelectionDialog(
                mediaTitle = movieTitle,
                mediaType = currentMediaType,
                mediaId = currentMediaId,
                currentPositionSec = exoPlayer.currentPosition / 1000L,
                onDismiss = { showCastDialog = false },
                onOpenRemote = {
                    showCastDialog = false
                    onCastToTv()
                }
            )
        }
    }
}

private fun formatTime(ms: Long): String {
    val totalSeconds = (ms / 1000).coerceAtLeast(0)
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) {
        String.format("%02d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format("%02d:%02d", minutes, seconds)
    }
}
