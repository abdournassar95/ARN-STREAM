package com.example

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.data.storage.PreferencesManager
import com.example.ui.screens.connect.ConnectScreen
import com.example.ui.screens.splash.SplashScreen
import com.example.ui.screens.web.WebClientScreen
import com.example.ui.theme.ArnObsidian
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }

        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = ArnObsidian
                ) {
                    ArnStreamApp()
                }
            }
        }
    }
}

@Composable
fun ArnStreamApp() {
    val context = LocalContext.current
    val navController = rememberNavController()
    val preferencesManager = remember { PreferencesManager(context) }

    NavHost(
        navController = navController,
        startDestination = "splash"
    ) {
        composable("splash") {
            SplashScreen(
                preferencesManager = preferencesManager,
                onNavigateToWeb = { targetUrl ->
                    navController.navigate("web") {
                        popUpTo("splash") { inclusive = true }
                    }
                },
                onNavigateToConnect = {
                    navController.navigate("connect") {
                        popUpTo("splash") { inclusive = true }
                    }
                }
            )
        }

        composable("connect") {
            ConnectScreen(
                preferencesManager = preferencesManager,
                onServerConnected = { url ->
                    navController.navigate("web") {
                        popUpTo("connect") { inclusive = true }
                    }
                }
            )
        }

        composable("web") {
            WebClientScreen(
                preferencesManager = preferencesManager,
                onSwitchServer = {
                    navController.navigate("connect") {
                        popUpTo("web") { inclusive = true }
                    }
                }
            )
        }
    }
}
