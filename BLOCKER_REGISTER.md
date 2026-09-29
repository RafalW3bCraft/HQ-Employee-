# HQ-Employee — Blocker Register

> Evidence-based defect and blocker register.
> Each blocker is verified against actual source code and command output — no speculative entries.
> Severity levels:
> - **P0**: Complete submission-blocking crash or total outage
> - **P1**: Judge-reproducibility failure, core demo malfunction, or missing required platform component
> - **P2**: Production architectural gap, partial simulation, or unverified secondary subsystem
> - **P3**: Documentation mismatch or cosmetic inconsistency

---

## BLK-001 — npm test script glob expansion failure

| Field | Value |
|---|---|
| **ID** | BLK-001 |
| **SEVERITY** | P1 |
| **FILE** | `backend/package.json` line 11 |
| **FUNCTION** | `scripts.test` |
| **OBSERVED** | Initial `npm test` using glob `test/**/*.test.ts` failed on Node 22 Linux shells with: `Could not find '/home/watcher/Desktop/employee/backend/test/**/*.test.ts'` |
| **EXPECTED** | `npm test` runs all 18 test suites and exits code 0 with all tests passing. |
| **ROOT CAUSE** | Node's `--test` runner receives the glob literal `test/**/*.test.ts` as an unexpanded string in non-interactive subshells invoked by `npm test`. |
| **MINIMAL FIX** | Explicitly list all 18 test files in `backend/package.json` under `scripts.test`. |
| **REGRESSION TEST** | `cd backend && npm test` runs cleanly and reports `ℹ tests 146, ℹ pass 146, ℹ fail 0`. |
| **STATUS** | **RESOLVED** (Verified on local environment: 146/146 tests passing) |

---

## BLK-002 — Android Gradle wrapper missing from repository

| Field | Value |
|---|---|
| **ID** | BLK-002 |
| **SEVERITY** | P1 |
| **FILE** | `android/gradlew`, `android/gradle/wrapper/gradle-wrapper.jar` |
| **FUNCTION** | Android command-line compilation (`./gradlew assembleDebug`) |
| **OBSERVED** | Executing `cd android && ./gradlew assembleDebug` exits with: `bash: ./gradlew: No such file or directory`. The directory `android/gradle/wrapper/` contains only `gradle-wrapper.properties` (specifying Gradle 8.9), but lacks `gradlew`, `gradlew.bat`, and `gradle-wrapper.jar`. |
| **EXPECTED** | Standard Gradle wrapper files present in repository, allowing automated debug APK builds. |
| **ROOT CAUSE** | The Gradle wrapper binary and shell script were omitted from git/archive packaging. |
| **MINIMAL FIX** | Generate or place standard Gradle 8.9 wrapper scripts (`gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar`) with executable permissions (`chmod +x gradlew`). Note: host environment also requires Android SDK / Java 17-21 toolchain to execute compilation. |
| **REGRESSION TEST** | `cd android && ./gradlew --version` executes cleanly and outputs Gradle 8.9. |
| **STATUS** | **OPEN** |

---

## BLK-003 — Android real networking layer entirely absent

| Field | Value |
|---|---|
| **ID** | BLK-003 |
| **SEVERITY** | P1 |
| **FILE** | `android/app/src/main/java/com/webcraft/employee/data/` |
| **FUNCTION** | All repository implementations |
| **OBSERVED** | All Android repository implementations (`FakeLeadRepository`, `FakeMeetingRepository`, `FakeEmployeeRepository`, `FakeCompanyBrainRepository`, `FakeBillingRepository`, `FakeVoiceCallRepository`) reside in `data/fake/`. They operate solely on in-memory mock data with hard-coded responses and `delay()` timers. There are no Retrofit, OkHttp, Ktor, or WebSocket networking classes. |
| **EXPECTED** | Domain interfaces backed by at least `NetworkVoiceCallRepository` (connecting to `/api/voice/ws`) and `NetworkBillingRepository` (connecting to `/api/billing/*`). |
| **ROOT CAUSE** | Mobile UI was developed against mock data; network integration classes were never written. |
| **MINIMAL FIX** | Implement `NetworkVoiceCallRepository` communicating over WebSocket with the backend voice gateway and streaming PCM16 microphone audio, and `NetworkBillingRepository` fetching wallet balances from `/api/billing/wallet`. |
| **REGRESSION TEST** | Launching the Android app against a running backend displays live wallet balance from backend and establishes a real-time call. |
| **STATUS** | **OPEN** |

