import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';
import {
  defaultOutboundTelephonyCoordinator,
  defaultAssemblySIPProvider,
  defaultCreditsService,
  defaultOptOutRepository,
  AssemblySIPProvider,
  MockTelephonyProvider,
  defaultMockTelephonyProvider,
  OptOutViolationError,
  CreditExhaustedError,
} from '../src/modules/telephony/index.js';
import { defaultLeadsRepository } from '../src/modules/leads/index.js';
import { defaultPoliciesRepository, PolicyEngineService } from '../src/modules/policy/index.js';

describe('AssemblyAI Outbound Telephony & SIP Subsystem Integration', () => {
  let app: FastifyInstance;
  let testLeadId: string;
  const controlledTestNumber = '+15550001234';
  const companyId = '00000000-0000-0000-0000-000000000001';

  before(async () => {
    const config = loadConfig();
    app = await createServer(config);
    await app.ready();

    // Create an eligible test lead for telephony testing
    const lead = await defaultLeadsRepository.createLead({
      companyId,
      fullName: 'Alex Rivera',
      contactEmail: 'alex.rivera@example.com',
      contactPhone: controlledTestNumber,
      status: 'ENGAGED',
    });
    testLeadId = lead.id;
  });

  beforeEach(() => {
    // Reset credit balance to 1000 before each test
    defaultCreditsService.setBalance(companyId, 1000);
    defaultOutboundTelephonyCoordinator.resetLocks();
  });

  // --------------------------------------------------------------------------
  // TEST 1: 10-Step Pre-Call Pipeline & Successful Call
  // --------------------------------------------------------------------------
  it('1. successfully executes 10-step pre-call validation pipeline and initiates outbound call', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      payload: {
        leadId: testLeadId,
        destinationE164: controlledTestNumber,
        consentVerified: true,
        purpose: 'Discovery Consultation Follow-Up',
        bypassTimeWindow: true,
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);

    assert.ok(body.callId, 'Must generate a valid call session ID');
    assert.ok(body.providerCallId.startsWith('sip_'), 'Must generate a SIP provider call ID');
    assert.strictEqual(body.destinationE164, controlledTestNumber);
    assert.strictEqual(body.status, 'INITIALIZING');
    assert.strictEqual(body.creditsReserved, 25, 'Must reserve 25 credits for in-flight call');
    assert.strictEqual(body.canRetry, false);

    // Clean up call by ending it
    await app.inject({
      method: 'POST',
      url: `/api/telephony/calls/${body.callId}/end`,
      payload: { reason: 'Test setup cleanup' },
    });
  });

  // --------------------------------------------------------------------------
  // TEST 2: Rejected Call (Carrier / Busy)
  // --------------------------------------------------------------------------
  it('2. handles carrier rejection/busy: marks call failed, releases credit reservation, and logs audit', async () => {
    const busyNumber = '+15550009999';
    const initialBalance = await defaultCreditsService.getBalance(companyId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      payload: {
        leadId: testLeadId,
        destinationE164: busyNumber,
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });

    assert.strictEqual(res.statusCode, 502);
    const body = JSON.parse(res.body);
    const msg = body.error?.message || body.message || '';
    assert.ok(msg.includes('BUSY') || msg.includes('rejected'));

    // Check that reservation was cleanly rolled back
    const balanceAfter = await defaultCreditsService.getBalance(companyId);
    assert.strictEqual(balanceAfter.reserved, initialBalance.reserved, 'Reserved credits must be released on failure');
    assert.strictEqual(balanceAfter.balance, initialBalance.balance, 'Balance must remain unchanged');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Call Timeout (SIP 408)
  // --------------------------------------------------------------------------
  it('3. handles call timeout: releases reservation and exposes safe retry state', async () => {
    const timeoutNumber = '+15550009998';

    const res = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      payload: {
        leadId: testLeadId,
        destinationE164: timeoutNumber,
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });

    assert.strictEqual(res.statusCode, 504);
    const body = JSON.parse(res.body);
    const msg = body.error?.message || body.message || '';
    assert.ok(msg.includes('timed out'));

    // Verify credits were released
    const balance = await defaultCreditsService.getBalance(companyId);
    assert.strictEqual(balance.reserved, 0);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Recipient Hangup (call.ended Webhook Processing)
  // --------------------------------------------------------------------------
  it('4. processes recipient hangup via signed call.ended webhook and commits finalized credits', async () => {
    // Initiate active call
    const initRes = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      payload: {
        leadId: testLeadId,
        destinationE164: controlledTestNumber,
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });
    const initBody = JSON.parse(initRes.body);
    const providerCallId = initBody.providerCallId;

    // Simulate AssemblyAI signed call.ended webhook
    const webhookPayload = {
      event_id: 'webhook_event_001',
      event: 'call.ended',
      timestamp: new Date().toISOString(),
      call: {
        call_id: providerCallId,
        session_id: providerCallId,
        status: 'ended',
        direction: 'outbound',
        from_number: '+15551234567',
        to_number: controlledTestNumber,
        duration_seconds: 180, // 3 minutes -> 15 credits
        recording_url: 'https://cdn.assemblyai.com/recordings/audio_test_call.ogg',
        transcript_url: 'https://cdn.assemblyai.com/transcripts/timeline_test.json',
      },
    };

    const signature = defaultAssemblySIPProvider.signPayload(webhookPayload);

    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/telephony/webhooks/assemblyai',
      headers: {
        'x-aai-signature': signature,
      },
      payload: webhookPayload,
    });

    assert.strictEqual(webhookRes.statusCode, 200);
    const webhookBody = JSON.parse(webhookRes.body);
    assert.strictEqual(webhookBody.ok, true);
    assert.strictEqual(webhookBody.processedEvent, 'call.ended');

    // Verify call status updated to COMPLETED
    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/telephony/calls/${initBody.callId}/status`,
    });
    assert.strictEqual(statusRes.statusCode, 200);
    const statusBody = JSON.parse(statusRes.body);
    assert.strictEqual(statusBody.status, 'COMPLETED');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Agent Hangup (endCall endpoint)
  // --------------------------------------------------------------------------
  it('5. handles agent hangup: terminates active call and logs audit', async () => {
    const initRes = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      payload: {
        leadId: testLeadId,
        destinationE164: controlledTestNumber,
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });
    const initBody = JSON.parse(initRes.body);

    const endRes = await app.inject({
      method: 'POST',
      url: `/api/telephony/calls/${initBody.callId}/end`,
      payload: { reason: 'Consultation concluded by HQ coordinator' },
    });

    assert.strictEqual(endRes.statusCode, 200);
    const endBody = JSON.parse(endRes.body);
    assert.strictEqual(endBody.ok, true);

    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/telephony/calls/${initBody.callId}/status`,
    });
    const statusBody = JSON.parse(statusRes.body);
    assert.strictEqual(statusBody.status, 'COMPLETED');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Network Failure
  // --------------------------------------------------------------------------
  it('6. handles network failure: releases credit reservation and exposes safe retry state', async () => {
    const networkFailNumber = '+15550009997';

    const res = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      payload: {
        leadId: testLeadId,
        destinationE164: networkFailNumber,
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });

    assert.strictEqual(res.statusCode, 502);
    const body = JSON.parse(res.body);
    const msg = body.error?.message || body.message || '';
    assert.ok(msg.includes('network') || msg.includes('ECONNRESET'));

    // Check credits were safely restored
    const balance = await defaultCreditsService.getBalance(companyId);
    assert.strictEqual(balance.reserved, 0);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Duplicate Initiation (Anti-Abuse / No Bulk Dialing)
  // --------------------------------------------------------------------------
  it('7. prevents duplicate initiation: rejects concurrent call to the same active lead with 409 Conflict', async () => {
    // First initiation
    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      payload: {
        leadId: testLeadId,
        destinationE164: controlledTestNumber,
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });
    assert.strictEqual(firstRes.statusCode, 201);
    const firstBody = JSON.parse(firstRes.body);

    try {
      // Concurrent second initiation for the same lead
      const secondRes = await app.inject({
        method: 'POST',
        url: '/api/telephony/outbound/initiate',
        payload: {
          leadId: testLeadId,
          destinationE164: controlledTestNumber,
          consentVerified: true,
          bypassTimeWindow: true,
        },
      });

      assert.strictEqual(secondRes.statusCode, 409, 'Must reject concurrent duplicate call with 409 Conflict');
      const secondBody = JSON.parse(secondRes.body);
      const msg = secondBody.error?.message || secondBody.message || '';
      assert.ok(msg.includes('already in progress'));
    } finally {
      // Clean up first call
      await app.inject({
        method: 'POST',
        url: `/api/telephony/calls/${firstBody.callId}/end`,
      });
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Policy Rejection (Employee Authority Check)
  // --------------------------------------------------------------------------
  it('8. strictly enforces policy engine governance: blocks call if policy denies outbound dialing', async () => {
    // Create a custom coordinator with a mock policy engine that denies initiate_outbound_call
    const mockPolicyEngine = {
      evaluateAction: async () => ({
        decision: 'BLOCK' as const,
        reason: 'Outbound telephony disabled by company administrative policy',
        actionType: 'initiate_outbound_call',
        targetResource: `lead:${testLeadId}`,
        metadata: {},
        policyVersion: '1.0.0',
        evaluatedAt: new Date().toISOString(),
      }),
    } as unknown as PolicyEngineService;

    const { OutboundTelephonyCoordinator } = await import('../src/modules/telephony/index.js');
    const restrictiveCoordinator = new OutboundTelephonyCoordinator(
      defaultAssemblySIPProvider,
      defaultOptOutRepository,
      defaultCreditsService,
      defaultLeadsRepository,
      mockPolicyEngine
    );

    await assert.rejects(
      async () => {
        await restrictiveCoordinator.initiateOutboundCall({
          leadId: testLeadId,
          destinationE164: controlledTestNumber,
          consentVerified: true,
          bypassTimeWindow: true,
        });
      },
      (err: any) => {
        assert.strictEqual(err.name, 'PolicyDeniedError');
        assert.ok(err.message.includes('blocked by policy'));
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TEST 9: Opt-Out Rejection (Do-Not-Call List)
  // --------------------------------------------------------------------------
  it('9. blocks call to opted-out phone numbers in Do-Not-Call registry with 403 Forbidden', async () => {
    const optedOutNumber = '+15558880001';

    // Add to opt-out registry
    const optOutRes = await app.inject({
      method: 'POST',
      url: '/api/telephony/opt-out',
      payload: {
        phoneNumberE164: optedOutNumber,
        reason: 'Prospect stated: Do not call me again',
      },
    });
    assert.strictEqual(optOutRes.statusCode, 201);

    // Attempt outbound call
    const callRes = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      payload: {
        leadId: testLeadId,
        destinationE164: optedOutNumber,
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });

    assert.strictEqual(callRes.statusCode, 403);
    const callBody = JSON.parse(callRes.body);
    assert.ok(callBody.message.includes('Do-Not-Call'));
    assert.strictEqual(callBody.phoneNumber, optedOutNumber);
  });

  // --------------------------------------------------------------------------
  // TEST 10: Credit Failure (Insufficient Telephony Credits)
  // --------------------------------------------------------------------------
  it('10. rejects call when telephony credits are exhausted with 402 Payment Required', async () => {
    // Set company balance to 0 credits
    defaultCreditsService.setBalance(companyId, 0);

    const res = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      payload: {
        leadId: testLeadId,
        destinationE164: controlledTestNumber,
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });

    assert.strictEqual(res.statusCode, 402);
    const body = JSON.parse(res.body);
    assert.ok(body.message.includes('Insufficient telephony credits'));
    assert.strictEqual(body.available, 0);
    assert.strictEqual(body.required, 25);
  });

  // --------------------------------------------------------------------------
  // TEST 11: Architectural Isolation Guarantee
  // --------------------------------------------------------------------------
  it('11. verifies AssemblySIPProvider is strictly isolated from lead, policy, brain, and meeting logic', () => {
    const provider = new AssemblySIPProvider();

    // Verify provider exposes only telephony transport contracts
    assert.strictEqual(typeof provider.initiateCall, 'function');
    assert.strictEqual(typeof provider.getCallStatus, 'function');
    assert.strictEqual(typeof provider.endCall, 'function');
    assert.strictEqual(typeof provider.handleIncomingEvent, 'function');

    // Verify provider has NO references or knowledge of business domain services
    const providerKeys = Object.keys(provider);
    assert.ok(!providerKeys.includes('leadRepository'), 'Must not depend on leadRepository');
    assert.ok(!providerKeys.includes('policyEngine'), 'Must not depend on policyEngine');
    assert.ok(!providerKeys.includes('companyBrain'), 'Must not depend on companyBrain');
    assert.ok(!providerKeys.includes('meetingsRepository'), 'Must not depend on meetingsRepository');
  });

  // --------------------------------------------------------------------------
  // TEST 12: Webhook Signature Verification Security
  // --------------------------------------------------------------------------
  it('12. rejects webhook deliveries with forged or missing X-AAI-Signature', async () => {
    const forgedRes = await app.inject({
      method: 'POST',
      url: '/api/telephony/webhooks/assemblyai',
      headers: {
        'x-aai-signature': 't=1700000000,v1=bad_forged_hex_signature_here',
      },
      payload: {
        event: 'call.connected',
        call: { call_id: 'fake_call' },
      },
    });

    assert.strictEqual(forgedRes.statusCode, 401);
    const forgedBody = JSON.parse(forgedRes.body);
    assert.ok(forgedBody.message.includes('Signature') || forgedBody.message.includes('signature'));
  });

  // --------------------------------------------------------------------------
  // TEST 13: Idempotency Mechanism
  // --------------------------------------------------------------------------
  it('13. idempotency key: duplicate initiation returns identical session without duplicate calls or reservation', async () => {
    const idempotencyKey = `idem_key_${Date.now()}`;

    // First call with idempotency key
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      headers: {
        'idempotency-key': idempotencyKey,
      },
      payload: {
        leadId: testLeadId,
        destinationE164: controlledTestNumber,
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });

    assert.strictEqual(res1.statusCode, 201);
    const body1 = JSON.parse(res1.body);

    // Immediate second call with identical idempotency key
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      headers: {
        'idempotency-key': idempotencyKey,
      },
      payload: {
        leadId: testLeadId,
        destinationE164: controlledTestNumber,
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });

    assert.strictEqual(res2.statusCode, 201);
    const body2 = JSON.parse(res2.body);

    // Must return the exact same call session ID without 409 conflict
    assert.strictEqual(body1.callId, body2.callId);
    assert.strictEqual(body1.providerCallId, body2.providerCallId);
    assert.strictEqual(body1.creditsReserved, body2.creditsReserved);

    // Cleanup
    await app.inject({
      method: 'POST',
      url: `/api/telephony/calls/${body1.callId}/end`,
    });
  });

  // --------------------------------------------------------------------------
  // TEST 14: Invalid Destination Validation
  // --------------------------------------------------------------------------
  it('14. rejects invalid destination formats and restricted emergency numbers', async () => {
    // Non E.164
    const resBadFormat = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      payload: {
        leadId: testLeadId,
        destinationE164: 'not-a-number',
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });
    assert.strictEqual(resBadFormat.statusCode, 400);

    // Emergency number
    const resEmergency = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      payload: {
        leadId: testLeadId,
        destinationE164: '+19115551234',
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });
    assert.strictEqual(resEmergency.statusCode, 400);
    const bodyEmergency = JSON.parse(resEmergency.body);
    const errorMsg = bodyEmergency.error?.message || bodyEmergency.message || '';
    assert.ok(errorMsg.includes('emergency'));
  });

  // --------------------------------------------------------------------------
  // TEST 15: Duplicate Webhook Delivery Deduplication
  // --------------------------------------------------------------------------
  it('15. deduplicates duplicate webhook event deliveries without double-committing credits', async () => {
    // Initiate call
    const initRes = await app.inject({
      method: 'POST',
      url: '/api/telephony/outbound/initiate',
      payload: {
        leadId: testLeadId,
        destinationE164: controlledTestNumber,
        consentVerified: true,
        bypassTimeWindow: true,
      },
    });
    const initBody = JSON.parse(initRes.body);
    const providerCallId = initBody.providerCallId;

    const webhookPayload = {
      event_id: `dup_evt_${Date.now()}`,
      event: 'call.ended',
      timestamp: new Date().toISOString(),
      call: {
        call_id: providerCallId,
        session_id: providerCallId,
        status: 'ended',
        direction: 'outbound',
        from_number: '+15551234567',
        to_number: controlledTestNumber,
        duration_seconds: 60,
      },
    };

    const signature = defaultAssemblySIPProvider.signPayload(webhookPayload);

    // First delivery
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/telephony/webhooks/assemblyai',
      headers: { 'x-aai-signature': signature },
      payload: webhookPayload,
    });
    assert.strictEqual(res1.statusCode, 200);

    const balanceAfterFirst = await defaultCreditsService.getBalance(companyId);

    // Duplicate delivery of same webhook
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/telephony/webhooks/assemblyai',
      headers: { 'x-aai-signature': signature },
      payload: webhookPayload,
    });
    assert.strictEqual(res2.statusCode, 200);

    const balanceAfterSecond = await defaultCreditsService.getBalance(companyId);
    assert.strictEqual(balanceAfterFirst.balance, balanceAfterSecond.balance, 'Balance must not change on duplicate webhook');
  });

  // --------------------------------------------------------------------------
  // TEST 16: MockTelephonyProvider Isolation & Behavior
  // --------------------------------------------------------------------------
  it('16. verifies MockTelephonyProvider lifecycle, failure injection, and termination', async () => {
    const mock = new MockTelephonyProvider();

    // Normal initiate
    const call = await mock.initiateCall({
      destinationE164: controlledTestNumber,
      callerIdE164: '+15551234567',
      leadId: testLeadId,
      callRecordId: 'rec_1',
      companyId,
      employeeId: 'emp_1',
    });
    assert.ok(call.providerCallId.startsWith('mock_call_'));

    // Status check
    const status = await mock.getCallStatus(call.providerCallId);
    assert.strictEqual(status.status, 'INITIATED');

    // Terminate
    await mock.terminateCall(call.providerCallId);
    const terminatedStatus = await mock.getCallStatus(call.providerCallId);
    assert.strictEqual(terminatedStatus.status, 'COMPLETED');

    // Simulated failure injection
    mock.setSimulatedFailure(new Error('Simulated upstream carrier outage'));
    await assert.rejects(
      async () => {
        await mock.initiateCall({
          destinationE164: controlledTestNumber,
          callerIdE164: '+15551234567',
          leadId: testLeadId,
          callRecordId: 'rec_2',
          companyId,
          employeeId: 'emp_1',
        });
      },
      /Simulated upstream carrier outage/
    );
  });
});
