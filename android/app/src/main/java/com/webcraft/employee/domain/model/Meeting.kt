package com.webcraft.employee.domain.model

enum class MeetingStatus {
    SCHEDULED,
    RESCHEDULED,
    CANCELLED,
    COMPLETED
}

data class Meeting(
    val id: String,
    val leadId: String,
    val leadName: String,
    val title: String,
    val topic: String,
    val scheduledAt: String,
    val durationMinutes: Int,
    val status: MeetingStatus
)
