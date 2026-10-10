package com.example.ui.screens.artist

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.LibraryMusic
import androidx.compose.material.icons.outlined.PlayCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.data.api.ApiClient
import com.example.data.model.Album
import com.example.data.model.Artist
import com.example.data.model.Track
import com.example.data.repository.MediaRepository
import com.example.playback.AudioPlayerController
import com.example.ui.components.GlassCard
import com.example.ui.components.MiniPlayerCapsule
import com.example.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArtistDetailsScreen(
    artistId: Int,
    onBack: () -> Unit,
    onNavigateToAudioPlayer: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var artist by remember { mutableStateOf<Artist?>(MediaRepository.getArtistFromCache(artistId)) }
    var albums by remember { mutableStateOf<List<Album>>(emptyList()) }
    var selectedAlbumIndex by remember { mutableStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }

    val currentPlayingTrack by AudioPlayerController.currentTrack.collectAsState()
    val isAudioPlaying by AudioPlayerController.isPlaying.collectAsState()

    LaunchedEffect(artistId) {
        isLoading = true
        coroutineScope.launch {
            val (loadedArtist, loadedAlbums) = MediaRepository.getArtistWithAlbums(artistId)
            if (loadedArtist != null) artist = loadedArtist
            albums = loadedAlbums
            isLoading = false
        }
    }

    // Dynamic track loader when selecting an album
    LaunchedEffect(selectedAlbumIndex, albums) {
        val curr = albums.getOrNull(selectedAlbumIndex)
        if (curr != null && curr.trackList.isEmpty()) {
            coroutineScope.launch {
                try {
                    val detail = ApiClient.apiService.getAlbumDetails(curr.id)
                    if (detail.data != null && detail.data.trackList.isNotEmpty()) {
                        albums = albums.toMutableList().also { list ->
                            list[selectedAlbumIndex] = detail.data
                        }
                    }
                } catch (_: Exception) {}
            }
        }
    }

    val selectedAlbum = albums.getOrNull(selectedAlbumIndex)
    val isQuran = artist?.name?.contains("الشيخ") == true ||
            artist?.name?.contains("قارئ") == true ||
            artist?.category?.contains("quran", ignoreCase = true) == true ||
            albums.any { it.displayTitle.contains("المصحف") || it.displayTitle.contains("سورة") }

    fun enrichTrack(t: Track, album: Album?): Track {
        val hasSingleAlbum = albums.size == 1
        val coverToUse = t.displayCover
            ?: album?.displayCover
            ?: (if (hasSingleAlbum) artist?.displayImage else null)
        val albumTitleToUse = t.albumTitle ?: album?.displayTitle
        val artistNameToUse = t.artistName ?: artist?.name
        val libTypeToUse = t.libraryType ?: (if (isQuran) "quran" else "music")
        return t.copy(
            cover = coverToUse,
            albumTitle = albumTitleToUse,
            artistName = artistNameToUse,
            libraryType = libTypeToUse
        )
    }

    val rawDisplayedTracks = selectedAlbum?.trackList?.ifEmpty { null } ?: albums.flatMap { it.trackList }
    val displayedTracks = rawDisplayedTracks.map { enrichTrack(it, selectedAlbum) }

    val accentColor = if (isQuran) ArnEmeraldPrimary else Color(0xFF8B5CF6)
    val artistName = artist?.name ?: "تلاوات وأعمال صوتية"
    val avatarUrl = ApiClient.getFullMediaUrl(artist?.displayImage ?: selectedAlbum?.displayCover)

    Scaffold(
        containerColor = ArnObsidian,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            MiniPlayerCapsule(
                onExpandPlayer = onNavigateToAudioPlayer
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .navigationBarsPadding()
        ) {
            // Hero Header
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(300.dp)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    accentColor.copy(alpha = 0.35f),
                                    Color(0xFF0F172A),
                                    ArnObsidian
                                )
                            )
                        )
                ) {
                    // Top App Bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .statusBarsPadding()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = onBack,
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Color(0x660F172A))
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "رجوع",
                                tint = Color.White
                            )
                        }

                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = accentColor.copy(alpha = 0.25f)
                        ) {
                            Text(
                                text = if (isQuran) "📖 تسجيلات وقراءات قرآنية" else "🎵 مكتبة الصوتيات والموسيقى",
                                color = accentColor,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                            )
                        }
                    }

                    // Artist Avatar & Info
                    Column(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(110.dp)
                                .clip(CircleShape)
                                .border(3.dp, accentColor, CircleShape)
                                .background(Color(0xFF1E293B)),
                            contentAlignment = Alignment.Center
                        ) {
                            if (avatarUrl.isNotEmpty()) {
                                AsyncImage(
                                    model = avatarUrl,
                                    contentDescription = artistName,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                Icon(
                                    imageVector = if (isQuran) Icons.Default.MenuBook else Icons.Outlined.LibraryMusic,
                                    contentDescription = null,
                                    tint = accentColor,
                                    modifier = Modifier.size(48.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = artistName,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "${artist?.totalAlbums ?: albums.size} ألبومات / مصاحف",
                                color = ArnTextSecondary,
                                fontSize = 12.sp
                            )
                            Text(text = "•", color = Color(0x66FFFFFF))
                            Text(
                                text = "${artist?.totalTracks ?: displayedTracks.size} تراك وتلاوة",
                                color = ArnTextSecondary,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }

            // Play All Action Button
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    val allAvailableTracks = remember(displayedTracks, albums) {
                        if (displayedTracks.isNotEmpty()) displayedTracks else albums.flatMap { it.trackList }
                    }
                    Button(
                        onClick = {
                            val first = allAvailableTracks.firstOrNull()
                            if (first != null) {
                                AudioPlayerController.playTrack(first, allAvailableTracks)
                            }
                        },
                        enabled = allAvailableTracks.isNotEmpty(),
                        colors = ButtonDefaults.buttonColors(containerColor = accentColor),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = Color.White
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isQuran) "تشغيل التلاوات بالكامل" else "تشغيل الكل بالترتيب",
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }

                    if (artist?.year != null) {
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = Color(0x1AFFFFFF),
                            modifier = Modifier.height(48.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .padding(horizontal = 14.dp)
                                    .fillMaxHeight(),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "إصدار: ${artist?.year}",
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }

            // Albums Section with 1:1 Square Posters
            if (albums.isNotEmpty()) {
                item {
                    Column(modifier = Modifier.padding(top = 12.dp)) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isQuran) "المصاحف والتسجيلات (${albums.size}):" else "الألبومات والإصدارات (${albums.size}):",
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                fontSize = 16.sp
                            )
                            if (selectedAlbum != null) {
                                Text(
                                    text = selectedAlbum.displayTitle,
                                    color = accentColor,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                )
                            }
                        }

                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            itemsIndexed(albums) { index, album ->
                                val isSelected = index == selectedAlbumIndex
                                val hasSingleAlbum = albums.size == 1
                                val candidateCover = album.displayCover
                                    ?: (if (album.id > 0) "api/albums/${album.id}/cover" else null)
                                    ?: artist?.displayImage
                                val albumCover = ApiClient.getFullMediaUrl(candidateCover)

                                Column(
                                    modifier = Modifier
                                        .width(135.dp)
                                        .clickable { selectedAlbumIndex = index }
                                ) {
                                    // 1:1 Square Album Poster Box
                                    Box(
                                        modifier = Modifier
                                            .size(135.dp)
                                            .clip(RoundedCornerShape(16.dp))
                                            .background(Color(0xFF1E293B))
                                            .border(
                                                width = if (isSelected) 2.5.dp else 1.dp,
                                                color = if (isSelected) accentColor else Color(0x26FFFFFF),
                                                shape = RoundedCornerShape(16.dp)
                                            )
                                    ) {
                                        val albumGradient = remember(album.id) {
                                            val palettes = listOf(
                                                listOf(Color(0xFF6366F1), Color(0xFF1E1B4B)),
                                                listOf(Color(0xFFEC4899), Color(0xFF4C0519)),
                                                listOf(Color(0xFF10B981), Color(0xFF064E3B)),
                                                listOf(Color(0xFFF59E0B), Color(0xFF451A03)),
                                                listOf(Color(0xFF8B5CF6), Color(0xFF2E1065)),
                                                listOf(Color(0xFF0EA5E9), Color(0xFF082F49)),
                                                listOf(Color(0xFF14B8A6), Color(0xFF042F2E)),
                                                listOf(Color(0xFFF43F5E), Color(0xFF4C0519))
                                            )
                                            palettes[kotlin.math.abs(album.id) % palettes.size]
                                        }

                                        // Distinctive artistic placeholder underneath
                                        Box(
                                            modifier = Modifier
                                                .fillMaxSize()
                                                .background(Brush.linearGradient(albumGradient)),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Column(
                                                horizontalAlignment = Alignment.CenterHorizontally,
                                                verticalArrangement = Arrangement.Center,
                                                modifier = Modifier.padding(8.dp)
                                            ) {
                                                Icon(
                                                    imageVector = if (isQuran) Icons.Default.MenuBook else Icons.Default.Album,
                                                    contentDescription = null,
                                                    tint = Color.White.copy(alpha = 0.9f),
                                                    modifier = Modifier.size(36.dp)
                                                )
                                                Spacer(modifier = Modifier.height(6.dp))
                                                Text(
                                                    text = album.displayTitle,
                                                    color = Color.White,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    maxLines = 2,
                                                    textAlign = TextAlign.Center,
                                                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                                )
                                            }
                                        }

                                        if (albumCover.isNotEmpty()) {
                                            AsyncImage(
                                                model = albumCover,
                                                contentDescription = album.displayTitle,
                                                contentScale = ContentScale.Crop,
                                                modifier = Modifier.fillMaxSize()
                                            )
                                        }

                                        // Overlay gradient at bottom
                                        Box(
                                            modifier = Modifier
                                                .fillMaxSize()
                                                .background(
                                                    Brush.verticalGradient(
                                                        listOf(Color.Transparent, Color(0xCC090D16)),
                                                        startY = 80f
                                                    )
                                                )
                                        )

                                        // Top Badges (Tracks count & isSelected badge)
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(6.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            if (isSelected) {
                                                Surface(
                                                    shape = RoundedCornerShape(6.dp),
                                                    color = accentColor
                                                ) {
                                                    Text(
                                                        text = "محدد",
                                                        color = Color.White,
                                                        fontSize = 9.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                    )
                                                }
                                            } else {
                                                Spacer(modifier = Modifier.width(1.dp))
                                            }

                                            if (album.totalTracks > 0) {
                                                Surface(
                                                    shape = RoundedCornerShape(6.dp),
                                                    color = Color(0xD90F172A)
                                                ) {
                                                    Text(
                                                        text = "${album.totalTracks} تراك",
                                                        color = Color.White,
                                                        fontSize = 9.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                                                    )
                                                }
                                            }
                                        }

                                        // Quick Play Button on bottom right of album card
                                        IconButton(
                                            onClick = {
                                                selectedAlbumIndex = index
                                                val tList = album.trackList.map { enrichTrack(it, album) }
                                                if (tList.isNotEmpty()) {
                                                    AudioPlayerController.playTrack(tList.first(), tList)
                                                } else if (displayedTracks.isNotEmpty()) {
                                                    AudioPlayerController.playTrack(displayedTracks.first(), displayedTracks)
                                                }
                                            },
                                            modifier = Modifier
                                                .align(Alignment.BottomEnd)
                                                .padding(6.dp)
                                                .size(34.dp)
                                                .clip(CircleShape)
                                                .background(if (isSelected) accentColor else Color(0xCC0F172A))
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.PlayArrow,
                                                contentDescription = "تشغيل الألبوم",
                                                tint = Color.White,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(6.dp))

                                    // Album Title
                                    Text(
                                        text = album.displayTitle,
                                        color = if (isSelected) accentColor else Color.White,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                                        fontSize = 13.sp,
                                        maxLines = 1,
                                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                    )

                                    // Subtitle
                                    Text(
                                        text = if (album.year != null) "${album.year} • ${album.totalTracks} تراك" else "${album.totalTracks} تراك صوتي",
                                        color = ArnTextSecondary,
                                        fontSize = 11.sp,
                                        maxLines = 1,
                                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Tracks Header
            item {
                Spacer(modifier = Modifier.height(14.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isQuran) "قائمة السور والتلاوات:" else "قائمة المقاطع الصوتية:",
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 15.sp
                    )
                    Text(
                        text = "${displayedTracks.size} مقطع",
                        color = ArnTextSecondary,
                        fontSize = 12.sp
                    )
                }
            }

            // Tracks List
            if (isLoading) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = accentColor)
                    }
                }
            } else if (displayedTracks.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Outlined.LibraryMusic,
                                contentDescription = null,
                                tint = ArnTextSecondary,
                                modifier = Modifier.size(40.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "لا توجد ملفات صوتية مسجلة لهذا الألبوم على الخادم حالياً.",
                                color = ArnTextSecondary,
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            } else {
                itemsIndexed(displayedTracks) { index, track ->
                    val isCurrent = currentPlayingTrack?.id == track.id
                    val isPlayingNow = isCurrent && isAudioPlaying

                    GlassCard(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        onClick = {
                            AudioPlayerController.playTrack(track, displayedTracks)
                        },
                        backgroundColor = if (isCurrent) accentColor.copy(alpha = 0.2f) else Color(0x14FFFFFF),
                        borderColor = if (isCurrent) accentColor else Color(0x1AFFFFFF)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                // Track number or play indicator
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(if (isCurrent) accentColor else Color(0x26FFFFFF)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (isPlayingNow) {
                                        Icon(
                                            imageVector = Icons.Default.GraphicEq,
                                            contentDescription = null,
                                            tint = Color.White,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    } else {
                                        Text(
                                            text = "${track.trackNumber?.takeIf { it > 0 } ?: (index + 1)}",
                                            color = Color.White,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                Column {
                                    Text(
                                        text = track.displayTitle,
                                        color = if (isCurrent) accentColor else Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp
                                    )
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        if (track.duration != null && track.duration > 0) {
                                            val minutes = track.duration / 60
                                            val seconds = track.duration % 60
                                            Text(
                                                text = String.format("%02d:%02d", minutes, seconds),
                                                color = ArnTextSecondary,
                                                fontSize = 11.sp
                                            )
                                        }
                                        if (track.bitRate != null) {
                                            Text(
                                                text = "${track.bitRate} kbps",
                                                color = ArnTextSecondary,
                                                fontSize = 10.sp
                                            )
                                        }
                                        Text(
                                            text = track.format?.uppercase() ?: "MP3",
                                            color = accentColor.copy(alpha = 0.8f),
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }

                            IconButton(
                                onClick = {
                                    if (isCurrent) {
                                        AudioPlayerController.togglePlayPause()
                                    } else {
                                        AudioPlayerController.playTrack(track, displayedTracks)
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = if (isPlayingNow) Icons.Default.PauseCircle else Icons.Outlined.PlayCircle,
                                    contentDescription = "تشغيل",
                                    tint = if (isCurrent) accentColor else Color.White,
                                    modifier = Modifier.size(28.dp)
                                )
                            }
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(30.dp))
            }
        }
    }
}
