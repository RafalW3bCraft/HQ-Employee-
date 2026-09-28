# AssemblyAI Voice Agent — HQ-Employee Demo Test Guide

**Project:** HQ-Employee AI Business Employee  
**Submission:** AssemblyAI Voice Agent Hackathon  
**Evaluator:** Hackathon Judge / External Reviewer  

---

## What This Demo Proves

| Capability | Evidence |
|---|---|
| Real-time duplex speech via AssemblyAI Voice Agent API | Browser mic → backend proxy → `wss://agents.assemblyai.com/v1/ws` → spoken response in browser |
| Deterministic Policy Engine | Every tool call is evaluated ALLOW / REQUIRE_APPROVAL / BLOCK before execution |
| 13 scoped business tools — no generic execute-anything tool | `/api/voice/config` returns exact tool list, tests enforce absence of `execute_sql`, `run_arbitrary_code` |
| API key never exposed to browser | Backend proxy pattern; key lives in `ASSEMBLYAI_API_KEY` env var only |
| Lead qualification memory | `create_lead`, `record_requirement`, `record_budget`, `record_timeline` persist structured facts |
| Calendar + meeting scheduling | `check_calendar` + `schedule_meeting` produce real `meetingId` + `confirmationCode` |
| Authoritative credit ledger | `CreditWallet` with `balance`/`reserved`/`available` fields; RevenueCat reconcile endpoint |
| Tenant isolation | Cross-tenant lead modification is rejected (test 12) |

---

## Prerequisites

```bash
# Backend running with real AssemblyAI key:
cd backend
cp .env.example .env
# Edit .env and set:
#   ASSEMBLYAI_API_KEY=<your_real_key>
#   NODE_ENV=development
npm install
npm run build
npm start
# Server starts on http://localhost:3000
```

Browser requirements:
- **Chrome 94+**, Edge 94+, or Brave (recommended — honours 24kHz AudioContext)
- Firefox 76+, Safari 15.4+ work with resampling (echo cancellation may be reduced)
- Must be served over **HTTPS** or **localhost** for `getUserMedia` permission

---

## Step-by-Step Manual Test

### Phase 1 — Backend Smoke Tests (no mic required)

**1.1 — Health check**
```
GET http://localhost:3000/api/health
```
Expected:
```json
{ "status": "healthy", "service": "hq-employee-api" }
```

**1.2 — Session configuration + 13 tools**
```
GET http://localhost:3000/api/voice/config
```
Expected:
- `toolCount: 13`
- `tools` contains `get_company_profile`, `create_lead`, `schedule_meeting`, `end_call`, etc.
- No `execute_sql`, no `run_arbitrary_code`, no `call_webhook`
- `config.system_prompt` mentions `HQ-Employee`
- `config.output.voice = "alba"`

**1.3 — Token endpoint (key must NOT appear in response)**
```
GET http://localhost:3000/api/voice/token?expiresInSeconds=300
```
Expected:
```json
{
  "token": "<opaque_token>",
  "expiresInSeconds": 300,
  "wsUrl": "wss://agents.assemblyai.com/v1/ws"
}
```
Verify: `token` value must not equal `$ASSEMBLYAI_API_KEY`

**1.4 — Wallet balance**
```
GET http://localhost:3000/api/billing/wallet
```
Expected:
```json
{ "balance": <number>, "reserved": <number>, "available": <number>, ... }
```
Fields `available` and `reserved` (not `availableCredits`) are used by the browser UI.

---

### Phase 2 — Sandbox Policy Tests (no mic, instant)

Open `http://localhost:3000/voice-tester` in Chrome.

**2.1 — ALLOW: Approved service query**
- Click **Execute lookup_service**  
- Tool Feed shows: `get_service_details` → **ALLOW** (green badge)

**2.2 — REQUIRE_APPROVAL: 15% discount escalation**
- Click **Request Discount Approval**  
- Tool Feed shows: `request_human_approval` → **REQUIRE_APPROVAL** (amber badge)  
- This proves the AI cannot unilaterally grant discounts exceeding policy limits

**2.3 — BLOCK: Contract signing attempt**
- Click **Attempt sign_contract**  
- Tool Feed shows: `sign_contract` → **BLOCK** (red badge)  
- This proves the AI is hard-blocked from signing legal documents

**2.4 — ALLOW: Calendar and meeting scheduling**
- Click **Schedule Slot**  
- Tool Feed shows: `schedule_meeting` → **ALLOW** (green badge)  
- Result contains `meetingId` and `confirmationCode`

**2.5 — RevenueCat credit reconciliation**
- Click **Reconcile Growth Pack (50 Cr)**  
- Wallet balance in header and banner updates to reflect +50 credits  
- Tool Feed shows: `revenuecat_reconcile` → **ALLOW**

---

### Phase 3 — Full Live Voice Conversation

**Prerequisites:** `ASSEMBLYAI_API_KEY` is a real production key.

Open `http://localhost:3000/voice-tester` in Chrome.

**Step 1:** Click **Start Conversation**  
- Browser prompts for microphone permission — grant it  
- Status dot turns **green** and shows "Connected — Waiting for session..."  
- Approximately 1–2 seconds later: "Live — Speaking..."  
- Session ID appears in top right (truncated)

**Step 2:** Wait for HQ-Employee greeting  
- Agent speaks (audio plays through speakers)  
- Visualizer waves increase amplitude  
- "HQ-Employee speaking..." appears in turn status  
- Agent transcript appears in Conversation Feed  
- Typical greeting: *"Hello, I'm HQ-Employee, your AI business assistant for Rafal Webcraft. How can I help you today?"*

