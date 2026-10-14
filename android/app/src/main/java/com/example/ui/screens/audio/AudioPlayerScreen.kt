package com.example.ui.screens.audio

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.data.api.ApiClient
import com.example.playback.AudioPlayerController
import com.example.ui.components.GlassCard
import com.example.ui.theme.*

@Composable
fun AudioPlayerScreen(
    onBack: () -> Unit
) {
    val currentTrack by AudioPlayerController.currentTrack.collectAsState()
    val isPlaying by AudioPlayerController.isPlaying.collectAsState()
    val position by AudioPlayerController.currentPosition.collectAsState()
    val duration by AudioPlayerController.duration.collectAsState()
    val playlist by AudioPlayerController.playlist.collectAsState()

    var isShuffle by remember { mutableStateOf(false) }
    var isRepeat by remember { mutableStateOf(false) }
    var showQueue by remember { mutableStateOf(false) }

    val infiniteTransition = rememberInfiniteTransition(label = "rotation")
    val rotationAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(20000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "angle"
    )

    val track = currentTrack
    val progress = if (duration > 0) position.toFloat() / duration.toFloat() else 0f

    val isQuranTrack = track?.libraryType == "quran" ||
        track?.title?.contains("سورة") == true ||
        track?.title?.contains("تلاوة") == true ||
        track?.title?.contains("مصحف") == true ||
        track?.artistName?.contains("الشيخ") == true ||
        track?.artistName?.contains("قارئ") == true

    val headerSubtitle = when {
        isQuranTrack -> "القرآن الكريم"
        !track?.albumTitle.isNullOrBlank() -> track!!.albumTitle!!
        !track?.artistName.isNullOrBlank() -> track!!.artistName!!
        else -> "مكتبة الموسيقى والصوتيات"
    }

    val dynamicPrimaryColor = if (isQuranTrack) ArnEmeraldPrimary else Color(0xFF8B5CF6)
    val dynamicGradientBg = if (isQuranTrack) {
        listOf(Color(0xFF064E3B), Color(0xFF0F172A), ArnObsidian)
    } else {
        listOf(Color(0xFF3B0764), Color(0xFF0F172A), ArnObsidian)
    }

    val breathingTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by breathingTransition.animateFloat(
        initialValue = 0.985f,
        targetValue = 1.015f,
        animationSpec = infiniteRepeatable(
            animation = tween(2800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

    val playPauseScale by animateFloatAsState(
        targetValue = if (isPlaying) 1.0f else 0.93f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
        label = "playPauseScale"
    )

    val vinylSlideOffset by animateDpAsState(
        targetValue = if (isPlaying) 28.dp else 0.dp,
        animationSpec = spring(dampingRatio = Spring.DampingRatioLowBouncy, stiffness = Spring.StiffnessLow),
        label = "vinylOffset"
    )

    val coverUrl = ApiClient.getFullMediaUrl(track?.displayCover ?: track?.cover)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = dynamicGradientBg
                )
            )
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 20.dp, vertical = 8.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header Top Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "رجوع",
                        tint = Color.White
                    )
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "يتم التشغيل الآن",
                        color = dynamicPrimaryColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = headerSubtitle,
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                IconButton(onClick = { showQueue = !showQueue }) {
                    Icon(
                        imageVector = Icons.Default.QueueMusic,
                        contentDescription = "قائمة التشغيل",
                        tint = if (showQueue) dynamicPrimaryColor else Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            if (!showQueue) {
                // Large Prominent Album Art with Vinyl Peek and Breathing Animation
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.85f)
                        .aspectRatio(1f)
                        .scale(playPauseScale * (if (isPlaying) pulseScale else 1f)),
                    contentAlignment = Alignment.Center
                ) {
                    // 1. Vinyl Record sliding out subtly from the right when playing
                    Box(
                        modifier = Modifier
                            .fillMaxSize(0.92f)
                            .offset(x = vinylSlideOffset)
                            .clip(CircleShape)
                            .background(Color(0xFF111827))
                            .border(2.dp, Color(0x33FFFFFF), CircleShape)
                            .rotate(if (isPlaying) rotationAngle else 0f),
                        contentAlignment = Alignment.Center
                    ) {
                        // Vinyl grooves
                        Box(
                            modifier = Modifier
                                .fillMaxSize(0.7f)
                                .clip(CircleShape)
                                .border(1.dp, Color(0x1AFFFFFF), CircleShape)
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxSize(0.45f)
                                .clip(CircleShape)
                                .border(1.dp, Color(0x26FFFFFF), CircleShape)
                        )
                        // Center label
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(dynamicPrimaryColor)
                                .border(2.dp, Color.Black, CircleShape)
                        )
                    }

                    // 2. Main Album Cover (Large Square with rounded corners and glowing border)
                    Surface(
                        modifier = Modifier
                            .fillMaxSize()
                            .shadow(
                                elevation = if (isPlaying) 18.dp else 8.dp,
                                shape = RoundedCornerShape(26.dp),
                                ambientColor = dynamicPrimaryColor,
                                spotColor = dynamicPrimaryColor
                            ),
                        shape = RoundedCornerShape(26.dp),
                        color = Color(0xFF1E293B),
                        border = androidx.compose.foundation.BorderStroke(
                            width = 2.dp,
                            color = if (isPlaying) dynamicPrimaryColor.copy(alpha = 0.8f) else Color(0x26FFFFFF)
                        )
                    ) {
                        if (coverUrl.isNotEmpty()) {
                            AsyncImage(
                                model = coverUrl,
                                contentDescription = track?.title,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            // High-End Stylized Album Artwork Sleeve
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(
                                        Brush.linearGradient(
                                            colors = listOf(
                                                dynamicPrimaryColor.copy(alpha = 0.45f),
                                                Color(0xFF0F172A),
                                                Color(0xFF090D16)
                                            )
                                        )
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center,
                                    modifier = Modifier.padding(20.dp)
                                ) {
                                    Surface(
                                        shape = CircleShape,
                                        color = dynamicPrimaryColor.copy(alpha = 0.2f),
                                        modifier = Modifier.size(68.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = if (isQuranTrack) Icons.Default.MenuBook else Icons.Default.Album,
                                                contentDescription = null,
                                                tint = dynamicPrimaryColor,
                                                modifier = Modifier.size(36.dp)
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(14.dp))
                                    Text(
                                        text = track?.albumTitle ?: track?.title ?: "ألبوم صوتي",
                                        color = Color.White,
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.Bold,
                                        textAlign = TextAlign.Center,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    if (!track?.artistName.isNullOrBlank()) {
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = track?.artistName ?: "",
                                            color = ArnTextSecondary,
                                            fontSize = 13.sp,
                                            textAlign = TextAlign.Center,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(28.dp))

                // Track Title & Reciter
                Text(
                    text = track?.title ?: "لم يتم اختيار مقطع",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(8.dp))

                if (!track?.artistName.isNullOrEmpty()) {
                    Text(
                        text = track?.artistName ?: "",
                        fontSize = 15.sp,
                        color = ArnEmeraldPrimary,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(28.dp))

                // Seekbar & Time labels
                Column(modifier = Modifier.fillMaxWidth()) {
                    Slider(
                        value = progress.coerceIn(0f, 1f),
                        onValueChange = { frac ->
                            AudioPlayerController.seekTo((frac * duration).toLong())
                        },
                        colors = SliderDefaults.colors(
                            thumbColor = ArnEmeraldPrimary,
                            activeTrackColor = ArnEmeraldPrimary,
                            inactiveTrackColor = Color(0x33FFFFFF)
                        )
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = formatAudioTime(position),
                            color = ArnTextSecondary,
                            fontSize = 12.sp
                        )
                        Text(
                            text = formatAudioTime(duration),
                            color = ArnTextSecondary,
                            fontSize = 12.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Playback Controls Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { isShuffle = !isShuffle }) {
                        Icon(
                            imageVector = Icons.Default.Shuffle,
                            contentDescription = "عشوائي",
                            tint = if (isShuffle) ArnEmeraldPrimary else ArnTextSecondary
                        )
                    }

                    IconButton(onClick = { AudioPlayerController.playPrevious() }) {
                        Icon(
                            imageVector = Icons.Default.SkipPrevious,
                            contentDescription = "السابق",
                            tint = Color.White,
                            modifier = Modifier.size(36.dp)
                        )
                    }

                    // Main Play/Pause Button
                    IconButton(
                        onClick = { AudioPlayerController.togglePlayPause() },
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(ArnEmeraldPrimary)
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = if (isPlaying) "إيقاف مؤقت" else "تشغيل",
                            tint = Color.White,
                            modifier = Modifier.size(42.dp)
                        )
                    }

                    IconButton(onClick = { AudioPlayerController.playNext() }) {
                        Icon(
                            imageVector = Icons.Default.SkipNext,
                            contentDescription = "التالي",
                            tint = Color.White,
                            modifier = Modifier.size(36.dp)
                        )
                    }

                    IconButton(onClick = { isRepeat = !isRepeat }) {
                        Icon(
                            imageVector = Icons.Default.Repeat,
                            contentDescription = "تكرار",
                            tint = if (isRepeat) ArnEmeraldPrimary else ArnTextSecondary
                        )
                    }
                }
            } else {
                // Queue List
                Text(
                    text = "قائمة المقاطع والتلاوات",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    modifier = Modifier.align(Alignment.Start)
                )
                Spacer(modifier = Modifier.height(10.dp))

                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(playlist) { item ->
                        val isCurr = item.id == currentTrack?.id
                        GlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            backgroundColor = if (isCurr) Color(0x3310B981) else Color(0x14FFFFFF),
                            borderColor = if (isCurr) ArnEmeraldPrimary else Color(0x26FFFFFF),
                            onClick = { AudioPlayerController.playTrack(item) }
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "${item.trackNumber}",
                                    color = if (isCurr) ArnEmeraldPrimary else ArnTextSecondary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                                Spacer(modifier = Modifier.width(14.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = item.title,
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp
                                    )
                                    Text(
                                        text = item.artistName ?: "",
                                        color = ArnTextSecondary,
                                        fontSize = 11.sp
                                    )
                                }
                                if (isCurr && isPlaying) {
                                    Icon(
                                        imageVector = Icons.Default.GraphicEq,
                                        contentDescription = null,
                                        tint = ArnEmeraldPrimary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun formatAudioTime(ms: Long): String {
    val totalSeconds = (ms / 1000).coerceAtLeast(0)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return String.format("%02d:%02d", minutes, seconds)
}
