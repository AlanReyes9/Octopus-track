package com.octopustrack.app.ui.brand

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.octopustrack.app.ui.theme.Violet

/** Fondo de marca: degradado morado con cuadrícula sutil (igual que la web). */
@Composable
fun BrandBackground(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    Box(
        modifier
            .background(Brush.linearGradient(listOf(Color(0xFF3B1685), Violet.V950), start = Offset.Zero, end = Offset(900f, 2200f)))
            .drawBehind {
                drawRect(
                    Brush.radialGradient(
                        listOf(Violet.V500.copy(alpha = 0.55f), Color.Transparent),
                        center = Offset(size.width * 0.15f, size.height * 0.08f),
                        radius = size.maxDimension * 0.55f,
                    ),
                )
                drawRect(
                    Brush.radialGradient(
                        listOf(Violet.V600.copy(alpha = 0.45f), Color.Transparent),
                        center = Offset(size.width * 0.9f, size.height * 0.95f),
                        radius = size.maxDimension * 0.5f,
                    ),
                )
                val step = 40.dp.toPx()
                val line = Color.White.copy(alpha = 0.05f)
                var x = 0f
                while (x < size.width) { drawLine(line, Offset(x, 0f), Offset(x, size.height), 1f); x += step }
                var y = 0f
                while (y < size.height) { drawLine(line, Offset(0f, y), Offset(size.width, y), 1f); y += step }
            },
        content = content,
    )
}
