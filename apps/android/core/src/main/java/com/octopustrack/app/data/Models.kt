package com.octopustrack.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

// ---------------------------------------------------------------- sesión
@Serializable
data class TenantDto(val id: String, val name: String, val role: String)

@Serializable
data class UserDto(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val tenantId: String,
    val tenantName: String = "",
    val mustChangePassword: Boolean = false,
) {
    /** Propietarios y administradores gestionan equipos y comandos; "viewer" es cliente. */
    val canManage: Boolean get() = role == "owner" || role == "admin"
    val roleLabel: String get() = when (role) { "owner" -> "Propietario"; "admin" -> "Administrador"; else -> "Cliente" }
}

@Serializable
data class LoginResponse(val token: String, val expiresAt: String, val user: UserDto, val tenants: List<TenantDto> = emptyList())

@Serializable
data class ProfileResponse(val user: UserDto, val tenants: List<TenantDto> = emptyList())

@Serializable
data class PingResponse(val app: String = "", val api: Int = 0, val push: Boolean = false)

// ---------------------------------------------------------------- flota
/** Última posición de una unidad (GET /api/positions/latest). */
@Serializable
data class PositionDto(
    val deviceId: String,
    val deviceName: String,
    val imei: String = "",
    val vehicleId: String? = null,
    val vehicleName: String? = null,
    val plate: String? = null,
    val color: String = "#7c3aed",
    val icon: String = "car",
    val kind: String = "gps",
    val protocol: String = "gateway",
    val attributes: JsonObject = JsonObject(emptyMap()),
    val time: String,
    val latitude: Double,
    val longitude: Double,
    val speedKmh: Double? = null,
    val course: Double? = null,
    val ignition: Boolean? = null,
)

/** Fila de GET /api/devices (solo administradores): incluye equipos que aún no reportan. */
@Serializable
data class DeviceDto(
    val id: String,
    val imei: String = "",
    val name: String,
    val kind: String = "gps",
    val protocol: String = "gateway",
    val lastSeenAt: String? = null,
    val vehicleName: String? = null,
    val plate: String? = null,
    val color: String? = null,
    val icon: String? = null,
    val consentAt: String? = null,
    val consentRevokedAt: String? = null,
)

@Serializable
data class PolygonDto(val type: String = "Polygon", val coordinates: List<List<List<Double>>> = emptyList())

@Serializable
data class GeofenceDto(
    val id: String,
    val name: String,
    val color: String = "#f97316",
    val geometry: PolygonDto,
    val areaKm2: Double = 0.0,
)

@Serializable
data class GeofenceEventDto(
    val time: String,
    val type: String,
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    val geofenceName: String = "",
    val color: String = "#f97316",
    val unit: String = "",
)

@Serializable
data class HistoryPointDto(
    val time: String,
    val latitude: Double,
    val longitude: Double,
    val speedKmh: Double? = null,
    val course: Double? = null,
    val ignition: Boolean? = null,
)

@Serializable
data class HistorySummaryDto(
    val distanceKm: Double = 0.0,
    val maxSpeedKmh: Double = 0.0,
    val avgSpeedKmh: Double = 0.0,
    val start: String? = null,
    val end: String? = null,
)

@Serializable
data class HistoryResponse(
    val points: List<HistoryPointDto> = emptyList(),
    val totalPoints: Int = 0,
    val sampled: Boolean = false,
    val summary: HistorySummaryDto = HistorySummaryDto(),
)

// ---------------------------------------------------------------- comandos
@Serializable
data class CommandParamDef(
    val key: String,
    val label: String,
    val kind: String = "text",
    val min: Double? = null,
    val max: Double? = null,
    val maxLength: Int? = null,
)

@Serializable
data class CommandDef(
    val type: String,
    val label: String,
    val description: String = "",
    val dangerous: Boolean = false,
    val params: List<CommandParamDef> = emptyList(),
)

@Serializable
data class CommandCatalog(val protocol: String = "", val commands: List<CommandDef> = emptyList())

@Serializable
data class CommandRowDto(
    val id: String,
    val type: String,
    val params: JsonObject = JsonObject(emptyMap()),
    val status: String,
    val result: String? = null,
    val createdAt: String,
)

@Serializable
data class CommandTemplateDto(
    val id: String,
    val name: String,
    val protocol: String? = null,
    val type: String,
    val params: JsonObject = JsonObject(emptyMap()),
)

@Serializable
data class RealtimeTokenDto(val url: String? = null, val token: String? = null)

// ---------------------------------------------------------------- teléfono (modo rastreador)
@Serializable
data class PhoneSessionDto(
    val deviceName: String,
    val company: String,
    val holderName: String? = null,
    /** "none" | "active" | "revoked" */
    val consent: String,
)

@Serializable
data class PhoneCommandDto(val id: String, val type: String, val params: JsonObject = JsonObject(emptyMap()))

@Serializable
data class PhoneIngestResponse(val status: String = "", val commands: List<PhoneCommandDto> = emptyList())

@Serializable
data class ErrorBody(@SerialName("error") val error: String? = null)
