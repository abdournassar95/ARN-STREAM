package com.example.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.Library
import com.example.ui.theme.*

import androidx.compose.ui.platform.testTag

@Composable
fun LibraryTabsCapsule(
    libraries: List<Library>,
    selectedLibraryId: Int?,
    onSelectLibrary: (Library) -> Unit,
    onSelectAll: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    LazyRow(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // "All" capsule if callback provided
        if (onSelectAll != null) {
            item(key = "tab_all") {
                val isAllSelected = selectedLibraryId == null || selectedLibraryId == 0
                val animatedBgColor by animateColorAsState(
                    targetValue = if (isAllSelected) ArnEmeraldPrimary.copy(alpha = 0.25f) else Color(0x1AFFFFFF),
                    label = "allBgColor"
                )
                val animatedBorderColor by animateColorAsState(
                    targetValue = if (isAllSelected) ArnEmeraldPrimary else Color(0x26FFFFFF),
                    label = "allBorderColor"
                )

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(animatedBgColor)
                        .border(1.5.dp, animatedBorderColor, RoundedCornerShape(20.dp))
                        .testTag("library_tab_all")
                        .clickable { onSelectAll() }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(text = "✨", fontSize = 14.sp)
                        Text(
                            text = "جميع المكتبات",
                            color = if (isAllSelected) Color.White else ArnTextSecondary,
                            fontWeight = if (isAllSelected) FontWeight.ExtraBold else FontWeight.Medium,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }

        items(libraries, key = { it.id }) { lib ->
            val isSelected = lib.id == selectedLibraryId
            val themeColor = getLibraryColor(lib.type)

            val animatedBgColor by animateColorAsState(
                targetValue = if (isSelected) themeColor.copy(alpha = 0.25f) else Color(0x1AFFFFFF),
                label = "bgColor"
            )

            val animatedBorderColor by animateColorAsState(
                targetValue = if (isSelected) themeColor else Color(0x26FFFFFF),
                label = "borderColor"
            )

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(animatedBgColor)
                    .border(1.5.dp, animatedBorderColor, RoundedCornerShape(20.dp))
                    .testTag("library_tab_${lib.id}")
                    .clickable { onSelectLibrary(lib) }
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = getLibraryEmoji(lib.type),
                        fontSize = 15.sp
                    )
                    Text(
                        text = lib.name,
                        color = if (isSelected) Color.White else ArnTextSecondary,
                        fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Medium,
                        fontSize = 13.sp
                    )
                }
            }
        }
    }
}

fun getLibraryColor(type: String): Color {
    return when (type.lowercase()) {
        "movies" -> ArnColorMovies
        "shows" -> ArnColorShows
        "plays" -> ArnColorPlays
        "documentaries" -> ArnColorDocumentaries
        "music" -> ArnColorMusic
        "quran" -> ArnColorQuran
        "live" -> ArnColorLiveTv
        else -> ArnColorMovies
    }
}

fun getLibraryEmoji(type: String): String {
    return when (type.lowercase()) {
        "movies" -> "🎬"
        "shows" -> "📺"
        "plays" -> "🎭"
        "documentaries" -> "🎥"
        "music" -> "🎵"
        "quran" -> "📖"
        "live" -> "📡"
        else -> "🏠"
    }
}
