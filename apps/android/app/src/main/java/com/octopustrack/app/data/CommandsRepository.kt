package com.octopustrack.app.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

@Serializable
private data class SendCommand(val type: String, val params: JsonObject)

@Serializable
private data class SaveTemplate(val name: String, val protocol: String?, val type: String, val params: JsonObject)

class CommandsRepository(private val api: ApiClient) {
    suspend fun catalog(protocol: String): CommandCatalog = api.get("/api/mobile/commands", mapOf("protocol" to protocol))

    suspend fun templates(): List<CommandTemplateDto> = runCatching { api.get<List<CommandTemplateDto>>("/api/command-templates") }.getOrDefault(emptyList())

    suspend fun history(deviceId: String): List<CommandRowDto> = api.get("/api/devices/$deviceId/commands")

    suspend fun send(deviceId: String, type: String, params: Map<String, String>) {
        api.execute(
            "POST", "/api/devices/$deviceId/commands",
            body = AppJson.encodeToString(SendCommand.serializer(), SendCommand(type, params.toJsonParams())),
        )
    }

    suspend fun saveCustomTemplate(name: String, protocol: String?, data: String) {
        api.execute(
            "POST", "/api/command-templates",
            body = AppJson.encodeToString(
                SaveTemplate.serializer(),
                SaveTemplate(name, protocol, "custom", JsonObject(mapOf("data" to JsonPrimitive(data)))),
            ),
        )
    }

    suspend fun cancel(commandId: String) = api.delete("/api/commands/$commandId")
}

/** El servidor valida tipos: los números se envían como número. */
fun Map<String, String>.toJsonParams(): JsonObject = JsonObject(
    mapValues { (_, v) -> v.toDoubleOrNull()?.let { n -> if (n % 1.0 == 0.0) JsonPrimitive(n.toLong()) else JsonPrimitive(n) } ?: JsonPrimitive(v) },
)
