# HQ Employee — Complete Real-Functionality & Production Audit

## 1. Executive Summary

This document records the exhaustive audit of every visible UI element, screen, button, action, process, API route, repository, and backend integration across the HQ Employee application.

Per the absolute rule of Section 2:
> *A feature is functional only when the real execution chain works: BUTTON -> UI EVENT -> VIEWMODEL -> USE CASE -> REAL REPOSITORY -> NETWORK -> BACKEND ROUTE -> AUTHENTICATION -> AUTHORIZATION -> BUSINESS LOGIC -> POLICY -> DATABASE / EXTERNAL PROVIDER -> REAL RESULT -> RESPONSE -> REPOSITORY -> VIEWMODEL -> UI STATE -> VISIBLE UI.*

---

## 2. Screen & Action Inventory

### Screen 1: Dashboard (`Screen.Dashboard`)
- **File:** `android/app/src/main/java/com/webcraft/employee/presentation/dashboard/DashboardScreen.kt`
- **ViewModel:** `DashboardViewModel.kt`
- **Use Case:** `GetDashboardDataUseCase.kt`

| # | Element | Visible Label | File & Line | ViewModel Method | UseCase & Repository | API / Backend Route | Database / Provider | Expected Result | Actual Result | Real / Fake | Persistence | Error Handling | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Action Button | `START EMPLOYEE` | `DashboardScreen.kt:127` | None | None | None | None | Starts employee session & navigates to Employee tab | Empty click lambda (`{ /* Start full-duplex session */ }`) | FAKE | None | None | **DISCONNECTED** |
| 1.2 | Header Wallet Chip | `[X] Credits` | `AppScaffold.kt:73` | None | None | Navigates to `Screen.Billing` | None | Opens Billing screen | Navigates to `Screen.Billing` | REAL | Client Nav | PopBackStack | **REAL** |
| 1.3 | Header Settings Icon | Settings Cog | `AppScaffold.kt:88` | None | None | Navigates to `Screen.Settings` | None | Opens Settings screen | Navigates to `Screen.Settings` | REAL | Client Nav | PopBackStack | **REAL** |
| 1.4 | Quick Action | `Leads` | `DashboardScreen.kt:203` | None | None | None | None | Navigates to Leads screen | Empty click lambda (`{ }`) | FAKE | None | None | **DISCONNECTED** |
| 1.5 | Quick Action | `Meetings` | `DashboardScreen.kt:204` | None | None | None | None | Navigates to Meetings screen | Empty click lambda (`{ }`) | FAKE | None | None | **DISCONNECTED** |
| 1.6 | Quick Action | `Brain` | `DashboardScreen.kt:205` | None | None | None | None | Navigates to Company Brain screen | Empty click lambda (`{ }`) | FAKE | None | None | **DISCONNECTED** |
| 1.7 | Quick Action | `Credits: [X]` | `DashboardScreen.kt:206` | None | None | None | None | Navigates to Billing screen | Empty click lambda (`{ }`) | FAKE | None | None | **DISCONNECTED** |
| 1.8 | Metric Card | `Calls Today: 12` | `DashboardScreen.kt:165` | `DashboardViewModel` | `GetDashboardDataUseCase` | None | Hardcoded | Displays actual calls completed today | Hardcoded string `"12"` | FAKE | None | None | **MOCKED** |
| 1.9 | Metric Card | `Qualified: [X]` | `DashboardScreen.kt:166` | `DashboardViewModel` | `GetDashboardDataUseCase` -> `LeadRepository.getLeads()` | `GET /api/leads` | PostgreSQL `leads` | Displays count of qualified leads | Count from `LeadRepository` | PARTIAL | PostgreSQL | Fallback to 0 | **PARTIAL** |
| 1.10 | Metric Card | `Meetings: [X]` | `DashboardScreen.kt:167` | `DashboardViewModel` | `GetDashboardDataUseCase` -> `MeetingRepository.getMeetings()` | `GET /api/meetings` | Google Cal / PostgreSQL | Displays count of upcoming meetings | Count from `MeetingRepository` | PARTIAL | PostgreSQL | Fallback to 0 | **PARTIAL** |
| 1.11 | Metric Card | `Pending Approvals: 0`| `DashboardScreen.kt:168` | None | None | `GET /api/policies/approvals` | PostgreSQL `human_approval_tickets` | Displays count of pending approvals | Hardcoded string `"0"` | FAKE | None | None | **MOCKED** |
| 1.12 | Lead Card Click | Recent Lead Row | `DashboardScreen.kt:150` | None | None | `Screen.LeadDetail.createRoute(id)` | None | Navigates to Lead Detail | Callback exists | REAL | Client Nav | None | **REAL** |

