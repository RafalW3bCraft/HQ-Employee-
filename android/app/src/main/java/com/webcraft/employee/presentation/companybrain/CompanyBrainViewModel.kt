package com.webcraft.employee.presentation.companybrain

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.webcraft.employee.domain.model.ApprovedService
import com.webcraft.employee.domain.model.AuthorityRule
import com.webcraft.employee.domain.model.EscalationRule
import com.webcraft.employee.domain.usecase.GetCompanyBrainUseCase
import com.webcraft.employee.domain.usecase.ManagePolicyUseCase
import com.webcraft.employee.domain.usecase.UpdateCompanyProfileUseCase
import com.webcraft.employee.domain.usecase.UpsertFaqUseCase
import com.webcraft.employee.domain.usecase.UpsertServiceUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class CompanyBrainViewModel(
    getCompanyBrainUseCase: GetCompanyBrainUseCase,
    private val updateCompanyProfileUseCase: UpdateCompanyProfileUseCase,
    private val upsertServiceUseCase: UpsertServiceUseCase,
    private val upsertFaqUseCase: UpsertFaqUseCase,
    private val managePolicyUseCase: ManagePolicyUseCase
) : ViewModel() {

    private val _activeTab = MutableStateFlow(CompanyBrainTab.SERVICES)
    private val _activeDialog = MutableStateFlow<ActiveBrainDialog>(ActiveBrainDialog.None)

    val uiState: StateFlow<CompanyBrainUiState> = combine(
        getCompanyBrainUseCase(),
        _activeTab,
        _activeDialog
    ) { brain, tab, dialog ->
        CompanyBrainUiState.Success(
            brain = brain,
            activeTab = tab,
            activeDialog = dialog
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = CompanyBrainUiState.Loading
    )

    fun selectTab(tab: CompanyBrainTab) {
        _activeTab.value = tab
    }

    fun openDialog(dialog: ActiveBrainDialog) {
        _activeDialog.value = dialog
    }

    fun dismissDialog() {
        _activeDialog.value = ActiveBrainDialog.None
    }

    fun updateProfile(name: String, tagline: String, website: String, description: String) {
        viewModelScope.launch {
            updateCompanyProfileUseCase(name, tagline, website, description)
            dismissDialog()
        }
    }

    fun saveService(service: ApprovedService) {
        viewModelScope.launch {
            upsertServiceUseCase(service)
            dismissDialog()
        }
    }

    fun saveFaq(question: String, answer: String) {
        viewModelScope.launch {
            upsertFaqUseCase(question, answer)
            dismissDialog()
        }
    }

    fun createPolicyVersion(version: String, instructions: String) {
        viewModelScope.launch {
            val defaultAuthorityRules = listOf(
                AuthorityRule("get_company_profile", "information", "ALLOW", "Public company knowledge"),
                AuthorityRule("get_service_details", "information", "ALLOW", "Approved services"),
                AuthorityRule("get_pricing_guidance", "commercial", "ALLOW", "Approved ranges only"),
                AuthorityRule("get_timeline_guidance", "commercial", "ALLOW", "Approved durations"),
                AuthorityRule("apply_custom_discount", "commercial", "REQUIRE_APPROVAL", "Discounts require approval"),
                AuthorityRule("commit_rush_delivery", "commercial", "REQUIRE_APPROVAL", "Rush timelines require approval"),
                AuthorityRule("sign_contract", "legal", "BLOCK", "Contracts blocked for AI"),
                AuthorityRule("request_payment", "financial", "BLOCK", "Payments blocked for AI")
            )
            val defaultEscalationRules = listOf(
                EscalationRule("Lead requests contract negotiation", "Legal Director", "slack_urgent", 60),
                EscalationRule("Lead requests discount exceeding 10%", "Commercial Director", "dashboard_approval", 120)
            )

            managePolicyUseCase.createVersion(version, instructions, defaultAuthorityRules, defaultEscalationRules)
            dismissDialog()
        }
    }

    fun activatePolicy(policyId: String) {
        viewModelScope.launch {
            managePolicyUseCase.activateVersion(policyId)
        }
    }
}
