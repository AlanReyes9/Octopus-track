package com.octopustrack.app.ui

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.octopustrack.app.ClientContainer
import com.octopustrack.app.data.PairingLink
import com.octopustrack.app.ui.tracker.TrackerRoute

/**
 * Toda la app Cliente es el flujo del rastreador: vincular, aceptar, dar permisos y compartir.
 * Al "salir" desde el primer paso o tras dejar de compartir, se envía la app a segundo plano
 * (no hay a dónde más volver: esta app no tiene panel ni inicio de sesión).
 */
@Composable
fun ClientRoot(container: ClientContainer) {
    val context = LocalContext.current
    var pairing by remember { mutableStateOf<PairingLink.Parsed?>(null) }
    LaunchedEffect(Unit) { container.deepLinks.collect { pairing = it } }

    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        TrackerRoute(container.tracker, container.defaultServer, pairing) {
            (context as? Activity)?.moveTaskToBack(true)
        }
    }
}
