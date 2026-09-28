# HQ-Employee — Blocker Register

> Evidence-based defect and blocker register.
> Each blocker is verified against actual source code — no speculative entries.
> Severity: P0 = submission-blocking | P1 = judge-reproducibility failure | P2 = production gap | P3 = polish/cleanup

---

## BLK-001 — npm test script glob expansion failure

| Field | Value |
|---|---|
| **ID** | BLK-001 |
| **SEVERITY** | P1 |
| **FILE** | `backend/package.json` line 10 |
| **FUNCTION** | `scripts.test` |
| **OBSERVED** | `npm test` exits with: `Could not find '/home/watcher/Desktop/employee/backend/test/**/*.test.ts'` |
| **EXPECTED** | `npm test` runs all 142 tests and exits 0 |
| **ROOT CAUSE** | Node's `--test` runner receives the glob literal `test/**/*.test.ts` as a single string argument. On Linux with Node 22 in a non-interactive shell, `**` glob is not expanded by the shell when the command is executed via `npm run`. The glob needs to be shell-expanded before Node sees it. |
| **MINIMAL FIX** | Change the test script to list files explicitly, or use a glob-expanding wrapper. Fastest fix: replace glob with explicit file list in `package.json`. |
| **REGRESSION TEST** | `cd backend && npm test` must exit 0 and print `# tests 142` |
| **STATUS** | OPEN |

**Minimal fix for `backend/package.json`:**
```json
"test": "node --import tsx --test test/assemblyai-telephony.test.ts test/assemblyai-voice-agent.test.ts test/auth.test.ts test/company-brain.test.ts test/config.test.ts test/e2e-workflow.test.ts test/errors.test.ts test/health.test.ts test/hq-audit-system.test.ts test/hq-employee-memory.test.ts test/hq-employee-runtime.test.ts test/lead-qualification.test.ts test/meetings.test.ts test/modules.test.ts test/objectives.test.ts test/policy-engine.test.ts test/proposals.test.ts test/revenuecat-monetization.test.ts"
```

---

## BLK-002 — Android Gradle wrapper missing

| Field | Value |
|---|---|
| **ID** | BLK-002 |
| **SEVERITY** | P1 |
| **FILE** | `android/` (directory root) |
| **FUNCTION** | `./gradlew assembleDebug` |
| **OBSERVED** | `/bin/bash: ./gradlew: No such file or directory` — the `gradlew` wrapper script is absent |
| **EXPECTED** | `android/gradlew` (and `android/gradlew.bat`) present; `./gradlew assembleDebug` downloads Gradle 8.9 and builds the APK |
| **ROOT CAUSE** | The `gradlew` shell script was not committed to the repository. The `android/gradle/wrapper/gradle-wrapper.properties` and `android/gradle/wrapper/` JAR reference are present but the executable wrapper is absent. |
| **MINIMAL FIX** | Generate a standard Gradle wrapper: run `gradle wrapper --gradle-version 8.9` inside `android/`, or manually commit the standard `gradlew` script and `gradle/wrapper/gradle-wrapper.jar`. |
| **REGRESSION TEST** | `cd android && ./gradlew assembleDebug` must complete with `BUILD SUCCESSFUL` |
| **STATUS** | OPEN |

---

## BLK-003 — Android real networking layer entirely absent

| Field | Value |
|---|---|
| **ID** | BLK-003 |
| **SEVERITY** | P1 (for demo credibility) |
| **FILE** | `android/app/src/main/java/com/webcraft/employee/data/` |
| **FUNCTION** | All repository implementations |
| **OBSERVED** | The only repository implementations are `FakeLeadRepository`, `FakeMeetingRepository`, `FakeEmployeeRepository`, `FakeCompanyBrainRepository`, `FakeBillingRepository`, `FakeVoiceCallRepository`. All use hard-coded in-memory data. No Retrofit/OkHttp client, no API service interfaces, no real HTTP calls to the backend. |
| **EXPECTED** | At minimum `RetrofitVoiceCallRepository` (WebSocket to `/api/voice/ws`) and `RetrofitBillingRepository` (HTTP to `/api/billing/*`) implementing the domain interfaces. |
| **ROOT CAUSE** | Network layer was not implemented — only the UI preview/fake layer exists. |
| **MINIMAL FIX** | For the voice hackathon: implement `NetworkVoiceCallRepository` that connects to `ws://10.0.2.2:3000/api/voice/ws` and streams PCM16 audio. For billing: implement `NetworkBillingRepository` calling `/api/billing/wallet` and `/api/billing/purchases/reconcile`. |
| **REGRESSION TEST** | App launched against running backend must show live wallet balance from `/api/billing/wallet`, not hard-coded 100 credits. |
| **STATUS** | OPEN |

