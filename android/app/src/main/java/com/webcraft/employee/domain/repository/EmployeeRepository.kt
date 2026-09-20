package com.webcraft.employee.domain.repository

import com.webcraft.employee.domain.model.Employee
import kotlinx.coroutines.flow.Flow

interface EmployeeRepository {
    fun getEmployee(): Flow<Employee>
    suspend fun updateInstructions(instructions: String)
}