---

### Screen 2: Employee Console (`Screen.Employee`)
- **File:** `android/app/src/main/java/com/webcraft/employee/presentation/employee/EmployeeScreen.kt`
- **ViewModel:** `EmployeeViewModel.kt`
- **Use Case:** `GetEmployeeUseCase.kt`
- **Repository:** `VoiceCallRepository.kt` & `EmployeeRepository.kt`

| # | Element | Visible Label | File & Line | ViewModel Method | UseCase & Repository | API / Backend Route | Database / Provider | Expected Result | Actual Result | Real / Fake | Persistence | Error Handling | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2.1 | Action Button | `Start Voice Call` | `EmployeeScreen.kt:160` | `viewModel.startCall()` | `voiceCallRepository.startCall()` | `GET /api/voice/ticket` & WebSocket `/api/voice/ws` | AssemblyAI Voice Agent API | Mints ephemeral ticket & initiates real 24kHz stream | In-memory session state mutation | FAKE | Temporary | None | **MOCKED** |
| 2.2 | Action Button | `End Call` | `EmployeeScreen.kt:169` | `viewModel.endCall()` | `voiceCallRepository.endCall()` | WebSocket close | AssemblyAI | Terminates voice WebSocket session | Updates local session state to ENDED | PARTIAL | Temporary | None | **PARTIAL** |
| 2.3 | Text Input | `Speak as Lead...` | `EmployeeScreen.kt:208` | `viewModel.sendUserInput(text)`| `voiceCallRepository.sendUserInput(text)` | WebSocket client turn | AssemblyAI | Injects simulated user turn to voice agent | Updates local StateFlow without sending to WS | FAKE | Temporary | None | **MOCKED** |
| 2.4 | Prompt Chip | Quick Test Chips | `EmployeeScreen.kt:225` | `onSendUserInput(prompt)` | `voiceCallRepository.sendUserInput(prompt)` | WebSocket client turn | AssemblyAI | Sends scenario test prompt to AI | Updates local StateFlow only | FAKE | Temporary | None | **MOCKED** |

---

### Screen 3: Leads Pipeline (`Screen.Leads`)
- **File:** `android/app/src/main/java/com/webcraft/employee/presentation/leads/LeadsScreen.kt`
- **ViewModel:** `LeadsViewModel.kt`
- **Use Case:** `GetLeadsUseCase.kt`
- **Repository:** `LeadRepository.kt`

| # | Element | Visible Label | File & Line | ViewModel Method | UseCase & Repository | API / Backend Route | Database / Provider | Expected Result | Actual Result | Real / Fake | Persistence | Error Handling | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3.1 | Lead Card Click | Lead item | `LeadsScreen.kt:68` | `onLeadClick(lead.id)` | Navigates to `Screen.LeadDetail` | None | None | Opens Lead Detail screen | Navigates to `Screen.LeadDetail` | REAL | Client Nav | None | **REAL** |
| 3.2 | Status Filter Tab | All, Qualifying, Qualified | `LeadsScreen.kt:85` | Local State | Filters `state.leads` | None | None | Filters displayed list by status | Filtered in-memory | REAL | Temporary | None | **REAL** |

---

### Screen 4: Lead Detail (`Screen.LeadDetail`)
- **File:** `android/app/src/main/java/com/webcraft/employee/presentation/leads/LeadDetailScreen.kt`
- **ViewModel:** `LeadsViewModel.kt`
- **Use Case:** `GetLeadDetailUseCase.kt`
- **Repository:** `LeadRepository.kt`

| # | Element | Visible Label | File & Line | ViewModel Method | UseCase & Repository | API / Backend Route | Database / Provider | Expected Result | Actual Result | Real / Fake | Persistence | Error Handling | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4.1 | Back Button | Arrow Back | `LeadDetailScreen.kt:56` | `onBack()` | `navController.popBackStack()` | None | None | Returns to Leads list | Pops backstack | REAL | Client Nav | None | **REAL** |
| 4.2 | Action Button | `Schedule Consultation` | `LeadDetailScreen.kt:180`| None | None | `POST /api/meetings` | Google Calendar / PostgreSQL | Schedules meeting for this lead | No-op lambda | FAKE | None | None | **UNIMPLEMENTED** |
| 4.3 | Action Button | `Generate Proposal` | `LeadDetailScreen.kt:195`| None | None | `POST /api/proposals` | PostgreSQL `proposals` | Generates structured proposal | No-op lambda | FAKE | None | None | **UNIMPLEMENTED** |

