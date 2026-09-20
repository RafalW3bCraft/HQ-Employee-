package com.webcraft.employee.domain.usecase

import com.webcraft.employee.domain.model.DashboardStats
import com.webcraft.employee.domain.model.QualificationStatus
import com.webcraft.employee.domain.repository.LeadRepository
import com.webcraft.employee.domain.repository.MeetingRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine

class GetDashboardDataUseCase(
    private val leadRepository: LeadRepository,
    private val meetingRepository: MeetingRepository
) {
    operator fun invoke(): Flow<DashboardStats> {
        return combine(
            leadRepository.getLeads(),
            meetingRepository.getMeetings()
        ) { leads, meetings ->
            val activeLeads = leads.filter { it.status != QualificationStatus.LOST && it.status != QualificationStatus.CONVERTED }
            val qualifiedLeads = leads.filter { it.status == QualificationStatus.QUALIFIED || it.status == QualificationStatus.MEETING_BOOKED }

            DashboardStats(
                activeLeadsCount = activeLeads.size,
                qualifiedLeadsCount = qualifiedLeads.size,
                upcomingMeetingsCount = meetings.size,
                callCreditsRemaining = 45, // Demo wallet balance
                recentLeads = leads.take(5),
                upcomingMeetings = meetings.take(3)
            )
        }
    }
}