**Step 3:** Speak your introduction  
- Say: *"Hi, my name is Alex Chen, I'm the CTO of TechVentures. We're looking to build a custom web application."*  
- Visualizer pulses while you speak (status: "You are speaking...")  
- Your transcript appears in Conversation Feed (right-aligned, blue)  
- Agent processes and responds

**Step 4:** Discovery — AI qualifies the lead  
- AI will ask questions about requirements, budget, timeline  
- Tools `create_lead` and `update_lead` fire automatically → Tool Feed shows **ALLOW** decisions  
- Example: Say *"Our budget is around $30,000 to $50,000 and we need it within 6 months"*  
- Tool Feed shows `record_budget` → **ALLOW**, `record_timeline` → **ALLOW**

**Step 5:** Request service pricing  
- Say: *"Can you tell me about your web development pricing?"*  
- Tool Feed shows `get_service_details` → **ALLOW**, `get_pricing_guidance` → **ALLOW**  
- Agent cites approved pricing ranges from Company Brain

**Step 6:** Request a discount (triggers REQUIRE_APPROVAL)  
- Say: *"Can you give me a 15% discount?"*  
- Tool Feed shows `request_human_approval` with `action_type: discount_request` → **REQUIRE_APPROVAL** (amber)  
- Agent responds: *"I need to escalate this to my director for approval — I can't commit to that autonomously."*

**Step 7:** Try to sign a contract (triggers BLOCK)  
- Say: *"Great, let's sign the contract right now."*  
- Tool Feed shows `sign_contract` → **BLOCK** (red)  
- Agent responds that it cannot sign contracts

**Step 8:** Schedule a discovery meeting  
- Say: *"Can we schedule a discovery call for next week?"*  
- Tool Feed shows `check_calendar` → **ALLOW**, then `schedule_meeting` → **ALLOW**  
- Agent confirms meeting time with confirmation code

**Step 9:** Barge-in / interrupt  
- While agent is speaking, click **Barge-in / Interrupt Agent**  
- Agent stops speaking mid-sentence  
- Stale audio is flushed from queue (no continued playback)  
- You can speak immediately

**Step 10:** End call cleanly  
- Click **End Call**  
- WS sends `voice.end`, backend sends `session.end` to AssemblyAI  
- `voice.session_ended` received, session duration shown  
- Wallet reconciles final credit consumption

---

### Phase 4 — Cross-Tenant Security Test

```bash
# Create a lead for tenant A
curl -X POST http://localhost:3000/api/voice/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "create_lead",
    "arguments": { "full_name": "Alice", "email": "a@alpha.test" },
    "callId": "sec-test-1",
    "companyId": "company_tenant_alpha"
  }'
# Note the lead_id from response

# Attempt to modify from a different tenant (must fail)
curl -X POST http://localhost:3000/api/voice/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "record_requirement",
    "arguments": { "lead_id": "<lead_id_from_above>", "requirement": "inject" },
    "callId": "sec-test-2",
    "companyId": "company_tenant_beta"
  }'
```
Expected: `{ "isError": true, "result": "...Cross-tenant lead modification denied..." }`

---

## Automated Test Suite

```bash
cd backend
npm test
```

Expected: **16 passing** (was 12; 4 new tests added)  
Key new tests:
- Test 13: `reply.done` with `status=interrupted` → correct browser flush signal
- Test 14: `reply.audio` reads `data` field (not `audio` field)
- Test 15: Wallet endpoint exposes `available`/`reserved` fields (matching browser code)
- Test 16: `voice-tester.html` never embeds `ASSEMBLYAI_API_KEY` or any raw key value

---

## Architecture Quick Reference

```
Browser (voice-tester.html)
  │
  │  WebSocket /api/voice/ws
  ▼
Backend (Fastify) — ASSEMBLYAI_API_KEY lives here only
  │
  │  WebSocket wss://agents.assemblyai.com/v1/ws
  │  Authorization: Bearer <ASSEMBLYAI_API_KEY>
  ▼
AssemblyAI Voice Agent
  │
  │  tool.call events → backend Policy Engine → executeTool()
  │  tool.result sent after reply.done per protocol spec
  ▼
Business Tools (13 scoped, no generic execute)
  → Company Brain, Lead Qualification, Calendar, Meetings,
    Proposals, Memory, Audit, Billing, Policy Engine
```

Audio path:
```
Browser mic (getUserMedia)
  → AudioWorklet (PCM16, 24kHz, base64)
  → WS voice.audio_input
  → Backend forwards as input.audio
  → AssemblyAI transcribes + responds
  → reply.audio (base64 PCM16 data field)
  → Backend relays as voice.agent_audio
  → Browser AudioContext.createBufferSource() → speakers
```

---

## Known Limitations

| Item | Status |
|---|---|
| Android build | MISSING (no Android SDK in CI) |
| RevenueCat production webhook | PARTIAL (reconcile logic real; webhook secret verification stubbed) |
| Telephony (SIP/PSTN) | STUB (architecture present, no production carrier) |
| Persistent database | PARTIAL (SQLite/postgres schema present; in-memory fallback for tests) |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "No audio" after connecting | `AudioContext` suspended (browser autoplay policy) | Click any button before starting; Chrome requires user gesture before AudioContext resumes |
| Wallet shows `-- Credits` | Backend DB not seeded | Hit `POST /api/billing/reconcile` with any product ID or run `npm run seed` |
| WS connects then immediately closes | Missing `ASSEMBLYAI_API_KEY` or invalid key | Check `.env`; test key `test_key` runs in simulation mode (no real audio) |
| Mic permission denied | HTTPS required | Run behind nginx with TLS or use localhost |
| Firefox echo cancellation off | Firefox ignores 24kHz AudioContext constraint | Known limitation; use Chrome for full demo |
