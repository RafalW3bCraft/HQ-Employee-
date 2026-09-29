# API Functionality Matrix: HQ AI Employee Platform

**Date:** 2026-09-29  
**Assessment Team:** Senior Backend & Security Engineering Team  
**Evaluation Standard:** 100% Endpoint Verification Across All 12 Route Modules  

---

## Complete API Route Verification Matrix

| METHOD | PATH | AUTH | INPUT | VALIDATION | SERVICE | POLICY | DATABASE | EXTERNAL PROVIDER | RESPONSE | ERRORS | FRONTEND CALLER | TEST | LIVE STATUS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `GET` | `/health` | Public | None | None | HealthService | None | Ping | None | `200 { status: 'ok', service: '...' }` | 503 if down | Monitoring | Unit & E2E | `LIVE` |
| `GET` | `/health/live` | Public | None | None | HealthService | None | None | None | `200 { status: 'healthy', uptime: ... }` | None | K8s liveness | Unit & E2E | `LIVE` |
| `GET` | `/health/ready` | Public | None | None | HealthService | None | Database check | None | `200 { ready: true, checks: { ... } }` | 503 if unready | K8s readiness | Unit & E2E | `LIVE` |
| `POST` | `/api/auth/register` | Public | `{ email, password, companyName }` | Zod schema | AuthService | None | `users`, `companies`, `credit_wallets` | None | `201 { token, user, company }` | 400, 409 | AuthScreen | Unit test | `LIVE` |
| `POST` | `/api/auth/login` | Public | `{ email, password }` | Zod schema | AuthService | None | `users` | None | `200 { token, user }` | 400, 401 | AuthScreen | Unit test | `LIVE` |
| `GET` | `/api/leads` | Tenant | `?status=&companyId=` | Query params | LeadsService | Tenant check | `leads` | None | `200 Lead[]` | 401, 500 | `NetworkLeadRepository`, Dashboard | Unit & Integration | `LIVE` |
| `POST` | `/api/leads` | Tenant | `{ fullName, companyName, ... }` | Zod schema | LeadsService | Tenant check | `leads`, `audit_events` | None | `201 Lead` | 400, 401 | LeadsScreen | Unit & Integration | `LIVE` |
| `GET` | `/api/leads/:id` | Tenant | `:id` | UUID / String | LeadsService | Tenant check | `leads` | None | `200 Lead` | 404 | `NetworkLeadRepository` | Unit & Integration | `LIVE` |
| `PATCH` | `/api/leads/:id/status` | Tenant | `{ status }` | Enum check | LeadsService | None | `leads`, `audit_events` | None | `200 Lead` | 400, 404 | `NetworkLeadRepository` | Unit & Live curl | `LIVE` |
| `POST` | `/api/leads/:id/facts` | Tenant | `{ key, value, confidence, ... }` | Zod schema | LeadsService | Fact validation | `leads`, `audit_events` | None | `200 FactResult` | 400, 404 | Voice Tool Call | Unit & Integration | `LIVE` |
| `GET` | `/api/leads/:id/next-question` | Tenant | `:id` | String | LeadsService | None | `leads` | None | `200 AdaptiveQuestion` | 404 | Voice Agent Engine | Unit test | `LIVE` |
| `POST` | `/api/leads/:id/qualify` | Tenant | `:id` | String | LeadsService | Qualification Rules | `leads` | None | `200 QualResult` | 404 | Voice Agent Engine | Unit & Integration | `LIVE` |
| `GET` | `/api/leads/:id/brief` | Tenant | `:id` | String | LeadsService | None | `leads` | None | `200 ProjectBrief` | 404 | Proposals | Unit test | `LIVE` |
| `GET` | `/api/meetings/availability` | Tenant | `?fromDate=&toDate=&timezone=` | Zod schema | MeetingsService | Working Hours | `meetings` | Google Calendar / Sim | `200 AvailabilityResult` | 400 | Web Console Sandbox | Unit & Integration | `LIVE` |
| `POST` | `/api/meetings` | Tenant | `{ leadId, slotTime, topic, ... }` | Zod schema | MeetingsService | Slot validation | `meetings`, `leads`, `audit_events` | Google Calendar / Sim | `201 Confirmation` | 400, 409 Conflict | Web Console & Voice | Unit & Integration | `LIVE` |
| `GET` | `/api/meetings` | Tenant | `?leadId=&status=` | Query params | MeetingsService | None | `meetings` | None | `200 Meeting[]` | 500 | `NetworkMeetingRepository` | Unit & Integration | `LIVE` |
| `GET` | `/api/meetings/:id` | Tenant | `:id` | String | MeetingsService | None | `meetings` | None | `200 Meeting` | 404 | MeetingsScreen | Unit test | `LIVE` |
| `POST` | `/api/meetings/:id/reschedule` | Tenant | `{ newSlotTime, reason }` | Zod schema | MeetingsService | Slot validation | `meetings`, `audit_events` | Google Calendar / Sim | `200 Confirmation` | 400, 409 | MeetingsScreen | Unit test | `LIVE` |
| `POST` | `/api/meetings/:id/cancel` | Tenant | `{ reason }` | Zod schema | MeetingsService | None | `meetings`, `audit_events` | Google Calendar / Sim | `200 Confirmation` | 400 | MeetingsScreen | Unit test | `LIVE` |
| `GET` | `/api/company/brain` | Tenant | None | None | CompanyBrainService | None | `company_profiles`, `services`, `faqs`, `policies` | None | `200 CompanyBrain` | 500 | `NetworkCompanyBrainRepository` | Unit & Integration | `LIVE` |
| `GET` | `/api/company/profile` | Tenant | None | None | CompanyBrainService | None | `company_profiles` | None | `200 CompanyProfile` | 500 | CompanyBrainScreen | Unit test | `LIVE` |
| `PUT` | `/api/company/profile` | Tenant | `{ name, tagline, website, ... }` | Zod schema | CompanyBrainService | None | `company_profiles` | None | `200 CompanyProfile` | 400 | `NetworkCompanyBrainRepository` | Unit test | `LIVE` |
| `GET` | `/api/company/services` | Tenant | None | None | CompanyBrainService | None | `company_services` | None | `200 ServiceItem[]` | 500 | CompanyBrainScreen | Unit test | `LIVE` |
| `POST` | `/api/company/services` | Tenant | `{ slug, title, minPriceCents, ... }` | Zod schema | CompanyBrainService | None | `company_services` | None | `200 ServiceItem` | 400 | `NetworkCompanyBrainRepository` | Unit test | `LIVE` |
| `GET` | `/api/company/faqs` | Tenant | None | None | CompanyBrainService | None | `company_faqs` | None | `200 FaqItem[]` | 500 | CompanyBrainScreen | Unit test | `LIVE` |
| `POST` | `/api/company/faqs` | Tenant | `{ question, answer, displayOrder }` | Zod schema | CompanyBrainService | None | `company_faqs` | None | `200 FaqItem` | 400 | `NetworkCompanyBrainRepository` | Unit test | `LIVE` |
| `GET` | `/api/company/policies` | Tenant | None | None | CompanyBrainService | None | `policies` | None | `200 PolicyVersion[]` | 500 | CompanyBrainScreen | Unit test | `LIVE` |
| `GET` | `/api/company/policies/active`| Tenant | None | None | CompanyBrainService | None | `policies` | None | `200 PolicyVersion` | 404 | EmployeeScreen | Unit test | `LIVE` |
| `POST` | `/api/company/policies` | Tenant | `{ version, systemInstructions, ... }` | Zod schema | CompanyBrainService | Authority & Escalation | `policies` | None | `201 PolicyVersion` | 400 | `NetworkCompanyBrainRepository` | Unit test | `LIVE` |
| `POST` | `/api/company/policies/:id/activate` | Tenant | `:id` | String | CompanyBrainService | None | `policies` | None | `200 PolicyVersion` | 404 | `NetworkCompanyBrainRepository` | Unit test | `LIVE` |
| `GET` | `/api/company/runtime-context`| Tenant | `?service=` | Query | CompanyBrainService | Context Assembly | Multiple | None | `200 RuntimeContext` | 500 | `NetworkEmployeeRepository` | Unit & Integration | `LIVE` |
| `GET` | `/api/billing/offerings` | Public | None | None | BillingService | Catalog | Memory / Config | None | `200 { offerings: [...] }` | None | `NetworkBillingRepository`, Web Console | Unit & Integration | `LIVE` |
| `GET` | `/api/billing/wallet` | Tenant | `?companyId=` | Query | BillingService | Ledger | `credit_wallets` | None | `200 Wallet` | 404 | `NetworkBillingRepository`, Web Console | Unit & Integration | `LIVE` |
| `POST` | `/api/billing/reconcile` | Tenant | `{ productId, transactionReceiptId, ... }` | Zod schema (with fallback) | BillingService | Idempotency | `credit_transactions`, `credit_wallets` | RevenueCat API | `200 { reconciled, wallet, ... }` | 400, 402 | `NetworkBillingRepository`, Web Console | Unit & Live curl | `LIVE` |
| `POST` | `/api/billing/restore` | Tenant | `{ appUserId }` | Zod schema | BillingService | Ledger | `credit_wallets` | RevenueCat API | `200 { restored: true }` | 400 | In-App Purchases | Unit test | `LIVE` |
| `POST` | `/api/billing/welcome-grant` | Tenant | `{ companyId }` | Zod schema | BillingService | Exactly-once | `credit_transactions`, `credit_wallets` | None | `200 { granted: boolean }` | 400 | First User Onboarding | Unit & Integration | `LIVE` |
| `POST` | `/api/billing/webhook` | Webhook | RevenueCat Webhook Payload | Cryptographic signature | BillingService | Signature & Idempotency | `credit_transactions`, `credit_wallets` | RevenueCat Server | `200 { received: true }` | 401, 400 | RevenueCat Servers | Unit & Integration | `LIVE` |
| `GET` | `/api/voice/token` | Tenant | `?expiresInSeconds=&maxDuration=` | Query | AssemblyAIService | Rate limits | None | AssemblyAI Voice Agent API | `200 { token, wsUrl, ... }` | 502 | `NetworkVoiceCallRepository`, Web Console | Unit & Live API | `LIVE` |
| `GET` | `/api/voice/config` | Tenant | None | None | AssemblyAIService | Policy Tools | `policies`, `services` | None | `200 { config, tools }` | 500 | Voice WebSocket Engine | Unit test | `LIVE` |
| `POST` | `/api/voice/tools/execute` | Tenant | `{ name, arguments, callId }` | Zod schema | PolicyEngine & Tools | ALLOW / REQUIRE / BLOCK | `audit_events`, Domain tables | AssemblyAI Tool Loop | `200 { policyDecision, result }` | 400, 403 | Web Console Sandbox & Android | Unit & Integration | `LIVE` |
| `GET` | `/api/voice/ws` | Tenant | WebSocket Upgrade | Binary & JSON Frames | CallsService | Policy & Billing | `calls`, `audit_events` | AssemblyAI Voice Agent WS | Bi-directional streaming | WS Disconnect | Web Console Voice Stream | E2E Scenario | `LIVE` |
| `POST` | `/api/telephony/outbound/initiate` | Tenant | `{ leadId, campaignId }` | Zod schema | TelephonyService | Calling Hours & Opt-out | `calls`, `credit_transactions` | AssemblySIP / Carrier | `200 { callId, status }` | 402, 403, 503 | Outbound Campaign Engine | Unit test | `LIVE` |
| `POST` | `/api/telephony/webhook` | Carrier | Carrier CDR Callback | Webhook validation | TelephonyService | None | `calls`, `credit_transactions` | Carrier SIP Trunk | `200 { handled: true }` | 400 | Carrier Servers | Unit test | `LIVE` |
| `POST` | `/api/proposals` | Tenant | `{ leadId, briefId, customPricingCents }` | Zod schema | ProposalService | Pricing Authority | `proposals`, `audit_events` | None | `201 Proposal` | 400, 403 | Proposals Screen | Unit & Integration | `LIVE` |
| `GET` | `/api/proposals` | Tenant | `?leadId=` | Query | ProposalService | Tenant isolation | `proposals` | None | `200 Proposal[]` | 500 | Proposals Screen | Unit & Integration | `LIVE` |
| `GET` | `/api/proposals/:id` | Tenant | `:id` | String | ProposalService | Tenant isolation | `proposals` | None | `200 Proposal` | 404 | Proposal Detail Screen | Unit test | `LIVE` |
| `PATCH` | `/api/proposals/:id/status` | Tenant | `{ status, approvalId }` | Zod schema | ProposalService | Transition & Approval | `proposals`, `audit_events` | None | `200 Proposal` | 400, 403 | Proposal Detail Screen | Unit & Integration | `LIVE` |
| `GET` | `/api/objectives` | Tenant | `?companyId=` | Query | ObjectiveEngine | None | `objectives` | None | `200 Objective[]` | 500 | Autonomous Scheduler | Unit & Integration | `LIVE` |
| `POST` | `/api/objectives/generate` | Tenant | `{ companyId }` | Zod schema | ObjectiveEngine | Priority ranking | `objectives` | None | `200 Objective[]` | 400 | Autonomous Scheduler | Unit test | `LIVE` |
| `POST` | `/api/objectives/:id/complete`| Tenant | `{ result }` | Zod schema | ObjectiveEngine | None | `objectives`, `audit_events` | None | `200 Objective` | 404 | Worker Loop | Unit test | `LIVE` |
| `GET` | `/api/autonomous/industry-profiles` | Public | None | None | IndustryProfilesModule | None | Memory / Config | None | `200 Profile[]` | None | Onboarding / Company Setup | Unit & Live curl | `LIVE` |
| `GET` | `/api/autonomous/status` | Tenant | `?companyId=` | Query | EmergencyStopService | None | `emergency_stop_flags` | None | `200 { status, emergencyStop }` | 404 | Dashboard & Autonomous Loop | Unit & Live curl | `LIVE` |
| `POST` | `/api/autonomous/emergency-stop` | Tenant | `?companyId=` & `{ reason, requestedBy }` | Query & Body | EmergencyStopService | Instant Kill Switch | `emergency_stop_flags`, `audit_events` | None | `200 { stopped: true }` | 400 | Dashboard Global Stop Button | Unit & Live curl | `LIVE` |
| `POST` | `/api/autonomous/scheduler/jobs` | Tenant | `{ companyId, type, scheduledFor, payload }` | Zod schema | SchedulerService | Execution Window | `autonomous_jobs` | None | `201 Job` | 400 | Autonomous Engine | Unit & Live curl | `LIVE` |
| `GET` | `/api/autonomous/scheduler/executable`| Tenant | `?companyId=` | Query | SchedulerService | Lock acquisition | `autonomous_jobs` | None | `200 Job[]` | 500 | Autonomous Worker Daemon | Unit & Live curl | `LIVE` |
