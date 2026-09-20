package com.webcraft.employee.data.fake

import com.webcraft.employee.domain.model.Lead
import com.webcraft.employee.domain.model.LeadContact
import com.webcraft.employee.domain.model.QualificationStatus
import com.webcraft.employee.domain.repository.LeadRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map

class FakeLeadRepository : LeadRepository {
    private val _leads = MutableStateFlow(
        listOf(
            Lead(
                id = "lead-001",
                fullName = "Sarah Jenkins",
                companyName = "Apex Logistics",
                contacts = listOf(
                    LeadContact(type = "EMAIL", value = "sarah.j@apexlogistics.com", isPrimary = true),
                    LeadContact(type = "PHONE", value = "+1 (555) 342-9810", isPrimary = false)
                ),
                status = QualificationStatus.QUALIFIED,
                projectType = "Custom Software",
                businessObjective = "Automate warehouse dispatch and driver communication portal.",
                budgetStated = "$15,000 - $25,000",
                timelineExpected = "Q4 launch (8 weeks)",
                qualificationNotes = "Decision maker confirmed. High urgency due to seasonal peak. Approved custom software MVP range.",
                createdAt = "2026-09-15T14:32:00Z"
            ),
            Lead(
                id = "lead-002",
                fullName = "Marcus Vance",
                companyName = "Vance Health Tech",
                contacts = listOf(
                    LeadContact(type = "PHONE", value = "+1 (555) 890-4122", isPrimary = true)
                ),
                status = QualificationStatus.MEETING_BOOKED,
                projectType = "AI / ML Development",
                businessObjective = "Build speech-to-text clinical notes summarizer with compliance guardrails.",
                budgetStated = "$30,000+",
                timelineExpected = "3 months",
                qualificationNotes = "Excellent fit for HQ AI engineering. Discovery meeting scheduled for tomorrow 10:00 AM.",
                createdAt = "2026-09-16T09:15:00Z"
            ),
            Lead(
                id = "lead-003",
                fullName = "Elena Rostova",
                companyName = "Studio Lumen",
                contacts = listOf(
                    LeadContact(type = "EMAIL", value = "elena@lumen.design", isPrimary = true)
                ),
                status = QualificationStatus.QUALIFYING,
                projectType = "Website Development",
                businessObjective = "Interactive 3D portfolio and client portal redesign.",
                budgetStated = "$8,000 - $12,000",
                timelineExpected = "6 weeks",
                qualificationNotes = "In discussion regarding technical requirements and design handoff format.",
                createdAt = "2026-09-17T05:20:00Z"
            ),
            Lead(
                id = "lead-004",
                fullName = "David Chen",
                companyName = "Chen Financial",
                contacts = listOf(
                    LeadContact(type = "EMAIL", value = "dchen@chenfin.com", isPrimary = true)
                ),
                status = QualificationStatus.NEW,
                projectType = "Cybersecurity Engineering",
                businessObjective = "External security penetration test and infrastructure hardening.",
                budgetStated = "$10,000",
                timelineExpected = "Immediate",
                qualificationNotes = "Inquiry received via web form. Ready for first qualification voice call.",
                createdAt = "2026-09-17T06:40:00Z"
            )
        )
    )

    override fun getLeads(): Flow<List<Lead>> = _leads.asStateFlow()

    override suspend fun getLeadById(id: String): Lead? {
        return _leads.value.find { it.id == id }
    }

    override suspend fun updateLeadStatus(id: String, status: QualificationStatus) {
        _leads.value = _leads.value.map {
            if (it.id == id) it.copy(status = status) else it
        }
    }
}
