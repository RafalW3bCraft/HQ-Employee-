# HQ — Governed Autonomous Company Operating Agent

## 1. Executive Summary & Vision

The objective of HQ is to be a **Governed Autonomous Company Operating Agent**.

Rather than an isolated voice assistant that only responds when prompted, HQ is an autonomous business execution platform. The company owner/operator configures the company context, market, audience, operating hours, pricing bounds, discount limits, approval thresholds, employee responsibilities, and calendar rules. Inside that deterministic authority envelope, HQ operates continuously and autonomously across the business day.

```text
                  +----------------------------------------------+
                  |         COMPANY OWNER / OPERATOR             |
                  |  - Industry & Market Configuration           |
                  |  - Commercial & Pricing Boundaries           |
                  |  - Campaigns, Audiences & Outbound Limits     |
                  |  - Operating Hours & Timezone Rules          |
                  |  - Emergency Stop & Human Approvals          |
                  +----------------------------------------------+
                                         |
                                         v
                  +----------------------------------------------+
                  |         DETERMINISTIC POLICY ENGINE          |
                  |         Fail-Closed Security Boundary        |
                  |       [ ALLOW | REQUIRE_APPROVAL | BLOCK ]   |
                  +----------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                         AUTONOMOUS OPERATING AGENT                              |
|                                                                                 |
|  +--------------------+   +---------------------+   +------------------------+  |
|  |   SCHEDULER /      |   |   OBJECTIVE         |   |    AUTONOMOUS          |  |
|  |   WORKER QUEUE     |-->|   ENGINE            |-->|    DECISION LOOP       |  |
|  |   Persistent Jobs  |   |   Priority Matrix   |   |    Plan -> Action      |  |
|  +--------------------+   +---------------------+   +------------------------+  |
|            ^                                                    |               |
|            |                                                    v               |
|  +--------------------+   +---------------------+   +------------------------+  |
|  |   OBSERVATION &    |   |   STRUCTURED MEMORY |   |    AUTHORIZED TOOLS    |  |
|  |   FEEDBACK LOOP    |<--|   Company Brain &   |<--|    Voice, Calendar,    |  |
|  |   Audit Trail      |   |   Interaction State |   |    CRM, Proposals      |  |
|  +--------------------+   +---------------------+   +------------------------+  |
+---------------------------------------------------------------------------------+
```

---

## 2. Company Operating Configuration

The Company Operating Configuration establishes the total boundary within which digital employees function.

### A. Company Profile
- `companyProfile`: Legal and brand identity, website, value proposition, positioning statement.
- `industryProfile`: Industry classification (`saas`, `custom_software`, `consulting`, `healthcare_tech`), sub-industry, geography, and target customer profile.
- `businessSchedule`: Company timezone (IANA), standard business hours per day of week, holidays, and non-working windows.

### B. Employee Definition
- `role`: Role title (e.g. *Business Development & Client Coordination*, *Account Executive*, *Marketing Operations*).
- `name`: Assigned identity (e.g. *HQ Employee*).
- `responsibilities`: Explicit task envelope (e.g. discovery, qualification, meeting booking, follow-ups).
- `communicationStyle`: Tone, concise professional demeanor, mandatory AI disclosure statements.
- `allowedTools`: Explicit whitelist of tool names authorized for this role.
- `prohibitedActions`: Inviolable boundaries (e.g. contract signing, payment collection, credential handling).

### C. Outreach & Telephony Parameters
- `channels`: Authorized channels (`voice_inbound`, `voice_outbound`, `calendar`, `email_followup`).
- `callingHours`: Permitted calling window in contact's local timezone (e.g. 09:00–17:00).
- `dailyLimits`: Maximum calls/day (e.g. 30), maximum contacts/day, maximum concurrent calls.
- `cadence`: Follow-up spacing rules (e.g. 2 business days after voicemail, 4 business days after proposal).
- `compliance`: Mandatory opt-out handling, Do-Not-Call (DNC) list checking, call recording notices.

### D. Commercial & Pricing Authority
- `standardPricing`: Approved price book from Company Brain.
- `autonomousDiscountLimit`: Maximum discount percentage the employee may grant autonomously (e.g. `5%`).
- `escalationThreshold`: Discount percentage requiring human director approval (e.g. `> 5% and <= 20%`).
- `blockThreshold`: Hard ceiling immediately blocked by deterministic policy (e.g. `> 20%`).
- `contractSigning`: `BLOCK` — strictly reserved for human legal/executive officers.
- `financialTransfers`: `BLOCK` — AI never initiates balance disbursements or credential requests.

---

