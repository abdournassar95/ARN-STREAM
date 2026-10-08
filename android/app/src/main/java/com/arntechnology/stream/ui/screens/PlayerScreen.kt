package com.arntechnology.stream.ui.screens

import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.ui.PlayerView
import com.arntechnology.stream.playback.player.ExoPlayerManager

@Composable
fun PlayerScreen(
    videoUrl: String,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    
    // Initialize ExoPlayerManager
    val exoPlayerManager = remember {
        ExoPlayerManager(context).apply {
            // Usually, this should be a real URL. We're using a dummy one for now if videoUrl is empty.
            val urlToPlay = if (videoUrl.isNotBlank()) videoUrl else "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            prepareAndPlay(streamUrl = urlToPlay)
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            exoPlayerManager.release()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayerManager.player
                    layoutParams = FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    useController = true
                }
            },
            modifier = Modifier.fillMaxSize()
        )
    }
}
