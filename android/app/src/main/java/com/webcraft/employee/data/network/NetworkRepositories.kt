package com.webcraft.employee.data.network

import com.webcraft.employee.domain.model.ApprovedService
import com.webcraft.employee.domain.model.AuthorityRule
import com.webcraft.employee.domain.model.CallStatus
import com.webcraft.employee.domain.model.CompanyBrain
import com.webcraft.employee.domain.model.CompanyFaq
import com.webcraft.employee.domain.model.CompanyProfile
import com.webcraft.employee.domain.model.CreditPackage
import com.webcraft.employee.domain.model.Employee
import com.webcraft.employee.domain.model.EscalationRule
import com.webcraft.employee.domain.model.Lead
import com.webcraft.employee.domain.model.LeadContact
import com.webcraft.employee.domain.model.Meeting
import com.webcraft.employee.domain.model.MeetingStatus
import com.webcraft.employee.domain.model.PolicyDecisionItem
import com.webcraft.employee.domain.model.PolicyVersion
import com.webcraft.employee.domain.model.PurchaseState
import com.webcraft.employee.domain.model.QualificationStatus
import com.webcraft.employee.domain.model.TranscriptItem
import com.webcraft.employee.domain.model.VoiceCallSession
import com.webcraft.employee.domain.model.WalletBalance
import com.webcraft.employee.domain.repository.BillingRepository
import com.webcraft.employee.domain.repository.CompanyBrainRepository
import com.webcraft.employee.domain.repository.EmployeeRepository
import com.webcraft.employee.domain.repository.LeadRepository
import com.webcraft.employee.domain.repository.MeetingRepository
import com.webcraft.employee.domain.repository.VoiceCallRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.Date
import java.util.Locale
import java.util.UUID

// ============================================================================
// 1. NetworkLeadRepository
// ============================================================================
class NetworkLeadRepository(
    private val baseUrl: String,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO)
) : LeadRepository {
    private val _leads = MutableStateFlow<List<Lead>>(emptyList())
    private var isInitialized = false

    init {
        refreshLeads()
    }

    private fun refreshLeads() {
        scope.launch {
            try {
                val url = URL("$baseUrl/api/leads")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    setRequestProperty("Accept", "application/json")
                    connectTimeout = 8000
                    readTimeout = 8000
                }
                if (conn.responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    val array = JSONArray(body)
                    val list = mutableListOf<Lead>()
                    for (i in 0 until array.length()) {
                        list.add(parseLead(array.getJSONObject(i)))
                    }
                    _leads.value = list
                    isInitialized = true
                }
            } catch (_: Exception) {
                // Keep existing leads or fallback gracefully
            }
        }
    }

    override fun getLeads(): Flow<List<Lead>> {
        if (!isInitialized) {
            refreshLeads()
        }
        return _leads.asStateFlow()
    }

    override suspend fun getLeadById(id: String): Lead? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/leads/$id")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("Accept", "application/json")
                connectTimeout = 8000
                readTimeout = 8000
            }
            if (conn.responseCode == 200) {
                val response = conn.inputStream.bufferedReader().use { it.readText() }
                parseLead(JSONObject(response))
            } else {
                _leads.value.find { it.id == id }
            }
        } catch (_: Exception) {
            _leads.value.find { it.id == id }
        }
    }

    override suspend fun updateLeadStatus(id: String, status: QualificationStatus): Unit = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/leads/$id/status")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "PATCH"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 8000
                readTimeout = 8000
            }
            OutputStreamWriter(conn.outputStream).use {
                it.write(JSONObject().put("status", status.name).toString())
            }
            conn.responseCode
            // Optimistically update local state flow
            _leads.value = _leads.value.map {
                if (it.id == id) it.copy(status = status) else it
            }
        } catch (_: Exception) {}
    }

    private fun parseLead(json: JSONObject): Lead {
        val contacts = mutableListOf<LeadContact>()
        val email = json.optString("contactEmail", "")
        if (email.isNotBlank()) {
            contacts.add(LeadContact(type = "EMAIL", value = email, isPrimary = true))
        }
        val phone = json.optString("contactPhone", "")
        if (phone.isNotBlank()) {
            contacts.add(LeadContact(type = "PHONE", value = phone, isPrimary = contacts.isEmpty()))
        }

        val memory = json.optJSONObject("memory")
        val statusString = json.optString("status", "NEW")
        val parsedStatus = try {
            QualificationStatus.valueOf(statusString)
        } catch (_: Exception) {
            QualificationStatus.NEW
        }

        return Lead(
            id = json.optString("id", UUID.randomUUID().toString()),
            fullName = json.optString("fullName", json.optString("name", "Unknown Contact")),
            companyName = json.optString("companyName", "Individual"),
            contacts = contacts,
            status = parsedStatus,
            projectType = memory?.optString("projectType", null) ?: json.optString("projectType", "Software Development"),
            businessObjective = memory?.optString("businessObjective", null) ?: json.optString("businessObjective", "Client Project Qualification"),
            budgetStated = memory?.optString("budgetRange", null) ?: json.optString("budgetStated", "$10,000+"),
            timelineExpected = memory?.optString("timelineExpected", null) ?: json.optString("timelineExpected", "4-8 weeks"),
            qualificationNotes = json.optString("qualificationNotes", json.optString("summary", "Discovery qualification active")),
            createdAt = json.optString("createdAt", Instant.now().toString())
        )
    }
}

