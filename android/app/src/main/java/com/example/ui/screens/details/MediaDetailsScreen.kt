package com.example.ui.screens.details

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.Cast
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.data.api.ApiClient
import com.example.data.model.Episode
import com.example.data.model.Movie
import com.example.data.model.Series
import com.example.data.repository.MediaRepository
import com.example.ui.components.CastSelectionDialog
import com.example.ui.components.GlassCard
import com.example.ui.theme.*
import kotlinx.coroutines.launch

import androidx.compose.animation.core.*
import androidx.compose.ui.draw.scale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.storage.PreferencesManager
import com.example.data.model.FavoriteMediaItem

@Composable
fun MediaDetailsScreen(
    mediaType: String, // "movie" or "series"
    mediaId: Int,
    preferencesManager: PreferencesManager = PreferencesManager(LocalContext.current),
    onBack: () -> Unit,
    onPlay: (type: String, id: Int) -> Unit,
    onCastToTv: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val isFavorite by preferencesManager.isFavorite(mediaType, mediaId).collectAsStateWithLifecycle(initialValue = false)
    val snackbarHostState = remember { SnackbarHostState() }

    var movie by remember { mutableStateOf<Movie?>(MediaRepository.getMovieFromCache(mediaId)) }
    var series by remember { mutableStateOf<Series?>(MediaRepository.getSeriesFromCache(mediaId)) }
    var selectedSeasonNumber by remember { mutableStateOf(1) }
    var episodes by remember {
        mutableStateOf<List<Episode>>(
            series?.seasons?.firstOrNull()?.episodes ?: emptyList()
        )
    }
    var isDownloaded by remember { mutableStateOf(false) }
    var isLoading by remember {
        mutableStateOf((mediaType == "movie" && movie == null) || (mediaType != "movie" && series == null))
    }
    var loadError by remember { mutableStateOf<String?>(null) }
    var showCastDialog by remember { mutableStateOf(false) }

    LaunchedEffect(mediaType, mediaId) {
        loadError = null
        coroutineScope.launch {
            try {
                if (mediaType == "movie") {
                    val found = MediaRepository.getMovieDetails(mediaId)
                    if (found != null) {
                        movie = found
                    } else if (movie == null) {
                        loadError = "لم يتم العثور على بيانات الفيلم في الخادم"
                    }
                } else {
                    val found = MediaRepository.getSeriesDetails(mediaId)
                    if (found != null) {
                        series = found
                        val activeSeason = found.seasons.firstOrNull { it.seasonNumber == selectedSeasonNumber }
                            ?: found.seasons.firstOrNull()
                        episodes = activeSeason?.episodes ?: emptyList()
                    } else if (series == null) {
                        loadError = "لم يتم العثور على بيانات المسلسل في الخادم"
                    }
                }
            } catch (e: Exception) {
                if (movie == null && series == null) {
                    loadError = "خطأ في جلب التفاصيل من الخادم: ${e.localizedMessage ?: ""}"
                }
            } finally {
                isLoading = false
            }
        }
    }

    val title = if (mediaType == "movie") movie?.title ?: "تفاصيل الفيلم" else series?.title ?: "تفاصيل المسلسل"
    val plot = if (mediaType == "movie") movie?.plot else series?.plot
    val rating = if (mediaType == "movie") movie?.rating else series?.rating
    val rawBackdrop = if (mediaType == "movie") movie?.displayBackdrop else series?.displayBackdrop
    val rawPoster = if (mediaType == "movie") movie?.displayPoster else series?.displayPoster

    val fallbackPosterEndpoint = if (mediaType == "movie") "/api/movies/$mediaId/poster" else "/api/series/$mediaId/poster"
    val fallbackBackdropEndpoint = if (mediaType == "movie") "/api/movies/$mediaId/backdrop" else "/api/series/$mediaId/backdrop"

    val posterPathToUse = rawPoster?.takeIf { it.isNotBlank() }
        ?: rawBackdrop?.takeIf { it.isNotBlank() }
        ?: fallbackPosterEndpoint

    val backdropPathToUse = rawBackdrop?.takeIf { it.isNotBlank() }
        ?: rawPoster?.takeIf { it.isNotBlank() }
        ?: fallbackBackdropEndpoint

    val backdrop = ApiClient.getFullMediaUrl(backdropPathToUse)
    val poster = ApiClient.getFullMediaUrl(posterPathToUse)
    val year = if (mediaType == "movie") movie?.year else series?.year
    val resolution = if (mediaType == "movie") movie?.resolution ?: "1080p" else "1080p"
    val accentColor = if (mediaType == "movie") ArnColorMovies else ArnColorShows

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ArnObsidian)
    ) {
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = accentColor)
            }
        } else if (loadError != null && movie == null && series == null) {
            Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = loadError ?: "", color = Color.White, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = onBack, colors = ButtonDefaults.buttonColors(containerColor = accentColor)) {
                        Text("رجوع")
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .navigationBarsPadding()
            ) {
                // Header Backdrop
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(380.dp)
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
                        if (backdrop.isNotEmpty()) {
                            AsyncImage(
                                model = backdrop,
                                contentDescription = title,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }

                        // Gradient Scrim
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(
                                            Color(0x66000000),
                                            Color(0x99090D16),
                                            ArnObsidian
                                        ),
                                        startY = 60f
                                    )
                                )
                        )

                        // Back & Cast Actions
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
                                    .size(42.dp)
                                    .clip(CircleShape)
                                    .background(Color(0x800F172A))
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "رجوع",
                                    tint = Color.White
                                )
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                val heartScale by animateFloatAsState(
                                    targetValue = if (isFavorite) 1.2f else 1.0f,
                                    animationSpec = spring(dampingRatio = 0.4f, stiffness = 400f),
                                    label = "heartScale"
                                )

                                IconButton(
                                    onClick = {
                                        coroutineScope.launch {
                                            val favItem = FavoriteMediaItem(
                                                id = mediaId,
                                                type = mediaType,
                                                title = title,
                                                poster = posterPathToUse,
                                                rating = rating,
                                                year = year
                                            )
                                            val isNowFav = preferencesManager.toggleFavorite(favItem)
                                            snackbarHostState.showSnackbar(
                                                message = if (isNowFav) "تمت إضافة $title إلى قائمتي" else "تمت إزالة $title من قائمتي",
                                                duration = SnackbarDuration.Short
                                            )
                                        }
                                    },
                                    modifier = Modifier
                                        .size(42.dp)
                                        .scale(heartScale)
                                        .clip(CircleShape)
                                        .background(Color(0x800F172A))
                                        .testTag("favorite_toggle_button")
                                ) {
                                    Icon(
                                        imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                        contentDescription = if (isFavorite) "إزالة من المفضلة" else "إضافة إلى المفضلة",
                                        tint = if (isFavorite) Color(0xFFEF4444) else Color.White
                                    )
                                }

                                IconButton(
                                    onClick = { showCastDialog = true },
                                    modifier = Modifier
                                        .size(42.dp)
                                        .clip(CircleShape)
                                        .background(Color(0x800F172A))
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Cast,
                                        contentDescription = "بث للشاشة",
                                        tint = ArnGoldAccent
                                    )
                                }
                            }
                        }

                        // Bottom info in Backdrop
                        Row(
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .padding(16.dp),
                            verticalAlignment = Alignment.Bottom
                        ) {
                            // Poster Thumbnail Box with rich stylish fallback
                            Box(
                                modifier = Modifier
                                    .width(100.dp)
                                    .height(148.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color(0xFF1E293B))
                                    .border(1.5.dp, Color(0x66FFFFFF), RoundedCornerShape(14.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                // Stylized placeholder underneath
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center,
                                    modifier = Modifier.padding(6.dp)
                                ) {
                                    Icon(
                                        imageVector = if (mediaType == "movie") Icons.Default.Movie else Icons.Default.Tv,
                                        contentDescription = null,
                                        tint = accentColor.copy(alpha = 0.7f),
                                        modifier = Modifier.size(36.dp)
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = title,
                                        color = Color.White.copy(alpha = 0.85f),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 2,
                                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                    )
                                }

                                if (poster.isNotEmpty()) {
                                    AsyncImage(
                                        model = poster,
                                        contentDescription = title,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.width(14.dp))

                            Column {
                                Text(
                                    text = title,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Color.White
                                )

                                Spacer(modifier = Modifier.height(6.dp))

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    if (rating != null && rating > 0) {
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = Color(0xD90F172A)
                                        ) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.Star,
                                                    contentDescription = null,
                                                    tint = ArnGoldAccent,
                                                    modifier = Modifier.size(13.dp)
                                                )
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text(
                                                    text = String.format("%.1f", rating),
                                                    color = Color.White,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                    }

                                    if (year != null) {
                                        Text(
                                            text = "$year",
                                            color = ArnTextSecondary,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }

                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = accentColor.copy(alpha = 0.25f)
                                    ) {
                                        Text(
                                            text = resolution,
                                            color = accentColor,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Black,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Action Buttons (Play, Cast, Download)
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = { onPlay(mediaType, mediaId) },
                            colors = ButtonDefaults.buttonColors(containerColor = accentColor),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier
                                .weight(1.5f)
                                .height(50.dp)
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("تشغيل الآن", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = { showCastDialog = true },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x33FFFFFF)),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp)
                        ) {
                            Icon(Icons.Outlined.Cast, contentDescription = null, tint = ArnGoldAccent)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("بث TV", fontSize = 13.sp)
                        }

                        IconButton(
                            onClick = { isDownloaded = !isDownloaded },
                            modifier = Modifier
                                .size(50.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0x1AFFFFFF))
                                .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(16.dp))
                        ) {
                            Icon(
                                imageVector = if (isDownloaded) Icons.Default.Check else Icons.Outlined.Download,
                                contentDescription = "تنزيل",
                                tint = if (isDownloaded) ArnEmeraldPrimary else Color.White
                            )
                        }
                    }
                }

                // Overview / Plot
                item {
                    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                        Text(
                            text = "قصة العمل والملخص:",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = plot ?: "لا يتوفر ملخص تفصيلي لهذا العمل على الخادم.",
                            fontSize = 13.sp,
                            color = ArnTextSecondary,
                            lineHeight = 20.sp
                        )
                    }
                }

                // If series, show Seasons and Episodes from server
                if (mediaType == "series" && series != null && (series?.seasons?.isNotEmpty() == true)) {
                    item {
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = "الحلقات والمواسم:",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        // Season chips
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(series?.seasons ?: emptyList()) { s ->
                                val isSel = s.seasonNumber == selectedSeasonNumber
                                FilterChip(
                                    selected = isSel,
                                    onClick = {
                                        selectedSeasonNumber = s.seasonNumber
                                        episodes = s.episodes
                                    },
                                    label = { Text(s.title ?: "الموسم ${s.seasonNumber}") },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = ArnColorShows,
                                        selectedLabelColor = Color.White
                                    )
                                )
                            }
                        }
                    }

                    items(episodes) { ep ->
                        GlassCard(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 6.dp),
                            onClick = { onPlay("episode", ep.id) }
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(CircleShape)
                                        .background(ArnColorShows.copy(alpha = 0.2f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "${ep.episodeNumber}",
                                        fontWeight = FontWeight.Bold,
                                        color = ArnColorShows,
                                        fontSize = 16.sp
                                    )
                                }
                                Spacer(modifier = Modifier.width(14.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = ep.title,
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp
                                    )
                                    Text(
                                        text = "${(ep.duration ?: 0) / 60} دقيقة • ${ep.resolution ?: "1080p"}",
                                        color = ArnTextSecondary,
                                        fontSize = 11.sp
                                    )
                                }
                                Icon(
                                    imageVector = Icons.Default.PlayArrow,
                                    contentDescription = null,
                                    tint = ArnColorShows
                                )
                            }
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(40.dp))
                }
            }
        }

        if (showCastDialog) {
            CastSelectionDialog(
                mediaTitle = title,
                mediaType = mediaType,
                mediaId = mediaId,
                onDismiss = { showCastDialog = false },
                onOpenRemote = {
                    showCastDialog = false
                    onCastToTv()
                }
            )
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 16.dp)
        )
    }
}
