package com.octopustrack.app.ui.map

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.octopustrack.app.data.FleetUnit
import com.octopustrack.app.data.HistoryPointDto
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.LineString
import org.maplibre.geojson.Point

/** Recorrido de una unidad: línea morada y un marcador que se mueve con el control deslizante. */
@Composable
fun RouteMap(unit: FleetUnit, points: List<HistoryPointDto>, cursor: Int, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val mapView = remember { MapView(context) }
    var map by remember { mutableStateOf<MapLibreMap?>(null) }
    var style by remember { mutableStateOf<Style?>(null) }
    var fitted by remember(points) { mutableStateOf(false) }

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
            m.uiSettings.isRotateGesturesEnabled = false
            m.uiSettings.isCompassEnabled = false
            m.setStyle(Style.Builder().fromUri(MAP_STYLE_URL)) { s ->
                s.addSource(GeoJsonSource("route", FeatureCollection.fromFeatures(emptyList())))
                s.addLayer(LineLayer("route-casing", "route").withProperties(
                    PropertyFactory.lineColor(0xFFFFFFFF.toInt()), PropertyFactory.lineWidth(8f),
                    PropertyFactory.lineCap("round"), PropertyFactory.lineJoin("round")))
                s.addLayer(LineLayer("route-line", "route").withProperties(
                    PropertyFactory.lineColor(0xFF7C3AED.toInt()), PropertyFactory.lineWidth(5f),
                    PropertyFactory.lineCap("round"), PropertyFactory.lineJoin("round")))
                s.addSource(GeoJsonSource("cursor", FeatureCollection.fromFeatures(emptyList())))
                s.addImage("cursor-img", MarkerImages.marker(context, unit.icon, unit.color, true, false))
                s.addLayer(SymbolLayer("cursor-layer", "cursor").withProperties(
                    PropertyFactory.iconImage("cursor-img"), PropertyFactory.iconAllowOverlap(true), PropertyFactory.iconSize(0.9f)))
                style = s
            }
        }
        onDispose { lifecycle.removeObserver(obs); mapView.onPause(); mapView.onStop(); mapView.onDestroy() }
    }

    LaunchedEffect(style, points) {
        val s = style ?: return@LaunchedEffect
        val coords = points.map { Point.fromLngLat(it.longitude, it.latitude) }
        val fc = if (coords.size >= 2) FeatureCollection.fromFeature(Feature.fromGeometry(LineString.fromLngLats(coords))) else FeatureCollection.fromFeatures(emptyList())
        s.getSourceAs<GeoJsonSource>("route")?.setGeoJson(fc)
        val m = map ?: return@LaunchedEffect
        if (!fitted && points.isNotEmpty()) {
            fitted = true
            val ll = points.map { LatLng(it.latitude, it.longitude) }
            if (ll.size == 1) m.moveCamera(CameraUpdateFactory.newLatLngZoom(ll[0], 15.0))
            else m.moveCamera(CameraUpdateFactory.newLatLngBounds(LatLngBounds.Builder().includes(ll).build(), 100))
        }
    }
    LaunchedEffect(style, cursor, points) {
        val s = style ?: return@LaunchedEffect
        val p = points.getOrNull(cursor)
        s.getSourceAs<GeoJsonSource>("cursor")?.setGeoJson(
            if (p == null) FeatureCollection.fromFeatures(emptyList()) else FeatureCollection.fromFeature(Feature.fromGeometry(Point.fromLngLat(p.longitude, p.latitude))),
        )
    }
    AndroidView(factory = { mapView }, modifier = modifier)
}
