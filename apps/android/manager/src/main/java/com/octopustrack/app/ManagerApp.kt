package com.octopustrack.app

import android.app.Application
import com.octopustrack.app.push.Notifications
import org.maplibre.android.MapLibre

class ManagerApp : Application() {
    lateinit var container: ManagerContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = ManagerContainer(this)
        Notifications.ensureChannels(this)
        MapLibre.getInstance(this)
    }
}
