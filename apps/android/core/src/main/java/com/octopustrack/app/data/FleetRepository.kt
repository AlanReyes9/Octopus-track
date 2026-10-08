package com.octopustrack.app.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

enum class LiveMode { Connecting, Realtime, Polling, Offline }

/** Aviso en vivo de entrada/salida de geocerca (mensaje del WebSocket). */
data class LiveAlert(val deviceId: String, val geofenceName: String, val enter: Boolean, val time: String)

/**
 * Unidades en vivo: consulta periódica (cada 6 s) y, si el servidor tiene un
 * gateway WebSocket configurado, actualizaciones instantáneas por esa vía.
 */
class FleetRepository(private val api: ApiClient, private val http: OkHttpClient) {
    private val _units = MutableStateFlow<List<FleetUnit>>(emptyList())
    val units: StateFlow<List<FleetUnit>> = _units.asStateFlow()

    private val _loaded = MutableStateFlow(false)
    val loaded: StateFlow<Boolean> = _loaded.asStateFlow()

    private val _mode = MutableStateFlow(LiveMode.Connecting)
    val mode: StateFlow<LiveMode> = _mode.asStateFlow()

    private val _geofences = MutableStateFlow<List<GeofenceDto>>(emptyList())
    val geofences: StateFlow<List<GeofenceDto>> = _geofences.asStateFlow()

    private val _alerts = MutableSharedFlow<LiveAlert>(extraBufferCapacity = 16, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val alerts: SharedFlow<LiveAlert> = _alerts.asSharedFlow()

    suspend fun refreshUnits(canManage: Boolean) {
        val positions: List<PositionDto> = api.get("/api/positions/latest")
        val devices: List<DeviceDto> =
            if (canManage) runCatching { api.get<List<DeviceDto>>("/api/devices") }.getOrDefault(emptyList()) else emptyList()
        _units.value = mergeUnits(positions, devices)
        _loaded.value = true
    }

    suspend fun refreshGeofences() {
        runCatching { _geofences.value = api.get("/api/geofences") }
    }

    suspend fun events(): List<GeofenceEventDto> = api.get("/api/geofences/events")

    suspend fun history(deviceId: String, fromIso: String, toIso: String): HistoryResponse =
        api.get("/api/positions/history", mapOf("deviceId" to deviceId, "from" to fromIso, "to" to toIso))

    fun clear() {
        _units.value = emptyList()
        _loaded.value = false
        _geofences.value = emptyList()
        _mode.value = LiveMode.Connecting
    }

    /**
     * Bucle de actualización: se cancela al salir de la pantalla/segundo plano.
     * Lanza la consulta periódica y, en paralelo, el WebSocket si está disponible.
     */
    suspend fun runLive(canManage: Boolean) = coroutineScope {
        var realtime = false
        launch {
            var failures = 0
            while (isActive) {
                try {
                    refreshUnits(canManage)
                    failures = 0
                    if (!realtime) _mode.value = LiveMode.Polling
                } catch (e: CancellationException) {
                    throw e
                } catch (e: ApiException) {
                    failures++
                    if (e.kind == ApiErrorKind.Network && failures >= 2) _mode.value = LiveMode.Offline
                }
                delay(if (realtime) 45_000 else if (failures > 3) 20_000 else 6_000)
            }
        }
        launch { refreshGeofences() }
        launch { realtimeLoop(onState = { realtime = it; if (it) _mode.value = LiveMode.Realtime else if (_mode.value == LiveMode.Realtime) _mode.value = LiveMode.Polling }) }
    }

    private suspend fun realtimeLoop(onState: (Boolean) -> Unit) {
        var attempt = 0
        while (currentCoroutineIsActive()) {
            val cfg = runCatching { api.get<RealtimeTokenDto>("/api/realtime/token") }.getOrNull()
            val url = cfg?.url
            val token = cfg?.token
            if (url.isNullOrBlank() || token.isNullOrBlank()) return // sin gateway: solo consulta periódica
            val closed = kotlinx.coroutines.CompletableDeferred<Unit>()
            val ws = http.newWebSocket(
                Request.Builder().url("$url?token=$token".replace("ws://", "http://").replace("wss://", "https://")).build(),
                object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) { attempt = 0; onState(true) }
                    override fun onMessage(webSocket: WebSocket, text: String) = handleMessage(text)
                    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { onState(false); closed.complete(Unit) }
                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) { onState(false); closed.complete(Unit) }
                },
            )
            try {
                closed.await()
            } finally {
                ws.cancel()
            }
            delay((1_000L shl attempt.coerceAtMost(5)).coerceAtMost(30_000))
            attempt++
        }
    }

    private suspend fun currentCoroutineIsActive() = kotlin.coroutines.coroutineContext[kotlinx.coroutines.Job]?.isActive ?: true

    /** Aplica un mensaje del gateway (position / geofence). */
    internal fun handleMessage(text: String) {
        val obj = runCatching { AppJson.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
        when (obj["type"]?.jsonPrimitive?.contentOrNull) {
            "position" -> applyPosition(obj)
            "geofence" -> {
                val deviceId = obj["deviceId"]?.jsonPrimitive?.contentOrNull ?: return
                _alerts.tryEmit(
                    LiveAlert(
                        deviceId = deviceId,
                        geofenceName = obj["geofenceName"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                        enter = obj["event"]?.jsonPrimitive?.contentOrNull == "enter",
                        time = obj["time"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    ),
                )
            }
        }
    }

    private fun applyPosition(obj: JsonObject) {
        val id = obj["deviceId"]?.jsonPrimitive?.contentOrNull ?: return
        val time = obj["time"]?.jsonPrimitive?.contentOrNull ?: return
        _units.update { list ->
            list.map { u ->
                if (u.id != id) u
                else if (Formatting.parse(time)?.isBefore(Formatting.parse(u.lastSeen) ?: java.time.Instant.EPOCH) == true) u
                else u.copy(
                    latitude = obj["latitude"]?.jsonPrimitive?.doubleOrNull ?: u.latitude,
                    longitude = obj["longitude"]?.jsonPrimitive?.doubleOrNull ?: u.longitude,
                    speedKmh = obj["speedKmh"]?.jsonPrimitive?.doubleOrNull ?: u.speedKmh,
                    course = obj["course"]?.jsonPrimitive?.doubleOrNull ?: u.course,
                    ignition = (obj["ignition"] as? JsonPrimitive)?.booleanOrNull ?: u.ignition,
                    lastSeen = time,
                )
            }
        }
    }
}
