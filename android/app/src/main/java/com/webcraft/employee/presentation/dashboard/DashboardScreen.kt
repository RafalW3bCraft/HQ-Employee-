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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import com.webcraft.employee.presentation.theme.AmberWarning
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
            ControlCenterContent(stats = currentState.stats, onLeadClick = onLeadClick)
        }
    }
}

@Composable
private fun ControlCenterContent(
    stats: DashboardStats,
    onLeadClick: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // ── 1. HEADER & EMPLOYEE STATUS ──────────────────────────────────────
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(text = "HQ", style = MaterialTheme.typography.headlineSmall, color = DarkTextPrimary)
                            Text(
                                text = "Business Development & Client Coordination",
                                style = MaterialTheme.typography.bodySmall,
                                color = DarkTextSecondary
                            )
                        }
                        // Status Badge
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(EmeraldSuccess.copy(alpha = 0.15f))
                                .padding(horizontal = 10.dp, vertical = 5.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(EmeraldSuccess)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(text = "Available", color = EmeraldSuccess, style = MaterialTheme.typography.labelSmall)
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Primary Action: START EMPLOYEE
                    Button(
                        onClick = { /* Start full-duplex session */ },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(imageVector = Icons.Default.PlayArrow, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "START EMPLOYEE", style = MaterialTheme.typography.titleSmall)
                    }
                }
            }
        }

        // ── 2. CURRENT ACTIVITY ─────────────────────────────────────────────
        item {
            SectionTitle(title = "CURRENT ACTIVITY")
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ActivityRow(label = "Current Lead", value = stats.recentLeads.firstOrNull()?.fullName ?: "Waiting for next lead")
                    ActivityRow(label = "Current Objective", value = "Qualify Discovery Requirements")
                    ActivityRow(label = "Current Call", value = "Idle — Ready to connect via AssemblyAI")
                    ActivityRow(label = "Current Action", value = "Listening on fail-closed policy boundary")
                }
            }
        }

        // ── 3. TODAY'S WORK ──────────────────────────────────────────────────
        item {
            SectionTitle(title = "TODAY'S WORK")
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                MetricCard(modifier = Modifier.weight(1f), label = "Calls", value = "12", color = IndigoPrimary)
                MetricCard(modifier = Modifier.weight(1f), label = "Qualified", value = "${stats.qualifiedLeadsCount}", color = EmeraldSuccess)
                MetricCard(modifier = Modifier.weight(1f), label = "Meetings", value = "${stats.upcomingMeetingsCount}", color = CyanAccent)
                MetricCard(modifier = Modifier.weight(1f), label = "Pending Approvals", value = "0", color = AmberWarning)
            }
        }

        // ── 4. NEEDS ATTENTION ───────────────────────────────────────────────
        item {
            SectionTitle(title = "NEEDS ATTENTION")
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = EmeraldSuccess, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "All customer actions within policy guidelines", style = MaterialTheme.typography.bodySmall, color = DarkTextPrimary)
                    }
                    Text(
                        text = "Zero approval requests pending. No failed calls.",
                        style = MaterialTheme.typography.labelSmall,
                        color = DarkTextSecondary,
                        modifier = Modifier.padding(start = 24.dp, top = 2.dp)
                    )
                }
            }
        }

        // ── 5. QUICK ACTIONS ────────────────────────────────────────────────
        item {
            SectionTitle(title = "QUICK ACTIONS")
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickActionButton(modifier = Modifier.weight(1f), title = "Leads")
                QuickActionButton(modifier = Modifier.weight(1f), title = "Meetings")
                QuickActionButton(modifier = Modifier.weight(1f), title = "Brain")
                QuickActionButton(modifier = Modifier.weight(1f), title = "Credits: ${stats.callCreditsRemaining}")
            }
        }
    }
}

@Composable
private fun SectionTitle(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelMedium,
        color = DarkTextSecondary,
        modifier = Modifier.padding(vertical = 4.dp)
    )
}

@Composable
private fun ActivityRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = DarkTextSecondary)
        Text(text = value, style = MaterialTheme.typography.bodySmall, color = DarkTextPrimary)
    }
}

@Composable
private fun MetricCard(modifier: Modifier = Modifier, label: String, value: String, color: Color) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(10.dp)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Text(text = label, style = MaterialTheme.typography.labelSmall, color = DarkTextSecondary, maxLines = 1)
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = value, style = MaterialTheme.typography.titleLarge, color = color)
        }
    }
}

@Composable
private fun QuickActionButton(modifier: Modifier = Modifier, title: String) {
    Card(
        modifier = modifier.clickable { },
        colors = CardDefaults.cardColors(containerColor = DarkSurfaceVariant),
        shape = RoundedCornerShape(8.dp)
    ) {
        Box(modifier = Modifier.padding(vertical = 10.dp, horizontal = 4.dp), contentAlignment = Alignment.Center) {
            Text(text = title, style = MaterialTheme.typography.labelSmall, color = DarkTextPrimary, maxLines = 1)
        }
    }
}
