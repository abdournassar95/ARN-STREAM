package com.example.ui.screens.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.data.storage.PreferencesManager
import com.example.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.firstOrNull

@Composable
fun SplashScreen(
    preferencesManager: PreferencesManager,
    onNavigateNext: (destination: String) -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    LaunchedEffect(Unit) {
        val savedUrl = preferencesManager.serverUrl.firstOrNull()
        if (!savedUrl.isNullOrEmpty()) {
            onNavigateNext("home")
        } else {
            delay(1000)
            onNavigateNext("connect")
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .background(
                Brush.verticalGradient(
                    colors = listOf(ArnObsidian, Color(0xFF0F172A), ArnDeepVoid)
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            // Glowing pulsing 3D logo
            Box(
                modifier = Modifier
                    .size(130.dp)
                    .scale(pulseScale)
                    .clip(CircleShape)
                    .background(Color(0xFF1E293B))
                    .border(2.dp, Brush.linearGradient(listOf(ArnColorMovies, ArnEmeraldPrimary, ArnGoldAccent)), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ic_arn_logo_3d),
                    contentDescription = "ARN Stream Logo",
                    modifier = Modifier.size(105.dp)
                )
            }

            Spacer(modifier = Modifier.height(28.dp))

            Text(
                text = "ARN Stream",
                fontSize = 32.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                letterSpacing = 1.sp
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "منصة الترفيه والوسائط المتكاملة",
                fontSize = 14.sp,
                color = ArnTextSecondary,
                fontWeight = FontWeight.Medium
            )

            Spacer(modifier = Modifier.height(36.dp))

            // Developer Signature & 2026 Copyright
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "تطوير وبرمجة: عبده رجب نصار",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = ArnEmeraldPrimary,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "حقوق النشر (c) 2026 لشركة ARN Technology",
                    fontSize = 11.sp,
                    color = ArnTextMuted,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