---

## BLK-004 — RevenueCat Android SDK missing from build.gradle.kts

| Field | Value |
|---|---|
| **ID** | BLK-004 |
| **SEVERITY** | P1 |
| **FILE** | `android/app/build.gradle.kts`, `android/gradle/libs.versions.toml` |
| **FUNCTION** | Android dependencies configuration |
| **OBSERVED** | Neither `android/app/build.gradle.kts` nor `libs.versions.toml` includes the RevenueCat Purchases SDK (`com.revenuecat.purchases:purchases`). `FakeBillingRepository` simulates purchases locally without invoking RevenueCat SDK methods. |
| **EXPECTED** | RevenueCat Android SDK dependency declared, configured in `WebcraftApp.onCreate()`, and invoked during in-app purchase checkout before receipt submission. |
| **ROOT CAUSE** | The mobile client SDK was omitted during initial UI prototype setup. |
| **MINIMAL FIX** | Add `implementation("com.revenuecat.purchases:purchases:8.x.x")` to `android/app/build.gradle.kts`, configure `Purchases.configure()` with public API key, and wire purchase reconciliation callback. |
| **REGRESSION TEST** | Compiling Android dependencies resolves the Purchases SDK; purchasing a test credit pack invokes RevenueCat SDK. |
| **STATUS** | **OPEN** |

---

## BLK-005 — Product naming inconsistency across repository

| Field | Value |
|---|---|
| **ID** | BLK-005 |
| **SEVERITY** | P1 |
| **FILE** | Multiple (backend, android, docs) |
| **FUNCTION** | Application branding, user-visible strings, route health tags |
| **OBSERVED** | The project is inconsistently identified across files: `"HQ"` (`strings.xml`), `"HQ Employee"` (`docs/JUDGE_ACCESS.md`), `"Webcraft Employee"` (`docs/AGENTS.md`, `docs/PROJECT_SPEC.md`), `"webcraft-employee-backend"` (`backend/package.json`), and `"hq-employee-api"` (`server.ts`). |
| **EXPECTED** | Uniform user-visible branding and product references as **HQ-Employee**. |
| **ROOT CAUSE** | Iterative renaming occurred without an atomic cross-codebase replacement. |
| **MINIMAL FIX** | Standardize user-visible strings and documentation headers to **HQ-Employee** (leaving Java package names intact to avoid breaking package directory paths). |
| **REGRESSION TEST** | `grep -r "Webcraft Employee" backend/src/ docs/` returns zero matches outside historical git logs. |
| **STATUS** | **OPEN** |

---

## BLK-006 — Database persistence unverified; silent swallow on connection failure

| Field | Value |
|---|---|
| **ID** | BLK-006 |
| **SEVERITY** | P2 |
| **FILE** | `backend/src/db/index.ts`, `backend/src/modules/calls/index.ts`, `backend/src/modules/audit/index.ts`, `backend/src/modules/meetings/index.ts` |
| **FUNCTION** | All database query wrapper methods |
| **OBSERVED** | All database writes catch SQL/connection errors silently and fall back to in-memory state. In development or test mode, the server operates without a live PostgreSQL database, but in production this masks broken database connections. |
| **EXPECTED** | In `NODE_ENV=production`, failed database writes should fail loudly or log error-level diagnostics rather than silently dropping data on process restart. |
| **ROOT CAUSE** | Fallback designed for zero-config hackathon judging without distinguishing dev vs. production error severity. |
| **MINIMAL FIX** | Add explicit logger warning on database connection fallback, and document clearly that in-memory mode is active when `DATABASE_URL` is unreachable. |
| **REGRESSION TEST** | When `NODE_ENV=production` and `DATABASE_URL` is invalid, the startup lifecycle logs an error or raises a configuration warning. |
| **STATUS** | **OPEN** |

---

## BLK-007 — AssemblyAI SIP / live telephony is fully simulated

