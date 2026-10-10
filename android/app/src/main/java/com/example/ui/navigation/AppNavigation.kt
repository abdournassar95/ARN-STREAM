package com.example.ui.navigation

import androidx.compose.runtime.*
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.data.api.ApiClient
import com.example.data.model.User
import com.example.data.storage.PreferencesManager
import com.example.ui.screens.artist.ArtistDetailsScreen
import com.example.ui.screens.audio.AudioPlayerScreen
import com.example.ui.screens.connect.ConnectScreen
import com.example.ui.screens.details.MediaDetailsScreen
import com.example.ui.screens.home.HomeScreen
import com.example.ui.screens.library.LibraryBrowserScreen
import com.example.ui.screens.live.LiveTvScreen
import com.example.ui.screens.login.ProfileLoginScreen
import com.example.ui.screens.mylist.MyListScreen
import com.example.ui.screens.player.VideoPlayerScreen
import com.example.ui.screens.remote.RemoteControlScreen
import com.example.ui.screens.splash.SplashScreen
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch

@Composable
fun ArnStreamAppNavigation(preferencesManager: PreferencesManager) {
    val navController = rememberNavController()
    val coroutineScope = rememberCoroutineScope()
    var currentUser by remember { mutableStateOf<User?>(null) }

    LaunchedEffect(Unit) {
        coroutineScope.launch {
            val savedUrl = preferencesManager.serverUrl.firstOrNull()
            if (!savedUrl.isNullOrEmpty()) {
                ApiClient.updateConfig(savedUrl)
            }
            val savedToken = preferencesManager.authToken.firstOrNull()
            if (!savedToken.isNullOrEmpty()) {
                ApiClient.setToken(savedToken)
            }
            val savedName = preferencesManager.userName.firstOrNull()
            if (!savedName.isNullOrEmpty()) {
                currentUser = User(id = 1, username = savedName, displayName = savedName)
            }
            try {
                val status = ApiClient.apiService.getServerStatus()
                if (status.data?.user != null) {
                    currentUser = status.data.user
                }
            } catch (_: Exception) {}
        }
    }

    NavHost(
        navController = navController,
        startDestination = "home"
    ) {
        composable("splash") {
            SplashScreen(
                preferencesManager = preferencesManager,
                onNavigateNext = { dest ->
                    navController.navigate(dest) {
                        popUpTo("splash") { inclusive = true }
                    }
                }
            )
        }

        composable("connect") {
            ConnectScreen(
                preferencesManager = preferencesManager,
                onConnected = {
                    navController.navigate("home") {
                        popUpTo("home") { inclusive = true }
                    }
                }
            )
        }

        composable("login") {
            ProfileLoginScreen(
                preferencesManager = preferencesManager,
                onLoginSuccess = {
                    navController.navigate("home") {
                        popUpTo("login") { inclusive = true }
                    }
                }
            )
        }

        composable("home") {
            HomeScreen(
                user = currentUser,
                preferencesManager = preferencesManager,
                onNavigateToMedia = { type, id ->
                    navController.navigate("details/$type/$id")
                },
                onNavigateToPlayer = { type, id ->
                    navController.navigate("player/$type/$id")
                },
                onNavigateToAudioPlayer = {
                    navController.navigate("audio_player")
                },
                onNavigateToLibrary = { libId ->
                    navController.navigate("library/$libId")
                },
                onNavigateToLiveTv = {
                    navController.navigate("live_tv")
                },
                onNavigateToRemote = {
                    navController.navigate("remote")
                },
                onSwitchProfile = {
                    navController.navigate("login")
                },
                onNavigateToConnect = {
                    navController.navigate("connect")
                },
                onNavigateToArtist = { aId ->
                    navController.navigate("artist/$aId")
                },
                onNavigateToMyList = {
                    navController.navigate("my_list")
                }
            )
        }

        composable("my_list") {
            MyListScreen(
                preferencesManager = preferencesManager,
                onBack = { navController.popBackStack() },
                onNavigateToMedia = { type, id ->
                    navController.navigate("details/$type/$id")
                }
            )
        }

        composable(
            route = "library/{libraryId}",
            arguments = listOf(navArgument("libraryId") { type = NavType.IntType })
        ) { backStackEntry ->
            val libraryId = backStackEntry.arguments?.getInt("libraryId") ?: 1
            LibraryBrowserScreen(
                libraryId = libraryId,
                onBack = { navController.popBackStack() },
                onNavigateToMedia = { type, id ->
                    navController.navigate("details/$type/$id")
                },
                onNavigateToArtist = { aId ->
                    navController.navigate("artist/$aId")
                }
            )
        }

        composable(
            route = "artist/{artistId}",
            arguments = listOf(navArgument("artistId") { type = NavType.IntType })
        ) { backStackEntry ->
            val artistId = backStackEntry.arguments?.getInt("artistId") ?: 1
            ArtistDetailsScreen(
                artistId = artistId,
                onBack = { navController.popBackStack() },
                onNavigateToAudioPlayer = {
                    navController.navigate("audio_player")
                }
            )
        }

        composable(
            route = "details/{type}/{id}",
            arguments = listOf(
                navArgument("type") { type = NavType.StringType },
                navArgument("id") { type = NavType.IntType }
            )
        ) { backStackEntry ->
            val type = backStackEntry.arguments?.getString("type") ?: "movie"
            val id = backStackEntry.arguments?.getInt("id") ?: 1
            MediaDetailsScreen(
                mediaType = type,
                mediaId = id,
                preferencesManager = preferencesManager,
                onBack = { navController.popBackStack() },
                onPlay = { pType, pId ->
                    navController.navigate("player/$pType/$pId")
                },
                onCastToTv = {
                    navController.navigate("remote")
                }
            )
        }

        composable(
            route = "player/{type}/{id}",
            arguments = listOf(
                navArgument("type") { type = NavType.StringType },
                navArgument("id") { type = NavType.IntType }
            )
        ) { backStackEntry ->
            val type = backStackEntry.arguments?.getString("type") ?: "movie"
            val id = backStackEntry.arguments?.getInt("id") ?: 1
            VideoPlayerScreen(
                mediaType = type,
                mediaId = id,
                onBack = { navController.popBackStack() },
                onCastToTv = {
                    navController.navigate("remote")
                }
            )
        }

        composable("audio_player") {
            AudioPlayerScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable("remote") {
            RemoteControlScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable("live_tv") {
            LiveTvScreen(
                onBack = { navController.popBackStack() },
                onWatchChannel = { channelId ->
                    navController.navigate("player/live/1")
                }
            )
        }
    }
}
