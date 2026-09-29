# HQ-Employee — Governed AI Business Employee

HQ-Employee is a governed AI business employee built on **AssemblyAI's Voice Agent API** (`wss://agents.assemblyai.com/v1/ws`). Operating via full-duplex 24 kHz speech, it conducts natural qualification conversations with prospective clients, discovers requirements, queries approved company offerings, executes authorized business tools, and schedules calendar consultations.

Every proposed action is intercepted by a fail-closed **Policy Engine** that evaluates commercial authority: **`ALLOW`** for routine operations (e.g. `schedule_meeting`), **`REQUIRE_APPROVAL`** for escalations (e.g. 15% discount), and **`BLOCK`** for prohibited actions (e.g. `sign_contract`). Every decision is logged in an append-only audit trail with sensitive credential sanitization.

---

## Architecture

```
Browser Client (24 kHz AudioWorklet)
       │  (Single-Use 60s HMAC Ticket via GET /api/voice/ticket)
       ▼
Fastify Gateway (Cloud Run min=max=1)
       │  (WebSocket Handshake: session.update -> session.ready)
       ▼
AssemblyAI Voice Agent API (wss://agents.assemblyai.com/v1/ws)
       │  (tool.call buffered during speech, flushed on reply.done per BLK-012)
       ▼
Deterministic Policy Engine (ALLOW / REQUIRE_APPROVAL / BLOCK)
       │
       ▼
Domain Services (In-Memory Runtime + Append-Only Audit Log)
```

---

## Honest Status

| Subsystem / Feature | Status | Operational Reality (docs/PRE_SUBMISSION_VERIFICATION.md) |
|---|:---:|---|
| **Voice Agent Engine** | **REAL** | AssemblyAI Voice Agent API, 24 kHz PCM16 full-duplex speech, docs-conformant BLK-012 tool coordination. |
| **Security & Auth** | **REAL** | `ASSEMBLYAI_API_KEY` stays server-side; clients use 60s single-use HMAC tickets (`GET /api/voice/ticket`). Replays rejected. |
| **Policy Engine & Audit** | **REAL** | Tri-state governance (`ALLOW`, `REQUIRE_APPROVAL`, `BLOCK`) with append-only audit logging and credential redaction. |
| **Operational State** | **REAL (In-Memory)** | Operational state is maintained in Node.js process memory. Reboots reset runtime state (see `docs/PERSISTENCE_STATUS.md`). |
| **Calendar Scheduling** | **REAL / SIMULATED** | Google Calendar integration when configured; falls back to simulated calendar. |
| **Outbound Telephony** | **SIMULATED** | 10-step pre-call compliance pipeline is real; SIP carrier trunk dispatch is simulated. |
| **Android Client** | **NOT IN SUBMISSION** | Offline UI prototype; not connected to backend in this submission. |

---

## Quickstart

```bash
# 1. Clone repository
git clone https://github.com/RafalW3bCraft/HQ-Employee-.git
cd HQ-Employee-/backend

# 2. Configure environment
cp .env.example .env
# Edit .env and set ASSEMBLYAI_API_KEY=your_key_here

# 3. Install dependencies and compile TypeScript
npm ci
npm run build

# 4. Start the server
npm start
```

Open `http://localhost:3000/voice-tester` in Chrome/Edge/Firefox to test live voice interaction.

---

## Environment Variables

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | Fastify server port | `3000` |
| `HOST` | Server host binding | `0.0.0.0` |
| `ASSEMBLYAI_API_KEY` | AssemblyAI secret key (server-side only) | `your_hex_key` |
| `JWT_SECRET` | Secret used to sign HMAC voice tickets | `your_jwt_secret` |
| `DEMO_ACCESS_CODE` | Optional code required to obtain voice ticket | `unset` (open) |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS/WS origins | `http://localhost:3000` |
| `VOICE_MAX_SESSION_SECONDS` | Maximum voice session duration cap | `600` |

---

## Automated Verification

The entire backend test suite executes 181 automated tests across 24 test suites with zero failures:

```bash
cd backend
npm test
```

Expected output:
```text
ℹ tests 181
ℹ suites 24
ℹ pass 181
ℹ fail 0
```

---

## Documentation

- [Pre-Submission Verification Matrix](docs/PRE_SUBMISSION_VERIFICATION.md)
- [Persistence Status Audit](docs/PERSISTENCE_STATUS.md)
- [Judge Testing Instructions](submission/assemblyai/08_JUDGE_TEST_INSTRUCTIONS.md)
- [Cloud Run Deployment Guide](docs/CLOUD_RUN_DEPLOYMENT.md)
