package com.example.ui.screens.library

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.api.ApiClient
import com.example.data.model.Artist
import com.example.data.model.Library
import com.example.data.model.Movie
import com.example.data.model.Series
import com.example.data.repository.MediaRepository
import com.example.ui.components.MediaPosterCard
import com.example.ui.components.getLibraryColor
import com.example.ui.components.getLibraryEmoji
import com.example.ui.theme.ArnObsidian
import com.example.ui.theme.ArnTextSecondary
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryBrowserScreen(
    libraryId: Int,
    onBack: () -> Unit,
    onNavigateToMedia: (type: String, id: Int) -> Unit,
    onNavigateToArtist: (artistId: Int) -> Unit = {}
) {
    val coroutineScope = rememberCoroutineScope()
    var currentLibrary by remember { mutableStateOf<Library?>(null) }
    var moviesList by remember { mutableStateOf<List<Movie>>(emptyList()) }
    var seriesList by remember { mutableStateOf<List<Series>>(emptyList()) }
    var artistsList by remember { mutableStateOf<List<Artist>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedSort by remember { mutableStateOf("added_at") }
    var showSortMenu by remember { mutableStateOf(false) }

    LaunchedEffect(libraryId) {
        isLoading = true
        coroutineScope.launch {
            try {
                // Fetch library metadata
                val libRes = ApiClient.apiService.getLibraries(nonEmpty = false)
                val found = libRes.data?.find { it.id == libraryId }
                currentLibrary = found

                val type = found?.type?.lowercase() ?: "movies"
                when (type) {
                    "shows", "series" -> {
                        val res = ApiClient.apiService.getSeries(libraryId = libraryId, limit = 500)
                        var list = res.data ?: emptyList()
                        if (list.isEmpty()) {
                            val allRes = ApiClient.apiService.getSeries(limit = 500)
                            list = allRes.data?.filter { it.libraryId == libraryId } ?: emptyList()
                        }
                        seriesList = list
                        MediaRepository.registerSeries(list)
                    }
                    "music", "quran" -> {
                        val res = ApiClient.apiService.getArtists(libraryId = libraryId, limit = 500)
                        var list = res.data ?: emptyList()
                        if (list.isEmpty()) {
                            val allRes = ApiClient.apiService.getArtists(limit = 500)
                            list = allRes.data?.filter { it.libraryId == libraryId } ?: emptyList()
                        }
                        artistsList = list
                        MediaRepository.registerArtists(list)
                    }
                    else -> {
                        val res = ApiClient.apiService.getMovies(libraryId = libraryId, sort = selectedSort, limit = 500)
                        var list = res.data ?: emptyList()
                        if (list.isEmpty()) {
                            val fallback = ApiClient.apiService.getLibraryDetails(libraryId, limit = 500)
                            val items = fallback.data?.items ?: emptyList()
                            if (items.isNotEmpty()) {
                                list = items
                            }
                        }
                        if (list.isEmpty()) {
                            val allRes = ApiClient.apiService.getMovies(limit = 500)
                            list = allRes.data?.filter { it.libraryId == libraryId } ?: emptyList()
                        }
                        moviesList = list
                        MediaRepository.registerMovies(list)
                    }
                }
            } catch (_: Exception) {} finally {
                isLoading = false
            }
        }
    }

    val libraryType = currentLibrary?.type?.lowercase() ?: "movies"
    val themeColor = getLibraryColor(libraryType)
    val libraryTitle = currentLibrary?.name ?: "تصفح المكتبة"
    val totalCount = when (libraryType) {
        "shows", "series" -> seriesList.size
        "music", "quran" -> artistsList.size
        else -> moviesList.size
    }

    Scaffold(
        containerColor = ArnObsidian,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(getLibraryEmoji(libraryType), fontSize = 18.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = libraryTitle,
                            fontWeight = FontWeight.Black,
                            fontSize = 18.sp,
                            color = Color.White
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "رجوع",
                            tint = Color.White
                        )
                    }
                },
                actions = {
                    Box {
                        IconButton(onClick = { showSortMenu = true }) {
                            Icon(
                                imageVector = Icons.Default.FilterList,
                                contentDescription = "ترتيب",
                                tint = themeColor
                            )
                        }
                        DropdownMenu(
                            expanded = showSortMenu,
                            onDismissRequest = { showSortMenu = false },
                            modifier = Modifier.background(Color(0xFF1E293B))
                        ) {
                            DropdownMenuItem(
                                text = { Text("الأحدث إضافة", color = Color.White) },
                                onClick = {
                                    selectedSort = "added_at"
                                    showSortMenu = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("أعلى التقييمات", color = Color.White) },
                                onClick = {
                                    selectedSort = "rating"
                                    moviesList = moviesList.sortedByDescending { it.rating ?: 0.0 }
                                    seriesList = seriesList.sortedByDescending { it.rating ?: 0.0 }
                                    showSortMenu = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("سنة الإنتاج", color = Color.White) },
                                onClick = {
                                    selectedSort = "year"
                                    moviesList = moviesList.sortedByDescending { it.year ?: 0 }
                                    seriesList = seriesList.sortedByDescending { it.year ?: 0 }
                                    showSortMenu = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("أبجدياً (أ-ي)", color = Color.White) },
                                onClick = {
                                    selectedSort = "title"
                                    moviesList = moviesList.sortedBy { it.title }
                                    seriesList = seriesList.sortedBy { it.title }
                                    artistsList = artistsList.sortedBy { it.name }
                                    showSortMenu = false
                                }
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xCC0F172A)
                )
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .navigationBarsPadding()
        ) {
            // Count Banner
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "العناصر في الخادم: $totalCount",
                    color = ArnTextSecondary,
                    fontSize = 12.sp
                )
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = themeColor.copy(alpha = 0.2f)
                ) {
                    Text(
                        text = "ترتيب: ${if (selectedSort == "rating") "التقييم" else if (selectedSort == "year") "السنة" else "المضاف حديثاً"}",
                        color = themeColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = themeColor)
                }
            } else if (totalCount == 0) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.FolderOpen,
                            contentDescription = null,
                            tint = themeColor,
                            modifier = Modifier.size(52.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "هذه المكتبة فارغة على الخادم حالياً.",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "أضف ملفات وسائط إلى مسار هذه المكتبة على خادم ARN Stream لتظهر هنا تلقائياً.",
                            color = ArnTextSecondary,
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 105.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    if (libraryType == "shows" || libraryType == "series") {
                        items(seriesList, key = { it.id }) { series ->
                            val posterUrl = ApiClient.getFullMediaUrl(series.displayPoster ?: series.displayBackdrop)
                            MediaPosterCard(
                                title = series.title,
                                posterUrl = posterUrl,
                                rating = series.rating,
                                resolution = "${series.seasonsCount} مواسم",
                                subtitle = if (series.year != null) "${series.year}" else null,
                                fillWidth = true,
                                isSquare = false,
                                accentColor = themeColor,
                                onClick = { onNavigateToMedia("series", series.id) }
                            )
                        }
                    } else if (libraryType == "music" || libraryType == "quran") {
                        items(artistsList, key = { it.id }) { artist ->
                            val imageUrl = ApiClient.getFullMediaUrl(artist.displayImage)
                            MediaPosterCard(
                                title = artist.name,
                                posterUrl = imageUrl,
                                subtitle = "${artist.totalTracks} تراك",
                                resolution = "${artist.totalAlbums} ألبوم",
                                fillWidth = true,
                                isSquare = true,
                                accentColor = themeColor,
                                onClick = { onNavigateToArtist(artist.id) }
                            )
                        }
                    } else {
                        items(moviesList, key = { it.id }) { movie ->
                            val posterUrl = ApiClient.getFullMediaUrl(movie.displayPoster ?: movie.displayBackdrop)
                            MediaPosterCard(
                                title = movie.title,
                                posterUrl = posterUrl,
                                rating = movie.rating,
                                resolution = movie.resolution,
                                subtitle = if (movie.year != null) "${movie.year}" else null,
                                fillWidth = true,
                                isSquare = false,
                                accentColor = themeColor,
                                onClick = { onNavigateToMedia("movie", movie.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}
