# HQ-Employee — Product Specification

## Product

HQ-Employee

## Tagline

Your AI employee for leads, calls, and client coordination.

## Product Category

Governed AI Business Employee.

## Target User

Small businesses, agencies, software companies, consultants, and service businesses that receive leads and spend significant time qualifying prospects and coordinating meetings.

## Initial Company

Rafal Webcraft.

## Initial Employee

HQ-Employee Sales & Client Coordinator.

---

# Core Problem

Businesses lose time answering repetitive project inquiries, collecting requirements, qualifying leads, discussing basic commercial parameters, following up, and scheduling meetings.

Webcraft Employee automates the conversational and coordination layer while keeping sensitive decisions under human control.

---

# Core Promise

A business can give the AI employee:

- company knowledge
- services
- approved pricing guidance
- approved timeline guidance
- employee instructions
- authority rules

The employee can then conduct voice conversations with prospects, qualify opportunities, schedule meetings, and create structured project briefs.

---

# Primary Workflow

1. Lead becomes available.
2. System verifies calling authorization.
3. AI employee initiates or receives a call.
4. AssemblyAI provides real-time voice interaction.
5. Employee introduces itself appropriately.
6. Employee discovers project requirements.
7. Employee records structured facts.
8. Employee evaluates qualification.
9. Employee checks authority before commercial statements/actions.
10. Employee discusses only approved budget/timeline guidance.
11. Employee offers meeting slots when appropriate.
12. Employee schedules meeting.
13. Employee generates a structured lead brief.
14. Human team receives the opportunity.
15. Future follow-up can use stored lead memory.

---

# Initial Services

1. Website development
2. Custom software development
3. AI/ML development
4. Cybersecurity engineering

Additional services must be explicitly added to the company knowledge base.

---

# Initial Qualification Fields

- lead name
- company name
- contact method
- project type
- business objective
- target users
- required features
- integrations
- existing system
- expected launch
- budget range
- decision maker
- urgency
- preferred meeting time
- qualification status
- next action

---

# Qualification Statuses

NEW

CONTACTED

ENGAGED

QUALIFYING

QUALIFIED

UNQUALIFIED

MEETING_PENDING

MEETING_BOOKED

HUMAN_HANDOFF

CONVERTED

LOST

---

# Employee Authority

## Allowed

- explain approved services
- answer approved FAQs
- collect requirements
- qualify leads
- discuss approved budget ranges
- discuss approved timeline ranges
- schedule meetings
- reschedule meetings
- cancel meetings
- create lead records
- create follow-ups
- escalate to human

## Human Approval

- special discounts
- unusual pricing
- unusual timelines
- custom commercial commitments
- exceptional technical commitments
- disputed business terms

## Blocked

- contracts
- legal commitments
- payments
- financial transfers
- passwords
- PINs
- OTPs
- security credentials
- guarantees
- unauthorized disclosure
- impersonation

---

# AssemblyAI

AssemblyAI Voice Agent API is the primary real-time voice layer.

Responsibilities:

- real-time speech recognition
- conversational voice interaction
- turn detection
- voice output
- tool calling

Application business logic remains in Webcraft backend services.

---

# Telephony

Telephony is abstracted behind TelephonyProvider.

Preferred initial implementation:

AssemblyAI-compatible SIP/telephony.

Fallback provider:

To be selected only if a concrete requirement cannot be fulfilled through the primary route.

CALL-E is not part of the required MVP.

---

# Android

Technology:

- Kotlin
- Jetpack Compose
- Material 3
- Hilt
- Coroutines
- StateFlow
- Retrofit/OkHttp
- Kotlin Serialization
- DataStore
- RevenueCat

---

# Backend

Recommended:

- Node.js
- TypeScript
- Fastify or equivalent lightweight HTTP framework
- PostgreSQL
- WebSocket support
- structured logging
- schema validation

The backend is the authority for business rules.

---

# Monetization

RevenueCat-backed call credits.

The MVP may use:

- free introductory credits
- small credit pack
- medium credit pack
- large credit pack

Actual prices must be configured in RevenueCat and the app store.

---

# Primary Success Metric

Completed qualified lead conversations resulting in:

- qualified opportunity
- scheduled meeting
- structured project brief

---

# MVP Definition

The MVP is complete when the system can:

1. Start a real voice session.
2. Use AssemblyAI.
3. Understand a project inquiry.
4. Retrieve company information.
5. Ask discovery questions.
6. Record structured requirements.
7. Discuss authorized budget/timeline information.
8. Schedule a meeting.
9. Produce a lead brief.
10. Enforce employee authority.
11. Record an audit trail.
12. Consume credits through RevenueCat-backed billing.

---

# Explicit Non-Goals

The MVP does not require:

- multi-tenant SaaS
- arbitrary AI employee creation
- WhatsApp
- email automation
- contract signing
- automated proposals
- payment collection
- unrestricted negotiation
- autonomous financial operations
- healthcare decisions
- legal advice
- iOS
- desktop application