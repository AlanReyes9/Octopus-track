package com.octopustrack.app.ui.map

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.MotionEvent
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.octopustrack.app.data.FleetUnit
import com.octopustrack.app.data.Formatting
import com.octopustrack.app.data.GeofenceDto
import com.octopustrack.app.data.LiveAlert
import com.octopustrack.app.data.LiveMode
import androidx.compose.foundation.clickable
import androidx.compose.ui.draw.clip
import com.octopustrack.app.ui.home.LivePanel
import com.octopustrack.app.data.UnitStatus
import com.octopustrack.app.ui.brand.Ic
import com.octopustrack.app.ui.components.BrandButton
import com.octopustrack.app.ui.components.ButtonKind
import com.octopustrack.app.ui.components.IconCircleButton
import com.octopustrack.app.ui.components.MetricTile
import com.octopustrack.app.ui.components.Pill
import com.octopustrack.app.ui.components.SoftCard
import com.octopustrack.app.ui.components.Tone
import com.octopustrack.app.ui.components.UnitAvatar
import com.octopustrack.app.ui.components.tone
import java.time.Instant
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.FillLayer
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.Point

const val MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron"

private const val SRC_UNITS = "units"
private const val SRC_GEOFENCES = "geofences"
private const val LAYER_ARROWS = "unit-arrows"
private const val LAYER_UNITS = "unit-markers"

/** Abre la navegación hacia la unidad en Google Maps (o cualquier app de mapas instalada). */
fun navigateTo(context: Context, u: FleetUnit) {
    val lat = u.latitude ?: return
    val lng = u.longitude ?: return
    val nav = Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=$lat,$lng")).setPackage("com.google.android.apps.maps")
    val geo = Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$lat,$lng(${Uri.encode(u.name)})"))
    val web = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$lat,$lng"))
    for (i in listOf(nav, geo, web)) {
        try { context.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return } catch (_: Exception) { }
    }
}

/** Mapa en vivo: panel de unidades (como en la web) arriba y mapa debajo; al elegir una unidad el mapa ocupa todo. */
@Composable
fun LiveScreen(
    units: List<FleetUnit>,
    alerts: List<LiveAlert>,
    geofences: List<GeofenceDto>,
    mode: LiveMode,
    loaded: Boolean,
    selectedId: String?,
    onSelect: (String?) -> Unit,
    canManage: Boolean,
    onHistory: (FleetUnit) -> Unit,
    onCommands: (FleetUnit) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var follow by remember { mutableStateOf(true) }
    var query by remember { mutableStateOf("") }
    val selected = units.firstOrNull { it.id == selectedId }
    Column(modifier.fillMaxSize()) {
        androidx.compose.animation.AnimatedVisibility(selected == null, Modifier.weight(0.46f, fill = true)) {
            LivePanel(units, alerts, mode, loaded, canManage, query, { query = it }, selectedId) { onSelect(it); follow = true }
        }
        Box(Modifier.weight(if (selected == null) 0.54f else 1f, fill = true).fillMaxWidth()) {
            FleetMap(units, geofences, selectedId, follow, { onSelect(it); if (it != null) follow = true }, onUserGesture = { follow = false }, Modifier.fillMaxSize())
            if (selected != null) {
                UnitSheet(
                    selected, follow,
                    onClose = { onSelect(null) },
                    onFollow = { follow = !follow },
                    onOpenMaps = { openInMaps(context, selected) },
                    onNavigate = { navigateTo(context, selected) },
                    onHistory = { onHistory(selected) },
                    onCommands = { onCommands(selected) },
                    modifier = Modifier.align(Alignment.BottomCenter).padding(12.dp),
                )
            }
        }
    }
}

fun openInMaps(context: Context, u: FleetUnit) {
    val lat = u.latitude ?: return
    val lng = u.longitude ?: return
    val geo = Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$lat,$lng(${Uri.encode(u.name)})"))
    val web = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=$lat,$lng"))
    for (i in listOf(geo, web)) { try { context.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return } catch (_: Exception) { } }
}

