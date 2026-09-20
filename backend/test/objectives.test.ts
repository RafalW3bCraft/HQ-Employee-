/**
 * ObjectiveEngine Tests
 *
 * Verifies:
 * 1. Generates follow-up objectives for stale leads
 * 2. Generates proposal reminders for PROPOSAL_SENT leads
 * 3. Does NOT generate duplicate objectives
 * 4. getNextObjective returns highest-priority first
 * 5. Re-engagement objectives require approval
 * 6. completeObjective marks COMPLETED
 * 7. failObjective retries then marks FAILED
 * 8. expireOverdue skips old objectives
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  ObjectiveEngine,
  ObjectivesRepository,
} from '../src/modules/objectives/index.js';
import { LeadsRepository, Lead } from '../src/modules/leads/index.js';
import { AuditService, AuditRepository } from '../src/modules/audit/index.js';
import { randomUUID } from 'crypto';

const companyId = 'c0000000-0000-0000-0000-000000000001';

function makeLead(overrides: Partial<Lead>): Lead {
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    id: randomUUID(),
    companyId,
    fullName: 'Test Lead',
    companyName: 'Test Corp',
    contactEmail: 'test@example.com',
    contactPhone: '+1-555-0000',
    status: 'QUALIFYING',
    qualificationNotes: '',
    memory: {},
    createdAt: new Date(Date.now() - 5 * dayMs).toISOString(), // 5 days old
    updatedAt: new Date(Date.now() - 5 * dayMs).toISOString(),
    ...overrides,
  };
}

describe('ObjectiveEngine', async () => {
  let engine: ObjectiveEngine;
  let leadsRepo: LeadsRepository;
  let objectivesRepo: ObjectivesRepository;

  before(() => {
    leadsRepo = new LeadsRepository();
    objectivesRepo = new ObjectivesRepository();
    const audit = new AuditService(new AuditRepository());
    engine = new ObjectiveEngine(objectivesRepo, leadsRepo, audit);
  });

  it('1. generates FOLLOW_UP_STALE_LEAD objective for stale QUALIFYING lead', async () => {
    const lead = makeLead({ status: 'QUALIFYING' });
    // Inject lead directly into repository for testing
    (leadsRepo as any).leads = [lead];

    const objectives = await engine.generateObjectives(companyId);

    const followUps = objectives.filter((o) => o.type === 'FOLLOW_UP_STALE_LEAD');
    assert.ok(followUps.length >= 1, 'Should generate at least one follow-up objective');
    assert.equal(followUps[0].leadId, lead.id);
    assert.equal(followUps[0].status, 'PENDING');
    assert.equal(followUps[0].priority, 'HIGH');
    assert.ok(followUps[0].suggestedAction.includes(lead.fullName));
  });

  it('2. generates PROPOSAL_REMINDER for PROPOSAL_SENT lead', async () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const lead = makeLead({
      status: 'PROPOSAL_SENT',
      createdAt: new Date(Date.now() - 7 * dayMs).toISOString(),
    });
    (leadsRepo as any).leads = [lead];

    // Clear previous objectives
    (objectivesRepo as any).objectives = [];

    const objectives = await engine.generateObjectives(companyId);

    const reminders = objectives.filter((o) => o.type === 'PROPOSAL_REMINDER');
    assert.ok(reminders.length >= 1, 'Should generate proposal reminder');
    assert.equal(reminders[0].leadId, lead.id);
    assert.equal(reminders[0].priority, 'HIGH');
  });

  it('3. does NOT generate duplicate objectives for the same lead and type', async () => {
    const lead = makeLead({ status: 'QUALIFYING' });
    (leadsRepo as any).leads = [lead];
    (objectivesRepo as any).objectives = [];

    // First generation
    const first = await engine.generateObjectives(companyId);
    const followUps1 = first.filter((o) => o.type === 'FOLLOW_UP_STALE_LEAD');
    assert.ok(followUps1.length >= 1);

    // Second generation — should NOT create duplicates since one is already PENDING
    const second = await engine.generateObjectives(companyId);
    const followUps2 = second.filter((o) => o.type === 'FOLLOW_UP_STALE_LEAD');
    assert.equal(followUps2.length, 0, 'Should not create duplicate objectives');
  });

  it('4. getNextObjective returns highest-priority objective', async () => {
    (leadsRepo as any).leads = [];
    (objectivesRepo as any).objectives = [];

    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date();

    // Create LOW and HIGH priority objectives
    await objectivesRepo.create({
      id: randomUUID(),
      companyId,
      type: 'COLLECT_FEEDBACK',
      status: 'PENDING',
      priority: 'LOW',
      description: 'Low priority task',
      scheduledAfter: new Date(now.getTime() - dayMs).toISOString(),
      expiresAt: new Date(now.getTime() + 7 * dayMs).toISOString(),
      attemptCount: 0,
      maxAttempts: 3,
      suggestedAction: 'Collect feedback',
      metadata: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    await objectivesRepo.create({
      id: randomUUID(),
      companyId,
      type: 'FOLLOW_UP_STALE_LEAD',
      status: 'PENDING',
      priority: 'CRITICAL',
      leadId: 'lead-urgent',
      description: 'Critical follow-up',
      scheduledAfter: new Date(now.getTime() - dayMs).toISOString(),
      expiresAt: new Date(now.getTime() + 7 * dayMs).toISOString(),
      attemptCount: 0,
      maxAttempts: 3,
      suggestedAction: 'Follow up urgently',
      metadata: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const evaluation = await engine.getNextObjective(companyId);
    assert.ok(evaluation);
    assert.equal(evaluation.objective.priority, 'CRITICAL');
    assert.equal(evaluation.policyCheck, 'ALLOW');
  });

  it('5. RE_ENGAGE_LOST_LEAD requires human approval', async () => {
    (objectivesRepo as any).objectives = [];

    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date();

    await objectivesRepo.create({
      id: randomUUID(),
      companyId,
      type: 'RE_ENGAGE_LOST_LEAD',
      status: 'PENDING',
      priority: 'LOW',
      leadId: 'lead-lost',
      description: 'Re-engage lost lead',
      scheduledAfter: new Date(now.getTime() - dayMs).toISOString(),
      expiresAt: new Date(now.getTime() + 30 * dayMs).toISOString(),
      attemptCount: 0,
      maxAttempts: 1,
      suggestedAction: 'Check in with prospect',
      metadata: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const evaluation = await engine.getNextObjective(companyId);
    assert.ok(evaluation);
    assert.equal(evaluation.policyCheck, 'REQUIRE_APPROVAL');
    assert.ok(evaluation.reason.includes('approval'));
  });

  it('6. completeObjective sets status COMPLETED with result', async () => {
    (objectivesRepo as any).objectives = [];

    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    const objId = randomUUID();

    await objectivesRepo.create({
      id: objId,
      companyId,
      type: 'FOLLOW_UP_STALE_LEAD',
      status: 'PENDING',
      priority: 'HIGH',
      leadId: 'lead-123',
      description: 'Test objective',
      scheduledAfter: new Date(now.getTime() - dayMs).toISOString(),
      expiresAt: new Date(now.getTime() + 7 * dayMs).toISOString(),
      attemptCount: 0,
      maxAttempts: 3,
      suggestedAction: 'Follow up',
      metadata: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const completed = await engine.completeObjective(objId, 'Sent follow-up email successfully');
    assert.equal(completed.status, 'COMPLETED');
    assert.equal(completed.lastAttemptResult, 'Sent follow-up email successfully');
    assert.ok(completed.lastAttemptAt);
  });

  it('7. failObjective increments attemptCount and marks FAILED at max', async () => {
    (objectivesRepo as any).objectives = [];

    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    const objId = randomUUID();

    await objectivesRepo.create({
      id: objId,
      companyId,
      type: 'PROPOSAL_REMINDER',
      status: 'PENDING',
      priority: 'HIGH',
      description: 'Test fail/retry',
      scheduledAfter: new Date(now.getTime() - dayMs).toISOString(),
      expiresAt: new Date(now.getTime() + 14 * dayMs).toISOString(),
      attemptCount: 0,
      maxAttempts: 2,
      suggestedAction: 'Remind',
      metadata: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    // First failure — should stay PENDING for retry
    const after1 = await engine.failObjective(objId, 'Email bounce');
    assert.equal(after1.attemptCount, 1);
    assert.equal(after1.status, 'PENDING'); // Still under maxAttempts

    // Second failure — should be FAILED (reached maxAttempts=2)
    const after2 = await engine.failObjective(objId, 'Email bounce again');
    assert.equal(after2.attemptCount, 2);
    assert.equal(after2.status, 'FAILED');
  });

  it('8. expireOverdue marks expired objectives as SKIPPED', async () => {
    (objectivesRepo as any).objectives = [];

    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date();

    await objectivesRepo.create({
      id: randomUUID(),
      companyId,
      type: 'FOLLOW_UP_STALE_LEAD',
      status: 'PENDING',
      priority: 'HIGH',
      description: 'Expired objective',
      scheduledAfter: new Date(now.getTime() - 10 * dayMs).toISOString(),
      expiresAt: new Date(now.getTime() - 1 * dayMs).toISOString(), // Already expired
      attemptCount: 0,
      maxAttempts: 3,
      suggestedAction: 'Follow up',
      metadata: {},
      createdAt: new Date(now.getTime() - 10 * dayMs).toISOString(),
      updatedAt: new Date(now.getTime() - 10 * dayMs).toISOString(),
    });

    const expiredCount = await objectivesRepo.expireOverdue(companyId, now);
    assert.equal(expiredCount, 1);

    const all = await objectivesRepo.listAll(companyId);
    const skipped = all.filter((o) => o.status === 'SKIPPED');
    assert.equal(skipped.length, 1);
  });

  it('9. getNextObjective returns null when no pending objectives', async () => {
    (objectivesRepo as any).objectives = [];

    const result = await engine.getNextObjective(companyId);
    assert.equal(result, null);
  });
});
