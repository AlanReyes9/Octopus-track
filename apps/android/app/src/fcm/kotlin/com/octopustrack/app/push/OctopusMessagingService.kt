package com.octopustrack.app.push

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.octopustrack.app.OctopusApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Recibe las alertas push (solo datos) y arma la notificación con el canal y la acción de la app. */
class OctopusMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        val c = (application as OctopusApp).container
        CoroutineScope(Dispatchers.IO).launch { PushRegistrar.register(c, token) }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val d = message.data
        val title = d["title"] ?: return
        Notifications.ensureChannels(this)
        val device = d["url"]?.let { Regex("[?&]device=([0-9a-fA-F-]{36})").find(it)?.groupValues?.get(1) }
        Notifications.alert(this, title, d["body"].orEmpty(), device, d["tag"]?.ifBlank { null })
    }
}
