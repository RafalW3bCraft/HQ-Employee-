package com.webcraft.employee.presentation.employee

import com.webcraft.employee.domain.model.Employee

sealed interface EmployeeUiState {
    data object Loading : EmployeeUiState
    data class Success(val employee: Employee) : EmployeeUiState
    data class Error(val message: String) : EmployeeUiState
}
