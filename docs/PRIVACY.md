# Privacy Policy — HQ Employee

**Effective Date:** September 17, 2026  
**Product:** HQ Employee (Governed AI Business Employee for Rafal Webcraft)

---

## 1. Overview & Data Controller

HQ Employee ("the App" / "the Service") is operated by Rafal Webcraft. We are committed to transparency and the ethical handling of personal, conversational, and business data.

This Privacy Policy explains how our autonomous AI employee collects, processes, stores, and protects data during voice interactions, phone calls, text chat, and mobile application usage.

---

## 2. Information We Collect

1. **Contact Information:** Prospective client name, business email, telephone number (in E.164 format), and organization name.
2. **Conversation & Audio Data:** 
   - Real-time voice audio streamed strictly for the duration of the interactive discovery session.
   - Transcripts of user speech and AI responses.
3. **Structured Lead Memory & Project Parameters:** Stated project requirements, business objectives, target users, technical constraints, budget ranges, and desired delivery timelines.
4. **Billing & Purchase Records:** In-app purchase receipts, credit wallet transactions, and RevenueCat subscription/package entitlement tokens. No raw credit card or financial account numbers are stored on our servers.
5. **Technical & Telephony Metadata:** Caller ID, call duration, timestamp, SIP carrier session IDs, and request IP addresses for rate limiting and fraud prevention.

---

## 3. How We Process Voice & Speech

- **AssemblyAI Voice Agent API:** Live audio is streamed over secure WebSockets (TLS 1.3/WSS) to AssemblyAI for speech-to-text transcription, conversational turn-taking, and speech synthesis.
- **Server-Side Token Minting:** Mobile clients and browser testing interfaces never receive backend provider API keys; sessions authenticate using short-lived, single-use tokens minted server-side.
- **Zero Audio Storage for Unconsented Parties:** Audio is processed ephemerally during active calls. Original recordings are never retained beyond the duration specified in customer governance policies.

---

## 4. Governance, Policy Boundaries & Sensitive Data Redaction

- **Deterministic Governance:** Our policy engine strictly prohibits the collection of passwords, PINs, OTP codes, social security numbers, or payment credentials. Any attempt by a user to provide sensitive secrets is immediately blocked.
- **Audit Sanitization Pipeline:** All logging systems pass payloads through `sanitizeAuditData()`, automatically redacting sensitive tokens, passwords, authorization headers, and secrets before writing to the append-only audit log.

---

## 5. Telephony Compliance & Opt-Out (Do-Not-Call)

- **AI Identity Disclosure:** In compliance with applicable regulations, HQ Employee explicitly identifies itself as an AI assistant representing HQ at the initiation of every phone call.
- **Calling Window Restrictions:** Outbound calls are programmatically restricted to 09:00 - 20:00 local recipient time.
- **Do-Not-Call (DNC) Registry:** Prospective clients may opt out at any time during a call or via administrative request. Once recorded, our pre-call pipeline permanently blocks any further outbound dialing to that number.

---

## 6. Data Subject Rights & "Right to be Forgotten"

In accordance with GDPR, CCPA, and modern privacy standards, users and leads have the following rights:
- **Right of Access:** Retrieve structured conversation facts, project briefs, and interaction history.
- **Right to Rectification:** Flag or correct disputed conversation facts (`NEEDS_CONFIRMATION`).
- **Right to Erasure (Right to be Forgotten):** Request complete deletion of lead records and memory layers via `DELETE /api/leads/:id/memory`. When triggered, all conversational memory, facts, and disputed entries are permanently purged.

---

## 7. Contact & Inquiries

For privacy inquiries, data subject access requests, or regulatory questions:
- **Email:** privacy@webcraft.io
- **Entity:** Rafal Webcraft
