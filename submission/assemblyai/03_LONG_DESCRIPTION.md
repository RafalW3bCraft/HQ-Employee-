# Long Description: HQ-Employee

## Executive Overview
Most AI voice agents are designed as generic chatbots or unconstrained autonomous agents. In enterprise sales and client coordination, this creates catastrophic risks: hallucinations of pricing, unauthorized commercial commitments, lack of tenant isolation, and inability to integrate reliably into enterprise state.

**HQ-Employee** reimagines the enterprise AI worker as a **Governed AI Business Employee**. Built on top of **AssemblyAI's Voice Agent API**, HQ-Employee conducts natural, full-duplex conversational voice calls, qualifies inbound opportunities, looks up approved company offerings, executes authorized business tools, reserves calendar slots, and strictly escalates out-of-bounds requests to human leadership.

---

## The Governed Flow

```
  VOICE (AssemblyAI 24kHz Full-Duplex Speech)
    │
    ▼
  UNDERSTANDING (Turn Detection, VAD, Code-Switching)
    │
    ▼
  COMPANY BRAIN (Services, Approved Pricing & Timeline Guidance)
    │
    ▼
  POLICY ENGINE (Deterministic Boundary: ALLOW / REQUIRE_APPROVAL / BLOCK)
    │
    ▼
  BUSINESS TOOLS (13 Explicit Domain Tools with Strict JSON Schemas)
    │
    ▼
  BUSINESS RESULT (PostgreSQL Lead Record, Confirmed Calendar Booking, Audit Log)
```

---

## Key Capabilities & Innovations

### 1. Ultra-Low-Latency Full-Duplex Voice
- Powered by AssemblyAI's managed Voice Agent WebSocket (`wss://agents.assemblyai.com/v1/ws`).
- Browser client uses custom `AudioWorklet` capturing raw PCM16 audio at 24,000 Hz.
- Natural speech barge-in and interruption: when the human speaks, AssemblyAI triggers turn events, and HQ-Employee immediately flushes the client audio buffer.

### 2. Zero-Trust Security & Ephemeral Token Minting
- The browser client NEVER sees `ASSEMBLYAI_API_KEY`.
- Ephemeral single-use tokens are minted via `POST /api/voice/token` on the backend and expire in 300 seconds.
- Multi-tenant data isolation ensures Lead A can never inspect or alter Lead B's memory records.

### 3. Governed Policy Engine Boundary
The LLM has zero direct database, network, or shell access. Every proposed action routes through a deterministic policy engine:
- **Approved Service Inquiry & Budget Capture**: `ALLOW`
- **10%–20% Discount Request**: `REQUIRE_APPROVAL` (Escalated to human director; creates trackable ticket)
- **Excessive Discount (>20%)**: `BLOCK` (Hard cut-off)
- **Contract / Legal Signing**: `BLOCK` (AI cannot sign contracts or execute legal commitments)
- **Direct Financial Transfers**: `BLOCK` (Fail-closed default)

### 4. 13 Explicit Domain Business Tools
HQ-Employee operates with exactly 13 domain-specific tools:
1. `get_company_profile` — Background, headquarters, and core expertise
2. `get_service_details` — Deliverables and technology stacks
3. `get_pricing_guidance` — Official approved price bands
4. `get_timeline_guidance` — Standard sprint and delivery schedules
5. `create_lead` — Creates prospect records in PostgreSQL
6. `update_lead` — Updates contact information
7. `record_requirement` — Logs technical and business needs
8. `record_budget` — Captures stated budget ranges
9. `record_timeline` — Captures target launch deadlines
10. `request_human_approval` — Escalates out-of-bounds client requests
11. `check_calendar` — Checks real-time meeting availability
12. `schedule_meeting` — Reserves confirmed consultation slot
13. `end_call` — Concludes conversation gracefully

### 5. Production-Ready Deployment
- **Web Console**: Deployed on Firebase Hosting (`https://hq-employee.web.app`) with strict CSP and `Permissions-Policy: microphone=(self)`.
- **Fastify Backend**: Containerized with multi-stage non-root OCI image for Google Cloud Run.
- **Database**: PostgreSQL with idempotent migrations 001–006.
- **Observability**: Cryptographic SHA-256 tamper-evident audit logging for every policy evaluation and state transition.
