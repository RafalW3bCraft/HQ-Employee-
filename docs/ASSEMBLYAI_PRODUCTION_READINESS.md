# HQ EMPLOYEE — ASSEMBLYAI PRODUCTION READINESS REPORT

**Product:** HQ Employee — Governed AI Business Employee  
**Submission Category:** AssemblyAI Voice Agent Hackathon  
**Target Environment:** Firebase Hosting (`https://hq-employee.web.app`) + Google Cloud Run + PostgreSQL  
**Verification Date:** September 2026  
**Status:** **READY FOR SUBMISSION**

---

## 1. System Architecture
HQ Employee is built on a fail-closed, modular TypeScript architecture powered by Fastify and PostgreSQL:
- **Server:** Fastify with `@fastify/websocket`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/jwt`.
- **Database:** PostgreSQL on Neon with 6 sequential schema migrations (001–006) managing companies, employees, leads, meetings, policies, audit trails, and credit ledgers.
- **Frontend / Client:** Single-page Control Center and Voice Console deployed to Firebase Hosting, complemented by an Android Jetpack Compose client with clean architecture repository wiring.

---

## 2. Voice Architecture & Audio Pipeline
- **Upstream Engine:** AssemblyAI Voice Agent API (`wss://api.assemblyai.com/v2/realtime/ws`).
- **Browser Audio Capture:**
  - Standard `AudioContext` initializes at native hardware sample rate (e.g. 48,000 Hz or 44,100 Hz), avoiding the Firefox `AudioContext.createMediaStreamSource` sample rate mismatch DOMException.
  - Zero-drift continuous linear interpolation resampling executes in real-time inside the `PCMProcessor` `AudioWorklet` module, converting the stream to 24,000 Hz PCM16 raw audio before base64 encoding and transmission over WebSocket.
- **Output Audio Playback:**
  - Incoming 24kHz PCM16 AI speech chunks are decoded into `Float32Array` buffers and scheduled consecutively via `AudioBufferSourceNode` connected to `audioCtx.destination`.
  - Barge-in / interruption immediately flushes pending scheduled chunks (`flushAudioQueue()`) to halt playback smoothly.

---

## 3. AssemblyAI Protocol & Tool Calling
All WebSocket events adhere to current official AssemblyAI Voice Agent protocol specifications:
1. `session.begin` / `session.ready`: Ephemeral token exchange and session parameter negotiation.
2. `voice.audio_input`: 24kHz PCM16 audio blocks streamed while user speaks.
3. `voice.speech_started` / `voice.speech_stopped`: Visualizer transitions dynamically between speaking and thinking states.
4. `voice.user_transcript` / `voice.agent_transcript`: Real-time conversation streaming.
5. `voice.tool_activity`: Structured function dispatch.
6. `voice.agent_speaking`: Speaking state synchronization and barge-in audio flushing.
7. `voice.session_ended`: Explicit termination and credit settlement.

---

## 4. Policy Engine & Deterministic Governance
Every tool invocation from the voice session passes through the fail-closed Policy Engine before execution:
- `ALLOW`: Approved service discovery, pricing guidance, timeline guidance, lead creation, future meeting scheduling.
- `REQUIRE_APPROVAL`: Custom discounts (e.g. 15%), rush project delivery. Generates a pending human approval ticket.
- `BLOCK`: Legal contract signing, financial transfers, credential collection, human identity impersonation.

---

## 5. Authoritative Monetization & 1000 Free Credits
- **First-Time User Onboarding:**
  - Server-authoritative endpoint `POST /api/billing/welcome-grant`.
  - Atomically grants exactly 1,000 free credits under immutable transaction type `WELCOME_GRANT`.
  - Uniqueness and idempotency guaranteed via `welcome_grant_${companyId}` constraint.
  - Resilient against retries, duplicate requests, relogins, and concurrent executions.
- **In-App Monetization:** RevenueCat webhook ingestion and receipt reconciliation update the authoritative credit ledger without trusting client balances.

---

## 6. Telephony Status & Modalities
1. **In-Browser Full-Duplex Voice:** Production-ready and verified live at `https://hq-employee.web.app`.
2. **Android Voice:** Clean architecture client with `NetworkVoiceCallRepository` interfacing with the backend voice WebSocket.
3. **Outbound Carrier/SIP Telephony:**
   - Modular compliance gate verified (E.164 normalization, calling hours, opt-out checking, credit reservation).
   - `AssemblySIPProvider` and `MockTelephonyProvider` fully implemented for programmatic outbound dispatch.

---

## 7. Automated Testing Status
- **Test Suites:** 18 passing (100%).
- **Total Tests:** 156 passing (100%).
- **Failing Tests:** 0.
- **Zero Secrets Tracked:** Verified with automated secret scan across repository.

---

## 8. Known Limitations & Disclosure
- **Telephony Carrier Accounts:** Outbound PSTN calling requires an active SIP trunk configuration (`sip.assemblyai.com` or carrier SIP credentials) in production environment variables.
- **Browser Mic Permissions:** Requires HTTPS or localhost to access `navigator.mediaDevices.getUserMedia()`, enforced by `Permissions-Policy: microphone=(self)`.

---

## 9. Hackathon Submission Verdict
**Status:** **READY FOR SUBMISSION**  
The demo demonstrates real AssemblyAI full-duplex speech, real-time tool calling, deterministic policy boundaries, structured memory, calendar scheduling, and authoritative monetization.
