package com.webcraft.employee.domain.model

enum class CallStatus {
    IDLE,
    CONNECTING,
    ACTIVE,
    USER_SPEAKING,
    AGENT_SPEAKING,
    ENDED,
    ERROR
}

data class TranscriptItem(
    val id: String,
    val speaker: String,
    val text: String,
    val timestamp: String,
    val isInterrupted: Boolean = false
)

data class PolicyDecisionItem(
    val id: String,
    val toolName: String,
    val decision: String, // ALLOW, REQUIRE_APPROVAL, BLOCK
    val reason: String,
    val isError: Boolean,
    val timestamp: String
)

data class VoiceCallSession(
    val callId: String = "",
    val sessionId: String = "",
    val status: CallStatus = CallStatus.IDLE,
    val transcripts: List<TranscriptItem> = emptyList(),
    val policyDecisions: List<PolicyDecisionItem> = emptyList(),
    val errorMessage: String? = null
)
