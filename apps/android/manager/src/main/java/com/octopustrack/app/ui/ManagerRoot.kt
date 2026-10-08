package com.octopustrack.app.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.octopustrack.app.BuildConfig
import com.octopustrack.app.DeepLink
import com.octopustrack.app.ManagerContainer
import com.octopustrack.app.data.ApiException
import com.octopustrack.app.data.AuthState
import com.octopustrack.app.data.GeofenceEventDto
import com.octopustrack.app.data.LiveAlert
import com.octopustrack.app.push.PushRegistrar
import com.octopustrack.app.ui.account.AccountActions
import com.octopustrack.app.ui.account.AccountScreen
import com.octopustrack.app.ui.account.ChangePasswordScreen
import com.octopustrack.app.ui.auth.LoginScreen
import com.octopustrack.app.ui.auth.WelcomeScreen
import com.octopustrack.app.ui.brand.OctopusLogo
import com.octopustrack.app.ui.commands.CommandsRoute
import com.octopustrack.app.ui.history.HistoryRoute
import com.octopustrack.app.ui.home.GeofencesScreen
import com.octopustrack.app.ui.home.HistoryPickerScreen
import com.octopustrack.app.ui.home.Section
import com.octopustrack.app.ui.home.SidebarHeader
import com.octopustrack.app.ui.home.WebOnlyScreen
import com.octopustrack.app.ui.map.LiveScreen
import kotlinx.coroutines.launch

/** Raíz de la app Manager: inicio de sesión y, una vez dentro, el panel (mapa, historial,
 *  geocercas, comandos, cuenta). Compartir la ubicación de un teléfono se hace desde la
 *  app aparte "Octopus Track", no desde aquí. */
@Composable
fun ManagerRoot(container: ManagerContainer) {
    val auth by container.session.auth.collectAsState()
    var openUnit by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { container.deepLinks.collect { d -> openUnit = d.deviceId } }
    LaunchedEffect(auth) { if (auth is AuthState.LoggedIn) { container.auth.refreshProfile(); PushRegistrar.register(container) } }

    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        val a = auth
        when {
            a is AuthState.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { OctopusLogo() }
            a is AuthState.LoggedOut -> GuestFlow(container)
            a is AuthState.LoggedIn && a.user.mustChangePassword -> ForcedPassword(container)
            a is AuthState.LoggedIn -> HomeRoute(container, a, openUnit) { openUnit = null }
        }
    }
}

