package com.octopustrack.app.tracker

import com.octopustrack.app.data.AppJson
import java.io.File

/**
 * Cola de posiciones sin enviar (sin cobertura). Una línea JSON por posición,
 * en el almacenamiento privado de la app. Limitada: al llenarse descarta lo más antiguo.
 */
class PendingQueue(private val file: File, private val max: Int = 2000) {
    @Synchronized
    fun size(): Int = if (file.exists()) file.useLines { it.count() } else 0

    @Synchronized
    fun add(p: PositionPayload) {
        file.parentFile?.mkdirs()
        file.appendText(AppJson.encodeToString(PositionPayload.serializer(), p) + "\n")
        if (size() > max) {
            val keep = file.readLines().takeLast(max)
            file.writeText(keep.joinToString("\n", postfix = "\n"))
        }
    }

    /** Las [n] más antiguas, sin quitarlas. */
    @Synchronized
    fun peek(n: Int): List<PositionPayload> {
        if (!file.exists()) return emptyList()
        return file.useLines { lines ->
            lines.take(n).mapNotNull { runCatching { AppJson.decodeFromString(PositionPayload.serializer(), it) }.getOrNull() }.toList()
        }
    }

    /** Quita las [n] más antiguas (ya enviadas). */
    @Synchronized
    fun drop(n: Int) {
        if (!file.exists()) return
        val rest = file.readLines().drop(n)
        if (rest.isEmpty()) file.delete() else file.writeText(rest.joinToString("\n", postfix = "\n"))
    }

    @Synchronized
    fun clear() { file.delete() }
}
