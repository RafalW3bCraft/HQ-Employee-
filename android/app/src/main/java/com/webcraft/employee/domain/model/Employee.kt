package com.webcraft.employee.domain.model

data class Employee(
    val id: String,
    val name: String,
    val role: String,
    val systemInstructions: String,
    val isActive: Boolean,
    val activePolicyVersion: String,
    val totalCallsHandled: Int,
    val totalLeadsQualified: Int
)
