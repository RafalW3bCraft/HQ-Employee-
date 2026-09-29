# HQ External Integration Status & Contract Verification

**Project**: HQ Governed AI Business Employee  
**Evaluation Scope**: AssemblyAI Voice Agent API, AssemblyAI SIP Telephony, RevenueCat In-App Purchases, Google Calendar API, Neon PostgreSQL  
**Audit Standard**: Live Contract Verification & Boundary Isolation  

---

## 1. AssemblyAI Voice Agent API Integration

**Mode**: Realtime Managed Voice Agent (WebSocket Full-Duplex Speech/LLM/TTS)  
**Contract Verification**: Verified against official AssemblyAI documentation.  

### 1.1 Architecture & Token Minting
- **Client Security**: Mobile and browser clients never touch `ASSEMBLYAI_API_KEY`.
- **Ephemeral Token Minting**:
  - Endpoint: `POST /api/voice/session-token`
  - Upstream URL: `https://api.assemblyai.com/v2/realtime/token`
  - Header: `Authorization: <ASSEMBLYAI_API_KEY>` (Raw key, no Bearer prefix as required by AssemblyAI API specifications).
  - Rate Limit: 10 requests per minute per IP.
- **WebSocket Session Lifecycle**:
  - Session endpoint: `GET /api/voice/ws` (proxied and managed by `AssemblyAIVoiceSession`).
  - Strict cleanup on disconnect/hangup to prevent runaway charges up to the 3-hour streaming cap.
  - Event Handling: `SessionBegins`, `Turn`, `SpeechStarted`, `SpeechEnded`, `Interruption`, `ToolCall`, `SessionEnds`.

### 1.2 Tool Calling Catalog
Exactly 13 explicit domain business tools registered with JSON schema parameters:
1. `lookup_service`
2. `propose_pricing`
3. `explain_timeline`
4. `answer_faq`
5. `capture_lead_fact`
6. `dispute_lead_fact`
7. `assess_qualification`
8. `check_calendar`
9. `schedule_meeting`
10. `reschedule_meeting`
11. `cancel_meeting`
12. `generate_proposal`
13. `request_human_approval`

Zero generic or arbitrary execution tools (`exec`, `query`, `eval`). Every tool call is routed through the deterministic `PolicyEngine`.

---

---

## 2. Telephony Providers (CALL-E Primary, Twilio Secondary)

### 2.1 Primary Carrier: CALL-E (`heycall-e.com`)
- **Mode**: Real outbound calling via CALL-E Agentic Phone API.
- **Base Endpoint**: `https://api.heycall-e.com/v1/calls`
- **Webhook Endpoint**: `POST /api/webhooks/calle`
- **Number Validation**: Strict international E.164 (`+1415...`, `+919...`).
- **Emergency Halt**: `POST /api/telephony/emergency-stop`.

### 2.2 Secondary Carrier: Twilio Programmable Voice
- **Mode**: Outbound calls via Twilio REST API + TwiML Media Streams.
- **Webhook Endpoints**: `POST /api/webhooks/twilio/voice`, `POST /api/webhooks/twilio/status`, `POST /api/webhooks/twilio/stream`.

### 2.3 AssemblyAI ↔ Telephony Bidirectional Audio Bridge
- **Endpoint**: `WS /media-stream/:callId`
- **Codec**: G.711 μ-law (`audio/pcmu`) at 8 kHz matching carrier stream format.
- **Audio Lifecycle**: Twilio/Call-E media frames stream into AssemblyAI `input.audio`; AssemblyAI `reply.audio` streams back to caller; user barge-in triggers telephony `clear` event.

---

## 3. Google Workspace & Google Meet Integration

### 3.1 Google Calendar & Google Meet Creation
- **Auth**: OAuth 2.0 with token refresh and backend-only credential storage.
- **Conference Generation**: Unique Google Meet `conferenceData` request ID per meeting space.
- **Endpoints**: `GET /api/calendar/availability`, `POST /api/calendar/events`, `GET /api/calendar/events`, `POST /api/meetings`, `POST /api/webhooks/google`.

### 3.2 Live Google Meet Media Participation (WebRTC)
- **Status**: Separated from meeting creation.
- **Honest Disclosure**: Discloses `LIVE AI MEET MEDIA: Not configured / Not eligible (Developer Preview requirement)` unless enrolled in Google Developer Preview. Never presents fake AI conference attendance.

---

## 4. Bulk Outbound Campaign Engine

- **State Machine**: `DRAFT`, `READY`, `RUNNING`, `PAUSED`, `DRAINING`, `COMPLETED`, `CANCELLED`.
- **Validation**: Strict CSV parser verifying E.164, deduplicating records, filtering DNC opt-outs.
- **Concurrency**: Governed per-number cooldown and concurrent call throttles.
- **Endpoints**: `POST /api/campaigns`, `GET /api/campaigns`, `POST /api/campaigns/:id/start`, `/pause`, `/resume`, `/stop`, `/validate-csv`.

---

## 5. RevenueCat Monetization & Ledger Integration

**Track**: RevenueCat Shipaton 2026 Submission Track  
**Monetization Model**: Consumable Voice & Telephony Credit Packs (`credits_intro_10`, `credits_growth_50`, `credits_scale_200`)  

### 5.1 Immutable Credit Ledger Architecture
Credit balances are not stored as arbitrary mutable integers. All changes are driven by an append-only transaction ledger in PostgreSQL:

```
[ In-App Purchase ] ──> RevenueCat Webhook ──> Idempotency Check
                                                      │
                                                      ▼
[ Credit Ledger ] <── PURCHASE (+Credits) <── Atomic DB Transaction
        │
        ├── RESERVATION (-Available, +Reserved) ──> Call Initiated
        ├── RELEASE     (+Available, -Reserved) ──> Call Failed / Cancelled
        ├── CONSUMPTION (-Balance, -Reserved)   ──> Call Completed
        └── REFUND      (-Balance)              ──> Disputed Purchase
```

---

## 6. One-Click System Health Check & Setup Center

- **Setup Center**: `GET /api/admin/setup` inspecting all 13 core subsystems.
- **Diagnostics**: `GET /api/admin/health` executing 9 real-time connectivity probes returning `PASS`, `WARN`, `FAIL`, or `BLOCKED` with honest error details and remediation steps.

