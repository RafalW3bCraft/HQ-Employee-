# Webcraft Employee Architecture

## High-Level Architecture

```text
Android App
     |
     | HTTPS
     v
Webcraft API
     |
     +-----------------------+
     |                       |
     v                       v
Company Brain           Lead Memory
     |                       |
     +-----------+-----------+
                 |
                 v
          Policy Engine
                 |
                 v
       AI Employee Runtime
                 |
                 v
        AssemblyAI Voice Agent
                 |
          +------+------+
          |             |
          v             v
       Browser       Telephony
                         |
                         v
                       Lead
```

---

# Architectural Principle

The LLM is a decision-making component.

It is not the security boundary.

The backend is the security and authorization boundary.

---

# Request Flow

```text
Voice
 ↓
AssemblyAI
 ↓
AI employee
 ↓
Tool request
 ↓
Schema validation
 ↓
Policy validation
 ↓
Authorization
 ↓
Business service
 ↓
Database/integration
 ↓
Tool result
 ↓
AssemblyAI
 ↓
Voice response
```

---

# Tool Execution

Every tool request must contain:

- tool name
- validated arguments
- employee identity
- lead identity
- conversation identity
- policy version

Sensitive tools require policy evaluation.

---

# Company Brain

Company knowledge should be represented as structured records.

Avoid embedding all company information permanently into one prompt.

The runtime should construct contextual instructions from:

- company profile
- relevant service
- relevant pricing guidance
- relevant timeline guidance
- employee role
- current policy
- lead context

---

# Memory

Memory consists of:

1. Company memory
2. Employee memory
3. Lead memory
4. Interaction memory

Memory retrieval must be scoped to the current employee and company.

---

# Policy Engine

The policy engine returns:

```text
ALLOW
REQUIRE_APPROVAL
BLOCK
```

No tool capable of sensitive business action should bypass this layer.

---

# Approval

Approval is asynchronous.

```text
REQUESTED
   |
   +--> APPROVED
   |
   +--> REJECTED
   |
   +--> EXPIRED
```

Approval requests must identify:

- requested action
- requested arguments
- lead
- employee
- reason
- policy version
- expiration
- approver

---

# Telephony

Business logic depends on:

```text
interface TelephonyProvider
```

Implementations:

```text
AssemblySIPProvider
MockTelephonyProvider
```

Future:

```text
CallEProvider
```

Do not couple lead qualification logic directly to a specific telephony provider.

---

# Billing

RevenueCat processes purchases.

Backend processes purchase events.

Backend maintains:

```text
credit_wallet
credit_transactions
```

Calls reserve credits before execution.

Unused reservations are released.

Actual usage is consumed.

---

# Reliability

Important operations must be idempotent:

- purchase processing
- meeting creation
- call creation
- webhook processing
- credit reservation
- credit consumption

Use idempotency keys.

---

# Observability

Every production workflow should expose:

- request ID
- correlation ID
- employee ID
- lead ID
- call ID
- conversation ID
- policy version

Never log secrets.

Avoid logging full sensitive transcripts.

---

# Failure Strategy

If AssemblyAI fails:

- mark conversation failure
- preserve structured state
- allow retry when safe
- do not duplicate business actions

If telephony fails:

- mark call failed
- release reserved credits where appropriate
- create retryable follow-up

If calendar fails:

- do not claim meeting was booked
- tell the user/lead honestly
- preserve requested time

If policy engine fails:

- fail closed for sensitive actions