---

## BLK-004 — RevenueCat Android SDK missing from build.gradle.kts

| Field | Value |
|---|---|
| **ID** | BLK-004 |
| **SEVERITY** | P1 (RevenueCat Shipaton submission) |
| **FILE** | `android/app/build.gradle.kts` |
| **FUNCTION** | `dependencies {}` block |
| **OBSERVED** | RevenueCat SDK (`com.revenuecat.purchases:purchases`) is absent from `app/build.gradle.kts`. The `libs.versions.toml` does not list RevenueCat. `FakeBillingRepository.reconcilePurchaseWithBackend()` is a pure local no-op. |
| **EXPECTED** | `implementation("com.revenuecat.purchases:purchases:8.x.x")` in dependencies. `Purchases.configure()` called in `WebcraftApp.onCreate()`. A real `RevenueCatBillingRepository` calling `Purchases.sharedInstance.purchase()` and then posting the receipt to the backend `/api/billing/purchases/reconcile`. |
| **ROOT CAUSE** | SDK integration was not started. |
| **MINIMAL FIX** | Add dependency to `app/build.gradle.kts`, add `RC_API_KEY` to `AndroidManifest.xml` (public key only — no secret), configure `Purchases` in `WebcraftApp`, implement `RevenueCatBillingRepository`. |
| **REGRESSION TEST** | `FakeBillingRepository` must not be wired in production builds; `reconcilePurchaseWithBackend` must call real backend endpoint and return authoritative wallet. |
| **STATUS** | OPEN |

---

## BLK-005 — Product naming inconsistency across entire codebase

| Field | Value |
|---|---|
| **ID** | BLK-005 |
| **SEVERITY** | P1 (submission identity) |
| **FILE** | Multiple |
| **FUNCTION** | User-visible strings, API identifiers, package names |
| **OBSERVED** | The product is called at least four different names simultaneously: `"HQ"` (Android `strings.xml` app_name), `"HQ Employee"` (`docs/JUDGE_ACCESS.md`), `"Webcraft Employee"` (`docs/AGENTS.md`, `docs/PROJECT_SPEC.md`), `"webcraft-employee-api"` (backend `health` route), `"hq-employee-api"` (backend root route). Android package is `com.webcraft.employee`, theme is `Theme.WebcraftEmployee`. |
| **EXPECTED** | All user-visible product names, service identifiers, and documentation headings must read **HQ-Employee**. |
| **ROOT CAUSE** | The product was renamed to HQ-Employee but the rename was not applied to source files. |
| **MINIMAL FIX** | See the rename inventory below; apply targeted `search_and_replace` on each file. Do NOT rename the Java package (`com.webcraft.employee`) as that requires a full Gradle rename refactor — rename only user-visible strings and identifiers. |
| **REGRESSION TEST** | `grep -r "HQ Employee\|Webcraft Employee\|hq-employee-api\|webcraft-employee-api" backend/src android/app/src/main/res` must return zero matches after fix. |
| **STATUS** | IN PROGRESS — see rename changes below |

**Rename inventory (minimal, user-visible only):**

