package com.octopustrack.app.data

import kotlinx.serialization.Serializable

@Serializable
private data class LoginRequest(val email: String, val password: String, val tenantId: String? = null)

@Serializable
private data class SwitchRequest(val tenantId: String)

@Serializable
private data class PasswordRequest(val current: String, val next: String)

class AuthRepository(
    private val api: ApiClient,
    private val session: SessionStore,
    private val http: okhttp3.OkHttpClient,
) {
    /** Comprueba que la dirección es un servidor Octopus Track y devuelve la URL normalizada. */
    suspend fun verifyServer(input: String): String {
        val url = normalizeServerUrl(input) ?: throw ApiException(0, "Escribe una dirección válida (por ejemplo, mi-empresa.com)", ApiErrorKind.Client)
        val ping = try {
            ApiClient(http, { Connection(url, null) }).get<PingResponse>("/api/mobile/ping")
        } catch (e: ApiException) {
            if (e.kind == ApiErrorKind.Network) throw ApiException(0, "No se pudo conectar con $url", ApiErrorKind.Network, e)
            throw ApiException(e.status, "Esa dirección no parece un servidor de Octopus Track", e.kind, e)
        } catch (e: Exception) {
            throw ApiException(0, "Esa dirección no parece un servidor de Octopus Track", ApiErrorKind.Client, e)
        }
        if (ping.app != "octopus-track") throw ApiException(0, "Esa dirección no parece un servidor de Octopus Track", ApiErrorKind.Client)
        return url
    }

    suspend fun login(server: String, email: String, password: String) {
        val url = verifyServer(server)
        val client = ApiClient(http, { Connection(url, null) })
        val response: LoginResponse = client.post("/api/mobile/login", LoginRequest(email.trim(), password))
        session.setServer(url)
        session.save(response)
    }

    /** Valida el token guardado y refresca rol/empresa. Cierra sesión si ya no es válido. */
    suspend fun refreshProfile() {
        try {
            val p: ProfileResponse = api.get("/api/mobile/me")
            session.update(p.user, p.tenants)
        } catch (e: ApiException) {
            // 401 ya cierra sesión desde ApiClient; los errores de red se ignoran (modo sin conexión).
            if (e.kind == ApiErrorKind.Unauthorized) session.expire()
        }
    }

    suspend fun switchTenant(tenantId: String) {
        val r: LoginResponse = api.post("/api/mobile/switch", SwitchRequest(tenantId))
        session.save(r)
    }

    /**
     * Cambia la contraseña. El servidor invalida los tokens anteriores, así que se
     * vuelve a iniciar sesión en silencio con la contraseña nueva.
     */
    suspend fun changePassword(current: String, next: String) {
        val email = (session.auth.value as? AuthState.LoggedIn)?.user?.email
        api.execute("POST", "/api/account/password", body = AppJson.encodeToString(PasswordRequest.serializer(), PasswordRequest(current, next)))
        if (email == null) return session.clear()
        try {
            login(session.server.value, email, next)
        } catch (e: ApiException) {
            session.clear("Contraseña actualizada. Inicia sesión con la nueva.")
        }
    }

    fun logout() = session.clear()
}
