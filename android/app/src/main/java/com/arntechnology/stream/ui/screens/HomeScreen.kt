package com.arntechnology.stream.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arntechnology.stream.ui.components.ArnAboutDialog
import com.arntechnology.stream.ui.components.GlassCard
import com.arntechnology.stream.ui.theme.*

data class CategoryItem(
    val title: String,
    val color: Color,
    val icon: ImageVector = Icons.Default.PlayArrow
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onCategorySelected: (String) -> Unit
) {
    var showAboutDialog by remember { mutableStateOf(false) }

    val categories = listOf(
        CategoryItem("أفلام", MoviePrimary),
        CategoryItem("مسلسلات", SeriesPrimary),
        CategoryItem("مسرحيات", PlaysPrimary),
        CategoryItem("وثائقيات", DocsPrimary),
        CategoryItem("موسيقى", MusicPrimary),
        CategoryItem("قرآن كريم", QuranPrimary),
        CategoryItem("بث حي", LiveTvPrimary)
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "ARN Stream",
                        color = ArnEmerald,
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp
                    )
                },
                actions = {
                    IconButton(onClick = { showAboutDialog = true }) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = "حول البرنامج",
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
        ) {
            Text(
                text = "ماذا تود أن تشاهد اليوم؟",
                color = TextPrimary,
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(vertical = 16.dp)
            )

            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(categories) { category ->
                    CategoryCard(
                        category = category,
                        onClick = { onCategorySelected(category.title) }
                    )
                }
            }
        }

        ArnAboutDialog(
            isOpen = showAboutDialog,
            onDismiss = { showAboutDialog = false }
        )
    }
}

@Composable
fun CategoryCard(
    category: CategoryItem,
    onClick: () -> Unit
) {
    GlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .height(120.dp)
            .clickable { onClick() },
        cornerRadius = 24.dp
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = category.icon,
                contentDescription = category.title,
                tint = category.color,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = category.title,
                color = TextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
