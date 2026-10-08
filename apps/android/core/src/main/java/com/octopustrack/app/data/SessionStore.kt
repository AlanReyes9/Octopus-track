package com.octopustrack.app.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface AuthState {
    data object Loading : AuthState
    data object LoggedOut : AuthState
    data class LoggedIn(val user: UserDto, val tenants: List<TenantDto>) : AuthState
}

/**
 * Estado de sesión persistente: URL del servidor, token Bearer y perfil.
 * El perfil se guarda para abrir la app al instante aunque no haya conexión.
 */
class SessionStore(private val store: KeyValueStore, private val defaultServer: String) {
    private val _server = MutableStateFlow(store.get(StoreKeys.SERVER_URL) ?: defaultServer)
    val server: StateFlow<String> = _server.asStateFlow()

    private val _auth = MutableStateFlow<AuthState>(AuthState.Loading)
    val auth: StateFlow<AuthState> = _auth.asStateFlow()

    /** Mensaje para mostrar en la pantalla de acceso (p. ej. "Tu sesión ha caducado"). */
    private val _notice = MutableStateFlow<String?>(null)
    val notice: StateFlow<String?> = _notice.asStateFlow()

    @Volatile var token: String? = store.get(StoreKeys.TOKEN)
        private set

    init {
        val profile = store.get(StoreKeys.PROFILE)?.let { runCatching { AppJson.decodeFromString<UserDto>(it) }.getOrNull() }
        val tenants = store.get(StoreKeys.TENANTS)?.let { runCatching { AppJson.decodeFromString<List<TenantDto>>(it) }.getOrNull() }.orEmpty()
        _auth.value = if (token != null && profile != null) AuthState.LoggedIn(profile, tenants) else AuthState.LoggedOut
    }

    fun connection() = Connection(_server.value, token)

    fun setServer(url: String) {
        store.put(StoreKeys.SERVER_URL, url)
        _server.value = url
    }

    fun save(login: LoginResponse) {
        token = login.token
        store.put(StoreKeys.TOKEN, login.token)
        store.put(StoreKeys.TOKEN_EXPIRES, login.expiresAt)
        update(login.user, login.tenants)
    }

    fun update(user: UserDto, tenants: List<TenantDto>) {
        store.put(StoreKeys.PROFILE, AppJson.encodeToString(UserDto.serializer(), user))
        store.put(StoreKeys.TENANTS, AppJson.encodeToString(kotlinx.serialization.builtins.ListSerializer(TenantDto.serializer()), tenants))
        _notice.value = null
        _auth.value = AuthState.LoggedIn(user, tenants)
    }

    fun clear(notice: String? = null) {
        token = null
        store.remove(StoreKeys.TOKEN, StoreKeys.TOKEN_EXPIRES, StoreKeys.PROFILE, StoreKeys.TENANTS, StoreKeys.PUSH_TOKEN)
        _notice.value = notice
        _auth.value = AuthState.LoggedOut
    }

    /** El servidor rechazó el token: cierra sesión con aviso. */
    fun expire() {
        if (_auth.value is AuthState.LoggedIn) clear("Tu sesión ha caducado. Inicia sesión de nuevo.")
    }

    fun dismissNotice() { _notice.value = null }
}
