package com.octopustrack.app.ui.theme

import androidx.compose.ui.graphics.Color

/** Paleta de marca: la misma escala violeta que la web (Tailwind violet). */
object Violet {
    val V50 = Color(0xFFF5F3FF)
    val V100 = Color(0xFFEDE9FE)
    val V200 = Color(0xFFDDD6FE)
    val V300 = Color(0xFFC4B5FD)
    val V400 = Color(0xFFA78BFA)
    val V500 = Color(0xFF8B5CF6)
    val V600 = Color(0xFF7C3AED)
    val V700 = Color(0xFF6D28D9)
    val V800 = Color(0xFF5B21B6)
    val V900 = Color(0xFF4C1D95)
    val V950 = Color(0xFF2E1065)
}

object Palette {
    val Ink = Color(0xFF1D1830)
    val Muted = Color(0xFF6C6680)
    val Border = Color(0xFFE5E1EF)
    val Surface = Color(0xFFFFFFFF)
    val Canvas = Color(0xFFF8F7FC)

    val Success = Color(0xFF059669)
    val SuccessBg = Color(0xFFD1FAE5)
    val SuccessFg = Color(0xFF065F46)
    val Warning = Color(0xFFD97706)
    val WarningBg = Color(0xFFFEF3C7)
    val WarningFg = Color(0xFF92400E)
    val Danger = Color(0xFFDC2626)
    val DangerBg = Color(0xFFFEE2E2)

    /** Colores sugeridos para las unidades (igual que en la web). */
    val UnitColors = listOf("#7c3aed", "#db2777", "#0ea5e9", "#16a34a", "#f59e0b", "#dc2626", "#0f172a", "#64748b")
}

fun parseColor(hex: String?, fallback: Color = Violet.V600): Color =
    runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(fallback)
