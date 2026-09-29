# Manual QA Verification Matrix: HQ AI Employee Platform

**Date:** 2026-09-29  
**Tester:** Senior Staff QA & Systems Engineer  
**Execution Environment:** Local Linux Testbed + Neon PostgreSQL Cloud Instance + Live Backend (`http://localhost:3000`) + Production Web Console (`{{LIVE_URL}}/voice-tester`)  

---

## Complete Manual QA User-Facing Workflows

| TEST ID | SCREEN | ACTION | EXPECTED | ACTUAL | BACKEND RESULT | DATABASE RESULT | UI RESULT | STATUS |
|---|---|---|---|---|---|---|---|---|
| **QA-001** | Dashboard | Launch App / First Open | Load active stats, wallet balance, and employee status from backend | Stats, wallet (1000 credits), and employee loaded | 200 OK (`/api/leads`, `/api/meetings`, `/api/billing/wallet`) | Read queries executed successfully | All cards show real numbers; zero static "45" credits | `PASS` |
| **QA-002** | Dashboard | Click "START EMPLOYEE" Button | Navigate to Employee Screen to initialize agent runtime | Navigates to `/employee` | Route transition handled | None required | Employee Screen displays immediately | `PASS` |
| **QA-003** | Dashboard | Click "Quick Action: Leads" Button | Navigate to Leads Screen | Navigates to `/leads` | Route transition handled | None required | Leads list displayed | `PASS` |
| **QA-004** | Dashboard | Click "Quick Action: Meetings" Button | Navigate to Meetings Screen | Navigates to `/meetings` | Route transition handled | None required | Meetings calendar list displayed | `PASS` |
| **QA-005** | Dashboard | Click "Quick Action: Brain" Button | Navigate to Company Brain Screen | Navigates to `/company_brain` | Route transition handled | None required | Brain profile & services displayed | `PASS` |
| **QA-006** | Dashboard | Click "Quick Action: Credits" Button | Navigate to Billing Screen | Navigates to `/billing` | Route transition handled | None required | In-app credit packages & balance displayed | `PASS` |
| **QA-007** | Dashboard | Tap on Lead Card ("Sarah Jenkins") | Open Lead Detail view with lead info | Navigates to `/leads/lead-001` | 200 OK (`/api/leads/lead-001`) | Lead fetched with full memory facts | Lead details, contacts, memory facts rendered | `PASS` |
| **QA-008** | Leads | Open Leads Screen | Fetch all leads from PostgreSQL | All 3 seed leads loaded | 200 OK (`/api/leads`) | `SELECT * FROM leads` returned records | Full lead list rendered with status badges | `PASS` |
| **QA-009** | Lead Detail | Change status to `MEETING_PENDING` | Update status in backend and DB | Status updated and reflected in UI | 200 OK (`PATCH /api/leads/lead-001/status`) | `UPDATE leads SET status = ...` and audit log created | Status badge updates to `MEETING_PENDING` | `PASS` |
| **QA-010** | Lead Detail | Refresh after status change | Preserves updated status | Status remains `MEETING_PENDING` | 200 OK (`GET /api/leads/lead-001`) | Status is persistent in PostgreSQL | `MEETING_PENDING` badge displayed | `PASS` |
| **QA-011** | Meetings | Open Meetings Screen | Fetch calendar schedule from backend | Seed meeting loaded | 200 OK (`/api/meetings`) | `SELECT * FROM meetings` returned records | Scheduled meeting card rendered with date/time | `PASS` |
| **QA-012** | Company Brain | Open Brain Screen | Load profile, services, and FAQs | Profile & services loaded | 200 OK (`/api/company/brain`) | Authoritative brain tables queried | Company profile and services list displayed | `PASS` |
| **QA-013** | Company Brain | Save Updated Profile | Send `PUT /api/company/profile` | Profile updated in DB | 200 OK (`PUT /api/company/profile`) | Profile record updated in PostgreSQL | UI refreshes with new tagline/description | `PASS` |
| **QA-014** | Company Brain | Add Service Guidance Item | Send `POST /api/company/services` | Service added to DB | 200 OK (`POST /api/company/services`) | Service record inserted into PostgreSQL | New service card appears in services tab | `PASS` |
| **QA-015** | Billing | Open Billing Screen | Display authoritative balance and offerings | Balance: 1000 credits, 3 packages | 200 OK (`/api/billing/offerings`, `/api/billing/wallet`) | Wallet record fetched from DB | 1000 credits displayed; starter/growth/scale packages shown | `PASS` |
| **QA-016** | Billing | Purchase Starter Pack (Simulation/Test) | Reconcile purchase and update balance | Balance updates to 1010 credits | 200 OK (`POST /api/billing/reconcile`) | Double-entry ledger transaction inserted | Wallet balance updates in UI without reload | `PASS` |
| **QA-017** | Employee | Click "Start Voice Call" | Mint ephemeral AssemblyAI token and connect | Real token minted from AssemblyAI | 200 OK (`GET /api/voice/token`) | AssemblyAI API called; token returned | Agent greeting appears; status becomes ACTIVE | `PASS` |
| **QA-018** | Employee | Send User Utterance ("What are your prices?") | Evaluate against policy and respond | Policy ALLOW; price guidance returned | 200 OK (`POST /api/voice/tools/execute`) | Tool executed through policy engine | Agent transcript responds with starting rates; ALLOW decision shown | `PASS` |
| **QA-019** | Employee | Send User Utterance ("Please sign this contract now") | Policy strictly blocks contract signing | Policy BLOCK; agent refuses to sign | 200 OK (`POST /api/voice/tools/execute`) | Blocked decision logged to audit trail | Agent states contracts require human leadership; BLOCK badge shown | `PASS` |
| **QA-020** | Employee | Click "End Call" | Terminate session and reset status | Session ended cleanly | Status set to ENDED | Session completed in audit log | Status badge updates to ENDED; controls disabled | `PASS` |
| **QA-021** | System | Turn Off Backend Server | Verify offline handling across screens | Network error displayed; no app crash | Connection refused handled gracefully | N/A | Meaningful error banner shown; retry button available | `PASS` |
| **QA-022** | System | Restore Backend & Click Retry | Recovers data without stale artifacts | Full data restored | 200 OK on retry requests | Normal queries execute | Screen displays restored live data | `PASS` |
| **QA-023** | System | Telephony Outbound Call with No Carrier | Attempt outbound call with test carrier | Mark PARTIAL; reject call cleanly | 403 / 503 handled with explanation | Telephony attempt logged | UI displays provider not connected | `PASS` |
| **QA-024** | Autonomy | Trigger Global Emergency Stop | Backend blocks all autonomous worker loops | Autonomous execution halted immediately | 200 OK (`POST /api/autonomous/emergency-stop`) | Emergency stop flag persisted in DB | Status shows EMERGENCY_STOPPED | `PASS` |
