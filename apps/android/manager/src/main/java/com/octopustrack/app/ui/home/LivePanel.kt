package com.octopustrack.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.octopustrack.app.data.FleetUnit
import com.octopustrack.app.data.Formatting
import com.octopustrack.app.data.LiveAlert
import com.octopustrack.app.data.LiveMode
import com.octopustrack.app.ui.brand.Ic
import com.octopustrack.app.ui.brand.LIcon
import com.octopustrack.app.ui.components.Pill
import com.octopustrack.app.ui.components.SkeletonBlock
import com.octopustrack.app.ui.components.Tone
import com.octopustrack.app.ui.components.UnitAvatar
import com.octopustrack.app.ui.theme.Violet
import com.octopustrack.app.ui.theme.brand
import java.time.Instant

/** Panel "Mapa en vivo" de la web: título, estado del canal, 3 contadores, buscador, lista y alertas. */
@Composable
fun LivePanel(
    units: List<FleetUnit>,
    alerts: List<LiveAlert>,
    mode: LiveMode,
    loaded: Boolean,
    canManage: Boolean,
    query: String,
    onQuery: (String) -> Unit,
    selectedId: String?,
    modifier: Modifier = Modifier,
    now: Instant = Instant.now(),
    onSelect: (String) -> Unit,
) {
    val q = query.trim()
    val visible = units.filter { it.hasPosition && (q.isEmpty() || it.name.contains(q, true) || (it.plate?.contains(q, true) ?: false) || it.imei.contains(q, true)) }
    val online = units.count { it.isOnline(now) }
    val moving = units.count { it.isOnline(now) && (it.speedKmh ?: 0.0) > Formatting.MOVING_KMH }
    Column(modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Mapa en vivo", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                when (mode) {
                    LiveMode.Realtime -> Pill("Tiempo real", Tone.Success, icon = Ic.Radio)
                    LiveMode.Polling -> Pill("Cada 6 s", Tone.Neutral, icon = Ic.Radio)
                    LiveMode.Connecting -> Pill("Conectando", Tone.Neutral, icon = Ic.Radio)
                    LiveMode.Offline -> Pill("Sin conexión", Tone.Warning, icon = Ic.WifiOff)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Stat("Unidades", units.size, MaterialTheme.colorScheme.onSurface, Modifier.weight(1f))
                Stat("En línea", online, MaterialTheme.colorScheme.brand.success, Modifier.weight(1f))
                Stat("En marcha", moving, MaterialTheme.colorScheme.primary, Modifier.weight(1f))
            }
            OutlinedTextField(
                query, onQuery, Modifier.fillMaxWidth(), singleLine = true, placeholder = { Text("Buscar unidad, placa o IMEI") },
                leadingIcon = { LIcon(Ic.Search, size = 16.dp) }, shape = RoundedCornerShape(12.dp),
                textStyle = MaterialTheme.typography.bodyMedium,
                colors = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant),
            )
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(8.dp)) {
            if (!loaded) items(4) { SkeletonBlock(Modifier.fillMaxWidth().padding(vertical = 4.dp).height(56.dp), RoundedCornerShape(12.dp)) }
            else if (visible.isEmpty()) item {
                Text(
                    if (units.isEmpty()) (if (canManage) "Aún no hay posiciones. Registra un dispositivo o vincula un teléfono." else "Aún no hay posiciones de tus unidades.") else "Sin resultados.",
                    Modifier.padding(16.dp), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            items(visible, key = { it.id }) { u ->
                val sel = u.id == selectedId
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                        .background(if (sel) MaterialTheme.colorScheme.primaryContainer else androidx.compose.ui.graphics.Color.Transparent)
                        .clickable { onSelect(u.id) }.padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    UnitAvatar(u.icon, u.color, size = 40.dp, status = u.status(now))
                    Spacer(Modifier.size(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(u.name, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            LIcon(Ic.Gauge, tint = MaterialTheme.colorScheme.onSurfaceVariant, size = 12.dp)
                            Spacer(Modifier.size(3.dp))
                            Text("${(u.speedKmh ?: 0.0).toInt()} km/h", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (!u.isPhone) {
                                Spacer(Modifier.size(10.dp))
                                LIcon(Ic.Power, tint = if (u.ignition == true) MaterialTheme.colorScheme.brand.success else MaterialTheme.colorScheme.onSurfaceVariant, size = 12.dp)
                                Spacer(Modifier.size(3.dp))
                                Text(when (u.ignition) { true -> "On"; false -> "Off"; null -> "—" }, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Spacer(Modifier.size(10.dp))
                            Text(Formatting.timeAgo(u.lastSeen, now), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
            if (alerts.isNotEmpty()) item {
                HorizontalDivider(Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant)
                Row(Modifier.padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    LIcon(Ic.Bell, tint = MaterialTheme.colorScheme.primary, size = 14.dp)
                    Spacer(Modifier.size(6.dp))
                    Text("Alertas de geocerca", style = MaterialTheme.typography.labelLarge)
                }
            }
            items(alerts.take(8), key = { "${it.deviceId}-${it.geofenceName}-${it.time}-${it.enter}" }) { a ->
                val unit = units.firstOrNull { it.id == a.deviceId }
                Row(Modifier.padding(horizontal = 8.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                    Pill(if (a.enter) "Entrada" else "Salida", if (a.enter) Tone.Success else Tone.Warning)
                    Spacer(Modifier.size(8.dp))
                    Text("${unit?.name ?: "Unidad"} · ${a.geofenceName} · ${Formatting.timeAgo(a.time, now)}", style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

@Composable
private fun Stat(label: String, value: Int, accent: androidx.compose.ui.graphics.Color, modifier: Modifier = Modifier) {
    Column(
        modifier.clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = .6f)).padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value.toString(), style = MaterialTheme.typography.titleLarge, color = accent)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
    }
}
