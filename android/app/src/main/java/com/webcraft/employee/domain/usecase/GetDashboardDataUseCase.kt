package com.webcraft.employee.domain.usecase

import com.webcraft.employee.domain.model.DashboardStats
import com.webcraft.employee.domain.model.QualificationStatus
import com.webcraft.employee.domain.repository.BillingRepository
import com.webcraft.employee.domain.repository.LeadRepository
import com.webcraft.employee.domain.repository.MeetingRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine

class GetDashboardDataUseCase(
    private val leadRepository: LeadRepository,
    private val meetingRepository: MeetingRepository,
    private val billingRepository: BillingRepository? = null,
    private val defaultCompanyId: String = "00000000-0000-0000-0000-000000000001"
) {
    operator fun invoke(): Flow<DashboardStats> {
        return if (billingRepository != null) {
            combine(
                leadRepository.getLeads(),
                meetingRepository.getMeetings(),
                billingRepository.getWalletBalance(defaultCompanyId)
            ) { leads, meetings, wallet ->
                val activeLeads = leads.filter { it.status != QualificationStatus.LOST && it.status != QualificationStatus.CONVERTED }
                val qualifiedLeads = leads.filter { it.status == QualificationStatus.QUALIFIED || it.status == QualificationStatus.MEETING_BOOKED }

                DashboardStats(
                    activeLeadsCount = activeLeads.size,
                    qualifiedLeadsCount = qualifiedLeads.size,
                    upcomingMeetingsCount = meetings.size,
                    callCreditsRemaining = wallet.available,
                    recentLeads = leads.take(5),
                    upcomingMeetings = meetings.take(3)
                )
            }
        } else {
            combine(
                leadRepository.getLeads(),
                meetingRepository.getMeetings()
            ) { leads, meetings ->
                val activeLeads = leads.filter { it.status != QualificationStatus.LOST && it.status != QualificationStatus.CONVERTED }
                val qualifiedLeads = leads.filter { it.status == QualificationStatus.QUALIFIED || it.status == QualificationStatus.MEETING_BOOKED }

                DashboardStats(
                    activeLeadsCount = activeLeads.size,
                    qualifiedLeadsCount = qualifiedLeads.size,
                    upcomingMeetingsCount = meetings.size,
                    callCreditsRemaining = 1000,
                    recentLeads = leads.take(5),
                    upcomingMeetings = meetings.take(3)
                )
            }
        }
    }
}