---

### Screen 5: Meetings Calendar (`Screen.Meetings`)
- **File:** `android/app/src/main/java/com/webcraft/employee/presentation/meetings/MeetingsScreen.kt`
- **ViewModel:** `MeetingsViewModel.kt`
- **Use Case:** `GetMeetingsUseCase.kt`
- **Repository:** `MeetingRepository.kt`

| # | Element | Visible Label | File & Line | ViewModel Method | UseCase & Repository | API / Backend Route | Database / Provider | Expected Result | Actual Result | Real / Fake | Persistence | Error Handling | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.1 | Meeting Card | Meeting Item | `MeetingsScreen.kt:82` | None | None | None | None | Displays meeting details | Displays card | REAL | Display | None | **REAL** |
| 5.2 | Action Button | `Join Call` | `MeetingsScreen.kt:145` | None | None | None | None | Launches video/audio meeting session | Dead click handler | FAKE | None | None | **DISCONNECTED** |
| 5.3 | Action Button | `Reschedule` | `MeetingsScreen.kt:155` | None | None | `POST /api/meetings/:id/reschedule` | Google Calendar | Reschedules calendar slot | Dead click handler | FAKE | None | None | **UNIMPLEMENTED** |

---

### Screen 6: Company Brain (`Screen.CompanyBrain`)
- **File:** `android/app/src/main/java/com/webcraft/employee/presentation/companybrain/CompanyBrainScreen.kt`
- **ViewModel:** `CompanyBrainViewModel.kt`
- **Use Cases:** `GetCompanyBrainUseCase`, `UpdateCompanyProfileUseCase`, `UpsertServiceUseCase`, `UpsertFaqUseCase`, `ManagePolicyUseCase`
- **Repository:** `CompanyBrainRepository.kt`

| # | Element | Visible Label | File & Line | ViewModel Method | UseCase & Repository | API / Backend Route | Database / Provider | Expected Result | Actual Result | Real / Fake | Persistence | Error Handling | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6.1 | Tab | `Services` | `CompanyBrainScreen.kt:60` | `viewModel.selectTab(SERVICES)` | Local state | None | None | Switches tab to Services list | Tab switches | REAL | Temporary | None | **REAL** |
| 6.2 | Tab | `FAQs` | `CompanyBrainScreen.kt:61` | `viewModel.selectTab(FAQS)` | Local state | None | None | Switches tab to FAQs list | Tab switches | REAL | Temporary | None | **REAL** |
| 6.3 | Tab | `Policy` | `CompanyBrainScreen.kt:62` | `viewModel.selectTab(POLICY)` | Local state | None | None | Switches tab to Policy list | Tab switches | REAL | Temporary | None | **REAL** |
| 6.4 | Action Button | `Edit Profile` | `CompanyBrainScreen.kt:92` | `viewModel.openDialog(EditProfile)` | Dialog state | None | None | Opens profile edit dialog | Opens dialog | REAL | Temporary | None | **REAL** |
| 6.5 | Dialog Button | `Save Profile` | `CompanyBrainScreen.kt:215` | `viewModel.updateProfile(...)` | `UpdateCompanyProfileUseCase` -> `CompanyBrainRepository.updateProfile()` | `PUT /api/company/profile` | PostgreSQL `companies` | Saves company profile | Updates in-memory StateFlow only | PARTIAL | Memory | None | **PARTIAL** |
| 6.6 | Action Button | `Add Service` | `CompanyBrainScreen.kt:120`| `viewModel.openDialog(AddService)` | Dialog state | None | None | Opens add service dialog | Opens dialog | REAL | Temporary | None | **REAL** |
| 6.7 | Dialog Button | `Save Service` | `CompanyBrainScreen.kt:280`| `viewModel.saveService(...)` | `UpsertServiceUseCase` -> `CompanyBrainRepository.upsertService()` | `POST /api/company/services` | PostgreSQL `services` | Persists service guidance | Empty stub in `NetworkCompanyBrainRepository` | FAKE | None | None | **BROKEN** |
| 6.8 | Action Button | `Add FAQ` | `CompanyBrainScreen.kt:145`| `viewModel.openDialog(AddFaq)` | Dialog state | None | None | Opens add FAQ dialog | Opens dialog | REAL | Temporary | None | **REAL** |
| 6.9 | Dialog Button | `Save FAQ` | `CompanyBrainScreen.kt:325`| `viewModel.saveFaq(...)` | `UpsertFaqUseCase` -> `CompanyBrainRepository.upsertFaq()` | `POST /api/company/faqs` | PostgreSQL `company_faqs` | Persists FAQ | Empty stub in `NetworkCompanyBrainRepository` | FAKE | None | None | **BROKEN** |
| 6.10| Action Button | `New Policy Version` | `CompanyBrainScreen.kt:170` | `viewModel.openDialog(NewPolicy)` | Dialog state | None | None | Opens policy version dialog | Opens dialog | REAL | Temporary | None | **REAL** |
| 6.11| Dialog Button | `Activate Version` | `CompanyBrainScreen.kt:375` | `viewModel.createPolicyVersion(...)`| `ManagePolicyUseCase.createVersion()` | `POST /api/company/policies` | PostgreSQL `employee_policies` | Persists & activates policy | Empty stub in `NetworkCompanyBrainRepository` | FAKE | None | None | **BROKEN** |