| Field | Value |
|---|---|
| **ID** | BLK-007 |
| **SEVERITY** | P2 |
| **FILE** | `backend/src/modules/telephony/index.ts` |
| **FUNCTION** | `AssemblySIPProvider.initiateCall()` lines 320–367 |
| **OBSERVED** | `AssemblySIPProvider.initiateCall()` produces synthetic UUIDs and simulates carrier busy/timeout/disconnect responses based on number suffixes (`9999`, `9998`, `9997`). No outbound SIP connection or network dispatch to `sip.assemblyai.com` occurs. |
| **EXPECTED** | Dispatch of actual SIP call through an AssemblyAI SIP trunk or documented clarification that telephony runs in simulated carrier mode. |
| **ROOT CAUSE** | SIP trunking was specified in architecture documents but implemented as a test harness simulator. |
| **MINIMAL FIX** | Clearly document telephony simulation status in submission materials; outbound coordinator pipeline (DNC, TCPA, credits) is real and fully verified. |
| **REGRESSION TEST** | All 16 telephony tests in `assemblyai-telephony.test.ts` pass against the coordinator and provider interface. |
| **STATUS** | **OPEN** (Documented as simulated) |

---

## BLK-008 — RevenueCat receipt reconciliation does not call RevenueCat REST API

| Field | Value |
|---|---|
| **ID** | BLK-008 |
| **SEVERITY** | P2 |
| **FILE** | `backend/src/modules/billing/index.ts` |
| **FUNCTION** | `BillingService.reconcilePurchase()` lines 312–349 |
| **OBSERVED** | `reconcilePurchase()` checks that `productId` exists in the local catalog and that `transactionReceiptId` is non-empty, then immediately credits the wallet. It does not invoke `https://api.revenuecat.com/v1/receipts` to verify Apple/Google receipts. (The server-to-server webhook path `/api/billing/webhooks` IS fully verified and idempotent). |
| **EXPECTED** | Direct client receipt submissions verified against RevenueCat REST API using `REVENUECAT_SECRET_KEY` before credit ledger grant. |
| **ROOT CAUSE** | Receipt endpoint implemented as a catalog validator pending live store sandbox credentials. |
| **MINIMAL FIX** | Document that the server-to-server webhook endpoint is the authoritative production grant path; optionally add outbound HTTP verification to `reconcilePurchase`. |
| **REGRESSION TEST** | Submitting forged receipt tokens without valid webhook confirmation is rejected in production mode. |
| **STATUS** | **OPEN** |

---

## BLK-009 — Hilt DI listed in version catalog but not wired in Android build

| Field | Value |
|---|---|
| **ID** | BLK-009 |
| **SEVERITY** | P2 |
| **FILE** | `android/build.gradle.kts`, `android/app/build.gradle.kts`, `android/gradle/libs.versions.toml` |
| **FUNCTION** | Dependency injection architecture |
| **OBSERVED** | `libs.versions.toml` lists Hilt versions and plugins, but `app/build.gradle.kts` does not apply the plugin or add the dependencies. The application currently uses manual dependency injection via `AppContainer`. |
| **EXPECTED** | Consistent DI configuration: either full Hilt setup or clean removal of unused Hilt entries in favor of manual `AppContainer`. |
| **ROOT CAUSE** | Incomplete migration between manual container injection and Hilt. |
| **MINIMAL FIX** | Clean up `libs.versions.toml` to remove unused Hilt references, maintaining the simpler, working manual `AppContainer`. |
| **REGRESSION TEST** | Android build configuration evaluates without unresolved plugin/library warnings. |
| **STATUS** | **OPEN** |

---

## BLK-010 — `@fastify/static` referenced in README but not installed or registered

| Field | Value |
|---|---|
| **ID** | BLK-010 |
| **SEVERITY** | P3 |
| **FILE** | `README.md`, `backend/src/server.ts` |
| **FUNCTION** | Documentation of static asset serving |
| **OBSERVED** | `README.md` claims `@fastify/static` is used to serve `public/voice-tester.html`. In reality, `server.ts` does not register `@fastify/static`; the file is served via a custom `GET /voice-tester` route in `backend/src/routes/voice.ts`. |
| **EXPECTED** | Documentation accurately describes how `GET /voice-tester` resolves and serves the HTML file. |
| **ROOT CAUSE** | Speculative documentation written prior to route implementation. |
| **MINIMAL FIX** | Update `README.md` to document the actual route-based serving mechanism. |
| **REGRESSION TEST** | Verify `GET /voice-tester` returns 200 OK with HTML content. |
| **STATUS** | **OPEN** (Documentation fix only) |

---

## BLK-011 — Test suite per-file counts and durations in README/docs are wrong

