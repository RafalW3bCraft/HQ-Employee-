package com.webcraft.employee.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.webcraft.employee.presentation.common.AppScaffold
import com.webcraft.employee.presentation.companybrain.CompanyBrainScreen
import com.webcraft.employee.presentation.companybrain.CompanyBrainViewModel
import com.webcraft.employee.presentation.dashboard.DashboardScreen
import com.webcraft.employee.presentation.dashboard.DashboardViewModel
import com.webcraft.employee.presentation.employee.EmployeeScreen
import com.webcraft.employee.presentation.employee.EmployeeViewModel
import com.webcraft.employee.presentation.leads.LeadDetailScreen
import com.webcraft.employee.presentation.leads.LeadsScreen
import com.webcraft.employee.presentation.leads.LeadsViewModel
import com.webcraft.employee.presentation.meetings.MeetingsScreen
import com.webcraft.employee.presentation.billing.BillingScreen
import com.webcraft.employee.presentation.billing.BillingViewModel
import com.webcraft.employee.presentation.meetings.MeetingsViewModel
import com.webcraft.employee.presentation.settings.SettingsScreen
import com.webcraft.employee.presentation.settings.SettingsViewModel

@Composable
fun WebcraftNavGraph(
    navController: NavHostController,
    dashboardViewModel: DashboardViewModel,
    leadsViewModel: LeadsViewModel,
    meetingsViewModel: MeetingsViewModel,
    employeeViewModel: EmployeeViewModel,
    companyBrainViewModel: CompanyBrainViewModel,
    settingsViewModel: SettingsViewModel,
    billingViewModel: BillingViewModel
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Dashboard.route
    ) {
        composable(Screen.Dashboard.route) {
            AppScaffold(navController = navController, currentScreenTitle = Screen.Dashboard.title) {
                DashboardScreen(
                    viewModel = dashboardViewModel,
                    onLeadClick = { leadId -> navController.navigate(Screen.LeadDetail.createRoute(leadId)) }
                )
            }
        }
        composable(Screen.Leads.route) {
            AppScaffold(navController = navController, currentScreenTitle = Screen.Leads.title) {
                LeadsScreen(
                    viewModel = leadsViewModel,
                    onLeadClick = { leadId -> navController.navigate(Screen.LeadDetail.createRoute(leadId)) }
                )
            }
        }
        composable(
            route = Screen.LeadDetail.route,
            arguments = listOf(navArgument("leadId") { type = NavType.StringType })
        ) { backStackEntry ->
            val leadId = backStackEntry.arguments?.getString("leadId") ?: ""
            LeadDetailScreen(
                leadId = leadId,
                viewModel = leadsViewModel,
                onBack = { navController.popBackStack() }
            )
        }
        composable(Screen.Meetings.route) {
            AppScaffold(navController = navController, currentScreenTitle = Screen.Meetings.title) {
                MeetingsScreen(viewModel = meetingsViewModel)
            }
        }
        composable(Screen.Employee.route) {
            AppScaffold(navController = navController, currentScreenTitle = Screen.Employee.title) {
                EmployeeScreen(viewModel = employeeViewModel)
            }
        }
        composable(Screen.CompanyBrain.route) {
            AppScaffold(navController = navController, currentScreenTitle = Screen.CompanyBrain.title) {
                CompanyBrainScreen(viewModel = companyBrainViewModel)
            }
        }
        composable(Screen.Billing.route) {
            AppScaffold(navController = navController, currentScreenTitle = Screen.Billing.title) {
                BillingScreen(viewModel = billingViewModel)
            }
        }
        composable(Screen.Settings.route) {
            AppScaffold(navController = navController, currentScreenTitle = Screen.Settings.title) {
                SettingsScreen(viewModel = settingsViewModel)
            }
        }
    }
}