| File | Old value | New value |
|---|---|---|
| `android/app/src/main/res/values/strings.xml` | `HQ` | `HQ-Employee` |
| `backend/src/routes/health.ts` | `webcraft-employee-api` | `hq-employee-api` |
| `backend/src/server.ts` | `hq-employee-api` / `HQ Governed AI Backend API` | `hq-employee-api` / `HQ-Employee Governed AI Backend API` |
| `backend/src/modules/assemblyai/index.ts` | `HQ Business Development...` in system prompt / greeting | `HQ-Employee Business Development...` |
| `backend/src/modules/company/index.ts` | Company name seed `'HQ'` / descriptions | `'HQ-Employee'` |
| `backend/src/modules/runtime/index.ts` | Tool descriptions referencing `HQ` | Reference `HQ-Employee` |
| `docs/AGENTS.md` | `Webcraft Employee` | `HQ-Employee` |
| `docs/PROJECT_SPEC.md` | `Webcraft Employee` | `HQ-Employee` |
| `docs/JUDGE_ACCESS.md` | `HQ Employee` | `HQ-Employee` |
| `README.md` | `HQ Employee` / `HQ Governed AI Business Employee` | `HQ-Employee` |
| `backend/.env.example` | `# HQ Employee` | `# HQ-Employee` |
| `android/settings.gradle.kts` | `rootProject.name = "WebcraftEmployee"` | `rootProject.name = "DEmployee"` |

---

## BLK-006 — Database persistence not verified; silent failure on all DB writes

| Field | Value |
|---|---|
| **ID** | BLK-006 |
| **SEVERITY** | P2 |
| **FILE** | `backend/src/db/index.ts`, `backend/src/modules/calls/index.ts`, `backend/src/modules/audit/index.ts`, `backend/src/modules/meetings/index.ts`, `backend/src/modules/approvals/index.ts` |
| **FUNCTION** | All `try { await query(...) } catch { // In-memory fallback }` blocks |
| **OBSERVED** | Every PostgreSQL write in `calls`, `audit`, `meetings`, `approvals` is wrapped in a bare `try/catch` that silently discards DB errors. The `db/index.ts` creates a `pg.Pool` unconditionally but all modules maintain their own in-memory arrays as the primary store. Data is lost on process restart. |
| **EXPECTED** | Either: (a) a documented explicit in-memory mode flag that disables PG entirely, OR (b) DB writes that actually fail loudly in production mode. |
| **ROOT CAUSE** | Pattern was intentional for hackathon zero-config dev mode but the silent swallow is indistinguishable from a broken DB connection. |
| **MINIMAL FIX** | In production `NODE_ENV`, the catch block should re-throw or log at ERROR level. For the hackathon, document clearly that data is in-memory-only unless `DATABASE_URL` points to a live PostgreSQL instance. |
| **REGRESSION TEST** | When `NODE_ENV=production` and `DATABASE_URL` is unreachable, server should log an ERROR-level warning on first failed write, not silently continue. |
| **STATUS** | OPEN |

---

## BLK-007 — AssemblyAI SIP / live telephony is fully simulated

| Field | Value |
|---|---|
| **ID** | BLK-007 |
| **SEVERITY** | P2 |
| **FILE** | `backend/src/modules/telephony/index.ts` |
| **FUNCTION** | `AssemblySIPProvider.initiateCall()` lines ~320–370 |
| **OBSERVED** | `AssemblySIPProvider.initiateCall()` does NOT make any HTTP or SIP network call. It uses a deterministic hash of the destination number to simulate BUSY/TIMEOUT/ECONNRESET failures and a 3-second `setTimeout` delay. The `providerCallId` is a locally-generated UUID. There is no SIP trunk, no `sip:sip.assemblyai.com` connection, no carrier. |
| **EXPECTED** | Per `docs/ARCHITECTURE.md` and README: "Dispatch SIP Carrier Call: Originate call via AssemblyAI SIP Trunk (`sip:sip.assemblyai.com`)". |
| **ROOT CAUSE** | AssemblyAI SIP trunking / telephony API integration was not implemented. |
| **MINIMAL FIX** | For hackathon demo: document explicitly that telephony is simulated. For production: implement real HTTP call to AssemblyAI telephony API endpoint with `ASSEMBLYAI_API_KEY`. |
| **REGRESSION TEST** | With a real `ASSEMBLYAI_API_KEY` and `SIP_CALLER_ID`, a call to a valid test number should appear in the AssemblyAI dashboard. |
| **STATUS** | OPEN (documented as simulated) |

