package com.octopustrack.app.data

import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.time.Instant
import kotlin.math.roundToInt

enum class UnitStatus(val label: String) {
    Moving("En marcha"),
    Idle("Detenido"),
    Offline("Sin señal"),
    NoData("Sin datos"),
}

/** Unidad tal como la ve la persona: vehículo + dispositivo + última posición. */
data class FleetUnit(
    val id: String,
    val name: String,
    val plate: String?,
    val color: String,
    val icon: String,
    val kind: String,
    val protocol: String,
    val imei: String,
    val latitude: Double?,
    val longitude: Double?,
    val speedKmh: Double?,
    val course: Double?,
    val ignition: Boolean?,
    val battery: Int?,
    val lastSeen: String?,
) {
    val hasPosition: Boolean get() = latitude != null && longitude != null
    val isPhone: Boolean get() = kind == "phone"
    /** Protocolo efectivo para consultar comandos. */
    val commandProtocol: String get() = if (isPhone) "phone" else protocol

    fun status(now: Instant = Instant.now()): UnitStatus = when {
        lastSeen == null -> UnitStatus.NoData
        !Formatting.isOnline(lastSeen, now) -> UnitStatus.Offline
        (speedKmh ?: 0.0) > Formatting.MOVING_KMH -> UnitStatus.Moving
        else -> UnitStatus.Idle
    }

    fun isOnline(now: Instant = Instant.now()) = Formatting.isOnline(lastSeen, now)

    companion object {
        fun from(p: PositionDto) = FleetUnit(
            id = p.deviceId,
            name = p.vehicleName ?: p.deviceName,
            plate = p.plate,
            color = p.color,
            icon = p.icon,
            kind = p.kind,
            protocol = p.protocol,
            imei = p.imei,
            latitude = p.latitude,
            longitude = p.longitude,
            speedKmh = p.speedKmh,
            course = p.course,
            ignition = p.ignition,
            battery = p.attributes["battery"]?.jsonPrimitive?.doubleOrNull?.roundToInt(),
            lastSeen = p.time,
        )

        fun from(d: DeviceDto) = FleetUnit(
            id = d.id,
            name = d.vehicleName ?: d.name,
            plate = d.plate,
            color = d.color ?: "#7c3aed",
            icon = d.icon ?: if (d.kind == "phone") "person" else "car",
            kind = d.kind,
            protocol = d.protocol,
            imei = d.imei,
            latitude = null,
            longitude = null,
            speedKmh = null,
            course = null,
            ignition = null,
            battery = null,
            lastSeen = d.lastSeenAt,
        )
    }
}

/** Combina las últimas posiciones con la lista de dispositivos (admin) para incluir equipos sin datos. */
fun mergeUnits(positions: List<PositionDto>, devices: List<DeviceDto>): List<FleetUnit> {
    val byId = positions.associateBy { it.deviceId }
    val merged = positions.map(FleetUnit::from) +
        devices.filter { it.id !in byId }.map(FleetUnit::from)
    return merged.sortedBy { it.name.lowercase() }
}
