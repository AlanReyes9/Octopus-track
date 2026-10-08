package com.octopustrack.app.push

import com.google.firebase.messaging.FirebaseMessaging
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/** Obtiene el token de Firebase Cloud Messaging de este teléfono. */
object PushProvider {
    suspend fun token(): String? = suspendCancellableCoroutine { cont ->
        FirebaseMessaging.getInstance().token.addOnCompleteListener { t -> cont.resume(if (t.isSuccessful) t.result else null) }
    }
}
