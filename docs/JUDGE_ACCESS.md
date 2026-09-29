# Hackathon Judge Review & Evaluation Guide

Welcome to the evaluation guide for **HQ-Employee** (submitted to the **AssemblyAI Voice Agent Hackathon** and **RevenueCat Shipaton 2026**).

HQ-Employee is an enterprise-governed AI business employee for Rafal Webcraft. It communicates with prospective clients via low-latency voice, discovers and qualifies business requirements, enforces deterministic policy boundaries, manages calendar booking, and tracks call credit consumption through an authoritative RevenueCat-reconciled ledger.

---

## 1. Quick Verification & Test Suite

The entire backend subsystem is validated by **181 automated tests** across **24 test suites** with 0 failures:

```bash
cd backend
npm install
npm run build
npm test
```

Expected output:
- **181 passed tests** across **24 test suites** (0 failures, 0 skipped)
- Full 17-scenario End-to-End lifecycle validation passing cleanly.

---

## 2. Interactive Voice Agent Testing Console (AssemblyAI Voice Agent API)

We provide an interactive, single-origin browser testing console with direct WebSocket integration and visual tool monitoring:

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```
2. **Open the browser testing harness:**
   Navigate to [http://localhost:3000/voice-tester](http://localhost:3000/voice-tester) (or `{{LIVE_URL}}/voice-tester` on Cloud Run).
3. **Interactive Capabilities to Test:**
   - **Start Voice Call:** Fetches a short-lived (60s), single-use HMAC ticket from `GET /api/voice/ticket` and connects over WebSocket (`/api/voice/ws?ticket=...`).
   - **Audio Waveform & Turn Detection:** Speak into your microphone; observe real-time speech detection and interruptions.
   - **Live Tool Execution Log:** As the employee speaks, watch the 13 registered business tools fire, evaluate against the backend Policy Engine (`ALLOW` / `REQUIRE_APPROVAL` / `BLOCK`), and update the lead state live.
   - **Docs-Conformant Tool Coordination (BLK-012):** Tool execution results buffer on `tool.call`, drain on `reply.done`, and discard pending results if interrupted.

---

## 3. Testing RevenueCat Monetization & Authoritative Credit Ledger

1. **Offerings Catalog:**
   ```bash
   curl http://localhost:3000/api/billing/offerings
   ```
   Returns the tiered credit packages (Starter Pack: 10 credits, Growth Pack: 50 credits, Scale Pack: 200 credits).

2. **Check Company Wallet Balance:**
   ```bash
   curl http://localhost:3000/api/billing/wallet
   ```
   Returns authoritative balance, reserved credits, and available balance (pre-seeded with 1,000 credit welcome grant).

3. **Reconcile In-App Purchase (Client Receipt):**
   ```bash
   curl -X POST http://localhost:3000/api/billing/reconcile \
     -H "Content-Type: application/json" \
     -d '{
       "productId": "credits_growth_50",
       "transactionReceiptId": "rc_judge_test_001"
     }'
   ```
   Notice that submitting the exact same request twice is strictly idempotent (deduplicated by the ledger).

4. **Simulate RevenueCat Webhook (Server-to-Server):**
   ```bash
   curl -X POST http://localhost:3000/api/billing/webhooks \
     -H "Content-Type: application/json" \
     -d '{
       "api_version": "1.0",
       "event": {
         "id": "evt_rc_judge_101",
         "type": "INITIAL_PURCHASE",
         "product_id": "credits_scale_200",
         "app_user_id": "00000000-0000-0000-0000-000000000001",
         "purchased_at_ms": 1726590000000
       }
     }'
   ```

---

## 4. Testing Governed Policy Engine & Security Safeguards

Try triggering an action that exceeds AI employee authority:

1. **Unauthorized Discount Escalation:**
   ```bash
   curl -X POST http://localhost:3000/api/voice/tools/execute \
     -H "Content-Type: application/json" \
     -d '{
       "name": "request_human_approval",
       "arguments": {
         "lead_id": "lead-001",
         "action_type": "discount_request",
         "details": "Judge requesting 15% discount for annual upfront payment",
         "proposed_value": "15%"
       }
     }'
   ```
   Returns `REQUIRE_APPROVAL` with generated `approval_id`.

2. **Contract / Liability Attempt (Strict Block):**
   ```bash
   curl -X POST http://localhost:3000/api/voice/tools/execute \
     -H "Content-Type: application/json" \
     -d '{
       "name": "sign_contract",
       "arguments": { "terms": "Unlimited liability warranty" }
     }'
   ```
   Returns `BLOCK` with deterministic refusal reason.

---

## 5. Architectural Status & System Disclosures

1. **Persistence Status**: State is held in Node.js process memory for deterministic zero-latency turn-taking during demos and test runs, with non-blocking write-through to PostgreSQL when connected. See [`docs/PERSISTENCE_STATUS.md`](PERSISTENCE_STATUS.md) for module-by-module audit.
2. **Calendar**: Google Calendar when configured, otherwise a simulated calendar (`SimulatedCalendarProvider`).
3. **Telephony**: Outbound pre-call compliance pipeline implemented; SIP carrier dispatch is simulated in this submission.
4. **Android Client**: UI prototype, not connected to the backend in this submission.
5. **Single-Origin Deployment**: The public live demo runs from a single origin at `{{LIVE_URL}}/voice-tester`.
