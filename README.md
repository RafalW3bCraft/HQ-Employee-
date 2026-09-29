# HQ-Employee — Governed AI Business Employee

<div align="center">

![HQ Employee Banner](https://img.shields.io/badge/HQ%20Employee-Governed%20Autonomous%20AI-6366f1?style=for-the-badge)
[![AssemblyAI Voice Agent API](https://img.shields.io/badge/AssemblyAI-Voice%20Agent%20API-0ea5e9?style=for-the-badge&logo=assemblyai)](https://www.assemblyai.com)
[![RevenueCat Monetization](https://img.shields.io/badge/RevenueCat-In--App%20Purchases-e11d48?style=for-the-badge&logo=revenuecat)](https://www.revenuecat.com)
[![Fastify Backend](https://img.shields.io/badge/Fastify-TypeScript%20API-000000?style=for-the-badge&logo=fastify)](https://fastify.dev)
[![Android Client](https://img.shields.io/badge/Android-Jetpack%20Compose-3ddc84?style=for-the-badge&logo=android)](https://developer.android.com/jetpack/compose)
[![Tests Passing](https://img.shields.io/badge/Tests-156%2F156%20Passed-10b981?style=for-the-badge)](file:///home/watcher/Desktop/employee/backend/test)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict%20Mode-3178c6?style=for-the-badge&logo=typescript)](file:///home/watcher/Desktop/employee/backend/tsconfig.json)

**The Autonomous, Governed AI Sales & Client Coordinator for Rafal Webcraft**

*Dual Submission for the **RevenueCat Shipaton 2026** and **AssemblyAI Voice Agent Hackathon***

[Quick Start](#-quick-start--installation) • [API Keys Setup Guide](#-required-api-keys--how-to-obtain-them) • [Usage Steps](#-step-by-step-usage-guide) • [Lifecycle & Flows](#-complete-system-lifecycle--flow-architecture) • [File-by-File Analysis](#-complete-project-file-by-file--code-by-code-analysis) • [API Reference](#-complete-api-endpoints-reference) • [Evaluation Guide](docs/JUDGE_ACCESS.md)

</div>

---

## 📖 1. Executive Summary & Value Proposition

**HQ-Employee** (HQ-Employee Sales & Client Coordinator) is an enterprise-grade, governed AI business employee designed to automate high-touch client acquisition and initial qualification for Rafal Webcraft. Unlike typical unstructured conversational chatbots, HQ-Employee operates under **strict mathematical governance**, backed by a deterministic policy engine, versioned organizational knowledge, double-entry credit ledgering, and carrier-grade voice telephony.

### Key Capabilities
- 🎙️ **Full-Duplex Speech-to-Speech:** Powered by AssemblyAI's Voice Agent API (`wss://agents.assemblyai.com/v1/ws`) with the low-latency `alba` neural voice, real-time STT, and natural turn interruption.
- 🛡️ **Fail-Closed Deterministic Governance:** A Policy Engine that evaluates every proposed tool call and strictly returns `ALLOW`, `REQUIRE_APPROVAL`, or `BLOCK`. The LLM never decides its own business authority.
- 🧠 **Company Brain Subsystem:** Versioned company profile, approved service catalog, pricing formulas, delivery timeline constraints, and canonical FAQs. The agent discusses *only* approved knowledge.
- 📋 **Adaptive Lead Qualification:** Discovers 10 critical project dimensions without interrogating leads, detects contradictory facts, tracks provenance, and outputs structured Project Briefs.
- 📅 **Race-Safe Calendar Scheduling:** Directly integrates with enterprise calendar slots, atomically locks availability, and enforces a zero-phantom-booking guarantee.
- 💳 **RevenueCat Authoritative Monetization:** Double-entry ledger tracking credit packages (*Starter*, *Growth*, *Scale*), balance reservations, consumption auditing, and server-to-server webhook reconciliation.
- 📞 **Governed Outbound Telephony:** A 10-step pre-call verification pipeline including TCPA-compliant calling windows, mandatory AI disclosure, carrier SIP trunking, and Do-Not-Call (DNC) registry enforcement.
- 🖥️ **Zero-Setup Browser Console:** Includes an in-browser voice testing console (`/voice-tester`) featuring live microphone capture, real-time PCM16 streaming, audio waveform visualizers, and tool event inspection.

---

## 🔑 2. Required API Keys & How to Obtain Them

HQ Employee is architected to run immediately in any environment. An in-memory fallback layer allows all automated tests, mock voice calls, and ledger transactions to execute with zero external dependencies. To enable live voice synthesis, real-time telephony, and production monetization, configure the following API keys in `backend/.env`:

| Environment Variable | Service | Required For | Fallback When Missing |
|---|---|---|---|
| `ASSEMBLYAI_API_KEY` | [AssemblyAI](https://www.assemblyai.com) | Live Voice Agent WebSocket, Speech Synthesis (`alba`), Real-time STT, SIP Trunking | Mock Voice Session Provider |
| `REVENUECAT_SECRET_KEY` | [RevenueCat](https://www.revenuecat.com) | Server-side receipt verification, customer entitlement sync | In-Memory Authoritative Ledger |
| `REVENUECAT_WEBHOOK_SECRET` | [RevenueCat](https://www.revenuecat.com) | Cryptographic signature validation for inbound purchase webhooks | Test signature bypass in dev mode |
| `DATABASE_URL` | [Neon](https://neon.tech) / PostgreSQL | Multi-tenant persistent relational storage across all 12 subsystems | In-Memory Atomic Concurrent Store |
| `SIP_CALLER_ID` | Carrier / Twilio / SIP | Authorized outbound caller ID (E.164 format) | Default: `+15550001234` |
| `JWT_SECRET` | Backend Auth | Minting ephemeral single-use session tokens for clients | Development default secret |

---

### Step-by-Step Guide to Obtaining Your API Keys

#### Step 1: Obtain AssemblyAI Voice Agent API Key
1. Visit [assemblyai.com](https://www.assemblyai.com) and click **Start for Free** to create an account.
2. Once signed in, navigate to your **[Dashboard API Keys](https://www.assemblyai.com/dashboard/api-keys)**.
3. Locate your Account API Key (a 32-character hexadecimal string, e.g. `7bdca5e023144a98a0...`).
4. Click **Copy** to clipboard.
5. In your project, open or create [`backend/.env`](file:///home/sp3ct0r/employee/backend/.env) and set:
   ```env
   ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
   ```
   > ⚠️ **Security Architecture Rule:** The raw `ASSEMBLYAI_API_KEY` is **strictly kept on the backend**. It is NEVER bundled in the Android APK or exposed to browser JavaScript. Web and mobile clients request single-use, short-lived session tokens via `GET /api/voice/token`.

#### Step 2: Obtain RevenueCat API Keys
1. Create or sign into your account at [app.revenuecat.com](https://app.revenuecat.com).
2. Create a new Project (e.g. named **HQ Employee**).
3. In the left navigation, open **Project Settings** → **API Keys**.
4. In the **Secret API keys** section, click **+ Generate new key**.
5. Give the key a label (e.g. `Backend Production`) and copy the generated token (`sk_...`).
6. Set this value in `backend/.env`:
   ```env
   REVENUECAT_SECRET_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
7. To configure Webhooks:
   - Navigate to **Integrations** → **Webhooks** in RevenueCat.
   - Click **+ Add Webhook**.
   - Enter your backend webhook URL: `https://your-domain.com/api/billing/webhooks`.
   - Set an **Authorization Header** value or generate a webhook secret token.
   - Paste that secret into `backend/.env`:
     ```env
     REVENUECAT_WEBHOOK_SECRET=your_webhook_secret_here
     ```

#### Step 3: Provision PostgreSQL Database (Optional / Recommended for Production)
HQ Employee includes a complete in-memory relational store that activates automatically if `DATABASE_URL` is omitted. For persistent deployment:
- **Cloud (Serverless):**
  1. Register for a free tier at [neon.tech](https://neon.tech).
  2. Create a database named `hq_employee`.
  3. Copy the connection string and paste it into `backend/.env`:
     ```env
     DATABASE_URL=postgresql://neondb_owner:password@ep-sample-12345.us-east-2.aws.neon.tech/hq_employee?sslmode=require
     ```
- **Local (Docker Compose):**
  ```bash
  cd infra
  docker compose up -d
  # Sets up postgres on localhost:5432 with DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webcraft_employee
  ```

---

## 🚀 3. Quick Start & Installation

### System Prerequisites
- **Node.js:** v20.x, v22.x, or v26.x
- **Package Manager:** `npm` v10+
- **Android Development (Optional for Mobile):** Android Studio Ladybug (2024.2+) or newer, JDK 17, Android SDK API 26+ (Android 8.0 Oreo or higher)
- **Browser:** Any modern Chromium-based browser (Google Chrome, Microsoft Edge, Brave) with microphone permissions enabled

---

### Step 1: Clone and Configure Environment

```bash
# Clone the repository
git clone https://github.com/rafal-webcraft/employee.git
cd employee

# Create backend environment configuration
cd backend
cp .env.example .env
```

Review your [`backend/.env`](file:///home/sp3ct0r/employee/backend/.env) file:
```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
ENVIRONMENT=development

# AssemblyAI Credentials
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# RevenueCat Credentials
REVENUECAT_SECRET_KEY=sk_your_revenuecat_secret_key_here
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret_here

# Persistence (Optional - omit for in-memory mode)
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webcraft_employee

# Auth & Calling Defaults
JWT_SECRET=webcraft_hq_super_secure_jwt_secret_change_in_prod
SIP_CALLER_ID=+15550001234
```

---

### Step 2: Install Dependencies & Run Verification

```bash
# Install backend dependencies
cd backend
npm install

# Build TypeScript to verify zero compilation errors
npm run build

# Run complete 142-test suite across 18 test suites
npm test
```

Expected test output:
```text
✔ 18 test suites passed
✔ 142 automated unit, integration, and E2E tests passed
✔ 0 failures, 0 skipped
ℹ Duration: ~1.2s
```

---

### Step 3: Run Database Migrations (When using PostgreSQL)

If you configured a PostgreSQL connection string in `DATABASE_URL`, apply the 5 sequential SQL migrations:

```bash
npm run migrate
```

Migrations applied in sequence:
1. `001_initial_schema.sql` — Companies, employees, leads, facts, audit log
2. `002_company_brain.sql` — Company profile, approved services, pricing, FAQs, policies
3. `003_meetings_enhancements.sql` — Availability slots, calendar sync, meetings
4. `004_telephony_subsystem.sql` — Call sessions, SIP provider logs, DNC opt-outs
5. `005_credit_ledger.sql` — Double-entry credit ledger, wallets, transactions

---

### Step 4: Start the Backend Server

You can run the server from the repository root or from inside `backend/`:

```bash
# Option A: From repository root (recommended)
npm run dev

# Option B: From inside backend directory
cd backend
npm run dev
```

> **Note on Working Directory:** Always execute npm commands either from the repository root `/home/sp3ct0r/employee` or within `backend/`. Running `npm run dev` from subdirectories like `prompts/` will fail because `package.json` resides at the root and inside `backend/`.

To run in production mode:
```bash
npm start
# Or: cd backend && npm start
```

The Fastify server starts listening on `http://0.0.0.0:3000`.

Verify the health check endpoint:
```bash
curl http://localhost:3000/health
# Response:
# {"status":"ok","service":"webcraft-employee-backend","version":"0.1.0","timestamp":"2026-09-17T19:15:00.000Z"}
```

---

### Step 5: Run the Android Client Application

1. Open **Android Studio**.
2. Select **Open** and choose the `/home/sp3ct0r/employee/android` directory.
3. Wait for Gradle sync to complete.
4. Launch an Android Emulator (Pixel 8 / API 34 recommended) or connect a physical Android device with USB Debugging enabled.
5. Click **Run 'app'** (`Shift + F10`).
6. The app connects automatically to `http://10.0.2.2:3000` (Android emulator alias for host `localhost`). If using a physical phone, set `BACKEND_URL` to your computer's local Wi-Fi IP address (e.g. `http://192.168.1.50:3000`).

---

## 🎙️ 4. Interactive Voice Testing Console

To test the AssemblyAI Voice Agent coordinator immediately without compiling the Android app or configuring SIP telephony:

1. Ensure the backend is running (`npm run dev`).
2. Open your browser and navigate to:
   ```text
   http://localhost:3000/voice-tester
   ```
3. Grant microphone permissions when prompted by your browser.
4. Click **"Connect to HQ Voice Agent"**:
   - The frontend calls `GET /api/voice/token` to receive a secure, single-use token.
   - It establishes a full-duplex WebSocket connection to `/api/voice/ws`.
   - The browser AudioContext begins sampling PCM16 audio at 16kHz and streaming it directly to the Voice Agent.
5. Speak into your microphone to converse naturally with HQ Coordinator:
   - *"Hello! What services does Rafal Webcraft provide?"*
   - *"How much does a full web application MVP cost?"*
   - *"Can we schedule a discovery meeting for next Tuesday at 2 PM?"*
   - *"Can you give me a 15% discount on that?"* *(Observe the Policy Engine trigger `REQUIRE_APPROVAL`!)*
6. Live Visualizer & Activity Panels:
   - **Audio Visualizer:** Oscilloscope rendering user microphone stream and synthesized audio responses.
   - **Live Transcripts:** Real-time user input and AI responses.
   - **Interruption Testing:** Interrupt the AI while it speaks; notice immediate turn interruption and speech stop.
   - **Tool Activity Log:** Inspect real-time tool execution (`get_company_profile`, `get_service_details`, `record_budget`, `schedule_meeting`) governed by the Policy Engine.

---

## 🔄 5. Complete System Lifecycle & Flow Architecture

HQ Employee executes a strict 6-stage lifecycle for every lead interaction, whether initiated over web voice, mobile in-app audio, or outbound SIP telephony:

```mermaid
sequenceDiagram
    autonumber
    actor Prospect as Prospective Client / Lead
    participant Client as Android App / Browser Console
    participant VoiceGW as AssemblyAI Voice Gateway
    participant Backend as Fastify Voice Service
    participant Policy as Deterministic Policy Engine
    participant Brain as Company Brain Subsystem
    participant Leads as Lead Qualification Engine
    participant Calendar as Meeting Calendar Service
    participant Ledger as RevenueCat Credit Ledger
    participant Audit as Append-Only Audit Log

    Note over Prospect,Ledger: Phase 1: Pre-Call Verification & Credit Lock
    Client->>Backend: POST /api/telephony/outbound/initiate
    Backend->>Backend: Execute 10-Step Pre-Call Pipeline (Consent, TCPA, DNC, Disclosure)
    Backend->>Ledger: Reserve 25 Credits for Call Duration (RESERVATION)
    Backend->>Audit: Log TELEPHONY_CALL_INITIATED
    Backend-->>Client: Session Created (callId, ephemeralToken)

    Note over Prospect,VoiceGW: Phase 2: Full-Duplex Audio & Conversational Loop
    Client->>VoiceGW: Stream PCM16 16kHz Audio (Prospect Voice)
    VoiceGW-->>Client: Synthesized Voice Stream ("alba" Neural Model)
    Note over VoiceGW: Real-Time STT, Interruption Handling & Turn Detection

    Note over VoiceGW,Policy: Phase 3: Governed Tool Request & Policy Decision
    VoiceGW->>Backend: tool.call: "get_service_details" (service: "web-development")
    Backend->>Policy: evaluateAction("get_service_details", params)
    Policy-->>Backend: Decision: ALLOW (Policy v1.0.0)
    Backend->>Brain: Query Approved Service Specs & Pricing Limits
    Brain-->>Backend: Verified Service Data ($5k - $25k, 4-8 weeks)
    Backend->>Audit: Log POLICY_EVALUATION (ALLOW)
    Backend-->>VoiceGW: tool.result: { approved_data: ... }

    Note over Prospect,Backend: Phase 4: Out-of-Bounds Request & Escalation
    Prospect->>VoiceGW: "Can you give me a 20% discount if I sign today?"
    VoiceGW->>Backend: tool.call: "request_human_approval" (discount: 20%)
    Backend->>Policy: evaluateAction("apply_custom_discount", 20%)
    Policy-->>Backend: Decision: REQUIRE_APPROVAL (Threshold: <= 20% requires Director)
    Backend->>Backend: Create Escalation Ticket (ApprovalsRepository)
    Backend->>Audit: Log HUMAN_ESCALATION_CREATED
    Backend-->>VoiceGW: "I've submitted a 20% discount request to our director for review."

    Note over VoiceGW,Calendar: Phase 5: Race-Safe Calendar Booking
    Prospect->>VoiceGW: "Let's book a consultation for next Thursday at 10 AM."
    VoiceGW->>Backend: tool.call: "schedule_meeting" (slot: 2026-09-24T10:00:00Z)
    Backend->>Policy: evaluateAction("schedule_meeting")
    Policy-->>Backend: Decision: ALLOW
    Backend->>Calendar: Atomically Lock Slot & Create Calendar Event
    Calendar-->>Backend: Confirmed (calendarEventId: "evt_99812")
    Backend->>Leads: Transition Lead Status -> MEETING_BOOKED
    Backend->>Audit: Log MEETING_SCHEDULED (Atomic Confirmation)
    Backend-->>VoiceGW: tool.result: { success: true, confirmation: "Confirmed" }

    Note over Prospect,Ledger: Phase 6: Call Termination & Ledger Reconciliation
    VoiceGW->>Backend: session.terminated (Duration: 184 seconds)
    Backend->>Ledger: Settle Consumed Credits (15 credits CONSUMPTION)
    Backend->>Ledger: Release Unused Reservation (10 credits RELEASE)
    Backend->>Audit: Log TELEPHONY_CALL_ENDED (Exact duration & cost)
```

---

## 📂 6. Complete Project File-by-File & Code-by-Code Analysis

This section provides an exhaustive, code-level analysis of every critical component across the entire repository.

```text
employee/
├── android/
│   ├── app/src/main/AndroidManifest.xml
│   ├── app/src/main/res/xml/network_security_config.xml
│   ├── app/src/main/java/com/webcraft/employee/
│   │   ├── MainActivity.kt
│   │   ├── WebcraftApp.kt
│   │   ├── domain/model/
│   │   ├── domain/repository/
│   │   ├── domain/usecase/
│   │   ├── data/fake/
│   │   └── presentation/
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── server.ts
│   │   ├── config/index.ts
│   │   ├── errors/index.ts
│   │   ├── db/
│   │   ├── modules/
│   │   └── routes/
│   ├── public/voice-tester.html
│   └── test/
├── docs/
└── infra/
```

---

### Part A: Backend Core Infrastructure

#### 1. [`backend/src/config/index.ts`](file:///home/sp3ct0r/employee/backend/src/config/index.ts)
- **Role:** Environment Configuration & Schema Validation.
- **Implementation:** Uses `zod` to validate all runtime environment variables at process startup.
- **Key Parameters:**
  - `PORT`: Server listen port (default `3000`).
  - `HOST`: Server host binding (default `0.0.0.0`).
  - `ASSEMBLYAI_API_KEY`: Secret API token for AssemblyAI Voice Agent & Telephony.
  - `REVENUECAT_SECRET_KEY`: Private API key for receipt validation.
  - `REVENUECAT_WEBHOOK_SECRET`: Secret token for HMAC webhook validation.
  - `DATABASE_URL`: PostgreSQL connection string (optional; falls back to in-memory store).
  - `JWT_SECRET`: Secret used to sign ephemeral client voice tokens.
  - `SIP_CALLER_ID`: E.164 phone number used for carrier outbound calling.

#### 2. [`backend/src/errors/index.ts`](file:///home/sp3ct0r/employee/backend/src/errors/index.ts)
- **Role:** RFC 7807 Structured Error Hierarchy.
- **Implementation:** Base class `AppError` extending `Error`, with structured subclasses:
  - `ValidationError`: 400 Bad Request with field-level constraint errors.
  - `NotFoundError`: 404 Not Found when resources do not exist.
  - `UnauthorizedError`: 401 Unauthorized for missing/invalid auth tokens.
  - `ForbiddenError`: 403 Forbidden for tenant boundary violations.
  - `PolicyViolationError`: 403 Forbidden when an action is `BLOCK`ed by governance.
  - `CreditExhaustedError`: 402 Payment Required when wallet balance is insufficient.
  - `ConflictError`: 409 Conflict for double-booking or concurrency collisions.
  - `CalendarOperationError`: 502 Bad Gateway when external calendar sync fails.

#### 3. [`backend/src/server.ts`](file:///home/sp3ct0r/employee/backend/src/server.ts)
- **Role:** Fastify Application Factory & Middleware Pipeline.
- **Implementation:**
  - Registers `@fastify/cors` with configurable origin controls.
  - Registers `@fastify/websocket` for real-time duplex voice streaming.
  - Registers `@fastify/static` to serve [`public/voice-tester.html`](file:///home/sp3ct0r/employee/backend/public/voice-tester.html).
  - Global `setErrorHandler`: serializes errors into standardized JSON payloads containing `code`, `message`, and `timestamp`.
  - Attaches all route modules under `/api` and `/health`.

#### 4. [`backend/src/index.ts`](file:///home/sp3ct0r/employee/backend/src/index.ts)
- **Role:** Process Bootstrap & Graceful Shutdown.
- **Implementation:** Instantiates the Fastify server from `server.ts`, binds to `HOST` and `PORT`, and handles `SIGTERM` / `SIGINT` signals to flush open database transactions and close active WebSockets cleanly.

---

### Part B: Database & Migrations

#### 1. [`backend/src/db/index.ts`](file:///home/sp3ct0r/employee/backend/src/db/index.ts)
- **Role:** Persistence Layer Abstraction.
- **Implementation:** Connects to PostgreSQL via `pg.Pool` when `DATABASE_URL` is set. When unset, initializes an **atomic in-memory relational store** with identical query interfaces. This enables seamless, zero-config local development and rapid test execution.

#### 2. [`backend/src/db/migrator.ts`](file:///home/sp3ct0r/employee/backend/src/db/migrator.ts)
- **Role:** Sequential Database Migration Engine.
- **Implementation:** Reads SQL files in lexicographical order, tracks applied migrations in a `schema_migrations` table, and executes pending scripts inside an isolated transaction.

#### 3. Migration Files:
- [`001_initial_schema.sql`](file:///home/sp3ct0r/employee/backend/src/db/migrations/001_initial_schema.sql): Creates `companies`, `employees`, `leads`, `lead_facts`, and `audit_events`.
- [`002_company_brain.sql`](file:///home/sp3ct0r/employee/backend/src/db/migrations/002_company_brain.sql): Creates `company_profiles`, `approved_services`, `faqs`, and `company_policies` with semantic versioning and status tracking (`ACTIVE`, `SUPERSEDED`, `DRAFT`).
- [`003_meetings_enhancements.sql`](file:///home/sp3ct0r/employee/backend/src/db/migrations/003_meetings_enhancements.sql): Creates `meetings`, `availability_slots`, and `calendar_connections`.
- [`004_telephony_subsystem.sql`](file:///home/sp3ct0r/employee/backend/src/db/migrations/004_telephony_subsystem.sql): Creates `call_sessions`, `dnc_opt_outs`, and `telephony_logs`.
- [`005_credit_ledger.sql`](file:///home/sp3ct0r/employee/backend/src/db/migrations/005_credit_ledger.sql): Creates `credit_wallets` and `credit_ledger_transactions` with balance constraints and transaction types.

---

### Part C: Domain Subsystems & Modules

#### 1. Company Brain Subsystem ([`backend/src/modules/company/index.ts`](file:///home/sp3ct0r/employee/backend/src/modules/company/index.ts))
- **Core Entities:** `CompanyProfile`, `ApprovedService`, `FaqItem`, `CompanyPolicy`.
- **Architectural Rules:**
  - Company knowledge is strictly maintained on the backend and never hardcoded in client UI.
  - Every policy must feature: `id`, `version`, `status` (`ACTIVE`, `DRAFT`, `SUPERSEDED`), `createdAt`, and `updatedAt`.
  - The active policy is version-pinned. When a new policy is activated, the previous one is automatically retired to `SUPERSEDED`.
  - Exposes `getApprovedKnowledge(companyId)` used by the Employee Runtime to inject canonical guidelines into the voice system prompt.

#### 2. Governed Policy Engine ([`backend/src/modules/policies/index.ts`](file:///home/sp3ct0r/employee/backend/src/modules/policies/index.ts))
- **Core Entity:** `PolicyEngine`.
- **Tri-State Verdict:** Returns exactly one of: `ALLOW`, `REQUIRE_APPROVAL`, or `BLOCK`.
- **Deterministic Matrix:**
  - `sign_contract` / legal commitments → `BLOCK`
  - `request_payment` / asking for credit card or banking details → `BLOCK`
  - `request_password` / credentials / OTP requests → `BLOCK`
  - `apply_custom_discount` (discount ≤ 20%) → `REQUIRE_APPROVAL`
  - `apply_custom_discount` (discount > 20%) → `BLOCK`
  - `commit_rush_delivery` (timeline < 2 weeks) → `REQUIRE_APPROVAL`
  - `schedule_meeting` (future available slot) → `ALLOW`
  - `schedule_meeting` (past or unavailable slot) → `BLOCK`
  - Unknown or out-of-scope actions → `BLOCK` (Fail-closed principle)

#### 3. Lead Qualification & Fact Engine ([`backend/src/modules/leads/index.ts`](file:///home/sp3ct0r/employee/backend/src/modules/leads/index.ts))
- **Core Entity:** `LeadQualificationService`.
- **Qualification Stages:** `NEW` → `CONTACTED` → `ENGAGED` → `QUALIFYING` → `QUALIFIED` → `MEETING_BOOKED` (or `UNQUALIFIED` / `HUMAN_HANDOFF`).
- **Adaptive Discovery:** Dynamically analyzes recorded facts across 10 project dimensions (project type, business objective, target users, required features, integrations, existing system, timeline, budget, decision-maker status, urgency) and computes the next single most relevant question (`AdaptiveQuestion.questionText`).
- **Contradiction Management:** Rejects conflicting facts unless accompanied by higher confidence provenance.
- **Project Brief Generator:** Synthesizes verified facts into a structured markdown project brief for engineering directors.
- **Privacy Compliance:** Implements `purgeLeadMemory(leadId)` for GDPR "Right to be Forgotten".

#### 4. Meeting Scheduling & Calendar Subsystem ([`backend/src/modules/meetings/index.ts`](file:///home/sp3ct0r/employee/backend/src/modules/meetings/index.ts))
- **Core Entity:** `MeetingService`.
- **Cardinal Rule:** *"Never claim a meeting is booked until the calendar operation succeeds."*
- **Features:**
  - Concurrency locking prevents double-booking the same discovery slot.
  - Automatic timezone conversion and explicit ISO-8601 storage.
  - Automatic transaction rollback and error emission if external Google/Outlook calendar operations fail.

#### 5. AssemblyAI Voice Agent Module ([`backend/src/modules/assemblyai/index.ts`](file:///home/sp3ct0r/employee/backend/src/modules/assemblyai/index.ts))
- **Core Entity:** `AssemblyAIVoiceService`.
- **Voice Agent Protocol:**
  - Connects to AssemblyAI's managed Voice Agent API (`wss://agents.assemblyai.com/v1/ws`).
  - Configures model parameters: low-latency voice `alba`, prompt temperature 0.2, dynamic interruption handling.
  - Injects Webcraft Sales & Client Coordinator system instructions derived from the active Company Brain.
- **13 Registered Business Tools:**
  1. `get_company_profile`: Retrieve company overview and verified credentials.
  2. `get_service_details`: Look up capabilities and scope for an approved service.
  3. `get_pricing_guidance`: Query approved pricing bounds for a service.
  4. `get_timeline_guidance`: Query approved delivery timeline estimates.
  5. `create_lead`: Register prospective client details.
  6. `update_lead`: Update client contact information.
  7. `record_requirement`: Save discovered functional/technical requirements.
  8. `record_budget`: Save declared client budget with provenance.
  9. `record_timeline`: Save target delivery milestone dates.
  10. `request_human_approval`: Escalate discount or custom scope requests to a human director.
  11. `check_calendar`: Query real-time availability for discovery consultations.
  12. `schedule_meeting`: Atomically book an approved meeting slot.
  13. `end_call`: Gracefully end voice call session.
- **Multi-Tenant Protection:** `executeTool` validates that target `leadId` belongs to `context.companyId`, preventing cross-tenant IDOR tampering.

#### 6. Outbound Telephony Subsystem ([`backend/src/modules/telephony/index.ts`](file:///home/sp3ct0r/employee/backend/src/modules/telephony/index.ts))
- **Core Entities:** `OutboundTelephonyCoordinator`, `AssemblySIPProvider`, `DoNotCallRegistry`.
- **The 10-Step Pre-Call Pipeline:**
  1. *Validate Lead:* Ensure lead exists and is in an eligible state.
  2. *Validate Destination:* Verify E.164 phone formatting; strictly block emergency codes (`911`, `411`, `112`, `999`).
  3. *Validate Calling Authorization:* Check explicit client consent.
  4. *Query Opt-Out Registry:* Check internal Do-Not-Call (DNC) database.
  5. *Check Allowed Calling Window:* Enforce TCPA hours (09:00 to 20:00 destination local time).
  6. *Check Employee Authority:* Evaluate outbound dialing permissions against Policy Engine.
  7. *Verify Required Disclosure:* Mandate AI self-identification disclosure script.
  8. *Reserve Call Credits:* Lock required credits in RevenueCat ledger.
  9. *Create Database Call Record:* Generate call session with status `INITIATED`.
  10. *Dispatch SIP Carrier Call:* Originate call via AssemblyAI SIP Trunk (`sip:sip.assemblyai.com`).

#### 7. RevenueCat Billing & Credit Ledger ([`backend/src/modules/billing/index.ts`](file:///home/sp3ct0r/employee/backend/src/modules/billing/index.ts))
- **Core Entities:** `BillingService`, `CreditLedgerRepository`.
- **Double-Entry Ledger:** Tracks credit balances using immutable transaction types:
  - `PURCHASE`: In-app package acquisition (*Starter*: 100 credits, *Growth*: 500 credits, *Scale*: 2,500 credits).
  - `RESERVATION`: Pre-call hold placed on credits before dialing.
  - `CONSUMPTION`: Actual credits deducted upon call completion based on duration.
  - `RELEASE`: Unused reserved credits restored to available balance.
  - `REFUND`: Post-sale transaction reversal.
  - `ADJUSTMENT`: Manual administrative balance correction.
- **Guarantees:**
  - Strict idempotency key tracking on purchase reconciliation.
  - Server-to-server webhook ingestion for RevenueCat events (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `PRODUCT_CHANGE`).
  - Available balance calculated as `balance - reserved_credits`. Dialing is blocked if available balance < minimum call requirement.

#### 8. Append-Only Audit Subsystem ([`backend/src/modules/audit/index.ts`](file:///home/sp3ct0r/employee/backend/src/modules/audit/index.ts))
- **Core Entity:** `AuditService`.
- **Implementation:** Records immutable audit events for every tool execution, policy decision, meeting change, call session, and billing transaction.
- **Redaction Pipeline:** `sanitizeAuditData()` automatically redacts sensitive fields (`password`, `token`, `secret`, `apiKey`, `creditCard`, `authorization`) to guarantee zero credential leakage.

#### 9. Human Escalation & Approvals ([`backend/src/modules/approvals/index.ts`](file:///home/sp3ct0r/employee/backend/src/modules/approvals/index.ts))
- **Core Entity:** `ApprovalsService`.
- **Implementation:** Manages out-of-bounds requests that require executive human review (e.g. 15% discount, rush 1-week timeline). Generates escalation tickets with a 24-hour expiration window. Once approved or rejected by a human director, resolution is recorded in the audit trail.

---

### Part D: Fastify Routes & Endpoints

| Route File | Path | Method | Description |
|---|---|---|---|
| [`routes/health.ts`](file:///home/sp3ct0r/employee/backend/src/routes/health.ts) | `/health` | `GET` | Service status, version, uptime, and current timestamp |
| [`routes/voice.ts`](file:///home/sp3ct0r/employee/backend/src/routes/voice.ts) | `/api/voice/token` | `GET` | Mints ephemeral single-use session token for voice WebSocket |
| | `/api/voice/config` | `GET` | Returns active system prompt, persona, and 13 tool schemas |
| | `/api/voice/tools/execute` | `POST` | Governed tool execution endpoint with policy enforcement |
| | `/api/voice/ws` | `GET (WS)` | Full-duplex WebSocket proxy to AssemblyAI Voice Agent API |
| | `/voice-tester` | `GET` | Serves interactive browser voice testing console |
| [`routes/company.ts`](file:///home/sp3ct0r/employee/backend/src/routes/company.ts) | `/api/company/brain` | `GET` | Returns full Company Brain (profile, services, FAQs, active policy) |
| | `/api/company/profile` | `PUT` | Updates company profile and contact details |
| | `/api/company/services` | `POST` | Upserts an approved service with pricing and timeline bounds |
| | `/api/company/faqs` | `POST` | Adds an approved canonical FAQ entry |
| | `/api/company/policies` | `POST` | Activates a new versioned governance policy |
| | `/api/company/runtime-context` | `GET` | Returns pre-compiled knowledge context for agent prompt |
| [`routes/leads.ts`](file:///home/sp3ct0r/employee/backend/src/routes/leads.ts) | `/api/leads` | `POST` | Creates a new prospective client lead |
| | `/api/leads` | `GET` | Lists leads with optional stage/company filters |
| | `/api/leads/:id` | `GET` | Retrieves complete lead profile and recorded facts |
| | `/api/leads/:id/facts` | `POST` | Records a conversation fact with provenance and confidence |
| | `/api/leads/:id/qualify` | `POST` | Runs deterministic qualification evaluation |
| | `/api/leads/:id/adaptive-question` | `GET` | Calculates the next single adaptive discovery question |
| | `/api/leads/:id/brief` | `GET` | Generates formatted executive Project Brief in markdown |
| | `/api/leads/:id/memory` | `DELETE` | GDPR Right to be Forgotten: purges all stored facts for lead |
| [`routes/meetings.ts`](file:///home/sp3ct0r/employee/backend/src/routes/meetings.ts) | `/api/meetings/availability` | `GET` | Returns open discovery slots for a specified date range |
| | `/api/meetings` | `POST` | Atomically schedules meeting and synchronizes calendar |
| | `/api/meetings/:id/reschedule` | `POST` | Reschedules meeting with atomic slot validation |
| | `/api/meetings/:id/cancel` | `POST` | Cancels meeting and frees calendar slot |
| [`routes/telephony.ts`](file:///home/sp3ct0r/employee/backend/src/routes/telephony.ts) | `/api/telephony/outbound/initiate` | `POST` | Initiates outbound call through 10-step pre-call pipeline |
| | `/api/telephony/calls/:id/status` | `GET` | Returns live call session status, duration, and metrics |
| | `/api/telephony/calls/:id/end` | `POST` | Terminates active call and reconciles credit usage |
| | `/api/telephony/opt-out` | `POST` | Adds phone number to Do-Not-Call (DNC) registry |
| | `/api/telephony/webhooks/assemblyai` | `POST` | Ingests carrier SIP events with HMAC signature validation |
| [`routes/billing.ts`](file:///home/sp3ct0r/employee/backend/src/routes/billing.ts) | `/api/billing/offerings` | `GET` | Returns catalog of available credit packages |
| | `/api/billing/wallet` | `GET` | Returns wallet balance: `balance`, `reserved`, and `available` |
| | `/api/billing/transactions` | `GET` | Returns immutable double-entry credit ledger history |
| | `/api/billing/purchases/reconcile` | `POST` | Reconciles in-app purchase with strict idempotency |
| | `/api/billing/webhooks` | `POST` | Ingests RevenueCat server-to-server webhook events |
| [`routes/policies.ts`](file:///home/sp3ct0r/employee/backend/src/routes/policies.ts) | `/api/policies/evaluate` | `POST` | Directly evaluates an action against the Policy Engine |
| | `/api/policies/active` | `GET` | Returns active governance policy version and rules |

---

### Part E: Android Mobile Application (HQ)

The Android client is built using **Kotlin**, **Jetpack Compose**, and **Clean Architecture**:

```text
android/app/src/main/java/com/webcraft/employee/
├── MainActivity.kt                  # Single-activity container hosting Navigation Graph
├── WebcraftApp.kt                   # Application entry point initializing repositories
├── presentation/
│   ├── navigation/                  # Type-safe Jetpack Compose navigation destinations
│   ├── dashboard/                   # Executive overview: active leads, call stats, credits
│   ├── companybrain/                # View and edit company profile, services, FAQs, policies
│   ├── leads/                       # Lead list and comprehensive lead detail with brief
│   ├── meetings/                    # Calendar overview and upcoming consultation bookings
│   ├── employee/                    # Employee persona, voice selection, active authority
│   └── settings/                    # Server connection URL and RevenueCat credit purchases
├── domain/
│   ├── model/                       # Immutable domain models
│   ├── repository/                  # Interface contracts for repositories
│   └── usecase/                     # Single-responsibility business use cases
└── data/fake/                       # Offline preview and unit testing repositories
```

#### Key Android Architectural Highlights:
1. **Separation of Concerns:** Business knowledge is never hardcoded into Compose UI. The app renders domain entities (`CompanyBrain`, `Lead`, `Meeting`, `WalletBalance`) fetched from the authoritative backend.
2. **Network Security:** Defined in [`android/app/src/main/res/xml/network_security_config.xml`](file:///home/sp3ct0r/employee/android/app/src/main/res/xml/network_security_config.xml), allowing cleartext communication exclusively with `localhost`, `10.0.2.2`, and `127.0.0.1` for local development while enforcing HTTPS in production.
3. **Reactive UI State:** Every screen uses an MVI/MVVM pattern with immutable `UiState` dataclasses and unidirectional data flow via Kotlin Coroutines and StateFlow.

---

### Part F: Interactive Browser Voice Console

- **File:** [`backend/public/voice-tester.html`](file:///home/sp3ct0r/employee/backend/public/voice-tester.html)
- **Audio Pipeline:**
  - Creates a browser `AudioContext` with standard 16kHz audio constraints.
  - Registers an `AudioWorklet` / `ScriptProcessorNode` to capture raw Float32 microphone data and downsample/convert it to signed 16-bit linear PCM (`Int16Array`).
  - Streams binary PCM frames over WebSocket directly to `/api/voice/ws`.
  - Receives synthesized PCM16 response audio from the Voice Agent and schedules playback via dynamic AudioBufferSource nodes with zero clicks or pops.
- **Visualizer Engine:** Uses HTML5 Canvas and `AnalyserNode` to compute frequency and time-domain data, rendering a fluid 60fps waveform of both user speech and AI responses.

---

## 🧪 7. Test Suite Breakdown & Verification

The project includes **142 automated tests** across **18 test suites** covering unit logic, integration boundaries, security isolation, and full end-to-end workflows.

```bash
cd backend
npm test
```

### Complete Test Catalog:

| # | Test Suite File | Test Count | Key Scenarios Verified |
|---|---|---|---|
| 1 | `test/e2e-workflow.test.ts` | 17 | All 17 end-to-end lifecycle scenarios: standard qualification, insufficient info, unauthorized discounts, legal contracts, rush deadlines, unsupported services, DNC opt-outs, SIP failures, AssemblyAI connection drops, calendar race conditions, duplicate purchases, credit exhaustion, expired approvals |
| 2 | `test/assemblyai-voice-agent.test.ts` | 12 | Token minting, tool registration, tenant isolation in tool execution, turn interruption, session start/end lifecycle |
| 3 | `test/assemblyai-telephony.test.ts` | 11 | 10-step pre-call pipeline, E.164 validation, emergency number blocking (`911`, `999`), TCPA calling hours, credit reservation & rollback |
| 4 | `test/revenuecat-monetization.test.ts` | 10 | Authoritative ledger, double-entry accounting, purchase idempotency, webhook signature verification, balance reservations |
| 5 | `test/policy-engine.test.ts` | 14 | Deterministic tri-state decisions (`ALLOW`, `REQUIRE_APPROVAL`, `BLOCK`), parameter thresholds, unknown action fail-closed |
| 6 | `test/lead-qualification.test.ts` | 9 | Stage transitions, adaptive discovery questions, contradictory fact detection, markdown Project Brief generation |
| 7 | `test/meetings.test.ts` | 8 | Concurrency lock, double-booking prevention, timezone offsets, rollback on calendar provider error |
| 8 | `test/company-brain.test.ts` | 8 | Versioned policy updates (`ACTIVE` → `SUPERSEDED`), service catalog bounds, FAQ retrieval |
| 9 | `test/hq-audit-system.test.ts` | 6 | Append-only immutability, sensitive data sanitization (passwords, tokens, keys) |
| 10 | `test/hq-employee-memory.test.ts` | 6 | 4-tier memory architecture, provenance tracking, GDPR Right to be Forgotten memory purge |
| 11 | `test/hq-employee-runtime.test.ts` | 5 | Dynamic system prompt assembly, persona constraints, policy filtering |
| 12 | `test/errors.test.ts` | 4 | RFC 7807 JSON error serialization, status code mapping |
| 13 | `test/health.test.ts` | 2 | Health check endpoint, uptime, version output |
| 14 | `test/config.test.ts` | 2 | Environment schema validation, default fallbacks |
| 15 | `test/modules.test.ts` | 2 | Architectural boundary enforcement, module decoupling |
| 16 | `test/auth.test.ts` | 8 | JWT issuance, token tampering rejection, protected route authorization, dev-token production blocking |
| 17 | `test/proposals.test.ts` | 9 | Proposal generation from brief, custom pricing human approval guard, lifecycle status transitions |
| 18 | `test/objectives.test.ts` | 9 | Autonomous outbound task generation, stale lead follow-ups, priority queues, human approval triggers |

---

## 🔒 8. Security, Privacy & Compliance Guarantees

HQ Employee is built to meet enterprise security and legal compliance standards:

1. **Zero Secret Leakage:** Client applications (Android APK, browser console) never receive raw provider API keys (`ASSEMBLYAI_API_KEY` or `REVENUECAT_SECRET_KEY`). Clients receive only ephemeral, single-use tokens minted via `GET /api/voice/token`.
2. **Deterministic Governance (Anti-Hallucination):** The LLM is never permitted to determine its own legal, financial, or commitments authority. Every proposed action is routed through the deterministic Policy Engine before execution.
3. **Cross-Tenant IDOR Protection:** All lead modifications, facts, and meetings enforce strict `companyId` ownership checks. Cross-tenant access attempts immediately fail with `403 Forbidden`.
4. **GDPR Right to be Forgotten:** Full memory purge capability is implemented via `DELETE /api/leads/:id/memory`, permanently deleting all conversation facts and provenance logs for that lead.
5. **TCPA & Outbound Calling Compliance:** Telephony calls are restricted to approved calling hours (09:00 - 20:00 local destination time), require recorded calling consent, enforce Do-Not-Call (DNC) opt-outs, and mandate clear AI self-identification disclosure.
6. **Audit Sanitization:** The append-only audit system automatically masks credentials, payment cards, session tokens, and passwords before persisting log entries.

---

## 📄 9. Documentation Index

Detailed architectural and regulatory documentation is maintained in the [`docs/`](file:///home/sp3ct0r/employee/docs) directory:

- 🏆 **[Hackathon Evaluation Guide](docs/JUDGE_ACCESS.md):** Quick-start verification instructions for RevenueCat Shipaton 2026 and AssemblyAI Hackathon judges.
- 📐 **[System Architecture](docs/ARCHITECTURE.md):** In-depth subsystem diagrams, component interfaces, and state machines.
- 🎙️ **[AssemblyAI Integration Spec](docs/assemblyai.md):** Low-level voice WebSocket schemas, audio formats, and telephony configuration.
- 💳 **[RevenueCat Monetization Spec](docs/REVENUECAT.md):** Credit packages, webhook schemas, and ledger reconciliation flows.
- 🛡️ **[Employee Policy Engine](docs/EMPLOYEE_POLICY.md):** Full deterministic rule matrix and escalation protocols.
- 🧠 **[Company Brain & Memory](docs/MEMORY.md):** 4-tier memory architecture and fact provenance specification.
- 📜 **[Terms & AI Boundaries](docs/TERMS.md):** Contractual limits on autonomous AI authority.
- 🔐 **[Privacy & Data Processing](docs/PRIVACY.md):** Voice biometric data handling, GDPR, and TCPA compliance.

---

## ⚖️ 10. License & Attribution

Developed by **Rafal Webcraft** with Antigravity AI.  
Submitted for evaluation to the **RevenueCat Shipaton 2026** and **AssemblyAI Voice Agent Hackathon**.
