package com.octopustrack.app.push

import android.app.Service
import android.content.Intent
import android.os.IBinder

/** Sin Firebase (no hay google-services.json) este servicio no hace nada. */
class OctopusMessagingService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
}