/** Ficha de la unidad seleccionada: mismos datos y acciones que la web. */
@Composable
fun UnitSheet(
    u: FleetUnit,
    follow: Boolean,
    onClose: () -> Unit,
    onFollow: () -> Unit,
    onOpenMaps: () -> Unit,
    onNavigate: () -> Unit,
    onHistory: () -> Unit,
    onCommands: () -> Unit,
    modifier: Modifier = Modifier,
    now: Instant = Instant.now(),
) {
    val status = u.status(now)
    SoftCard(modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), elevation = 10.dp) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                UnitAvatar(u.icon, u.color, size = 40.dp)
                Spacer(Modifier.size(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(u.name, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(u.plate ?: u.imei, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                }
                Pill(if (u.isOnline(now)) "En línea" else "Sin señal", if (u.isOnline(now)) Tone.Success else Tone.Neutral)
                Spacer(Modifier.size(4.dp))
                androidx.compose.foundation.layout.Box(
                    Modifier.size(32.dp).clip(androidx.compose.foundation.shape.CircleShape).clickable(onClick = onClose),
                    contentAlignment = Alignment.Center,
                ) { com.octopustrack.app.ui.brand.LIcon(Ic.Close, tint = MaterialTheme.colorScheme.onSurfaceVariant, size = 16.dp) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MetricTile(Ic.Gauge, "Velocidad", Formatting.speed(u.speedKmh), Modifier.weight(1f))
                if (u.isPhone) MetricTile(Ic.Battery, "Batería", u.battery?.let { "$it%" } ?: "—", Modifier.weight(1f))
                else MetricTile(Ic.Power, "Motor", when (u.ignition) { true -> "Encendido"; false -> "Apagado"; null -> "—" }, Modifier.weight(1f))
                MetricTile(Ic.Clock, "Reporte", Formatting.timeAgo(u.lastSeen, now).removePrefix("hace "), Modifier.weight(1f))
            }
            if (u.hasPosition) Text(
                Formatting.coords(u.latitude!!, u.longitude!!), Modifier.fillMaxWidth(), textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                style = MaterialTheme.typography.labelSmall.copy(fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BrandButton(if (follow) "Siguiendo" else "Seguir", onFollow, Modifier.weight(1f), kind = if (follow) ButtonKind.Primary else ButtonKind.Outline, icon = Ic.Crosshair, height = 42.dp)
                BrandButton("Historial", onHistory, Modifier.weight(1f), kind = ButtonKind.Outline, icon = Ic.History, height = 42.dp)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BrandButton("Google Maps", onOpenMaps, Modifier.weight(1f), kind = ButtonKind.Outline, icon = Ic.ExternalLink, enabled = u.hasPosition, height = 42.dp)
                BrandButton("Cómo llegar", onNavigate, Modifier.weight(1f), kind = ButtonKind.Outline, icon = Ic.Navigation, enabled = u.hasPosition, height = 42.dp)
            }
            BrandButton("Enviar comando", onCommands, Modifier.fillMaxWidth(), kind = ButtonKind.Secondary, icon = Ic.Send, height = 42.dp)
        }
    }
}

@Composable
private fun FleetMap(
    units: List<FleetUnit>,
    geofences: List<GeofenceDto>,
    selectedId: String?,
    follow: Boolean,
    onSelect: (String?) -> Unit,
    onUserGesture: () -> Unit,
    modifier: Modifier,
) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val mapView = remember { MapView(context) }
    var map by remember { mutableStateOf<MapLibreMap?>(null) }
    var style by remember { mutableStateOf<Style?>(null) }
    var fitted by remember { mutableStateOf(false) }
    // Qué iconos ya se registraron en el estilo: no depender de Style.getImage()
    // (su caché interna no siempre refleja lo añadido en tiempo de ejecución).
    val knownImages = remember { mutableSetOf<String>() }
    val currentOnSelect by rememberUpdatedStateCompat(onSelect)
    val currentOnGesture by rememberUpdatedStateCompat(onUserGesture)

    DisposableEffect(lifecycle, mapView) {
        val obs = LifecycleEventObserver { _, e ->
            when (e) {
                Lifecycle.Event.ON_START -> mapView.onStart()
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                Lifecycle.Event.ON_STOP -> mapView.onStop()
                else -> {}
            }
        }
        lifecycle.addObserver(obs)
        mapView.onCreate(null)
        if (lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) mapView.onStart()
        if (lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) mapView.onResume()
        mapView.getMapAsync { m ->
            map = m
            m.uiSettings.isLogoEnabled = false
            m.uiSettings.isAttributionEnabled = true
            m.uiSettings.isRotateGesturesEnabled = false
            m.uiSettings.isCompassEnabled = false
            m.setStyle(Style.Builder().fromUri(MAP_STYLE_URL)) { s ->
                s.addSource(GeoJsonSource(SRC_GEOFENCES, FeatureCollection.fromFeatures(emptyList())))
                s.addLayer(FillLayer("geofence-fill", SRC_GEOFENCES).withProperties(
                    PropertyFactory.fillColor(Expression.get("color")), PropertyFactory.fillOpacity(0.15f)))
                s.addLayer(LineLayer("geofence-line", SRC_GEOFENCES).withProperties(
                    PropertyFactory.lineColor(Expression.get("color")), PropertyFactory.lineWidth(2f)))
                s.addImage(MarkerImages.ARROW_ID, MarkerImages.arrow())
                s.addSource(GeoJsonSource(SRC_UNITS, FeatureCollection.fromFeatures(emptyList())))
                s.addLayer(SymbolLayer(LAYER_ARROWS, SRC_UNITS).withProperties(
                    PropertyFactory.iconImage(MarkerImages.ARROW_ID),
                    PropertyFactory.iconRotate(Expression.get("course")),
                    PropertyFactory.iconRotationAlignment("map"),
                    PropertyFactory.iconAllowOverlap(true), PropertyFactory.iconIgnorePlacement(true),
                    PropertyFactory.iconSize(0.9f),
                ).withFilter(Expression.get("moving")))
                s.addLayer(SymbolLayer(LAYER_UNITS, SRC_UNITS).withProperties(
                    PropertyFactory.iconImage(Expression.get("img")),
                    PropertyFactory.iconAllowOverlap(true), PropertyFactory.iconIgnorePlacement(true),
                    PropertyFactory.iconSize(0.9f),
                    PropertyFactory.textField(Expression.get("label")),
                    PropertyFactory.textOffset(arrayOf(0f, 2.1f)),
                    PropertyFactory.textSize(11f),
                    PropertyFactory.textColor(0xFF1F1535.toInt()),
                    PropertyFactory.textHaloColor(0xFFFFFFFF.toInt()),
                    PropertyFactory.textHaloWidth(1.6f),
                    PropertyFactory.textOptional(true),
                ))
                knownImages.clear()
                style = s
            }
            m.addOnMapClickListener { ll ->
                val px = m.projection.toScreenLocation(ll)
                val hit = m.queryRenderedFeatures(px, LAYER_UNITS).firstOrNull()?.getStringProperty("id")
                currentOnSelect(hit)
                hit != null
            }
            m.addOnCameraMoveStartedListener { reason ->
                if (reason == MapLibreMap.OnCameraMoveStartedListener.REASON_API_GESTURE) currentOnGesture()
            }
        }
        onDispose {
            lifecycle.removeObserver(obs)
            mapView.onPause(); mapView.onStop(); mapView.onDestroy()
        }
    }

    // Datos → capas
    LaunchedEffect(style, units, selectedId) {
        val s = style ?: return@LaunchedEffect
        val now = Instant.now()
        val feats = units.filter { it.hasPosition }.map { u ->
            val st = u.status(now)
            val offline = st == UnitStatus.Offline
            val sel = u.id == selectedId
            val imgId = MarkerImages.markerId(u.icon, if (offline) "off" else u.color, sel)
            if (knownImages.add(imgId)) s.addImage(imgId, MarkerImages.marker(context, u.icon, u.color, sel, offline))
            Feature.fromGeometry(Point.fromLngLat(u.longitude!!, u.latitude!!)).also {
                it.addStringProperty("id", u.id)
                it.addStringProperty("img", imgId)
                it.addStringProperty("label", u.name)
                it.addNumberProperty("course", u.course ?: 0.0)
                it.addBooleanProperty("moving", st == UnitStatus.Moving && u.course != null)
            }
        }
        s.getSourceAs<GeoJsonSource>(SRC_UNITS)?.setGeoJson(FeatureCollection.fromFeatures(feats))
        val m = map ?: return@LaunchedEffect
        if (!fitted && feats.isNotEmpty()) {
            fitted = true
            val pts = units.filter { it.hasPosition }.map { LatLng(it.latitude!!, it.longitude!!) }
            if (pts.size == 1) m.moveCamera(CameraUpdateFactory.newLatLngZoom(pts[0], 14.0))
            else m.moveCamera(CameraUpdateFactory.newLatLngBounds(LatLngBounds.Builder().includes(pts).build(), 120))
        }
    }

    LaunchedEffect(style, geofences) {
        val s = style ?: return@LaunchedEffect
        val feats = geofences.mapNotNull { g ->
            val ring = g.geometry.coordinates.firstOrNull() ?: return@mapNotNull null
            val poly = org.maplibre.geojson.Polygon.fromLngLats(listOf(ring.map { Point.fromLngLat(it[0], it[1]) }))
            Feature.fromGeometry(poly).also { it.addStringProperty("color", g.color) }
        }
        s.getSourceAs<GeoJsonSource>(SRC_GEOFENCES)?.setGeoJson(FeatureCollection.fromFeatures(feats))
    }

    // Seguir / centrar en la unidad seleccionada
    val sel = units.firstOrNull { it.id == selectedId }
    LaunchedEffect(selectedId) {
        val m = map ?: return@LaunchedEffect
        val u = units.firstOrNull { it.id == selectedId } ?: return@LaunchedEffect
        if (u.hasPosition) m.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(u.latitude!!, u.longitude!!), maxOf(m.cameraPosition.zoom, 15.0)))
    }
    LaunchedEffect(follow, sel?.latitude, sel?.longitude) {
        val m = map ?: return@LaunchedEffect
        if (follow && sel != null && sel.hasPosition) {
            m.animateCamera(CameraUpdateFactory.newCameraPosition(CameraPosition.Builder().target(LatLng(sel.latitude!!, sel.longitude!!)).zoom(maxOf(m.cameraPosition.zoom, 15.5)).build()), 600)
        }
    }

    AndroidView(factory = { mapView }, modifier = modifier)
}

@Composable
private fun <T> rememberUpdatedStateCompat(v: T) = androidx.compose.runtime.rememberUpdatedState(v)
