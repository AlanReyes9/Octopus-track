package com.octopustrack.app.tracker

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Looper
import androidx.core.content.ContextCompat

/**
 * Ubicación con el LocationManager del sistema (sin Google Play Services):
 * GPS como fuente principal y red (Wi-Fi/antenas) como respaldo en interiores.
 */
class LocationEngine(context: Context, private val onFix: (Location) -> Unit) {
    private val appContext = context.applicationContext
    private val manager = appContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private var active = false

    private val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            if (acceptable(location)) onFix(location)
        }
        @Deprecated("Obsoleto en la API 29") override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }

    val gpsEnabled: Boolean get() = manager.isProviderEnabled(LocationManager.GPS_PROVIDER)
    val anyProviderEnabled: Boolean
        get() = gpsEnabled || manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

    /** @return false si falta el permiso o no hay ningún proveedor activo. */
    @SuppressLint("MissingPermission")
    fun start(): Boolean {
        if (active) return true
        if (!Permissions.hasFineLocation(appContext)) return false
        var ok = false
        runCatching {
            if (manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 5_000L, 5f, listener, Looper.getMainLooper())
                ok = true
            }
            if (manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 30_000L, 25f, listener, Looper.getMainLooper())
                ok = true
            }
        }
        active = ok
        return ok
    }

    fun stop() {
        if (!active) return
        runCatching { manager.removeUpdates(listener) }
        active = false
    }

    /** Mejor posición conocida (la más reciente entre GPS y red). */
    @SuppressLint("MissingPermission")
    fun lastKnown(): Location? {
        if (!Permissions.hasFineLocation(appContext)) return null
        return listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)
            .mapNotNull { p -> runCatching { manager.getLastKnownLocation(p) }.getOrNull() }
            .maxByOrNull { it.time }
    }

    /** Solicita una posición nueva ya (p. ej. cuando el panel pide "Solicitar posición"). */
    @SuppressLint("MissingPermission")
    fun requestSingle(callback: (Location?) -> Unit) {
        if (!Permissions.hasFineLocation(appContext)) return callback(null)
        val provider = when {
            manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> return callback(null)
        }
        runCatching {
            if (Build.VERSION.SDK_INT >= 30) {
                manager.getCurrentLocation(provider, null, ContextCompat.getMainExecutor(appContext)) { callback(it) }
            } else {
                @Suppress("DEPRECATION")
                manager.requestSingleUpdate(provider, object : LocationListener {
                    override fun onLocationChanged(location: Location) = callback(location)
                    @Deprecated("Obsoleto en la API 29") override fun onStatusChanged(p: String?, s: Int, e: android.os.Bundle?) {}
                    override fun onProviderEnabled(p: String) {}
                    override fun onProviderDisabled(p: String) = callback(null)
                }, Looper.getMainLooper())
            }
        }.onFailure { callback(null) }
    }

    private fun acceptable(l: Location): Boolean {
        if (l.latitude == 0.0 && l.longitude == 0.0) return false
        val limit = if (l.provider == LocationManager.NETWORK_PROVIDER) 600f else 200f
        return !l.hasAccuracy() || l.accuracy <= limit
    }
}
