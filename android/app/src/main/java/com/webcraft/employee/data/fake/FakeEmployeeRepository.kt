package com.webcraft.employee.data.fake

import com.webcraft.employee.domain.model.Employee
import com.webcraft.employee.domain.repository.EmployeeRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class FakeEmployeeRepository : EmployeeRepository {
    private val _employee = MutableStateFlow(
        Employee(
            id = "emp-001",
            name = "HQ Business Development & Client Coordinator",
            role = "Business Development & Client Coordination",
            systemInstructions = """
                You are the HQ Business Development & Client Coordinator for HQ.
                Your purpose is to communicate with prospective clients, qualify software development opportunities, discuss only approved company information, schedule discovery meetings, maintain structured lead memory, and escalate any out-of-scope decisions to human leadership.
                
                You must NEVER:
                - Invent unapproved prices or custom discounts.
                - Promise unapproved deadlines or timelines.
                - Sign or accept contracts or legal commitments.
                - Request payments, credit cards, or passwords.
                - Impersonate a human.
            """.trimIndent(),
            isActive = true,
            activePolicyVersion = "v1.0.0",
            totalCallsHandled = 18,
            totalLeadsQualified = 12
        )
    )

    override fun getEmployee(): Flow<Employee> = _employee.asStateFlow()

    override suspend fun updateInstructions(instructions: String) {
        _employee.value = _employee.value.copy(systemInstructions = instructions)
    }
}
