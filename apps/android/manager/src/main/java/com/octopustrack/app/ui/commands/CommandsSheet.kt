package com.octopustrack.app.ui.commands

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.octopustrack.app.data.ApiException
import com.octopustrack.app.data.CommandCatalog
import com.octopustrack.app.data.CommandDef
import com.octopustrack.app.data.CommandRowDto
import com.octopustrack.app.data.CommandTemplateDto
import com.octopustrack.app.data.CommandsRepository
import com.octopustrack.app.data.FleetUnit
import com.octopustrack.app.data.Formatting
import com.octopustrack.app.ui.brand.Ic
import com.octopustrack.app.ui.brand.LIcon
import com.octopustrack.app.ui.components.BrandButton
import com.octopustrack.app.ui.components.ButtonKind
import com.octopustrack.app.ui.components.Chip
import com.octopustrack.app.ui.components.EmptyState
import com.octopustrack.app.ui.components.InlineMessage
import com.octopustrack.app.ui.components.Pill
import com.octopustrack.app.ui.components.SoftCard
import com.octopustrack.app.ui.components.Tone
import com.octopustrack.app.ui.components.UnitAvatar
import kotlinx.coroutines.launch
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

enum class CommandTab(val label: String) { Presets("Predefinidos"), Custom("Personalizado"), History("Historial") }

data class CommandsUi(
    val catalog: CommandCatalog? = null,
    val templates: List<CommandTemplateDto> = emptyList(),
    val history: List<CommandRowDto> = emptyList(),
    val loadError: String? = null,
    val sending: Boolean = false,
    val feedback: String? = null,
    val feedbackIsError: Boolean = false,
)

fun statusTone(status: String) = when (status) {
    "delivered", "acked", "done" -> Tone.Success
    "failed", "error", "expired" -> Tone.Danger
    "cancelled" -> Tone.Neutral
    else -> Tone.Warning
}

fun statusLabel(status: String) = when (status) {
    "pending" -> "Pendiente"; "sent" -> "Enviado"; "delivered" -> "Entregado"; "acked", "done" -> "Confirmado"
    "failed", "error" -> "Fallido"; "expired" -> "Caducado"; "cancelled" -> "Cancelado"; else -> status
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommandsRoute(unit: FleetUnit, repo: CommandsRepository, onDismiss: () -> Unit) {
    var ui by remember { mutableStateOf(CommandsUi()) }
    val scope = rememberCoroutineScope()
    suspend fun reloadHistory() { ui = ui.copy(history = runCatching { repo.history(unit.id) }.getOrDefault(ui.history)) }
    LaunchedEffect(unit.id) {
        try {
            val cat = repo.catalog(unit.commandProtocol)
            ui = ui.copy(catalog = cat, templates = repo.templates().filter { it.protocol == null || it.protocol == unit.commandProtocol })
            reloadHistory()
        } catch (e: ApiException) { ui = ui.copy(loadError = e.message) }
    }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = MaterialTheme.colorScheme.background) {
        CommandsContent(
            unit, ui, Modifier.navigationBarsPadding(),
            onSend = { type, params ->
                scope.launch {
                    ui = ui.copy(sending = true, feedback = null)
                    ui = try {
                        repo.send(unit.id, type, params); ui.copy(sending = false, feedback = "Comando enviado", feedbackIsError = false)
                    } catch (e: ApiException) { ui.copy(sending = false, feedback = e.message ?: "No se pudo enviar", feedbackIsError = true) }
                    reloadHistory()
                }
            },
            onSaveTemplate = { name, data ->
                scope.launch {
                    ui = try {
                        repo.saveCustomTemplate(name, unit.commandProtocol, data)
                        ui.copy(templates = repo.templates(), feedback = "Plantilla guardada", feedbackIsError = false)
                    } catch (e: ApiException) { ui.copy(feedback = e.message, feedbackIsError = true) }
                }
            },
            onCancel = { id -> scope.launch { runCatching { repo.cancel(id) }; reloadHistory() } },
        )
    }
}

