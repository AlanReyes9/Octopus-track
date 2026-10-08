package com.octopustrack.app.ui.brand

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.octopustrack.app.R
import com.composables.icons.lucide.R as L

/**
 * Iconos Lucide (los mismos que usa la web), como recursos vectoriales.
 * Un nombre por uso para mantener la coherencia visual entre web y app.
 */
object Ic {
    val Map = L.drawable.lucide_ic_map
    val List = L.drawable.lucide_ic_list
    val Bell = L.drawable.lucide_ic_bell
    val BellRing = L.drawable.lucide_ic_bell_ring
    val BellOff = L.drawable.lucide_ic_bell_off
    val User = L.drawable.lucide_ic_user
    val CircleUser = L.drawable.lucide_ic_circle_user
    val Search = L.drawable.lucide_ic_search
    val Navigation = L.drawable.lucide_ic_navigation
    val ExternalLink = L.drawable.lucide_ic_external_link
    val History = L.drawable.lucide_ic_history
    val Send = L.drawable.lucide_ic_send
    val Crosshair = L.drawable.lucide_ic_crosshair
    val LocateFixed = L.drawable.lucide_ic_locate_fixed
    val Gauge = L.drawable.lucide_ic_gauge
    val Power = L.drawable.lucide_ic_power
    val Battery = L.drawable.lucide_ic_battery
    val Clock = L.drawable.lucide_ic_clock
    val Close = L.drawable.lucide_ic_x
    val ChevronRight = L.drawable.lucide_ic_chevron_right
    val ChevronLeft = L.drawable.lucide_ic_chevron_left
    val ArrowLeft = L.drawable.lucide_ic_arrow_left
    val LogOut = L.drawable.lucide_ic_log_out
    val LogIn = L.drawable.lucide_ic_log_in
    val ShieldCheck = L.drawable.lucide_ic_shield_check
    val MapPin = L.drawable.lucide_ic_map_pin
    val Radio = L.drawable.lucide_ic_radio
    val Lock = L.drawable.lucide_ic_lock
    val Eye = L.drawable.lucide_ic_eye
    val EyeOff = L.drawable.lucide_ic_eye_off
    val Settings = L.drawable.lucide_ic_settings
    val Zap = L.drawable.lucide_ic_zap
    val QrCode = L.drawable.lucide_ic_scan_line
    val Play = L.drawable.lucide_ic_play
    val Pause = L.drawable.lucide_ic_pause
    val Check = L.drawable.lucide_ic_check
    val Info = L.drawable.lucide_ic_info
    val Warning = L.drawable.lucide_ic_triangle_alert
    val Plus = L.drawable.lucide_ic_plus
    val WifiOff = L.drawable.lucide_ic_wifi_off
    val Refresh = L.drawable.lucide_ic_refresh_cw
    val Copy = L.drawable.lucide_ic_copy
    val Key = L.drawable.lucide_ic_key_round
    val Server = L.drawable.lucide_ic_server
    val Link = L.drawable.lucide_ic_link
    val Building = L.drawable.lucide_ic_building_2
    val Repeat = L.drawable.lucide_ic_repeat
    val Route = L.drawable.lucide_ic_route
    val Flag = L.drawable.lucide_ic_flag
    val Message = L.drawable.lucide_ic_message_square
    val MoonStar = L.drawable.lucide_ic_moon_star
    val Trash = L.drawable.lucide_ic_trash_2
    val Shapes = L.drawable.lucide_ic_shapes
    val Smartphone = L.drawable.lucide_ic_smartphone
    val Activity = L.drawable.lucide_ic_activity
    val Cpu = L.drawable.lucide_ic_cpu
    val Users = L.drawable.lucide_ic_users
    val Network = L.drawable.lucide_ic_network
    val UserCog = L.drawable.lucide_ic_user_cog
    val ChevronsUpDown = L.drawable.lucide_ic_chevrons_up_down
    val Dashboard = L.drawable.lucide_ic_layout_dashboard
    val Compass = L.drawable.lucide_ic_compass
}

/** Icono de una unidad según el id que guarda el servidor (mismos 15 que la web). */
@DrawableRes
fun unitIconRes(id: String?): Int = when (id) {
    "car" -> L.drawable.lucide_ic_car
    "pickup" -> L.drawable.lucide_ic_car_front
    "taxi" -> L.drawable.lucide_ic_car_taxi_front
    "truck" -> L.drawable.lucide_ic_truck
    "bus" -> L.drawable.lucide_ic_bus
    "moto" -> R.drawable.ic_motorcycle
    "bike" -> L.drawable.lucide_ic_bike
    "ambulance" -> L.drawable.lucide_ic_ambulance
    "tractor" -> L.drawable.lucide_ic_tractor
    "forklift" -> L.drawable.lucide_ic_forklift
    "trailer" -> L.drawable.lucide_ic_caravan
    "boat" -> L.drawable.lucide_ic_ship
    "asset" -> L.drawable.lucide_ic_package
    "person" -> L.drawable.lucide_ic_person_standing
    "phone" -> L.drawable.lucide_ic_smartphone
    else -> L.drawable.lucide_ic_car
}

val UNIT_ICON_IDS = listOf("car", "pickup", "taxi", "truck", "bus", "moto", "bike", "ambulance", "tractor", "forklift", "trailer", "boat", "asset", "person", "phone")

/** Icono de trazo: se tiñe con [tint] (por defecto el color del contenido). */
@Composable
fun LIcon(@DrawableRes id: Int, modifier: Modifier = Modifier, tint: Color = LocalContentColor.current, size: Dp = 20.dp) {
    Image(
        painter = painterResource(id),
        contentDescription = null,
        modifier = modifier.size(size),
        colorFilter = ColorFilter.tint(tint),
    )
}
