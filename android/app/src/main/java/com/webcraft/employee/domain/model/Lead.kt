package com.webcraft.employee.domain.model

enum class QualificationStatus {
    NEW,
    CONTACTED,
    ENGAGED,
    QUALIFYING,
    QUALIFIED,
    UNQUALIFIED,
    MEETING_PENDING,
    MEETING_BOOKED,
    HUMAN_HANDOFF,
    CONVERTED,
    LOST
}

data class LeadContact(
    val type: String,
    val value: String,
    val isPrimary: Boolean
)

data class Lead(
    val id: String,
    val fullName: String,
    val companyName: String?,
    val contacts: List<LeadContact>,
    val status: QualificationStatus,
    val projectType: String?,
    val businessObjective: String?,
    val budgetStated: String?,
    val timelineExpected: String?,
    val qualificationNotes: String?,
    val createdAt: String
)
