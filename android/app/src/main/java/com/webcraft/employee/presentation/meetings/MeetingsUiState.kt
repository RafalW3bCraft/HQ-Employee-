package com.webcraft.employee.presentation.meetings

import com.webcraft.employee.domain.model.Meeting

sealed interface MeetingsUiState {
    data object Loading : MeetingsUiState
    data class Success(val meetings: List<Meeting>) : MeetingsUiState
    data class Error(val message: String) : MeetingsUiState
}
