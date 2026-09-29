# 2-Minute Demo Video Script: HQ-Employee

**Total Target Duration:** 2:30 – 3:00  
**Focus:** Live product execution, real-time voice, tool calling, and deterministic governance.

---

### [0:00 – 0:20] Hook & Interface Introduction
- **Visual:** Open `https://hq-employee.web.app/`. Show the dark glassmorphic interface: real-time audio spectrum visualizer, live conversation stream, policy execution ledger, and action controls.
- **Narrator (VO):**
  > "Welcome to HQ-Employee. Most conversational AI agents are built as unconstrained chatbots that hallucinate and make promises companies can't keep. HQ-Employee is different: it is a **governed AI business employee** powered by AssemblyAI's full-duplex Voice Agent API. It speaks naturally, discovers requirements, schedules real meetings, and operates strictly within company policy."

---

### [0:20 – 0:50] Full-Duplex Connection & Lead Introduction
- **Action:** Click **"Start Conversation"**.
- **Visual:** Microphone permission prompt appears and is allowed. Status dot turns glowing green (`LIVE — Speaking...`). The audio visualizer animates.
- **AI Employee (Alba Voice):**
  > *"Hello! Welcome to Rafal Webcraft. I'm HQ-Employee, your AI sales and client coordination assistant. How can I help you today?"*
- **User (Spoken):**
  > *"Hi, my name is Alex Chen. I'm the CTO of TechVentures, and we're looking to build a custom enterprise platform."*
- **Visual:** User transcript appears instantly in conversation feed. The Tool Execution Ledger lights up: `create_lead` tool executed with decision **ALLOW**. Lead ID is created in PostgreSQL.
- **AI Employee (Alba Voice):**
  > *"Great to meet you, Alex! We specialize in custom enterprise web and cloud platforms. Tell me a bit about your primary requirements and target timeline."*

---

### [0:50 – 1:25] Discovery & Tool Execution
- **User (Spoken):**
  > *"We need a real-time web portal with speech dictation and AI analytics. Our budget is around thirty to fifty thousand dollars, and we want to launch within six months."*
- **Visual:** Tool Ledger displays sequential tool executions:
  - `record_requirement` -> **ALLOW**
  - `record_budget` (`$30,000 - $50,000`) -> **ALLOW**
  - `record_timeline` (`6 months`) -> **ALLOW**
- **AI Employee (Alba Voice):**
  > *"Understood. A custom portal with speech and analytics fits right into our core expertise. With your 6-month target and $30k to $50k budget, we can definitely support that. Would you like to schedule an introductory consultation with our engineering team?"*

---

### [1:25 – 1:55] Meeting Scheduling & Interruption (Barge-in)
- **User (Spoken):**
  > *"Yes, can we schedule a discovery call next week?"*
- **Visual:** Tool `check_calendar` executes -> Available slots retrieved.
- **AI Employee starts speaking:**
  > *"I have availability on Tuesday at 9:00 AM Eastern, or Wednesday at—"*
- **User Interrupts (Speaks over AI):**
  > *"Tuesday at 9:00 AM works perfectly!"*
- **Visual Highlight:** The instant the user speaks, the audio visualizer reflects user speech, AssemblyAI emits speech started, and the agent's playback **instantly halts** with zero awkward delay or duplicated audio.
- **Visual:** Tool `schedule_meeting` executes with decision **ALLOW**. The meeting is booked in PostgreSQL with confirmation code `WC-MKTG-SONF`.

---

### [1:55 – 2:25] The Governance Boundary (Policy in Action)
- **User (Spoken):**
  > *"Before we wrap up, can you give me a 15 percent discount on the project?"*
- **Visual:** Tool Ledger displays `request_human_approval` with decision **`REQUIRE_APPROVAL`**.
- **AI Employee (Alba Voice):**
  > *"I've logged your request for a 15% discount as an approval ticket for our managing director. They will review it and follow up with you directly."*
- **User (Spoken):**
  > *"Can't you just approve it and let's sign the contract right now?"*
- **Visual:** Policy Engine intercepts action `SIGN_CONTRACT` with decision **`BLOCK`**.
- **AI Employee (Alba Voice):**
  > *"I am not authorized to execute legal contracts or unilaterally approve custom discounts. Our director will finalize the formal agreement following our discovery call."*

---

### [2:25 – 2:45] Architecture & Closing
- **Visual:** Switch briefly to architecture diagram showing:
  `Browser (AudioWorklet) <--> Fastify Gateway (Cloud Run) <--> AssemblyAI Voice Agent (WSS) + Policy Engine + PostgreSQL`.
- **Narrator (VO):**
  > "HQ-Employee proves that real-time voice AI doesn't have to be a liability. With AssemblyAI's Voice Agent API, low-latency AudioWorklets, and a deterministic policy engine, enterprises can deploy AI workers that are natural, accountable, and production-ready today."
