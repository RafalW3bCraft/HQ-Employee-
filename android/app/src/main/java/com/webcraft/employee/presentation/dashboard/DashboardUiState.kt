package com.webcraft.employee.presentation.dashboard

import com.webcraft.employee.domain.model.DashboardStats

sealed interface DashboardUiState {
    data object Loading : DashboardUiState
    data class Success(val stats: DashboardStats) : DashboardUiState
    data class Error(val message: String) : DashboardUiState
}
