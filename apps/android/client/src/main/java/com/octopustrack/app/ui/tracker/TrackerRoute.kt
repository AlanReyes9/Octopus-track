package com.octopustrack.app.ui.tracker

import android.Manifest
import android.content.Intent
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.octopustrack.app.data.ApiException
import com.octopustrack.app.data.PairingLink
import com.octopustrack.app.data.PhoneSessionDto
import com.octopustrack.app.data.normalizeServerUrl
import com.octopustrack.app.tracker.Permissions
import com.octopustrack.app.tracker.TrackerRepository
import com.octopustrack.app.tracker.TrackingService
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

private enum class Step { Link, Consent, Permissions, Tracking }

/** Flujo completo del modo rastreador: enlace → consentimiento → permisos → seguimiento. */
@Composable
fun TrackerRoute(tracker: TrackerRepository, defaultServerFlow: StateFlow<String>, prefill: PairingLink.Parsed?, onExit: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val link by tracker.link.collectAsState()
    val status by tracker.status.collectAsState()
    val defaultServer by defaultServerFlow.collectAsState()

    var step by remember { mutableStateOf(if (link != null) Step.Permissions else Step.Link) }
    var input by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf<Triple<String, String, PhoneSessionDto>?>(null) }
    var holder by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var tick by remember { mutableIntStateOf(0) }

    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val o = LifecycleEventObserver { _, e -> if (e == Lifecycle.Event.ON_RESUME) tick++ }
        lifecycle.addObserver(o); onDispose { lifecycle.removeObserver(o) }
    }
    val perms = remember(tick) {
        PermissionState(Permissions.hasFineLocation(context), Permissions.hasBackgroundLocation(context) && Permissions.hasFineLocation(context),
            Permissions.hasNotifications(context), Permissions.isIgnoringBatteryOptimizations(context))
    }

    suspend fun inspect(raw: String) {
        val parsed = PairingLink.parse(raw) ?: run { error = "Ese enlace no es válido. Revisa que lo copiaste completo."; return }
        val server = parsed.server ?: normalizeServerUrl(defaultServer) ?: defaultServer
        loading = true; error = null
        try {
            val s = tracker.inspect(parsed.token, server)
            if (s.consent == "revoked") { error = "Este enlace ya fue revocado. Pide uno nuevo a tu administrador."; return }
            pending = Triple(parsed.token, server, s); holder = s.holderName.orEmpty(); step = Step.Consent
        } catch (e: ApiException) { error = e.message } finally { loading = false }
    }

    LaunchedEffect(prefill) { if (prefill != null && link == null) { input = prefill.token; inspect(prefill.token.let { t -> if (prefill.server != null) "${prefill.server}/rastreo#t=$t" else t }) } }

    val scan = rememberLauncherForActivityResult(ScanContract()) { r -> r.contents?.let { input = it; scope.launch { inspect(it) } } }
    val locLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { tick++ }
    val bgLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { tick++ }
    val notifLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { tick++ }

    BackHandler(step == Step.Link || step == Step.Consent) { if (step == Step.Consent) step = Step.Link else onExit() }

    when (step) {
        Step.Link -> ShareLinkScreen(input, { input = it; error = null }, loading, error, { scope.launch { inspect(input) } },
            { scan.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Apunta al código QR de vinculación").setBeepEnabled(false).setOrientationLocked(true)) }, onExit)
        Step.Consent -> pending?.let { (token, server, s) ->
            ConsentScreen(s.company, s.deviceName, holder, { holder = it }, loading, error, {
                scope.launch {
                    loading = true; error = null
                    try { tracker.accept(token, server, holder, s); step = Step.Permissions } catch (e: ApiException) { error = e.message } finally { loading = false }
                }
            }, { step = Step.Link })
        }
        Step.Permissions -> PermissionsScreen(
            perms,
            onLocation = { locLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) },
            onBackground = {
                if (Build.VERSION.SDK_INT >= 29) bgLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            },
            onNotifications = { if (Build.VERSION.SDK_INT >= 33) notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) },
            onBattery = { context.startActivity(Permissions.batterySettingsIntent()) },
            onStart = { TrackingService.start(context); step = Step.Tracking },
        )
        Step.Tracking -> {
            val l = link
            if (l == null) { LaunchedEffect(Unit) { onExit() } } else TrackingScreen(
                l.company, l.deviceName, status,
                onPause = { TrackingService.send(context, TrackingService.ACTION_PAUSE) },
                onResume = { TrackingService.start(context) },
                onStop = {
                    scope.launch {
                        TrackingService.send(context, TrackingService.ACTION_STOP)
                        tracker.revoke(l); onExit()
                    }
                },
                onOpenSettings = { context.startActivity(Permissions.appSettingsIntent(context)) },
            )
            BackHandler { context.startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }
    }
}
