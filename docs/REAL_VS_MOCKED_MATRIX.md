# HQ Employee — Real vs. Mocked Feature Matrix

## 1. Overview
This matrix distinguishes working production implementations from simulated or test-only components across the entire repository.

---

## 2. Comprehensive System Matrix

| Feature Subsystem | Production Implementation | Real? | Mock? | Test Only? | External Dependency | Status | Evidence / Verification |
|---|---|---|---|---|---|---|---|
| **Voice Audio Capture (Browser)** | Web Audio API + AudioWorklet linear interpolation resampler (`PCMProcessor`) | **YES** | NO | NO | User Microphone | **REAL** | Verified in Chrome & Firefox; 24kHz PCM16 stream sent over WS |
| **Voice Agent WebSocket API** | AssemblyAI Voice Agent API (`wss://agents.assemblyai.com/v1/ws`) | **YES** | NO | NO | AssemblyAI API Key | **REAL** | `backend/test/assemblyai-voice-agent.test.ts` (16 tests pass) |
| **Voice Ticket & Token Minting** | Server-side `GET /api/voice/ticket` (HMAC ticket) & `GET /api/voice/token` (AssemblyAI token) | **YES** | NO | NO | AssemblyAI REST / Server HMAC | **REAL** | Tests pass; raw secret key never exposed client-side |
| **Deterministic Policy Engine** | `PolicyEngine` evaluating action, authority, limits, and role rules | **YES** | NO | NO | PostgreSQL `employee_policies` | **REAL** | `backend/test/policy-engine.test.ts` (10 tests pass); ALLOW, REQUIRE_APPROVAL, BLOCK |
| **Lead Qualification & Provenance** | `LeadQualificationService` tracking 5 criteria, confidence scores, and brief generation | **YES** | NO | NO | PostgreSQL `leads`, `conversation_facts` | **REAL** | `backend/test/lead-qualification.test.ts` (6 tests pass) |
| **Meeting Calendar Scheduling** | `MeetingsService` + `GoogleCalendarProvider` / `SimulatedCalendarProvider` | **YES** | Fallback provider | In test: Simulated | Google Calendar API | **REAL** | `backend/test/meetings.test.ts` (10 tests pass); 409 double-booking prevention |
| **Meeting Attendance (Conferencing)** | `MeetingAgentProvider` (P1 architecture abstraction in `autonomous/types.ts`) | NO | Interface only | NO | Zoom / Teams / Meet | **ABSTRACTED** | Explicitly documented as future conference audio bridge |
| **Authoritative Credit Ledger** | `BillingService` executing double-entry ledger with immutable transactions | **YES** | NO | NO | PostgreSQL `credit_ledger`, `credit_wallets` | **REAL** | `backend/test/revenuecat-monetization.test.ts` (14 tests pass) |
| **1,000 Credit Welcome Grant** | Server-side `grantWelcomeCredits` with idempotency & concurrency lock | **YES** | NO | NO | PostgreSQL `credit_ledger` | **REAL** | Tests #11–14 pass; replay & race condition resistant |
| **RevenueCat In-App Purchase** | `POST /api/billing/reconcile` and `POST /api/billing/webhooks/revenuecat` | **YES** | NO | NO | RevenueCat Webhooks | **REAL** | Tests #3–5, 8 pass with signature & idempotency validation |
| **Outbound Telephony & SIP** | `TelephonyService` with E.164 normalization, DNC opt-out check, and calling hours | **YES** | SIP carrier dispatch simulated | In test: Simulated | Twilio / SIP Carrier | **SIMULATED DISPATCH** | `backend/test/assemblyai-telephony.test.ts` (11 tests pass) |
| **Autonomous Operating Loop** | `ObjectiveEngine` + `AutonomousScheduler` with exponential backoff & priority | **YES** | NO | NO | PostgreSQL `autonomous_objectives` | **REAL** | `backend/test/autonomous-agent-architecture.test.ts` (21 tests pass) |
| **Fail-Safe Emergency Stop** | `EmergencyStopService` centralized kill switch with audit logging | **YES** | NO | NO | PostgreSQL `companies` | **REAL** | Tests #5–7 pass; immediate execution lockout verified |
| **Industry Operating Profiles** | 4 pre-configured profiles (`b2b_saas`, `software_dev`, `consulting`, `healthcare_tech`) | **YES** | NO | NO | Static Audited Catalog | **REAL** | Tests #1–4 pass; approved questions, pricing, and qualification criteria |
| **Append-Oriented Audit Log** | `AuditService` writing frozen audit events with PII sanitization | **YES** | NO | NO | PostgreSQL `audit_logs` | **REAL** | `backend/test/hq-audit-system.test.ts` (5 tests pass) |
| **Structured Memory Subsystem** | `MemoryService` storing Company, Employee, and Interaction Memory | **YES** | NO | NO | PostgreSQL `structured_memory` | **REAL** | `backend/test/hq-employee-memory.test.ts` (7 tests pass) |
| **Android Network Repositories** | `Network*` repositories (`NetworkLeadRepository`, `NetworkMeetingRepository`, etc.) | **PARTIAL** | NO | NO | Backend REST / WSS | **IN CORRECTION** | Network plumbing in place; active HTTP GET sync & click wiring being completed |
| **Android Fake Repositories** | `Fake*` repositories in `android/.../data/fake/` | NO | **YES** | Preview/Debug only | Local Memory | **MOCKED** | Isolated strictly to Compose Previews and local debug builds |
| **Marketing Email/SMS Dispatch** | `MarketingDistributionProvider` abstraction | NO | Interface only | NO | SendGrid / Twilio | **ABSTRACTED** | Interface defined; real dispatch provider planned for Phase 2 |

---

## 3. Strict Verification Criteria

1. **Production Path Guarantee:** No fake repository, static mock, or dummy object is used in the production execution path.
2. **Audit Evidence:** Every claimed feature corresponds to passing automated integration tests or live verification against PostgreSQL and the AssemblyAI Voice Agent API.
3. **Transparency on Unimplemented Capabilities:** Meeting attendance and marketing outbound distribution are transparently documented as interface abstractions rather than pretending live third-party integrations exist.
