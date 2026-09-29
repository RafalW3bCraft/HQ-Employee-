# HQ-Employee — AssemblyAI Voice Agent Hackathon Submission

**Live Web Application:** {{LIVE_URL}}/voice-tester  
**Public GitHub Repository:** [https://github.com/RafalW3bCraft/HQ-Employee-](https://github.com/RafalW3bCraft/HQ-Employee-)  
**Category:** Voice Agent API / Real-time Speech-to-Speech  

---

## What We Built
HQ-Employee is a production-ready, governed AI business employee that handles prospective client inquiries via full-duplex conversational voice. Built on AssemblyAI's managed Voice Agent API, it conducts discovery, answers questions using an approved Company Brain, evaluates requests against a deterministic Policy Engine, and executes 13 real-world business tools (e.g. lead creation, requirement tracking, and live meeting scheduling).

---

## Why It Matters
Most voice AI prototypes fail in commercial production because:
1. They hallucinate pricing and timelines.
2. They cannot be trusted to negotiate or sign agreements.
3. They leak credentials or lack tenant isolation.

HQ-Employee solves this by placing a **deterministic Policy Engine** between the AI reasoning layer and backend execution. Actions are explicitly categorized into **ALLOW**, **REQUIRE_APPROVAL** (human director escalation), or **BLOCK** (hard rejection).

---

## Technical Highlights
- **Full-Duplex Voice Engine:** AssemblyAI Voice Agent WebSocket API (`wss://agents.assemblyai.com/v1/ws`) with low-latency neural speech, real-time STT, and natural speech barge-in.
- **AudioWorklet Architecture:** Real-time 24kHz PCM16 client capture and low-latency audio playback buffer.
- **Docs-Conformant Tool Coordination (BLK-012):** Gated tool execution draining on `reply.done` and clearing on interruption per official AssemblyAI specifications.
- **Ephemeral Token & Ticket Security:** Single-use short-lived HMAC tickets minted server-side via `GET /api/voice/ticket` (or direct tokens via `GET /api/voice/token`); raw keys are never exposed.
- **Robust Domain State:** Authoritative in-memory runtime for ultra-low latency, accompanied by structured PostgreSQL schemas (migrations 001–006) with non-blocking database write-through (disclosed in `docs/PERSISTENCE_STATUS.md`).
- **Comprehensive Test Suite:** 181 automated tests passing across 24 test suites with 0 failures (`npm test`).
- **Calendar & Modalities:** Google Calendar when configured, otherwise a simulated calendar. Outbound pre-call compliance pipeline implemented; SIP carrier dispatch is simulated in this submission. Android client is a UI prototype, not connected to the backend in this submission.

---

## Quick Links
- [Judge Testing Instructions](08_JUDGE_TEST_INSTRUCTIONS.md)
- [Video Demo Script](05_DEMO_SCRIPT.md)
- [Slide Outline](06_SLIDE_OUTLINE.md)
- [Persistence Status Audit](../../docs/PERSISTENCE_STATUS.md)
- [Detailed Architecture & Verification](../../docs/ASSEMBLYAI_PRODUCTION_VERIFICATION.md)
