package com.octopustrack.app.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.octopustrack.app.data.UnitStatus
import com.octopustrack.app.ui.brand.Ic
import com.octopustrack.app.ui.brand.LIcon
import com.octopustrack.app.ui.brand.OctopusMark
import com.octopustrack.app.ui.brand.unitIconRes
import com.octopustrack.app.ui.theme.Violet
import com.octopustrack.app.ui.theme.brand
import com.octopustrack.app.ui.theme.parseColor

/** Cuadro de color con el icono de la unidad (el mismo que ve la web) y punto de estado. */
@Composable
fun UnitAvatar(icon: String, colorHex: String, modifier: Modifier = Modifier, size: Dp = 46.dp, status: UnitStatus? = null) {
    Box(modifier.size(size)) {
        Box(
            Modifier.matchParentSize().clip(RoundedCornerShape(size * 0.3f)).background(parseColor(colorHex)),
            contentAlignment = Alignment.Center,
        ) { LIcon(unitIconRes(icon), tint = Color.White, size = size * 0.5f) }
        if (status != null) {
            val live = status == UnitStatus.Moving || status == UnitStatus.Idle
            Box(
                Modifier.align(Alignment.BottomEnd).size(size * 0.31f)
                    .border(2.dp, MaterialTheme.colorScheme.surface, CircleShape)
                    .padding(2.dp).clip(CircleShape)
                    .background(if (live) MaterialTheme.colorScheme.brand.success else Color(0xFFA1A1AA)),
            )
        }
    }
}

enum class Tone { Success, Warning, Neutral, Danger, Brand }

@Composable
fun Pill(text: String, tone: Tone = Tone.Neutral, modifier: Modifier = Modifier, @DrawableRes icon: Int? = null) {
    val brand = MaterialTheme.colorScheme.brand
    val (bg, fg) = when (tone) {
        Tone.Success -> brand.successContainer to brand.onSuccessContainer
        Tone.Warning -> brand.warningContainer to brand.onWarningContainer
        Tone.Danger -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.error
        Tone.Brand -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        Tone.Neutral -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Row(
        modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) { LIcon(icon, tint = fg, size = 12.dp); Spacer(Modifier.size(4.dp)) }
        Text(text, style = MaterialTheme.typography.labelSmall, color = fg, maxLines = 1)
    }
}

fun UnitStatus.tone(): Tone = when (this) {
    UnitStatus.Moving -> Tone.Brand
    UnitStatus.Idle -> Tone.Success
    UnitStatus.Offline -> Tone.Neutral
    UnitStatus.NoData -> Tone.Neutral
}

/** Tarjeta suave: fondo de superficie, borde fino y esquinas amplias. */
@Composable
fun SoftCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    shape: androidx.compose.ui.graphics.Shape = RoundedCornerShape(20.dp),
    elevation: Dp = 0.dp,
    content: @Composable () -> Unit,
) {
    val border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    if (onClick != null) {
        Surface(onClick = onClick, modifier = modifier, shape = shape, color = MaterialTheme.colorScheme.surface, border = border, shadowElevation = elevation, content = content)
    } else {
        Surface(modifier = modifier, shape = shape, color = MaterialTheme.colorScheme.surface, border = border, shadowElevation = elevation, content = content)
    }
}

@Composable
fun MetricTile(@DrawableRes icon: Int, label: String, value: String, modifier: Modifier = Modifier, tint: Color = MaterialTheme.colorScheme.primary) {
    Column(
        modifier.clip(RoundedCornerShape(16.dp)).background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)).padding(horizontal = 10.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            LIcon(icon, tint = tint, size = 12.dp)
            Spacer(Modifier.size(4.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
        }
        Spacer(Modifier.height(2.dp))
        Text(value, style = MaterialTheme.typography.titleSmall, maxLines = 1, textAlign = TextAlign.Center)
    }
}

enum class ButtonKind { Primary, Secondary, Outline, Danger, Ghost, OnDark }

