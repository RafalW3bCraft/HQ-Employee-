package com.webcraft.employee.domain.model

data class DashboardStats(
    val activeLeadsCount: Int,
    val qualifiedLeadsCount: Int,
    val upcomingMeetingsCount: Int,
    val callCreditsRemaining: Int,
    val recentLeads: List<Lead>,
    val upcomingMeetings: List<Meeting>
)
