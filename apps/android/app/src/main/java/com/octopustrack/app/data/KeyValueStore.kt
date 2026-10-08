package com.octopustrack.app.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Almacén clave-valor de cadenas. */
interface KeyValueStore {
    fun get(key: String): String?
    fun put(key: String, value: String?)
    fun remove(vararg keys: String) = keys.forEach { put(it, null) }
}

/** Para pruebas y vistas previas. */
class InMemoryStore(initial: Map<String, String> = emptyMap()) : KeyValueStore {
    private val map = initial.toMutableMap()
    override fun get(key: String) = map[key]
    override fun put(key: String, value: String?) { if (value == null) map.remove(key) else map[key] = value }
}

/**
 * Guarda los valores cifrados con AES-256-GCM; la clave vive en el Android
 * Keystore (no sale del dispositivo). Contiene el token de sesión y el enlace
 * de vinculación del teléfono.
 */
class SecureStore(context: Context) : KeyValueStore {
    private val prefs = context.applicationContext.getSharedPreferences("octopus_secure", Context.MODE_PRIVATE)

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return gen.generateKey()
    }

    override fun get(key: String): String? {
        val raw = prefs.getString(key, null) ?: return null
        return runCatching {
            val bytes = Base64.decode(raw, Base64.NO_WRAP)
            val cipher = Cipher.getInstance(TRANSFORM)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes, 0, IV_SIZE))
            String(cipher.doFinal(bytes, IV_SIZE, bytes.size - IV_SIZE), Charsets.UTF_8)
        }.getOrNull() // clave perdida o dato corrupto → como si no existiera
    }

    override fun put(key: String, value: String?) {
        if (value == null) {
            prefs.edit().remove(key).apply()
            return
        }
        val cipher = Cipher.getInstance(TRANSFORM)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        prefs.edit().putString(key, Base64.encodeToString(encrypted, Base64.NO_WRAP)).apply()
    }

    private companion object {
        const val ALIAS = "octopus_track_key"
        const val TRANSFORM = "AES/GCM/NoPadding"
        const val IV_SIZE = 12
    }
}

/** Claves usadas en el almacén. */
object StoreKeys {
    const val SERVER_URL = "server_url"
    const val TOKEN = "token"
    const val TOKEN_EXPIRES = "token_expires"
    const val PROFILE = "profile"
    const val TENANTS = "tenants"

    const val TRACKER_TOKEN = "tracker_token"
    const val TRACKER_COMPANY = "tracker_company"
    const val TRACKER_DEVICE = "tracker_device"
    const val TRACKER_HOLDER = "tracker_holder"
    const val TRACKER_RUNNING = "tracker_running"
    const val TRACKER_SERVER = "tracker_server"
    const val PUSH_TOKEN = "push_token"
}
