package com.webcraft.employee.presentation.companybrain

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.webcraft.employee.domain.model.ApprovedService
import com.webcraft.employee.domain.model.CompanyBrain
import com.webcraft.employee.domain.model.CompanyFaq
import com.webcraft.employee.domain.model.CompanyProfile
import com.webcraft.employee.domain.model.PolicyVersion
import com.webcraft.employee.presentation.theme.AmberWarning
import com.webcraft.employee.presentation.theme.CyanAccent
import com.webcraft.employee.presentation.theme.DarkBackground
import com.webcraft.employee.presentation.theme.DarkSurface
import com.webcraft.employee.presentation.theme.DarkSurfaceVariant
import com.webcraft.employee.presentation.theme.DarkTextPrimary
import com.webcraft.employee.presentation.theme.DarkTextSecondary
import com.webcraft.employee.presentation.theme.EmeraldSuccess
import com.webcraft.employee.presentation.theme.IndigoPrimary
import com.webcraft.employee.presentation.theme.RoseError

@Composable
fun CompanyBrainScreen(
    viewModel: CompanyBrainViewModel
) {
    val state by viewModel.uiState.collectAsState()

    when (val currentState = state) {
        is CompanyBrainUiState.Loading -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = IndigoPrimary)
            }
        }
        is CompanyBrainUiState.Error -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(text = currentState.message, color = MaterialTheme.colorScheme.error)
            }
        }
        is CompanyBrainUiState.Success -> {
            CompanyBrainContent(
                brain = currentState.brain,
                activeTab = currentState.activeTab,
                onTabSelect = { viewModel.selectTab(it) },
                onOpenDialog = { viewModel.openDialog(it) },
                onActivatePolicy = { viewModel.activatePolicy(it) }
            )

            // Dialogs
            when (val dialog = currentState.activeDialog) {
                is ActiveBrainDialog.None -> {}
                is ActiveBrainDialog.EditProfile -> {
                    EditProfileDialog(
                        profile = currentState.brain.profile,
                        onDismiss = { viewModel.dismissDialog() },
                        onSave = { name, tagline, website, desc ->
                            viewModel.updateProfile(name, tagline, website, desc)
                        }
                    )
                }
                is ActiveBrainDialog.EditService -> {
                    EditServiceDialog(
                        service = dialog.service,
                        onDismiss = { viewModel.dismissDialog() },
                        onSave = { updatedService ->
                            viewModel.saveService(updatedService)
                        }
                    )
                }
                is ActiveBrainDialog.AddFaq -> {
                    AddFaqDialog(
                        onDismiss = { viewModel.dismissDialog() },
                        onSave = { q, a ->
                            viewModel.saveFaq(q, a)
                        }
                    )
                }
                is ActiveBrainDialog.CreatePolicy -> {
                    CreatePolicyDialog(
                        onDismiss = { viewModel.dismissDialog() },
                        onSave = { version, instructions ->
                            viewModel.createPolicyVersion(version, instructions)
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun CompanyBrainContent(
    brain: CompanyBrain,
    activeTab: CompanyBrainTab,
    onTabSelect: (CompanyBrainTab) -> Unit,
    onOpenDialog: (ActiveBrainDialog) -> Unit,
    onActivatePolicy: (String) -> Unit
) {
    val tabs = listOf(
        CompanyBrainTab.SERVICES to "Services",
        CompanyBrainTab.PROFILE to "Profile",
        CompanyBrainTab.POLICIES to "Policies",
        CompanyBrainTab.FAQS to "FAQs"
    )

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(
            selectedTabIndex = tabs.indexOfFirst { it.first == activeTab },
            containerColor = DarkSurface,
            contentColor = IndigoPrimary,
            indicator = { tabPositions ->
                val tabIndex = tabs.indexOfFirst { it.first == activeTab }
                if (tabIndex >= 0) {
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[tabIndex]),
                        color = IndigoPrimary
                    )
                }
            }
        ) {
            tabs.forEach { (tab, label) ->
                Tab(
                    selected = activeTab == tab,
                    onClick = { onTabSelect(tab) },
                    text = {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.titleMedium,
                            color = if (activeTab == tab) IndigoPrimary else DarkTextSecondary
                        )
                    }
                )
            }
        }

        when (activeTab) {
            CompanyBrainTab.SERVICES -> ServicesTabContent(
                services = brain.services,
                onAddService = { onOpenDialog(ActiveBrainDialog.EditService(null)) },
                onEditService = { service -> onOpenDialog(ActiveBrainDialog.EditService(service)) }
            )
            CompanyBrainTab.PROFILE -> ProfileTabContent(
                profile = brain.profile,
                onEditProfile = { onOpenDialog(ActiveBrainDialog.EditProfile) }
            )
            CompanyBrainTab.POLICIES -> PoliciesTabContent(
                policies = brain.policies,
                onNewPolicy = { onOpenDialog(ActiveBrainDialog.CreatePolicy) },
                onActivate = onActivatePolicy
            )
            CompanyBrainTab.FAQS -> FaqsTabContent(
                faqs = brain.faqs,
                onAddFaq = { onOpenDialog(ActiveBrainDialog.AddFaq) }
            )
        }
    }
}

@Composable
private fun ServicesTabContent(
    services: List<ApprovedService>,
    onAddService: () -> Unit,
    onEditService: (ApprovedService) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Approved Company Services (${services.size})",
                    style = MaterialTheme.typography.titleMedium,
                    color = DarkTextPrimary
                )
                Button(
                    onClick = onAddService,
                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add Service")
                    Spacer(modifier = Modifier.padding(2.dp))
                    Text("Add Service")
                }
            }
        }

        items(services) { service ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onEditService(service) },
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = service.title, style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                        IconButton(onClick = { onEditService(service) }) {
                            Icon(Icons.Default.Edit, contentDescription = "Edit", tint = DarkTextSecondary)
                        }
                    }
                    Text(text = "Slug: ${service.slug}", style = MaterialTheme.typography.labelSmall, color = CyanAccent)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(text = service.description, style = MaterialTheme.typography.bodyMedium, color = DarkTextSecondary)
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "Starting: ${service.startingPrice}", style = MaterialTheme.typography.labelSmall, color = EmeraldSuccess)
                        Text(text = "Timeline: ${service.estimatedDuration}", style = MaterialTheme.typography.labelSmall, color = IndigoPrimary)
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileTabContent(
    profile: CompanyProfile,
    onEditProfile: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = "Company Profile", style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
            Button(
                onClick = onEditProfile,
                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
            ) {
                Icon(Icons.Default.Edit, contentDescription = "Edit Profile")
                Spacer(modifier = Modifier.padding(2.dp))
                Text("Edit Profile")
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = profile.name, style = MaterialTheme.typography.headlineMedium, color = DarkTextPrimary)
                Spacer(modifier = Modifier.height(6.dp))
                Text(text = profile.tagline, style = MaterialTheme.typography.titleMedium, color = CyanAccent)
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = profile.website, style = MaterialTheme.typography.bodyMedium, color = IndigoPrimary)
                Spacer(modifier = Modifier.height(12.dp))
                Text(text = "About Company:", style = MaterialTheme.typography.titleSmall, color = DarkTextSecondary)
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = profile.description, style = MaterialTheme.typography.bodyLarge, color = DarkTextPrimary)
            }
        }
    }
}

