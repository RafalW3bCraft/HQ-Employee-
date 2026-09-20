package com.webcraft.employee.presentation.meetings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.webcraft.employee.domain.model.Meeting
import com.webcraft.employee.presentation.theme.CyanAccent
import com.webcraft.employee.presentation.theme.DarkSurface
import com.webcraft.employee.presentation.theme.DarkTextPrimary
import com.webcraft.employee.presentation.theme.DarkTextSecondary
import com.webcraft.employee.presentation.theme.EmeraldSuccess
import com.webcraft.employee.presentation.theme.IndigoPrimary

@Composable
fun MeetingsScreen(
    viewModel: MeetingsViewModel
) {
    val state by viewModel.uiState.collectAsState()

    when (val currentState = state) {
        is MeetingsUiState.Loading -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = IndigoPrimary)
            }
        }
        is MeetingsUiState.Error -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(text = currentState.message, color = MaterialTheme.colorScheme.error)
            }
        }
        is MeetingsUiState.Success -> {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Text(
                        text = "Scheduled Discovery Consultations (${currentState.meetings.size})",
                        style = MaterialTheme.typography.titleMedium,
                        color = DarkTextPrimary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                }
                items(currentState.meetings) { meeting ->
                    MeetingCard(meeting = meeting)
                }
            }
        }
    }
}

@Composable
private fun MeetingCard(meeting: Meeting) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = meeting.title, style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(EmeraldSuccess.copy(alpha = 0.2f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(text = meeting.status.name, style = MaterialTheme.typography.labelSmall, color = EmeraldSuccess)
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(text = "Lead: ${meeting.leadName}", style = MaterialTheme.typography.bodyMedium, color = CyanAccent)
            Spacer(modifier = Modifier.height(6.dp))
            Text(text = meeting.topic, style = MaterialTheme.typography.bodyMedium, color = DarkTextSecondary)
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(text = "Time: ${meeting.scheduledAt.take(16).replace('T', ' ')}", style = MaterialTheme.typography.labelSmall, color = DarkTextSecondary)
                Text(text = "${meeting.durationMinutes} mins", style = MaterialTheme.typography.labelSmall, color = IndigoPrimary)
            }
        }
    }
}
