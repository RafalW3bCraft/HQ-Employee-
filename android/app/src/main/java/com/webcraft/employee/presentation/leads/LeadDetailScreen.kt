package com.webcraft.employee.presentation.leads

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.webcraft.employee.domain.model.Lead
import com.webcraft.employee.presentation.common.StatusBadge
import com.webcraft.employee.presentation.theme.CyanAccent
import com.webcraft.employee.presentation.theme.DarkBackground
import com.webcraft.employee.presentation.theme.DarkSurface
import com.webcraft.employee.presentation.theme.DarkTextPrimary
import com.webcraft.employee.presentation.theme.DarkTextSecondary
import com.webcraft.employee.presentation.theme.IndigoPrimary

@Composable
fun LeadDetailScreen(
    leadId: String,
    viewModel: LeadsViewModel,
    onBack: () -> Unit
) {
    LaunchedEffect(leadId) {
        viewModel.loadLeadDetail(leadId)
    }

    val state by viewModel.detailUiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = DarkTextPrimary
                )
            }
            Text(
                text = "Lead Project Brief",
                style = MaterialTheme.typography.titleLarge,
                color = DarkTextPrimary
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        when (val currentState = state) {
            is LeadDetailUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = IndigoPrimary)
                }
            }
            is LeadDetailUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(text = currentState.message, color = MaterialTheme.colorScheme.error)
                }
            }
            is LeadDetailUiState.Success -> {
                LeadDetailContent(lead = currentState.lead)
            }
        }
    }
}

@Composable
private fun LeadDetailContent(lead: Lead) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
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
                    Text(text = lead.fullName, style = MaterialTheme.typography.headlineMedium, color = DarkTextPrimary)
                    StatusBadge(status = lead.status)
                }
                lead.companyName?.let {
                    Text(text = it, style = MaterialTheme.typography.titleMedium, color = DarkTextSecondary)
                }
                Spacer(modifier = Modifier.height(12.dp))
                lead.contacts.forEach { contact ->
                    Text(
                        text = "${contact.type}: ${contact.value}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = CyanAccent
                    )
                }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Project Scope", style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Type: ${lead.projectType ?: "Undisclosed"}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = IndigoPrimary
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = lead.businessObjective ?: "No objective recorded yet.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = DarkTextSecondary
                )
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Commercial Constraints", style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "Stated Budget: ${lead.budgetStated ?: "Pending"}", style = MaterialTheme.typography.bodyMedium, color = DarkTextSecondary)
                Text(text = "Expected Timeline: ${lead.timelineExpected ?: "Pending"}", style = MaterialTheme.typography.bodyMedium, color = DarkTextSecondary)
            }
        }

        lead.qualificationNotes?.let { notes ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "AI Coordinator Notes", style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = notes, style = MaterialTheme.typography.bodyMedium, color = DarkTextSecondary)
                }
            }
        }
    }
}