@Composable
private fun PoliciesTabContent(
    policies: List<PolicyVersion>,
    onNewPolicy: () -> Unit,
    onActivate: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Versioned Policies (${policies.size})",
                    style = MaterialTheme.typography.titleMedium,
                    color = DarkTextPrimary
                )
                Button(
                    onClick = onNewPolicy,
                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "New Policy")
                    Spacer(modifier = Modifier.padding(2.dp))
                    Text("New Version")
                }
            }
        }

        items(policies) { policy ->
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
                        Text(text = "Version ${policy.version}", style = MaterialTheme.typography.titleLarge, color = DarkTextPrimary)
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(
                                    when (policy.status) {
                                        "ACTIVE" -> EmeraldSuccess.copy(alpha = 0.2f)
                                        "DRAFT" -> AmberWarning.copy(alpha = 0.2f)
                                        else -> DarkSurfaceVariant
                                    }
                                )
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = policy.status,
                                style = MaterialTheme.typography.labelSmall,
                                color = when (policy.status) {
                                    "ACTIVE" -> EmeraldSuccess
                                    "DRAFT" -> AmberWarning
                                    else -> DarkTextSecondary
                                }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = "Policy ID: ${policy.id}", style = MaterialTheme.typography.labelSmall, color = DarkTextSecondary)
                    Text(text = "Created: ${policy.createdAt.take(10)} | Updated: ${policy.updatedAt.take(10)}", style = MaterialTheme.typography.labelSmall, color = DarkTextSecondary)

                    Spacer(modifier = Modifier.height(10.dp))
                    Text(text = "Authority Rules (${policy.authorityRules.size}):", style = MaterialTheme.typography.titleSmall, color = CyanAccent)
                    Spacer(modifier = Modifier.height(4.dp))
                    policy.authorityRules.forEach { rule ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 2.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = rule.action, style = MaterialTheme.typography.bodySmall, color = DarkTextSecondary)
                            Text(
                                text = rule.decision,
                                style = MaterialTheme.typography.labelSmall,
                                color = when (rule.decision) {
                                    "ALLOW" -> EmeraldSuccess
                                    "REQUIRE_APPROVAL" -> AmberWarning
                                    else -> RoseError
                                }
                            )
                        }
                    }

                    if (policy.status != "ACTIVE") {
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedButton(
                            onClick = { onActivate(policy.id) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = IndigoPrimary)
                        ) {
                            Text("Activate Version ${policy.version}")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FaqsTabContent(
    faqs: List<CompanyFaq>,
    onAddFaq: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Approved FAQs (${faqs.size})",
                    style = MaterialTheme.typography.titleMedium,
                    color = DarkTextPrimary
                )
                Button(
                    onClick = onAddFaq,
                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add FAQ")
                    Spacer(modifier = Modifier.padding(2.dp))
                    Text("Add FAQ")
                }
            }
        }

        items(faqs) { faq ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(text = faq.question, style = MaterialTheme.typography.titleMedium, color = DarkTextPrimary)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(text = faq.answer, style = MaterialTheme.typography.bodyMedium, color = DarkTextSecondary)
                }
            }
        }
    }
}

