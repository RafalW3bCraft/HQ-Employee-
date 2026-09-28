package com.webcraft.employee.presentation.billing

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.webcraft.employee.domain.model.PurchaseState
import com.webcraft.employee.domain.repository.BillingRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class BillingViewModel(
    private val billingRepository: BillingRepository,
    private val companyId: String = "00000000-0000-0000-0000-000000000001"
) : ViewModel() {

    private val _uiState = MutableStateFlow(BillingUiState(isLoading = true))
    val uiState: StateFlow<BillingUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            launch {
                billingRepository.getOfferings().collectLatest { pkgs ->
                    _uiState.update { it.copy(packages = pkgs, isLoading = false) }
                }
            }
            launch {
                billingRepository.getWalletBalance(companyId).collectLatest { wallet ->
                    _uiState.update { it.copy(wallet = wallet) }
                }
            }
        }
    }

    fun purchase(packageId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(purchaseState = PurchaseState.Purchasing(packageId)) }
            val state = billingRepository.purchasePackage(packageId)
            _uiState.update {
                when (state) {
                    is PurchaseState.Success -> it.copy(
                        purchaseState = state,
                        userMessage = "Successfully purchased package! New balance: ${state.newBalance} credits."
                    )
                    is PurchaseState.Error -> it.copy(
                        purchaseState = state,
                        userMessage = "Purchase failed: ${state.message}"
                    )
                    else -> it.copy(purchaseState = state)
                }
            }
        }
    }

    fun restorePurchases() {
        viewModelScope.launch {
            _uiState.update { it.copy(purchaseState = PurchaseState.LoadingOfferings) }
            val state = billingRepository.restorePurchases(companyId, "app_user_001")
            _uiState.update {
                when (state) {
                    is PurchaseState.Restored -> it.copy(
                        purchaseState = state,
                        userMessage = "Purchases restored! Active credits: ${state.newBalance}"
                    )
                    is PurchaseState.Error -> it.copy(
                        purchaseState = state,
                        userMessage = "Restore failed: ${state.message}"
                    )
                    else -> it.copy(purchaseState = state)
                }
            }
        }
    }

    fun clearMessage() {
        _uiState.update { it.copy(userMessage = null) }
    }
}
