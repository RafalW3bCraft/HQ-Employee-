# Judge Testing & Verification Instructions: HQ-Employee

Follow these instructions to test and verify HQ-Employee live using any modern browser (Chrome, Firefox, Edge, or Safari).

**Live Demo URL:** `{{LIVE_URL}}/voice-tester`  
**Local Test URL (if running locally):** `http://localhost:3000/voice-tester`  

---

## Access & Authentication (`DEMO_ACCESS_CODE`)

- **Without Access Code:** Navigate directly to `{{LIVE_URL}}/voice-tester`. If `DEMO_ACCESS_CODE` is not set on the server, ticket issuance is unrestricted.
- **With Access Code:** If `DEMO_ACCESS_CODE` is enabled on the deployment, append the code as a query parameter:  
  `{{LIVE_URL}}/voice-tester?code=<DEMO_ACCESS_CODE>`  
  (The interface will automatically transmit the code via the `x-demo-access-code` header when requesting the single-use ticket).

---

## Step-by-Step Live Voice Verification

### Step 1: Open the Application
Navigate to `{{LIVE_URL}}/voice-tester` (or `http://localhost:3000/voice-tester`).  
Observe the single-origin interface featuring the audio spectrum visualizer, live conversation stream, and deterministic policy ledger.

### Step 2: Connect Voice Session
Click the **"🎙️ Start Conversation"** button and allow browser microphone access.

**Expected Result:**
- Browser requests a single-use HMAC voice ticket from `GET /api/voice/ticket`.
- WebSocket connects to `/api/voice/ws?ticket=...`.
- Server sends `session.update` upstream, receives `session.ready` with a unique `session_id`, and transitions to `LIVE`.
- HQ-Employee greets you with synthesized speech:
  > *"Hello! Thanks for reaching out to HQ-Employee. I'm the HQ-Employee business development coordinator. How can I help with your project today?"*

### Step 3: Test Real-Time Speech Barge-In
Speak directly over the agent mid-sentence:
> *"Hi, I'm Alex Chen, CTO of TechVentures. We need a custom enterprise web application."*

**Expected Result:**
- Agent audio halts **immediately** upon detecting user speech with zero buffer overhang.
- Status switches from `Speaking` to `Listening`.
- User transcript renders finalized text in the live stream.
- The Tool Ledger records `create_lead` with decision **`ALLOW`**.

### Step 4: State Scope & Budget (Discovery Capture)
Speak:
> *"Our budget is $40,000 and we want to launch in 4 months."*

**Expected Result:**
- The Tool Ledger records:
  - `record_budget` -> **`ALLOW`**
  - `record_timeline` -> **`ALLOW`**
- Agent acknowledges requirements and proposes scheduling a discovery consultation.

### Step 5: Schedule Consultation (Docs-Conformant Tool Turn-Taking)
Speak:
> *"Can we schedule a discovery call next week?"*

**Expected Result:**
- Tool `schedule_meeting` is called.
- The tool coordinator buffers execution while the agent speaks (`reply.started`), drains on `reply.done`, and sends `tool.result` upstream.
- Policy Ledger marks `schedule_meeting` -> **`ALLOW`**.
- Agent confirms the consultation reservation.

### Step 6: Test Governance Escalation (15% Discount Request)
Speak:
> *"Can you give me a 15 percent discount on this project?"*

**Expected Result:**
- Policy Engine intercepts the discount request.
- Ledger marks: `request_discount (15%)` -> **`REQUIRE_APPROVAL`** (amber badge).
- Agent states:
  > *"A 15% discount exceeds my autonomous authority. I've logged an approval ticket for our Commercial Director to review."*

### Step 7: Test Governance Hard Boundary (Contract Signing)
Speak:
> *"Can we just sign the contract right now on this call?"*

**Expected Result:**
- Policy Engine intercepts the contract signing request.
- Ledger marks: `sign_contract` -> **`BLOCK`** (red badge).
- Agent states:
  > *"I am strictly prohibited from signing or accepting legal contracts. All agreements require human director authorization."*

### Step 8: Clean Session Disconnect
Click the **"📞 End Call"** button.

**Expected Result:**
- Server sends `session.end` and receives `session.ended`.
- Upstream socket closes cleanly (code 1005), timers clear, and active IP session locks are released.
- Complete conversation transcript and policy ledger remain visible for inspection.

---

## Alternative: Zero-Microphone Sandbox Mode
If testing in a noisy environment or without microphone permissions, click the buttons in the **Sandbox Panel** at the bottom of the dashboard:
1. **"Lookup Service"** -> Evaluates approved service lookup (**`ALLOW`**).
2. **"Request 15% Discount"** -> Evaluates commercial escalation (**`REQUIRE_APPROVAL`**).
3. **"Attempt sign_contract"** -> Evaluates legal contract boundary (**`BLOCK`**).
4. **"Schedule Meeting"** -> Evaluates consultation reservation (**`ALLOW`**).
