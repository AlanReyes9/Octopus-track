package com.octopustrack.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.octopustrack.app.data.PairingLink
import com.octopustrack.app.push.Notifications
import com.octopustrack.app.ui.AppRoot
import com.octopustrack.app.ui.theme.OctopusTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as OctopusApp).container
        if (savedInstanceState == null) handle(intent)
        setContent { OctopusTheme { AppRoot(container) } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    /** Enlace de vinculación (https://…/rastreo#t=… u octopustrack://track…) o toque en una notificación. */
    private fun handle(intent: Intent?) {
        val container = (application as OctopusApp).container
        intent?.getStringExtra(Notifications.EXTRA_DEVICE_ID)?.let { container.deepLinks.tryEmit(DeepLink.Unit(it)) }
        intent?.dataString?.let { raw ->
            PairingLink.parse(raw)?.let { container.deepLinks.tryEmit(DeepLink.Pairing(it.token, it.server)) }
        }
    }
}