@Composable
fun CommandsContent(
    unit: FleetUnit,
    ui: CommandsUi,
    modifier: Modifier = Modifier,
    initialTab: CommandTab = CommandTab.Presets,
    onSend: (type: String, params: Map<String, String>) -> Unit,
    onSaveTemplate: (name: String, data: String) -> Unit,
    onCancel: (String) -> Unit,
) {
    var tab by remember { mutableStateOf(initialTab) }
    var confirm by remember { mutableStateOf<Pair<CommandDef, Map<String, String>>?>(null) }
    Column(modifier.fillMaxWidth().heightIn(min = 420.dp).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            UnitAvatar(unit.icon, unit.color, size = 40.dp)
            Spacer(Modifier.size(12.dp))
            Column {
                Text("Enviar comando", style = MaterialTheme.typography.titleMedium)
                Text(unit.name, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { CommandTab.entries.forEach { Chip(it.label, tab == it, { tab = it }) } }
        if (ui.feedback != null) InlineMessage(ui.feedback, tone = if (ui.feedbackIsError) Tone.Danger else Tone.Success, icon = if (ui.feedbackIsError) Ic.Warning else Ic.Check)
        Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            when (tab) {
                CommandTab.Presets -> when {
                    ui.loadError != null -> InlineMessage(ui.loadError)
                    ui.catalog == null -> Text("Cargando comandos…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    ui.catalog.commands.isEmpty() -> EmptyState(Ic.Send, "Sin comandos", "Este equipo no admite comandos predefinidos. Prueba con uno personalizado.")
                    else -> {
                        ui.catalog.commands.forEach { def ->
                            CommandCard(def, ui.sending) { params -> if (def.dangerous) confirm = def to params else onSend(def.type, params) }
                        }
                        if (ui.templates.isNotEmpty()) {
                            Text("MIS PLANTILLAS", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
                            ui.templates.forEach { t ->
                                SoftCard(Modifier.fillMaxWidth(), onClick = { onSend(t.type, t.params.mapValues { it.value.jsonPrimitive.contentOrNull.orEmpty() }) }) {
                                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                        LIcon(Ic.Zap, tint = MaterialTheme.colorScheme.primary, size = 18.dp)
                                        Spacer(Modifier.size(10.dp))
                                        Text(t.name, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                                        LIcon(Ic.Send, size = 16.dp)
                                    }
                                }
                            }
                        }
                    }
                }
                CommandTab.Custom -> CustomCommand(ui.sending, { onSend("custom", mapOf("data" to it)) }, onSaveTemplate)
                CommandTab.History -> if (ui.history.isEmpty()) EmptyState(Ic.History, "Sin comandos", "Los comandos que envíes a esta unidad aparecerán aquí.") else ui.history.forEach { c ->
                    SoftCard(Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(c.type, style = MaterialTheme.typography.titleSmall)
                                Text(Formatting.dateTime(c.createdAt) + (c.result?.let { " · $it" } ?: ""), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Pill(statusLabel(c.status), statusTone(c.status))
                            if (c.status == "pending") {
                                Spacer(Modifier.size(6.dp))
                                TextButton(onClick = { onCancel(c.id) }) { Text("Cancelar") }
                            }
                        }
                    }
                }
            }
        }
    }
    confirm?.let { (def, params) ->
        AlertDialog(
            onDismissRequest = { confirm = null },
            icon = { LIcon(Ic.Warning, tint = MaterialTheme.colorScheme.error, size = 28.dp) },
            title = { Text("¿Enviar \"${def.label}\"?") },
            text = { Text("Esta acción puede afectar al vehículo (${unit.name}). Confirma solo si estás seguro.") },
            confirmButton = { TextButton(onClick = { onSend(def.type, params); confirm = null }) { Text("Enviar", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { confirm = null }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun CommandCard(def: CommandDef, sending: Boolean, onRun: (Map<String, String>) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val values = remember { mutableStateMapOf<String, String>() }
    SoftCard(Modifier.fillMaxWidth(), onClick = { if (def.params.isEmpty()) onRun(emptyMap()) else open = !open }) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                LIcon(if (def.dangerous) Ic.Warning else Ic.Zap, tint = if (def.dangerous) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary, size = 20.dp)
                Spacer(Modifier.size(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(def.label, style = MaterialTheme.typography.titleSmall)
                    if (def.description.isNotBlank()) Text(def.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                LIcon(if (def.params.isEmpty()) Ic.Send else Ic.ChevronRight, size = 16.dp)
            }
            if (open) {
                def.params.forEach { p ->
                    OutlinedTextField(
                        values[p.key].orEmpty(), { values[p.key] = it }, Modifier.fillMaxWidth(), label = { Text(p.label) }, singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                    )
                }
                BrandButton("Enviar", { onRun(values.toMap()) }, Modifier.fillMaxWidth(), icon = Ic.Send, loading = sending, height = 46.dp,
                    enabled = def.params.all { values[it.key].orEmpty().isNotBlank() })
            }
        }
    }
}

@Composable
private fun CustomCommand(sending: Boolean, onSend: (String) -> Unit, onSave: (String, String) -> Unit) {
    var text by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    Text(
        "Escribe el texto exacto que entiende tu equipo (por ejemplo, un comando SMS o de protocolo).",
        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    OutlinedTextField(text, { text = it }, Modifier.fillMaxWidth(), label = { Text("Comando") }, minLines = 3, shape = RoundedCornerShape(16.dp))
    BrandButton("Enviar comando", { onSend(text.trim()) }, Modifier.fillMaxWidth(), icon = Ic.Send, loading = sending, enabled = text.isNotBlank())
    OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), label = { Text("Guardar como plantilla (nombre)") }, singleLine = true, shape = RoundedCornerShape(16.dp))
    BrandButton("Guardar plantilla", { onSave(name.trim(), text.trim()); name = "" }, Modifier.fillMaxWidth(), kind = ButtonKind.Secondary, enabled = text.isNotBlank() && name.isNotBlank(), height = 46.dp)
}