## 3. Industry → Operating Profile

Selecting an industry immediately loads a structured, audited operating template into Company Brain rather than letting the LLM invent sales guidelines:

```text
SELECT INDUSTRY (e.g. "b2b_saas")
        ↓
LOAD INDUSTRY PROFILE
        ↓
LOAD RELEVANT SERVICES (e.g. Platform Subscription, Enterprise Onboarding)
        ↓
LOAD TARGET CUSTOMER PROFILE (e.g. VP Engineering, CTO, Product Operations)
        ↓
LOAD APPROVED SALES QUESTIONS (e.g. Tech stack, active user count, SLA needs)
        ↓
LOAD APPROVED QUALIFICATION RULES (e.g. Min budget $15k/yr, timeline < 6 mos)
        ↓
LOAD APPROVED CAMPAIGN TEMPLATES (e.g. Modernization Outreach, Inbound Follow-up)
        ↓
LOAD COMPLIANCE RULES (e.g. Data residency disclosures, SOC2/GDPR statements)
        ↓
EMPLOYEE READY
```

### Pre-Configured Industry Profiles
1. **B2B SaaS (`b2b_saas`):** Focuses on recurring seat licenses, cloud infrastructure, API integrations, and security questionnaires.
2. **Custom Software & Cloud Development (`software_dev`):** Focuses on scope, delivery timeline (minimum 2 weeks), technical stack, and milestone-based pricing.
3. **Professional Consulting (`consulting`):** Focuses on discovery diagnostics, executive sponsorship, hourly/retainer pricing, and deliverables.
4. **Healthcare Technology (`healthcare_tech`):** Focuses on HIPAA/GDPR compliance, clinical workflows, and zero-PII transmission boundaries.

---

## 4. Autonomous Operating Loop

The Autonomous Operating Loop drives proactive work without waiting for manual human prompts:

```text
[EVENT / SCHEDULE / WEBHOOK]
              ↓
[WAKE SCHEDULER & LOAD RELEVANT CONTEXT]
              ↓
[OBJECTIVE ENGINE: GENERATE & RANK PENDING OBJECTIVES]
              ↓
[SELECT HIGHEST-PRIORITY ELIGIBLE OBJECTIVE]
              ↓
[CHECK EMERGENCY STOP & COMPANY BUSINESS HOURS]
              ↓
[PROPOSE NEXT ACTION]
              ↓
[DETERMINISTIC POLICY ENGINE EVALUATION]
      ├── BLOCK ────────────> Log audit event & mark objective SKIPPED/FAILED
      ├── REQUIRE_APPROVAL ─> Create Human Approval Ticket & pause branch
      └── ALLOW ────────────> Proceed to Execution
              ↓
[EXECUTE AUTHORIZED TOOL / ACTION]
              ↓
[OBSERVE RESULT & RECORD FACT IN STRUCTURED MEMORY]
              ↓
[TRANSITION SALES PIPELINE STATE & SCHEDULE NEXT ACTION]
              ↓
[CYCLE TO NEXT OBJECTIVE OR SLEEP]
```

### Wake Triggers
- **Schedule:** Scheduled cron trigger, daily business hours start, follow-up timers.
- **Lead Events:** Inbound website lead created, prospect replied, contact requested call.
- **Voice Events:** Completed call, missed call, voicemail detected, speech interruption.
- **Calendar Events:** Upcoming consultation in 15 minutes, meeting concluded.
- **Proposal Events:** Proposal created, proposal viewed by prospect, proposal accepted.
- **Human Approval Events:** Director approved 15% discount, director rejected custom terms.
- **External Webhooks:** CRM update, RevenueCat purchase event, payment completed.

---

## 5. Scheduler & Worker Infrastructure

To survive system restarts and prevent duplicate operations, the scheduler implements:

1. **Persistent State in PostgreSQL:** All jobs and autonomous objectives are persisted in `autonomous_objectives` and `scheduler_jobs` tables.
2. **Idempotency Keys:** Every scheduled action incorporates a deterministic idempotency key (`${companyId}_${actionType}_${targetId}_${dateWindow}`). Duplicate triggers return the existing job.
3. **Exponential Backoff with Jitter:** Failed attempts increment `attempt_count` with randomized exponential backoff up to `max_attempts`.
4. **Business Hours & Timezone Gate:** Jobs scheduled during non-business hours or holidays are automatically shifted forward to the next business opening window.
5. **Concurrency Limits:** Enforces maximum simultaneous calls (e.g. 1 outbound call per tenant at a time) to prevent carrier throttling or budget overrun.

---

## 6. Daily Employee Operation Schedule

