package com.webcraft.employee.presentation.settings

data class SettingsUiState(
    val backendUrl: String = "http://10.0.2.2:3000",
    val voiceAgentStatus: String = "Edge Routing Ready (Edge wss)",
    val telephonyProvider: String = "AssemblyAI SIP (Default)",
    val appVersion: String = "0.1.0-alpha",
    val isConnected: Boolean = true
)
