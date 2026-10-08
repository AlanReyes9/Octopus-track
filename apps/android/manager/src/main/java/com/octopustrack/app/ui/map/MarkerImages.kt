package com.octopustrack.app.ui.map

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import androidx.core.content.ContextCompat
import androidx.core.graphics.toColorInt
import androidx.core.graphics.drawable.toBitmap
import com.octopustrack.app.ui.brand.unitIconRes

/** Genera los iconos del mapa (círculo de color con el icono de la unidad y flecha de rumbo). */
object MarkerImages {
    private const val SIZE = 112

    fun markerId(icon: String, color: String, selected: Boolean) = "m|$icon|$color|${if (selected) 1 else 0}"
    const val ARROW_ID = "arrow"

    fun marker(context: Context, icon: String, color: String, selected: Boolean, offline: Boolean): Bitmap {
        val bmp = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val cx = SIZE / 2f
        val r = if (selected) 38f else 32f
        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = (if (offline) "#9ca3af" else color).let { runCatching { it.toColorInt() }.getOrDefault(0xFF7C3AED.toInt()) }
        }
        val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = 0x33000000; setShadowLayer(8f, 0f, 3f, 0x55000000) }
        c.drawCircle(cx, cx, r + 4f, shadow)
        c.drawCircle(cx, cx, r + 4f, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = 0xFFFFFFFF.toInt() })
        if (selected) c.drawCircle(cx, cx, r + 4f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = 0xFF4C1D95.toInt(); style = Paint.Style.STROKE; strokeWidth = 4f
        })
        c.drawCircle(cx, cx, r, fill)
        // Nunca debe quedar un círculo vacío por un fallo al cargar/teñir el drawable:
        // si algo falla, se deja el círculo de color (visible) sin el glifo encima.
        runCatching {
            ContextCompat.getDrawable(context, unitIconRes(icon))?.mutate()?.let { d ->
                d.setTint(0xFFFFFFFF.toInt())
                val s = (r * 1.15f).toInt()
                val glyph = d.toBitmap(s, s)
                c.drawBitmap(glyph, cx - s / 2f, cx - s / 2f, null)
            }
        }
        return bmp
    }

    /** Triángulo que apunta hacia arriba, fuera del círculo; el mapa lo rota según el rumbo. */
    fun arrow(): Bitmap {
        val bmp = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val cx = SIZE / 2f
        val p = Path().apply {
            moveTo(cx, 0f); lineTo(cx + 13f, 20f); lineTo(cx - 13f, 20f); close()
        }
        c.drawPath(p, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF4C1D95.toInt() })
        return bmp
    }
}
