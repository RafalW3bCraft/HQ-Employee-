package com.webcraft.employee.presentation.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.webcraft.employee.domain.model.DashboardStats
import com.webcraft.employee.domain.model.Lead
import com.webcraft.employee.presentation.common.StatusBadge
import com.webcraft.employee.presentation.theme.CyanAccent
import com.webcraft.employee.presentation.theme.DarkSurface
import com.webcraft.employee.presentation.theme.DarkSurfaceVariant
import com.webcraft.employee.presentation.theme.DarkTextPrimary
import com.webcraft.employee.presentation.theme.DarkTextSecondary
import com.webcraft.employee.presentation.theme.EmeraldSuccess
import com.webcraft.employee.presentation.theme.IndigoPrimary

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onLeadClick: (String) -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    when (val currentState = state) {
        is DashboardUiState.Loading -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = IndigoPrimary)
            }
        }
        is DashboardUiState.Error -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(text = currentState.message, color = MaterialTheme.colorScheme.error)
            }
        }
        is DashboardUiState.Success -> {
            DashboardContent(stats = currentState.stats, onLeadClick = onLeadClick)
        }
    }
}

@Composable
private fun DashboardContent(
    stats: DashboardStats,
    onLeadClick: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text(
                text = "Business Overview",
                style = MaterialTheme.typography.titleMedium,
                color = DarkTextPrimary
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    modifier = Modifier.weight(1f),
                    title = "Active Leads",
                    value = "${stats.activeLeadsCount}",
                    color = IndigoPrimary
                )
                StatCard(
                    modifier = Modifier.weight(1f),
                    title = "Qualified",
                    value = "${stats.qualifiedLeadsCount}",
                    color = EmeraldSuccess
                )
                StatCard(
                    modifier = Modifier.weight(1f),
                    title = "Meetings",
                    value = "${stats.upcomingMeetingsCount}",
                    color = CyanAccent
                )
            }
        }

        item {
            Text(
                text = "Recent Inquiries",
                style = MaterialTheme.typography.titleMedium,
                color = DarkTextPrimary
            )
        }

        items(stats.recentLeads) { lead ->
            LeadItemCard(lead = lead, onClick = { onLeadClick(lead.id) })
        }
    }
}

@Composable
private fun StatCard(
    title: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(text = title, style = MaterialTheme.typography.labelSmall, color = DarkTextSecondary)
            Spacer(modifier = Modifier.height(6.dp))
            Text(text = value, style = MaterialTheme.typography.headlineMedium, color = color)
        }
    }
}

@Composable
private fun LeadItemCard(
    lead: Lead,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = lead.fullName, style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                lead.companyName?.let {
                    Text(text = it, style = MaterialTheme.typography.bodyMedium, color = DarkTextSecondary)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = lead.projectType ?: "General Inquiry",
                    style = MaterialTheme.typography.labelSmall,
                    color = CyanAccent
                )
            }
            StatusBadge(status = lead.status)
        }
    }
}
