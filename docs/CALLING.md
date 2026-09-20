# Webcraft Employee — Calling & Telephony Specification

## 1. Calling Overview

The system supports two voice interaction modalities:
1. **In-App / Browser WebRTC / Audio Stream**: Client streams 24kHz PCM16 audio to/from backend/AssemblyAI Voice Agent API.
2. **Telephony Bridge**: Inbound/Outbound PSTN/SIP calling abstracted via `TelephonyProvider`.

---

## 2. Compliance Gate for Outbound Dialing

Before initiating any outbound call, the backend runs a mandatory deterministic compliance check:

```text
[ Outbound Call Request ]
           │
           ▼
[ Compliance Gate Validation ]
  ├── 1. Destination E.164 phone format valid?
  ├── 2. Prospect opted out / on Do-Not-Call list?
  ├── 3. Within permitted business hours for prospect timezone (9 AM - 6 PM)?
  ├── 4. Has calling purpose and legitimate business interest?
  ├── 5. Are required AI disclosure statements configured?
  └── 6. Does company have sufficient call credits reserved?
           │
     Pass  │  Fail
   ┌───────┴───────┐
   ▼               ▼
[ Reserve Credits ] [ Reject Call with Audit Log ]
   │
   ▼
[ Dial Destination ]
```

---

## 3. TelephonyProvider Abstraction

Business services depend strictly on the interface:

```typescript
export interface TelephonyProvider {
  name: string;
  initiateOutboundCall(request: OutboundCallRequest): Promise<CallSession>;
  terminateCall(callId: string): Promise<void>;
  handleIncomingCall(webhookPayload: unknown): Promise<InboundCallResponse>;
}
```

Implementations:
- `AssemblySIPProvider`: Direct AssemblyAI-compatible SIP trunk routing.
- `MockTelephonyProvider`: Deterministic mock provider for local development, automated tests, and CI/CD.
- Future providers can be added without altering lead qualification logic.