| Field | Value |
|---|---|
| **ID** | BLK-011 |
| **SEVERITY** | P3 |
| **FILE** | `README.md` §3 & §7, `docs/JUDGE_ACCESS.md` §1 |
| **FUNCTION** | Test report documentation |
| **OBSERVED** | Documents claim "142 tests" and "~1.2s duration". The actual output is **146 tests** and **~111.7s duration** (due to realistic timer simulation in telephony and meeting suites). Several individual suite counts in `README.md` tables are also outdated. |
| **EXPECTED** | Exact counts and realistic execution times documented for judges. |
| **ROOT CAUSE** | Tests were added and timers introduced without synchronizing documentation tables. |
| **MINIMAL FIX** | Update `README.md` and `docs/JUDGE_ACCESS.md` to reflect 146 tests across 18 suites and ~110s runtime. |
| **REGRESSION TEST** | `npm test` output matches documented counts. |
| **STATUS** | **OPEN** (Documentation fix only) |

---

## BLK-012 — AssemblyAI Voice Agent tool.result delivery delayed until reply.done

| Field | Value |
|---|---|
| **ID** | BLK-012 |
| **SEVERITY** | P1 |
| **FILE** | `backend/src/routes/voice.ts` lines 98–118 & 160–205 |
| **FUNCTION** | `flushPendingTools` and `tool.call` WebSocket handler |
| **OBSERVED** | In `voice.ts`, `flushPendingTools()` guards on `lastAssemblyEvent !== 'reply.done'`, which delays sending `tool.result` to AssemblyAI Voice Agent until the agent concludes its speaking turn. If `reply.done` has `status === 'interrupted'`, the pending tool result is cleared entirely (`pendingTools.length = 0`). |
| **EXPECTED** | Per AssemblyAI Voice Agent API specification and prompt requirements, `tool.result` must be dispatched **immediately** over upstream WebSocket as soon as the backend Policy Engine finishes governed execution. |
| **ROOT CAUSE** | Flawed queuing mechanism attempted to debounce tool execution against speaking events. |
| **MINIMAL FIX** | In `voice.ts`, send `tool.result` frame immediately after `assemblyService.executeTool(...)` completes; remove the delayed `flushPendingTools()` bottleneck. |
| **REGRESSION TEST** | Upstream WebSocket receives `tool.result` immediately upon tool completion without requiring a preceding `reply.done` event. |
| **STATUS** | **RESOLVED** (Immediate dispatch verified in `backend/src/routes/voice.ts`) |

---

## Blocker Summary & Action Plan

| ID | Severity | Area | Title | Status |
|---|---|---|---|---|
| BLK-001 | P1 | Backend | `npm test` glob expansion failure | **RESOLVED** |
| BLK-002 | P1 | Android | Android Gradle wrapper missing from repository | OPEN |
| BLK-003 | P1 | Android | Android real networking layer entirely absent | OPEN |
| BLK-004 | P1 | Android | RevenueCat Android SDK missing from build.gradle.kts | OPEN |
| BLK-005 | P1 | Docs/Code | Product naming inconsistency across repository | OPEN |
| BLK-006 | P2 | Backend | Database persistence unverified; silent swallow on failure | OPEN |
| BLK-007 | P2 | Backend | AssemblyAI SIP / live telephony is fully simulated | OPEN |
| BLK-008 | P2 | Backend | RevenueCat receipt reconciliation does not call RC REST API | OPEN |
| BLK-009 | P2 | Android | Hilt DI in version catalog but not wired in build | OPEN |
| BLK-010 | P3 | Docs | `@fastify/static` referenced in README but not installed | OPEN |
| BLK-011 | P3 | Docs | Test suite counts and duration in README/docs are wrong | OPEN |
| BLK-012 | P1 | Backend | AssemblyAI Voice Agent tool.result delivery delayed | **RESOLVED** |

---

## Recommended Next Implementation Step

Proceed to **Phase 2 (AssemblyAI Voice Agent Live Demo Implementation)**:
1. **Fix BLK-012**: Eliminate the tool delivery delay in `backend/src/routes/voice.ts` so `tool.result` is dispatched immediately after Policy Engine execution.
2. **Verify Browser Microphone & Playback**: Confirm end-to-end PCM16 capture, 24kHz buffer playback, and interruption flushing in `voice-tester.html` with automated regression tests.
3. **Execute Golden Test Conversation**: Validate the end-to-end conversation flow (Discovery → Qualification → Pricing Guidance → Meeting Scheduling → Human Approval Escalation → Contract Blocking).
