import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';
import { defaultAssemblyAIService } from '../src/modules/assemblyai/index.js';
import { defaultCallsService } from '../src/modules/calls/index.js';
import { defaultAuditService } from '../src/modules/audit/index.js';
import { defaultLeadsRepository } from '../src/modules/leads/index.js';

describe('AssemblyAI Voice Agent API Integration', () => {
  let server: FastifyInstance;

  before(async () => {
    const testConfig = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'fatal',
      ASSEMBLYAI_API_KEY: 'test_key',
    });
    server = await createServer(testConfig);
    await server.ready();
  });

  after(async () => {
    await server.close();
  });

  it('1. mints temporary voice agent session token without leaking backend secret key', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/voice/token?expiresInSeconds=300&maxSessionDurationSeconds=1800',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.token, 'Must return a session token');
    assert.strictEqual(body.expiresInSeconds, 300);
    assert.strictEqual(body.maxSessionDurationSeconds, 1800);
    assert.strictEqual(body.wsUrl, 'wss://agents.assemblyai.com/v1/ws');
    // Verify secret key is never sent in body
    assert.strictEqual(body.token.includes('test_key'), false);
  });

  it('2. provides validated session configuration with exactly 13 explicit business tools and no generic tool', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/voice/config',
    });

    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    assert.strictEqual(data.toolCount, 13);

    const toolNames = data.tools.map((t: any) => t.name);
    const expectedTools = [
      'get_company_profile',
      'get_service_details',
      'get_pricing_guidance',
      'get_timeline_guidance',
      'create_lead',
      'update_lead',
      'record_requirement',
      'record_budget',
      'record_timeline',
      'request_human_approval',
      'check_calendar',
      'schedule_meeting',
      'end_call',
    ];

    for (const expected of expectedTools) {
      assert.ok(toolNames.includes(expected), `Tool ${expected} must be registered`);
    }

    // Verify absence of arbitrary or generic action tools
    assert.strictEqual(toolNames.includes('execute_sql'), false);
    assert.strictEqual(toolNames.includes('run_arbitrary_code'), false);
    assert.strictEqual(toolNames.includes('call_webhook'), false);

    // Verify session config parameters
    const config = data.config;
    assert.ok(config.system_prompt.includes('HQ-Employee'));
    assert.ok(config.greeting.includes('HQ-Employee'));
    assert.strictEqual(config.output.voice, 'alba');
    assert.strictEqual(config.input.transcription_mode, 'balanced');
    assert.strictEqual(config.input.turn_detection.interrupt_response, true);
  });

  it('3. executes approved tools through backend Policy Engine with ALLOW decision', async () => {
    // A. Company Profile
    const profileRes = await server.inject({
      method: 'POST',
      url: '/api/voice/tools/execute',
      payload: {
        name: 'get_company_profile',
        arguments: {},
        callId: 'call_turn_01',
      },
    });

    assert.strictEqual(profileRes.statusCode, 200);
    const profileBody = JSON.parse(profileRes.payload);
    assert.strictEqual(profileBody.policyDecision, 'ALLOW');
    assert.strictEqual(profileBody.isError, false);
    const profileResult = JSON.parse(profileBody.result);
    assert.ok(profileResult.name.includes('HQ-Employee'));

    // B. Pricing Guidance
    const pricingRes = await server.inject({
      method: 'POST',
      url: '/api/voice/tools/execute',
      payload: {
        name: 'get_pricing_guidance',
        arguments: { service_name: 'Full-Stack' },
        callId: 'call_turn_02',
      },
    });

    assert.strictEqual(pricingRes.statusCode, 200);
    const pricingBody = JSON.parse(pricingRes.payload);
    assert.strictEqual(pricingBody.policyDecision, 'ALLOW');
    assert.strictEqual(pricingBody.isError, false);
    const pricingResult = JSON.parse(pricingBody.result);
    assert.ok(pricingResult.pricing || pricingResult.guidance);
  });

  it('4. routes out-of-authority requests to human escalation with REQUIRE_APPROVAL decision', async () => {
    const discountRes = await server.inject({
      method: 'POST',
      url: '/api/voice/tools/execute',
      payload: {
        name: 'request_human_approval',
        arguments: {
          lead_id: 'lead-001',
          action_type: 'discount_request',
          details: 'Client requested 15% discount for upfront payment',
          proposed_value: '15%',
        },
        callId: 'call_turn_03',
      },
    });

    assert.strictEqual(discountRes.statusCode, 200);
    const body = JSON.parse(discountRes.payload);
    assert.strictEqual(body.isError, false);
    const result = JSON.parse(body.result);
    assert.strictEqual(result.approval_required, true);
    assert.ok(result.approval_id, 'Approval request ID must be generated');
    assert.ok(result.message.includes('human director'));
  });

  it('5. strictly enforces BLOCK policy on contract signing and financial payment attempts', async () => {
    // Contract acceptance
    const contractResult = await defaultAssemblyAIService.executeTool(
      'sign_contract',
      { contract_id: 'c-123', terms: 'all' },
      'call_turn_04'
    );
    assert.strictEqual(contractResult.policyDecision, 'BLOCK');
    assert.strictEqual(contractResult.isError, true);
    assert.ok(contractResult.result.includes('blocked'));

    // Payment transfer
    const paymentResult = await defaultAssemblyAIService.executeTool(
      'process_payment',
      { amount: 5000, credit_card: '4111...' },
      'call_turn_05'
    );
    assert.strictEqual(paymentResult.policyDecision, 'BLOCK');
    assert.strictEqual(paymentResult.isError, true);
    assert.ok(paymentResult.result.includes('blocked'));
  });

  it('6. creates lead and records requirements with structured memory provenance', async () => {
    // Create lead
    const createLeadRes = await server.inject({
      method: 'POST',
      url: '/api/voice/tools/execute',
      payload: {
        name: 'create_lead',
        arguments: {
          full_name: 'Genevieve Dupond',
          company_name: 'AeroTech Systems',
          email: 'gdupond@aerotech.fr',
          phone: '+33 1 40 20 50 00',
        },
        callId: 'call_turn_06',
      },
    });

    assert.strictEqual(createLeadRes.statusCode, 200);
    const createBody = JSON.parse(createLeadRes.payload);
    const leadData = JSON.parse(createBody.result);
    assert.ok(leadData.lead_id);
    const leadId = leadData.lead_id;

    // Record budget
    const budgetRes = await server.inject({
      method: 'POST',
      url: '/api/voice/tools/execute',
      payload: {
        name: 'record_budget',
        arguments: {
          lead_id: leadId,
          budget_amount_or_range: '$30,000 - $45,000',
        },
        callId: 'call_turn_07',
      },
    });

    assert.strictEqual(budgetRes.statusCode, 200);
    const budgetResult = JSON.parse(JSON.parse(budgetRes.payload).result);
    assert.strictEqual(budgetResult.success, true);

    // Verify lead memory received the fact
    const lead = await defaultLeadsRepository.getLead(leadId);
    assert.ok(lead);
    const budgetFact = lead?.memory.facts.find((f) => f.key === 'budget');
    assert.ok(budgetFact);
    assert.strictEqual(budgetFact?.provenance.source, 'VOICE_AGENT_TOOL');
  });

  it('7. normalizes raw AssemblyAI Voice Agent protocol events into clean application events', () => {
    const callId = 'test-call-123';
    const assemblySessionId = 'sess-abc-456';

    // session.ready -> voice.connected
    const readyEvent = defaultCallsService.normalizeProviderEvent(
      {
        type: 'session.ready',
        session_id: assemblySessionId,
        expires_at: 1717180000,
        resume_token: 'res_tok_123',
      },
      callId
    );
    assert.strictEqual(readyEvent?.type, 'voice.connected');
    assert.strictEqual(readyEvent?.sessionId, assemblySessionId);

    // input.speech.started -> voice.speech_started
    const speechStart = defaultCallsService.normalizeProviderEvent(
      { type: 'input.speech.started' },
      callId,
      assemblySessionId
    );
    assert.strictEqual(speechStart?.type, 'voice.speech_started');
    assert.strictEqual(speechStart?.payload.isSpeaking, true);

    // transcript.user -> voice.user_transcript
    const userTranscript = defaultCallsService.normalizeProviderEvent(
      {
        type: 'transcript.user',
        text: 'Can you help us build a speech-to-text medical summarizer?',
        item_id: 'item_1',
      },
      callId,
      assemblySessionId
    );
    assert.strictEqual(userTranscript?.type, 'voice.user_transcript');
    assert.strictEqual(userTranscript?.payload.isFinal, true);
    assert.strictEqual(userTranscript?.payload.text, 'Can you help us build a speech-to-text medical summarizer?');

    // reply.audio -> voice.agent_audio
    const agentAudio = defaultCallsService.normalizeProviderEvent(
      {
        type: 'reply.audio',
        data: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
      },
      callId,
      assemblySessionId
    );
    assert.strictEqual(agentAudio?.type, 'voice.agent_audio');
    assert.ok(agentAudio?.payload.audioChunkBase64);

    // transcript.agent with interruption -> voice.agent_transcript
    const agentTranscript = defaultCallsService.normalizeProviderEvent(
      {
        type: 'transcript.agent',
        text: 'Certainly! HQ specializes in...',
        reply_id: 'reply_1',
        interrupted: true,
      },
      callId,
      assemblySessionId
    );
    assert.strictEqual(agentTranscript?.type, 'voice.agent_transcript');
    assert.strictEqual(agentTranscript?.payload.interrupted, true);

    // session.ended -> voice.session_ended
    const sessionEnded = defaultCallsService.normalizeProviderEvent(
      {
        type: 'session.ended',
        session_duration_seconds: 45.2,
        audio_duration_seconds: 40.1,
      },
      callId,
      assemblySessionId
    );
    assert.strictEqual(sessionEnded?.type, 'voice.session_ended');
    assert.strictEqual(sessionEnded?.payload.sessionDurationSeconds, 45.2);
  });

  it('8. tracks call session lifecycle and creates audit event on session completion', async () => {
    const session = await defaultCallsService.startSession('lead-001', 'webcraft-coordinator');
    assert.strictEqual(session.status, 'INITIALIZING');

    // Add transcripts
    await defaultCallsService.recordTranscript(session.id, {
      speaker: 'user',
      text: 'What are your rates for a web application?',
    });
    await defaultCallsService.recordTranscript(session.id, {
      speaker: 'agent',
      text: 'Our standard approved pricing ranges from $15,000 to $25,000 for standard web apps.',
    });

    // End session
    const endedSession = await defaultCallsService.endSession(session.id, 62, 58);
    assert.strictEqual(endedSession.status, 'COMPLETED');
    assert.strictEqual(endedSession.durationSeconds, 62);
    assert.strictEqual(endedSession.transcripts.length, 2);

    // Verify audit event was logged
    const audits = await defaultAuditService.getRecentEvents(5, 'CALL_SESSION_COMPLETED');
    assert.strictEqual(audits.length, 1);
    assert.strictEqual(audits[0].targetId, session.id);
  });

  it('9. serves interactive browser voice testing harness HTML page', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/voice-tester',
    });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type']?.includes('text/html'));
    assert.ok(res.payload.includes('HQ-Employee Voice Agent'));
    assert.ok(res.payload.includes('Start Conversation'));
    assert.ok(res.payload.includes('Interrupt Agent'));
    assert.ok(res.payload.includes('End Call'));
  });

  it('10. executes check_calendar and schedule_meeting through backend Policy Engine', async () => {
    // A. check_calendar
    const calRes = await server.inject({
      method: 'POST',
      url: '/api/voice/tools/execute',
      payload: {
        name: 'check_calendar',
        arguments: {
          timezone: 'America/New_York',
        },
        callId: 'call_turn_cal_01',
      },
    });

    assert.strictEqual(calRes.statusCode, 200);
    const calBody = JSON.parse(calRes.payload);
    assert.strictEqual(calBody.policyDecision, 'ALLOW');
    assert.strictEqual(calBody.isError, false);
    const calResult = JSON.parse(calBody.result);
    assert.ok(Array.isArray(calResult.slots));

    // B. create lead and schedule_meeting
    const newLead = await defaultLeadsRepository.createLead({
      companyId: 'company_webcraft_001',
      fullName: 'Dr. Sarah Connor',
      companyName: 'Cyberdyne Resistance',
      contactEmail: 'sconnor@cyberdyne.org',
      status: 'QUALIFIED',
    });

    // Compute next Monday 14:00 UTC (10:00 AM EDT)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + ((1 + 7 - targetDate.getDay()) % 7 || 7));
    targetDate.setUTCHours(14, 0, 0, 0);
    const slotTimeIso = targetDate.toISOString();

    const scheduleRes = await server.inject({
      method: 'POST',
      url: '/api/voice/tools/execute',
      payload: {
        name: 'schedule_meeting',
        arguments: {
          lead_id: newLead.id,
          slot_time: slotTimeIso,
          topic: 'Voice Agent & Speech Synthesis Architecture',
          timezone: 'America/New_York',
        },
        callId: 'call_turn_cal_02',
      },
    });

    assert.strictEqual(scheduleRes.statusCode, 200);
    const schedBody = JSON.parse(scheduleRes.payload);
    assert.strictEqual(schedBody.policyDecision, 'ALLOW');
    assert.strictEqual(schedBody.isError, false);
    const schedResult = JSON.parse(schedBody.result);
    assert.ok(schedResult.meetingId);
    assert.ok(schedResult.confirmationCode);
    assert.strictEqual(schedResult.leadId, newLead.id);
  });

  it('11. manages server-side AssemblyAIVoiceSession lifecycle, streaming, interruption, and reconnection', async () => {
    const session = await defaultAssemblyAIService.createSession({ mockMode: true });
    assert.strictEqual(session.status, 'INITIALIZING');

    let connectedEmitted = false;
    session.on('connected', () => {
      connectedEmitted = true;
    });

    await session.connect();
    assert.strictEqual(session.status, 'CONNECTED');
    assert.strictEqual(connectedEmitted, true);

    // Audio streaming
    session.sendAudio(Buffer.from('RIFF_test_chunk'));
    assert.strictEqual(session.status, 'STREAMING');

    // Interruption
    let interruptedEmitted = false;
    session.on('interrupted', () => {
      interruptedEmitted = true;
    });
    session.handleInterruption();
    assert.strictEqual(session.status, 'INTERRUPTED');
    assert.strictEqual(interruptedEmitted, true);

    // Tool result dispatch
    session.sendToolResult('call_123', JSON.stringify({ ok: true }));

    // Close session
    let closedEmitted = false;
    session.on('closed', () => {
      closedEmitted = true;
    });
    await session.close();
    assert.strictEqual(session.status, 'CLOSED');
    assert.strictEqual(closedEmitted, true);

    // Reconnect session
    await session.reconnect();
    assert.strictEqual(session.status, 'CONNECTED');
    await session.close();
  });

  it('12. strictly rejects cross-tenant lead modification in executeTool when companyId does not match', async () => {
    const tenantALead = await defaultLeadsRepository.createLead({
      companyId: 'company_tenant_alpha',
      fullName: 'Alice Alpha',
      contactEmail: 'alice@alpha.example',
      status: 'QUALIFIED',
    });

    // Attempt to update lead from Tenant Beta
    const crossTenantRes = await server.inject({
      method: 'POST',
      url: '/api/voice/tools/execute',
      payload: {
        name: 'record_requirement',
        arguments: {
          lead_id: tenantALead.id,
          requirement: 'Malicious cross-tenant injection',
        },
        callId: 'call_turn_sec_01',
        companyId: 'company_tenant_beta', // Mismatched tenant
      },
    });

    assert.strictEqual(crossTenantRes.statusCode, 200);
    const body = JSON.parse(crossTenantRes.payload);
    assert.strictEqual(body.isError, true);
    assert.ok(body.result.includes('Cross-tenant lead modification denied'));

    // Legitimate same-tenant update succeeds
    const sameTenantRes = await server.inject({
      method: 'POST',
      url: '/api/voice/tools/execute',
      payload: {
        name: 'record_requirement',
        arguments: {
          lead_id: tenantALead.id,
          requirement: 'Authorized requirement specification',
        },
        callId: 'call_turn_sec_02',
        companyId: 'company_tenant_alpha', // Matching tenant
      },
    });

    assert.strictEqual(sameTenantRes.statusCode, 200);
    const validBody = JSON.parse(sameTenantRes.payload);
    assert.strictEqual(validBody.isError, false);
    const resultObj = JSON.parse(validBody.result);
    assert.strictEqual(resultObj.success, true);
  });

  it('13. normalizes reply.done with status=interrupted as voice.agent_speaking isSpeaking=false/interrupted', () => {
    const callId = 'test-call-interrupt';
    const sid    = 'sess-interrupt-789';

    const replyDoneInterrupted = defaultCallsService.normalizeProviderEvent(
      { type: 'reply.done', status: 'interrupted', reply_id: 'r-1' },
      callId,
      sid
    );
    assert.strictEqual(replyDoneInterrupted?.type, 'voice.agent_speaking');
    assert.strictEqual(replyDoneInterrupted?.payload.isSpeaking, false);
    assert.strictEqual(replyDoneInterrupted?.payload.status, 'interrupted');

    const replyDoneComplete = defaultCallsService.normalizeProviderEvent(
      { type: 'reply.done', status: 'complete', reply_id: 'r-2' },
      callId,
      sid
    );
    assert.strictEqual(replyDoneComplete?.type, 'voice.agent_speaking');
    assert.strictEqual(replyDoneComplete?.payload.isSpeaking, false);
    assert.strictEqual(replyDoneComplete?.payload.status, 'complete');
  });

  it('14. reply.audio normalizes with data field (not audio field) as voice.agent_audio', () => {
    const chunk = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    const ev    = defaultCallsService.normalizeProviderEvent(
      { type: 'reply.audio', data: chunk },
      'call-audio-test',
      'sess-audio'
    );
    assert.strictEqual(ev?.type, 'voice.agent_audio');
    assert.strictEqual(ev?.payload.audioChunkBase64, chunk);

    // Verify that passing raw.audio (wrong field) yields undefined payload
    const evWrongField = defaultCallsService.normalizeProviderEvent(
      { type: 'reply.audio', audio: chunk },
      'call-audio-test2',
      'sess-audio2'
    );
    // type is still mapped, but chunk should be undefined (wrong field name)
    assert.strictEqual(evWrongField?.type, 'voice.agent_audio');
    assert.strictEqual(evWrongField?.payload.audioChunkBase64, undefined);
  });

  it('15. wallet endpoint returns available and reserved fields (not availableCredits)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/billing/wallet' });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    // Backend CreditWallet shape must expose 'available' and 'reserved'
    assert.ok('available' in body, 'wallet must expose available field');
    assert.ok('reserved'  in body, 'wallet must expose reserved field');
    assert.ok('balance'   in body, 'wallet must expose balance field');
    assert.strictEqual(typeof body.available, 'number');
    assert.strictEqual(typeof body.reserved,  'number');
  });

  it('16. voice-tester.html does not contain raw ASSEMBLYAI_API_KEY or bearer token', async () => {
    const res = await server.inject({ method: 'GET', url: '/voice-tester' });
    assert.strictEqual(res.statusCode, 200);
    // The page must never embed the backend secret key
    const payload = res.payload;
    assert.strictEqual(payload.includes('ASSEMBLYAI_API_KEY'), false, 'Must not contain env var name');
    assert.strictEqual(payload.includes('test_key'),           false, 'Must not contain API key value');
    // Token fetch must go via backend endpoint, not to assemblyai.com directly
    assert.strictEqual(payload.includes('agents.assemblyai.com'), false, 'Browser must not contact AssemblyAI directly');
  });
});
