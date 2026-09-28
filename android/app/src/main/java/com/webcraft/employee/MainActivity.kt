package com.webcraft.employee

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.navigation.compose.rememberNavController
import com.webcraft.employee.presentation.billing.BillingViewModel
import com.webcraft.employee.presentation.companybrain.CompanyBrainViewModel
import com.webcraft.employee.presentation.dashboard.DashboardViewModel
import com.webcraft.employee.presentation.employee.EmployeeViewModel
import com.webcraft.employee.presentation.leads.LeadsViewModel
import com.webcraft.employee.presentation.meetings.MeetingsViewModel
import com.webcraft.employee.presentation.navigation.WebcraftNavGraph
import com.webcraft.employee.presentation.settings.SettingsViewModel
import com.webcraft.employee.presentation.theme.WebcraftTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val container = (application as WebcraftApp).container

        val dashboardViewModel = DashboardViewModel(container.getDashboardDataUseCase)
        val leadsViewModel = LeadsViewModel(container.getLeadsUseCase, container.getLeadDetailUseCase)
        val meetingsViewModel = MeetingsViewModel(container.getMeetingsUseCase)
        val employeeViewModel = EmployeeViewModel(container.getEmployeeUseCase, container.voiceCallRepository)
        val companyBrainViewModel = CompanyBrainViewModel(
            container.getCompanyBrainUseCase,
            container.updateCompanyProfileUseCase,
            container.upsertServiceUseCase,
            container.upsertFaqUseCase,
            container.managePolicyUseCase
        )
        val settingsViewModel = SettingsViewModel()
        val billingViewModel = BillingViewModel(container.billingRepository)

        setContent {
            WebcraftTheme {
                val navController = rememberNavController()
                WebcraftNavGraph(
                    navController = navController,
                    dashboardViewModel = dashboardViewModel,
                    leadsViewModel = leadsViewModel,
                    meetingsViewModel = meetingsViewModel,
                    employeeViewModel = employeeViewModel,
                    companyBrainViewModel = companyBrainViewModel,
                    settingsViewModel = settingsViewModel,
                    billingViewModel = billingViewModel
                )
            }
        }
    }
}
