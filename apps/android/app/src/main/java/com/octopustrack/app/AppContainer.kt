package com.octopustrack.app

import android.content.Context
import com.octopustrack.app.data.ApiClient
import com.octopustrack.app.data.AuthRepository
import com.octopustrack.app.data.CommandsRepository
import com.octopustrack.app.data.FleetRepository
import com.octopustrack.app.data.KeyValueStore
import com.octopustrack.app.data.SecureStore
import com.octopustrack.app.data.SessionStore
import com.octopustrack.app.data.newHttpClient
import com.octopustrack.app.tracker.TrackerRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import java.io.File

/** Abre una unidad concreta (al tocar una notificación) o inicia el modo rastreador (enlace). */
sealed interface DeepLink {
    data class Unit(val deviceId: String) : DeepLink
    data class Pairing(val token: String, val server: String?) : DeepLink
}

/** Inyección manual de dependencias: una instancia por proceso. */
class AppContainer(context: Context, store: KeyValueStore = SecureStore(context)) {
    val store: KeyValueStore = store
    val http = newHttpClient()
    val session = SessionStore(store, BuildConfig.DEFAULT_SERVER_URL)
    val api = ApiClient(http, session::connection, session::expire)
    val auth = AuthRepository(api, session, http)
    val fleet = FleetRepository(api, http)
    val commands = CommandsRepository(api)
    val tracker = TrackerRepository(http, store, File(context.filesDir, "tracker/pending.jsonl"))

    val deepLinks = MutableSharedFlow<DeepLink>(replay = 1, extraBufferCapacity = 4)
}
