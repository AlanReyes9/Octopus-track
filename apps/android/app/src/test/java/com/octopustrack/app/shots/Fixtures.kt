package com.octopustrack.app.shots

import com.octopustrack.app.data.FleetUnit
import com.octopustrack.app.data.GeofenceEventDto
import java.time.Instant

val NOW: Instant = Instant.parse("2026-10-08T15:00:00Z")
private fun ago(s: Long) = NOW.minusSeconds(s).toString()

val SAMPLE_UNITS = listOf(
    FleetUnit("1", "Camión 12", "ABC-123", "#7c3aed", "truck", "gps", "gt06", "1", 19.43, -99.13, 62.0, 90.0, true, 88, ago(8)),
    FleetUnit("2", "Reparto Moto", "MX-554", "#f97316", "moto", "gps", "tk103", "2", 19.40, -99.15, 0.0, 0.0, false, 54, ago(40)),
    FleetUnit("3", "Ana (teléfono)", null, "#10b981", "person", "phone", "phone", "3", 19.41, -99.1, 4.0, 10.0, null, 71, ago(15)),
    FleetUnit("4", "Taxi 3", "TX-009", "#ef4444", "taxi", "gps", "h02", "4", 19.3, -99.2, 0.0, 0.0, false, null, ago(7200)),
    FleetUnit("5", "Remolque 2", null, "#0ea5e9", "trailer", "gps", "gt06", "5", null, null, null, null, null, null, null),
)

val SAMPLE_EVENTS = listOf(
    GeofenceEventDto(ago(120), "enter", 0.0, 0.0, "Bodega Central", "#7c3aed", "Camión 12"),
    GeofenceEventDto(ago(3600), "exit", 0.0, 0.0, "Zona Norte", "#f97316", "Reparto Moto"),
    GeofenceEventDto(ago(90000), "enter", 0.0, 0.0, "Cliente Polanco", "#10b981", "Ana (teléfono)"),
)
