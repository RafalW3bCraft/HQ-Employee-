package com.webcraft.employee.domain.repository

import com.webcraft.employee.domain.model.Lead
import com.webcraft.employee.domain.model.QualificationStatus
import kotlinx.coroutines.flow.Flow

interface LeadRepository {
    fun getLeads(): Flow<List<Lead>>
    suspend fun getLeadById(id: String): Lead?
    suspend fun updateLeadStatus(id: String, status: QualificationStatus)
}
