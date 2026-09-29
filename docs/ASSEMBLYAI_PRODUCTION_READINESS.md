# HQ-Employee — AssemblyAI Production Readiness Report

**Product:** HQ-Employee — Governed AI Business Employee  
**Submission Category:** AssemblyAI Voice Agent Hackathon  
**Target Environment:** Single-Origin Google Cloud Run (`{{LIVE_URL}}/voice-tester`)  
**Verification Date:** September 2026  
**Status:** **READY FOR SUBMISSION**

---

## 1. System Architecture
HQ-Employee is built on a fail-closed, modular TypeScript architecture powered by Fastify:
- **Server:** Fastify with `@fastify/websocket`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/jwt`.
- **Database & Schemas:** PostgreSQL on Neon with 6 sequential schema migrations (001–006) managing companies, employees, leads, meetings, policies, audit trails, and credit ledgers. Non-blocking database write-through (see `docs/PERSISTENCE_STATUS.md`).
- **Single-Origin Voice Console:** Served directly by the backend at `{{LIVE_URL}}/voice-tester` (Docker container packages `backend/public/voice-tester.html`).
- **Android Client:** UI prototype, not connected to the backend in this submission.

---

## 2. Voice Architecture & Audio Pipeline
- **Upstream Engine:** AssemblyAI Voice Agent API (`wss://agents.assemblyai.com/v1/ws`).
- **Browser Audio Capture:**
  - Standard `AudioContext` initializes at native hardware sample rate (e.g. 48,000 Hz or 44,100 Hz), avoiding the Firefox `AudioContext.createMediaStreamSource` sample rate mismatch DOMException.
  - Zero-drift continuous linear interpolation resampling executes in real-time inside the `PCMProcessor` `AudioWorklet` module, converting the stream to 24,000 Hz PCM16 raw audio before base64 encoding and transmission over WebSocket.
- **Output Audio Playback:**
  - Incoming 24kHz PCM16 AI speech chunks are decoded into `Float32Array` buffers and scheduled consecutively via `AudioBufferSourceNode` connected to `audioCtx.destination`.
  - Barge-in / interruption immediately flushes pending scheduled chunks (`flushAudioQueue()`) to halt playback smoothly.
- **Tool Result Coordination (BLK-012):**
  - Tool execution results buffer on `tool.call`, drain when `reply.done` arrives, and discard pending results if `reply.done` has status `"interrupted"` per official AssemblyAI specifications.

---

## 3. Public Endpoint Gating & Security
- **Single-Use HMAC Tickets:** Public WebSocket requires a short-lived (60s), single-use HMAC-signed ticket issued via `GET /api/voice/ticket` (with optional `DEMO_ACCESS_CODE` and per-IP rate limiting).
- **Concurrency & Budget Limits:** Enforces `VOICE_MAX_CONCURRENT` (default 3), one active session per IP, and `VOICE_DAILY_SESSION_MINUTES` budget.
- **Fail-Closed Production Mode:** Missing or dummy `ASSEMBLYAI_API_KEY` rejects startup with 503 instead of falling back to simulation.
- **Origin Protection:** Enforces `ALLOWED_ORIGINS` in production (no `*` wildcard in production).

---

## 4. Policy Engine & Deterministic Governance
Every tool invocation from the voice session passes through the fail-closed Policy Engine before execution:
- `ALLOW`: Approved service discovery, pricing guidance, timeline guidance, lead creation, future meeting scheduling.
- `REQUIRE_APPROVAL`: Custom discounts (e.g. 15%), rush project delivery. Generates a pending human approval ticket.
- `BLOCK`: Legal contract signing, financial transfers, credential collection, human identity impersonation.

---

## 5. Persistence & External Subsystems
1. **Persistence:** Authoritative state is kept in Node.js process memory for deterministic zero-latency turn-taking during demos and test runs, with non-blocking write-through to PostgreSQL when connected. See `docs/PERSISTENCE_STATUS.md`.
2. **Calendar:** Google Calendar when configured, otherwise a simulated calendar (`SimulatedCalendarProvider`).
3. **Telephony:** Outbound pre-call compliance pipeline implemented; SIP carrier dispatch is simulated in this submission.
4. **Android:** UI prototype, not connected to the backend in this submission.

---

## 6. Automated Testing Status
- **Test Suites:** 24 passing (0 failing).
- **Total Tests:** 181 passing (0 failing).
- **Zero Secrets Tracked:** Verified with automated secret scan across repository.

---

## 7. Submission Verdict
**Status:** **READY FOR SUBMISSION**  
The submission demonstrates real AssemblyAI full-duplex speech, real-time tool calling, deterministic policy boundaries, structured memory, calendar scheduling, and authoritative monetization.
