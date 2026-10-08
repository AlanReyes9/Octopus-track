package com.octopustrack.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.octopustrack.app.ui.components.IconCircleButton
import com.octopustrack.app.data.FleetUnit
import com.octopustrack.app.data.Formatting
import com.octopustrack.app.data.GeofenceDto
import com.octopustrack.app.data.GeofenceEventDto
import com.octopustrack.app.ui.brand.Ic
import com.octopustrack.app.ui.brand.LIcon
import com.octopustrack.app.ui.components.BrandButton
import com.octopustrack.app.ui.components.ButtonKind
import com.octopustrack.app.ui.components.EmptyState
import com.octopustrack.app.ui.components.Pill
import com.octopustrack.app.ui.components.ScreenTitle
import com.octopustrack.app.ui.components.SectionLabel
import com.octopustrack.app.ui.components.SoftCard
import com.octopustrack.app.ui.components.Tone
import com.octopustrack.app.ui.theme.brand
import com.octopustrack.app.ui.theme.parseColor

/** Historial: se elige la unidad y se abre su recorrido. */
@Composable
fun HistoryPickerScreen(units: List<FleetUnit>, loaded: Boolean, canManage: Boolean, onOpen: (FleetUnit) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize()) {
        ScreenTitle("Historial", subtitle = "Elige una unidad para ver su recorrido")
        UnitsScreen(units, loaded, canManage, onOpen, Modifier.weight(1f), showTitle = false)
    }
}

private val GEOFENCE_COLORS = listOf("#f97316", "#7c3aed", "#10b981", "#ef4444", "#0ea5e9", "#eab308", "#ec4899")

