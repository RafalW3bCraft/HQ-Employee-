# 2-Minute Demo Video Script: HQ-Employee

**Total Target Duration:** 2:00  
**Focus:** Verified capabilities that passed live testing (AssemblyAI Voice Agent API, 24 kHz streaming, BLK-012 tool turn-taking, and deterministic governance).

---

### [0:00 – 0:20] Architecture & Ticket-Gated Connection
- **Visual:** Open `{{LIVE_URL}}/voice-tester`. The dashboard displays the live conversation feed, audio spectrum visualizer, and deterministic policy ledger.
- **Narrator (VO):**
  > "Welcome to HQ-Employee. Most conversational voice agents are built as unconstrained bots that hallucinate promises and commercial commitments. HQ-Employee is different: it is a **governed AI business employee** built on AssemblyAI's managed Voice Agent API. It conducts real-time 24 kHz speech discovery while enforcing deterministic commercial boundaries."
- **Action:** Click **"Start Conversation"**.
- **Visual Highlight:** Browser fetches a single-use 60-second HMAC ticket (`GET /api/voice/ticket`) and connects to `/api/voice/ws`. Upstream handshake sends `session.update`, receives `session.ready` with `session_id`, and transitions status to `LIVE`.

---

### [0:20 – 0:45] Live Speech, Greeting & Real-Time Barge-In
- **AI Employee (Audio):**
  > *"Hello! Thanks for reaching out to HQ-Employee. I'm the HQ-Employee business development coordinator. How can I help with your project today?"*
- **Action / User (Spoken Barge-in):** Speak directly over the agent mid-sentence:
  > *"Hi! I'm Alex Chen, CTO of TechVentures. We need a custom enterprise web platform."*
- **Visual Highlight:**
  - The instant user speech begins, the audio buffer flushes immediately and agent speech halts without overhang.
  - Live transcript renders the finalized user transcript.

---

### [0:45 – 1:15] Tool Turn-Taking (BLK-012) & Meeting Scheduling (ALLOW)
- **User (Spoken):**
  > *"Can we schedule a discovery consultation next week?"*
- **Visual Highlight (BLK-012 Tool Protocol):**
  - Upstream emits `tool.call` (`schedule_meeting`).
  - The coordinator buffers the tool execution while the agent speaks (`reply.started`).
  - Upon `reply.done`, the coordinator drains the result, sends `tool.result`, and triggers the agent's confirmation.
  - Policy Ledger displays: `schedule_meeting` -> **`ALLOW`** (Meeting scheduling within approved availability is permitted).
- **AI Employee (Audio):**
  > *"I've checked our calendar and reserved an introductory discovery consultation for your team."*

---

### [1:15 – 1:40] Deterministic Governance: Escalation & Hard Block
- **User (Spoken):**
  > *"Can you give me a 15 percent discount on this project?"*
- **Visual Highlight (Escalation):**
  - Policy Engine intercepts the discount request.
  - Ledger displays: `request_discount (15%)` -> **`REQUIRE_APPROVAL`** (amber badge).
- **AI Employee (Audio):**
  > *"A 15% discount exceeds my autonomous authority. I've logged an approval ticket for our Commercial Director to review."*
- **User (Spoken):**
  > *"Can't you just approve it and let's sign the contract right now on this call?"*
- **Visual Highlight (Hard Block):**
  - Policy Engine intercepts contract signing.
  - Ledger displays: `sign_contract` -> **`BLOCK`** (red badge).
- **AI Employee (Audio):**
  > *"I am strictly prohibited from signing or accepting legal contracts. All agreements require human director authorization."*
- **Visual:** Show the append-only audit trail recording each action, decision, reason, and timestamp.

---

### [1:40 – 2:00] Clean Teardown & Production Verification
- **Action:** Click **"End Call"**.
- **Visual Highlight:**
  - Server sends `session.end` and receives `session.ended`.
  - Upstream socket closes cleanly (code 1005), timers clear, and active IP session releases.
- **Narrator (VO):**
  > "HQ-Employee demonstrates production-grade voice AI: 24 kHz full-duplex speech on AssemblyAI, docs-conformant tool coordination, fail-closed policy governance, zero client key exposure, and 181 automated tests passing with zero failures."
