package com.webcraft.employee.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class WalletBalance(
    val companyId: String,
    val balance: Int,
    val reserved: Int,
    val available: Int,
    val updatedAt: String
)
