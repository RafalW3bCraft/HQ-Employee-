# HQ-Employee — Telephony & Calling Architecture

## 1. Calling Overview

The system supports two real voice interaction modalities with zero simulated production states:
1. **In-Browser Voice Agent**: Client audio streams to the backend bridge `/api/voice/ws`, which securely proxies to AssemblyAI Voice Agent API (`wss://agents.assemblyai.com/v1/ws`) using ephemeral HMAC-signed tokens.
2. **Real Outbound Telephony**: Real phone dialing with bidirectional media streaming:
   - **Primary Provider**: **CALL-E (`heycall-e.com`)** via REST API `POST https://api.heycall-e.com/v1/calls` and webhook events.
   - **Secondary Provider**: **Twilio Programmable Voice** via Calls REST resource and TwiML `<Connect><Stream ... /></Connect>`.
   - **Bidirectional Media Bridge**: `WS /media-stream/:callId` streaming 8 kHz G.711 μ-law (`audio/pcmu`) audio directly to/from AssemblyAI Voice Agent WebSocket with barge-in interruption clearing.

---

## 2. Governed 10-Step Pre-Call Pipeline

Before any outbound call is dispatched, the `OutboundTelephonyCoordinator` executes a mandatory 10-step verification gate:

```text
[ Outbound Call Request ]
           │
           ▼
[ Step 1: Concurrency Lock Check (Lead & Destination) ]
           │
[ Step 2: Strict E.164 Normalization & Emergency Prefix Block ]
           │
[ Step 3: Consent & Authorization Verification ]
           │
[ Step 4: Do-Not-Call (DNC) Suppression List Match ]
           │
[ Step 5: Permitted Calling Window (09:00 - 20:00 Recipient Time) ]
           │
[ Step 6: Employee Policy Engine Authorization (ALLOW / REQUIRE_APPROVAL / BLOCK) ]
           │
[ Step 7: Mandatory AI Identity Disclosure Verification ]
           │
[ Step 8: Credit Reservation (authoritative credit ledger) ]
           │
[ Step 9: Call Session Creation (Channel: TELEPHONY) ]
           │
[ Step 10: Carrier Invocation (CALL-E or Twilio) ]
           │
     Pass  │  Fail
   ┌───────┴───────┐
   ▼               ▼
[ Start Call ]  [ Release Credit Reservation & Record Audit Failure ]
```

---

## 3. TelephonyProvider Abstraction

Business logic depends strictly on the `TelephonyProvider` interface:

```typescript
export interface TelephonyProvider {
  name: string;
  initiateCall(params: InitiateCallParams): Promise<TelephonyCallResult>;
  placeCall(params: InitiateCallParams): Promise<TelephonyCallResult>;
  getCall(providerCallId: string): Promise<TelephonyCallStatus>;
  getCallStatus(providerCallId: string): Promise<TelephonyCallStatus>;
  endCall(providerCallId: string): Promise<void>;
  terminateCall(providerCallId: string): Promise<void>;
  hangupCall(providerCallId: string): Promise<void>;
  transferCall?(providerCallId: string, destinationE164: string): Promise<{ success: boolean; message: string }>;
  sendDtmf?(providerCallId: string, digits: string): Promise<{ success: boolean }>;
  validateNumber(phoneNumber: string): { valid: boolean; normalized?: string; error?: string };
  handleIncomingEvent(rawPayload: unknown, headers?: Record<string, string>): Promise<TelephonyEvent>;
  handleProviderEvent(rawPayload: unknown, headers?: Record<string, string>): Promise<TelephonyEvent>;
  handleWebhook?(rawPayload: unknown, headers?: Record<string, string>): Promise<TelephonyEvent>;
  generateCallControl?(callId: string, options?: Record<string, unknown>): string;
  generateMediaStreamUrl?(callId: string, baseUrl?: string): string;
}
```

### Implementations:
- `CalleTelephonyProvider`: Real outbound calling through CALL-E (`heycall-e.com`).
- `TwilioTelephonyProvider`: Outbound calling & TwiML stream generation via Twilio.
- `AssemblySIPProvider`: AssemblyAI SIP trunking adapter with signed webhook verification.
- `MockTelephonyProvider`: Isolated testing mock restricted exclusively to automated test suites.

---

## 4. API Endpoints

- `POST /api/calls`: Validate number, generate structured Call Plan, create session.
- `POST /api/calls/:id/start`: Initiate carrier dispatch.
- `POST /api/calls/:id/end`: Force terminate active call.
- `GET /api/calls/:id`: Inspect call metadata and live provider status.
- `GET /api/calls/:id/events`: Retrieve full audit trail, transcripts, and tool calls.
- `POST /api/calls/:id/handoff`: Register human escalation with assigned specialist.
- `POST /api/telephony/emergency-stop`: Emergency Global Call Stop.
- `POST /api/webhooks/calle`: Ingest Call-E carrier webhook events.
- `POST /api/webhooks/twilio/stream`: TwiML Media Stream connector.
- `WS /media-stream/:callId`: Bidirectional live audio stream bridge.

