package com.arntechnology.stream.ui.navigation

sealed class Screen(val route: String) {
    object Splash : Screen("splash_screen")
    object Discovery : Screen("discovery_screen")
    object Login : Screen("login_screen")
    object Home : Screen("home_screen")
    object Category : Screen("category_screen/{categoryName}") {
        fun createRoute(categoryName: String) = "category_screen/$categoryName"
    }
}
