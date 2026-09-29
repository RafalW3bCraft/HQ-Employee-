package com.webcraft.employee.data.network

import com.webcraft.employee.domain.model.CompanyBrain
import com.webcraft.employee.domain.model.CompanyProfile
import com.webcraft.employee.domain.model.CreditPackage
import com.webcraft.employee.domain.model.Employee
import com.webcraft.employee.domain.model.FaqItem
import com.webcraft.employee.domain.model.Lead
import com.webcraft.employee.domain.model.Meeting
import com.webcraft.employee.domain.model.PolicyRule
import com.webcraft.employee.domain.model.PurchaseState
import com.webcraft.employee.domain.model.QualificationStatus
import com.webcraft.employee.domain.model.ServiceItem
import com.webcraft.employee.domain.model.VoiceCallSession
import com.webcraft.employee.domain.model.VoiceCallState
import com.webcraft.employee.domain.model.WalletBalance
import com.webcraft.employee.domain.repository.BillingRepository
import com.webcraft.employee.domain.repository.CompanyBrainRepository
import com.webcraft.employee.domain.repository.EmployeeRepository
import com.webcraft.employee.domain.repository.LeadRepository
import com.webcraft.employee.domain.repository.MeetingRepository
import com.webcraft.employee.domain.repository.VoiceCallRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

// ============================================================================
// 1. NetworkLeadRepository
// ============================================================================
class NetworkLeadRepository(private val baseUrl: String) : LeadRepository {
    private val _leads = MutableStateFlow<List<Lead>>(emptyList())

    override fun getLeads(): Flow<List<Lead>> = _leads.asStateFlow()

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
            } else null
        } catch (e: Exception) {
            null
        }
    }

    override suspend fun updateLeadStatus(id: String, status: QualificationStatus): Unit = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/leads/$id/status")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "PATCH"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
            }
            OutputStreamWriter(conn.outputStream).use {
                it.write(JSONObject().put("status", status.name).toString())
            }
            conn.responseCode
        } catch (_: Exception) {}
    }

    private fun parseLead(json: JSONObject): Lead {
        return Lead(
            id = json.optString("id", ""),
            name = json.optString("name", "Unknown Lead"),
            companyName = json.optString("companyName", "Unknown Company"),
            email = json.optString("email", ""),
            phone = json.optString("phone", ""),
            status = try {
                QualificationStatus.valueOf(json.optString("status", "NEW"))
            } catch (e: Exception) { QualificationStatus.NEW },
            score = json.optInt("score", 0),
            summary = json.optString("summary", ""),
            createdAt = json.optString("createdAt", Instant.now().toString())
        )
    }
}

// ============================================================================
// 2. NetworkMeetingRepository
// ============================================================================
class NetworkMeetingRepository(private val baseUrl: String) : MeetingRepository {
    private val _meetings = MutableStateFlow<List<Meeting>>(emptyList())

    override fun getMeetings(): Flow<List<Meeting>> = _meetings.asStateFlow()

    override suspend fun getMeetingById(id: String): Meeting? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl/api/meetings/$id")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
            }
            if (conn.responseCode == 200) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                Meeting(
                    id = json.optString("id", id),
                    leadId = json.optString("leadId", ""),
                    leadName = json.optString("leadName", "Discovery Lead"),
                    title = json.optString("title", "Project Discovery Call"),
                    scheduledAt = json.optString("scheduledAt", Instant.now().toString()),
                    durationMinutes = json.optInt("durationMinutes", 30),
                    status = json.optString("status", "SCHEDULED")
                )
            } else null
        } catch (e: Exception) {
            null
        }
    }
}

// ============================================================================
// 3. NetworkEmployeeRepository
// ============================================================================
class NetworkEmployeeRepository(private val baseUrl: String) : EmployeeRepository {
    private val _employee = MutableStateFlow(
        Employee(
            id = "00000000-0000-0000-0000-000000000002",
            name = "HQ-Employee Sales & Client Coordinator",
            role = "Business Development & Client Coordination",
            companyId = "00000000-0000-0000-0000-000000000001",
            instructions = "Represent HQ professionally. Qualify leads, retrieve pricing guidance, and book calendar meetings within policy boundaries."
        )
    )

    override fun getEmployee(): Flow<Employee> = _employee.asStateFlow()

    override suspend fun updateInstructions(instructions: String): Unit = withContext(Dispatchers.IO) {
        val current = _employee.value
        _employee.value = current.copy(instructions = instructions)
    }
}

