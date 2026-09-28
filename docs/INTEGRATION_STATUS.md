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

## 2. AssemblyAI SIP & Outbound Telephony Integration

**Mode**: Governed Outbound Sales & Re-Engagement Telephony  
**Endpoint**: `/api/telephony/outbound/initiate`  

### 2.1 10-Step Pre-Call Validation Pipeline
Before carrier dialing, the system enforces a strict sequential gate:
1. **Authentication**: Requesting user must have a valid JWT with `sales` or `admin` role.
2. **Authorization**: Caller must belong to the target company tenant.
3. **E.164 Normalization**: Destination formatted to international standard (e.g., `+15551234567`).
4. **Restricted Numbers**: Blocks emergency (911, 112, 999) and premium rate numbers (900).
5. **Opt-Out (Do-Not-Call) Check**: Queries `telephony_opt_outs` table. If opted out, call is strictly rejected with `403 FORBIDDEN`.
6. **Calling Hours Validation**: Enforces local time calling window (8:00 AM – 8:00 PM).
7. **Credit Balance Check**: Verifies company has sufficient telephony credits.
8. **Credit Reservation**: Atomically reserves call credits before carrier connection.
9. **Concurrency Lock**: Prevents duplicate concurrent calls to the same active lead (`409 CONFLICT`).
10. **Carrier Session Dispatch**: Dispatches to carrier with caller ID configured in `SIP_CALLER_ID`.

### 2.2 Telephony Error Recovery & Webhook Verification
- Carrier rejections (Busy / 486, No Answer / 480) automatically release the reserved credits and update call records with `canRetry` and exponential backoff.
- Webhooks from carrier (`POST /api/telephony/webhooks/assemblyai`) require valid `X-AAI-Signature` HMAC.

---

## 3. RevenueCat Monetization & Ledger Integration

**Track**: RevenueCat Shipaton 2026 Submission Track  
**Monetization Model**: Consumable Voice & Telephony Credit Packs (`credits_intro_10`, `credits_growth_50`, `credits_scale_200`)  

### 3.1 Immutable Credit Ledger Architecture
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

### 3.2 RevenueCat Webhook Processing
- Endpoint: `POST /api/billing/webhook/revenuecat`
- Supported Event Types: `INITIAL_PURCHASE`, `RENEWAL`, `NON_RENEWING_PURCHASE`, `CANCELLATION`, `EXPIRATION`.
- Replay Prevention: Database uniqueness constraint on `credit_transactions.idempotency_key` ensures duplicate webhook posts from network retries are 100% idempotent.

---

## 4. Calendar Provider Integration

**Subsystem**: Meeting Scheduling Engine  
**Interface**: `CalendarProvider` (`checkAvailability`, `createEvent`, `updateEvent`, `deleteEvent`)  

### 4.1 Hybrid Real / Simulated Provider
- **Production Mode**: When `GOOGLE_CALENDAR_CLIENT_ID`, `CLIENT_SECRET`, and `REFRESH_TOKEN` are set, uses Google Calendar API v3 with OAuth2 refresh flow.
- **Sandbox / Test Mode**: When credentials are not set, activates `SimulatedCalendarProvider` which logs bookings and maintains deterministic in-memory and database slot availability.
- **Race Condition Prevention**: Employs optimistic locking and database constraints on `meetings(scheduled_at, company_id)` to reject concurrent double-booking of the same time slot with `409 CONFLICT`.

---

## 5. PostgreSQL Database Integration

**Provider**: Neon Serverless PostgreSQL  
**Connection**: Node `pg.Pool` (Max 10 connections, 30s idle timeout)  
**Security**: SSL Mode `verify-full` with connection-level sanitization.  
**Migrations**: 6 schema migrations tracked in `schema_migrations` table. All tables indexed for high concurrency and tenant isolation.
