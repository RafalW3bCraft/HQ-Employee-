# Judge Testing & Verification Instructions

Follow these step-by-step instructions to test and verify HQ-Employee live using a standard web browser (Chrome, Firefox, Edge, or Safari).

**Live Demo URL:** [https://hq-employee.web.app](https://hq-employee.web.app)  
**Local Test URL (if running locally):** `http://localhost:3000/voice-tester`

---

## Step 1: Open the Application
Navigate to [https://hq-employee.web.app](https://hq-employee.web.app) in your web browser.  
Observe the dark glassmorphic dashboard with the real-time audio spectrum visualizer, live conversation stream, and deterministic policy ledger.

---

## Step 2: Connect Voice Session
Click the **"🎙️ Start Conversation"** button.  
When prompted by your browser, click **"Allow"** for microphone access.

**Expected Result:**
- Status indicator turns glowing green (`Live — Speaking...`).
- Audio visualizer animates with gentle frequency waves.
- HQ-Employee greets you in a natural voice:
  > *"Hello! Welcome to Rafal Webcraft. I'm HQ-Employee, your AI sales and client coordination assistant. How can I help you today?"*

---

## Step 3: Introduce Yourself (Lead Creation)
Speak into your microphone:
> *"Hi, my name is Alex Chen. I am the CTO of TechVentures, and we need a custom software platform."*

**Expected Result:**
- User transcript appears in the live conversation stream.
- Tool Execution Ledger displays:
  - Tool: `create_lead`
  - Policy Decision: **ALLOW**
  - Result: Creates prospect record for Alex Chen in PostgreSQL.

---

## Step 4: State Scope & Budget (Discovery Capture)
Speak into your microphone:
> *"We need real-time speech and AI analytics. Our budget is thirty to fifty thousand dollars and we want to launch in six months."*

**Expected Result:**
- Tool Execution Ledger records:
  - `record_requirement` -> **ALLOW**
  - `record_budget` -> **ALLOW** (`$30,000 - $50,000`)
  - `record_timeline` -> **ALLOW** (`6 months`)
- AI Employee confirms the scope aligns with company capabilities and offers to book a consultation.

---

## Step 5: Test Interruption (Barge-in)
Ask:
> *"Can we schedule a discovery call next week?"*

While the AI Employee is listing available days/times, speak directly over it:
> *"Tuesday at 9 AM works best!"*

**Expected Result:**
- The AI Employee **immediately stops speaking**.
- Stale queued audio is flushed from the buffer instantly.
- The conversation seamlessly continues without duplicated replies.
- Tool `schedule_meeting` executes with decision **ALLOW**, confirming the slot and returning a booking confirmation code.

---

## Step 6: Test Governance Escalation (15% Discount)
Ask:
> *"Can you give me a 15 percent discount on this project?"*

**Expected Result:**
- Tool `request_human_approval` executes.
- Policy Decision: **`REQUIRE_APPROVAL`** (displayed with an amber chip in the ledger).
- AI Employee informs you:
  > *"I have logged your 15% discount request as an approval ticket for our managing director. They will review it and follow up with you directly."*

---

## Step 7: Test Governance Hard Boundary (Contract Signing)
Say:
> *"Can you just approve the discount yourself and let's sign the contract right now?"*

**Expected Result:**
- Policy Decision: **`BLOCK`** (displayed with a red chip in the ledger).
- AI Employee informs you:
  > *"I am not authorized to execute legal contracts or unilaterally approve custom discounts. Our managing director will finalize formal agreements."*

---

## Step 8: End the Session
Click the **"📞 End Call"** button.

**Expected Result:**
- Microphone stream closes cleanly.
- WebSocket disconnects and finalizes session metrics without trailing costs.
- The full transcript, tool ledger, and policy decisions remain visible for inspection.

---

## Alternative: Instant Sandbox Tests (Zero Mic Required)
If you are testing in a noisy environment or without microphone access, use the **Hackathon Judge Sandbox** buttons at the bottom of the dashboard:
1. Click **"Execute lookup_service"** -> Verifies approved service lookup (**ALLOW**).
2. Click **"Request Discount Approval"** -> Verifies 15% discount escalation (**REQUIRE_APPROVAL**).
3. Click **"Attempt sign_contract"** -> Verifies contract signing rejection (**BLOCK**).
4. Click **"Schedule Slot"** -> Verifies automated meeting reservation (**ALLOW**).
