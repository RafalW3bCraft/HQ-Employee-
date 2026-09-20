package com.webcraft.employee.domain.repository

import com.webcraft.employee.domain.model.Meeting
import kotlinx.coroutines.flow.Flow

interface MeetingRepository {
    fun getMeetings(): Flow<List<Meeting>>
    suspend fun getMeetingById(id: String): Meeting?
}
