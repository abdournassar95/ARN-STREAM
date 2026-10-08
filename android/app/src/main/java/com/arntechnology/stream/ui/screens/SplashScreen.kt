package com.arntechnology.stream.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.arntechnology.stream.data.local.SessionPreferences
import com.arntechnology.stream.ui.theme.ArnEmerald
import com.arntechnology.stream.ui.theme.DarkBackground
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(
    onNavigateToDiscovery: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateToHome: () -> Unit
) {
    val context = LocalContext.getContext()
    val prefs = remember { SessionPreferences(context) }

    LaunchedEffect(Unit) {
        delay(1000) // Small delay for effect
        val serverUrl = prefs.getServerUrl()
        val authToken = prefs.getAuthToken()

        when {
            serverUrl.isNullOrEmpty() -> onNavigateToDiscovery()
            authToken.isNullOrEmpty() -> onNavigateToLogin()
            else -> onNavigateToHome()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            color = ArnEmerald,
            modifier = Modifier.size(48.dp)
        )
    }
}
