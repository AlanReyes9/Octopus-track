package com.octopustrack.app.ui.account

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.octopustrack.app.data.TenantDto
import com.octopustrack.app.data.UserDto
import com.octopustrack.app.ui.brand.Ic
import com.octopustrack.app.ui.brand.LIcon
import com.octopustrack.app.ui.components.BrandButton
import com.octopustrack.app.ui.components.InlineMessage
import com.octopustrack.app.ui.components.Pill
import com.octopustrack.app.ui.components.ScreenTitle
import com.octopustrack.app.ui.components.SectionLabel
import com.octopustrack.app.ui.components.SoftCard
import com.octopustrack.app.ui.components.Tone
import com.octopustrack.app.ui.theme.Violet

data class AccountActions(
    val onSwitchTenant: (String) -> Unit = {},
    val onPushToggle: (Boolean) -> Unit = {},
    val onPushTest: () -> Unit = {},
    val onChangePassword: () -> Unit = {},
    val onOpenUrl: (String) -> Unit = {},
    val onLogout: () -> Unit = {},
)

@Composable
fun AccountScreen(
    user: UserDto,
    tenants: List<TenantDto>,
    server: String,
    pushAvailable: Boolean,
    pushOn: Boolean,
    version: String,
    actions: AccountActions,
    modifier: Modifier = Modifier,
    message: String? = null,
) {
    var confirmLogout by remember { mutableStateOf(false) }
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
        ScreenTitle("Cuenta")
        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SoftCard(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(56.dp).clip(CircleShape).background(Violet.V600), contentAlignment = Alignment.Center) {
                        Text(initials(user.name), style = MaterialTheme.typography.titleLarge, color = Color.White)
                    }
                    Spacer(Modifier.size(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(user.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(user.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Pill(user.roleLabel, if (user.canManage) Tone.Brand else Tone.Neutral, icon = if (user.canManage) Ic.ShieldCheck else Ic.User)
                            Pill(user.tenantName, Tone.Neutral, icon = Ic.Building)
                        }
                    }
                }
            }
            if (message != null) InlineMessage(message, tone = Tone.Brand, icon = Ic.Info)

            if (tenants.size > 1) {
                SectionLabel("Empresa")
                SoftCard(Modifier.fillMaxWidth()) {
                    Column {
                        tenants.forEachIndexed { i, t ->
                            Row(
                                Modifier.fillMaxWidth().clickable(enabled = t.id != user.tenantId) { actions.onSwitchTenant(t.id) }.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                LIcon(Ic.Building, tint = MaterialTheme.colorScheme.primary, size = 20.dp)
                                Spacer(Modifier.size(12.dp))
                                Text(t.name, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
                                if (t.id == user.tenantId) LIcon(Ic.Check, tint = MaterialTheme.colorScheme.primary, size = 18.dp)
                            }
                            if (i < tenants.lastIndex) androidx.compose.material3.HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        }
                    }
                }
            }

            SectionLabel("Preferencias")
            SoftCard(Modifier.fillMaxWidth()) {
                Column {
                    if (pushAvailable) {
                        SettingRow(Ic.BellRing, "Alertas en el teléfono", if (pushOn) "Activadas" else "Desactivadas") {
                            androidx.compose.material3.Switch(pushOn, actions.onPushToggle)
                        }
                        if (pushOn) {
                            androidx.compose.material3.HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                            SettingRow(Ic.Send, "Enviar notificación de prueba", null, onClick = actions.onPushTest)
                        }
                    } else {
                        SettingRow(Ic.BellOff, "Alertas push", "No disponibles en esta versión de la app")
                    }
                }
            }

            SectionLabel("Seguridad")
            SoftCard(Modifier.fillMaxWidth()) {
                SettingRow(Ic.Key, "Cambiar contraseña", null, onClick = actions.onChangePassword)
            }

            SectionLabel("Información")
            SoftCard(Modifier.fillMaxWidth()) {
                Column {
                    SettingRow(Ic.Server, "Servidor", server)
                    androidx.compose.material3.HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    SettingRow(Ic.ShieldCheck, "Política de privacidad", null) { actions.onOpenUrl("$server/legal/privacidad") }
                    androidx.compose.material3.HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    SettingRow(Ic.Info, "Términos de uso", null) { actions.onOpenUrl("$server/legal/terminos") }
                    androidx.compose.material3.HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    SettingRow(Ic.Link, "Licencias de código abierto", null) { actions.onOpenUrl("$server/legal/licencias") }
                }
            }
            Spacer(Modifier.height(6.dp))
            BrandButton("Cerrar sesión", { confirmLogout = true }, Modifier.fillMaxWidth(), kind = com.octopustrack.app.ui.components.ButtonKind.Outline, icon = Ic.LogOut)
            Text("Octopus Track $version", Modifier.fillMaxWidth().padding(top = 4.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
    }
    if (confirmLogout) AlertDialog(
        onDismissRequest = { confirmLogout = false },
        title = { Text("¿Cerrar sesión?") },
        text = { Text("Dejarás de recibir alertas en este teléfono hasta que vuelvas a entrar.") },
        confirmButton = { TextButton(onClick = { confirmLogout = false; actions.onLogout() }) { Text("Cerrar sesión", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text("Cancelar") } },
    )
}

private fun initials(name: String) = name.trim().split(Regex("\\s+")).take(2).mapNotNull { it.firstOrNull()?.uppercaseChar() }.joinToString("").ifEmpty { "?" }

@Composable
private fun SettingRow(@DrawableRes icon: Int, title: String, subtitle: String?, onClick: (() -> Unit)? = null, trailing: (@Composable () -> Unit)? = null) {
    Row(
        Modifier.fillMaxWidth().let { if (onClick != null) it.clickable(onClick = onClick) else it }.padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) {
            LIcon(icon, tint = MaterialTheme.colorScheme.primary, size = 18.dp)
        }
        Spacer(Modifier.size(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (trailing != null) trailing() else if (onClick != null) LIcon(Ic.ChevronRight, tint = MaterialTheme.colorScheme.onSurfaceVariant, size = 18.dp)
    }
}

/** Cambio de contraseña (también se usa cuando el administrador obliga a cambiarla). */
@Composable
fun ChangePasswordScreen(
    forced: Boolean,
    loading: Boolean,
    error: String?,
    onSubmit: (current: String, next: String) -> Unit,
    onBack: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var repeat by remember { mutableStateOf("") }
    val mismatch = repeat.isNotEmpty() && next != repeat
    val tooShort = next.isNotEmpty() && next.length < 8
    Column(modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState()).navigationBarsPadding().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (onBack != null) Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) { LIcon(Ic.ArrowLeft, size = 22.dp) }
        Text(if (forced) "Crea tu contraseña" else "Cambiar contraseña", style = MaterialTheme.typography.headlineSmall)
        Text(
            if (forced) "Tu administrador te dio una contraseña temporal. Elige una nueva para continuar." else "Usa al menos 8 caracteres.",
            style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (error != null) InlineMessage(error)
        val shape = RoundedCornerShape(16.dp)
        OutlinedTextField(current, { current = it }, Modifier.fillMaxWidth(), label = { Text("Contraseña actual") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), shape = shape)
        OutlinedTextField(next, { next = it }, Modifier.fillMaxWidth(), label = { Text("Nueva contraseña") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), shape = shape, isError = tooShort, supportingText = { if (tooShort) Text("Mínimo 8 caracteres") })
        OutlinedTextField(repeat, { repeat = it }, Modifier.fillMaxWidth(), label = { Text("Repite la nueva contraseña") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), shape = shape, isError = mismatch, supportingText = { if (mismatch) Text("No coinciden") })
        BrandButton("Guardar contraseña", { onSubmit(current, next) }, Modifier.fillMaxWidth(), loading = loading, enabled = current.isNotEmpty() && next.length >= 8 && next == repeat)
    }
}