// --- Interactive Dialogs ---

@Composable
private fun EditProfileDialog(
    profile: CompanyProfile,
    onDismiss: () -> Unit,
    onSave: (name: String, tagline: String, website: String, description: String) -> Unit
) {
    var name by remember { mutableStateOf(profile.name) }
    var tagline by remember { mutableStateOf(profile.tagline) }
    var website by remember { mutableStateOf(profile.website) }
    var description by remember { mutableStateOf(profile.description) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Company Profile", color = DarkTextPrimary) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Company Name") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = tagline, onValueChange = { tagline = it }, label = { Text("Tagline") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = website, onValueChange = { website = it }, label = { Text("Website URL") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth(), maxLines = 4)
            }
        },
        confirmButton = {
            Button(onClick = { onSave(name, tagline, website, description) }, colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)) {
                Text("Save Changes")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = DarkTextSecondary) }
        },
        containerColor = DarkSurface
    )
}

@Composable
private fun EditServiceDialog(
    service: ApprovedService?,
    onDismiss: () -> Unit,
    onSave: (ApprovedService) -> Unit
) {
    var title by remember { mutableStateOf(service?.title ?: "") }
    var slug by remember { mutableStateOf(service?.slug ?: "") }
    var description by remember { mutableStateOf(service?.description ?: "") }
    var startingPrice by remember { mutableStateOf(service?.startingPrice ?: "From $10,000") }
    var estimatedDuration by remember { mutableStateOf(service?.estimatedDuration ?: "6 to 8 weeks") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (service == null) "Add Approved Service" else "Edit Approved Service", color = DarkTextPrimary) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Service Title") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = slug, onValueChange = { slug = it }, label = { Text("Identifier Slug (e.g. ai-ml)") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = startingPrice, onValueChange = { startingPrice = it }, label = { Text("Pricing Guidance (e.g. From $10,000)") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = estimatedDuration, onValueChange = { estimatedDuration = it }, label = { Text("Timeline Guidance (e.g. 6 to 8 weeks)") }, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        ApprovedService(
                            id = service?.id ?: "",
                            slug = slug.trim().lowercase(),
                            title = title,
                            description = description,
                            startingPrice = startingPrice,
                            estimatedDuration = estimatedDuration
                        )
                    )
                },
                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
            ) {
                Text("Save Service")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = DarkTextSecondary) }
        },
        containerColor = DarkSurface
    )
}

@Composable
private fun AddFaqDialog(
    onDismiss: () -> Unit,
    onSave: (question: String, answer: String) -> Unit
) {
    var question by remember { mutableStateOf("") }
    var answer by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Approved FAQ", color = DarkTextPrimary) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = question, onValueChange = { question = it }, label = { Text("Prospect Question") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = answer, onValueChange = { answer = it }, label = { Text("Approved Answer") }, modifier = Modifier.fillMaxWidth(), maxLines = 4)
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(question, answer) },
                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
            ) {
                Text("Save FAQ")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = DarkTextSecondary) }
        },
        containerColor = DarkSurface
    )
}

@Composable
private fun CreatePolicyDialog(
    onDismiss: () -> Unit,
    onSave: (version: String, instructions: String) -> Unit
) {
    var version by remember { mutableStateOf("1.1.0") }
    var instructions by remember {
        mutableStateOf("You are the HQ Business Development & Client Coordinator. Guide client inquiries using approved parameters only.")
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Policy Version", color = DarkTextPrimary) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = version, onValueChange = { version = it }, label = { Text("Policy Version (e.g. 1.2.0)") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = instructions, onValueChange = { instructions = it }, label = { Text("System Instructions") }, modifier = Modifier.fillMaxWidth(), maxLines = 5)
                Text(text = "New policy versions are created in DRAFT state with standard governance rules and can be activated after review.", style = MaterialTheme.typography.bodySmall, color = DarkTextSecondary)
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(version, instructions) },
                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
            ) {
                Text("Create Draft")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = DarkTextSecondary) }
        },
        containerColor = DarkSurface
    )
}
