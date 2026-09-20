package com.webcraft.employee.domain.usecase

import com.webcraft.employee.domain.model.Employee
import com.webcraft.employee.domain.repository.EmployeeRepository
import kotlinx.coroutines.flow.Flow

class GetEmployeeUseCase(
    private val employeeRepository: EmployeeRepository
) {
    operator fun invoke(): Flow<Employee> = employeeRepository.getEmployee()
}