---

### Screen 7: Billing & Monetization (`Screen.Billing`)
- **File:** `android/app/src/main/java/com/webcraft/employee/presentation/billing/BillingScreen.kt`
- **ViewModel:** `BillingViewModel.kt`
- **Repository:** `BillingRepository.kt`

| # | Element | Visible Label | File & Line | ViewModel Method | UseCase & Repository | API / Backend Route | Database / Provider | Expected Result | Actual Result | Real / Fake | Persistence | Error Handling | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 7.1 | Action Button | `Purchase [Package]` | `BillingScreen.kt:120` | `viewModel.purchase(pkg.id)` | `billingRepository.purchasePackage(pkg.id)` | `POST /api/billing/reconcile` | PostgreSQL `credit_ledger` | Reconciles purchase & grants credits | Sends HTTP POST & updates wallet balance | REAL | PostgreSQL | Catch & Error Msg | **REAL** |
| 7.2 | Action Button | `Restore Purchases` | `BillingScreen.kt:165` | `viewModel.restorePurchases()` | `billingRepository.restorePurchases(...)` | None | In-memory mock | Restores active entitlements | Returns mock `Restored` object | FAKE | Memory | None | **MOCKED** |
| 7.3 | Dismiss Icon | `✕` | `BillingScreen.kt:85` | `viewModel.clearMessage()` | Local StateFlow | None | None | Clears user alert message | Clears StateFlow | REAL | Temporary | None | **REAL** |

---

### Screen 8: Settings & Environment (`Screen.Settings`)
- **File:** `android/app/src/main/java/com/webcraft/employee/presentation/settings/SettingsScreen.kt`
- **ViewModel:** `SettingsViewModel.kt`

| # | Element | Visible Label | File & Line | ViewModel Method | UseCase & Repository | API / Backend Route | Database / Provider | Expected Result | Actual Result | Real / Fake | Persistence | Error Handling | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 8.1 | Text Input | `Server Base URL` | `SettingsScreen.kt:60` | `viewModel.updateBackendUrl(url)` | Local StateFlow | None | None | Updates server endpoint for networking | Updates in-memory StateFlow only | PARTIAL | Memory | None | **PARTIAL** |

---

## 3. Disconnected / Broken Paths Summary

1. **Dashboard Dead Actions (`P0`):**
   - `START EMPLOYEE` button click was an empty comment.
   - Quick Actions (`Leads`, `Meetings`, `Brain`, `Credits`) had empty click listeners.
   - Dashboard Stats `callCreditsRemaining` was hardcoded to 45 in `GetDashboardDataUseCase.kt`.
2. **Network Repositories Missing Real HTTP Fetching (`P0`):**
   - `NetworkLeadRepository`: `getLeads()` returned an empty flow without executing `GET /api/leads`. Field name mappings (`name` vs `fullName`, `email` vs `contactEmail`) were mismatched.
   - `NetworkMeetingRepository`: `getMeetings()` returned an empty flow without executing `GET /api/meetings`.
   - `NetworkCompanyBrainRepository`: `getCompanyBrain()` returned static mock data; `upsertService`, `upsertFaq`, and `updateProfile` were empty stubs.
   - `NetworkBillingRepository`: `getWalletBalance()` returned a static hardcoded wallet without fetching `GET /api/billing/wallet`.
   - `NetworkVoiceCallRepository`: `startCall()` did not connect to the real backend voice ticket endpoint (`GET /api/voice/ticket`).
3. **Company Brain CRUD Operations:**
   - Saving a service or FAQ updated local memory but did not persist to PostgreSQL.
4. **AppScaffold Default Credits:**
   - Defaulted to hardcoded `callCreditsRemaining = 45`.
