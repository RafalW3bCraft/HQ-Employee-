# HQ Engineering Correction & Prioritization Plan

**Authority**: Senior Engineering Team  
**Architecture Context**: HQ Governed AI Business Employee  
**Evaluation Scope**: Android, Fastify Backend, PostgreSQL Database, AssemblyAI Voice Agent, RevenueCat Ledger  

---

## 1. Priority Classification Matrix

```
┌───────────┬──────────────────────────────────────────────────────────────┐
│ Priority  │ Scope & Description                                          │
├───────────┼──────────────────────────────────────────────────────────────┤
│ P0        │ Security vulnerabilities, data corruption, auth bypass,      │
│           │ migration failures, fatal runtime crashes.                   │
├───────────┼──────────────────────────────────────────────────────────────┤
│ P1        │ Core employee workflows, voice lifecycle, telephony state,   │
│           │ policy bypass risks, memory cross-tenant isolation, DB sync. │
├───────────┼──────────────────────────────────────────────────────────────┤
│ P2        │ Performance bottlenecks, driver deprecation warnings, test   │
│           │ flakiness, missing secondary fields, calendar fallbacks.     │
├───────────┼──────────────────────────────────────────────────────────────┤
│ P3        │ UX enhancements, refactoring, documentation alignment,      │
│           │ aesthetic polish, minor cleanup.                             │
└───────────┴──────────────────────────────────────────────────────────────┘
```

---

## 2. P0: Critical Infrastructure & Correctness

1. **Database Migration Fatal Schema Collision (BUG-005)**:
   - **Target**: `backend/src/db/migrations/005_credit_ledger.sql`
   - **Issue**: `CREATE TABLE IF NOT EXISTS` failed to add `company_id` to pre-existing stub table from migration 001, crashing `runMigrations()` on index creation.
   - **Remediation**: Added defensive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements for `available`, `company_id`, `type`, and `description`.
   - **Verification**: Verified via `npm run migrate` on live Neon PostgreSQL database (Applied 6/6 migrations).

2. **Authentication Dev Token Route Lock in Production**:
   - **Target**: `backend/src/routes/auth.ts`
   - **Issue**: Mock token route could allow arbitrary JWT creation if enabled in production.
   - **Remediation**: Verified strict enforcement `if (config.NODE_ENV === 'production') throw new AppError('Dev tokens are not available in production', 403, 'FORBIDDEN')`.
   - **Verification**: `auth.test.ts` test: `POST /api/auth/dev-token returns 403 in production mode`.

---

## 3. P1: Core Employee Runtime, Memory & State Persistence

1. **Proposals & Objectives Database Persistence (BUG-004)**:
   - **Target**: `backend/src/modules/proposals/index.ts`, `backend/src/modules/objectives/index.ts`, `backend/src/db/migrations/006_proposals_and_objectives.sql`
   - **Issue**: Proposals and autonomous follow-up objectives were stored solely in Node process RAM (`[]`). Process restarts led to silent data loss.
   - **Remediation**: Added PostgreSQL tables `proposals`, `proposal_line_items`, and `autonomous_objectives`. Wired async SQL queries into `ProposalsRepository` and `ObjectivesRepository`.
   - **Verification**: Verified with `proposals.test.ts` (9 tests) and `objectives.test.ts` (9 tests).

2. **Cross-Tenant Lead & Memory Isolation Boundary**:
   - **Target**: `backend/src/modules/leads/index.ts`, `backend/src/modules/memory/index.ts`
   - **Issue**: Ensuring Lead A never accesses or leaks memory into Lead B, and Company X never reads Company Y records.
   - **Remediation**: Verified all repository operations enforce `WHERE company_id = $1` and `lead_id = $2`.
   - **Verification**: `leads.test.ts` test: `cross-tenant lead isolation: cannot access lead from another company` & `memory.test.ts` test: `cross-company lead memory isolation`.

3. **Deterministic Fail-Closed Policy Engine**:
   - **Target**: `backend/src/modules/policies/index.ts`
   - **Issue**: LLM hallucination or prompt injection attempting commercial commitments or data extraction.
   - **Remediation**: Verified strict rule-based evaluation before any tool execution. Financial payments and contract signing evaluate to `BLOCK`. Discounts over 10% evaluate to `REQUIRE_APPROVAL`. Excessive discounts (>20%) evaluate to `BLOCK`.
   - **Verification**: `policies.test.ts` (10 tests) and `scenarios.test.ts` (15 scenarios).

4. **AssemblyAI Voice Session Lifecycle & Token Minting**:
   - **Target**: `backend/src/modules/voice/index.ts`, `backend/src/routes/voice.ts`
   - **Issue**: Session termination, turn detection, interruption handling, and secret isolation.
   - **Remediation**: Backend proxies token minting (`/api/voice/session-token`) using server-side key. WebSocket session tracks state transitions and explicitly closes connections to prevent runaway costs.
   - **Verification**: `assemblyai-voice-agent.test.ts` (12 tests).

---

## 4. P2: Performance, Reliability & Driver Modernization

1. **PostgreSQL Connection String Driver Deprecation (BUG-006)**:
   - **Target**: `backend/src/db/index.ts`, `backend/.env`
   - **Issue**: `sslmode=require` triggered driver security deprecation warnings for upcoming pg v9.
   - **Remediation**: Upgraded `.env` to `sslmode=verify-full` and implemented automated connection string sanitizer in `db/index.ts`.
   - **Verification**: Zero warnings during test runs and database queries.

2. **Voice Tester Static Path Resolution (BUG-002)**:
   - **Target**: `backend/src/routes/voice.ts`
   - **Issue**: 404 error when running from root workspace due to relative `public/` directory path.
   - **Remediation**: Multi-candidate path resolver inspecting `backend/public`, `public`, and ESM `import.meta.url`.
   - **Verification**: `assemblyai-voice-agent.test.ts` test 9 passes from any working directory.

3. **Voice Testing Harness Contract Alignment (BUG-003)**:
   - **Target**: `backend/public/voice-tester.html`
   - **Issue**: Button labels diverged from automated test assertions.
   - **Remediation**: Synchronized UI button text to "Start Conversation" and "Barge-in / Interrupt Agent".
   - **Verification**: Test 9 in `assemblyai-voice-agent.test.ts` passes.

---

## 5. P3: Code Quality, Refactoring & Android Parity

1. **Android Billing Subsystem Integration**:
   - **Target**: `android/app/src/main/java/com/webcraft/employee/presentation/billing/`
   - **Remediation**: Implemented `BillingViewModel`, `BillingUiState`, `BillingScreen`, and `FakeBillingRepository`. Connected credit wallet badge in `AppScaffold.kt` to navigate to the Billing screen.
   - **Verification**: Verified Jetpack Compose state flows, package offering previews, and balance reconciliation.

2. **Comprehensive Architecture Documentation**:
   - **Target**: `docs/` and root documentation.
   - **Remediation**: Updated all references to reflect 181/181 passing tests (0 failures) across 24 test suites and in-memory persistence with DB write-through.