@Composable
private fun GuestFlow(container: ManagerContainer) {
    val server by container.session.server.collectAsState()
    val notice by container.session.notice.collectAsState()
    val scope = rememberCoroutineScope()
    var loggingIn by remember { mutableStateOf(false) }
    var url by remember { mutableStateOf(server) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    if (loggingIn) {
        BackHandler { loggingIn = false }
        LoginScreen(url, { url = it }, server != BuildConfig.DEFAULT_SERVER_URL, email, { email = it }, password, { password = it }, loading, error ?: notice, {
            scope.launch {
                loading = true; error = null
                try { container.auth.login(url, email, password) } catch (e: ApiException) { error = e.message } finally { loading = false }
            }
        }, { loggingIn = false })
    } else {
        WelcomeScreen({ container.session.dismissNotice(); loggingIn = true })
    }
}

@Composable
private fun ForcedPassword(container: ManagerContainer) {
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    ChangePasswordScreen(true, loading, error, { cur, next ->
        scope.launch {
            loading = true; error = null
            try { container.auth.changePassword(cur, next) } catch (e: ApiException) { error = e.message } finally { loading = false }
        }
    }, null)
}

@Composable
private fun HomeRoute(container: ManagerContainer, state: AuthState.LoggedIn, openUnit: String?, consumeUnit: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val user = state.user
    val server by container.session.server.collectAsState()
    val units by container.fleet.units.collectAsState()
    val loaded by container.fleet.loaded.collectAsState()
    val mode by container.fleet.mode.collectAsState()
    val geofences by container.fleet.geofences.collectAsState()
    val alerts = remember { mutableStateListOf<LiveAlert>() }
    var events by remember { mutableStateOf<List<GeofenceEventDto>?>(null) }

    var section by remember { mutableStateOf(Section.Live) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var historyUnit by remember { mutableStateOf<String?>(null) }
    var commandsUnit by remember { mutableStateOf<String?>(null) }
    var changePassword by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var pushOn by remember { mutableStateOf(PushRegistrar.isRegistered(container)) }

    LaunchedEffect(user.tenantId) {
        alerts.clear(); container.fleet.clear()
        launch { container.fleet.refreshGeofences() }
        launch { container.fleet.alerts.collect { alerts.add(0, it); if (alerts.size > 20) alerts.removeAt(alerts.lastIndex) } }
        container.fleet.runLive(user.canManage)
    }
    LaunchedEffect(section) { if (section == Section.Geofences) events = runCatching { container.fleet.events() }.getOrNull().also { if (it == null) events = emptyList() } }
    LaunchedEffect(openUnit) { if (openUnit != null) { section = Section.Live; selectedId = openUnit; consumeUnit() } }

    val histUnit = units.firstOrNull { it.id == historyUnit }
    val cmdUnit = units.firstOrNull { it.id == commandsUnit }
    BackHandler(histUnit != null || changePassword || section != Section.Live) {
        when { histUnit != null -> historyUnit = null; changePassword -> changePassword = false; else -> section = Section.Live }
    }

    if (changePassword) {
        var loading by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf<String?>(null) }
        ChangePasswordScreen(false, loading, error, { cur, next ->
            scope.launch {
                loading = true; error = null
                try { container.auth.changePassword(cur, next); changePassword = false; message = "Contraseña actualizada" } catch (e: ApiException) { error = e.message } finally { loading = false }
            }
        }, { changePassword = false })
        return
    }
    if (histUnit != null) { HistoryRoute(histUnit, container.fleet) { historyUnit = null }; return }

    Column(Modifier.fillMaxSize()) {
        SidebarHeader(state.tenants, user.tenantId, user.canManage, section, { section = it }, onSwitchTenant = { id -> scope.launch { runCatching { container.auth.switchTenant(id) } } })
        Box(Modifier.weight(1f).fillMaxWidth().navigationBarsPadding()) {
            when (section) {
                Section.Live -> LiveScreen(units, alerts, geofences, mode, loaded, selectedId, { selectedId = it }, user.canManage, { historyUnit = it.id }, { commandsUnit = it.id })
                Section.History -> HistoryPickerScreen(units, loaded, user.canManage, { historyUnit = it.id })
                Section.Geofences -> GeofencesScreen(geofences, events)
                Section.Devices, Section.Users, Section.Protocols -> WebOnlyScreen(
                    section,
                    when (section) {
                        Section.Devices -> "Registra y edita equipos, vehículos, iconos y reglas de geocercas desde el panel web."
                        Section.Users -> "Crea cuentas para tus clientes y gestiona sus permisos desde el panel web."
                        else -> "Consulta los protocolos GPS compatibles y su configuración desde el panel web."
                    },
                    { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("$server${section.webPath}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) },
                )
                Section.Account -> AccountScreen(
                    user, state.tenants, server, PushRegistrar.available, pushOn, BuildConfig.VERSION_NAME,
                    AccountActions(
                        onSwitchTenant = { id -> scope.launch { runCatching { container.auth.switchTenant(id) } } },
                        onPushToggle = { on ->
                            scope.launch {
                                if (on) pushOn = PushRegistrar.register(container) else { PushRegistrar.unregister(container); pushOn = false }
                            }
                        },
                        onPushTest = { scope.launch { message = try { container.api.execute("POST", "/api/push/test"); "Notificación enviada" } catch (e: ApiException) { e.message } } },
                        onChangePassword = { changePassword = true },
                        onOpenUrl = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) },
                        onLogout = { scope.launch { PushRegistrar.unregister(container); container.fleet.clear(); container.auth.logout() } },
                    ),
                    message = message,
                )
            }
        }
    }
    cmdUnit?.let { CommandsRoute(it, container.commands) { commandsUnit = null } }
}
