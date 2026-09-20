package com.webcraft.employee.presentation.meetings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.webcraft.employee.domain.usecase.GetMeetingsUseCase
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

class MeetingsViewModel(
    getMeetingsUseCase: GetMeetingsUseCase
) : ViewModel() {

    val uiState: StateFlow<MeetingsUiState> = getMeetingsUseCase()
        .map<_, MeetingsUiState> { meetings -> MeetingsUiState.Success(meetings) }
        .catch { emit(MeetingsUiState.Error(it.message ?: "Failed to load meetings")) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = MeetingsUiState.Loading
        )
}
