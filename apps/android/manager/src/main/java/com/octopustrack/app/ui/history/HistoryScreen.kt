package com.octopustrack.app.ui.history

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import com.octopustrack.app.data.ApiException
import com.octopustrack.app.data.FleetRepository
import com.octopustrack.app.data.FleetUnit
import com.octopustrack.app.data.Formatting
import com.octopustrack.app.data.HistoryPointDto
import com.octopustrack.app.data.HistoryResponse
import com.octopustrack.app.data.StopDto
import com.octopustrack.app.data.StopsReportDto
import com.octopustrack.app.ui.brand.Ic
import com.octopustrack.app.ui.brand.LIcon
import com.octopustrack.app.ui.components.BrandButton
import com.octopustrack.app.ui.components.ButtonKind
import com.octopustrack.app.ui.components.Chip
import com.octopustrack.app.ui.components.EmptyState
import com.octopustrack.app.ui.components.IconCircleButton
import com.octopustrack.app.ui.components.MetricTile
import com.octopustrack.app.ui.components.SoftCard
import com.octopustrack.app.ui.components.UnitAvatar
import com.octopustrack.app.ui.map.RouteMap
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId

enum class HistoryRange(val label: String) { Today("Hoy"), Yesterday("Ayer"), Week("7 días") }

fun HistoryRange.bounds(zone: ZoneId = ZoneId.systemDefault(), today: LocalDate = LocalDate.now(zone)): Pair<String, String> {
    val (from, to) = when (this) {
        HistoryRange.Today -> today to today.plusDays(1)
        HistoryRange.Yesterday -> today.minusDays(1) to today
        HistoryRange.Week -> today.minusDays(6) to today.plusDays(1)
    }
    return from.atStartOfDay(zone).toInstant().toString() to to.atStartOfDay(zone).toInstant().toString()
}

sealed interface HistoryState {
    data object Loading : HistoryState
    data class Error(val message: String) : HistoryState
    data class Ready(val data: HistoryResponse) : HistoryState
}

sealed interface StopsState {
    data object Loading : StopsState
    data class Error(val message: String) : StopsState
    data class Ready(val data: StopsReportDto) : StopsState
}

enum class HistoryTab(val label: String) { Route("Recorrido"), Stops("Paradas") }

/** Pantalla con estado: carga el recorrido o las paradas del servidor según la pestaña. */
@Composable
fun HistoryRoute(unit: FleetUnit, fleet: FleetRepository, onBack: () -> Unit) {
    var tab by remember { mutableStateOf(HistoryTab.Route) }
    var range by remember { mutableStateOf(HistoryRange.Today) }
    var state by remember { mutableStateOf<HistoryState>(HistoryState.Loading) }
    var stopsState by remember { mutableStateOf<StopsState>(StopsState.Loading) }
    var reload by remember { mutableIntStateOf(0) }
    LaunchedEffect(range, reload) {
        state = HistoryState.Loading
        val (from, to) = range.bounds()
        state = try { HistoryState.Ready(fleet.history(unit.id, from, to)) }
        catch (e: ApiException) { HistoryState.Error(e.message ?: "No se pudo cargar el historial") }
    }
    LaunchedEffect(range, reload) {
        stopsState = StopsState.Loading
        val (from, to) = range.bounds()
        stopsState = try { StopsState.Ready(fleet.stops(unit.id, from, to)) }
        catch (e: ApiException) { StopsState.Error(e.message ?: "No se pudieron cargar las paradas") }
    }
    HistoryContent(unit, tab, { tab = it }, range, { range = it }, state, stopsState, onBack, { reload++ }) { points, cursor, m ->
        RouteMap(unit, points, cursor, m)
    }
}

