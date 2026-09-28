# HQ-Employee — AI Development Rules

## 1. Mission

Build HQ-Employee: a governed AI business employee for Rafal Webcraft.

The employee communicates with leads using real-time voice AI, qualifies opportunities, discusses only authorized company information, schedules meetings, records structured project information, and escalates decisions outside its authority to a human.

The product must behave as a controlled business system, not as an unrestricted autonomous agent.

---

## 2. Primary Product

Employee name:

HQ-Employee

Role:

AI Sales & Client Coordination Employee

Primary responsibilities:

- Engage prospective clients.
- Understand project requirements.
- Qualify leads.
- Explain approved services.
- Discuss approved budget guidance.
- Discuss approved timeline guidance.
- Schedule meetings.
- Reschedule meetings.
- Maintain structured lead memory.
- Produce project briefs.
- Escalate unauthorized or uncertain decisions.

---

## 3. Non-Negotiable Architecture Rules

### Rule 1 — Backend authority

The Android application is never authoritative for:

- credits
- permissions
- employee policies
- pricing
- meeting ownership
- lead ownership
- call authorization
- security decisions

The backend is authoritative.

### Rule 2 — No secrets in Android

Never place:

- AssemblyAI API keys
- RevenueCat secret keys
- database credentials
- telephony credentials
- backend secrets

inside the APK.

### Rule 3 — AI cannot directly access the database

Never implement:

LLM → SQL

Always use:

LLM → validated tool → authorization → business logic → database

### Rule 4 — AI cannot bypass policy

Every sensitive action must pass through the policy/authority layer.

### Rule 5 — Human approval is a first-class state

Do not simulate human approval as an automatic action.

Use explicit states:

REQUESTED
APPROVED
REJECTED
EXPIRED

### Rule 6 — Never invent company information

The employee must not invent:

- prices
- discounts
- timelines
- services
- guarantees
- customer references
- technical capabilities
- legal commitments

If information is unavailable:

"I don't have an approved answer for that. I can arrange for a member of our team to follow up."

### Rule 7 — AssemblyAI first

Use AssemblyAI Voice Agent API as the primary real-time voice engine.

Do not introduce a second STT/LLM/TTS stack unless a documented product requirement requires it.

### Rule 8 — Telephony abstraction

Business logic must depend on a TelephonyProvider abstraction.

Preferred provider:

AssemblyAI-compatible SIP/telephony path.

CALL-E must not be introduced unless AssemblyAI cannot satisfy a demonstrated requirement.

### Rule 9 — Current documentation

Before implementing AssemblyAI functionality, consult the current AssemblyAI documentation.

Do not rely on remembered API parameters.

### Rule 10 — Small changes

Do not rewrite the repository unnecessarily.

Every implementation task must:

1. Inspect existing code.
2. Identify affected files.
3. Implement the smallest correct change.
4. Compile.
5. Run relevant tests.
6. Report failures.
7. Stop if architecture needs a decision.

---

## 4. Employee Safety Rules

The employee must never:

- impersonate a human.
- make unauthorized legal commitments.
- sign contracts.
- accept contracts.
- make financial transfers.
- request passwords.
- request PINs.
- request authentication secrets.
- handle OTPs as a business action.
- invent pricing.
- invent deadlines.
- provide unauthorized discounts.
- promise guaranteed outcomes.
- expose confidential company information.
- fabricate previous conversations.
- fabricate customer information.

The employee must escalate when:

- the requested action exceeds authority.
- the employee lacks reliable information.
- the lead requests contract negotiation.
- the lead requests unauthorized pricing.
- the lead requests legal commitments.
- the lead requests confidential information.
- the lead disputes a material business fact.
- the employee cannot safely continue.

---

## 5. Calling Rules

Outbound calling must pass a compliance gate before dialing.

Required checks:

- destination exists
- destination is authorized
- call purpose exists
- calling policy permits the call
- opt-out status permits the call
- applicable calling-hour policy permits the call
- required disclosure is configured
- user/company authorization exists

Never create unrestricted bulk-calling functionality in the MVP.

The employee must respect requests to stop contacting the person.

---

## 6. Memory Rules

Use structured memory.

Company memory:

- company profile
- services
- pricing guidance
- timeline guidance
- FAQs
- policies
- authority rules

Lead memory:

- identity
- company
- project
- requirements
- budget
- timeline
- decision role
- urgency
- previous interactions
- meetings
- next actions

Interaction memory:

- current objective
- facts collected
- tool calls
- decisions
- outcome
- next action

Do not treat raw transcripts as the only source of truth.

---

## 7. Policy Versioning

Every call must record the employee policy version used.

Every sensitive decision should be traceable to:

- policy version
- employee ID
- lead ID
- call ID
- tool action
- timestamp

---

## 8. Tool Rules

Tools must be:

- narrowly scoped
- schema validated
- authorization checked
- idempotent where possible
- auditable

Do not create a generic:

execute_anything()

tool.

Prefer explicit tools such as:

- get_service_details
- get_pricing_guidance
- get_timeline_guidance
- create_lead
- update_lead
- record_requirement
- record_budget
- record_timeline
- check_calendar
- schedule_meeting
- reschedule_meeting
- cancel_meeting
- request_human_approval
- create_followup
- end_call

---

## 9. Billing Rules

RevenueCat handles store purchase processing.

The backend owns the credit ledger.

Never use RevenueCat entitlements as the authoritative call-credit balance.

Credit operations must be immutable transactions.

Supported transaction types:

- PURCHASE
- RESERVATION
- CONSUMPTION
- RELEASE
- REFUND
- ADJUSTMENT

Purchase processing must be idempotent.

---

## 10. Testing Rules

Every meaningful feature requires tests.

Minimum:

- unit tests
- integration tests
- authorization tests
- policy tests
- failure-path tests

Sensitive actions require explicit negative tests.

Examples:

- unauthorized discount must fail
- contract action must fail
- missing price must not invent price
- insufficient credits must block call
- opt-out lead must not be called
- expired approval must not execute
- duplicate purchase event must not duplicate credits

---

## 11. Debugging Rules

When debugging:

1. Reproduce.
2. Capture exact error.
3. Identify layer.
4. Trace request/state transition.
5. Fix root cause.
6. Add regression test.
7. Re-run relevant tests.

Do not hide errors with broad exception handling.

Do not silence compiler warnings without understanding them.

Do not replace working architecture merely to make a test pass.

---

## 12. Definition of Done

A feature is not complete until:

- implementation exists
- compilation succeeds
- relevant tests pass
- error paths are handled
- security implications are reviewed
- UI state is correct
- logs are appropriate
- no secrets are exposed
- documentation is updated

---

## 13. AI Agent Working Protocol

Before coding:

READ.

Then:

PLAN.

Then:

IMPLEMENT.

Then:

TEST.

Then:

AUDIT.

Then:

REPORT.

Never start by blindly generating large amounts of code.

If requirements conflict, stop and identify the conflict instead of silently choosing.

If an external API is unclear, consult current official documentation.

If a requested feature conflicts with a security or policy rule, preserve the security rule.

---

## 14. Priority Order

When trade-offs occur, prioritize:

1. Correctness
2. Security
3. Policy enforcement
4. Reliability
5. User experience
6. Performance
7. Feature breadth

A smaller reliable feature is preferable to a larger unreliable feature.

---

## 15. Hackathon Principle

The hackathon MVP must demonstrate a complete working loop:

Voice
→ understanding
→ policy
→ tool
→ business action
→ structured result

Do not spend the majority of development time on secondary features before this loop works.