---

## BLK-008 — RevenueCat receipt reconciliation does not call RevenueCat REST API

| Field | Value |
|---|---|
| **ID** | BLK-008 |
| **SEVERITY** | P2 |
| **FILE** | `backend/src/modules/billing/index.ts` |
| **FUNCTION** | `BillingService.reconcilePurchase()` lines 312–349 |
| **OBSERVED** | `reconcilePurchase()` validates `productId` against `CREDIT_OFFERINGS_CATALOG` and checks `transactionReceiptId.trim().length >= 5`. It does NOT call the RevenueCat REST API (`https://api.revenuecat.com/v1/receipts`) to verify the receipt with Apple/Google. Credits are granted solely based on the client-submitted `productId`. |
| **EXPECTED** | Server-side receipt validation via `POST https://api.revenuecat.com/v1/receipts` with `REVENUECAT_SECRET_KEY` before granting credits. |
| **ROOT CAUSE** | RC REST API integration not implemented in the reconcile path. The webhook path IS real and idempotent. |
| **MINIMAL FIX** | For hackathon demo: document that the webhook path is the authoritative grant mechanism (which is correctly implemented and tested). The reconcile endpoint should carry a warning that it relies on webhook for production verification. |
| **REGRESSION TEST** | Submitting a fake `transactionReceiptId` with a valid `productId` should NOT grant credits in production (requires RC API call). |
| **STATUS** | OPEN (webhook path is correct; reconcile path is partial) |

---

## BLK-009 — Hilt DI listed in version catalog but not wired in Android build

| Field | Value |
|---|---|
| **ID** | BLK-009 |
| **SEVERITY** | P2 |
| **FILE** | `android/app/build.gradle.kts`, `android/gradle/libs.versions.toml` |
| **FUNCTION** | Dependency injection configuration |
| **OBSERVED** | `libs.versions.toml` defines `hilt = "2.52"`, `hilt-android`, `hilt-compiler`, `androidx-hilt-navigation-compose`. `app/build.gradle.kts` does NOT include `alias(libs.plugins.hilt.android)` in plugins or `hilt-android` / `hilt-compiler` in dependencies. `WebcraftApp.kt` uses manual `AppContainer`. |
| **EXPECTED** | Either: (a) Hilt fully wired (plugin + kapt/ksp + `@HiltAndroidApp`), OR (b) TOML entries removed and manual DI kept consistently. |
| **ROOT CAUSE** | Hilt was planned but not implemented; TOML was not cleaned up. |
| **MINIMAL FIX** | Remove `hilt-android`, `hilt-compiler`, `androidx-hilt-navigation-compose` from `libs.versions.toml` and the `hilt` version, since manual `AppContainer` is used throughout. This resolves the inconsistency without requiring Hilt migration. |
| **REGRESSION TEST** | `./gradlew assembleDebug` must succeed with no Hilt-related errors. |
| **STATUS** | OPEN |

---

## BLK-010 — `@fastify/static` referenced in README but not installed or registered

| Field | Value |
|---|---|
| **ID** | BLK-010 |
| **SEVERITY** | P3 |
| **FILE** | `backend/src/server.ts`, `backend/package.json`, `README.md` |
| **FUNCTION** | Static file serving |
| **OBSERVED** | `README.md` (§6 Part A §3) claims: "Registers `@fastify/static` to serve `public/voice-tester.html`". `@fastify/static` is NOT in `package.json` dependencies and NOT registered in `server.ts`. The voice-tester is served via a dedicated explicit `GET /voice-tester` route in `routes/voice.ts` that reads the file directly. |
| **EXPECTED** | Either: (a) README corrected to describe the actual explicit route, OR (b) `@fastify/static` installed and used. |
| **ROOT CAUSE** | Documentation written speculatively. The explicit route approach is functionally correct. |
| **MINIMAL FIX** | Update `README.md` §6 Part A §3 to remove the `@fastify/static` reference and describe the actual explicit route. |
| **REGRESSION TEST** | `GET /voice-tester` returns 200 with HTML (already tested in `assemblyai-voice-agent.test.ts` test 9). |
| **STATUS** | OPEN (documentation only) |

