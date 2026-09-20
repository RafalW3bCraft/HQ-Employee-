package com.webcraft.employee.domain.usecase

import com.webcraft.employee.domain.model.CompanyBrain
import com.webcraft.employee.domain.repository.CompanyBrainRepository
import kotlinx.coroutines.flow.Flow

class GetCompanyBrainUseCase(
    private val companyBrainRepository: CompanyBrainRepository
) {
    operator fun invoke(): Flow<CompanyBrain> = companyBrainRepository.getCompanyBrain()
}
