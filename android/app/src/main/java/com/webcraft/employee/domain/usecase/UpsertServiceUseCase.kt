package com.webcraft.employee.domain.usecase

import com.webcraft.employee.domain.model.ApprovedService
import com.webcraft.employee.domain.repository.CompanyBrainRepository

class UpsertServiceUseCase(
    private val repository: CompanyBrainRepository
) {
    suspend operator fun invoke(service: ApprovedService) {
        repository.upsertService(service)
    }
}
