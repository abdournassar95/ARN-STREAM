package com.arntechnology.stream.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.arntechnology.stream.data.model.MovieItem
import com.arntechnology.stream.ui.components.GlassCard
import com.arntechnology.stream.ui.theme.ArnEmerald
import com.arntechnology.stream.ui.theme.DarkBackground
import com.arntechnology.stream.ui.theme.TextPrimary
import com.arntechnology.stream.ui.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryScreen(
    categoryName: String,
    onNavigateBack: () -> Unit,
    onNavigateToPlayer: (String) -> Unit
) {
    // Mock Data for demonstration
    val mockMovies = listOf(
        MovieItem(1, "فيلم Big Buck Bunny", 2008, "فلم رسوم متحركة قصير رائع.", poster = "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg"),
        MovieItem(2, "Tears of Steel", 2012, "خيال علمي، أكشن.", poster = "https://mango.blender.org/wp-content/uploads/2013/05/01_hologram_1080p.jpg")
    )
    
    // Dummy video url for the mock movies
    val dummyVideoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = categoryName,
                        color = ArnEmerald,
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "العودة",
                            tint = TextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = DarkBackground,
                    titleContentColor = ArnEmerald
                )
            )
        },
        containerColor = DarkBackground
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            items(mockMovies) { movie ->
                MovieCard(
                    movie = movie,
                    onClick = { onNavigateToPlayer(dummyVideoUrl) }
                )
            }
        }
    }
}

@Composable
fun MovieCard(movie: MovieItem, onClick: () -> Unit) {
    GlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .height(140.dp)
            .clickable { onClick() },
        cornerRadius = 16.dp
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Movie Poster
            AsyncImage(
                model = movie.poster,
                contentDescription = movie.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .width(100.dp)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(topStart = 16.dp, bottomStart = 16.dp))
                    .background(Color.DarkGray)
            )
            
            // Movie Details
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(16.dp),
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = movie.title,
                    color = TextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = movie.year?.toString() ?: "",
                    color = ArnEmerald,
                    fontSize = 14.sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = movie.plot ?: "",
                    color = TextSecondary,
                    fontSize = 12.sp,
                    maxLines = 2
                )
            }
            
            // Play Icon
            IconButton(
                onClick = onClick,
                modifier = Modifier.padding(end = 8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = "تشغيل",
                    tint = ArnEmerald,
                    modifier = Modifier.size(36.dp)
                )
            }
        }
    }
}
