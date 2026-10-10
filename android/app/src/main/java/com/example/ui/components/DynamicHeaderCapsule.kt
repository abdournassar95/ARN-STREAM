package com.example.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Cast
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.R
import com.example.data.model.User
import com.example.ui.theme.*

@Composable
fun DynamicHeaderCapsule(
    user: User?,
    serverUrl: String? = null,
    onServerClick: () -> Unit = {},
    onSearchClick: () -> Unit,
    onCastClick: () -> Unit,
    onInfoClick: () -> Unit,
    onProfileClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .statusBarsPadding()
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 6.dp),
        shape = RoundedCornerShape(24.dp),
        color = Color(0xCC0F172A),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x33FFFFFF))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Brand & Logo
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.clickable { onInfoClick() }
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ic_arn_logo_3d),
                    contentDescription = "ARN Stream",
                    modifier = Modifier.size(36.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(
                        text = "ARN Stream",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White
                    )
                    Text(
                        text = "ARN Technology",
                        fontSize = 9.sp,
                        color = ArnEmeraldPrimary,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Action Buttons
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                // Server status indicator button
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = if (!serverUrl.isNullOrEmpty()) Color(0x2610B981) else Color(0x26EF4444),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        if (!serverUrl.isNullOrEmpty()) ArnEmeraldPrimary else ArnColorMovies
                    ),
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onServerClick() }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = if (!serverUrl.isNullOrEmpty()) ArnEmeraldPrimary else Color(0xFFEF4444),
                            modifier = Modifier.size(7.dp)
                        ) {}
                        Icon(
                            imageVector = Icons.Outlined.Dns,
                            contentDescription = "الخادم",
                            tint = Color.White,
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }

                // Search Button
                IconButton(
                    onClick = onSearchClick,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color(0x1AFFFFFF))
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Search,
                        contentDescription = "البحث",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }

                // PlayTo / Cast Button
                IconButton(
                    onClick = onCastClick,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color(0x1AFFFFFF))
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Cast,
                        contentDescription = "بث للشاشة والريموت",
                        tint = ArnColorShows,
                        modifier = Modifier.size(18.dp)
                    )
                }

                // Info / About Button
                IconButton(
                    onClick = onInfoClick,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color(0x1AFFFFFF))
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Info,
                        contentDescription = "حول المنصة",
                        tint = ArnEmeraldPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }

                // User Avatar
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF1E293B))
                        .border(1.5.dp, ArnEmeraldPrimary, CircleShape)
                        .clickable { onProfileClick() },
                    contentAlignment = Alignment.Center
                ) {
                    if (user?.avatar != null) {
                        AsyncImage(
                            model = user.avatar,
                            contentDescription = user.displayName,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Text(
                            text = user?.displayName?.firstOrNull()?.toString() ?: "A",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }
    }
}
