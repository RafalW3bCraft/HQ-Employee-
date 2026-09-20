package com.webcraft.employee.presentation.leads

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
import androidx.compose.ui.unit.dp
import com.webcraft.employee.domain.model.Lead
import com.webcraft.employee.presentation.common.StatusBadge
import com.webcraft.employee.presentation.theme.CyanAccent
import com.webcraft.employee.presentation.theme.DarkSurface
import com.webcraft.employee.presentation.theme.DarkTextPrimary
import com.webcraft.employee.presentation.theme.DarkTextSecondary
import com.webcraft.employee.presentation.theme.IndigoPrimary

@Composable
fun LeadsScreen(
    viewModel: LeadsViewModel,
    onLeadClick: (String) -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    when (val currentState = state) {
        is LeadsUiState.Loading -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = IndigoPrimary)
            }
        }
        is LeadsUiState.Error -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(text = currentState.message, color = MaterialTheme.colorScheme.error)
            }
        }
        is LeadsUiState.Success -> {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Text(
                        text = "Discovered Opportunities (${currentState.leads.size})",
                        style = MaterialTheme.typography.titleMedium,
                        color = DarkTextPrimary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                }
                items(currentState.leads) { lead ->
                    LeadCard(lead = lead, onClick = { onLeadClick(lead.id) })
                }
            }
        }
    }
}

@Composable
private fun LeadCard(
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
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = lead.fullName, style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                    lead.companyName?.let {
                        Text(text = it, style = MaterialTheme.typography.bodyMedium, color = DarkTextSecondary)
                    }
                }
                StatusBadge(status = lead.status)
            }
            Spacer(modifier = Modifier.height(8.dp))
            lead.businessObjective?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DarkTextSecondary,
                    maxLines = 2
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(text = lead.projectType ?: "General Inquiry", style = MaterialTheme.typography.labelSmall, color = CyanAccent)
                lead.budgetStated?.let {
                    Text(text = it, style = MaterialTheme.typography.labelSmall, color = IndigoPrimary)
                }
            }
        }
    }
}
