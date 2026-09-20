package com.webcraft.employee.domain.usecase

import com.webcraft.employee.domain.model.Lead
import com.webcraft.employee.domain.repository.LeadRepository
import kotlinx.coroutines.flow.Flow

class GetLeadsUseCase(
    private val leadRepository: LeadRepository
) {
    operator fun invoke(): Flow<List<Lead>> = leadRepository.getLeads()
}
