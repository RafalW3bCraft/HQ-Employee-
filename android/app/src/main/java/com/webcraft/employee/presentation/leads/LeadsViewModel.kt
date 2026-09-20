package com.webcraft.employee.presentation.leads

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.webcraft.employee.domain.usecase.GetLeadDetailUseCase
import com.webcraft.employee.domain.usecase.GetLeadsUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class LeadsViewModel(
    getLeadsUseCase: GetLeadsUseCase,
    private val getLeadDetailUseCase: GetLeadDetailUseCase
) : ViewModel() {

    val uiState: StateFlow<LeadsUiState> = getLeadsUseCase()
        .map<_, LeadsUiState> { leads -> LeadsUiState.Success(leads) }
        .catch { emit(LeadsUiState.Error(it.message ?: "Failed to load leads")) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = LeadsUiState.Loading
        )

    private val _detailUiState = MutableStateFlow<LeadDetailUiState>(LeadDetailUiState.Loading)
    val detailUiState: StateFlow<LeadDetailUiState> = _detailUiState.asStateFlow()

    fun loadLeadDetail(leadId: String) {
        viewModelScope.launch {
            _detailUiState.value = LeadDetailUiState.Loading
            try {
                val lead = getLeadDetailUseCase(leadId)
                if (lead != null) {
                    _detailUiState.value = LeadDetailUiState.Success(lead)
                } else {
                    _detailUiState.value = LeadDetailUiState.Error("Lead not found")
                }
            } catch (e: Exception) {
                _detailUiState.value = LeadDetailUiState.Error(e.message ?: "Failed to load lead")
            }
        }
    }
}
