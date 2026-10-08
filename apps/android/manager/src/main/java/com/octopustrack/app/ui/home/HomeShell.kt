package com.octopustrack.app.ui.home

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.octopustrack.app.data.TenantDto
import com.octopustrack.app.ui.brand.Ic
import com.octopustrack.app.ui.brand.LIcon
import com.octopustrack.app.ui.brand.OctopusLogo
import com.octopustrack.app.ui.theme.Violet

/** Mismas secciones que el menú lateral de la web. */
enum class Section(val label: String, @DrawableRes val icon: Int, val manage: Boolean = false, val webPath: String? = null) {
    Live("Mapa en vivo", Ic.Dashboard),
    History("Historial", Ic.History),
    Geofences("Geocercas", Ic.Shapes),
    Devices("Dispositivos", Ic.Cpu, manage = true, webPath = "/devices"),
    Users("Usuarios", Ic.Users, manage = true, webPath = "/users"),
    Protocols("Protocolos", Ic.Network, manage = true, webPath = "/protocols"),
    Account("Mi cuenta", Ic.UserCog),
}

fun sectionsFor(canManage: Boolean) = Section.entries.filter { !it.manage || canManage }

/** Cabecera violeta oscura (el menú lateral de la web en su versión móvil): logo, empresa y secciones. */
@Composable
fun SidebarHeader(
    tenants: List<TenantDto>,
    activeTenantId: String,
    canManage: Boolean,
    current: Section,
    onSection: (Section) -> Unit,
    onSwitchTenant: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier.fillMaxWidth()
            .background(Violet.V950)
            .drawBehind {
                drawRect(Brush.verticalGradient(listOf(Violet.V500.copy(alpha = .25f), Color.Transparent), endY = size.height))
            }
            .statusBarsPadding(),
    ) {
        Row(Modifier.padding(start = 16.dp, end = 12.dp, top = 12.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            OctopusLogo(inverted = true, markSize = 30.dp)
            Spacer(Modifier.weight(1f))
            TenantPicker(tenants, activeTenantId, onSwitchTenant)
        }
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp).padding(bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            sectionsFor(canManage).forEach { s -> NavPill(s, s == current) { onSection(s) } }
        }
    }
}

@Composable
private fun TenantPicker(tenants: List<TenantDto>, activeId: String, onSwitch: (String) -> Unit) {
    val active = tenants.firstOrNull { it.id == activeId } ?: tenants.firstOrNull() ?: return
    var open by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier.clip(RoundedCornerShape(10.dp)).background(Color.White.copy(alpha = .1f))
                .border(1.dp, Color.White.copy(alpha = .1f), RoundedCornerShape(10.dp))
                .clickable(enabled = tenants.size > 1) { open = true }.padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(active.name, style = MaterialTheme.typography.labelLarge, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(end = if (tenants.size > 1) 6.dp else 0.dp))
            if (tenants.size > 1) LIcon(Ic.ChevronsUpDown, tint = Color.White.copy(alpha = .6f), size = 14.dp)
        }
        DropdownMenu(open, { open = false }) {
            tenants.forEach { t -> DropdownMenuItem(text = { Text(t.name) }, onClick = { open = false; if (t.id != activeId) onSwitch(t.id) }) }
        }
    }
}

@Composable
private fun NavPill(s: Section, active: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(10.dp))
            .background(if (active) Color.White.copy(alpha = .15f) else Color.Transparent)
            .clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LIcon(s.icon, tint = if (active) Color.White else Violet.V200, size = 16.dp)
        Spacer(Modifier.size(7.dp))
        Text(s.label, style = MaterialTheme.typography.labelLarge, color = if (active) Color.White else Violet.V200, maxLines = 1)
    }
}
