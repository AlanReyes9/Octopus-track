package com.octopustrack.app.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.RobolectricDeviceQualifiers
import com.github.takahirom.roborazzi.captureRoboImage
import com.octopustrack.app.data.LiveAlert
import com.octopustrack.app.data.LiveMode
import com.octopustrack.app.data.TenantDto
import com.octopustrack.app.data.UserDto
import com.octopustrack.app.tracker.TrackerStatus
import com.octopustrack.app.ui.account.AccountActions
import com.octopustrack.app.ui.account.AccountScreen
import com.octopustrack.app.ui.commands.CommandsContent
import com.octopustrack.app.ui.commands.CommandsUi
import com.octopustrack.app.data.CommandCatalog
import com.octopustrack.app.data.CommandDef
import com.octopustrack.app.data.CommandParamDef
import com.octopustrack.app.ui.home.GeofencesScreen
import com.octopustrack.app.ui.home.LivePanel
import com.octopustrack.app.ui.home.Section
import com.octopustrack.app.ui.home.SidebarHeader
import com.octopustrack.app.ui.map.UnitSheet
import com.octopustrack.app.ui.theme.OctopusTheme
import com.octopustrack.app.ui.tracker.ConsentScreen
import com.octopustrack.app.ui.tracker.PermissionState
import com.octopustrack.app.ui.tracker.PermissionsScreen
import com.octopustrack.app.ui.tracker.ShareLinkScreen
import com.octopustrack.app.ui.tracker.TrackingScreen
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = RobolectricDeviceQualifiers.Pixel7, sdk = [34], application = android.app.Application::class)
class HomeShots {
    @get:Rule val rule = createComposeRule()

    private fun shot(name: String, dark: Boolean = false, content: @Composable () -> Unit) {
        rule.setContent { OctopusTheme(darkTheme = dark) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) { content() } } }
        rule.onRoot().captureRoboImage("build/shots/$name.png")
    }

    private val tenants = listOf(TenantDto("t1", "Transportes Aurora", "owner"), TenantDto("t2", "Flota Norte", "admin"))
    private val user = UserDto("u1", "Alan Reyes", "alan@aurora.mx", "owner", "t1", "Transportes Aurora")
    private val alerts = listOf(LiveAlert("1", "Bodega Central", true, NOW.minusSeconds(120).toString()))

    @Test fun live() = shot("live") {
        Column(Modifier.fillMaxSize()) {
            SidebarHeader(tenants, "t1", true, Section.Live, {}, {})
            LivePanel(SAMPLE_UNITS, alerts, LiveMode.Realtime, true, true, "", {}, "1", Modifier.weight(0.46f), now = NOW) {}
            Box(Modifier.weight(0.54f).fillMaxWidth().background(Color(0xFFE8E4F5)))
        }
    }

    @Test fun unitSheet() = shot("unit_sheet") {
        Box(Modifier.fillMaxSize().background(Color(0xFFE8E4F5))) {
            UnitSheet(SAMPLE_UNITS[0], true, true, {}, {}, {}, {}, {}, {}, Modifier.align(Alignment.BottomCenter), now = NOW)
        }
    }

    @Test fun account() = shot("account") { AccountScreen(user, tenants, "https://octopus-track.vercel.app", true, true, "1.0.0", AccountActions()) }

    @Test fun commands() = shot("commands") {
        val cat = CommandCatalog("gt06", listOf(
            CommandDef("positionSingle", "Solicitar posición", "Pide una ubicación ahora"),
            CommandDef("engineStop", "Cortar motor", "Corta el combustible o la ignición", dangerous = true),
            CommandDef("setInterval", "Intervalo de reporte", "Cada cuántos segundos reporta", params = listOf(CommandParamDef("seconds", "Segundos"))),
        ))
        CommandsContent(SAMPLE_UNITS[0], CommandsUi(catalog = cat), onSend = { _, _ -> }, onSaveTemplate = { _, _ -> }, onCancel = {})
    }

    @Test fun geofences() = shot("geofences") { GeofencesScreen(emptyList(), SAMPLE_EVENTS, today = java.time.LocalDate.of(2026, 10, 8)) }

    @Test fun shareLink() = shot("share_link") { ShareLinkScreen("", {}, false, null, {}, {}, {}) }
    @Test fun consent() = shot("consent") { ConsentScreen("Transportes Aurora", "Teléfono de Ana", "Ana", {}, false, null, {}, {}) }
    @Test fun permissions() = shot("permissions") { PermissionsScreen(PermissionState(true, false, true, false), {}, {}, {}, {}, {}) }
    @Test fun tracking() = shot("tracking") {
        TrackingScreen("Transportes Aurora", "Teléfono de Ana", TrackerStatus(running = true, lastSentIso = NOW.toString(), accuracyM = 9, sentCount = 42, pending = 0), {}, {}, {}, {})
    }
}
