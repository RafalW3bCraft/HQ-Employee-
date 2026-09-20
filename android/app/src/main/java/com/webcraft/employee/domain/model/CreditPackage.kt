package com.webcraft.employee.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class CreditPackage(
    val id: String,
    val displayName: String,
    val credits: Int,
    val description: String,
    val price: String = ""
)
