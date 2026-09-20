# Webcraft Employee — Security Specification

## 1. Security Philosophy

The AI model is an untrusted decision-support component operating within a strictly governed security boundary. The backend server is the sole authoritative boundary for all security, authentication, authorization, and financial operations.

```text
[ Client / Untrusted Voice ]
            │
            ▼
[ Backend Security Boundary ]
  ├── 1. Request Authentication & Origin Validation
  ├── 2. Input & Schema Sanitization
  ├── 3. Policy Engine Evaluation (ALLOW / REQUIRE_APPROVAL / BLOCK)
  ├── 4. Entitlement & Credit Authorization
  └── 5. Audited Service Execution
            │
            ▼
[ Authoritative Store & External Providers ]
```

---

## 2. Secrets Management

### Secret Classification
1. **AssemblyAI API Key**: Kept exclusively server-side.
   - For web/mobile voice sessions, the server mints short-lived temporary tokens (`GET /v3/token` or `GET /v1/token` with 60–300s expiry).
   - Secret API keys are never embedded in the Android APK, bundle, or client repository.
2. **RevenueCat Secret Key**: Kept server-side to verify webhook events and validate receipt integrity.
3. **Database Credentials**: Injected via container environment variables (`DATABASE_URL`).
4. **Telephony Credentials**: Managed server-side via environment configuration.

### Prohibition Against Client Secrets
The Android client must NEVER contain:
- Hardcoded API tokens or secret keys.
- Direct database connection strings.
- Privileged admin endpoints.

---

## 3. AI Authority & Database Isolation

### The Anti-Pattern: LLM to SQL
Under no circumstances shall the application expose direct database execution tools to the AI model:
- `INCORRECT`: `LLM → execute_sql("UPDATE leads SET ...")`
- `CORRECT`: `LLM → record_requirement(data) → Schema Validation → Policy Check → Backend Service → Parameterized SQL Query`

### Tool Security Principles
1. **Narrow Scope**: Each tool accomplishes one discrete business action.
2. **Schema Validation**: Arguments are strictly parsed and validated with Zod/JSON Schema before execution.
3. **Audit Trail**: Every tool call records caller, timestamp, argument hash, and policy evaluation result.

---

## 4. Policy Engine Gate

The Policy Engine acts as an inline firewall for tool invocation. Every sensitive action evaluates to one of:
- `ALLOW`: The action complies with active policy and executes immediately.
- `REQUIRE_APPROVAL`: The action is queued in the `approvals` table with status `REQUESTED`. A notification is sent to the human operator.
- `BLOCK`: The action is immediately rejected, logged to `audit_events`, and a safe refusal message is returned to the voice session.

---

## 5. Audit Logging

Every critical business event is recorded immutably in `audit_events`:
- Event ID (UUID)
- Timestamp (UTC)
- Actor ID & Actor Type (`SYSTEM`, `EMPLOYEE`, `HUMAN_ADMIN`)
- Action (`TOOL_CALL`, `POLICY_EVALUATION`, `CREDIT_TRANSACTION`, `APPROVAL_DECISION`)
- Target Entity (`LEAD`, `MEETING`, `POLICY`, `CREDIT_WALLET`)
- Metadata (Sanitized JSON payload without credentials or raw PII)
