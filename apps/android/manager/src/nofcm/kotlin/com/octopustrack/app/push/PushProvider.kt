package com.octopustrack.app.push

/** Compilación sin Firebase: no hay notificaciones push (la app sigue funcionando con el mapa en vivo). */
object PushProvider {
    suspend fun token(): String? = null
}
