package com.octopustrack.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.ui.draw.clip
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.octopustrack.app.data.FleetUnit
import com.octopustrack.app.data.Formatting
import com.octopustrack.app.data.GeofenceEventDto
import com.octopustrack.app.data.UnitStatus
import com.octopustrack.app.ui.brand.Ic
import com.octopustrack.app.ui.brand.LIcon
import com.octopustrack.app.ui.components.Chip
import com.octopustrack.app.ui.components.EmptyState
import com.octopustrack.app.ui.components.Pill
import com.octopustrack.app.ui.components.ScreenTitle
import com.octopustrack.app.ui.components.SkeletonBlock
import com.octopustrack.app.ui.components.SoftCard
import com.octopustrack.app.ui.components.UnitAvatar
import com.octopustrack.app.ui.components.Tone
import com.octopustrack.app.ui.components.tone
import com.octopustrack.app.ui.theme.parseColor
import java.time.Instant

enum class UnitFilter(val label: String) { All("Todas"), Moving("En marcha"), Idle("Detenidas"), Offline("Sin señal") }

fun matches(u: FleetUnit, f: UnitFilter, now: Instant = Instant.now()): Boolean = when (f) {
    UnitFilter.All -> true
    UnitFilter.Moving -> u.status(now) == UnitStatus.Moving
    UnitFilter.Idle -> u.status(now) == UnitStatus.Idle
    UnitFilter.Offline -> u.status(now).let { it == UnitStatus.Offline || it == UnitStatus.NoData }
}

@Composable
fun UnitRow(u: FleetUnit, onClick: () -> Unit, modifier: Modifier = Modifier, now: Instant = Instant.now()) {
    val status = u.status(now)
    SoftCard(modifier.fillMaxWidth(), onClick = onClick) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            UnitAvatar(u.icon, u.color, status = status)
            Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Text(u.name, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val sub = listOfNotNull(u.plate, if (u.isPhone) "Teléfono" else null).joinToString(" · ")
                if (sub.isNotEmpty()) Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    LIcon(Ic.Clock, tint = MaterialTheme.colorScheme.onSurfaceVariant, size = 12.dp)
                    Spacer(Modifier.size(4.dp))
                    Text(Formatting.timeAgo(u.lastSeen, now), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (u.battery != null) {
                        Spacer(Modifier.size(10.dp))
                        LIcon(Ic.Battery, tint = MaterialTheme.colorScheme.onSurfaceVariant, size = 12.dp)
                        Spacer(Modifier.size(2.dp))
                        Text("${u.battery}%", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Pill(status.label, status.tone())
                if (status == UnitStatus.Moving) {
                    Spacer(Modifier.height(4.dp))
                    Text(Formatting.speed(u.speedKmh), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}

@Composable
fun UnitsScreen(
    units: List<FleetUnit>,
    loaded: Boolean,
    canManage: Boolean,
    onOpen: (FleetUnit) -> Unit,
    modifier: Modifier = Modifier,
    now: Instant = Instant.now(),
    initialQuery: String = "",
    initialFilter: UnitFilter = UnitFilter.All,
    showTitle: Boolean = true,
) {
    var query by remember { mutableStateOf(initialQuery) }
    var filter by remember { mutableStateOf(initialFilter) }
    val visible = units.filter {
        matches(it, filter, now) && (query.isBlank() || it.name.contains(query, true) || (it.plate?.contains(query, true) ?: false))
    }
    Column(modifier.fillMaxSize()) {
        if (showTitle) ScreenTitle("Unidades", subtitle = if (loaded) "${units.size} en total · ${units.count { it.isOnline(now) }} con señal" else null)
        OutlinedTextField(
            query, { query = it }, Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            placeholder = { Text("Buscar por nombre o placa") }, singleLine = true,
            leadingIcon = { LIcon(Ic.Search, size = 18.dp) }, shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant,
            ),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        )
        LazyRow(contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(UnitFilter.entries) { f ->
                Chip(f.label, selected = filter == f, onClick = { filter = f }, count = units.count { matches(it, f, now) })
            }
        }
        when {
            !loaded -> Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(5) { SkeletonBlock(Modifier.fillMaxWidth().height(76.dp), RoundedCornerShape(20.dp)) }
            }
            units.isEmpty() -> EmptyState(
                Ic.MapPin, "Aún no hay unidades",
                if (canManage) "Registra un equipo desde el panel web y aparecerá aquí." else "Tu administrador todavía no te ha asignado unidades.",
            )
            visible.isEmpty() -> EmptyState(Ic.Search, "Sin resultados", "Prueba con otro nombre o cambia el filtro.")
            else -> LazyColumn(
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) { items(visible, key = { it.id }) { UnitRow(it, { onOpen(it) }, now = now) } }
        }
    }
}

@Composable
fun AlertsScreen(events: List<GeofenceEventDto>?, error: String?, modifier: Modifier = Modifier, today: java.time.LocalDate = java.time.LocalDate.now()) {
    Column(modifier.fillMaxSize()) {
        ScreenTitle("Alertas", subtitle = "Entradas y salidas de geocercas")
        when {
            events == null && error == null -> Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(5) { SkeletonBlock(Modifier.fillMaxWidth().height(64.dp), RoundedCornerShape(20.dp)) }
            }
            error != null -> EmptyState(Ic.WifiOff, "No se pudieron cargar", error)
            events.isNullOrEmpty() -> EmptyState(Ic.BellRing, "Todo tranquilo", "Cuando una unidad entre o salga de una geocerca, lo verás aquí.")
            else -> {
                val groups = events.groupBy { Formatting.dayLabel(it.time, today) }
                LazyColumn(
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    groups.forEach { (day, list) ->
                        item(key = "h-$day") { Text(day, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 10.dp, start = 4.dp)) }
                        items(list, key = { it.time + it.unit + it.type + it.geofenceName }) { e ->
                            val enter = e.type == "enter"
                            SoftCard(Modifier.fillMaxWidth()) {
                                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        Modifier.size(40.dp).androidx_clipCircle().androidx_bg(parseColor(e.color).copy(alpha = .15f)),
                                        contentAlignment = Alignment.Center,
                                    ) { LIcon(if (enter) Ic.LogIn else Ic.LogOut, tint = parseColor(e.color), size = 20.dp) }
                                    Spacer(Modifier.size(12.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text("${e.unit} ${if (enter) "entró en" else "salió de"} ${e.geofenceName}", style = MaterialTheme.typography.titleSmall)
                                        Text(Formatting.clockSeconds(e.time), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    Spacer(Modifier.size(8.dp))
                                    Pill(if (enter) "Entrada" else "Salida", if (enter) Tone.Success else Tone.Warning)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun Modifier.androidx_clipCircle(): Modifier = this.then(Modifier.clip(androidx.compose.foundation.shape.CircleShape))
private fun Modifier.androidx_bg(c: androidx.compose.ui.graphics.Color): Modifier = this.then(Modifier.background(c))