@Composable
fun BrandButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.Primary,
    @DrawableRes icon: Int? = null,
    loading: Boolean = false,
    enabled: Boolean = true,
    height: Dp = 52.dp,
    colorOverride: Color? = null,
) {
    val cs = MaterialTheme.colorScheme
    val colors = when (kind) {
        ButtonKind.Primary -> ButtonDefaults.buttonColors(cs.primary, cs.onPrimary, cs.primary.copy(alpha = .35f), cs.onPrimary.copy(alpha = .8f))
        ButtonKind.Secondary -> ButtonDefaults.buttonColors(cs.primaryContainer, cs.onPrimaryContainer, cs.surfaceVariant, cs.onSurfaceVariant)
        ButtonKind.Danger -> ButtonDefaults.buttonColors(cs.error, Color.White, cs.error.copy(alpha = .35f), Color.White)
        ButtonKind.OnDark -> ButtonDefaults.buttonColors(Color.White, Violet.V700, Color.White.copy(alpha = .4f), Violet.V700)
        ButtonKind.Outline, ButtonKind.Ghost -> ButtonDefaults.buttonColors(Color.Transparent, colorOverride ?: cs.primary, Color.Transparent, cs.onSurfaceVariant)
    }
    androidx.compose.material3.Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.height(height),
        shape = RoundedCornerShape(16.dp),
        colors = colors,
        border = if (kind == ButtonKind.Outline) BorderStroke(1.5.dp, colorOverride?.copy(alpha = .6f) ?: cs.outline.copy(alpha = .6f)) else null,
        contentPadding = PaddingValues(horizontal = 20.dp),
        elevation = null,
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.5.dp, color = LocalContentColorOrWhite(kind))
        } else {
            if (icon != null) { LIcon(icon, size = 18.dp); Spacer(Modifier.size(8.dp)) }
            Text(text, style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold), maxLines = 1)
        }
    }
}

@Composable
private fun LocalContentColorOrWhite(kind: ButtonKind) = if (kind == ButtonKind.Outline || kind == ButtonKind.Ghost) MaterialTheme.colorScheme.primary else Color.White

@Composable
fun EmptyState(@DrawableRes icon: Int, title: String, text: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(84.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) {
            OctopusMark(size = 46.dp)
            Box(
                Modifier.align(Alignment.BottomEnd).padding(4.dp).size(28.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surface),
                contentAlignment = Alignment.Center,
            ) { LIcon(icon, tint = MaterialTheme.colorScheme.primary, size = 16.dp) }
        }
        Spacer(Modifier.height(16.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        if (action != null) { Spacer(Modifier.height(16.dp)); action() }
    }
}

@Composable
fun InlineMessage(text: String, modifier: Modifier = Modifier, tone: Tone = Tone.Danger, @DrawableRes icon: Int = Ic.Warning) {
    val brand = MaterialTheme.colorScheme.brand
    val (bg, fg) = when (tone) {
        Tone.Danger -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.error
        Tone.Warning -> brand.warningContainer to brand.onWarningContainer
        Tone.Success -> brand.successContainer to brand.onSuccessContainer
        else -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
    }
    Row(modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(bg).padding(12.dp), verticalAlignment = Alignment.Top) {
        LIcon(icon, tint = fg, size = 18.dp, modifier = Modifier.padding(top = 1.dp))
        Spacer(Modifier.size(10.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = fg)
    }
}

@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text.uppercase(),
        modifier = modifier.padding(horizontal = 4.dp, vertical = 6.dp),
        style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 0.8.sp),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}


/** Marcador de posición animado mientras se cargan datos. */
@Composable
fun SkeletonBlock(modifier: Modifier = Modifier, shape: androidx.compose.ui.graphics.Shape = RoundedCornerShape(16.dp)) {
    val a by rememberInfiniteTransition(label = "skeleton").animateFloat(
        initialValue = 0.35f, targetValue = 0.9f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "alpha",
    )
    Box(modifier.alpha(a).clip(shape).background(MaterialTheme.colorScheme.surfaceVariant))
}

@Composable
fun Chip(text: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, count: Int? = null) {
    val cs = MaterialTheme.colorScheme
    Row(
        modifier.clip(RoundedCornerShape(50))
            .background(if (selected) cs.primary else cs.surface)
            .border(1.dp, if (selected) cs.primary else cs.outlineVariant, RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, style = MaterialTheme.typography.labelLarge, color = if (selected) cs.onPrimary else cs.onSurface, maxLines = 1)
        if (count != null) {
            Spacer(Modifier.size(6.dp))
            Text(
                count.toString(),
                style = MaterialTheme.typography.labelSmall,
                color = if (selected) cs.onPrimary.copy(alpha = .85f) else cs.onSurfaceVariant,
            )
        }
    }
}

@Composable
fun ScreenTitle(title: String, modifier: Modifier = Modifier, subtitle: String? = null, trailing: (@Composable () -> Unit)? = null) {
    Row(modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.headlineSmall)
            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        trailing?.invoke()
    }
}

@Composable
fun IconCircleButton(@DrawableRes icon: Int, onClick: () -> Unit, modifier: Modifier = Modifier, tint: Color = MaterialTheme.colorScheme.onSurface, container: Color = MaterialTheme.colorScheme.surface) {
    Surface(
        onClick = onClick, modifier = modifier.size(44.dp), shape = CircleShape, color = container,
        shadowElevation = 4.dp, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) { Box(contentAlignment = Alignment.Center) { LIcon(icon, tint = tint, size = 20.dp) } }
}
