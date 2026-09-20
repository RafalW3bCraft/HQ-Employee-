import { describe, it } from 'node:test';
import assert from 'node:assert';
import { defaultAuditService, defaultAuditRepository, sanitizeAuditData } from '../src/modules/audit/index.js';

describe('HQ Employee Append-Oriented Audit System', () => {
  const auditService = defaultAuditService;
  const companyId = '00000000-0000-0000-0000-000000000001';
  const employeeId = '00000000-0000-0000-0000-000000000002';
  const leadId = 'lead_audit_test_001';
  const convId = 'conv_audit_test_001';
  const callId = 'call_audit_test_001';

  it('1. logs material business events with full context fields and authorization result', async () => {
    const event = await auditService.logEvent({
      companyId,
      employeeId,
      leadId,
      conversationId: convId,
      callId,
      policyVersion: '1.0.0',
      action: 'MEETING_CREATED',
      inputMetadata: { slot: '2026-09-18T10:00:00Z', topic: 'Architecture Consultation' },
      authorizationResult: 'ALLOW',
      result: { meetingId: 'meet_001', status: 'CONFIRMED' },
    });

    assert.ok(event.id);
    assert.ok(event.timestamp);
    assert.strictEqual(event.companyId, companyId);
    assert.strictEqual(event.employeeId, employeeId);
    assert.strictEqual(event.leadId, leadId);
    assert.strictEqual(event.conversationId, convId);
    assert.strictEqual(event.callId, callId);
    assert.strictEqual(event.policyVersion, '1.0.0');
    assert.strictEqual(event.action, 'MEETING_CREATED');
    assert.strictEqual(event.authorizationResult, 'ALLOW');
  });

  it('2. sanitizes sensitive credentials, passwords, tokens, and payment data', async () => {
    const sensitivePayload = {
      user_password: 'superSecretPassword123!',
      api_key: 'aai_secret_key_abcdef123456',
      auth_token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      credit_card_number: '4111-2222-3333-4444',
      cvv: '123',
      regular_field: 'safe_public_data',
    };

    const sanitized = sanitizeAuditData(sensitivePayload);

    assert.strictEqual(sanitized.user_password, '[REDACTED]');
    assert.strictEqual(sanitized.api_key, '[REDACTED]');
    assert.strictEqual(sanitized.auth_token, '[REDACTED]');
    assert.strictEqual(sanitized.credit_card_number, '[REDACTED]');
    assert.strictEqual(sanitized.cvv, '[REDACTED]');
    assert.strictEqual(sanitized.regular_field, 'safe_public_data');

    // Also verify when logged through auditService
    const event = await auditService.logEvent({
      action: 'CREDIT_PURCHASE_ATTEMPT',
      inputMetadata: sensitivePayload,
    });

    assert.strictEqual((event.inputMetadata as any).user_password, '[REDACTED]');
    assert.strictEqual((event.inputMetadata as any).api_key, '[REDACTED]');
  });

  it('3. maintains immutability guarantee: audit records are frozen against mutation', async () => {
    const event = await auditService.logEvent({
      action: 'POLICY_DECISION',
      policyVersion: '1.0.0',
      authorizationResult: 'BLOCK',
      failureReason: 'Unauthorized contract execution',
    });

    assert.strictEqual(Object.isFrozen(event), true, 'Audit event must be frozen');
    assert.throws(() => {
      'use strict';
      (event as any).authorizationResult = 'ALLOW';
    }, TypeError);
  });

  it('4. provides authorization traceability for compliance auditing', async () => {
    await auditService.logPolicyEvaluation({
      action: 'sign_contract',
      decision: 'BLOCK',
      reason: 'Contract signing requires human executive clearance',
      policyVersion: '1.0.0',
      leadId,
      callId,
      companyId,
      employeeId,
      args: { contract_type: 'NDA_AND_MSA' },
    });

    const traces = await auditService.traceAuthorization('sign_contract', leadId);
    assert.ok(traces.length >= 1);
    const trace = traces[0];
    assert.strictEqual(trace.authorizationResult, 'BLOCK');
    assert.strictEqual(trace.policyVersion, '1.0.0');
    assert.strictEqual(trace.metadata.reason, 'Contract signing requires human executive clearance');
  });

  it('5. retrieves complete lead audit trail for historical verification', async () => {
    const trail = await auditService.getLeadAuditTrail(leadId);
    assert.ok(trail.length >= 2);
    const actions = trail.map((e) => e.action);
    assert.ok(actions.includes('MEETING_CREATED'));
    assert.ok(actions.includes('POLICY_EVALUATION'));
  });
});