The employee follows a configurable daily cadence:

| Time (Local) | Autonomous Operation | Description |
|---|---|---|
| **08:30** | `PREPARE_DAILY_BRIEFING` | Aggregates pipeline metrics, overnight inbound leads, and pending approvals. |
| **09:00** | `CHECK_INBOUND_LEADS` | Evaluates new leads created outside business hours; prioritizes high-value prospects. |
| **09:15** | `EXECUTE_OUTBOUND_CAMPAIGN` | Processes approved contact queue, verifies calling hours, initiates compliant calls. |
| **11:30** | `PROCESS_RESPONSES` | Follows up on voicemails, SMS/email replies, and lead status updates. |
| **12:00** | `PIPELINE_RECONCILIATION` | Reconciles qualification scores, fact confidence, and meeting calendar states. |
| **13:00** | `PREPARE_UPCOMING_MEETINGS` | Generates structured briefings and context cards for afternoon discovery calls. |
| **14:00** | `CONTINUE_APPROVED_OUTREACH` | Executes second-tier outbound touchpoints and pending follow-ups. |
| **16:30** | `QUEUE_NEXT_DAY_ACTIONS` | Schedules tomorrow's touchpoints, flags stale leads, checks approval statuses. |
| **17:00** | `GENERATE_DAILY_REPORT` | Summarizes calls made, qualified opportunities, meetings booked, and credit usage. |

---

## 7. Client List & Autonomous Calling

Outbound calling operates over structured contact queues with strict compliance guards:

```text
[LOAD ACTIVE CAMPAIGN]
          ↓
[FETCH NEXT CONTACT IN QUEUE]
          ↓
[COMPLIANCE CHECK]
  - Is contact on DNC / Opt-Out list?
  - Is contact within legal local calling hours (09:00 - 17:00 local)?
  - Has contact exceeded max retry count (e.g. 3 attempts)?
          ↓
[WALLET & CREDIT CHECK]
  - Does company have sufficient available balance (>= reservation requirement)?
  - Atomically reserve call credits in ledger.
          ↓
[INITIATE VOICE CONNECTION]
  - Connect via AssemblyAI Voice Agent / Telephony Carrier.
  - Deliver mandatory AI identification disclosure.
  - Conduct full-duplex discovery & qualification conversation.
          ↓
[POST-CALL RESOLUTION]
  - Transcribe, extract structured facts with confidence scores.
  - Evaluate qualification criteria (Need, Budget, Timeline, Decision Maker).
  - Update contact record in CRM.
  - Settle call credits (CONSUMPTION) and log audit event.
          ↓
[SCHEDULE NEXT ACTION]
  - If QUALIFIED -> Book consultation or generate Project Brief.
  - If NO_ANSWER -> Schedule follow-up in 2 business days.
  - If OPT_OUT -> Immediately set consent = false and add to DNC.
```

---

## 8. Autonomous Sales Pipeline (14 Deterministic Stages)

HQ advances leads through 14 explicit deterministic stages without skipping policy gates:

```text
1. NEW 
   ↓ (Contact scheduled for initial outreach)
2. CONTACTING
   ↓ (Call answered or channel connected)
3. CONNECTED
   ↓ (AI conducts interactive business discovery)
4. DISCOVERY
   ↓ (All 5 qualification criteria satisfied)
5. QUALIFIED
   ↓ (Prospect agrees to discovery consultation)
6. MEETING_REQUESTED
   ↓ (Calendar slot selected and confirmed in Google Calendar)
7. MEETING_SCHEDULED
   ↓ (Meeting concluded with requirements captured)
8. MEETING_COMPLETED
   ↓ (Project Brief generated; scope and pricing calculated)
9. PROPOSAL_PREPARATION
   ↓ (Proposal created and delivered to client)
10. PROPOSAL_SENT
   ↓ (No response after 48h; follow-up reminder sent)
11. FOLLOW_UP
   ↓ (Client requests custom pricing or terms)
12. NEGOTIATION
   ↓ (Director reviews discount/scope in Human Control Center)
13. APPROVAL
   ↓ (Deal signed by human officers / or rejected)
14. CLOSED_WON / CLOSED_LOST
```

---

## 9. Meeting Agent Abstraction

**Architectural Separation:** Meeting Scheduling is distinct from Meeting Attendance.

- **Meeting Scheduling (`CURRENT PRODUCTION`):**
  - Fully implemented and verified using Google Calendar provider / SimulatedCalendarProvider.
  - Checks business hour availability, handles timezones, prevents double-booking (409 Conflict), supports cancellation and rescheduling.
