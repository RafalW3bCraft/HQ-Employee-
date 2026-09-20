# Webcraft Employee — Release & Hackathon Readiness

## 1. Hackathon Goals

Webcraft Employee targets two simultaneous submissions:
1. **RevenueCat Shipaton 2026**: Demonstrating mobile monetization, credit wallets, and in-app purchase reconciliation.
2. **AssemblyAI Voice Agent Hackathon**: Demonstrating real-time voice interaction, edge routing, governed business tool execution, and voice agent turn-taking.

---

## 2. Readiness Checklist

### Security & Governance
- [ ] No API keys or secrets in Android source or APK bundle.
- [ ] Backend is authoritative for credit checks, policy decisions, and call grants.
- [ ] Policy engine enforces `ALLOW`, `REQUIRE_APPROVAL`, `BLOCK`.
- [ ] Deterministic refusal messages for unapproved or out-of-scope actions.

### AssemblyAI Integration
- [ ] Edge routing endpoint used (`wss://streaming.assemblyai.com/v3/ws` or Voice Agent `wss://agents.assemblyai.com/v1/ws`).
- [ ] Temporary session tokens generated server-side for mobile clients.
- [ ] Explicit WebSocket termination on call hangup.
- [ ] Flat function definitions used for tool calling.

### RevenueCat Integration
- [ ] Products configured for credit tiers.
- [ ] Immutable credit transaction ledger implemented.
- [ ] Idempotency keys used for all purchase webhooks.

### Android Application
- [ ] Jetpack Compose Material 3 UI with consistent theme tokens.
- [ ] Clean Architecture separation (`UI → ViewModel → Use Case → Repository`).
- [ ] All required screens operational: Dashboard, Leads, Lead Detail, Meetings, Employee, Company Brain, Settings.
