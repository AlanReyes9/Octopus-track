package com.octopustrack.app.push

import com.octopustrack.app.BuildConfig
import com.octopustrack.app.ManagerContainer
import com.octopustrack.app.data.ApiException
import com.octopustrack.app.data.StoreKeys
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

@Serializable
private data class PushToken(val token: String, val platform: String = "android")

/** Registra / retira el token FCM de este teléfono en el servidor (solo con sesión iniciada). */
object PushRegistrar {
    val available get() = BuildConfig.PUSH_AVAILABLE

    suspend fun register(c: ManagerContainer, token: String? = null): Boolean {
        if (!available || c.session.token == null) return false
        val t = token ?: PushProvider.token() ?: return false
        return try {
            c.api.execute("POST", "/api/mobile/push", body = com.octopustrack.app.data.AppJson.encodeToString(PushToken.serializer(), PushToken(t)))
            c.store.put(StoreKeys.PUSH_TOKEN, t)
            true
        } catch (_: ApiException) { false }
    }

    suspend fun unregister(c: ManagerContainer) {
        val t = c.store.get(StoreKeys.PUSH_TOKEN) ?: return
        runCatching {
            c.api.execute("DELETE", "/api/mobile/push", body = JsonObject(mapOf("token" to JsonPrimitive(t))).toString())
        }
        c.store.put(StoreKeys.PUSH_TOKEN, null)
    }

    fun isRegistered(c: ManagerContainer) = c.store.get(StoreKeys.PUSH_TOKEN) != null
}
