package com.webcraft.employee.presentation.employee

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.webcraft.employee.domain.model.CallStatus
import com.webcraft.employee.domain.model.Employee
import com.webcraft.employee.domain.model.PolicyDecisionItem
import com.webcraft.employee.domain.model.TranscriptItem
import com.webcraft.employee.domain.model.VoiceCallSession
import com.webcraft.employee.presentation.theme.AmberWarning
import com.webcraft.employee.presentation.theme.CyanAccent
import com.webcraft.employee.presentation.theme.DarkBackground
import com.webcraft.employee.presentation.theme.DarkSurface
import com.webcraft.employee.presentation.theme.DarkTextPrimary
import com.webcraft.employee.presentation.theme.DarkTextSecondary
import com.webcraft.employee.presentation.theme.EmeraldSuccess
import com.webcraft.employee.presentation.theme.IndigoPrimary
import com.webcraft.employee.presentation.theme.RoseError

@Composable
fun EmployeeScreen(
    viewModel: EmployeeViewModel
) {
    val state by viewModel.uiState.collectAsState()
    val callSession by viewModel.callSessionState.collectAsState()

    when (val currentState = state) {
        is EmployeeUiState.Loading -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = IndigoPrimary)
            }
        }
        is EmployeeUiState.Error -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(text = currentState.message, color = MaterialTheme.colorScheme.error)
            }
        }
        is EmployeeUiState.Success -> {
            EmployeeContent(
                employee = currentState.employee,
                callSession = callSession,
                onStartCall = { viewModel.startCall() },
                onEndCall = { viewModel.endCall() },
                onSendUserInput = { text -> viewModel.sendUserInput(text) }
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EmployeeContent(
    employee: Employee,
    callSession: VoiceCallSession,
    onStartCall: () -> Unit,
    onEndCall: () -> Unit,
    onSendUserInput: (String) -> Unit
) {
    var customInputText by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Employee Profile Card
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
                    Text(text = employee.name, style = MaterialTheme.typography.titleLarge, color = DarkTextPrimary)
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(EmeraldSuccess.copy(alpha = 0.2f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(text = "ACTIVE", style = MaterialTheme.typography.labelSmall, color = EmeraldSuccess)
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = employee.role, style = MaterialTheme.typography.bodyMedium, color = CyanAccent)
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(text = "Policy: ${employee.activePolicyVersion}", style = MaterialTheme.typography.labelSmall, color = DarkTextSecondary)
                    Text(text = "Voice: Alba (24kHz PCM)", style = MaterialTheme.typography.labelSmall, color = CyanAccent)
                    Text(text = "${employee.totalCallsHandled} Calls", style = MaterialTheme.typography.labelSmall, color = IndigoPrimary)
                }
            }
        }

        // Live Voice Agent Interaction Card
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
                    Column {
                        Text(
                            text = "AssemblyAI Voice Agent",
                            style = MaterialTheme.typography.titleMedium,
                            color = DarkTextPrimary
                        )
                        Text(
                            text = "Full-Duplex Managed STT + LLM + TTS",
                            style = MaterialTheme.typography.labelSmall,
                            color = DarkTextSecondary
                        )
                    }

                    // Call Status Pill
                    val (statusBg, statusFg, statusLabel) = when (callSession.status) {
                        CallStatus.IDLE -> Triple(DarkBackground, DarkTextSecondary, "IDLE")
                        CallStatus.CONNECTING -> Triple(IndigoPrimary.copy(alpha = 0.2f), IndigoPrimary, "CONNECTING")
                        CallStatus.ACTIVE -> Triple(EmeraldSuccess.copy(alpha = 0.2f), EmeraldSuccess, "ACTIVE")
                        CallStatus.USER_SPEAKING -> Triple(CyanAccent.copy(alpha = 0.2f), CyanAccent, "USER SPEAKING")
                        CallStatus.AGENT_SPEAKING -> Triple(IndigoPrimary.copy(alpha = 0.3f), IndigoPrimary, "AGENT SPEAKING")
                        CallStatus.ENDED -> Triple(DarkBackground, DarkTextSecondary, "ENDED")
                        CallStatus.ERROR -> Triple(RoseError.copy(alpha = 0.2f), RoseError, "ERROR")
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(statusBg)
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(text = statusLabel, style = MaterialTheme.typography.labelSmall, color = statusFg)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Call Controls
                val isCallActive = callSession.status != CallStatus.IDLE && callSession.status != CallStatus.ENDED
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (!isCallActive) {
                        Button(
                            onClick = onStartCall,
                            colors = ButtonDefaults.buttonColors(containerColor = EmeraldSuccess),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(text = "Connect Voice Call", color = Color.White)
                        }
                    } else {
                        Button(
                            onClick = onEndCall,
                            colors = ButtonDefaults.buttonColors(containerColor = RoseError),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(text = "End Voice Call (session.end)", color = Color.White)
                        }
                    }
                }

                if (isCallActive) {
                    Spacer(modifier = Modifier.height(12.dp))

                    // Preset Test Utterances
                    Text(
                        text = "Quick Test Utterances:",
                        style = MaterialTheme.typography.labelSmall,
                        color = DarkTextSecondary
                    )
                    Spacer(modifier = Modifier.height(6.dp))

                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        QuickUtteranceChip("Services?", "What services and technologies do you offer?", onSendUserInput)
                        QuickUtteranceChip("Pricing?", "Can you give me price guidance for an MVP?", onSendUserInput)
                        QuickUtteranceChip("Discount (50%)", "Can you give me a 50% discount on that?", onSendUserInput)
                        QuickUtteranceChip("Sign Contract", "Can you sign this NDA and project contract right now?", onSendUserInput)
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Custom input row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = customInputText,
                            onValueChange = { customInputText = it },
                            placeholder = { Text("Speak or type test query...", style = MaterialTheme.typography.bodySmall, color = DarkTextSecondary) },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            colors = TextFieldDefaults.colors(
                                focusedContainerColor = DarkBackground,
                                unfocusedContainerColor = DarkBackground,
                                focusedTextColor = DarkTextPrimary,
                                unfocusedTextColor = DarkTextPrimary
                            )
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                if (customInputText.isNotBlank()) {
                                    onSendUserInput(customInputText)
                                    customInputText = ""
                                }
                            },
                            enabled = customInputText.isNotBlank(),
                            colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Send")
                        }
                    }

                    // Live Transcript Box
                    if (callSession.transcripts.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Live Conversation Transcripts",
                            style = MaterialTheme.typography.titleSmall,
                            color = DarkTextPrimary
                        )
                        Spacer(modifier = Modifier.height(6.dp))

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(DarkBackground)
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            callSession.transcripts.takeLast(6).forEach { transcript ->
                                TranscriptRow(transcript)
                            }
                        }
                    }

                    // Real-Time Policy Engine Governance Feed
                    if (callSession.policyDecisions.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Policy Engine Governance Decisions",
                            style = MaterialTheme.typography.titleSmall,
                            color = DarkTextPrimary
                        )
                        Spacer(modifier = Modifier.height(6.dp))

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(DarkBackground)
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            callSession.policyDecisions.takeLast(4).forEach { decision ->
                                PolicyDecisionRow(decision)
                            }
                        }
                    }
                }
            }
        }

        // Persona & Instructions Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "System Prompt & Persona", style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = employee.systemInstructions,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DarkTextSecondary
                )
            }
        }

        // Governance Boundaries Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Deterministic Governance Boundaries", style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                Spacer(modifier = Modifier.height(8.dp))
                BoundaryItem(label = "Price & Timeline Guidance", status = "ALLOW (Approved ranges only)", color = EmeraldSuccess)
                BoundaryItem(label = "Meeting Scheduling", status = "ALLOW", color = EmeraldSuccess)
                BoundaryItem(label = "Custom Discounts / Rush Timelines", status = "REQUIRE_APPROVAL", color = AmberWarning)
                BoundaryItem(label = "Contract Signing / Payments", status = "BLOCK", color = RoseError)
                BoundaryItem(label = "Credentials / Confidential Info", status = "BLOCK", color = RoseError)
            }
        }
    }
}

