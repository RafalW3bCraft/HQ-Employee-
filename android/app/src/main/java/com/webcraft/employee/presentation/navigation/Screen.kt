package com.webcraft.employee.presentation.navigation

sealed class Screen(val route: String, val title: String) {
    data object Dashboard : Screen("dashboard", "Dashboard")
    data object Leads : Screen("leads", "Leads")
    data object LeadDetail : Screen("leads/{leadId}", "Lead Detail") {
        fun createRoute(leadId: String) = "leads/$leadId"
    }
    data object Meetings : Screen("meetings", "Meetings")
    data object Employee : Screen("employee", "AI Employee")
    data object CompanyBrain : Screen("company_brain", "Company Brain")
    data object Settings : Screen("settings", "Settings")
}
