package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val ArnColorScheme = darkColorScheme(
    primary = ArnEmeraldPrimary,
    onPrimary = Color.Black,
    primaryContainer = ArnNavySurface,
    onPrimaryContainer = ArnEmeraldGlow,
    secondary = ArnGoldAccent,
    onSecondary = Color.Black,
    secondaryContainer = ArnNavySurface,
    onSecondaryContainer = ArnGoldGlow,
    background = ArnObsidian,
    onBackground = ArnTextPrimary,
    surface = ArnNavyCard,
    onSurface = ArnTextPrimary,
    surfaceVariant = ArnNavySurface,
    onSurfaceVariant = ArnTextSecondary,
    error = ArnError,
    onError = Color.White
)

@Composable
fun MyApplicationTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = ArnColorScheme,
        typography = AppTypography,
        content = content
    )
}
