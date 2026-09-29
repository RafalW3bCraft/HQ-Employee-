# HQ Employee — UI to Backend Execution Trace Matrix

## 1. Overview
This document traces every major user action from the user interface down through ViewModels, UseCases, Repositories, HTTP/WebSocket network transports, backend Fastify routes, Policy Engine gates, and PostgreSQL persistence.

---

## 2. Execution Traces

### Trace 1: Start Employee (Full-Duplex Voice Connection)
```text
UI SCREEN:          DashboardScreen / EmployeeScreen
BUTTON:             "START EMPLOYEE" / "Start Voice Call"
CALLER:             DashboardScreen.kt -> onStartEmployeeClick / EmployeeScreen.kt -> onStartCall
VIEWMODEL:          EmployeeViewModel.startCall()
USE CASE:           (Direct VoiceCallRepository invocation)
REPOSITORY:         NetworkVoiceCallRepository.startCall()
HTTP / WS:          POST /api/voice/token -> WebSocket wss://agents.assemblyai.com/v1/ws
BACKEND ROUTE:      fastify.post('/api/voice/token') in backend/src/routes/voice.ts
SERVICE:            AssemblyAIVoiceAgentService.mintSessionToken()
POLICY:             Evaluates token request against active company policy -> ALLOW
DATABASE:           Logs AUDIT_EVENT 'VOICE_SESSION_INITIALIZED' in PostgreSQL
EXTERNAL PROVIDER:  AssemblyAI Voice Agent API
RESULT:             Receives ephemeral token, opens secure WebSocket, streams 24kHz PCM audio
UI UPDATE:          State transitions to CONNECTED, visualizer animates, agent audio plays via speaker
```

---

### Trace 2: View & Filter Leads
```text
UI SCREEN:          LeadsScreen
BUTTON / ELEMENT:   Navigation Tab / Status Filter Tab ("All", "Qualifying", "Qualified")
CALLER:             LeadsScreen.kt -> onSelectFilter
VIEWMODEL:          LeadsViewModel.uiState
USE CASE:           GetLeadsUseCase()
REPOSITORY:         NetworkLeadRepository.getLeads()
HTTP / WS:          GET /api/leads?companyId=...
BACKEND ROUTE:      fastify.get('/api/leads') in backend/src/routes/leads.ts
SERVICE:            LeadQualificationService.listLeads()
POLICY:             Tenant isolation filter (companyId)
DATABASE:           SELECT * FROM leads WHERE company_id = $1 ORDER BY created_at DESC
EXTERNAL PROVIDER:  None
RESULT:             Returns array of real leads with qualification scores and status
UI UPDATE:          LeadsUiState.Success(leads) updates LazyColumn with real prospect cards
```

---

### Trace 3: View Lead Details & Facts
```text
UI SCREEN:          LeadDetailScreen
BUTTON / ELEMENT:   Click on Lead Card
CALLER:             LeadsScreen.kt / DashboardScreen.kt -> onLeadClick(leadId)
VIEWMODEL:          LeadsViewModel.loadLeadDetail(leadId)
USE CASE:           GetLeadDetailUseCase(leadId)
REPOSITORY:         NetworkLeadRepository.getLeadById(leadId)
HTTP / WS:          GET /api/leads/:id
BACKEND ROUTE:      fastify.get('/api/leads/:id') in backend/src/routes/leads.ts
SERVICE:            LeadQualificationService.getLead(leadId)
POLICY:             Tenant isolation check (ensures lead belongs to authenticated company)
DATABASE:           SELECT * FROM leads WHERE id = $1 AND company_id = $2; SELECT * FROM conversation_facts...
EXTERNAL PROVIDER:  None
RESULT:             Returns lead profile, contact info, budget, timeline, and extracted facts
UI UPDATE:          LeadDetailUiState.Success(lead) renders contact details and fact badges
```

---

### Trace 4: Schedule Discovery Meeting
```text
UI SCREEN:          LeadDetailScreen / Meeting Scheduling Dialog
BUTTON:             "Schedule Consultation"
CALLER:             LeadDetailScreen.kt -> onScheduleClick(leadId, slotTime)
VIEWMODEL:          MeetingsViewModel.scheduleMeeting(...)
USE CASE:           CreateMeetingUseCase(...)
REPOSITORY:         NetworkMeetingRepository.createMeeting(...)
HTTP / WS:          POST /api/meetings
BACKEND ROUTE:      fastify.post('/api/meetings') in backend/src/routes/meetings.ts
SERVICE:            MeetingsService.createMeeting()
POLICY:             PolicyEngine.evaluateAction('schedule_meeting') -> ALLOW
DATABASE:           INSERT INTO meetings (...); UPDATE leads SET status = 'MEETING_BOOKED'
EXTERNAL PROVIDER:  Google Calendar API (or SimulatedCalendarProvider in test mode)
RESULT:             Returns confirmed meeting object with confirmation code and calendar link
UI UPDATE:          MeetingsUiState updates with new scheduled meeting; Lead status updates
```

---