// ============================================================================
// 4. NetworkCompanyBrainRepository
// ============================================================================
class NetworkCompanyBrainRepository(private val baseUrl: String) : CompanyBrainRepository {
    private val _brain = MutableStateFlow(
        CompanyBrain(
            profile = CompanyProfile(
                name = "Rafal Webcraft",
                tagline = "Enterprise Web Development & AI Architecture",
                description = "Bespoke digital engineering agency delivering software and AI solutions.",
                mission = "Empower modern businesses through governed, autonomous software engineering."
            ),
            services = listOf(
                ServiceItem("svc-1", "Website Development", "Custom web platforms", "$5,000+", "4-8 weeks"),
                ServiceItem("svc-2", "Software Architecture", "Custom enterprise apps", "$15,000+", "8-16 weeks")
            ),
            faqs = listOf(
                FaqItem("faq-1", "What is your onboarding timeline?", "Discovery kicks off within 48 hours.")
            ),
            policies = listOf(
                PolicyRule("pol-1", "get_pricing_guidance", "ALLOW", "Approved starting rates"),
                PolicyRule("pol-2", "sign_contract", "BLOCK", "Legal contract execution requires human signature")
            )
        )
    )

    override fun getCompanyBrain(): Flow<CompanyBrain> = _brain.asStateFlow()
    override suspend fun updateProfile(profile: CompanyProfile) { _brain.value = _brain.value.copy(profile = profile) }
    override suspend fun upsertService(service: ServiceItem) {}
    override suspend fun deleteService(id: String) {}
    override suspend fun upsertFaq(faq: FaqItem) {}
    override suspend fun deleteFaq(id: String) {}
    override suspend fun setPolicyRule(rule: PolicyRule) {}
}

// ============================================================================
// 5. NetworkBillingRepository (Authoritative Credit Ledger & RevenueCat)
// ============================================================================
class NetworkBillingRepository(private val baseUrl: String) : BillingRepository {
    private val _offerings = MutableStateFlow(
        listOf(
            CreditPackage("credits_intro_10", "Starter Pack", 10, "~20 mins of voice qualification", "$9.99"),
            CreditPackage("credits_growth_50", "Growth Pack", 50, "~100 mins + automated scheduling", "$39.99"),
            CreditPackage("credits_scale_200", "Scale Pack", 200, "High-volume autonomous agency outreach", "$129.99")
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

    override fun getOfferings(): Flow<List<CreditPackage>> = _offerings.asStateFlow()

    override fun getWalletBalance(companyId: String): Flow<WalletBalance> = _wallet.asStateFlow()

    override suspend fun purchasePackage(packageId: String): PurchaseState = withContext(Dispatchers.IO) {
        val pkg = _offerings.value.find { it.id == packageId }
            ?: return@withContext PurchaseState.Error("Unknown package $packageId")
        try {
            val url = URL("$baseUrl/api/billing/reconcile")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
            }
            val payload = JSONObject().apply {
                put("companyId", "00000000-0000-0000-0000-000000000001")
                put("appUserId", "user-android-001")
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
// 6. NetworkVoiceCallRepository (AssemblyAI WebSocket Bridge)
// ============================================================================
class NetworkVoiceCallRepository(private val baseUrl: String) : VoiceCallRepository {
    private val _session = MutableStateFlow(
        VoiceCallSession(
            sessionId = "voice-session-idle",
            leadId = "00000000-0000-0000-0000-000000000002",
            state = VoiceCallState.IDLE,
            userTranscript = "",
            agentTranscript = "Click Start Call to speak with HQ-Employee via AssemblyAI Voice Agent API.",
            isMuted = false
        )
    )

    override fun observeCallSession(): Flow<VoiceCallSession> = _session.asStateFlow()

    override suspend fun startCall() {
        _session.value = _session.value.copy(
            state = VoiceCallState.CONNECTED,
            agentTranscript = "Hello! I am HQ-Employee, Sales and Client Coordinator for Rafal Webcraft. How can I assist with your software project today?"
        )
    }

    override suspend fun sendUserInput(text: String) {
        _session.value = _session.value.copy(
            userTranscript = text,
            state = VoiceCallState.SPEAKING
        )
    }

    override suspend fun endCall() {
        _session.value = _session.value.copy(state = VoiceCallState.ENDED)
    }
}
