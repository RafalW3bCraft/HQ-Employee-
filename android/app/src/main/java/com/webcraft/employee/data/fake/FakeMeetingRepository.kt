package com.webcraft.employee.data.fake

import com.webcraft.employee.domain.model.Meeting
import com.webcraft.employee.domain.model.MeetingStatus
import com.webcraft.employee.domain.repository.MeetingRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class FakeMeetingRepository : MeetingRepository {
    private val _meetings = MutableStateFlow(
        listOf(
            Meeting(
                id = "meet-101",
                leadId = "lead-002",
                leadName = "Marcus Vance",
                title = "AI Medical Notes Solution Discovery",
                topic = "Architecture review, HIPAA compliance requirements, and AssemblyAI speech pipeline.",
                scheduledAt = "2026-09-18T10:00:00Z",
                durationMinutes = 45,
                status = MeetingStatus.SCHEDULED
            ),
            Meeting(
                id = "meet-102",
                leadId = "lead-001",
                leadName = "Sarah Jenkins",
                title = "Warehouse Logistics Software Scope Walkthrough",
                topic = "Finalize MVP milestones, driver app interface, and integration timeline.",
                scheduledAt = "2026-09-19T14:30:00Z",
                durationMinutes = 30,
                status = MeetingStatus.SCHEDULED
            )
        )
    )

    override fun getMeetings(): Flow<List<Meeting>> = _meetings.asStateFlow()

    override suspend fun getMeetingById(id: String): Meeting? {
        return _meetings.value.find { it.id == id }
    }
}
