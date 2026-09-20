package com.webcraft.employee.domain.repository

import com.webcraft.employee.domain.model.ApprovedService
import com.webcraft.employee.domain.model.AuthorityRule
import com.webcraft.employee.domain.model.CompanyBrain
import com.webcraft.employee.domain.model.EscalationRule
import kotlinx.coroutines.flow.Flow

interface CompanyBrainRepository {
    fun getCompanyBrain(): Flow<CompanyBrain>
    suspend fun updateProfile(name: String, tagline: String, website: String, description: String)
    suspend fun upsertService(service: ApprovedService)
    suspend fun upsertFaq(question: String, answer: String)
    suspend fun createPolicyVersion(
        version: String,
        instructions: String,
        authorityRules: List<AuthorityRule>,
        escalationRules: List<EscalationRule>
    )
    suspend fun activatePolicyVersion(policyId: String)
}
