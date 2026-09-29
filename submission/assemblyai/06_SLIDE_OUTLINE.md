# Slide Deck Outline: HQ-Employee

## Slide 1: Title & Vision
- **Header:** HQ-Employee
- **Subtitle:** The Governed AI Business Employee
- **Tagline:** Natural Speech. Deterministic Boundaries. Real Business Results.
- **Built With:** AssemblyAI Voice Agent API + Fastify + PostgreSQL

---

## Slide 2: The Enterprise Voice AI Dilemma
- **The Problem:**
  - AI chatbots hallucinate pricing and capabilities.
  - LLMs have no concept of corporate authority or commercial boundaries.
  - High voice latency destroys trust during client negotiations.
  - Direct database access by LLMs creates severe security vulnerabilities.

---

## Slide 3: The Architecture of Governance
- **Diagram:**
  `Voice (AssemblyAI) -> Understanding -> Company Brain -> Policy Engine -> Business Tools -> State & Append-Only Audit Log`
- **Core Principles:**
  - The model is an untrusted reasoning engine.
  - Every proposed action must pass through a deterministic policy boundary.
  - Ephemeral token/ticket minting guarantees zero secret leakage to clients.

---

## Slide 4: AssemblyAI Voice Agent Integration
- **Full-Duplex WebSocket (`wss://agents.assemblyai.com/v1/ws`)**
- **Native 24kHz Audio Processing:** AudioWorklet for low-latency PCM16 capture and playback.
- **Natural Barge-In & Turn Detection:** Immediate audio queue flush on interruption.
- **Docs-Conformant Tool Coordination (BLK-012):** Gated tool execution draining on `reply.done` and clearing on interruption per official AssemblyAI specs.

---

## Slide 5: The Policy Engine in Action
- **ALLOW:** Service lookups, lead creation, requirement discovery, calendar scheduling (Google Calendar when configured, otherwise simulated calendar).
- **REQUIRE_APPROVAL:** Custom discount requests (10%–20%), rush timelines.
- **BLOCK:** Contract signing, direct wire transfers, excessive discounts (>20%), credential sharing.

---

## Slide 6: Production Verification & Metrics
- **Automated Tests:** 181 / 181 tests passing (24 test suites, 0 failures).
- **Security:** Zero client-side API keys, strict CORS, single-use HMAC voice tickets.
- **Deployment:** Single-origin web console live at `{{LIVE_URL}}/voice-tester` on Google Cloud Run.
- **Persistence & Modalities:** Authoritative in-memory state with structured SQL migrations (001–006); outbound pre-call compliance pipeline implemented (SIP carrier dispatch simulated); Android UI prototype (unconnected in this submission).
