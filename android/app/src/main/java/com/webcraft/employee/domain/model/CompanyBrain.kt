package com.webcraft.employee.domain.model

data class ApprovedService(
    val id: String,
    val slug: String,
    val title: String,
    val description: String,
    val startingPrice: String,
    val estimatedDuration: String
)

data class CompanyProfile(
    val id: String,
    val name: String,
    val tagline: String,
    val website: String,
    val description: String
)

data class CompanyFaq(
    val id: String,
    val question: String,
    val answer: String,
    val displayOrder: Int
)

data class AuthorityRule(
    val action: String,
    val category: String,
    val decision: String, // ALLOW, REQUIRE_APPROVAL, BLOCK
    val rationale: String
)

data class EscalationRule(
    val condition: String,
    val targetRole: String,
    val notificationChannel: String,
    val timeoutMinutes: Int
)

data class PolicyVersion(
    val id: String,
    val version: String,
    val status: String, // DRAFT, ACTIVE, ARCHIVED
    val systemInstructions: String,
    val authorityRules: List<AuthorityRule>,
    val escalationRules: List<EscalationRule>,
    val createdAt: String,
    val updatedAt: String
)

data class CompanyBrain(
    val profile: CompanyProfile,
    val services: List<ApprovedService>,
    val faqs: List<CompanyFaq>,
    val policies: List<PolicyVersion>,
    val activePolicy: PolicyVersion?
)
