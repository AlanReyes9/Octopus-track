package com.octopustrack.app

import android.app.Application
import com.octopustrack.app.push.Notifications
import com.octopustrack.app.tracker.TrackerHost
import com.octopustrack.app.tracker.TrackerRepository

class ClientApp : Application(), TrackerHost {
    lateinit var container: ClientContainer
        private set

    override val tracker: TrackerRepository get() = container.tracker

    override fun onCreate() {
        super.onCreate()
        container = ClientContainer(this)
        Notifications.ensureChannels(this)
    }
}