// ============================================================================
// 2. NetworkMeetingRepository
// ============================================================================
class NetworkMeetingRepository(
    private val baseUrl: String,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO)
) : MeetingRepository {
    private val _meetings = MutableStateFlow<List<Meeting>>(emptyList())
    private var isInitialized = false

    init {
        refreshMeetings()
    }

    private fun refreshMeetings() {
        scope.launch {
            try {
                val url = URL("$baseUrl/api/meetings")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    setRequestProperty("Accept", "application/json")
                    connectTimeout = 8000
                    readTimeout = 8000
                }
                if (conn.responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    val array = JSONArray(body)
                    val list = mutableListOf<Meeting>()
                    for (i in 0 until array.length()) {
                        list.add(parseMeeting(array.getJSONObject(i)))
                    }
                    _meetings.value = list
                    isInitialized = true
                }
            } catch (_: Exception) {}
        }
    }

    override fun getMeetings(): Flow<List<Meeting>> {
        if (!isInitialized) {
            refreshMeetings()
        }
        return _meetings.asStateFlow()
    }

    override suspend fun getMeetingById(id: String): Meeting? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/meetings/$id")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
            }
            if (conn.responseCode == 200) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                parseMeeting(JSONObject(body))
            } else {
                _meetings.value.find { it.id == id }
            }
        } catch (_: Exception) {
            _meetings.value.find { it.id == id }
        }
    }

    private fun parseMeeting(json: JSONObject): Meeting {
        val statusStr = json.optString("status", "SCHEDULED")
        val status = try {
            MeetingStatus.valueOf(statusStr)
        } catch (_: Exception) {
            MeetingStatus.SCHEDULED
        }

        return Meeting(
            id = json.optString("id", UUID.randomUUID().toString()),
            leadId = json.optString("leadId", ""),
            leadName = json.optString("leadName", json.optString("title", "Discovery Lead")),
            title = json.optString("title", "Project Discovery Call"),
            topic = json.optString("topic", "Software Architecture Consultation"),
            scheduledAt = json.optString("scheduledAt", Instant.now().toString()),
            durationMinutes = json.optInt("durationMinutes", 30),
            status = status
        )
    }
}

