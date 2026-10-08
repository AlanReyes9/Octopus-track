package com.octopustrack.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.octopustrack.app.data.PairingLink
import com.octopustrack.app.ui.ClientRoot
import com.octopustrack.app.ui.theme.OctopusTheme

class ClientMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as ClientApp).container
        if (savedInstanceState == null) handle(intent)
        setContent { OctopusTheme { ClientRoot(container) } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    /** Enlace de vinculación: https://<servidor>/rastreo#t=<token> u octopustrack://track?t=<token> */
    private fun handle(intent: Intent?) {
        val container = (application as ClientApp).container
        intent?.dataString?.let { raw -> PairingLink.parse(raw)?.let { container.deepLinks.tryEmit(it) } }
    }
}
