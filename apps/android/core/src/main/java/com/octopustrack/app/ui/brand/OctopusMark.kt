package com.octopustrack.app.ui.brand

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.octopustrack.app.ui.theme.Violet

private const val HEAD =
    "M32 5C22 5 14 12.7 14 22.6c0 6.6 3.4 11.3 7 14.4.9.8 2 1.2 3.2 1.2h15.6c1.2 0 2.3-.4 3.2-1.2 3.6-3.1 7-7.8 7-14.4C50 12.7 42 5 32 5Z"
private val TENTACLES = listOf(
    "M21 35c-3.5 4.5-8.5 6.5-12.5 4.2",
    "M25.5 37.5c-.6 6.2-3.6 10.6-8.3 12.4",
    "M32 38.5v13.2c0 2.9 2.2 4.6 4.6 3.6",
    "M38.5 37.5c.6 6.2 3.6 10.6 8.3 12.4",
    "M43 35c3.5 4.5 8.5 6.5 12.5 4.2",
)

/**
 * Logotipo: un pulpo cuya cabeza es un marcador de ubicación. Es el mismo
 * dibujo vectorial que el de la web y el icono de la app (viewport 64×64).
 */
@Composable
fun OctopusMark(modifier: Modifier = Modifier, size: Dp = 36.dp, light: Boolean = false, tint: Color? = null) {
    val head = remember { PathParser().parsePathString(HEAD).toPath().apply { fillType = PathFillType.NonZero } }
    val tentacles = remember { TENTACLES.map { PathParser().parsePathString(it).toPath() } }
    val stops = if (light) listOf(Color.White, Violet.V100, Violet.V300) else listOf(Violet.V400, Violet.V600, Violet.V800)
    Canvas(modifier.size(size)) {
        val s = this.size.minDimension / 64f
        val brush = tint?.let { Brush.linearGradient(listOf(it, it)) }
            ?: Brush.linearGradient(
                0f to stops[0], 0.55f to stops[1], 1f to stops[2],
                start = Offset(10f * s, 4f * s), end = Offset(54f * s, 60f * s),
            )
        scale(s, pivot = Offset.Zero) {
            tentacles.forEach { drawPath(it, brush, style = Stroke(4.6f, cap = StrokeCap.Round, join = StrokeJoin.Round)) }
            drawPath(head, brush)
            val eye = if (tint != null) Color.Transparent else Color.White
            if (tint == null) {
                drawCircle(eye, 4f, Offset(25.8f, 22f))
                drawCircle(eye, 4f, Offset(38.2f, 22f))
                drawCircle(Color(0xFF1E1036), 1.9f, Offset(26.6f, 22.8f))
                drawCircle(Color(0xFF1E1036), 1.9f, Offset(39f, 22.8f))
            }
        }
    }
}

@Composable
fun OctopusLogo(modifier: Modifier = Modifier, inverted: Boolean = false, markSize: Dp = 36.dp) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        OctopusMark(size = markSize, light = inverted)
        Text(
            text = buildAnnotatedString {
                append("Octopus")
                withStyle(SpanStyle(color = if (inverted) Violet.V300 else Violet.V600)) { append("Track") }
            },
            modifier = Modifier.padding(start = 10.dp),
            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.SemiBold),
            color = if (inverted) Color.White else MaterialTheme.colorScheme.onSurface,
        )
    }
}