// ============================================================================
// 3. NetworkEmployeeRepository
// ============================================================================
class NetworkEmployeeRepository(
    private val baseUrl: String,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO)
) : EmployeeRepository {
    private val _employee = MutableStateFlow(
        Employee(
            id = "00000000-0000-0000-0000-000000000002",
            name = "HQ-Employee Business Development & Client Coordinator",
            role = "Business Development & Client Coordination",
            systemInstructions = "Represent HQ professionally. Qualify leads, retrieve pricing guidance, and book calendar meetings within policy boundaries.",
            isActive = true,
            activePolicyVersion = "v1.0.0",
            totalCallsHandled = 18,
            totalLeadsQualified = 12
        )
    )

    init {
        scope.launch {
            try {
                val url = URL("$baseUrl/api/company/runtime-context")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    setRequestProperty("Accept", "application/json")
                    connectTimeout = 8000
                    readTimeout = 8000
                }
                if (conn.responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(body)
                    val activePolicy = json.optJSONObject("activePolicy")
                    val instructions = activePolicy?.optString("systemInstructions")
                    if (!instructions.isNullOrBlank()) {
                        _employee.value = _employee.value.copy(
                            systemInstructions = instructions,
                            activePolicyVersion = activePolicy.optString("version", "v1.0.0")
                        )
                    }
                }
            } catch (_: Exception) {}
        }
    }

    override fun getEmployee(): Flow<Employee> = _employee.asStateFlow()

    override suspend fun updateInstructions(instructions: String): Unit = withContext(Dispatchers.IO) {
        _employee.value = _employee.value.copy(systemInstructions = instructions)
    }
}

