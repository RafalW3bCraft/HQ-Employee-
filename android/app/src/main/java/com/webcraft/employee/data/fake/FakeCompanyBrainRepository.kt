package com.webcraft.employee.data.fake

import com.webcraft.employee.domain.model.ApprovedService
import com.webcraft.employee.domain.model.AuthorityRule
import com.webcraft.employee.domain.model.CompanyBrain
import com.webcraft.employee.domain.model.CompanyFaq
import com.webcraft.employee.domain.model.CompanyProfile
import com.webcraft.employee.domain.model.EscalationRule
import com.webcraft.employee.domain.model.PolicyVersion
import com.webcraft.employee.domain.repository.CompanyBrainRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

class FakeCompanyBrainRepository : CompanyBrainRepository {

    private val initialPolicy = PolicyVersion(
        id = "pol-001",
        version = "1.0.0",
        status = "ACTIVE",
        systemInstructions = "You are the HQ Business Development & Client Coordinator for HQ. You discover project requirements, qualify leads, discuss approved budget/timeline bounds, and schedule discovery meetings.",
        authorityRules = listOf(
            AuthorityRule("get_company_profile", "information", "ALLOW", "Public company background"),
            AuthorityRule("get_service_details", "information", "ALLOW", "Approved service descriptions"),
            AuthorityRule("get_pricing_guidance", "commercial", "ALLOW", "Approved standard starting ranges"),
            AuthorityRule("get_timeline_guidance", "commercial", "ALLOW", "Approved standard duration windows"),
            AuthorityRule("apply_custom_discount", "commercial", "REQUIRE_APPROVAL", "Pricing deviations must be human approved"),
            AuthorityRule("commit_rush_delivery", "commercial", "REQUIRE_APPROVAL", "Accelerated delivery requires operator clearance"),
            AuthorityRule("sign_contract", "legal", "BLOCK", "Contracts can only be executed by human leadership"),
            AuthorityRule("request_payment", "financial", "BLOCK", "Financial transactions cannot be initiated by voice AI")
        ),
        escalationRules = listOf(
            EscalationRule("Lead requests contract negotiation", "Managing Director", "slack_urgent", 60),
            EscalationRule("Lead requests custom discount", "Commercial Director", "dashboard_approval", 120)
        ),
        createdAt = "2026-09-01T00:00:00Z",
        updatedAt = "2026-09-17T00:00:00Z"
    )

    private val _brain = MutableStateFlow(
        CompanyBrain(
            profile = CompanyProfile(
                id = "comp-001",
                name = "HQ",
                tagline = "Engineering next-generation web, custom software, and voice AI solutions.",
                website = "https://hq.example.com",
                description = "HQ specializes in building high-performance digital products, bespoke software platforms, enterprise AI solutions, and secure systems."
            ),
            services = listOf(
                ApprovedService(
                    id = "srv-001",
                    slug = "website-dev",
                    title = "Website Development",
                    description = "Custom, responsive web applications, modern JAMstack architectures, and headless CMS integrations.",
                    startingPrice = "From $5,000",
                    estimatedDuration = "4 to 6 weeks"
                ),
                ApprovedService(
                    id = "srv-002",
                    slug = "custom-software",
                    title = "Custom Software Development",
                    description = "Full-stack tailored SaaS products, workflow automation backends, and internal company business tools.",
                    startingPrice = "From $15,000",
                    estimatedDuration = "8 to 12 weeks"
                ),
                ApprovedService(
                    id = "srv-003",
                    slug = "ai-ml",
                    title = "AI & ML Engineering",
                    description = "Conversational agents, real-time voice integration (AssemblyAI), RAG systems, and LLM orchestration.",
                    startingPrice = "From $12,000",
                    estimatedDuration = "6 to 10 weeks"
                ),
                ApprovedService(
                    id = "srv-004",
                    slug = "cybersecurity",
                    title = "Cybersecurity Engineering",
                    description = "Penetration testing, application vulnerability audits, security policy engineering, and compliance prep.",
                    startingPrice = "From $7,500",
                    estimatedDuration = "2 to 4 weeks"
                )
            ),
            faqs = listOf(
                CompanyFaq(
                    id = "faq-001",
                    question = "Do you sign NDAs before discovery?",
                    answer = "Yes, we routinely execute non-disclosure agreements prior to in-depth technical scoping.",
                    displayOrder = 1
                ),
                CompanyFaq(
                    id = "faq-002",
                    question = "What is your standard billing cadence?",
                    answer = "Typical projects are billed milestone-based: 40% kick-off, 30% mid-milestone, 30% final sign-off.",
                    displayOrder = 2
                ),
                CompanyFaq(
                    id = "faq-003",
                    question = "How do we begin a project?",
                    answer = "We book an initial 30-minute discovery call to review requirements, followed by a formal technical proposal.",
                    displayOrder = 3
                )
            ),
            policies = listOf(initialPolicy),
            activePolicy = initialPolicy
        )
    )

    override fun getCompanyBrain(): Flow<CompanyBrain> = _brain.asStateFlow()

    override suspend fun updateProfile(name: String, tagline: String, website: String, description: String) {
        val current = _brain.value
        _brain.value = current.copy(
            profile = current.profile.copy(
                name = name,
                tagline = tagline,
                website = website,
                description = description
            )
        )
    }

    override suspend fun upsertService(service: ApprovedService) {
        val current = _brain.value
        val existingIndex = current.services.indexOfFirst { it.slug == service.slug || it.id == service.id }
        val updatedServices = current.services.toMutableList()

        if (existingIndex >= 0) {
            updatedServices[existingIndex] = service
        } else {
            val assignedId = if (service.id.isBlank()) UUID.randomUUID().toString() else service.id
            updatedServices.add(service.copy(id = assignedId))
        }

        _brain.value = current.copy(services = updatedServices)
    }

    override suspend fun upsertFaq(question: String, answer: String) {
        val current = _brain.value
        val newFaq = CompanyFaq(
            id = UUID.randomUUID().toString(),
            question = question,
            answer = answer,
            displayOrder = current.faqs.size + 1
        )
        _brain.value = current.copy(faqs = current.faqs + newFaq)
    }

    override suspend fun createPolicyVersion(
        version: String,
        instructions: String,
        authorityRules: List<AuthorityRule>,
        escalationRules: List<EscalationRule>
    ) {
        val current = _brain.value
        val now = "2026-09-17T08:00:00Z"
        val newPolicy = PolicyVersion(
            id = UUID.randomUUID().toString(),
            version = version,
            status = "DRAFT",
            systemInstructions = instructions,
            authorityRules = authorityRules,
            escalationRules = escalationRules,
            createdAt = now,
            updatedAt = now
        )
        _brain.value = current.copy(policies = current.policies + newPolicy)
    }

    override suspend fun activatePolicyVersion(policyId: String) {
        val current = _brain.value
        val now = "2026-09-17T08:00:00Z"
        var newlyActive: PolicyVersion? = null

        val updatedPolicies = current.policies.map { policy ->
            if (policy.id == policyId) {
                val act = policy.copy(status = "ACTIVE", updatedAt = now)
                newlyActive = act
                act
            } else if (policy.status == "ACTIVE") {
                policy.copy(status = "ARCHIVED", updatedAt = now)
            } else {
                policy
            }
        }

        _brain.value = current.copy(
            policies = updatedPolicies,
            activePolicy = newlyActive ?: current.activePolicy
        )
    }
}
