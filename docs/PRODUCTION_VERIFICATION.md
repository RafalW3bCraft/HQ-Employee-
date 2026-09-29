# Production Verification & Smoke Test Protocol

This document outlines the testing protocols for validating the production deployment of the HQ AI Employee Platform across Google Cloud Run, Firebase Hosting, Neon PostgreSQL, and AssemblyAI.

---

## 1. Automated Verification Script

Run the automated verification suite against your deployed endpoints:
```bash
./scripts/verify-production.sh <CLOUD_RUN_API_URL> <FIREBASE_HOSTING_URL>
```

### Verification Checks Performed:
1. **API Root (`/`):** Confirms process is listening and returns `{ status: "operational" }`.
2. **Liveness (`/health/live`):** Confirms event loop is running and returns `{ status: "ok" }`.
3. **Readiness (`/health/ready`):** Validates PostgreSQL connectivity (`SELECT 1`) and presence of production configuration.
4. **Strict CORS (Negative Test):** Verifies that arbitrary foreign origins are denied access.
5. **Strict CORS (Positive Test):** Verifies that the deployed Firebase Hosting domain is granted `Access-Control-Allow-Origin`.
6. **Authentication Protection:** Verifies that unauthenticated calls to `/api/leads` return HTTP 401.
7. **Voice Token Preflight:** Verifies `/api/voice/token` handles OPTIONS requests securely.
8. **Frontend Delivery:** Confirms Firebase Hosting serves the single-page voice console.
9. **Security Headers:** Validates `Strict-Transport-Security`, `X-Content-Type-Options`, and `X-Frame-Options`.
10. **Microphone Policy:** Validates `Permissions-Policy: microphone=(self)`.
11. **Zero Secret Leakage:** Audits delivered HTML to ensure no database credentials, JWT secrets, or AssemblyAI API keys appear in client code.
12. **WebSocket Probe:** Confirms `/api/voice/ws` upgrades WebSocket connections.

---

## 2. Manual End-to-End Live Voice Test

Following successful automated verification, execute the manual conversational testing protocol:

### Step 1: Open Voice Console
Open your production Firebase Hosting URL in **Google Chrome**:
```
https://<PROJECT_ID>.web.app
```

### Step 2: Grant Microphone Permission
1. Click **Start Conversation**.
2. When prompted by the browser, select **Allow** for microphone access.
3. Observe the audio visualizer reacting to ambient speech.

### Step 3: Converse with AI Employee
1. Say: *"Hi, I am looking to build a new web application for my law firm."*
2. Listen for the employee's voice response via AssemblyAI text-to-speech.
3. Verify low latency (< 1.5 seconds response time).

### Step 4: Test Interruption (Barge-in)
1. While the AI Employee is speaking, speak directly: *"Excuse me, what is your standard timeline?"*
2. Confirm the AI Employee immediately stops talking, resets playback buffer, and addresses the question.

### Step 5: Test Governed Policy Engine (Tool Calling)
1. Ask for a 50% discount: *"Can you give me a 50% discount?"*
2. Confirm the AI Employee answers that discounts above 20% cannot be granted (Policy Engine `BLOCK`).
3. Ask to schedule a consultation: *"Can we schedule a call next Tuesday at 2 PM?"*
4. Confirm the `scheduleMeeting` tool executes, reserves the slot in PostgreSQL, and confirms the meeting time.

### Step 6: Multi-Browser & Incognito Verification
- Repeat Steps 1–5 in **Mozilla Firefox**.
- Repeat in an **Incognito / Private Window** to verify clean session bootstrap without persistent cookie dependency.
- Repeat on **Mobile Safari / Chrome** on iOS/Android to verify responsive touch interaction.
