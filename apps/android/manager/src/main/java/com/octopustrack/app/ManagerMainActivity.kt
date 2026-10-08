package com.octopustrack.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.octopustrack.app.push.Notifications
import com.octopustrack.app.ui.ManagerRoot
import com.octopustrack.app.ui.theme.OctopusTheme

class ManagerMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as ManagerApp).container
        if (savedInstanceState == null) handle(intent)
        setContent { OctopusTheme { ManagerRoot(container) } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    /** Toque en una notificación de alerta o mensaje: abre esa unidad en el mapa. */
    private fun handle(intent: Intent?) {
        val container = (application as ManagerApp).container
        intent?.getStringExtra(Notifications.EXTRA_DEVICE_ID)?.let { container.deepLinks.tryEmit(DeepLink(it)) }
    }
}
