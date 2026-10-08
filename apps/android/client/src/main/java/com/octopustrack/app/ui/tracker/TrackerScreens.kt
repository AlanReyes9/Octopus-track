package com.octopustrack.app.ui.tracker

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.octopustrack.app.data.Formatting
import com.octopustrack.app.tracker.TrackerStatus
import com.octopustrack.app.ui.brand.Ic
import com.octopustrack.app.ui.brand.LIcon
import com.octopustrack.app.ui.brand.OctopusMark
import com.octopustrack.app.ui.components.BrandButton
import com.octopustrack.app.ui.components.ButtonKind
import com.octopustrack.app.ui.components.InlineMessage
import com.octopustrack.app.ui.components.MetricTile
import com.octopustrack.app.ui.components.Pill
import com.octopustrack.app.ui.components.SoftCard
import com.octopustrack.app.ui.components.Tone

@Composable
private fun StepScaffold(
    title: String,
    subtitle: String,
    onBack: (() -> Unit)?,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState()).navigationBarsPadding().padding(horizontal = 20.dp, vertical = 12.dp)) {
        if (onBack != null) {
            Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) { LIcon(Ic.ArrowLeft, size = 22.dp) }
        } else Spacer(Modifier.height(44.dp))
        Spacer(Modifier.height(8.dp))
        Text(title, style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(6.dp))
        Text(subtitle, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(20.dp))
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) { content() }
    }
}

@Composable
fun ShareLinkScreen(
    input: String,
    onInput: (String) -> Unit,
    loading: Boolean,
    error: String?,
    onContinue: () -> Unit,
    onScan: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) = StepScaffold("Compartir mi ubicación", "Tu empresa o administrador te dará un enlace o un código QR para vincular este teléfono.", onBack, modifier) {
    SoftCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                LIcon(Ic.Link, tint = MaterialTheme.colorScheme.primary, size = 20.dp)
                Spacer(Modifier.size(10.dp))
                Text("Pega el enlace de vinculación", style = MaterialTheme.typography.titleSmall)
            }
            OutlinedTextField(
                input, onInput, Modifier.fillMaxWidth(), placeholder = { Text("https://…/rastreo#t=…") },
                singleLine = true, shape = RoundedCornerShape(16.dp),
            )
            BrandButton("Continuar", onContinue, Modifier.fillMaxWidth(), loading = loading, enabled = input.isNotBlank())
        }
    }
    Text("o", Modifier.fillMaxWidth(), textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
    BrandButton("Escanear código QR", onScan, Modifier.fillMaxWidth(), kind = ButtonKind.Secondary, icon = Ic.QrCode)
    if (error != null) InlineMessage(error)
    InlineMessage(
        "Solo se comparte tu ubicación si lo aceptas en el siguiente paso, y puedes dejar de hacerlo cuando quieras.",
        tone = Tone.Brand, icon = Ic.ShieldCheck,
    )
}

@Composable
fun ConsentScreen(
    company: String,
    deviceName: String,
    name: String,
    onName: (String) -> Unit,
    loading: Boolean,
    error: String?,
    onAccept: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) = StepScaffold("Tu consentimiento", "$company quiere ver la ubicación de este teléfono como «$deviceName».", onBack, modifier) {
    SoftCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Qué se comparte", style = MaterialTheme.typography.titleSmall)
            Bullet(Ic.MapPin, "Tu ubicación, velocidad y rumbo, aunque la app esté cerrada o la pantalla apagada.")
            Bullet(Ic.Battery, "El nivel de batería del teléfono.")
            Bullet(Ic.Clock, "Se actualiza al moverte y cada minuto si estás quieto.")
        }
    }
    SoftCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Tu control", style = MaterialTheme.typography.titleSmall)
            Bullet(Ic.Pause, "Puedes pausar desde la notificación permanente.")
            Bullet(Ic.Power, "Puedes dejar de compartir cuando quieras y se revoca tu consentimiento.")
            Bullet(Ic.Lock, "Solo ve tu ubicación $company; no se vende ni se usa para publicidad.")
        }
    }
    OutlinedTextField(name, onName, Modifier.fillMaxWidth(), label = { Text("Tu nombre") }, singleLine = true, shape = RoundedCornerShape(16.dp))
    if (error != null) InlineMessage(error)
    BrandButton("Acepto compartir mi ubicación", onAccept, Modifier.fillMaxWidth(), icon = Ic.Check, loading = loading, enabled = name.isNotBlank())
}

