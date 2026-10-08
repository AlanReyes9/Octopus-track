package com.octopustrack.app

import android.content.Context
import com.octopustrack.app.data.KeyValueStore
import com.octopustrack.app.data.PairingLink
import com.octopustrack.app.data.SecureStore
import com.octopustrack.app.data.newHttpClient
import com.octopustrack.app.tracker.TrackerRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import java.io.File

/**
 * Dependencias de la app Cliente: solo lo necesario para vincularse y compartir la
 * ubicación de este teléfono. No hay sesión de usuario ni panel: eso vive en la app Manager.
 */
class ClientContainer(context: Context, store: KeyValueStore = SecureStore(context)) {
    val store: KeyValueStore = store
    val http = newHttpClient()
    val tracker = TrackerRepository(http, store, File(context.filesDir, "tracker/pending.jsonl"))

    /** Servidor por defecto cuando un enlace solo trae el token (sin dominio). */
    val defaultServer = MutableStateFlow(BuildConfig.DEFAULT_SERVER_URL)

    /** Enlace de vinculación recibido (https://…/rastreo#t=… u octopustrack://track…). */
    val deepLinks = MutableSharedFlow<PairingLink.Parsed>(replay = 1, extraBufferCapacity = 4)
}
