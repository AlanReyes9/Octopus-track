package com.octopustrack.app.shots

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.runtime.Composable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import com.github.takahirom.roborazzi.RobolectricDeviceQualifiers
import com.github.takahirom.roborazzi.captureRoboImage
import com.octopustrack.app.ui.home.AlertsScreen
import com.octopustrack.app.ui.home.UnitsScreen
import com.octopustrack.app.ui.theme.OctopusTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = RobolectricDeviceQualifiers.Pixel7, sdk = [34], application = android.app.Application::class)
class FleetShots {
    @get:Rule val rule = createComposeRule()

    private fun shot(name: String, dark: Boolean = false, content: @Composable () -> Unit) {
        rule.setContent { OctopusTheme(darkTheme = dark) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) { content() } } }
        rule.onRoot().captureRoboImage("build/shots/$name.png")
    }

    @Test fun units() = shot("units") { UnitsScreen(SAMPLE_UNITS, true, true, {}, now = NOW) }
    @Test fun unitsDark() = shot("units_dark", dark = true) { UnitsScreen(SAMPLE_UNITS, true, true, {}, now = NOW) }
    @Test fun alerts() = shot("alerts") { AlertsScreen(SAMPLE_EVENTS, null, today = java.time.LocalDate.of(2026, 10, 8)) }
}
