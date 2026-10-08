package com.octopustrack.app

import android.app.Application
import com.octopustrack.app.push.Notifications
import org.maplibre.android.MapLibre

class OctopusApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        Notifications.ensureChannels(this)
        MapLibre.getInstance(this)
    }
}
