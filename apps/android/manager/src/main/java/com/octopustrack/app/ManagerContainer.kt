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
import kotlinx.coroutines.flow.MutableSharedFlow

/** Abre una unidad concreta al tocar una notificación de alerta o mensaje. */
data class DeepLink(val deviceId: String)

/** Dependencias de la app Manager: sesión, flota, comandos. Sin el rastreador del teléfono
 *  (eso vive en la app Cliente, aparte). */
class ManagerContainer(context: Context, store: KeyValueStore = SecureStore(context)) {
    val store: KeyValueStore = store
    val http = newHttpClient()
    val session = SessionStore(store, BuildConfig.DEFAULT_SERVER_URL)
    val api = ApiClient(http, session::connection, session::expire)
    val auth = AuthRepository(api, session, http)
    val fleet = FleetRepository(api, http)
    val commands = CommandsRepository(api)

    val deepLinks = MutableSharedFlow<DeepLink>(replay = 1, extraBufferCapacity = 4)
}
