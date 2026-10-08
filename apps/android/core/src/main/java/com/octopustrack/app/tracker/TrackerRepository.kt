package com.octopustrack.app.tracker

import com.octopustrack.app.data.ApiClient
import com.octopustrack.app.data.AppJson
import com.octopustrack.app.data.Connection
import com.octopustrack.app.data.KeyValueStore
import com.octopustrack.app.data.PhoneIngestResponse
import com.octopustrack.app.data.PhoneSessionDto
import com.octopustrack.app.data.StoreKeys
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import okhttp3.OkHttpClient
import java.io.File

/** Enlace de vinculación aceptado en este teléfono. */
data class TrackerLink(
    val token: String,
    val server: String,
    val company: String,
    val deviceName: String,
    val holderName: String?,
)

@Serializable
private data class ConsentRequest(val holderName: String, val accept: Boolean = true)

/**
 * Modo rastreador: usa el token del enlace de vinculación (no el inicio de
 * sesión) para consultar el consentimiento y enviar la ubicación.
 */
class TrackerRepository(
    private val http: OkHttpClient,
    private val store: KeyValueStore,
    pendingFile: File,
) {
    val queue = PendingQueue(pendingFile)

    private val _status = MutableStateFlow(TrackerStatus(pending = queue.size()))
    val status: StateFlow<TrackerStatus> = _status.asStateFlow()
    fun updateStatus(f: (TrackerStatus) -> TrackerStatus) = _status.update(f)

    private val _link = MutableStateFlow(load())
    val link: StateFlow<TrackerLink?> = _link.asStateFlow()

    private fun load(): TrackerLink? {
        val token = store.get(StoreKeys.TRACKER_TOKEN) ?: return null
        val server = store.get(StoreKeys.TRACKER_SERVER) ?: return null
        return TrackerLink(
            token, server,
            store.get(StoreKeys.TRACKER_COMPANY).orEmpty(),
            store.get(StoreKeys.TRACKER_DEVICE).orEmpty(),
            store.get(StoreKeys.TRACKER_HOLDER),
        )
    }

    private fun client(server: String) = ApiClient(http, { Connection(server, null) })

    /** Consulta el estado del enlace (empresa, consentimiento). Lanza ApiException si no es válido. */
    suspend fun inspect(token: String, server: String): PhoneSessionDto =
        client(server).get("/api/phone/session", bearer = token)

    /** La persona acepta compartir su ubicación: queda registrado en el servidor. */
    suspend fun accept(token: String, server: String, holderName: String, session: PhoneSessionDto) {
        client(server).execute(
            "POST", "/api/phone/consent", bearer = token,
            body = AppJson.encodeToString(ConsentRequest.serializer(), ConsentRequest(holderName.trim())),
        )
        save(TrackerLink(token, server, session.company, session.deviceName, holderName.trim()))
    }

    fun save(link: TrackerLink) {
        store.put(StoreKeys.TRACKER_TOKEN, link.token)
        store.put(StoreKeys.TRACKER_SERVER, link.server)
        store.put(StoreKeys.TRACKER_COMPANY, link.company)
        store.put(StoreKeys.TRACKER_DEVICE, link.deviceName)
        store.put(StoreKeys.TRACKER_HOLDER, link.holderName)
        _link.value = link
    }

    suspend fun send(link: TrackerLink, p: PositionPayload): PhoneIngestResponse =
        AppJson.decodeFromString(
            client(link.server).execute(
                "POST", "/api/ingest/phone", bearer = link.token,
                body = AppJson.encodeToString(PositionPayload.serializer(), p),
            ),
        )

    /** "Dejar de compartir": revoca el consentimiento en el servidor y olvida el enlace. */
    suspend fun revoke(link: TrackerLink) {
        runCatching { client(link.server).postRaw("/api/phone/revoke", JsonObject(emptyMap()), bearer = link.token) }
        forget()
    }

    fun forget() {
        store.remove(
            StoreKeys.TRACKER_TOKEN, StoreKeys.TRACKER_SERVER, StoreKeys.TRACKER_COMPANY,
            StoreKeys.TRACKER_DEVICE, StoreKeys.TRACKER_HOLDER, StoreKeys.TRACKER_RUNNING,
        )
        queue.clear()
        _link.value = null
        _status.value = TrackerStatus()
    }

    /** El servicio debe reanudarse tras un reinicio del sistema. */
    var wasRunning: Boolean
        get() = store.get(StoreKeys.TRACKER_RUNNING) == "1"
        set(v) = store.put(StoreKeys.TRACKER_RUNNING, if (v) "1" else null)
}

private fun <T> MutableStateFlow<T>.update(f: (T) -> T) { value = f(value) }
