package com.webcraft.employee.domain.repository

import com.webcraft.employee.domain.model.VoiceCallSession
import kotlinx.coroutines.flow.Flow

interface VoiceCallRepository {
    fun observeCallSession(): Flow<VoiceCallSession>
    suspend fun startCall()
    suspend fun sendUserInput(text: String)
    suspend fun endCall()
}