- **Meeting Attendance (`P1 ARCHITECTURAL ABSTRACTION`):**
  - Abstracted through `MeetingAgentProvider` interface.
  - Bridges video/audio conferencing providers (e.g. Zoom, Google Meet, Teams, SIP WebRTC) into AssemblyAI Voice Agent audio stream.
  - Captures real-time meeting transcripts, logs key architectural decisions, action items, and generates an automated executive meeting summary.

---

## 10. Marketing Autonomy & Feedback Loop

The Marketing Employee sub-agent acts as the upstream feeder for the sales pipeline:

1. **Target Market Definition & Segmentation:** Defines Ideal Customer Profiles (ICPs) based on industry, company size, and tech stack.
2. **Campaign Creation:** Generates campaign copy, approved email/call scripts, and value propositions.
3. **Distribution Provider Interface:** Pluggable provider abstraction (`EmailProvider`, `WebhookProvider`, `NotificationProvider`) with strict rate limiting, unsubscribe headers, and delivery status tracking.
4. **Sales + Marketing Feedback Loop:**
   - Tracks which campaign variants generated the highest qualification rates and closed-won revenue.
   - Updates audience weighting without overwriting historical audit data.

---

## 11. Human Control & Emergency Stop

The human operator maintains absolute authority over all digital employees at all times:

```text
+-----------------------------------------------------------------------+
|                       HUMAN CONTROL ACTIONS                           |
|                                                                       |
|  [ PAUSE EMPLOYEE ]      Suspends current objective loop gracefully   |
|  [ RESUME EMPLOYEE ]     Resumes autonomous execution                 |
|  [ STOP ALL CALLS ]      Immediately terminates active outbound calls |
|  [ STOP CAMPAIGN ]       Halts current outreach campaign queue        |
|  [ EMERGENCY STOP ]      FAIL-SAFE KILL SWITCH: Immediately locks     |
|                          all tools, calls, and autonomous workers     |
|                                                                       |
|  [ APPROVAL TICKETS ]    Approve / Reject escalated discounts & terms |
|  [ ADJUST LIMITS ]       Modify daily call quotas and credit ceilings |
+-----------------------------------------------------------------------+
```

When **EMERGENCY STOP** is engaged:
- `isEmergencyStopped === true`
- All outbound telephony calls are immediately hung up.
- All scheduled jobs transition to `DEFERRED` or `SKIPPED`.
- Inbound voice calls respond with: *"Our business operations are temporarily paused for maintenance. Please leave a message."*
- Zero tool calls are permitted to execute until the human operator clears the emergency stop with an authenticated signature.

---

## 12. P0 vs. P1 Phasing Strategy

Per Section 15 of the Product Direction:

```text
================================================================================
PHASE 0: ASSEMBLYAI VOICE AGENT HACKATHON SUBMISSION (COMPLETED & VERIFIED)
================================================================================
[x] Real-time 24kHz PCM16 Web Audio capture & AudioWorklet linear resampler
[x] Real microphone permission & full-duplex voice stream
[x] AssemblyAI Voice Agent API integration (managed Speech-to-Speech)
[x] Server-side ephemeral ticket & token minting (GET /api/voice/ticket, GET /api/voice/token)
[x] 13 explicit business tools with docs-conformant coordination (BLK-012)
[x] Deterministic Policy Engine (ALLOW, REQUIRE_APPROVAL, BLOCK)
[x] Lead discovery, requirement recording, and qualification scoring
[x] Meeting availability checking & conflict-free booking (Google Calendar)
[x] Server-authoritative 1,000 credit onboarding grant (WELCOME_GRANT)
[x] Business Control Center Dashboard (Web single-origin; Android UI prototype)
[x] Automated test coverage: 181 passing tests across 24 test suites (0 failures)
[x] Single-origin web console deployment at {{LIVE_URL}}/voice-tester

================================================================================
PHASE 1: GOVERNED AUTONOMOUS COMPANY OPERATING AGENT ARCHITECTURE (THIS MODULE)
================================================================================
[x] Authoritative Autonomous Operating Agent Specification (docs/AUTONOMOUS_OPERATING_AGENT.md)
[x] Domain type system for Company Operating Configuration & Industry Profiles
[x] Pre-configured Industry Profiles (SaaS, Custom Software, Consulting, Healthcare)
[x] Persistent Scheduler & Worker Queue contract with exponential backoff & priority
[x] Autonomous Sales Pipeline 14-stage state machine
[x] Global Emergency Stop controller & safety boundaries
[x] Meeting Attendance Agent & Marketing Employee provider abstractions
```
