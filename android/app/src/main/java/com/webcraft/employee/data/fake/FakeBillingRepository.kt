package com.webcraft.employee.data.fake

import com.webcraft.employee.domain.model.CreditPackage
import com.webcraft.employee.domain.model.PurchaseState
import com.webcraft.employee.domain.model.WalletBalance
import com.webcraft.employee.domain.repository.BillingRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.Instant

class FakeBillingRepository : BillingRepository {

    private val _offerings = MutableStateFlow(
        listOf(
            CreditPackage(
                id = "credits_starter_10",
                displayName = "Starter Pack",
                credits = 10,
                description = "Perfect for qualifying initial prospective clients and small batches",
                price = "$19.99"
            ),
            CreditPackage(
                id = "credits_growth_50",
                displayName = "Growth Pack",
                credits = 50,
                description = "Recommended for growing agencies with active outbound campaigns",
                price = "$79.99"
            ),
            CreditPackage(
                id = "credits_scale_200",
                displayName = "Scale Pack",
                credits = 200,
                description = "Maximum throughput for full-time autonomous AI sales operations",
                price = "$249.99"
            )
        )
    )

    private val _wallet = MutableStateFlow(
        WalletBalance(
            companyId = "00000000-0000-0000-0000-000000000001",
            balance = 100,
            reserved = 10,
            available = 90,
            updatedAt = Instant.now().toString()
        )
    )

    override fun getOfferings(): Flow<List<CreditPackage>> = _offerings.asStateFlow()

    override fun getWalletBalance(companyId: String): Flow<WalletBalance> = _wallet.asStateFlow()

    override suspend fun purchasePackage(packageId: String): PurchaseState {
        val pkg = _offerings.value.find { it.id == packageId }
            ?: return PurchaseState.Error("Package '$packageId' not found in offerings")
        val current = _wallet.value
        val newBalance = current.balance + pkg.credits
        val newAvailable = current.available + pkg.credits
        _wallet.value = current.copy(
            balance = newBalance,
            available = newAvailable,
            updatedAt = Instant.now().toString()
        )
        return PurchaseState.Success(packageId, newBalance)
    }

    override suspend fun restorePurchases(companyId: String, appUserId: String): PurchaseState {
        return PurchaseState.Restored(
            activeEntitlements = listOf("credits_growth_50"),
            newBalance = _wallet.value.balance
        )
    }

    override suspend fun reconcilePurchaseWithBackend(
        companyId: String,
        appUserId: String,
        productId: String,
        transactionReceiptId: String
    ): Result<WalletBalance> {
        val pkg = _offerings.value.find { it.id == productId }
        val creditsToAdd = pkg?.credits ?: 50
        val current = _wallet.value
        val updated = current.copy(
            balance = current.balance + creditsToAdd,
            available = current.available + creditsToAdd,
            updatedAt = Instant.now().toString()
        )
        _wallet.value = updated
        return Result.success(updated)
    }
}
