package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.data.api.ApiClient
import com.example.playback.AudioPlayerController
import com.example.ui.theme.ArnColorQuran
import com.example.ui.theme.ArnEmeraldPrimary
import com.example.ui.theme.ArnTextSecondary

import androidx.compose.material.icons.filled.Close

@Composable
fun MiniPlayerCapsule(
    onExpandPlayer: () -> Unit,
    applyNavigationBarsPadding: Boolean = true,
    modifier: Modifier = Modifier
) {
    val currentTrack by AudioPlayerController.currentTrack.collectAsState()
    val isPlaying by AudioPlayerController.isPlaying.collectAsState()
    val isStopped by AudioPlayerController.isStopped.collectAsState()
    val isDismissed by AudioPlayerController.isDismissed.collectAsState()
    val position by AudioPlayerController.currentPosition.collectAsState()
    val duration by AudioPlayerController.duration.collectAsState()

    AnimatedVisibility(
        visible = currentTrack != null && !isDismissed && !isStopped,
        enter = slideInVertically { it },
        exit = slideOutVertically { it },
        modifier = modifier
    ) {
        val track = currentTrack ?: return@AnimatedVisibility
        val progress = if (duration > 0) (position.toFloat() / duration.toFloat()) else 0f

        val surfaceModifier = Modifier
            .fillMaxWidth()
            .then(if (applyNavigationBarsPadding) Modifier.navigationBarsPadding() else Modifier)
            .padding(horizontal = 14.dp, vertical = 6.dp)
            .clickable { onExpandPlayer() }

        Surface(
            modifier = surfaceModifier,
            shape = RoundedCornerShape(22.dp),
            color = Color(0xF00F172A),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x3310B981))
        ) {
            Column {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Cover & Track Info
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        AsyncImage(
                            model = ApiClient.getFullMediaUrl(track.displayCover ?: track.cover),
                            contentDescription = track.title,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(12.dp))
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = track.title,
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            if (!track.artistName.isNullOrEmpty()) {
                                Text(
                                    text = track.artistName ?: "",
                                    color = ArnEmeraldPrimary,
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }

                    // Play/Pause, Next & Close Button
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        IconButton(
                            onClick = { AudioPlayerController.togglePlayPause() },
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(ArnColorQuran)
                        ) {
                            Icon(
                                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = if (isPlaying) "إيقاف مؤقت" else "تشغيل",
                                tint = Color.White,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        IconButton(
                            onClick = { AudioPlayerController.playNext() },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.SkipNext,
                                contentDescription = "التالي",
                                tint = Color.White,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        IconButton(
                            onClick = { AudioPlayerController.closePlayer() },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "إغلاق المشغل",
                                tint = Color(0x99FFFFFF),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                // Bottom Progress Bar
                LinearProgressIndicator(
                    progress = { progress.coerceIn(0f, 1f) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(2.5.dp),
                    color = ArnEmeraldPrimary,
                    trackColor = Color(0x26FFFFFF)
                )
            }
        }
    }
}
