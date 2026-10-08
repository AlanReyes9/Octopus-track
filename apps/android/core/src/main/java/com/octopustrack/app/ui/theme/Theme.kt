package com.octopustrack.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val LightScheme = lightColorScheme(
    primary = Violet.V600,
    onPrimary = Color.White,
    primaryContainer = Violet.V100,
    onPrimaryContainer = Violet.V900,
    secondary = Violet.V700,
    onSecondary = Color.White,
    secondaryContainer = Violet.V50,
    onSecondaryContainer = Violet.V800,
    tertiary = Color(0xFFDB2777),
    background = Palette.Canvas,
    onBackground = Palette.Ink,
    surface = Palette.Surface,
    onSurface = Palette.Ink,
    surfaceVariant = Color(0xFFF1EEF8),
    onSurfaceVariant = Palette.Muted,
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFFBFAFE),
    surfaceContainer = Color(0xFFF6F4FB),
    surfaceContainerHigh = Color(0xFFF1EEF8),
    surfaceContainerHighest = Color(0xFFEBE7F5),
    outline = Color(0xFFC9C3DB),
    outlineVariant = Palette.Border,
    error = Palette.Danger,
    errorContainer = Palette.DangerBg,
)

private val DarkScheme = darkColorScheme(
    primary = Violet.V400,
    onPrimary = Color(0xFF1E0B4B),
    primaryContainer = Violet.V800,
    onPrimaryContainer = Violet.V100,
    secondary = Violet.V300,
    secondaryContainer = Color(0xFF2C2147),
    onSecondaryContainer = Violet.V200,
    tertiary = Color(0xFFF472B6),
    background = Color(0xFF130F1F),
    onBackground = Color(0xFFF3F0FA),
    surface = Color(0xFF1B1530),
    onSurface = Color(0xFFF3F0FA),
    surfaceVariant = Color(0xFF2A2342),
    onSurfaceVariant = Color(0xFFB4ACCB),
    surfaceContainerLowest = Color(0xFF110D1C),
    surfaceContainerLow = Color(0xFF181328),
    surfaceContainer = Color(0xFF1E1832),
    surfaceContainerHigh = Color(0xFF262040),
    surfaceContainerHighest = Color(0xFF2E2749),
    outline = Color(0xFF6B6385),
    outlineVariant = Color(0xFF332C4D),
    error = Color(0xFFF87171),
    errorContainer = Color(0xFF4A1D1D),
)

/** Colores de marca que Material 3 no cubre (estados y degradados). */
@Immutable
data class BrandColors(
    val success: Color,
    val successContainer: Color,
    val onSuccessContainer: Color,
    val warning: Color,
    val warningContainer: Color,
    val onWarningContainer: Color,
    val deep: Color,
)

val LocalBrand = staticCompositionLocalOf {
    BrandColors(
        Palette.Success, Palette.SuccessBg, Palette.SuccessFg,
        Palette.Warning, Palette.WarningBg, Palette.WarningFg,
        Violet.V950,
    )
}

private val DarkBrand = BrandColors(
    success = Color(0xFF34D399), successContainer = Color(0xFF0B3B2E), onSuccessContainer = Color(0xFFA7F3D0),
    warning = Color(0xFFFBBF24), warningContainer = Color(0xFF3F2E0B), onWarningContainer = Color(0xFFFDE68A),
    deep = Violet.V950,
)

private val OctopusShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

val ColorScheme.brand: BrandColors @Composable get() = LocalBrand.current

@Composable
fun OctopusTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalBrand provides if (darkTheme) DarkBrand else LocalBrand.current) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkScheme else LightScheme,
            typography = OctopusTypography,
            shapes = OctopusShapes,
        ) {
            CompositionLocalProvider(
                androidx.compose.material3.LocalContentColor provides MaterialTheme.colorScheme.onSurface,
                content = content,
            )
        }
    }
}
