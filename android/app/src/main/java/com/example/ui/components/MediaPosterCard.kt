package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.ui.theme.*

@Composable
fun MediaPosterCard(
    title: String,
    posterUrl: String?,
    rating: Double? = null,
    resolution: String? = null,
    subtitle: String? = null,
    progressPercentage: Float? = null,
    cardWidth: Dp = 135.dp,
    cardHeight: Dp = 202.dp,
    isSquare: Boolean = false,
    fillWidth: Boolean = false,
    testTag: String? = null,
    accentColor: Color = ArnColorMovies,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val actualHeight = if (isSquare) cardWidth else cardHeight

    val columnModifier = if (fillWidth) {
        modifier.fillMaxWidth()
    } else {
        modifier.width(cardWidth)
    }.let { m ->
        if (testTag != null) m.testTag(testTag) else m
    }.clickable { onClick() }

    val boxModifier = if (fillWidth) {
        Modifier
            .fillMaxWidth()
            .aspectRatio(if (isSquare) 1f else (2f / 3f))
    } else {
        Modifier
            .width(cardWidth)
            .height(actualHeight)
    }
        .clip(RoundedCornerShape(16.dp))
        .background(Color(0xFF1E293B))
        .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(16.dp))

    Column(modifier = columnModifier) {
        Box(modifier = boxModifier) {
            // Poster Image
            if (!posterUrl.isNullOrEmpty()) {
                AsyncImage(
                    model = posterUrl,
                    contentDescription = title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(Color(0xFF1E293B), Color(0xFF0F172A))
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = null,
                        tint = Color(0x33FFFFFF),
                        modifier = Modifier.size(if (isSquare) 40.dp else 48.dp)
                    )
                }
            }

            // Top overlay badges (Rating & Resolution)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (rating != null && rating > 0) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Color(0xD90F172A)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                tint = ArnGoldAccent,
                                modifier = Modifier.size(11.dp)
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(
                                text = String.format("%.1f", rating),
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                } else {
                    Spacer(modifier = Modifier.width(1.dp))
                }

                if (!resolution.isNullOrEmpty()) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = accentColor.copy(alpha = 0.85f)
                    ) {
                        Text(
                            text = resolution,
                            color = Color.White,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            // Bottom Gradient & Progress bar
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color(0xCC090D16)),
                            startY = 120f
                        )
                    ),
                contentAlignment = Alignment.BottomStart
            ) {
                if (progressPercentage != null && progressPercentage > 0) {
                    LinearProgressIndicator(
                        progress = { progressPercentage.coerceIn(0f, 1f) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp),
                        color = accentColor,
                        trackColor = Color(0x40000000)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        // Title
        Text(
            text = title,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        // Subtitle (year, genres, artist)
        if (!subtitle.isNullOrEmpty()) {
            Text(
                text = subtitle,
                color = ArnTextSecondary,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
