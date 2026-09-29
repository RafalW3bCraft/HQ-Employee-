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
  `Voice (AssemblyAI) -> Understanding -> Company Brain -> Policy Engine -> Business Tools -> State (PostgreSQL)`
- **Core Principles:**
  - The model is an untrusted reasoning engine.
  - Every proposed action must pass through a deterministic policy boundary.
  - Ephemeral token minting guarantees zero secret leakage to clients.

---

## Slide 4: AssemblyAI Voice Agent Integration
- **Full-Duplex WebSocket (`wss://agents.assemblyai.com/v1/ws`)**
- **Native 24kHz Audio Processing:** AudioWorklet for low-latency PCM16 capture and playback.
- **Natural Barge-In & Turn Detection:** Immediate audio queue flush on interruption.
- **Immediate Tool Results (`BLK-012`):** Zero delay between tool completion and speech synthesis.

---

## Slide 5: The Policy Engine in Action
- **ALLOW:** Service lookups, lead creation, requirement discovery, calendar scheduling.
- **REQUIRE_APPROVAL:** Custom discount requests (10%–20%), rush timelines.
- **BLOCK:** Contract signing, direct wire transfers, excessive discounts (>20%), credential sharing.

---

## Slide 6: Production Verification & Metrics
- **Automated Tests:** 152 / 152 tests passing (100% pass rate across 18 test suites).
- **Security:** Zero client-side API keys, strict CORS, multi-tenant SQL isolation.
- **Deployment:** Live on Firebase Hosting (`https://hq-employee.web.app/`) with containerized backend on Google Cloud Run.
