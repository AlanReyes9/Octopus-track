package com.octopustrack.app.tracker

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.octopustrack.app.data.ApiErrorKind
import com.octopustrack.app.data.ApiException
import com.octopustrack.app.data.PhoneCommandDto
import com.octopustrack.app.push.Notifications
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.time.Instant
import kotlin.math.roundToInt

/**
 * Servicio en primer plano que comparte la ubicación con la empresa. Android
 * exige un aviso permanente mientras se usa la ubicación en segundo plano; ahí
 * se puede pausar. Solo funciona si la persona aceptó el consentimiento.
 */
class TrackingService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val serial = Dispatchers.Default.limitedParallelism(1)
    private lateinit var tracker: TrackerRepository
    private lateinit var engine: LocationEngine
    private val policy = SendPolicy()

    private var lastSent: SendPolicy.Sent? = null
    private var lastLocation: Location? = null
    private var maintenance: Job? = null
    private var begun = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Notifications.ensureChannels(this)
        tracker = (application as TrackerHost).tracker
        engine = LocationEngine(this) { loc -> scope.launch(serial) { onFix(loc) } }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { shutdown(); return START_NOT_STICKY }
            ACTION_PAUSE -> { if (begun) setPaused(true) else if (!begin()) return START_NOT_STICKY }
            ACTION_RESUME -> { if (begun) setPaused(false) else if (!begin()) return START_NOT_STICKY }
            else -> if (!begin()) return START_NOT_STICKY
        }
        return START_STICKY
    }

    // ------------------------------------------------------------------ ciclo de vida
    private fun begin(): Boolean {
        val link = tracker.link.value
        if (link == null) { stopSelf(); return false }
        if (begun) return true
        val notification = Notifications.tracking(this, link.company, tracker.status.value.copy(running = true))
        try {
            ServiceCompat.startForeground(
                this, Notifications.ID_TRACKING, notification,
                if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0,
            )
        } catch (e: Exception) {
            // Sin permiso de ubicación, o el sistema no permite iniciar desde segundo plano.
            tracker.wasRunning = false
            tracker.updateStatus { it.copy(running = false, locationProblem = "No se pudo iniciar. Abre la app y vuelve a activar.") }
            stopSelf()
            return false
        }
        begun = true
        tracker.wasRunning = true
        tracker.updateStatus { it.copy(running = true, paused = false, revoked = false, pending = tracker.queue.size()) }
        startEngine()
        maintenance = scope.launch { maintenanceLoop() }
        scope.launch { observeStatus() }
        return true
    }

    private fun startEngine() {
        val ok = engine.start()
        tracker.updateStatus {
            it.copy(locationProblem = if (ok) null else "Activa el GPS y el permiso de ubicación")
        }
        // Primera posición enseguida con lo último que se conozca.
        engine.lastKnown()?.takeIf { System.currentTimeMillis() - it.time < 120_000 }?.let { loc -> scope.launch(serial) { onFix(loc) } }
    }

    private fun setPaused(paused: Boolean) {
        tracker.updateStatus { it.copy(paused = paused) }
        if (paused) engine.stop() else startEngine()
    }

    private fun shutdown() {
        engine.stop()
        tracker.wasRunning = false
        tracker.updateStatus { it.copy(running = false, paused = false) }
        begun = false
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        engine.stop()
        maintenance?.cancel()
        scope.cancel()
        tracker.updateStatus { it.copy(running = false) }
        super.onDestroy()
    }

    // ------------------------------------------------------------------ envío
    private suspend fun onFix(loc: Location) {
        if (tracker.status.value.paused) return
        lastLocation = loc
        tracker.updateStatus { it.copy(accuracyM = if (loc.hasAccuracy()) loc.accuracy.roundToInt() else null) }
        val now = System.currentTimeMillis()
        if (!policy.shouldSend(lastSent, loc.latitude, loc.longitude, now)) return
        send(payload(loc, now))
    }

    private fun payload(loc: Location, timestamp: Long) = PositionPayload(
        latitude = loc.latitude,
        longitude = loc.longitude,
        accuracy = if (loc.hasAccuracy()) loc.accuracy.toDouble() else 50.0,
        altitude = if (loc.hasAltitude()) loc.altitude else null,
        speed = if (loc.hasSpeed()) loc.speed.toDouble().coerceIn(0.0, 150.0) else null,
        heading = if (loc.hasBearing()) loc.bearing.toDouble() else null,
        timestamp = timestamp,
        battery = batteryLevel(),
    )

    private fun batteryLevel(): Double? {
        val bm = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val pct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        return if (pct in 0..100) pct / 100.0 else null
    }

    private suspend fun send(p: PositionPayload) {
        val link = tracker.link.value ?: return
        lastSent = SendPolicy.Sent(p.latitude, p.longitude, p.timestamp)
        try {
            val res = tracker.send(link, p)
            tracker.updateStatus {
                it.copy(lastSentIso = Instant.ofEpochMilli(p.timestamp).toString(), sentCount = it.sentCount + 1, offline = false)
            }
            handleCommands(res.commands)
            flushPending()
        } catch (e: ApiException) {
            when (e.kind) {
                ApiErrorKind.Unauthorized, ApiErrorKind.Forbidden -> onRevoked()
                else -> {
                    tracker.queue.add(p)
                    tracker.updateStatus { it.copy(offline = true, pending = tracker.queue.size()) }
                }
            }
        }
    }

    /** Reenvía lo guardado sin conexión, de más antiguo a más reciente. */
    private suspend fun flushPending() {
        val link = tracker.link.value ?: return
        var guard = 0
        while (guard++ < 8) {
            val batch = tracker.queue.peek(25)
            if (batch.isEmpty()) break
            var sent = 0
            try {
                for (p in batch) { tracker.send(link, p); sent++ }
            } catch (e: ApiException) {
                if (e.kind == ApiErrorKind.Unauthorized || e.kind == ApiErrorKind.Forbidden) return onRevoked()
                if (e.kind == ApiErrorKind.Client || e.kind == ApiErrorKind.NotFound) sent++ // rechazada por el servidor: no reintentar
                tracker.queue.drop(sent)
                tracker.updateStatus { it.copy(pending = tracker.queue.size()) }
                return
            }
            tracker.queue.drop(sent)
        }
        tracker.updateStatus { it.copy(pending = tracker.queue.size()) }
    }

    private fun handleCommands(commands: List<PhoneCommandDto>) {
        val company = tracker.link.value?.company.orEmpty()
        for (c in commands) {
            when (c.type) {
                "message" -> {
                    val text = c.params["text"]?.jsonPrimitive?.contentOrNull.orEmpty()
                    if (text.isNotBlank()) {
                        tracker.updateStatus { it.copy(companyMessage = text) }
                        Notifications.message(this, company, text)
                    }
                }
                "requestPosition" -> engine.requestSingle { loc ->
                    if (loc != null) scope.launch(serial) { lastLocation = loc; send(payload(loc, System.currentTimeMillis())) }
                }
            }
        }
    }

    private fun onRevoked() {
        val company = tracker.link.value?.company.orEmpty()
        tracker.forget()
        tracker.updateStatus { it.copy(revoked = true) }
        Notifications.message(this, company.ifBlank { "tu empresa" }, "Se dejó de compartir tu ubicación. Pide un enlace nuevo si quieres volver a hacerlo.")
        shutdown()
    }

    /** Latido, reenvío de pendientes y estado del GPS. */
    private suspend fun maintenanceLoop() {
        while (scope.isActive) {
            delay(15_000)
            scope.launch(serial) {
                val status = tracker.status.value
                if (status.paused) return@launch
                val problem = if (!Permissions.hasFineLocation(this@TrackingService)) "Falta el permiso de ubicación"
                else if (!engine.anyProviderEnabled) "El GPS está desactivado" else null
                if (problem != status.locationProblem) tracker.updateStatus { it.copy(locationProblem = problem) }
                val now = System.currentTimeMillis()
                val loc = lastLocation
                if (loc != null && policy.heartbeatDue(lastSent, now)) send(payload(loc, now))
                else if (tracker.queue.size() > 0) flushPending()
            }
        }
    }

    private suspend fun observeStatus() {
        tracker.status.collect { s ->
            val company = tracker.link.value?.company ?: return@collect
            if (begun) Notifications.update(this, Notifications.tracking(this, company, s))
        }
    }

    companion object {
        const val ACTION_STOP = "com.octopustrack.app.tracker.STOP"
        const val ACTION_PAUSE = "com.octopustrack.app.tracker.PAUSE"
        const val ACTION_RESUME = "com.octopustrack.app.tracker.RESUME"
        const val ACTION_START = "com.octopustrack.app.tracker.START"

        fun start(context: Context) =
            ContextCompat.startForegroundService(context, Intent(context, TrackingService::class.java).setAction(ACTION_START))

        fun send(context: Context, action: String) =
            context.startService(Intent(context, TrackingService::class.java).setAction(action))
    }
}
