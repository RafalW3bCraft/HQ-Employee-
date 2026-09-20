import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';
import { defaultAuditService } from '../src/modules/audit/index.js';

describe('Governed Employee Policy Engine Integration', () => {
  let server: FastifyInstance;

  before(async () => {
    const testConfig = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'fatal',
      ASSEMBLYAI_API_KEY: 'test_key',
    });
    server = await createServer(testConfig);
    await server.ready();
    defaultAuditService.clear();
  });

  after(async () => {
    await server.close();
  });

  it('1. approved pricing request evaluates to ALLOW with active policy version', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/policies/evaluate',
      payload: {
        action: 'get_pricing_guidance',
        args: { service_slug: 'website-dev' },
        leadId: 'lead-test-1',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.strictEqual(result.decision, 'ALLOW');
    assert.ok(result.policyVersion);
    assert.strictEqual(result.requiresHumanApproval, false);
    assert.ok(result.reason.includes('approved pricing ranges'));
  });

  it('2. unauthorized discount evaluates to REQUIRE_APPROVAL', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/policies/evaluate',
      payload: {
        action: 'apply_custom_discount',
        args: { discount_pct: 15, reason: 'Client requested budget accommodation' },
        leadId: 'lead-test-2',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.strictEqual(result.decision, 'REQUIRE_APPROVAL');
    assert.strictEqual(result.requiresHumanApproval, true);
    assert.ok(result.reason.includes('Commercial Director approval'));
  });

  it('2b. excessive discount (> 20%) evaluates to BLOCK', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/policies/evaluate',
      payload: {
        action: 'apply_custom_discount',
        args: { discount_pct: 35 },
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.strictEqual(result.decision, 'BLOCK');
    assert.strictEqual(result.requiresHumanApproval, false);
    assert.ok(result.reason.includes('exceeds the maximum 20%'));
  });

  it('3. contract acceptance evaluates to BLOCK', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/policies/evaluate',
      payload: {
        action: 'sign_contract',
        args: { document_name: 'Master Services Agreement' },
        leadId: 'lead-test-3',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.strictEqual(result.decision, 'BLOCK');
    assert.strictEqual(result.requiresHumanApproval, false);
    assert.ok(result.reason.includes('strictly prohibited from signing or accepting contracts'));
  });

  it('4. payment request evaluates to BLOCK', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/policies/evaluate',
      payload: {
        action: 'request_payment',
        args: { amount_cents: 500000 },
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.strictEqual(result.decision, 'BLOCK');
    assert.strictEqual(result.requiresHumanApproval, false);
    assert.ok(result.reason.includes('Financial transfers, payments, and credit card processing are strictly prohibited'));
  });

  it('5. meeting scheduling evaluates to ALLOW for future slot', async () => {
    const futureSlot = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await server.inject({
      method: 'POST',
      url: '/api/policies/evaluate',
      payload: {
        action: 'schedule_meeting',
        args: { slot_time: futureSlot, topic: 'AI Architecture Discovery' },
        leadId: 'lead-test-5',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.strictEqual(result.decision, 'ALLOW');
    assert.strictEqual(result.requiresHumanApproval, false);
  });

  it('5b. meeting scheduling evaluates to BLOCK for past slot', async () => {
    const pastSlot = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const res = await server.inject({
      method: 'POST',
      url: '/api/policies/evaluate',
      payload: {
        action: 'schedule_meeting',
        args: { slot_time: pastSlot },
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.reason.includes('past'));
  });

  it('6. missing authority evaluates to BLOCK by default (fail-closed)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/policies/evaluate',
      payload: {
        action: 'arbitrary_unrestricted_tool',
        args: { command: 'drop database' },
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.reason.includes('no authorized grant'));
  });

  it('7. credentials / password / OTP requests evaluate to BLOCK', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/policies/evaluate',
      payload: {
        action: 'request_password',
        args: { target: 'client_cms' },
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const result = JSON.parse(res.payload);
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.reason.includes('passwords, PINs, OTPs'));
  });

  it('8. audit events are recorded for every policy evaluation', async () => {
    const auditRes = await server.inject({
      method: 'GET',
      url: '/api/policies/audit',
    });

    assert.strictEqual(auditRes.statusCode, 200);
    const body = JSON.parse(auditRes.payload);
    assert.ok(body.count >= 7);
    assert.ok(body.events.length >= 7);

    // Verify properties of the most recent audit event
    const firstEvent = body.events[0];
    assert.strictEqual(firstEvent.action, 'POLICY_EVALUATION');
    assert.strictEqual(firstEvent.targetType, 'POLICY_DECISION');
    assert.ok(firstEvent.metadata.decision);
    assert.ok(firstEvent.metadata.actionRequested);
    assert.ok(firstEvent.metadata.policyVersion);
    assert.ok(firstEvent.createdAt);
  });
});