/** Geocercas: zonas del mapa y últimas entradas/salidas (la edición de zonas se hace en el panel web). */
@Composable
fun GeofencesScreen(
    geofences: List<GeofenceDto>,
    events: List<GeofenceEventDto>?,
    modifier: Modifier = Modifier,
    today: java.time.LocalDate = java.time.LocalDate.now(),
    canManage: Boolean = false,
    onEdit: (GeofenceDto, String, String) -> Unit = { _, _, _ -> },
    onDelete: (GeofenceDto) -> Unit = {},
) {
    var editing by remember { mutableStateOf<GeofenceDto?>(null) }
    var pendingDelete by remember { mutableStateOf<GeofenceDto?>(null) }
    LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp, start = 20.dp, end = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { ScreenTitle("Geocercas", Modifier.padding(horizontal = 0.dp), subtitle = "${geofences.size} zonas · alertas al entrar o salir") }
        if (geofences.isEmpty()) item { EmptyState(Ic.Shapes, "Sin geocercas", "Crea zonas desde el panel web y aparecerán aquí y en el mapa.") }
        if (canManage) item {
            Text(
                "Para dibujar una nueva zona o cambiar su forma, usa el panel web. Aquí puedes renombrarla, cambiar su color o eliminarla.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 4.dp),
            )
        }
        items(geofences, key = { it.id }) { g ->
            SoftCard(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(36.dp).clip(CircleShape).background(parseColor(g.color).copy(alpha = .18f)), contentAlignment = Alignment.Center) {
                        LIcon(Ic.Shapes, tint = parseColor(g.color), size = 18.dp)
                    }
                    Spacer(Modifier.size(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(g.name, style = MaterialTheme.typography.titleSmall)
                        Text(String.format(java.util.Locale("es"), "%.2f km²", g.areaKm2), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (canManage) {
                        IconCircleButton(Ic.Pencil, { editing = g }, Modifier.size(34.dp), container = MaterialTheme.colorScheme.surfaceVariant)
                        Spacer(Modifier.size(6.dp))
                        IconCircleButton(Ic.Trash, { pendingDelete = g }, Modifier.size(34.dp), tint = MaterialTheme.colorScheme.error, container = MaterialTheme.colorScheme.surfaceVariant)
                    }
                }
            }
        }
        item { SectionLabel("Actividad reciente") }
        if (events.isNullOrEmpty()) item { Text("Aún no hay entradas ni salidas.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(4.dp)) }
        items(events.orEmpty().take(40), key = { it.time + it.unit + it.type + it.geofenceName }) { e ->
            val enter = e.type == "enter"
            SoftCard(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    LIcon(if (enter) Ic.LogIn else Ic.LogOut, tint = parseColor(e.color), size = 18.dp)
                    Spacer(Modifier.size(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text("${e.unit} ${if (enter) "entró en" else "salió de"} ${e.geofenceName}", style = MaterialTheme.typography.titleSmall)
                        Text("${Formatting.dayLabel(e.time, today)} · ${Formatting.clock(e.time)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(Modifier.size(8.dp))
                    Pill(if (enter) "Entrada" else "Salida", if (enter) Tone.Success else Tone.Warning)
                }
            }
        }
    }

    editing?.let { g ->
        var name by remember(g.id) { mutableStateOf(g.name) }
        var color by remember(g.id) { mutableStateOf(g.color) }
        AlertDialog(
            onDismissRequest = { editing = null },
            title = { Text("Editar geocerca") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    OutlinedTextField(name, { name = it }, label = { Text("Nombre") }, singleLine = true)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        GEOFENCE_COLORS.forEach { c ->
                            val selected = c.equals(color, ignoreCase = true)
                            Box(
                                Modifier.size(32.dp).clip(CircleShape).background(parseColor(c))
                                    .border(3.dp, if (selected) Color.Black.copy(alpha = .4f) else Color.Transparent, CircleShape)
                                    .clickable { color = c },
                            )
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { onEdit(g, name.trim(), color); editing = null }, enabled = name.isNotBlank()) { Text("Guardar") } },
            dismissButton = { TextButton(onClick = { editing = null }) { Text("Cancelar") } },
        )
    }

    pendingDelete?.let { g ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("¿Eliminar \"${g.name}\"?") },
            text = { Text("También se borran sus eventos de entrada y salida.") },
            confirmButton = {
                TextButton(onClick = { onDelete(g); pendingDelete = null }) { Text("Eliminar", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("Cancelar") } },
        )
    }
}

private fun deviceEventMeta(type: String): Triple<Int, String, Tone> = when (type) {
    "ignition_on" -> Triple(Ic.Power, "Motor encendido", Tone.Success)
    "ignition_off" -> Triple(Ic.Power, "Motor apagado", Tone.Warning)
    "online" -> Triple(Ic.Wifi, "Conectado", Tone.Success)
    "offline" -> Triple(Ic.WifiOff, "Sin conexión", Tone.Danger)
    "low_battery" -> Triple(Ic.BatteryWarning, "Batería baja", Tone.Warning)
    else -> Triple(Ic.Bell, type, Tone.Neutral)
}

/** Eventos de cambio de estado del equipo: motor, conexión, batería. */
@Composable
fun DeviceEventsScreen(events: List<com.octopustrack.app.data.DeviceEventDto>?, error: String?, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize()) {
        ScreenTitle("Eventos", subtitle = "Encendido, conexión y batería de tus equipos")
        when {
            error != null -> EmptyState(Ic.WifiOff, "No se pudieron cargar", error)
            events == null -> Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(5) { com.octopustrack.app.ui.components.SkeletonBlock(Modifier.fillMaxWidth().height(64.dp)) }
            }
            events.isEmpty() -> EmptyState(Ic.Bell, "Sin eventos", "Aquí aparecerán los cambios de estado de tus equipos.")
            else -> LazyColumn(
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(events, key = { it.time + it.deviceId + it.type }) { e ->
                    val (icon, label, tone) = deviceEventMeta(e.type)
                    SoftCard(Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier.size(36.dp).clip(CircleShape).background(
                                    when (tone) {
                                        Tone.Success -> MaterialTheme.colorScheme.brand.successContainer
                                        Tone.Warning -> MaterialTheme.colorScheme.brand.warningContainer
                                        Tone.Danger -> MaterialTheme.colorScheme.errorContainer
                                        else -> MaterialTheme.colorScheme.surfaceVariant
                                    },
                                ),
                                contentAlignment = Alignment.Center,
                            ) {
                                LIcon(
                                    icon, size = 18.dp,
                                    tint = when (tone) {
                                        Tone.Success -> MaterialTheme.colorScheme.brand.onSuccessContainer
                                        Tone.Warning -> MaterialTheme.colorScheme.brand.onWarningContainer
                                        Tone.Danger -> MaterialTheme.colorScheme.error
                                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                                    },
                                )
                            }
                            Spacer(Modifier.size(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(e.unit, style = MaterialTheme.typography.titleSmall)
                                Text(e.message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Spacer(Modifier.size(8.dp))
                            Column(horizontalAlignment = Alignment.End) {
                                Pill(label, tone)
                                Text(Formatting.timeAgo(e.time), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Secciones de administración que se gestionan en el panel web. */
@Composable
fun WebOnlyScreen(section: Section, description: String, onOpenWeb: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize()) {
        ScreenTitle(section.label)
        EmptyState(
            section.icon, "Se gestiona en el panel web", description,
            action = { BrandButton("Abrir en el navegador", onOpenWeb, kind = ButtonKind.Secondary, icon = Ic.ExternalLink, height = 46.dp) },
        )
    }
}
