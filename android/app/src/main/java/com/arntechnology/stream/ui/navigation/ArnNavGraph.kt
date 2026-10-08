package com.arntechnology.stream.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.arntechnology.stream.ui.screens.CategoryScreen
import com.arntechnology.stream.ui.screens.HomeScreen

@Composable
fun ArnNavGraph(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = Screen.Home.route
    ) {
        composable(route = Screen.Home.route) {
            HomeScreen(
                onCategorySelected = { categoryName ->
                    navController.navigate(Screen.Category.createRoute(categoryName))
                }
            )
        }
        
        composable(
            route = Screen.Category.route,
            arguments = listOf(navArgument("categoryName") { type = NavType.StringType })
        ) { backStackEntry ->
            val categoryName = backStackEntry.arguments?.getString("categoryName") ?: "غير معروف"
            CategoryScreen(
                categoryName = categoryName,
                onNavigateBack = { navController.navigateUp() },
                onNavigateToPlayer = { videoUrl -> 
                    // Simple URL encoding to pass safely via Navigation
                    val encodedUrl = java.net.URLEncoder.encode(videoUrl, "UTF-8")
                    navController.navigate("player_screen/$encodedUrl") 
                }
            )
        }

        composable(
            route = "player_screen/{videoUrl}",
            arguments = listOf(navArgument("videoUrl") { type = NavType.StringType })
        ) { backStackEntry ->
            val videoUrl = backStackEntry.arguments?.getString("videoUrl") ?: ""
            val decodedUrl = java.net.URLDecoder.decode(videoUrl, "UTF-8")
            com.arntechnology.stream.ui.screens.PlayerScreen(
                videoUrl = decodedUrl,
                onNavigateBack = { navController.navigateUp() }
            )
        }
    }
}
