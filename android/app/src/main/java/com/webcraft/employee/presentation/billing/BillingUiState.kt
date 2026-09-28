package com.webcraft.employee.presentation.billing

import com.webcraft.employee.domain.model.CreditPackage
import com.webcraft.employee.domain.model.PurchaseState
import com.webcraft.employee.domain.model.WalletBalance

data class BillingUiState(
    val isLoading: Boolean = false,
    val wallet: WalletBalance? = null,
    val packages: List<CreditPackage> = emptyList(),
    val purchaseState: PurchaseState = PurchaseState.Idle,
    val userMessage: String? = null
)
