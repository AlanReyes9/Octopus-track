package com.octopustrack.app.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.RobolectricDeviceQualifiers
import com.github.takahirom.roborazzi.captureRoboImage
import com.octopustrack.app.tracker.TrackerStatus
import com.octopustrack.app.ui.theme.OctopusTheme
import com.octopustrack.app.ui.tracker.ConsentScreen
import com.octopustrack.app.ui.tracker.PermissionState
import com.octopustrack.app.ui.tracker.PermissionsScreen
import com.octopustrack.app.ui.tracker.ShareLinkScreen
import com.octopustrack.app.ui.tracker.TrackingScreen
import java.time.Instant
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = RobolectricDeviceQualifiers.Pixel7, sdk = [34], application = android.app.Application::class)
class ClientShots {
    @get:Rule val rule = createComposeRule()
    private val now: Instant = Instant.parse("2026-10-08T15:00:00Z")

    private fun shot(name: String, dark: Boolean = false, content: @Composable () -> Unit) {
        rule.setContent { OctopusTheme(darkTheme = dark) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) { content() } } }
        rule.onRoot().captureRoboImage("build/shots/$name.png")
    }

    @Test fun shareLink() = shot("share_link") { ShareLinkScreen("", {}, false, null, {}, {}, {}) }
    @Test fun consent() = shot("consent") { ConsentScreen("Transportes Aurora", "Teléfono de Ana", "Ana", {}, false, null, {}, {}) }
    @Test fun permissions() = shot("permissions") { PermissionsScreen(PermissionState(true, false, true, false), {}, {}, {}, {}, {}) }
    @Test fun tracking() = shot("tracking") {
        TrackingScreen("Transportes Aurora", "Teléfono de Ana", TrackerStatus(running = true, lastSentIso = now.toString(), accuracyM = 9, sentCount = 42, pending = 0), {}, {}, {}, {})
    }
}