@Composable
private fun QuickUtteranceChip(
    label: String,
    fullText: String,
    onSelect: (String) -> Unit
) {
    OutlinedButton(
        onClick = { onSelect(fullText) },
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = CyanAccent),
        border = ButtonDefaults.outlinedButtonBorder.copy(brush = androidx.compose.ui.graphics.SolidColor(CyanAccent.copy(alpha = 0.5f)))
    ) {
        Text(text = label, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun TranscriptRow(transcript: TranscriptItem) {
    val isAgent = transcript.speaker == "agent"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isAgent) Arrangement.Start else Arrangement.End
    ) {
        Column(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(if (isAgent) IndigoPrimary.copy(alpha = 0.15f) else CyanAccent.copy(alpha = 0.12f))
                .padding(8.dp)
                .fillMaxWidth(0.88f)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = if (isAgent) "Alba (HQ Coordinator)" else "Prospective Client",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isAgent) IndigoPrimary else CyanAccent
                )
                Text(
                    text = transcript.timestamp,
                    style = MaterialTheme.typography.labelSmall,
                    color = DarkTextSecondary
                )
            }
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = transcript.text,
                style = MaterialTheme.typography.bodySmall,
                color = DarkTextPrimary
            )
        }
    }
}

@Composable
private fun PolicyDecisionRow(decision: PolicyDecisionItem) {
    val (badgeBg, badgeFg) = when (decision.decision) {
        "ALLOW" -> Pair(EmeraldSuccess.copy(alpha = 0.2f), EmeraldSuccess)
        "REQUIRE_APPROVAL" -> Pair(AmberWarning.copy(alpha = 0.2f), AmberWarning)
        else -> Pair(RoseError.copy(alpha = 0.2f), RoseError)
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Tool: ${decision.toolName}",
                style = MaterialTheme.typography.labelMedium,
                color = DarkTextPrimary
            )
            Text(
                text = decision.reason,
                style = MaterialTheme.typography.bodySmall,
                color = DarkTextSecondary
            )
        }
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(4.dp))
                .background(badgeBg)
                .padding(horizontal = 6.dp, vertical = 2.dp)
        ) {
            Text(
                text = decision.decision,
                style = MaterialTheme.typography.labelSmall,
                color = badgeFg
            )
        }
    }
}

@Composable
private fun BoundaryItem(label: String, status: String, color: Color) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium, color = DarkTextSecondary)
        Text(text = status, style = MaterialTheme.typography.labelSmall, color = color)
    }
}