@Composable
fun HistoryContent(
    unit: FleetUnit,
    tab: HistoryTab,
    onTab: (HistoryTab) -> Unit,
    range: HistoryRange,
    onRange: (HistoryRange) -> Unit,
    state: HistoryState,
    stopsState: StopsState,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    map: @Composable (points: List<HistoryPointDto>, cursor: Int, modifier: Modifier) -> Unit,
) {
    val points = (state as? HistoryState.Ready)?.data?.points.orEmpty()
    var cursor by remember(points) { mutableIntStateOf(points.lastIndex.coerceAtLeast(0)) }
    var playing by remember(points) { mutableStateOf(false) }
    LaunchedEffect(playing, points) {
        while (playing && points.isNotEmpty()) {
            delay(120)
            if (cursor >= points.lastIndex) { playing = false; break }
            cursor += 1
        }
    }
    Box(modifier.fillMaxSize()) {
        map(points, cursor, Modifier.fillMaxSize())
        Column(Modifier.statusBarsPadding().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SoftCard(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), elevation = 6.dp) {
                Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconCircleButton(Ic.ArrowLeft, onBack, Modifier.size(40.dp), container = MaterialTheme.colorScheme.surfaceVariant)
                    Spacer(Modifier.size(10.dp))
                    UnitAvatar(unit.icon, unit.color, size = 36.dp)
                    Spacer(Modifier.size(10.dp))
                    Column {
                        Text(unit.name, style = MaterialTheme.typography.titleSmall, maxLines = 1)
                        Text("Historial de recorrido", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HistoryRange.entries.forEach { r -> Chip(r.label, r == range, { onRange(r) }) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HistoryTab.entries.forEach { t -> Chip(t.label, t == tab, { onTab(t) }) }
            }
        }
        Box(Modifier.align(Alignment.BottomCenter).padding(12.dp).navigationBarsPadding()) {
            SoftCard(Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), elevation = 10.dp) {
                if (tab == HistoryTab.Stops) { StopsPanel(stopsState, onRetry); return@SoftCard }
                when (state) {
                    HistoryState.Loading -> Text("Cargando recorrido…", Modifier.padding(24.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    is HistoryState.Error -> Column(Modifier.padding(8.dp)) {
                        EmptyState(Ic.WifiOff, "No se pudo cargar", state.message) {
                            com.octopustrack.app.ui.components.BrandButton("Reintentar", onRetry, icon = Ic.Refresh, height = 44.dp)
                        }
                    }
                    is HistoryState.Ready -> if (points.isEmpty()) {
                        EmptyState(Ic.Route, "Sin recorrido", "No hay posiciones guardadas en este periodo.")
                    } else {
                        val s = state.data.summary
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                MetricTile(Ic.Route, "Distancia", Formatting.km(s.distanceKm), Modifier.weight(1f))
                                MetricTile(Ic.Gauge, "Máxima", Formatting.speed(s.maxSpeedKmh), Modifier.weight(1f))
                                MetricTile(Ic.Activity, "Media", Formatting.speed(s.avgSpeedKmh), Modifier.weight(1f))
                            }
                            val p = points.getOrNull(cursor)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconCircleButton(if (playing) Ic.Pause else Ic.Play, {
                                    if (!playing && cursor >= points.lastIndex) cursor = 0
                                    playing = !playing
                                }, Modifier.size(40.dp), container = MaterialTheme.colorScheme.primaryContainer, tint = MaterialTheme.colorScheme.primary)
                                Spacer(Modifier.size(10.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(Formatting.dateTime(p?.time), style = MaterialTheme.typography.titleSmall)
                                    Text(Formatting.speed(p?.speedKmh), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            Slider(
                                value = cursor.toFloat(), onValueChange = { cursor = it.toInt(); playing = false },
                                valueRange = 0f..points.lastIndex.toFloat().coerceAtLeast(1f),
                                colors = SliderDefaults.colors(thumbColor = MaterialTheme.colorScheme.primary, activeTrackColor = MaterialTheme.colorScheme.primary),
                            )
                            if (state.data.sampled) Text(
                                "Mostrando ${points.size} de ${state.data.totalPoints} puntos para que el mapa sea fluido.",
                                style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StopsPanel(stopsState: StopsState, onRetry: () -> Unit) {
    when (stopsState) {
        StopsState.Loading -> Text("Cargando paradas…", Modifier.padding(24.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        is StopsState.Error -> Column(Modifier.padding(8.dp)) {
            EmptyState(Ic.WifiOff, "No se pudo cargar", stopsState.message) {
                BrandButton("Reintentar", onRetry, icon = Ic.Refresh, height = 44.dp)
            }
        }
        is StopsState.Ready -> {
            val data = stopsState.data
            if (data.stops.isEmpty()) {
                EmptyState(Ic.Route, "Sin paradas", "No se detectaron paradas en este periodo.")
            } else {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        MetricTile(Ic.Route, "Paradas", "${data.totalStops}", Modifier.weight(1f))
                        MetricTile(Ic.Gauge, "Tiempo parado", Formatting.duration(data.totalStoppedSeconds), Modifier.weight(1f))
                    }
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.height(260.dp)) {
                        itemsIndexed(data.stops) { index, stop -> StopRow(index + 1, stop) }
                    }
                }
            }
        }
    }
}

@Composable
private fun StopRow(index: Int, stop: StopDto) {
    val context = androidx.compose.ui.platform.LocalContext.current
    Row(
        Modifier
            .fillMaxWidth()
            .clickable {
                val uri = android.net.Uri.parse("geo:${stop.latitude},${stop.longitude}?q=${stop.latitude},${stop.longitude}")
                runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, uri)) }
            }
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(28.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) {
            Text("$index", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
        }
        Spacer(Modifier.size(10.dp))
        Column(Modifier.weight(1f)) {
            Text("Parada $index", style = MaterialTheme.typography.titleSmall)
            Text(
                "${Formatting.dateTime(stop.start)} – ${Formatting.dateTime(stop.end)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(Formatting.duration(stop.durationSeconds), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.size(8.dp))
        LIcon(Ic.ArrowLeft, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
