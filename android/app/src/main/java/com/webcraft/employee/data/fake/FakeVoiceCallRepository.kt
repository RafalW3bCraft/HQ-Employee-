package com.webcraft.employee.data.fake

import com.webcraft.employee.domain.model.CallStatus
import com.webcraft.employee.domain.model.PolicyDecisionItem
import com.webcraft.employee.domain.model.TranscriptItem
import com.webcraft.employee.domain.model.VoiceCallSession
import com.webcraft.employee.domain.repository.VoiceCallRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class FakeVoiceCallRepository : VoiceCallRepository {

    private val _sessionState = MutableStateFlow(VoiceCallSession())
    private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.US)

    override fun observeCallSession(): Flow<VoiceCallSession> = _sessionState.asStateFlow()

    override suspend fun startCall() {
        val callId = "call_" + UUID.randomUUID().toString().take(8)
        val sessionId = "session_" + UUID.randomUUID().toString().take(8)

        _sessionState.value = VoiceCallSession(
            callId = callId,
            sessionId = sessionId,
            status = CallStatus.CONNECTING,
            transcripts = emptyList(),
            policyDecisions = emptyList()
        )

        delay(600)

        val greetingText = "Hello! Thanks for reaching out to HQ-Employee. I'm the HQ-Employee business development and client coordinator. How can I help with your project today?"
        val greetingTranscript = TranscriptItem(
            id = UUID.randomUUID().toString(),
            speaker = "agent",
            text = greetingText,
            timestamp = timeFormat.format(Date())
        )

        _sessionState.value = _sessionState.value.copy(
            status = CallStatus.AGENT_SPEAKING,
            transcripts = listOf(greetingTranscript)
        )

        delay(1200)

        _sessionState.value = _sessionState.value.copy(
            status = CallStatus.ACTIVE
        )
    }

    override suspend fun sendUserInput(text: String) {
        val userTimestamp = timeFormat.format(Date())
        val userTranscript = TranscriptItem(
            id = UUID.randomUUID().toString(),
            speaker = "user",
            text = text,
            timestamp = userTimestamp
        )

        val updatedTranscripts = _sessionState.value.transcripts + userTranscript
        _sessionState.value = _sessionState.value.copy(
            status = CallStatus.USER_SPEAKING,
            transcripts = updatedTranscripts
        )

        delay(500)

        // Evaluate intent and simulate backend tool calling with Policy Engine
        val lower = text.lowercase()
        val decision: PolicyDecisionItem?
        val agentReply: String

        when {
            lower.contains("contract") || lower.contains("sign") || lower.contains("nda") -> {
                decision = PolicyDecisionItem(
                    id = UUID.randomUUID().toString(),
                    toolName = "sign_contract",
                    decision = "BLOCK",
                    reason = "Contractual commitments strictly reserved for human director",
                    isError = true,
                    timestamp = timeFormat.format(Date())
                )
                agentReply = "I do not have legal authority to sign or commit to contracts. Our human director will review your contract requirements directly."
            }
            lower.contains("discount") || lower.contains("cheaper") -> {
                decision = PolicyDecisionItem(
                    id = UUID.randomUUID().toString(),
                    toolName = "request_human_approval",
                    decision = "REQUIRE_APPROVAL",
                    reason = "Discounts require explicit human executive sign-off",
                    isError = false,
                    timestamp = timeFormat.format(Date())
                )
                agentReply = "I cannot authorize custom discounts on the spot, but I have logged an escalation for our director to review your pricing request."
            }
            lower.contains("price") || lower.contains("cost") || lower.contains("rate") -> {
                decision = PolicyDecisionItem(
                    id = UUID.randomUUID().toString(),
                    toolName = "get_pricing_guidance",
                    decision = "ALLOW",
                    reason = "Standard pricing within approved range ($7,500 - $35,000)",
                    isError = false,
                    timestamp = timeFormat.format(Date())
                )
                agentReply = "Our MVP web applications typically range from $7,500 to $18,000, while complete full-stack platforms range between $15,000 and $35,000."
            }
            else -> {
                decision = PolicyDecisionItem(
                    id = UUID.randomUUID().toString(),
                    toolName = "get_service_details",
                    decision = "ALLOW",
                    reason = "Approved services portfolio access permitted",
                    isError = false,
                    timestamp = timeFormat.format(Date())
                )
                agentReply = "HQ specializes in AI integrations, mobile and web application engineering, and enterprise digital solutions. What are your main technical requirements?"
            }
        }

        val updatedDecisions = _sessionState.value.policyDecisions + decision

        _sessionState.value = _sessionState.value.copy(
            status = CallStatus.AGENT_SPEAKING,
            policyDecisions = updatedDecisions
        )

        delay(800)

        val agentTranscript = TranscriptItem(
            id = UUID.randomUUID().toString(),
            speaker = "agent",
            text = agentReply,
            timestamp = timeFormat.format(Date())
        )

        _sessionState.value = _sessionState.value.copy(
            status = CallStatus.ACTIVE,
            transcripts = _sessionState.value.transcripts + agentTranscript
        )
    }

    override suspend fun endCall() {
        _sessionState.value = _sessionState.value.copy(
            status = CallStatus.ENDED
        )
    }
}
