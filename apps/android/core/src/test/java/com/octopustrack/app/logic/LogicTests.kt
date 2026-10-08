package com.octopustrack.app.logic

import com.octopustrack.app.data.ApiClient
import com.octopustrack.app.data.ApiErrorKind
import com.octopustrack.app.data.ApiException
import com.octopustrack.app.data.AppJson
import com.octopustrack.app.data.Connection
import com.octopustrack.app.data.Formatting
import com.octopustrack.app.data.LoginResponse
import com.octopustrack.app.data.PairingLink
import com.octopustrack.app.data.PositionDto
import com.octopustrack.app.data.UnitStatus
import com.octopustrack.app.data.FleetUnit
import com.octopustrack.app.data.normalizeServerUrl
import com.octopustrack.app.data.toJsonParams
import com.octopustrack.app.tracker.PendingQueue
import com.octopustrack.app.tracker.PositionPayload
import com.octopustrack.app.tracker.SendPolicy
import com.octopustrack.app.tracker.haversineMeters
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.File
import java.time.Instant

class FormattingTests {
    private val now = Instant.parse("2026-10-08T15:00:00Z")

    @Test fun timeAgo() {
        assertEquals("hace 8 s", Formatting.timeAgo("2026-10-08T14:59:52Z", now))
        assertEquals("hace 5 min", Formatting.timeAgo("2026-10-08T14:55:00Z", now))
        assertEquals("hace 2 h", Formatting.timeAgo("2026-10-08T13:00:00Z", now))
        assertEquals("hace 3 d", Formatting.timeAgo("2026-10-05T15:00:00Z", now))
        assertEquals("nunca", Formatting.timeAgo(null, now))
    }

    @Test fun onlineWindow() {
        assertTrue(Formatting.isOnline("2026-10-08T14:59:00Z", now))
        assertFalse(Formatting.isOnline("2026-10-08T10:00:00Z", now))
        assertFalse(Formatting.isOnline(null, now))
    }

    @Test fun serverUrl() {
        assertEquals("https://mi-empresa.com", normalizeServerUrl("mi-empresa.com"))
        assertEquals("https://octopus-track.vercel.app", normalizeServerUrl("  https://Octopus-Track.vercel.app/dashboard "))
        assertEquals("http://192.168.1.5:3000", normalizeServerUrl("http://192.168.1.5:3000"))
        assertNull(normalizeServerUrl(""))
        assertNull(normalizeServerUrl("ftp://x.com"))
    }

    @Test fun speedAndCoords() {
        assertEquals("62 km/h", Formatting.speed(62.4))
        assertEquals("0 km/h", Formatting.speed(null))
        assertEquals("19.430000, -99.130000", Formatting.coords(19.43, -99.13))
    }
}

class PairingLinkTests {
    private val token = "AbCdEfGhIjKlMnOpQrStUvWx"

    @Test fun rawToken() = assertEquals(PairingLink.Parsed(token, null), PairingLink.parse(token))
    @Test fun webLink() = assertEquals(PairingLink.Parsed(token, "https://octopus-track.vercel.app"), PairingLink.parse("https://octopus-track.vercel.app/rastreo#t=$token"))
    @Test fun customScheme() = assertEquals(PairingLink.Parsed(token, null), PairingLink.parse("octopustrack://track?t=$token"))
    @Test fun invalid() { assertNull(PairingLink.parse("hola")); assertNull(PairingLink.parse("https://x.com/rastreo#t=corto")); assertNull(PairingLink.parse(null)) }
}

class SendPolicyTests {
    private val p = SendPolicy()
    private fun sent(t: Long) = SendPolicy.Sent(19.0, -99.0, t)

    @Test fun firstAlwaysSends() = assertTrue(p.shouldSend(null, 19.0, -99.0, 0))
    @Test fun tooSoon() = assertFalse(p.shouldSend(sent(0), 19.01, -99.0, 5_000))
    @Test fun movedEnough() = assertTrue(p.shouldSend(sent(0), 19.001, -99.0, 12_000))
    @Test fun stillNoHeartbeatYet() = assertFalse(p.shouldSend(sent(0), 19.0, -99.0, 30_000))
    @Test fun heartbeat() = assertTrue(p.shouldSend(sent(0), 19.0, -99.0, 61_000))
    @Test fun haversine() = assertEquals(111_195.0, haversineMeters(0.0, 0.0, 1.0, 0.0), 200.0)
}

class PendingQueueTests {
    private fun pos(i: Int) = PositionPayload(19.0 + i, -99.0, 5.0, timestamp = i.toLong())

    @Test fun addPeekDrop() {
        val f = File.createTempFile("queue", ".jsonl").also { it.delete() }
        val q = PendingQueue(f)
        repeat(5) { q.add(pos(it)) }
        assertEquals(5, q.size())
        assertEquals(listOf(0L, 1L), q.peek(2).map { it.timestamp })
        q.drop(2)
        assertEquals(listOf(2L, 3L, 4L), q.peek(10).map { it.timestamp })
        q.clear(); assertEquals(0, q.size())
    }

