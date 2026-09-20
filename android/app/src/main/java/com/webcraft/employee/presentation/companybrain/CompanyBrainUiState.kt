package com.webcraft.employee.presentation.companybrain

import com.webcraft.employee.domain.model.ApprovedService
import com.webcraft.employee.domain.model.CompanyBrain

enum class CompanyBrainTab {
    SERVICES,
    PROFILE,
    POLICIES,
    FAQS
}

sealed interface ActiveBrainDialog {
    data object None : ActiveBrainDialog
    data object EditProfile : ActiveBrainDialog
    data class EditService(val service: ApprovedService?) : ActiveBrainDialog
    data object AddFaq : ActiveBrainDialog
    data object CreatePolicy : ActiveBrainDialog
}

sealed interface CompanyBrainUiState {
    data object Loading : CompanyBrainUiState
    data class Success(
        val brain: CompanyBrain,
        val activeTab: CompanyBrainTab = CompanyBrainTab.SERVICES,
        val activeDialog: ActiveBrainDialog = ActiveBrainDialog.None
    ) : CompanyBrainUiState
    data class Error(val message: String) : CompanyBrainUiState
}
