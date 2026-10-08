package com.octopustrack.app.ui.auth

import androidx.compose.foundation.background
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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.clickable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.octopustrack.app.ui.brand.BrandBackground
import com.octopustrack.app.ui.brand.Ic
import com.octopustrack.app.ui.brand.LIcon
import com.octopustrack.app.ui.brand.OctopusLogo
import com.octopustrack.app.ui.components.BrandButton
import com.octopustrack.app.ui.components.ButtonKind
import com.octopustrack.app.ui.components.InlineMessage
import com.octopustrack.app.ui.theme.Violet

/** Primera pantalla: elige entre entrar a la cuenta o compartir la ubicación de este teléfono. */
@Composable
fun WelcomeScreen(onLogin: () -> Unit, onShare: () -> Unit, modifier: Modifier = Modifier) {
    BrandBackground(modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 24.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.weight(1f))
            OctopusLogo(inverted = true, markSize = 72.dp)
            Spacer(Modifier.height(20.dp))
            Text(
                "Tu flota, siempre a la vista",
                style = MaterialTheme.typography.headlineMedium, color = Color.White, textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "Sigue vehículos y personas en tiempo real, recibe alertas y envía comandos desde tu bolsillo.",
                style = MaterialTheme.typography.bodyLarge, color = Violet.V100, textAlign = TextAlign.Center,
            )
            Spacer(Modifier.weight(1f))
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                BrandButton("Iniciar sesión", onLogin, Modifier.fillMaxWidth(), kind = ButtonKind.OnDark, icon = Ic.LogIn)
                BrandButton(
                    "Compartir mi ubicación", onShare, Modifier.fillMaxWidth(), kind = ButtonKind.Outline, icon = Ic.MapPin,
                    colorOverride = Color.White,
                )
                Text(
                    "Solo se comparte tu ubicación si tú lo aceptas, y puedes dejar de hacerlo cuando quieras.",
                    style = MaterialTheme.typography.bodySmall, color = Violet.V200, textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
fun LoginScreen(
    server: String,
    onServerChange: (String) -> Unit,
    serverEditable: Boolean,
    email: String,
    onEmailChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    loading: Boolean,
    error: String?,
    onSubmit: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var showPassword by remember { mutableStateOf(false) }
    var showServer by remember { mutableStateOf(serverEditable) }
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedContainerColor = MaterialTheme.colorScheme.surface,
        unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant,
    )
    BrandBackground(modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState())) {
            Row(Modifier.padding(8.dp)) {
                Box(
                    Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onBack),
                    contentAlignment = Alignment.Center,
                ) { LIcon(Ic.ArrowLeft, tint = Color.White, size = 22.dp) }
            }
            Column(Modifier.padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                OctopusLogo(inverted = true, markSize = 48.dp)
                Spacer(Modifier.height(8.dp))
                Text("Bienvenido de nuevo", style = MaterialTheme.typography.titleMedium, color = Violet.V100)
            }
            Spacer(Modifier.height(24.dp))
            Column(
                Modifier.fillMaxWidth().weight(1f, fill = true)
                    .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .navigationBarsPadding().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text("Iniciar sesión", style = MaterialTheme.typography.headlineSmall)
                if (error != null) InlineMessage(error)
                if (showServer) {
                    OutlinedTextField(
                        server, onServerChange, Modifier.fillMaxWidth(), label = { Text("Servidor") }, singleLine = true,
                        leadingIcon = { LIcon(Ic.Server, size = 18.dp) }, shape = RoundedCornerShape(16.dp), colors = fieldColors,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Next),
                    )
                }
                OutlinedTextField(
                    email, onEmailChange, Modifier.fillMaxWidth(), label = { Text("Correo electrónico") }, singleLine = true,
                    leadingIcon = { LIcon(Ic.User, size = 18.dp) }, shape = RoundedCornerShape(16.dp), colors = fieldColors,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                )
                OutlinedTextField(
                    password, onPasswordChange, Modifier.fillMaxWidth(), label = { Text("Contraseña") }, singleLine = true,
                    leadingIcon = { LIcon(Ic.Lock, size = 18.dp) },
                    trailingIcon = {
                        Box(Modifier.size(40.dp).clip(CircleShape).clickable { showPassword = !showPassword }, contentAlignment = Alignment.Center) {
                            LIcon(if (showPassword) Ic.EyeOff else Ic.Eye, size = 18.dp)
                        }
                    },
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    shape = RoundedCornerShape(16.dp), colors = fieldColors,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { if (!loading) onSubmit() }),
                )
                BrandButton(
                    "Entrar", onSubmit, Modifier.fillMaxWidth(), loading = loading,
                    enabled = email.isNotBlank() && password.isNotEmpty(),
                )
                if (!showServer) {
                    Text(
                        "Usar otro servidor", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.align(Alignment.CenterHorizontally).clip(RoundedCornerShape(8.dp)).clickable { showServer = true }.padding(8.dp),
                    )
                }
            }
        }
    }
}
