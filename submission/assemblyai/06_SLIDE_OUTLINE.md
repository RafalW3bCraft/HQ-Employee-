# Slide Deck Outline: HQ-Employee (8 Slides)

## Slide 1: Title & Value Proposition
- **Title:** HQ-Employee
- **Subtitle:** The Governed AI Business Employee
- **One-Line Value:** Real-time 24 kHz speech discovery and client coordination bounded by deterministic commercial policy.
- **Engine:** Built on AssemblyAI's managed Voice Agent API (`wss://agents.assemblyai.com/v1/ws`).

---

## Slide 2: The Enterprise Voice AI Challenge
- **The Problem with Unconstrained Voice AI:**
  - LLMs hallucinate pricing, timelines, and legal commitments.
  - Traditional bots lack mathematical commercial boundaries.
  - Naive tool execution breaks voice turn-taking and causes audio stutter.
  - Exposing raw API keys to browser clients creates major security risks.

---

## Slide 3: Governed Architecture & Zero-Trust Security
- **System Architecture:**
  `Browser Microphone (24 kHz) <-> Fastify Gateway <-> AssemblyAI Voice Agent WebSocket`
- **Zero Secret Exposure:** `ASSEMBLYAI_API_KEY` stays server-side; clients use 60-second single-use HMAC tickets (`GET /api/voice/ticket`).
- **Access Controls:** Replay rejection, expired ticket blocking, origin checking, and single concurrent session per IP enforcement.

---

## Slide 4: AssemblyAI Voice Agent API Integration
- **24 kHz Full-Duplex Audio:** Native 24 kHz PCM16 mono streaming over WebSockets.
- **Strict Handshake Lifecycle:** `session.update` dispatched first; incoming audio buffered until `session.ready` confirms `session_id`.
- **Immediate Speech Barge-In:** User speech immediately halts agent playback and flushes pending audio queues with zero overhang.

---

## Slide 5: Docs-Conformant Tool Coordination (BLK-012)
- **Official AssemblyAI Turn-Taking Protocol:**
  `tool.call` (buffered during `reply.started`) -> `reply.done` -> `tool.result` flushed -> `reply.started`
- **Interruption Safety:** If speech is interrupted before `reply.done`, pending tool executions are discarded cleanly.
- **Deterministic Tool Dispatch:** 13 registered domain business tools executed with strict JSON schemas.

---

## Slide 6: Deterministic Policy Engine
- **Fail-Closed Governance Boundary:**
  - **ALLOW:** Routine discovery, budget/timeline recording, calendar booking (`schedule_meeting`).
  - **REQUIRE_APPROVAL:** Custom discount requests (e.g. 15% discount) escalated to human Commercial Director.
  - **BLOCK:** Legal agreements (`sign_contract`), wire transfers, and credential access strictly rejected.
- **Immutable Audit Logging:** Every policy evaluation records action, decision, reason, timestamp, and actor ID.

---

## Slide 7: Empirical Production Verification
- **Automated Verification Matrix:** 10 out of 10 live criteria PASSED against live endpoints:
  - Health 200 OK (`/health/live`, `/health/ready`).
  - Single-use ticket lifecycle & replay rejection.
  - Real 24 kHz audio streaming & transcript turn completion.
  - Clean session termination & mid-call disconnect handling.
  - Secret scan: 0 occurrences of API keys or secrets.
- **Automated Test Suite:** 181 / 181 tests passing across 24 test suites (`npm test`).

---

## Slide 8: Deployment & Honest Disclosures
- **Single-Origin Deployment:** Single-origin web console served at `{{LIVE_URL}}/voice-tester` on Google Cloud Run (`min=max=1`).
- **Operational Persistence:** Active runtime state lives in Node.js process memory for low latency (resets on container reboot per `docs/PERSISTENCE_STATUS.md`), backed by structured PostgreSQL schemas (001–006).
- **External Modalities:** Google Calendar when configured, otherwise simulated calendar; telephony pre-call compliance verified with simulated SIP dispatch; Android client is an offline UI prototype.