    @Test fun capsAtMax() {
        val f = File.createTempFile("queue", ".jsonl").also { it.delete() }
        val q = PendingQueue(f, max = 3)
        repeat(6) { q.add(pos(it)) }
        assertEquals(listOf(3L, 4L, 5L), q.peek(10).map { it.timestamp })
    }
}

class JsonTests {
    @Test fun loginFixture() {
        val r = AppJson.decodeFromString<LoginResponse>(
            """{"token":"t","expiresAt":"2026-11-07T00:00:00Z","user":{"id":"1","name":"Ana","email":"a@b.c","role":"viewer","tenantId":"x","tenantName":"Aurora","mustChangePassword":false,"campoNuevo":1},"tenants":[{"id":"x","name":"Aurora","role":"viewer"}]}""",
        )
        assertEquals("Cliente", r.user.roleLabel)
        assertFalse(r.user.canManage)
    }

    @Test fun positionToUnit() {
        val p = AppJson.decodeFromString<PositionDto>(
            """{"deviceId":"d","deviceName":"GT06","time":"2026-10-08T14:59:50Z","latitude":19.4,"longitude":-99.1,"speedKmh":40,"attributes":{"battery":87.4}}""",
        )
        val u = FleetUnit.from(p)
        assertEquals(87, u.battery)
        assertEquals(UnitStatus.Moving, u.status(Instant.parse("2026-10-08T15:00:00Z")))
        assertEquals(UnitStatus.Offline, u.status(Instant.parse("2026-10-09T15:00:00Z")))
    }

    @Test fun commandParamsAreTyped() {
        val j = mapOf("seconds" to "30", "text" to "hola", "ratio" to "1.5").toJsonParams().toString()
        assertEquals("""{"seconds":30,"text":"hola","ratio":1.5}""", j)
    }
}

class ApiClientTests {
    private fun client(server: MockWebServer, token: String? = "tok", onUnauthorized: () -> Unit = {}) =
        ApiClient(OkHttpClient(), { Connection(server.url("/").toString().trimEnd('/'), token) }, onUnauthorized)

    @Test fun sendsBearerAndParsesJson() = runBlocking {
        MockWebServer().use { s ->
            s.enqueue(MockResponse().setBody("""{"app":"octopus-track","api":1,"push":false}"""))
            val r: com.octopustrack.app.data.PingResponse = client(s).get("/api/mobile/ping")
            assertEquals("octopus-track", r.app)
            assertEquals("Bearer tok", s.takeRequest().getHeader("Authorization"))
        }
    }

    @Test fun unauthorizedExpiresSession() = runBlocking {
        MockWebServer().use { s ->
            s.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"No autorizado"}"""))
            var expired = false
            try { client(s, onUnauthorized = { expired = true }).get<com.octopustrack.app.data.PingResponse>("/api/mobile/me"); fail() }
            catch (e: ApiException) { assertEquals(ApiErrorKind.Unauthorized, e.kind); assertEquals("No autorizado", e.message) }
            assertTrue(expired)
        }
    }

    @Test fun rateLimitedMapsKind() = runBlocking {
        MockWebServer().use { s ->
            s.enqueue(MockResponse().setResponseCode(429).setBody("""{"error":"Demasiados intentos"}"""))
            try { client(s).get<com.octopustrack.app.data.PingResponse>("/x"); fail() } catch (e: ApiException) { assertEquals(ApiErrorKind.RateLimited, e.kind) }
        }
    }

    /** Respuesta inesperada sin el formato {error}: el mensaje debe incluir el código para poder diagnosticarla. */
    @Test fun unexpectedNonJsonResponseIncludesStatusCode() = runBlocking {
        MockWebServer().use { s ->
            s.enqueue(MockResponse().setResponseCode(405).setBody("Method Not Allowed"))
            try { client(s).get<com.octopustrack.app.data.PingResponse>("/x"); fail() } catch (e: ApiException) {
                assertEquals(ApiErrorKind.Client, e.kind)
                assertTrue(e.message.contains("405"))
                assertTrue(e.message.contains("Method Not Allowed"))
            }
        }
    }

    /** Un POST redirigido con 301/302/303 puede reenviarse como GET: el mensaje debe mostrar la cadena de saltos. */
    @Test fun redirectedPostShowsChain() = runBlocking {
        MockWebServer().use { s ->
            s.enqueue(MockResponse().setResponseCode(301).setHeader("Location", "/api/mobile/login"))
            s.enqueue(MockResponse().setResponseCode(405))
            try {
                client(s).post<Map<String, String>, com.octopustrack.app.data.PingResponse>("/api/mobile/login/", mapOf("a" to "b"))
                fail()
            } catch (e: ApiException) {
                assertEquals(405, e.status)
                assertTrue("mensaje: ${e.message}", e.message.contains("redirigido"))
                assertTrue("mensaje: ${e.message}", e.message.contains("301"))
                assertTrue("mensaje: ${e.message}", e.message.contains("GET"))
            }
        }
    }
}
