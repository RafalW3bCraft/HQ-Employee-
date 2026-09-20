package com.webcraft.employee.domain.model

sealed interface PurchaseState {
    data object Idle : PurchaseState
    data object LoadingOfferings : PurchaseState
    data class Purchasing(val packageId: String) : PurchaseState
    data class Reconciling(val transactionReceiptId: String) : PurchaseState
    data class Success(val packageId: String, val newBalance: Int) : PurchaseState
    data class Restored(val activeEntitlements: List<String>, val newBalance: Int) : PurchaseState
    data class Error(val message: String) : PurchaseState
}
