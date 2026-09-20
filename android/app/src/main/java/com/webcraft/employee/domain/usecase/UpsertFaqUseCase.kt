package com.webcraft.employee.domain.usecase

import com.webcraft.employee.domain.repository.CompanyBrainRepository

class UpsertFaqUseCase(
    private val repository: CompanyBrainRepository
) {
    suspend operator fun invoke(question: String, answer: String) {
        repository.upsertFaq(question, answer)
    }
}