---

## BLK-011 — Test suite per-file counts in README are wrong

| Field | Value |
|---|---|
| **ID** | BLK-011 |
| **SEVERITY** | P3 |
| **FILE** | `README.md` §7 |
| **FUNCTION** | Test catalog table |
| **OBSERVED** | Several per-suite test counts in the README table do not match actual counts from `npm test` output: `assemblyai-telephony.test.ts` claims 11, actual 16. `lead-qualification.test.ts` claims 9, actual 6. `config.test.ts` claims 2, actual 3. `errors.test.ts` claims 4, actual 3. `hq-employee-memory.test.ts` claims 6, actual 7. `hq-employee-runtime.test.ts` claims 5, actual 6. |
| **EXPECTED** | Counts match actual output. Total is correct (142). |
| **ROOT CAUSE** | README was not updated after test modifications. |
| **MINIMAL FIX** | Update the table in README.md §7 with correct per-suite counts (total stays 142). |
| **REGRESSION TEST** | Run `npm test` and verify each suite count matches the table. |
| **STATUS** | OPEN (documentation only) |

---

## Blocker Summary

| ID | Severity | Area | Title | Status |
|---|---|---|---|---|
| BLK-001 | P1 | Backend | `npm test` glob fails — judge cannot run tests with `npm test` | OPEN |
| BLK-002 | P1 | Android | Gradle wrapper (`gradlew`) missing — no Android build | OPEN |
| BLK-003 | P1 | Android | Real networking layer absent — all repos are Fake | OPEN |
| BLK-004 | P1 | Android | RevenueCat Android SDK not in build.gradle.kts | OPEN |
| BLK-005 | P1 | All | Product naming inconsistency — requires HQ-Employee rename | IN PROGRESS |
| BLK-006 | P2 | Backend | DB writes silently swallowed — persistence unverified | OPEN |
| BLK-007 | P2 | Backend | AssemblyAI SIP telephony is fully simulated | OPEN |
| BLK-008 | P2 | Backend | RevenueCat receipt reconcile does not call RC REST API | OPEN |
| BLK-009 | P2 | Android | Hilt in TOML but not in build.gradle.kts — inconsistency | OPEN |
| BLK-010 | P3 | Docs | README claims @fastify/static — not installed/used | OPEN |
| BLK-011 | P3 | Docs | Per-suite test counts in README are wrong | OPEN |

---

## Recommended Smallest Next Implementation Steps

**Step 1 (P1 — 5 min) — Fix npm test script:**
Apply fix to `backend/package.json` so `npm test` works for judges.

**Step 2 (P1 — 10 min) — Apply HQ-Employee rename:**
Targeted string replacements in `strings.xml`, `health.ts`, `server.ts`, `company/index.ts`, `assemblyai/index.ts`, `README.md`, `docs/*.md`, `settings.gradle.kts`. Do NOT rename Java package.

**Step 3 (P1 — 30 min) — Restore Gradle wrapper:**
Run `gradle wrapper --gradle-version 8.9` in `android/`, commit `gradlew`, `gradlew.bat`, and `gradle/wrapper/gradle-wrapper.jar`.

**Step 4 (P1 — 2 hrs) — Android real voice connection:**
Implement `NetworkVoiceCallRepository` connecting WebSocket to `/api/voice/ws` and forwarding microphone PCM16 audio. This is the hackathon core demo path.

**Step 5 (P1 — 1 hr) — Wire RevenueCat Android SDK:**
Add SDK dependency, configure `Purchases` in `WebcraftApp`, implement minimal `RevenueCatBillingRepository` that calls the backend reconcile endpoint after a purchase.

**After these 5 steps, the submission demonstrates:**
- Named consistently as HQ-Employee
- All 142 backend tests passing via `npm test`
- Live voice agent conversation through Android or browser
- RevenueCat credit purchase flow end-to-end
