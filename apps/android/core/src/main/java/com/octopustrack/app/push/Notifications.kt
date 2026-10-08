package com.octopustrack.app.push

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.octopustrack.app.R
import com.octopustrack.app.tracker.TrackerStatus
import com.octopustrack.app.tracker.TrackingService
import com.octopustrack.app.data.Formatting

object Notifications {
    const val CH_TRACKING = "tracking"
    const val CH_ALERTS = "alerts"
    const val CH_MESSAGES = "messages"
    const val ID_TRACKING = 1001
    private const val ID_MESSAGE = 1002
    const val EXTRA_DEVICE_ID = "device_id"

    fun ensureChannels(ctx: Context) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(CH_TRACKING, ctx.getString(R.string.channel_tracking), NotificationManager.IMPORTANCE_LOW)
                .apply { description = ctx.getString(R.string.channel_tracking_desc); setShowBadge(false) },
        )
        nm.createNotificationChannel(
            NotificationChannel(CH_ALERTS, ctx.getString(R.string.channel_alerts), NotificationManager.IMPORTANCE_HIGH)
                .apply { description = ctx.getString(R.string.channel_alerts_desc) },
        )
        nm.createNotificationChannel(
            NotificationChannel(CH_MESSAGES, ctx.getString(R.string.channel_messages), NotificationManager.IMPORTANCE_HIGH)
                .apply { description = ctx.getString(R.string.channel_messages_desc) },
        )
    }

    /** Abre la actividad principal de la app que llama (cada app declara la suya). */
    private fun openApp(ctx: Context, deviceId: String? = null): PendingIntent {
        val intent = (ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .apply { if (deviceId != null) putExtra(EXTRA_DEVICE_ID, deviceId) }
        return PendingIntent.getActivity(ctx, deviceId?.hashCode() ?: 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    private fun serviceAction(ctx: Context, action: String, code: Int) =
        PendingIntent.getService(ctx, code, Intent(ctx, TrackingService::class.java).setAction(action), PendingIntent.FLAG_IMMUTABLE)

    /** Aviso permanente mientras se comparte la ubicación (obligatorio en un servicio en primer plano). */
    fun tracking(ctx: Context, company: String, s: TrackerStatus): android.app.Notification {
        val text = when {
            s.revoked -> "Se dejó de compartir"
            s.paused -> "En pausa · nadie ve tu ubicación"
            s.locationProblem != null -> s.locationProblem
            s.offline -> "Sin conexión · se guarda y se enviará después"
            s.lastSentIso != null -> "Último envío ${Formatting.clockSeconds(s.lastSentIso)}"
            else -> "Buscando tu ubicación…"
        }
        val b = NotificationCompat.Builder(ctx, CH_TRACKING)
            .setSmallIcon(R.drawable.ic_stat_octopus)
            .setContentTitle(if (s.paused) "Ubicación en pausa" else "Compartiendo ubicación con $company")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setColor(0xFF7C3AED.toInt())
            .setContentIntent(openApp(ctx))
        if (s.paused) b.addAction(0, "Reanudar", serviceAction(ctx, TrackingService.ACTION_RESUME, 1))
        else b.addAction(0, "Pausar", serviceAction(ctx, TrackingService.ACTION_PAUSE, 2))
        return b.build()
    }

    @SuppressLint("MissingPermission")
    fun update(ctx: Context, notification: android.app.Notification) {
        runCatching { NotificationManagerCompat.from(ctx).notify(ID_TRACKING, notification) }
    }

    @SuppressLint("MissingPermission")
    fun message(ctx: Context, company: String, text: String) {
        val n = NotificationCompat.Builder(ctx, CH_MESSAGES)
            .setSmallIcon(R.drawable.ic_stat_octopus)
            .setContentTitle("Mensaje de $company")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setColor(0xFF7C3AED.toInt())
            .setContentIntent(openApp(ctx))
            .build()
        runCatching { NotificationManagerCompat.from(ctx).notify(ID_MESSAGE, n) }
    }

    /** Alerta de geocerca (llega por FCM). Al tocarla abre la unidad en el mapa. */
    @SuppressLint("MissingPermission")
    fun alert(ctx: Context, title: String, body: String, deviceId: String?, tag: String?) {
        val n = NotificationCompat.Builder(ctx, CH_ALERTS)
            .setSmallIcon(R.drawable.ic_stat_octopus)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setColor(0xFF7C3AED.toInt())
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setContentIntent(openApp(ctx, deviceId))
            .build()
        runCatching { NotificationManagerCompat.from(ctx).notify(tag ?: "alert", (tag ?: title).hashCode(), n) }
    }
}
