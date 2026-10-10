package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val ArnDarkColorScheme = darkColorScheme(
    primary = ArnColorMovies,
    onPrimary = Color.White,
    primaryContainer = ArnColorMovies.copy(alpha = 0.2f),
    onPrimaryContainer = Color.White,
    secondary = ArnEmeraldPrimary,
    onSecondary = Color.White,
    secondaryContainer = ArnEmeraldPrimary.copy(alpha = 0.2f),
    onSecondaryContainer = Color.White,
    tertiary = ArnGoldAccent,
    onTertiary = Color.Black,
    background = ArnObsidian,
    onBackground = ArnTextPrimary,
    surface = ArnSurface,
    onSurface = ArnTextPrimary,
    surfaceVariant = ArnSurfaceCard,
    onSurfaceVariant = ArnTextSecondary,
    outline = ArnGlassBorder,
    outlineVariant = Color(0x1AFFFFFF)
)

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = true, // Luxury dark experience by default
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = ArnDarkColorScheme,
        typography = Typography,
        content = content
    )
}
