package com.webcraft.employee.domain.usecase

import com.webcraft.employee.domain.model.AuthorityRule
import com.webcraft.employee.domain.model.EscalationRule
import com.webcraft.employee.domain.repository.CompanyBrainRepository

class ManagePolicyUseCase(
    private val repository: CompanyBrainRepository
) {
    suspend fun createVersion(
        version: String,
        instructions: String,
        authorityRules: List<AuthorityRule>,
        escalationRules: List<EscalationRule>
    ) {
        repository.createPolicyVersion(version, instructions, authorityRules, escalationRules)
    }

    suspend fun activateVersion(policyId: String) {
        repository.activatePolicyVersion(policyId)
    }
}
