# HQ Autonomous Decision-Making & Human-in-the-Loop Limits

**Project**: HQ Governed AI Business Employee  
**Evaluation Scope**: Autonomous Decision Engine, Objective Evaluation, Proactive Action Cycle  
**Audit Standard**: Section 10 (Autonomy Debugging) & Section 11 (State Machine Validation)  

---

## 1. The Autonomy Paradigm: Governed Proactivity

HQ does not rely on a human operator to manually prompt every action, nor does it grant the AI model unrestricted agency. Instead, it operates on a **Governed Proactive Objective Cycle**:

```
[ Lead State / Time Delta ]
             │
             ▼
    [ ObjectiveEngine ] ──> Evaluates pending objectives (stale leads, reminders)
             │
             ▼
      [ Objective ]     ──> What is the objective? What missing information exists?
             │
             ▼
    [ Decision Planner ] ──> Suggests tool & parameters (e.g., follow_up_call, send_proposal)
             │
             ▼
    [ PolicyEngine Boundary ]
      ├── ALLOW            ──> Executes tool autonomously
      ├── REQUIRE_APPROVAL ──> Halts execution, generates director approval request
      └── BLOCK            ──> Aborts action, logs reason, skips objective
```

---

## 2. Autonomous Capabilities Matrix

| Autonomous Capability | Decision Mechanism | Policy Boundary | Human-in-the-Loop Limit |
|---|---|---|---|
| **Stale Lead Follow-Up** | Generates `FOLLOW_UP_STALE_LEAD` when lead has been inactive > 48h. | `ALLOW` for outreach email; `REQUIRE_APPROVAL` for telephony call. | Operator can review queued call in Android client. |
| **Proposal Reminder** | Generates `PROPOSAL_REMINDER` when proposal is viewed but unanswered > 72h. | `ALLOW` for standard reminder notification. | None required if within standard cadence. |
| **Meeting Scheduling** | Proposes open slots within business hours and books upon client agreement. | `ALLOW` for standard future slots; `BLOCK` for past or conflict slots. | Zero double-booking; calendar confirmation sent immediately. |
| **Re-Engaging Lost Leads** | Generates `RE_ENGAGE_LOST_LEAD` when cold prospect shows new activity. | **REQUIRE_APPROVAL** | Requires human director sign-off before contact is re-established. |
| **Commercial Discounting** | Negotiates standard tier pricing. | **REQUIRE_APPROVAL** for 10%–20%; **BLOCK** for >20%. | AI cannot commit to unauthorized discounts. Escalates with proposed compromise. |
| **Contract Acceptance** | Reviews project brief requirements. | **STRICT BLOCK** | AI cannot sign contracts or execute legal agreements. Director must sign. |
| **Financial Transfers** | Evaluates payment inquiries. | **STRICT BLOCK** | AI cannot disburse funds, execute refunds directly, or alter bank routes. |

---

## 3. Objective Lifecycle & Resilience

Objectives follow a deterministic state machine:

```
           ┌──────────────┐
           │   PENDING    │
           └──────┬───────┘
                  │ (Worker / Trigger)
                  ▼
           ┌──────────────┐
           │ IN_PROGRESS  │
           └──┬────────┬──┘
              │        │
   (Success)  ▼        ▼  (Max attempts reached)
  ┌─────────────┐   ┌────────────┐
  │  COMPLETED  │   │   FAILED   │
  └─────────────┘   └────────────┘
         ▲                 ▲
         │ (Auto-Expired)  │
  ┌─────────────┐          │
  │   SKIPPED   │──────────┘
  └─────────────┘
```

1. **Attempt Capping**: Each objective has a `maxAttempts` parameter (default: 3). If an attempt fails (e.g., network error or busy carrier), `attemptCount` increments and the objective is retried with backoff.
2. **Auto-Expiration**: Objectives have an `expiresAt` deadline. The engine automatically sweeps overdue objectives into `SKIPPED` status via `expireOverdue()`, preventing stale outreach weeks after the fact.
3. **Database Persistence**: Backed by PostgreSQL `autonomous_objectives` table (Migration 006), ensuring scheduled objectives survive server restarts and scaling events.

---

## 4. Architectural Boundaries: What the Model CANNOT Do

Under no circumstance can the AI model:
- Access raw database connection pools (`pg.Pool`).
- Spawn child processes or execute shell commands.
- Make arbitrary HTTP network requests outside validated providers.
- Authorize financial refunds or modify client invoices.
- Delete audit logs or alter the cryptographic hash chain.
- Read or leak another tenant's lead or company data.

Every model action is bounded by the strict **Policy Engine -> Tool -> Verification -> State Update** loop.
