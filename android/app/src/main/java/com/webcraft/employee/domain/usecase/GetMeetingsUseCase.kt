package com.webcraft.employee.domain.usecase

import com.webcraft.employee.domain.model.Meeting
import com.webcraft.employee.domain.repository.MeetingRepository
import kotlinx.coroutines.flow.Flow

class GetMeetingsUseCase(
    private val meetingRepository: MeetingRepository
) {
    operator fun invoke(): Flow<List<Meeting>> = meetingRepository.getMeetings()
}
