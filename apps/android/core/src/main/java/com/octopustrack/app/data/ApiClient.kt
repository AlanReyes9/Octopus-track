package com.octopustrack.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

val AppJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
    encodeDefaults = true
}

enum class ApiErrorKind { Network, Unauthorized, Forbidden, NotFound, Conflict, RateLimited, Server, Client }

class ApiException(val status: Int, override val message: String, val kind: ApiErrorKind, cause: Throwable? = null) :
    Exception(message, cause)

/** Conexión con el servidor: URL base y token Bearer (si hay sesión). */
data class Connection(val baseUrl: String, val token: String?)

fun newHttpClient(): OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(12, TimeUnit.SECONDS)
    .readTimeout(25, TimeUnit.SECONDS)
    .writeTimeout(25, TimeUnit.SECONDS)
    .pingInterval(25, TimeUnit.SECONDS)
    .build()

private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

/**
 * Cliente de la API REST de Octopus Track. Todas las llamadas son suspend,
 * cancelables, y devuelven [ApiException] con mensajes ya en español.
 */
class ApiClient(
    private val http: OkHttpClient,
    private val connection: () -> Connection,
    /** Se invoca con 401 en una llamada autenticada (token caducado o revocado). */
    private val onUnauthorized: () -> Unit = {},
) {
    private fun url(path: String, query: Map<String, String?> = emptyMap()): okhttp3.HttpUrl {
        val base = connection().baseUrl.trimEnd('/')
        val builder = (base + path).toHttpUrlOrNull()?.newBuilder()
            ?: throw ApiException(0, "La dirección del servidor no es válida", ApiErrorKind.Client)
        query.forEach { (k, v) -> if (v != null) builder.addQueryParameter(k, v) }
        return builder.build()
    }

    // El parámetro NO puede llamarse "build": dentro del .apply (receptor Request.Builder),
    // una llamada "build()" se resolvería al método build() de Request.Builder (que cierra el
    // builder y descarta el resultado) en vez de invocar este lambda — y el método/cuerpo
    // (GET/POST/DELETE) nunca se aplicaría, quedando siempre en el GET por defecto de OkHttp.
    private fun request(path: String, query: Map<String, String?>, bearer: String?, configure: Request.Builder.() -> Unit): Request =
        Request.Builder().url(url(path, query)).apply {
            header("Accept", "application/json")
            header("User-Agent", "OctopusTrack-Android")
            val token = bearer ?: connection().token
            if (token != null) header("Authorization", "Bearer $token")
            configure()
        }.build()

    suspend fun execute(
        method: String,
        path: String,
        query: Map<String, String?> = emptyMap(),
        body: String? = null,
        bearer: String? = null,
    ): String {
        val req = request(path, query, bearer) {
            when (method) {
                "GET" -> get()
                "DELETE" -> if (body == null) delete() else delete(body.toRequestBody(JSON_MEDIA))
                else -> method(method, (body ?: "{}").toRequestBody(JSON_MEDIA))
            }
        }
        val response = try {
            http.newCall(req).await()
        } catch (e: IOException) {
            throw ApiException(0, "Sin conexión con el servidor", ApiErrorKind.Network, e)
        }
        response.use { r ->
            val text = withContext(Dispatchers.IO) { r.body?.string().orEmpty() }
            if (r.isSuccessful) return text
            // OkHttp sigue las redirecciones solo; si hubo alguna antes de esta respuesta,
            // el método pudo haber cambiado de POST a GET (lo exige el estándar HTTP para
            // 301/302/303). Se añade la cadena para poder diagnosticarlo.
            val redirectChain = generateSequence(r.priorResponse) { it.priorResponse }
                .toList().asReversed()
                .joinToString(" → ") { "${it.request.method} ${it.code}→${it.header("Location") ?: "?"}" } +
                (if (r.priorResponse != null) " → ${r.request.method} ${r.code}" else "")
            val message = runCatching { AppJson.decodeFromString<ErrorBody>(text).error }.getOrNull()
                ?.let { if (redirectChain.isEmpty()) it else "$it [redirigido: $redirectChain]" }
            val kind = when (r.code) {
                401 -> ApiErrorKind.Unauthorized
                403 -> ApiErrorKind.Forbidden
                404 -> ApiErrorKind.NotFound
                409 -> ApiErrorKind.Conflict
                429 -> ApiErrorKind.RateLimited
                in 500..599 -> ApiErrorKind.Server
                else -> ApiErrorKind.Client
            }
            // El token propio del modo rastreador (bearer explícito) no cierra la sesión del panel.
            if (kind == ApiErrorKind.Unauthorized && bearer == null && connection().token != null) onUnauthorized()
            val fallback = defaultMessage(r.code, text).let { if (redirectChain.isEmpty()) it else "$it [redirigido: $redirectChain]" }
            throw ApiException(r.code, message ?: fallback, kind)
        }
    }

    suspend inline fun <reified T> get(path: String, query: Map<String, String?> = emptyMap(), bearer: String? = null): T =
        AppJson.decodeFromString(execute("GET", path, query, null, bearer))

    suspend inline fun <reified B, reified T> post(path: String, body: B, bearer: String? = null): T =
        AppJson.decodeFromString(execute("POST", path, emptyMap(), AppJson.encodeToString(body), bearer))

    suspend fun postRaw(path: String, body: JsonObject = JsonObject(emptyMap()), bearer: String? = null) {
        execute("POST", path, emptyMap(), AppJson.encodeToString(JsonObject.serializer(), body), bearer)
    }

    suspend fun delete(path: String, body: JsonObject? = null) {
        execute("DELETE", path, emptyMap(), body?.let { AppJson.encodeToString(JsonObject.serializer(), it) })
    }

    /** Incluye el código (y, si no es JSON, un trozo del cuerpo) para poder diagnosticar
     *  respuestas inesperadas (redirecciones, bloqueos de red, proxies, etc.). */
    private fun defaultMessage(code: Int, body: String): String {
        val base = when (code) {
            401 -> "Tu sesión ha caducado"
            403 -> "No tienes permiso para esta acción"
            404 -> "No se encontró lo solicitado"
            429 -> "Demasiados intentos, espera unos minutos"
            in 500..599 -> "El servidor tuvo un problema. Inténtalo de nuevo"
            else -> "No se pudo completar la operación"
        }
        val hint = body.trim().take(80).replace(Regex("\\s+"), " ")
        return if (hint.isEmpty()) "$base (código $code)" else "$base (código $code: $hint)"
    }
}

/** Convierte una llamada OkHttp en suspend cancelable. */
suspend fun Call.await(): Response = suspendCancellableCoroutine { cont ->
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) = cont.resume(response)
        override fun onFailure(call: Call, e: IOException) {
            if (!cont.isCancelled) cont.resumeWithException(e)
        }
    })
    cont.invokeOnCancellation { runCatching { cancel() } }
}
