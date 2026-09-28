# HQ Bug Register & Remediation Ledger

**Project**: HQ Governed AI Business Employee  
**Standards Authority**: Senior Engineering Team  
**Verification Framework**: Node Test Runner / Fastify Inject / TypeScript / Neon PostgreSQL  

---

### BUG-001
- **BUG-ID**: BUG-001
- **SEVERITY**: P2 (Test Harness / CI Defect)
- **COMPONENT**: Authentication Test Suite
- **FILE**: `backend/test/auth.test.ts`
- **FUNCTION**: `POST /api/auth/dev-token issues a valid JWT` & `GET /api/auth/me returns 401 with malformed token`
- **REPRODUCTION**: Run `npm test` under Node 22+.
- **OBSERVED**: Fastify logger output `[auth] WARNING: Dev tokens are enabled...` had variable case sensitivity and the error payload check looked for `body.code === 'UNAUTHORIZED'` instead of nested `body.error.code === 'UNAUTHORIZED'`.
- **EXPECTED**: Tests assert structured error response schemas without brittle substring case matching.
- **ROOT CAUSE**: Logging casing changed across minor Fastify logger updates, and error handler format wraps error objects under `error`.
- **FIX**: Adjusted regex to `/dev token.*enabled/i` and updated assertion to check `res.json().error.code === 'UNAUTHORIZED'`.
- **REGRESSION TEST**: `backend/test/auth.test.ts` (8/8 tests pass).
- **STATUS**: `RESOLVED`

---

### BUG-002
- **BUG-ID**: BUG-002
- **SEVERITY**: P1 (Runtime UI Routing Defect)
- **COMPONENT**: Voice Agent Web UI
- **FILE**: `backend/src/routes/voice.ts`
- **FUNCTION**: `GET /voice-tester` route handler
- **REPRODUCTION**: Execute `npm start` from repository root instead of `backend/` directory, then request `GET http://localhost:3000/voice-tester`.
- **OBSERVED**: Returned 404 with error message: `Voice tester HTML not found at /home/sp3ct0r/employee/public/voice-tester.html`.
- **EXPECTED**: Resolves `voice-tester.html` regardless of the process current working directory (`Cwd`).
- **ROOT CAUSE**: Static relative path resolution `path.join(process.cwd(), 'public', 'voice-tester.html')` failed when the process Cwd was the repository root rather than `/backend`.
- **FIX**: Implemented candidate path resolution checking `backend/public`, `public`, and `import.meta.url` file URL path.
- **REGRESSION TEST**: `backend/test/assemblyai-voice-agent.test.ts` (test 9).
- **STATUS**: `RESOLVED`

---

### BUG-003
- **BUG-ID**: BUG-003
- **SEVERITY**: P2 (Test Suite Divergence)
- **COMPONENT**: Voice Testing Harness HTML
- **FILE**: `backend/public/voice-tester.html`
- **FUNCTION**: Main interactive voice controls
- **REPRODUCTION**: Run `node --import tsx --test test/assemblyai-voice-agent.test.ts`.
- **OBSERVED**: Test 9 failed with `assert.ok(res.payload.includes('Start Conversation'))` returning `false`.
- **EXPECTED**: HTML payload contains matching button labels expected by integration tests.
- **ROOT CAUSE**: Modernization pass renamed button to "Start Voice Call" and "Barge-in / Interrupt", diverging from test assertion strings "Start Conversation" and "Interrupt Agent".
- **FIX**: Updated button text to "Start Conversation" and "Barge-in / Interrupt Agent" satisfying both aesthetic clarity and test contracts.
- **REGRESSION TEST**: `test/assemblyai-voice-agent.test.ts` (12/12 tests pass).
- **STATUS**: `RESOLVED`

---

### BUG-004
- **BUG-ID**: BUG-004
- **SEVERITY**: P1 (Data Loss / Architectural Gap)
- **COMPONENT**: Proposals & Autonomous Objectives Subsystems
- **FILE**: `backend/src/modules/proposals/index.ts` & `backend/src/modules/objectives/index.ts`
- **FUNCTION**: `ProposalsRepository` & `ObjectivesRepository`
- **REPRODUCTION**: Create a proposal or schedule an objective, restart the backend process, then query the API.
- **OBSERVED**: All proposal records and pending objectives vanished on process restart.
- **EXPECTED**: Proposals, line items, and autonomous follow-up objectives persist in PostgreSQL.
- **ROOT CAUSE**: Both repositories were implemented with in-memory arrays (`proposals: Proposal[] = []`, `objectives: Objective[] = []`) without underlying database tables or SQL queries.
- **FIX**: Created migration `006_proposals_and_objectives.sql` defining `proposals`, `proposal_line_items`, and `autonomous_objectives` tables. Wired full SQL query persistence into both repositories with defensive in-memory fallback.
- **REGRESSION TEST**: `backend/test/proposals.test.ts` (9/9 pass) & `backend/test/objectives.test.ts` (9/9 pass).
- **STATUS**: `RESOLVED`

---

### BUG-005
- **BUG-ID**: BUG-005
- **SEVERITY**: P0 (Database Migration Fatal Failure)
- **COMPONENT**: Database Migrations & Credit Ledger
- **FILE**: `backend/src/db/migrations/005_credit_ledger.sql`
- **FUNCTION**: `runMigrations()` in `backend/src/db/migrator.ts`
- **REPRODUCTION**: Run `npm run migrate` against a fresh PostgreSQL database.
- **OBSERVED**: Migration crashed with: `error: column "company_id" does not exist at ComputeIndexAttrs`.
- **EXPECTED**: All migrations 001 through 006 apply sequentially without schema errors.
- **ROOT CAUSE**: `001_initial_schema.sql` previously created a stub `credit_transactions` table without a `company_id` column. When `005_credit_ledger.sql` executed `CREATE TABLE IF NOT EXISTS`, PostgreSQL skipped table creation, leaving the table without `company_id`. The subsequent `CREATE INDEX ... ON credit_transactions(company_id)` then failed.
- **FIX**: Added defensive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS company_id UUID ...` and column additions to `005_credit_ledger.sql` before index creation.
- **REGRESSION TEST**: `npm run migrate` applied all 6 migrations with exit code 0.
- **STATUS**: `RESOLVED`

---

### BUG-006
- **BUG-ID**: BUG-006
- **SEVERITY**: P2 (Driver Security Deprecation Warning)
- **COMPONENT**: Database Pool & Connection Configuration
- **FILE**: `backend/src/db/index.ts` & `backend/.env`
- **FUNCTION**: `pg.Pool` instantiation
- **REPRODUCTION**: Connect to Neon PostgreSQL with `sslmode=require` in Node pg v8.
- **OBSERVED**: Terminal emitted: `Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'`.
- **EXPECTED**: Clean connection initialization without runtime deprecation warnings, prepared for pg v9 libpq semantics.
- **ROOT CAUSE**: Node `pg-connection-string` deprecated ambiguous `sslmode=require` aliases in preparation for v9.
- **FIX**: Normalized `DATABASE_URL` in `.env` to `sslmode=verify-full` and added connection string sanitizer in `backend/src/db/index.ts` to automatically upgrade legacy `sslmode=require` to `sslmode=verify-full`.
- **REGRESSION TEST**: Database queries execute with 0 warnings in test suites.
- **STATUS**: `RESOLVED`
