# Long Description: HQ-Employee

## Executive Summary
Unconstrained conversational voice agents pose severe commercial and operational risks for businesses: they can hallucinate pricing, commit to unauthorized contractual terms, leak credentials, and stumble over audio turn-taking.

**HQ-Employee** solves this by establishing a **Governed AI Business Employee** built directly on **AssemblyAI's Voice Agent API**. Operating via full-duplex 24 kHz speech, HQ-Employee conducts natural qualification conversations with prospective clients, discovers project requirements, executes authorized business tools, and schedules calendar consultations. Every proposed action is intercepted and verified by a **deterministic Policy Engine** that enforces explicit commercial boundaries before any backend action or response occurs.

---

## Governed System Flow

```
  CLIENT MICROPHONE (24 kHz PCM16 Audio Stream)
         │
         ▼
  FASTIFY GATEWAY (Single-Use HMAC Ticket Authentication)
         │
         ▼
  ASSEMBLYAI VOICE AGENT API (wss://agents.assemblyai.com/v1/ws)
  • session.update Handshake -> session.ready (session_id logged)
  • Speech Detection & Real-Time Bidirectional Audio
  • Docs-Conformant Tool Coordination (BLK-012)
         │
         ▼
  DETERMINISTIC POLICY ENGINE
  ├── ALLOW             -> schedule_meeting, record_budget, record_timeline
  ├── REQUIRE_APPROVAL  -> 15% discount request (escalated to Commercial Director)
  └── BLOCK             -> sign_contract, wire transfers, credential sharing
         │
         ▼
  BUSINESS EXECUTION & AUDIT
  • Business Tools Execution (drained on reply.done)
  • Append-Only Audit Log (Action, Decision, Reason, Actor, Timestamp)
```

---

## Core Technical Capabilities

### 1. Full-Duplex 24 kHz Voice Engine
- **Direct AssemblyAI Integration:** Connects to AssemblyAI's managed Voice Agent WebSocket (`wss://agents.assemblyai.com/v1/ws`).
- **Strict Handshake Protocol:** The backend initiates the session with `session.update` as the very first upstream message, awaits `session.ready` with the assigned `session_id`, and buffers incoming client audio frames until handshake completion.
- **Natural Speech & Barge-In:** Streams raw 24 kHz PCM16 mono audio in ~50ms frames. Interruption events (`voice.speech_started` / `input.speech.started`) immediately halt agent playback and flush queued audio buffers.

### 2. Official Docs-Conformant Tool Coordination (BLK-012)
AssemblyAI requires precise turn-taking synchronization for client-side tool execution:
- When a `tool.call` arrives while the agent is speaking (`reply.started`), tool execution results are buffered.
- On `reply.done` with `status: "completed"`, the coordinator drains accumulated results and sends `tool.result` upstream.
- If the agent reply is interrupted before completion (`status: "interrupted"`), pending tool results are discarded, preventing stale or out-of-order execution loops.

### 3. Fail-Closed Policy Engine & Audit Trail
The AI model does not have authority to make commercial commitments or execute legal contracts:
- **`ALLOW`:** Routine business qualification operations, including company information lookup, requirement capture, and calendar booking (`schedule_meeting`).
- **`REQUIRE_APPROVAL`:** Requests exceeding autonomous authority (such as a 15% discount) automatically trigger an escalation ticket for human Commercial Director review.
- **`BLOCK`:** Strictly prohibited actions, such as signing contracts (`sign_contract`), accessing banking credentials, or demanding customer passwords, are hard-blocked immediately.
- **Audit Logging:** Every policy evaluation and tool execution is recorded in an append-only audit trail with sensitive credential sanitization.

### 4. Ephemeral Zero-Trust Security
- **No Secret Leakage:** The raw `ASSEMBLYAI_API_KEY` is maintained strictly server-side and is never transmitted to the browser.
- **Single-Use HMAC Tickets:** Browser clients request a short-lived (60-second) HMAC-signed ticket via `GET /api/voice/ticket` (supporting optional `DEMO_ACCESS_CODE`) before connecting to `/api/voice/ws?ticket=...`.
- **Replay & Origin Protection:** Reused tickets (rejected with code `4003`), expired tickets, unauthorized origins, and concurrent connections from the same IP (code `4029`) are rejected.

---

## Architecture & Operational Status

Per our verified empirical testing (`docs/PRE_SUBMISSION_VERIFICATION.md`):
- **Runtime State:** Operational domain state is maintained in Node.js process memory for deterministic low latency. Container restarts reset in-memory operational state to clean seed data, backed by structured PostgreSQL schemas (migrations 001–006) for persistent deployments (see `docs/PERSISTENCE_STATUS.md`).
- **Single-Instance Deployment:** Designed for container deployment (Google Cloud Run `min=max=1` with session affinity and no CPU throttling).
- **Calendar & Telephony:** Calendar integration supports Google Calendar when configured with automated fallback to a simulated calendar. Telephony pre-call compliance validation is implemented with simulated SIP carrier dispatch. The Android client is an offline UI prototype not connected to the backend in this submission.
- **Automated Verification:** 181 automated tests pass across 24 test suites with 0 failures (`npm test`).
