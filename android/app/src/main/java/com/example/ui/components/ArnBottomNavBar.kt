package com.example.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.LiveTv
import androidx.compose.material.icons.outlined.VideoLibrary
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.ArnEmeraldPrimary
import com.example.ui.theme.ArnTextSecondary

data class NavTabItem(
    val id: String,
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val activeColor: Color,
    val testTag: String
)

@Composable
fun ArnBottomNavBar(
    currentTab: String,
    onTabSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val items = remember {
        listOf(
            NavTabItem(
                id = "home",
                title = "الرئيسية",
                selectedIcon = Icons.Filled.Home,
                unselectedIcon = Icons.Outlined.Home,
                activeColor = ArnEmeraldPrimary,
                testTag = "bottom_nav_home"
            ),
            NavTabItem(
                id = "libraries",
                title = "المكتبات",
                selectedIcon = Icons.Filled.VideoLibrary,
                unselectedIcon = Icons.Outlined.VideoLibrary,
                activeColor = Color(0xFF38BDF8),
                testTag = "bottom_nav_libraries"
            ),
            NavTabItem(
                id = "my_list",
                title = "قائمتي",
                selectedIcon = Icons.Filled.Favorite,
                unselectedIcon = Icons.Outlined.FavoriteBorder,
                activeColor = Color(0xFFEF4444),
                testTag = "bottom_nav_my_list"
            ),
            NavTabItem(
                id = "live_tv",
                title = "بث مباشر",
                selectedIcon = Icons.Filled.LiveTv,
                unselectedIcon = Icons.Outlined.LiveTv,
                activeColor = Color(0xFFF59E0B),
                testTag = "bottom_nav_live_tv"
            )
        )
    }

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.navigationBars),
        color = Color(0xF2090D16),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x1FFFFFFF))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            items.forEach { item ->
                val isSelected = currentTab == item.id
                val interactionSource = remember { MutableInteractionSource() }

                val animatedIconColor by animateColorAsState(
                    targetValue = if (isSelected) item.activeColor else Color(0x99FFFFFF),
                    label = "iconColor"
                )

                val animatedBgColor by animateColorAsState(
                    targetValue = if (isSelected) item.activeColor.copy(alpha = 0.16f) else Color.Transparent,
                    label = "tabBgColor"
                )

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(animatedBgColor)
                        .testTag(item.testTag)
                        .clickable(
                            interactionSource = interactionSource,
                            indication = ripple(bounded = true, radius = 28.dp),
                            onClick = { onTabSelected(item.id) }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = if (isSelected) item.selectedIcon else item.unselectedIcon,
                            contentDescription = item.title,
                            tint = animatedIconColor,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.height(3.dp))
                        Text(
                            text = item.title,
                            color = animatedIconColor,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}