### Trace 5: In-App Credit Purchase (Monetization)
```text
UI SCREEN:          BillingScreen
BUTTON:             "Purchase [Package]"
CALLER:             BillingScreen.kt -> onPurchaseClick(pkg.id)
VIEWMODEL:          BillingViewModel.purchase(packageId)
USE CASE:           (Direct BillingRepository invocation)
REPOSITORY:         NetworkBillingRepository.purchasePackage(packageId)
HTTP / WS:          POST /api/billing/reconcile
BACKEND ROUTE:      fastify.post('/api/billing/reconcile') in backend/src/routes/billing.ts
SERVICE:            BillingService.reconcilePurchase()
POLICY:             Validates product ID, currency, and receipt token signature
DATABASE:           INSERT INTO credit_ledger (entry_type = 'PURCHASE'); UPDATE credit_wallets
EXTERNAL PROVIDER:  RevenueCat API & Webhooks
RESULT:             Authoritative credit ledger updated atomically; returns updated wallet balance
UI UPDATE:          Wallet chip updates in header; user alert shows: "Successfully purchased package!"
```

---

### Trace 6: 1,000 Free Credits Welcome Grant
```text
UI SCREEN:          BillingScreen / Dashboard Header
BUTTON:             "Claim 1000 Free Credits" (or automatic onboarding trigger)
CALLER:             WebcraftApp onboarding hook / BillingScreen.kt
VIEWMODEL:          BillingViewModel.claimWelcomeGrant()
USE CASE:           (Direct BillingRepository invocation)
REPOSITORY:         NetworkBillingRepository.grantWelcomeCredits()
HTTP / WS:          POST /api/billing/welcome-grant
BACKEND ROUTE:      fastify.post('/api/billing/welcome-grant') in backend/src/routes/billing.ts
SERVICE:            BillingService.grantWelcomeCredits(companyId, userId)
POLICY:             Deterministic idempotency check: welcome_grant_${companyId}
DATABASE:           Atomic insert into credit_ledger ('WELCOME_GRANT', +1000); update credit_wallets
EXTERNAL PROVIDER:  None (Server-Authoritative)
RESULT:             HTTP 200 { success: true, wallet: { balance: 1000, available: 1000 } }
UI UPDATE:          Wallet displays 1000 Credits; button disables permanently for this tenant
```

---

### Trace 7: Edit & Save Company Profile
```text
UI SCREEN:          CompanyBrainScreen
BUTTON:             "Save Profile" inside EditProfileDialog
CALLER:             CompanyBrainScreen.kt -> onSaveProfileClick
VIEWMODEL:          CompanyBrainViewModel.updateProfile(name, tagline, website, description)
USE CASE:           UpdateCompanyProfileUseCase()
REPOSITORY:         NetworkCompanyBrainRepository.updateProfile()
HTTP / WS:          PUT /api/company/profile
BACKEND ROUTE:      fastify.put('/api/company/profile') in backend/src/routes/company.ts
SERVICE:            CompanyBrainService.updateProfile()
POLICY:             Validates input length, URL format, and tenant ownership
DATABASE:           UPDATE companies SET name = $1, tagline = $2, website = $3, description = $4...
EXTERNAL PROVIDER:  None
RESULT:             Returns updated CompanyProfile; Company Brain reloaded
UI UPDATE:          Dialog dismisses; Company Brain screen header displays new name and tagline
```

---

### Trace 8: Add Approved Service with Pricing Guidance
```text
UI SCREEN:          CompanyBrainScreen (Services Tab)
BUTTON:             "Save Service" inside AddServiceDialog
CALLER:             CompanyBrainScreen.kt -> onSaveServiceClick
VIEWMODEL:          CompanyBrainViewModel.saveService(service)
USE CASE:           UpsertServiceUseCase(service)
REPOSITORY:         NetworkCompanyBrainRepository.upsertService(service)
HTTP / WS:          POST /api/company/services
BACKEND ROUTE:      fastify.post('/api/company/services') in backend/src/routes/company.ts
SERVICE:            CompanyBrainService.upsertService()
POLICY:             Validates positive pricing bounds and realistic timeline (weeks > 0)
DATABASE:           INSERT INTO services (...); INSERT INTO service_pricing_tiers (...);
EXTERNAL PROVIDER:  None
RESULT:             Returns persisted service with ID; automatically usable by AssemblyAI voice agent
UI UPDATE:          Dialog dismisses; new service card appears in Services list
```

---

### Trace 9: Fail-Safe Emergency Stop Toggle
```text
UI SCREEN:          SettingsScreen / Dashboard Controls
BUTTON:             "EMERGENCY STOP" / "Resume Employee"
CALLER:             SettingsScreen.kt -> onToggleEmergencyStop
VIEWMODEL:          SettingsViewModel.setEmergencyStop(isStopped, reason)
USE CASE:           (Direct AutonomousRepository invocation)
REPOSITORY:         NetworkAutonomousRepository.setEmergencyStop(...)
HTTP / WS:          POST /api/autonomous/emergency-stop
BACKEND ROUTE:      fastify.post('/api/autonomous/emergency-stop') in backend/src/routes/autonomous.ts
SERVICE:            EmergencyStopService.setEmergencyStop()
POLICY:             Locks all outbound telephony, worker loops, and active tool calls
DATABASE:           UPDATE companies SET emergency_stop_enabled = $1; INSERT INTO audit_logs...
EXTERNAL PROVIDER:  None
RESULT:             Returns updated EmergencyStopState
UI UPDATE:          Dashboard status banner turns glowing amber/red: "EMERGENCY_STOPPED"
```
