package com.example.ui.screens.mylist

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.api.ApiClient
import com.example.data.storage.PreferencesManager
import com.example.ui.components.MediaPosterCard
import com.example.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyListScreen(
    preferencesManager: PreferencesManager,
    onBack: () -> Unit,
    onNavigateToMedia: (type: String, id: Int) -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val favorites by preferencesManager.favoriteItems.collectAsStateWithLifecycle(initialValue = emptyList())
    var selectedFilter by remember { mutableStateOf("all") } // "all", "movie", "series"

    val filteredList = remember(favorites, selectedFilter) {
        when (selectedFilter) {
            "movie" -> favorites.filter { it.type == "movie" }
            "series" -> favorites.filter { it.type == "series" }
            else -> favorites
        }
    }

    val movieCount = remember(favorites) { favorites.count { it.type == "movie" } }
    val seriesCount = remember(favorites) { favorites.count { it.type == "series" } }

    Scaffold(
        containerColor = ArnObsidian,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Favorite,
                            contentDescription = null,
                            tint = Color(0xFFEF4444),
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "قائمتي المفضلة",
                            fontWeight = FontWeight.Black,
                            fontSize = 18.sp,
                            color = Color.White
                        )
                        if (favorites.isNotEmpty()) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0x33EF4444)
                            ) {
                                Text(
                                    text = "${favorites.size}",
                                    color = Color(0xFFEF4444),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                )
                            }
                        }
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
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ArnObsidian)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .navigationBarsPadding()
        ) {
            // Filter Chips
            if (favorites.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = selectedFilter == "all",
                        onClick = { selectedFilter = "all" },
                        label = { Text("الكل (${favorites.size})") },
                        modifier = Modifier.testTag("my_list_filter_all"),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color(0xFFEF4444),
                            selectedLabelColor = Color.White,
                            containerColor = Color(0xFF1E293B),
                            labelColor = ArnTextSecondary
                        )
                    )
                    FilterChip(
                        selected = selectedFilter == "movie",
                        onClick = { selectedFilter = "movie" },
                        label = { Text("الأفلام ($movieCount)") },
                        modifier = Modifier.testTag("my_list_filter_movies"),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ArnColorMovies,
                            selectedLabelColor = Color.White,
                            containerColor = Color(0xFF1E293B),
                            labelColor = ArnTextSecondary
                        )
                    )
                    FilterChip(
                        selected = selectedFilter == "series",
                        onClick = { selectedFilter = "series" },
                        label = { Text("المسلسلات ($seriesCount)") },
                        modifier = Modifier.testTag("my_list_filter_series"),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ArnColorShows,
                            selectedLabelColor = Color.White,
                            containerColor = Color(0xFF1E293B),
                            labelColor = ArnTextSecondary
                        )
                    )
                }
            }

            if (filteredList.isEmpty()) {
                // Empty State
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(90.dp)
                                .clip(CircleShape)
                                .background(Color(0x1AEF4444)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.FavoriteBorder,
                                contentDescription = null,
                                tint = Color(0xFFEF4444),
                                modifier = Modifier.size(46.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        Text(
                            text = if (favorites.isEmpty()) "قائمتك فارغة حالياً" else "لا توجد عناصر مطابقة للفلتر المحدد",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = if (favorites.isEmpty()) {
                                "اضغط على أيقونة القلب في صفحة تفاصيل أي فيلم أو مسلسل لإضافته إلى قائمتك والوصول إليه بسرعة في أي وقت."
                            } else {
                                "جرب اختيار تبويب 'الكل' لمشاهدة جميع المحفوظات في قائمتك."
                            },
                            fontSize = 13.sp,
                            color = ArnTextSecondary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 20.dp)
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = onBack,
                            colors = ButtonDefaults.buttonColors(containerColor = ArnEmeraldPrimary),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.testTag("my_list_explore_button")
                        ) {
                            Text("تصفح واستكشف المحتوى", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                // Responsive Grid of Favorite Items (Aspect Ratio 2:3)
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 105.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(
                        items = filteredList,
                        key = { "${it.type}_${it.id}" }
                    ) { item ->
                        val posterUrl = ApiClient.getFullMediaUrl(item.poster)
                        Box(modifier = Modifier.fillMaxWidth()) {
                            MediaPosterCard(
                                title = item.title,
                                posterUrl = posterUrl,
                                rating = item.rating,
                                subtitle = if (item.type == "movie") "فيلم" else "مسلسل",
                                fillWidth = true,
                                isSquare = false,
                                accentColor = if (item.type == "movie") ArnColorMovies else ArnColorShows,
                                onClick = { onNavigateToMedia(item.type, item.id) }
                            )

                            // Quick remove heart button at top-start
                            IconButton(
                                onClick = {
                                    coroutineScope.launch {
                                        preferencesManager.removeFavorite(item.type, item.id)
                                    }
                                },
                                modifier = Modifier
                                    .align(Alignment.TopStart)
                                    .padding(4.dp)
                                    .size(32.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xCC0F172A))
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Favorite,
                                    contentDescription = "إزالة من المفضلة",
                                    tint = Color(0xFFEF4444),
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
