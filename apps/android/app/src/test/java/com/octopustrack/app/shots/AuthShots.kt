package com.octopustrack.app.shots

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.RobolectricDeviceQualifiers
import com.github.takahirom.roborazzi.captureRoboImage
import com.octopustrack.app.ui.auth.LoginScreen
import com.octopustrack.app.ui.auth.WelcomeScreen
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
class AuthShots {
    @get:Rule val rule = createComposeRule()

    private fun shot(name: String, dark: Boolean = false, content: @Composable () -> Unit) {
        rule.setContent { OctopusTheme(darkTheme = dark) { content() } }
        rule.onRoot().captureRoboImage("build/shots/$name.png")
    }

    @Test fun welcome() = shot("welcome") { WelcomeScreen({}, {}) }

    @Test fun login() = shot("login") {
        LoginScreen("https://octopus-track.vercel.app", {}, false, "ana@empresa.com", {}, "secreto", {}, false, null, {}, {})
    }

    @Test fun loginError() = shot("login_error_dark", dark = true) {
        LoginScreen("https://octopus-track.vercel.app", {}, false, "ana@empresa.com", {}, "secreto", {}, false, "Correo o contraseña incorrectos", {}, {})
    }
}
