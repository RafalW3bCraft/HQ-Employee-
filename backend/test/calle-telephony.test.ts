import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';
import {
  CalleTelephonyProvider,
  defaultCalleTelephonyProvider,
  defaultOutboundTelephonyCoordinator,
  defaultOptOutRepository,
} from '../src/modules/telephony/index.js';

describe('CALL-E (heycall-e.com) Telephony Integration', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    const testConfig = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
      ASSEMBLYAI_API_KEY: 'test_key',
      JWT_SECRET: 'dev_test_secret_for_calle_unit_tests_32chars',
    });
    server = await createServer(testConfig);
    defaultOutboundTelephonyCoordinator.resetLocks();
  });

  // 1. E.164 Phone Validation
  it('1. validates strict E.164 phone number formatting', () => {
    const provider = new CalleTelephonyProvider();

    const validUS = provider.validateNumber('+14155550199');
    assert.strictEqual(validUS.valid, true);
    assert.strictEqual(validUS.normalized, '+14155550199');

    const validIndia = provider.validateNumber('+919876543210');
    assert.strictEqual(validIndia.valid, true);
    assert.strictEqual(validIndia.normalized, '+919876543210');

    const invalidShort = provider.validateNumber('555-1234');
    assert.strictEqual(invalidShort.valid, false);
    assert.ok(invalidShort.error?.includes('Invalid E.164'));

    const invalidNoPlus = provider.validateNumber('14155550199');
    assert.strictEqual(invalidNoPlus.valid, false);

    const empty = provider.validateNumber('');
    assert.strictEqual(empty.valid, false);
  });

  // 2. Fails honestly when NOT CONFIGURED
  it('2. fails honestly with NOT CONFIGURED when CALLE_API_KEY is not set', async () => {
    const unconfigured = new CalleTelephonyProvider({ apiKey: '' });
    assert.strictEqual(unconfigured.isConfigured(), false);

    const health = await unconfigured.checkHealth();
    assert.strictEqual(health.status, 'NOT CONFIGURED');
    assert.ok(health.message.includes('CALLE_API_KEY is not set'));

    await assert.rejects(
      async () => {
        await unconfigured.initiateCall({
          destinationE164: '+14155550100',
          callerIdE164: '+15551234567',
          leadId: 'lead-test',
          callRecordId: 'call-rec-test',
          companyId: 'comp-1',
          employeeId: 'emp-1',
        });
      },
      /NOT CONFIGURED/
    );
  });

  // 3. Webhook Event Normalization
  it('3. handles and normalizes CALL-E webhook payloads', async () => {
    const provider = new CalleTelephonyProvider();

    const completedPayload = {
      id: 'evt_test_123',
      type: 'call.completed' as const,
      created_at: new Date().toISOString(),
      data: {
        id: 'call_calle_999',
        object: 'call',
        status: 'completed' as const,
        duration_seconds: 75,
        phone_number: '+14155550199',
        result: {
          qualified: true,
          intent: 'Website Redesign',
          meeting_requested: true,
        },
      },
    };

    const event = await provider.handleIncomingEvent(completedPayload);
    assert.strictEqual(event.eventType, 'call.ended');
    assert.strictEqual(event.providerCallId, 'call_calle_999');
    assert.strictEqual(event.durationSeconds, 75);
    assert.strictEqual(event.toNumber, '+14155550199');
  });

  // 4. POST /api/calls generates structured Call Plan
  it('4. POST /api/calls validates number and generates structured Call Plan', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        fullName: 'Alexander Wright',
        phoneNumber: '+14155550144',
        purpose: 'Custom ERP portal opportunity',
        consentVerified: true,
        provider: 'calle',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = res.json();
    assert.ok(body.callId);
    assert.strictEqual(body.destinationE164, '+14155550144');
    assert.strictEqual(body.status, 'CREATED');
    assert.strictEqual(body.provider, 'calle');

    const plan = body.callPlan;
    assert.ok(plan);
    assert.strictEqual(plan.objective, 'Custom ERP portal opportunity');
    assert.ok(Array.isArray(plan.missingFacts));
    assert.ok(plan.allowedActions.includes('schedule_meeting'));
    assert.ok(plan.blockedActions.includes('custom_discount_outside_approved_range'));
  });

  // 5. POST /api/calls blocks numbers on DNC suppression list
  it('5. POST /api/calls blocks numbers on Do-Not-Call suppression list', async () => {
    const dncNumber = '+14155550999';
    await defaultOptOutRepository.addOptOut(dncNumber, 'Permanent suppression test');

    const res = await server.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        fullName: 'Blocked Client',
        phoneNumber: dncNumber,
        consentVerified: true,
      },
    });

    assert.strictEqual(res.statusCode, 403);
    const body = res.json();
    assert.strictEqual(body.state, 'COMPLIANCE_BLOCKED');
    assert.ok(body.message.includes('suppression list'));
  });

  // 6. POST /api/calls/:id/handoff registers human handoff audit event
  it('6. POST /api/calls/:id/handoff escalates call to human with audit record', async () => {
    const callRes = await server.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        fullName: 'Enterprise Lead',
        phoneNumber: '+14155550188',
        consentVerified: true,
      },
    });
    const { callId } = callRes.json();

    const handoffRes = await server.inject({
      method: 'POST',
      url: `/api/calls/${callId}/handoff`,
      payload: {
        reason: 'Client requested non-standard enterprise SLA contract terms',
        assignedHuman: 'lead-architect',
      },
    });

    assert.strictEqual(handoffRes.statusCode, 200);
    const body = handoffRes.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.handoff.reason, 'Client requested non-standard enterprise SLA contract terms');
    assert.strictEqual(body.handoff.assignedHuman, 'lead-architect');
  });

  // 7. Emergency stop halts calls and resets locks
  it('7. POST /api/telephony/emergency-stop activates global call halt', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/telephony/emergency-stop',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.ok, true);
    assert.ok(body.message.includes('Global Call Stop activated'));
  });

  // 8. Call-E Webhook endpoint accepts events
  it('8. POST /api/webhooks/calle receives and acknowledges events', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/webhooks/calle',
      payload: {
        id: 'evt_test_ack',
        type: 'call.in_progress',
        created_at: new Date().toISOString(),
        data: {
          id: 'call_live_123',
          status: 'in_progress',
          phone_number: '+14155550100',
        },
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.processedEvent, 'call.connected');
  });

  // 9. Provider abstraction methods (Section 4 requirement)
  it('9. provides placeCall, getCall, hangupCall, transferCall, sendDtmf, generateCallControl, generateMediaStreamUrl', async () => {
    const provider = new CalleTelephonyProvider();
    
    // Media stream URL generation
    const streamUrl = provider.generateMediaStreamUrl('call_999', 'api.heycall-e.com');
    assert.strictEqual(streamUrl, 'wss://api.heycall-e.com/media-stream/call_999');

    // Call control generation
    const controlJson = provider.generateCallControl('call_999', { test: true });
    assert.ok(controlJson.includes('calle_connect'));

    // transferCall & sendDtmf
    const transfer = await provider.transferCall('call_999', '+14155550199');
    assert.strictEqual(transfer.success, true);
    const dtmf = await provider.sendDtmf('call_999', '1234');
    assert.strictEqual(dtmf.success, true);
  });

  // 10. GET /api/calls/:id/events (Section 4 requirement)
  it('10. GET /api/calls/:id/events retrieves audit trail and transcripts for a call', async () => {
    // Create a call first
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        fullName: 'Jane Doe',
        phoneNumber: '+14155550299',
        purpose: 'Events Audit Verification',
      },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const created = createRes.json();
    const callId = created.callId;

    const eventsRes = await server.inject({
      method: 'GET',
      url: `/api/calls/${callId}/events`,
    });
    assert.strictEqual(eventsRes.statusCode, 200);
    const eventsBody = eventsRes.json();
    assert.strictEqual(eventsBody.callId, callId);
    assert.ok(Array.isArray(eventsBody.events));
    assert.ok(Array.isArray(eventsBody.transcripts));
    assert.ok(Array.isArray(eventsBody.toolCalls));
  });

  // 11. POST /api/webhooks/twilio/stream returns TwiML with Connect Stream
  it('11. POST /api/webhooks/twilio/stream generates bidirectional TwiML Stream XML', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/webhooks/twilio/stream',
      payload: {
        CallSid: 'CA_test_stream_sid',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type']?.includes('text/xml'));
    assert.ok(res.payload.includes('<Connect>'));
    assert.ok(res.payload.includes('<Stream url="wss://'));
    assert.ok(res.payload.includes('media-stream/CA_test_stream_sid'));
  });

  // 12. Calendar API Group (Section 46: /api/calendar)
  it('12. /api/calendar availability and events endpoints work reliably', async () => {
    // Availability query
    const availRes = await server.inject({
      method: 'GET',
      url: '/api/calendar/availability?fromDate=2026-10-01&toDate=2026-10-02',
    });
    assert.strictEqual(availRes.statusCode, 200);
    const availBody = availRes.json();
    assert.ok(Array.isArray(availBody.slots));

    // Events list query
    const eventsRes = await server.inject({
      method: 'GET',
      url: '/api/calendar/events',
    });
    assert.strictEqual(eventsRes.statusCode, 200);
    assert.ok(Array.isArray(eventsRes.json()));
  });

  // 13. Admin Setup Center (Section 22: /api/admin/setup)
  it('13. GET /api/admin/setup returns all 13 required configuration sections', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/setup',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.title, 'HQ-Employee Setup Center');
    assert.strictEqual(body.sections.length, 13);

    const ids = body.sections.map((s: any) => s.id);
    assert.ok(ids.includes('company'));
    assert.ok(ids.includes('employee'));
    assert.ok(ids.includes('assemblyai'));
    assert.ok(ids.includes('telephony'));
    assert.ok(ids.includes('google_workspace'));
    assert.ok(ids.includes('calendar'));
    assert.ok(ids.includes('database'));
    assert.ok(ids.includes('webhooks'));
    assert.ok(ids.includes('security'));
    assert.ok(ids.includes('calling_policy'));
    assert.ok(ids.includes('bulk_campaign_policy'));
    assert.ok(ids.includes('testing'));
    assert.ok(ids.includes('production_readiness'));
  });

  // 14. Admin Policy Engine (Section 46: /api/admin/policies)
  it('14. /api/admin/policies provides active rules and audit updates', async () => {
    const getRes = await server.inject({
      method: 'GET',
      url: '/api/admin/policies',
    });
    assert.strictEqual(getRes.statusCode, 200);
    const getBody = getRes.json();
    assert.strictEqual(getBody.status, 'ACTIVE');
    assert.ok(getBody.rules.blockedActions.includes('direct_sql_execution'));

    const postRes = await server.inject({
      method: 'POST',
      url: '/api/admin/policies',
      payload: {
        policyVersion: 'v1.1.0-updated',
      },
    });
    assert.strictEqual(postRes.statusCode, 200);
    const postBody = postRes.json();
    assert.strictEqual(postBody.ok, true);
    assert.strictEqual(postBody.policyVersion, 'v1.1.0-updated');
  });

  // 15. Google Webhook (Section 46: /api/webhooks/google)
  it('15. POST /api/webhooks/google handles push notifications', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/webhooks/google',
      headers: {
        'x-goog-channel-id': 'chan_test_123',
        'x-goog-resource-state': 'exists',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.channelId, 'chan_test_123');
  });
});
