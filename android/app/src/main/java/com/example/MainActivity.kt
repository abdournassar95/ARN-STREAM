package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import com.example.data.storage.PreferencesManager
import com.example.playback.AudioPlayerController
import com.example.ui.navigation.ArnStreamAppNavigation
import com.example.ui.theme.ArnObsidian
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

    private lateinit var preferencesManager: PreferencesManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        preferencesManager = PreferencesManager(applicationContext)
        AudioPlayerController.initialize(applicationContext)

        val imageLoader = coil.ImageLoader.Builder(applicationContext)
            .okHttpClient { com.example.data.api.ApiClient.okHttpClient }
            .crossfade(true)
            .build()
        coil.Coil.setImageLoader(imageLoader)

        setContent {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                MyApplicationTheme {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = ArnObsidian
                    ) {
                        ArnStreamAppNavigation(preferencesManager = preferencesManager)
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        AudioPlayerController.release()
    }
}