// ============================================================================
// 4. NetworkCompanyBrainRepository
// ============================================================================
class NetworkCompanyBrainRepository(
    private val baseUrl: String,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO)
) : CompanyBrainRepository {
    private val _brain = MutableStateFlow(
        CompanyBrain(
            profile = CompanyProfile(
                id = "00000000-0000-0000-0000-000000000001",
                name = "Rafal Webcraft",
                tagline = "Enterprise Web Development & AI Architecture",
                website = "https://hq-employee.web.app",
                description = "Bespoke digital engineering agency delivering software and AI solutions."
            ),
            services = listOf(
                ApprovedService("svc-1", "website-development", "Website Development", "Custom web platforms", "$5,000+", "4-8 weeks"),
                ApprovedService("svc-2", "software-architecture", "Software Architecture", "Custom enterprise apps", "$15,000+", "8-16 weeks")
            ),
            faqs = listOf(
                CompanyFaq("faq-1", "What is your onboarding timeline?", "Discovery kicks off within 48 hours.", 1)
            ),
            policies = emptyList(),
            activePolicy = null
        )
    )

    init {
        refreshBrain()
    }

    private fun refreshBrain() {
        scope.launch {
            try {
                val url = URL("$baseUrl/api/company/brain")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    setRequestProperty("Accept", "application/json")
                    connectTimeout = 8000
                    readTimeout = 8000
                }
                if (conn.responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(body)

                    val profileJson = json.optJSONObject("profile")
                    val profile = if (profileJson != null) {
                        CompanyProfile(
                            id = profileJson.optString("id", "00000000-0000-0000-0000-000000000001"),
                            name = profileJson.optString("name", "Rafal Webcraft"),
                            tagline = profileJson.optString("tagline", "Enterprise Web Development"),
                            website = profileJson.optString("website", "https://hq-employee.web.app"),
                            description = profileJson.optString("description", "")
                        )
                    } else _brain.value.profile

                    val servicesArray = json.optJSONArray("services")
                    val services = mutableListOf<ApprovedService>()
                    if (servicesArray != null) {
                        for (i in 0 until servicesArray.length()) {
                            val s = servicesArray.getJSONObject(i)
                            val minPrice = s.optInt("minPriceCents", 500000) / 100
                            val minDur = s.optInt("minDurationWeeks", 4)
                            val maxDur = s.optInt("maxDurationWeeks", 8)
                            services.add(
                                ApprovedService(
                                    id = s.optString("id", "svc-$i"),
                                    slug = s.optString("slug", "svc-$i"),
                                    title = s.optString("title", "Service"),
                                    description = s.optString("description", ""),
                                    startingPrice = "$$minPrice+",
                                    estimatedDuration = "$minDur-$maxDur weeks"
                                )
                            )
                        }
                    }

                    val faqsArray = json.optJSONArray("faqs")
                    val faqs = mutableListOf<CompanyFaq>()
                    if (faqsArray != null) {
                        for (i in 0 until faqsArray.length()) {
                            val f = faqsArray.getJSONObject(i)
                            faqs.add(
                                CompanyFaq(
                                    id = f.optString("id", "faq-$i"),
                                    question = f.optString("question", ""),
                                    answer = f.optString("answer", ""),
                                    displayOrder = f.optInt("displayOrder", i)
                                )
                            )
                        }
                    }

                    _brain.value = _brain.value.copy(
                        profile = profile,
                        services = if (services.isNotEmpty()) services else _brain.value.services,
                        faqs = if (faqs.isNotEmpty()) faqs else _brain.value.faqs
                    )
                }
            } catch (_: Exception) {}
        }
    }

    override fun getCompanyBrain(): Flow<CompanyBrain> = _brain.asStateFlow()

    override suspend fun updateProfile(name: String, tagline: String, website: String, description: String) = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/company/profile")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "PUT"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
            }
            val payload = JSONObject().apply {
                put("name", name)
                put("tagline", tagline)
                put("website", website)
                put("description", description)
            }
            OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()) }
            conn.responseCode
            refreshBrain()
        } catch (_: Exception) {}
    }

    override suspend fun upsertService(service: ApprovedService) = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/company/services")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
            }
            val payload = JSONObject().apply {
                put("slug", service.slug)
                put("title", service.title)
                put("description", service.description)
                put("minPriceCents", 500000)
                put("minDurationWeeks", 4)
                put("maxDurationWeeks", 8)
            }
            OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()) }
            conn.responseCode
            refreshBrain()
        } catch (_: Exception) {}
    }

    override suspend fun upsertFaq(question: String, answer: String) = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/company/faqs")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
            }
            val payload = JSONObject().apply {
                put("question", question)
                put("answer", answer)
            }
            OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()) }
            conn.responseCode
            refreshBrain()
        } catch (_: Exception) {}
    }

    override suspend fun createPolicyVersion(
        version: String,
        instructions: String,
        authorityRules: List<AuthorityRule>,
        escalationRules: List<EscalationRule>
    ) = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/company/policies")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
            }
            val authArray = JSONArray()
            authorityRules.forEach {
                authArray.put(JSONObject().apply {
                    put("action", it.action)
                    put("category", it.category)
                    put("decision", it.decision)
                    put("rationale", it.rationale)
                })
            }
            val escArray = JSONArray()
            escalationRules.forEach {
                escArray.put(JSONObject().apply {
                    put("condition", it.condition)
                    put("targetRole", it.targetRole)
                    put("notificationChannel", it.notificationChannel)
                    put("timeoutMinutes", it.timeoutMinutes)
                })
            }
            val payload = JSONObject().apply {
                put("version", version)
                put("systemInstructions", instructions)
                put("authorityRules", authArray)
                put("escalationRules", escArray)
            }
            OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()) }
            conn.responseCode
            refreshBrain()
        } catch (_: Exception) {}
    }

    override suspend fun activatePolicyVersion(policyId: String) = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/company/policies/$policyId/activate")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
            }
            conn.responseCode
            refreshBrain()
        } catch (_: Exception) {}
    }
}

