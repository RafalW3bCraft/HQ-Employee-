# HQ-Employee — AssemblyAI Voice Agent Hackathon Submission

**Live Web Application:** `{{LIVE_URL}}/voice-tester`  
**Public Repository:** [https://github.com/RafalW3bCraft/HQ-Employee-](https://github.com/RafalW3bCraft/HQ-Employee-)  
**Category:** AssemblyAI Voice Agent API / Full-Duplex Real-Time Voice  

---

## What We Built
**HQ-Employee** is a production-grade, governed AI business employee built on **AssemblyAI's Voice Agent API**. Operating via full-duplex 24 kHz speech, HQ-Employee conducts natural qualification conversations with prospective clients, discovers requirements, queries company offerings, executes authorized business tools, and schedules calendar appointments.

To ensure safety and commercial accountability, every tool execution is intercepted and evaluated by a **deterministic Policy Engine** that categorizes actions into **`ALLOW`**, **`REQUIRE_APPROVAL`** (human escalation), or **`BLOCK`** (hard rejection).

---

## Technical Highlights & Verified Capabilities

- **AssemblyAI Voice Agent API (`wss://agents.assemblyai.com/v1/ws`):** Native 24 kHz PCM16 mono full-duplex speech with turn detection and immediate speech barge-in.
- **Strict Protocol Handshake:** `session.update` sent as first upstream message; `session.ready` received with `session_id`; client audio strictly buffered before session readiness.
- **Docs-Conformant Tool Coordination (BLK-012):** Tool results are buffered while the agent speaks (`reply.started`), drained and sent upon `reply.done`, and discarded if speech is interrupted.
- **Deterministic Policy Governance:**
  - `ALLOW`: Routine operations and meeting reservations (`schedule_meeting`).
  - `REQUIRE_APPROVAL`: Custom discount requests (e.g. 15% discount) escalated to the Commercial Director.
  - `BLOCK`: Legal agreements (`sign_contract`), banking credentials, and wire transfers.
- **Ephemeral Zero-Trust Security:** Raw `ASSEMBLYAI_API_KEY` is kept server-side; browser clients authenticate via single-use 60-second HMAC tickets (`GET /api/voice/ticket`), with replay and origin enforcement.
- **Append-Only Audit Trail:** Comprehensive event logging recording action, decision, reason, timestamp, and actor ID with automatic credential sanitization.
- **Automated Test Coverage:** 181 automated tests passing across 24 test suites with 0 failures (`npm test`).

---

## Deployment & Honest Status

- **Cloud Run Deployment:** Single-origin web console served directly at `{{LIVE_URL}}/voice-tester` on Google Cloud Run (`min=max=1`).
- **Persistence Reality:** Active operational state is maintained in Node.js process memory for deterministic low latency. Container reboot resets runtime state to clean baseline seed data (see [`docs/PERSISTENCE_STATUS.md`](../../docs/PERSISTENCE_STATUS.md)).
- **External Modalities:** Google Calendar when configured, otherwise simulated calendar; telephony pre-call compliance verified with simulated SIP dispatch; Android client is an offline UI prototype.

---

## Quick Links
- [Judge Testing Instructions](08_JUDGE_TEST_INSTRUCTIONS.md)
- [2-Minute Demo Script](05_DEMO_SCRIPT.md)
- [Slide Outline](06_SLIDE_OUTLINE.md)
- [Pre-Submission Verification Matrix](../../docs/PRE_SUBMISSION_VERIFICATION.md)
- [Persistence Status Audit](../../docs/PERSISTENCE_STATUS.md)
