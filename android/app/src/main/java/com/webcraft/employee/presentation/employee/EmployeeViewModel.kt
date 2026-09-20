package com.webcraft.employee.presentation.employee

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.webcraft.employee.domain.model.VoiceCallSession
import com.webcraft.employee.domain.repository.VoiceCallRepository
import com.webcraft.employee.domain.usecase.GetEmployeeUseCase
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class EmployeeViewModel(
    getEmployeeUseCase: GetEmployeeUseCase,
    private val voiceCallRepository: VoiceCallRepository
) : ViewModel() {

    val uiState: StateFlow<EmployeeUiState> = getEmployeeUseCase()
        .map<_, EmployeeUiState> { employee -> EmployeeUiState.Success(employee) }
        .catch { emit(EmployeeUiState.Error(it.message ?: "Failed to load employee")) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = EmployeeUiState.Loading
        )

    val callSessionState: StateFlow<VoiceCallSession> = voiceCallRepository.observeCallSession()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = VoiceCallSession()
        )

    fun startCall() {
        viewModelScope.launch {
            voiceCallRepository.startCall()
        }
    }

    fun sendUserInput(text: String) {
        viewModelScope.launch {
            voiceCallRepository.sendUserInput(text)
        }
    }

    fun endCall() {
        viewModelScope.launch {
            voiceCallRepository.endCall()
        }
    }
}