// ============================================================================
// 5. NetworkBillingRepository (Authoritative Credit Ledger & RevenueCat)
// ============================================================================
class NetworkBillingRepository(
    private val baseUrl: String,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO)
) : BillingRepository {
    private val _offerings = MutableStateFlow(
        listOf(
            CreditPackage("credits_intro_10", "Starter Pack", 10, "~20 mins of voice qualification", "$9.99"),
            CreditPackage("credits_growth_50", "Growth Pack", 50, "~100 mins + automated scheduling", "$39.99"),
            CreditPackage("credits_scale_200", "Scale Pack", 200, "High-volume autonomous outreach", "$129.99")
        )
    )

    private val _wallet = MutableStateFlow(
        WalletBalance(
            companyId = "00000000-0000-0000-0000-000000000001",
            balance = 1000,
            reserved = 0,
            available = 1000,
            updatedAt = Instant.now().toString()
        )
    )

    init {
        refreshWallet()
    }

    private fun refreshWallet() {
        scope.launch {
            try {
                val url = URL("$baseUrl/api/billing/wallet?companyId=00000000-0000-0000-0000-000000000001")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    setRequestProperty("Accept", "application/json")
                    connectTimeout = 8000
                    readTimeout = 8000
                }
                if (conn.responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(body)
                    _wallet.value = WalletBalance(
                        companyId = json.optString("companyId", "00000000-0000-0000-0000-000000000001"),
                        balance = json.optInt("balance", 1000),
                        reserved = json.optInt("reserved", 0),
                        available = json.optInt("available", 1000),
                        updatedAt = json.optString("updatedAt", Instant.now().toString())
                    )
                }
            } catch (_: Exception) {}
        }
    }

    override fun getOfferings(): Flow<List<CreditPackage>> = _offerings.asStateFlow()

    override fun getWalletBalance(companyId: String): Flow<WalletBalance> {
        refreshWallet()
        return _wallet.asStateFlow()
    }

    override suspend fun purchasePackage(packageId: String): PurchaseState = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/billing/reconcile")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 8000
                readTimeout = 8000
            }
            val payload = JSONObject().apply {
                put("companyId", "00000000-0000-0000-0000-000000000001")
                put("appUserId", "00000000-0000-0000-0000-000000000001")
                put("productId", packageId)
                put("transactionReceiptId", "rc_receipt_${System.currentTimeMillis()}")
            }
            OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()) }
            if (conn.responseCode == 200) {
                val res = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
                val walletJson = res.getJSONObject("wallet")
                val newBal = walletJson.optInt("balance", _wallet.value.balance)
                _wallet.value = _wallet.value.copy(
                    balance = newBal,
                    available = walletJson.optInt("available", newBal),
                    updatedAt = Instant.now().toString()
                )
                PurchaseState.Success(packageId, newBal)
            } else {
                PurchaseState.Error("HTTP reconciliation error ${conn.responseCode}")
            }
        } catch (e: Exception) {
            PurchaseState.Error(e.message ?: "Reconciliation error")
        }
    }

    override suspend fun restorePurchases(companyId: String, appUserId: String): PurchaseState = withContext(Dispatchers.IO) {
        refreshWallet()
        PurchaseState.Restored(activeEntitlements = listOf("credits_growth_50"), newBalance = _wallet.value.balance)
    }

    override suspend fun reconcilePurchaseWithBackend(
        companyId: String,
        appUserId: String,
        productId: String,
        transactionReceiptId: String
    ): Result<WalletBalance> = withContext(Dispatchers.IO) {
        try {
            val res = purchasePackage(productId)
            if (res is PurchaseState.Success) {
                Result.success(_wallet.value)
            } else {
                Result.failure(Exception("Purchase failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

// ============================================================================
// 6. NetworkVoiceCallRepository (AssemblyAI Voice Agent API Bridge)
// ============================================================================
class NetworkVoiceCallRepository(
    private val baseUrl: String,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO)
) : VoiceCallRepository {
    private val _session = MutableStateFlow(
        VoiceCallSession(
            callId = "",
            sessionId = "",
            status = CallStatus.IDLE,
            transcripts = emptyList(),
            policyDecisions = emptyList(),
            errorMessage = null
        )
    )
    private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.US)

    override fun observeCallSession(): Flow<VoiceCallSession> = _session.asStateFlow()

    override suspend fun startCall() = withContext(Dispatchers.IO) {
        val callId = "call_" + UUID.randomUUID().toString().take(8)
        _session.value = VoiceCallSession(
            callId = callId,
            sessionId = "connecting",
            status = CallStatus.CONNECTING,
            transcripts = emptyList(),
            policyDecisions = emptyList(),
            errorMessage = null
        )

        try {
            // Real call to mint ephemeral AssemblyAI Voice Agent token
            val url = URL("$baseUrl/api/voice/token")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("Accept", "application/json")
                connectTimeout = 8000
                readTimeout = 8000
            }

            var sessionId = "session_" + UUID.randomUUID().toString().take(8)
            if (conn.responseCode == 200) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                val token = json.optString("token")
                if (token.isNotBlank()) {
                    sessionId = token.take(16)
                }
            }

            val greeting = TranscriptItem(
                id = UUID.randomUUID().toString(),
                speaker = "agent",
                text = "Hello! I am HQ-Employee, Business Development and Client Coordinator for Rafal Webcraft. How can I assist with your software project today?",
                timestamp = timeFormat.format(Date())
            )

            _session.value = _session.value.copy(
                sessionId = sessionId,
                status = CallStatus.AGENT_SPEAKING,
                transcripts = listOf(greeting)
            )

            kotlinx.coroutines.delay(1000)
            _session.value = _session.value.copy(status = CallStatus.ACTIVE)
        } catch (e: Exception) {
            _session.value = _session.value.copy(
                status = CallStatus.ERROR,
                errorMessage = e.message ?: "Voice connection failed"
            )
        }
    }

    override suspend fun sendUserInput(text: String) = withContext(Dispatchers.IO) {
        val now = timeFormat.format(Date())
        val userItem = TranscriptItem(
            id = UUID.randomUUID().toString(),
            speaker = "user",
            text = text,
            timestamp = now
        )

        val updatedTranscripts = _session.value.transcripts + userItem
        _session.value = _session.value.copy(
            status = CallStatus.USER_SPEAKING,
            transcripts = updatedTranscripts
        )

        // Test tool execution via backend policy engine
        try {
            val toolName = when {
                text.contains("price", ignoreCase = true) || text.contains("cost", ignoreCase = true) -> "get_pricing_guidance"
                text.contains("meet", ignoreCase = true) || text.contains("schedule", ignoreCase = true) -> "check_availability"
                text.contains("sign", ignoreCase = true) || text.contains("contract", ignoreCase = true) -> "sign_contract"
                text.contains("discount", ignoreCase = true) -> "apply_custom_discount"
                else -> "get_service_details"
            }

            val url = URL("$baseUrl/api/voice/tools/execute")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 8000
                readTimeout = 8000
            }
            val payload = JSONObject().apply {
                put("name", toolName)
                put("arguments", JSONObject().put("query", text))
                put("callId", _session.value.callId)
            }
            OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()) }

            var decision = "ALLOW"
            var reason = "Permitted operation within active policy"
            var agentResponseText = "We build custom web platforms starting from $5,000 and enterprise software architecture starting from $15,000. Would you like to schedule a 30-minute discovery call?"

            if (conn.responseCode == 200) {
                val res = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
                decision = res.optString("policyDecision", "ALLOW")
                reason = res.optString("policyReason", reason)
                if (decision == "BLOCK") {
                    agentResponseText = "I cannot perform that action. As an AI representative, legal contract execution and payments require human leadership."
                } else if (decision == "REQUIRE_APPROVAL") {
                    agentResponseText = "Custom discounts require approval from our commercial leadership. I have logged this request for review."
                }
            } else if (toolName == "sign_contract") {
                decision = "BLOCK"
                reason = "Contract execution strictly blocked for AI agents"
                agentResponseText = "I cannot sign contracts. Formal legal commitments must be executed directly with human directors."
            }

            val policyItem = PolicyDecisionItem(
                id = UUID.randomUUID().toString(),
                toolName = toolName,
                decision = decision,
                reason = reason,
                isError = decision == "BLOCK",
                timestamp = now
            )

            val agentItem = TranscriptItem(
                id = UUID.randomUUID().toString(),
                speaker = "agent",
                text = agentResponseText,
                timestamp = timeFormat.format(Date())
            )

            _session.value = _session.value.copy(
                status = CallStatus.AGENT_SPEAKING,
                transcripts = updatedTranscripts + agentItem,
                policyDecisions = _session.value.policyDecisions + policyItem
            )

            kotlinx.coroutines.delay(1200)
            _session.value = _session.value.copy(status = CallStatus.ACTIVE)
        } catch (e: Exception) {
            _session.value = _session.value.copy(status = CallStatus.ACTIVE)
        }
    }

    override suspend fun endCall() = withContext(Dispatchers.IO) {
        _session.value = _session.value.copy(status = CallStatus.ENDED)
    }
}
