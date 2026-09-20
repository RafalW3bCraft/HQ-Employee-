package com.webcraft.employee.domain.usecase

import com.webcraft.employee.domain.model.Lead
import com.webcraft.employee.domain.repository.LeadRepository

class GetLeadDetailUseCase(
    private val leadRepository: LeadRepository
) {
    suspend operator fun invoke(id: String): Lead? = leadRepository.getLeadById(id)
}
