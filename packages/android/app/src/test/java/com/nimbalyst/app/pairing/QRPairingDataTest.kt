package com.nimbalyst.app.pairing

import java.util.Base64
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class QRPairingDataTest {
    @Test
    fun `parse v4 payload`() {
        val futureMs = System.currentTimeMillis() + 900_000
        val payload = """
            {"version":4,"serverUrl":"wss://sync-dev.smartypants.ai","encryptionKeySeed":"abc123base64==","expiresAt":$futureMs,"analyticsId":"analytics-id","syncEmail":"user@example.com"}
        """.trimIndent()

        val result = QRPairingData.parse(payload)

        assertNotNull(result)
        assertEquals("abc123base64==", result?.seed)
        assertEquals("wss://sync-dev.smartypants.ai", result?.serverUrl)
        assertEquals("user@example.com", result?.userId)
        assertEquals("analytics-id", result?.analyticsId)
    }

    @Test
    fun `parse deep link payload`() {
        val json = """{"seed":"abc123","serverUrl":"https://sync-dev.smartypants.ai","userId":"user-456","personalOrgId":"org-1","personalUserId":"user-1"}"""
        val encoded = Base64.getEncoder().encodeToString(json.toByteArray())

        val result = QRPairingData.parse("nimbalyst://pair?data=$encoded")

        assertEquals("abc123", result?.seed)
        assertEquals("org-1", result?.personalOrgId)
        assertEquals("user-1", result?.personalUserId)
    }

    @Test
    fun `expired qr payload is rejected`() {
        val payload = """
            {"version":4,"serverUrl":"wss://sync-dev.smartypants.ai","encryptionKeySeed":"key","expiresAt":${System.currentTimeMillis() - 60_000},"analyticsId":"id","syncEmail":"a@b.com"}
        """.trimIndent()

        assertNull(QRPairingData.parse(payload))
    }

    @Test
    fun `missing identifiers are rejected`() {
        assertNull(QRPairingData.parse("""{"encryptionKeySeed":"key","serverUrl":"https://example.com"}"""))
        assertNull(QRPairingData.parse("https://example.com"))
    }
}