@Composable
private fun Bullet(@DrawableRes icon: Int, text: String) {
    Row(verticalAlignment = Alignment.Top) {
        LIcon(icon, tint = MaterialTheme.colorScheme.primary, size = 18.dp, modifier = Modifier.padding(top = 2.dp))
        Spacer(Modifier.size(10.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}

data class PermissionState(
    val location: Boolean,
    val background: Boolean,
    val notifications: Boolean,
    val battery: Boolean,
)

@Composable
fun PermissionsScreen(
    state: PermissionState,
    onLocation: () -> Unit,
    onBackground: () -> Unit,
    onNotifications: () -> Unit,
    onBattery: () -> Unit,
    onStart: () -> Unit,
    modifier: Modifier = Modifier,
) = StepScaffold("Últimos permisos", "Para seguirte con la pantalla apagada, Android necesita estos permisos.", null, modifier) {
    PermissionCard(1, Ic.MapPin, "Ubicación precisa", "Para saber dónde estás mientras usas la app.", state.location, "Permitir", onLocation, enabled = true)
    PermissionCard(
        2, Ic.Radio, "Ubicación en segundo plano",
        "Octopus Track recoge tu ubicación aunque la app esté cerrada, para que tu empresa te siga durante la jornada. Verás una notificación permanente mientras esté activo. En la siguiente pantalla elige «Permitir todo el tiempo».",
        state.background, "Continuar", onBackground, enabled = state.location,
    )
    PermissionCard(3, Ic.Bell, "Notificaciones", "Necesarias para mostrar el aviso permanente de seguimiento.", state.notifications, "Permitir", onNotifications, enabled = true)
    PermissionCard(4, Ic.Battery, "Sin ahorro de batería (recomendado)", "Evita que Android detenga el seguimiento en algunos teléfonos.", state.battery, "Ajustar", onBattery, enabled = true, optional = true)
    BrandButton("Empezar a compartir", onStart, Modifier.fillMaxWidth(), icon = Ic.Play, enabled = state.location && state.background)
}

@Composable
private fun PermissionCard(
    n: Int, @DrawableRes icon: Int, title: String, text: String, granted: Boolean, action: String,
    onClick: () -> Unit, enabled: Boolean, optional: Boolean = false,
) {
    SoftCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(36.dp).clip(CircleShape).background(if (granted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center,
                ) { LIcon(if (granted) Ic.Check else icon, tint = if (granted) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.primary, size = 18.dp) }
                Spacer(Modifier.size(12.dp))
                Text(title, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                if (granted) Pill("Listo", Tone.Success) else if (optional) Pill("Opcional", Tone.Neutral)
            }
            Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (!granted) BrandButton(action, onClick, Modifier.fillMaxWidth(), kind = ButtonKind.Secondary, enabled = enabled, height = 44.dp)
        }
    }
}

@Composable
fun TrackingScreen(
    company: String,
    deviceName: String,
    status: TrackerStatus,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onStop: () -> Unit,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var confirmStop by remember { mutableStateOf(false) }
    val active = status.running && !status.paused
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
        0f, 1f, infiniteRepeatable(tween(1800), RepeatMode.Restart), label = "p",
    )
    Column(modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Spacer(Modifier.height(8.dp))
        Box(Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
            if (active) Box(Modifier.size(150.dp).scale(0.7f + pulse * 0.6f).alpha(1f - pulse).background(MaterialTheme.colorScheme.primary.copy(alpha = .25f), CircleShape))
            Box(Modifier.size(132.dp).clip(CircleShape).background(if (active) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) {
                OctopusMark(size = 84.dp, tint = if (active) null else MaterialTheme.colorScheme.outline)
            }
        }
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Pill(
                when { status.revoked -> "Detenido"; !status.running -> "Detenido"; status.paused -> "En pausa"; status.offline -> "Sin conexión" else -> "Compartiendo" }.let { it },
                when { status.revoked || !status.running -> Tone.Neutral; status.paused -> Tone.Warning; status.offline -> Tone.Warning; else -> Tone.Success },
            )
            Spacer(Modifier.height(8.dp))
            Text(deviceName, style = MaterialTheme.typography.headlineSmall)
            Text("Visible para $company", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        status.companyMessage?.let { InlineMessage(it, tone = Tone.Brand, icon = Ic.Message) }
        status.locationProblem?.let {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                InlineMessage(it, tone = Tone.Warning)
                BrandButton("Abrir ajustes", onOpenSettings, Modifier.fillMaxWidth(), kind = ButtonKind.Outline, icon = Ic.Settings, height = 44.dp)
            }
        }
        if (status.offline && !status.paused) InlineMessage("Sin conexión: guardamos tus posiciones y las enviaremos al reconectar.", tone = Tone.Warning, icon = Ic.WifiOff)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MetricTile(Ic.Clock, "Último envío", Formatting.clock(status.lastSentIso), Modifier.weight(1f))
            MetricTile(Ic.Crosshair, "Precisión", status.accuracyM?.let { "$it m" } ?: "—", Modifier.weight(1f))
            MetricTile(Ic.Send, "Enviadas", status.sentCount.toString(), Modifier.weight(1f))
        }
        if (status.pending > 0) Text("${status.pending} posiciones pendientes de enviar", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(Modifier.weight(1f, fill = false))
        if (status.paused || !status.running) BrandButton(if (status.running) "Reanudar" else "Volver a compartir", onResume, Modifier.fillMaxWidth(), icon = Ic.Play)
        else BrandButton("Pausar", onPause, Modifier.fillMaxWidth(), kind = ButtonKind.Secondary, icon = Ic.Pause)
        BrandButton("Dejar de compartir", { confirmStop = true }, Modifier.fillMaxWidth(), kind = ButtonKind.Outline, icon = Ic.Power)
    }
    if (confirmStop) AlertDialog(
        onDismissRequest = { confirmStop = false },
        title = { Text("¿Dejar de compartir?") },
        text = { Text("Se revocará tu consentimiento y $company dejará de ver tu ubicación. Para volver a compartir necesitarás un enlace nuevo.") },
        confirmButton = { TextButton(onClick = { confirmStop = false; onStop() }) { Text("Dejar de compartir", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = { confirmStop = false }) { Text("Cancelar") } },
    )
}
