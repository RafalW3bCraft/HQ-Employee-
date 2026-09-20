package com.webcraft.employee.domain.usecase

import com.webcraft.employee.domain.repository.CompanyBrainRepository

class UpdateCompanyProfileUseCase(
    private val repository: CompanyBrainRepository
) {
    suspend operator fun invoke(name: String, tagline: String, website: String, description: String) {
        repository.updateProfile(name, tagline, website, description)
    }
}
