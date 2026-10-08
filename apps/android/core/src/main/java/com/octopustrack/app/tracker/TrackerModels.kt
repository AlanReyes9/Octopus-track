package com.octopustrack.app.tracker

import kotlinx.serialization.Serializable
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/** Cuerpo de POST /api/ingest/phone (mismo formato que usa la página web del teléfono). */
@Serializable
data class PositionPayload(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Double,
    val altitude: Double? = null,
    /** metros por segundo */
    val speed: Double? = null,
    val heading: Double? = null,
    /** milisegundos desde epoch */
    val timestamp: Long,
    /** 0.0 – 1.0 */
    val battery: Double? = null,
)

data class TrackerStatus(
    /** El servicio está en marcha. */
    val running: Boolean = false,
    val paused: Boolean = false,
    val lastSentIso: String? = null,
    val accuracyM: Int? = null,
    val sentCount: Int = 0,
    val pending: Int = 0,
    /** Se perdió la conexión o el servidor no responde (los datos se guardan y se reenvían). */
    val offline: Boolean = false,
    /** Mensaje de la empresa recibido desde el panel. */
    val companyMessage: String? = null,
    /** El enlace dejó de ser válido o la empresa/persona revocó el consentimiento. */
    val revoked: Boolean = false,
    /** GPS desactivado o sin permiso. */
    val locationProblem: String? = null,
)

/** Política de envío: equilibra precisión y batería (igual que la página web del teléfono). */
class SendPolicy(
    private val minIntervalMs: Long = 10_000,
    private val minDistanceM: Double = 25.0,
    private val heartbeatMs: Long = 60_000,
) {
    data class Sent(val latitude: Double, val longitude: Double, val atMs: Long)

    /** ¿Debe enviarse esta posición? Cambios de lugar cada ≥10 s y latido cada 60 s si no se mueve. */
    fun shouldSend(last: Sent?, latitude: Double, longitude: Double, nowMs: Long): Boolean {
        if (last == null) return true
        val elapsed = nowMs - last.atMs
        if (elapsed < minIntervalMs) return false
        if (elapsed >= heartbeatMs) return true
        return haversineMeters(last.latitude, last.longitude, latitude, longitude) >= minDistanceM
    }

    /** ¿Toca reenviar la última posición conocida porque el teléfono está quieto? */
    fun heartbeatDue(last: Sent?, nowMs: Long) = last != null && nowMs - last.atMs >= heartbeatMs
}

fun haversineMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val r = 6_371_008.8
    val dLat = Math.toRadians(lat2 - lat1)
    val dLon = Math.toRadians(lon2 - lon1)
    val h = sin(dLat / 2) * sin(dLat / 2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2) * sin(dLon / 2)
    return 2 * r * asin(minOf(1.0, sqrt(h)))
}
