package com.webcraft.employee.presentation.leads

import com.webcraft.employee.domain.model.Lead

sealed interface LeadsUiState {
    data object Loading : LeadsUiState
    data class Success(val leads: List<Lead>) : LeadsUiState
    data class Error(val message: String) : LeadsUiState
}

sealed interface LeadDetailUiState {
    data object Loading : LeadDetailUiState
    data class Success(val lead: Lead) : LeadDetailUiState
    data class Error(val message: String) : LeadDetailUiState
}
