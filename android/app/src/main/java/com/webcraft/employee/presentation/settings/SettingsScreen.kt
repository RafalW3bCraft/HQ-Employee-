package com.webcraft.employee.presentation.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.webcraft.employee.presentation.theme.CyanAccent
import com.webcraft.employee.presentation.theme.DarkSurface
import com.webcraft.employee.presentation.theme.DarkTextPrimary
import com.webcraft.employee.presentation.theme.DarkTextSecondary
import com.webcraft.employee.presentation.theme.EmeraldSuccess
import com.webcraft.employee.presentation.theme.IndigoPrimary

@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel
) {
    val state by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "System & Environment Settings",
            style = MaterialTheme.typography.titleMedium,
            color = DarkTextPrimary
        )

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Backend API Endpoint", style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = state.backendUrl,
                    onValueChange = { viewModel.updateBackendUrl(it) },
                    label = { Text("Server Base URL") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = TextFieldDefaults.colors(
                        focusedTextColor = DarkTextPrimary,
                        unfocusedTextColor = DarkTextPrimary,
                        focusedContainerColor = DarkSurface,
                        unfocusedContainerColor = DarkSurface,
                        focusedIndicatorColor = IndigoPrimary
                    )
                )
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Integration Health", style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                Spacer(modifier = Modifier.height(8.dp))
                SettingItem(label = "Voice Agent API", value = state.voiceAgentStatus, valueColor = EmeraldSuccess)
                SettingItem(label = "Telephony Route", value = state.telephonyProvider, valueColor = CyanAccent)
                SettingItem(label = "Backend Connection", value = if (state.isConnected) "Connected" else "Offline", valueColor = EmeraldSuccess)
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "About", style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                Spacer(modifier = Modifier.height(8.dp))
                SettingItem(label = "Application Version", value = state.appVersion, valueColor = DarkTextSecondary)
                SettingItem(label = "Client Architecture", value = "Kotlin + Jetpack Compose M3", valueColor = DarkTextSecondary)
                SettingItem(label = "Authority Boundary", value = "Backend Authoritative", valueColor = IndigoPrimary)
            }
        }
    }
}

@Composable
private fun SettingItem(label: String, value: String, valueColor: androidx.compose.ui.graphics.Color) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium, color = DarkTextSecondary)
        Text(text = value, style = MaterialTheme.typography.bodyMedium, color = valueColor)
    }
}
