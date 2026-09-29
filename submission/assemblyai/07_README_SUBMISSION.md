# HQ-Employee — AssemblyAI Voice Agent Hackathon Submission

**Live Web Application:** [https://hq-employee.web.app](https://hq-employee.web.app)  
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
- **Full-Duplex Voice Engine:** AssemblyAI Voice Agent WebSocket API (`wss://agents.assemblyai.com/v1/ws`) with `universal-voice-agent` and natural speech barge-in.
- **AudioWorklet Architecture:** Real-time 24kHz PCM16 client capture and low-latency audio playback buffer.
- **Immediate Tool Results (`BLK-012`):** Zero-delay tool result forwarding upstream to eliminate conversational latency.
- **Ephemeral Token Security:** Single-use temporary tokens minted server-side via `POST /api/voice/token`; raw keys are never exposed.
- **Enterprise Persistence:** PostgreSQL database storing leads, interaction facts, and confirmed calendar bookings with idempotent migrations 001–006.
- **100% Test Coverage:** 156 automated integration tests passing across 18 test suites.

---

## Quick Links
- [Judge Testing Instructions](08_JUDGE_TEST_INSTRUCTIONS.md)
- [Video Demo Script](05_DEMO_SCRIPT.md)
- [Slide Outline](06_SLIDE_OUTLINE.md)
- [Detailed Architecture & Verification](docs/ASSEMBLYAI_PRODUCTION_VERIFICATION.md)
