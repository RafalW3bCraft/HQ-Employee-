package com.webcraft.employee.domain.repository

import com.webcraft.employee.domain.model.CreditPackage
import com.webcraft.employee.domain.model.PurchaseState
import com.webcraft.employee.domain.model.WalletBalance
import kotlinx.coroutines.flow.Flow

interface BillingRepository {
    fun getOfferings(): Flow<List<CreditPackage>>
    fun getWalletBalance(companyId: String): Flow<WalletBalance>
    suspend fun purchasePackage(packageId: String): PurchaseState
    suspend fun restorePurchases(companyId: String, appUserId: String): PurchaseState
    suspend fun reconcilePurchaseWithBackend(
        companyId: String,
        appUserId: String,
        productId: String,
        transactionReceiptId: String
    ): Result<WalletBalance>
}
