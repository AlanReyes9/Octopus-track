package com.octopustrack.app.ui.home

import androidx.compose.foundation.background
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
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
import com.octopustrack.app.ui.theme.parseColor

/** Historial: se elige la unidad y se abre su recorrido. */
@Composable
fun HistoryPickerScreen(units: List<FleetUnit>, loaded: Boolean, canManage: Boolean, onOpen: (FleetUnit) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize()) {
        ScreenTitle("Historial", subtitle = "Elige una unidad para ver su recorrido")
        UnitsScreen(units, loaded, canManage, onOpen, Modifier.weight(1f), showTitle = false)
    }
}

/** Geocercas: zonas del mapa y últimas entradas/salidas (la edición de zonas se hace en el panel web). */
@Composable
fun GeofencesScreen(
    geofences: List<GeofenceDto>,
    events: List<GeofenceEventDto>?,
    modifier: Modifier = Modifier,
    today: java.time.LocalDate = java.time.LocalDate.now(),
) {
    LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp, start = 20.dp, end = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { ScreenTitle("Geocercas", Modifier.padding(horizontal = 0.dp), subtitle = "${geofences.size} zonas · alertas al entrar o salir") }
        if (geofences.isEmpty()) item { EmptyState(Ic.Shapes, "Sin geocercas", "Crea zonas desde el panel web y aparecerán aquí y en el mapa.") }
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
