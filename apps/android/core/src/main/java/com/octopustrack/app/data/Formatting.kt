package com.octopustrack.app.data

import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

private val ES = Locale.forLanguageTag("es")

object Formatting {
    /** Una unidad está "en línea" si reportó en los últimos 5 minutos (igual que la web). */
    const val ONLINE_WINDOW_SECONDS = 5 * 60L
    /** Velocidad a partir de la cual se considera "en marcha". */
    const val MOVING_KMH = 3.0

    fun parse(iso: String?): Instant? = iso?.let { runCatching { Instant.parse(it) }.getOrNull() }

    fun isOnline(iso: String?, now: Instant = Instant.now()): Boolean {
        val t = parse(iso) ?: return false
        return Duration.between(t, now).seconds < ONLINE_WINDOW_SECONDS
    }

    fun timeAgo(iso: String?, now: Instant = Instant.now()): String {
        val t = parse(iso) ?: return "nunca"
        val s = Duration.between(t, now).seconds.coerceAtLeast(0)
        return when {
            s < 60 -> "hace $s s"
            s < 3600 -> "hace ${s / 60} min"
            s < 86400 -> "hace ${s / 3600} h"
            else -> "hace ${s / 86400} d"
        }
    }

    fun clock(iso: String?, zone: ZoneId = ZoneId.systemDefault()): String =
        parse(iso)?.atZone(zone)?.format(DateTimeFormatter.ofPattern("HH:mm", ES)) ?: "—"

    fun clockSeconds(iso: String?, zone: ZoneId = ZoneId.systemDefault()): String =
        parse(iso)?.atZone(zone)?.format(DateTimeFormatter.ofPattern("HH:mm:ss", ES)) ?: "—"

    fun dateTime(iso: String?, zone: ZoneId = ZoneId.systemDefault()): String =
        parse(iso)?.atZone(zone)?.format(DateTimeFormatter.ofPattern("d MMM, HH:mm", ES)) ?: "—"

    /** "Hoy", "Ayer" o "7 oct" para agrupar alertas. */
    fun dayLabel(iso: String?, today: LocalDate = LocalDate.now(), zone: ZoneId = ZoneId.systemDefault()): String {
        val d = parse(iso)?.atZone(zone)?.toLocalDate() ?: return "—"
        return when (d) {
            today -> "Hoy"
            today.minusDays(1) -> "Ayer"
            else -> d.format(DateTimeFormatter.ofPattern("EEEE d MMM", ES)).replaceFirstChar { it.uppercase() }
        }
    }

    fun speed(kmh: Double?): String = "${(kmh ?: 0.0).roundToInt()} km/h"
    fun km(value: Double): String = String.format(ES, "%.1f km", value)
    fun coords(lat: Double, lng: Double): String = String.format(Locale.US, "%.6f, %.6f", lat, lng)
}

/** Normaliza lo que escribe la persona en el campo "Servidor". */
fun normalizeServerUrl(input: String): String? {
    var s = input.trim()
    if (s.isEmpty()) return null
    if (!s.contains("://")) s = "https://$s"
    val uri = runCatching { java.net.URI(s) }.getOrNull() ?: return null
    val scheme = uri.scheme?.lowercase()
    if ((scheme != "https" && scheme != "http") || uri.host.isNullOrBlank()) return null
    val port = if (uri.port > 0) ":${uri.port}" else ""
    return "$scheme://${uri.host.lowercase()}$port"
}

/** Extrae el token de vinculación de un enlace `https://…/rastreo#t=TOKEN`, `octopustrack://track?t=TOKEN` o el token solo. */
object PairingLink {
    data class Parsed(val token: String, val server: String?)

    private val TOKEN = Regex("^[A-Za-z0-9_-]{20,64}$")

    fun parse(text: String?): Parsed? {
        val raw = text?.trim().orEmpty()
        if (raw.isEmpty()) return null
        if (TOKEN.matches(raw)) return Parsed(raw, null)
        val uri = runCatching { java.net.URI(raw) }.getOrNull() ?: return null
        val fromFragment = uri.rawFragment?.split('&')?.map { it.split('=', limit = 2) }
            ?.firstOrNull { it[0] == "t" }?.getOrNull(1)
        val fromQuery = uri.rawQuery?.split('&')?.map { it.split('=', limit = 2) }
            ?.firstOrNull { it[0] == "t" }?.getOrNull(1)
        val token = (fromFragment ?: fromQuery)?.takeIf { TOKEN.matches(it) } ?: return null
        val server = if (uri.scheme == "https" || uri.scheme == "http") normalizeServerUrl("${uri.scheme}://${uri.authority}") else null
        return Parsed(token, server)
    }
}
