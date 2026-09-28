import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { defaultMemoryService, MemoryService } from '../src/modules/memory/index.js';
import { defaultLeadsRepository } from '../src/modules/leads/index.js';
import { defaultCompanyBrainRepository } from '../src/modules/company/index.js';

describe('HQ Employee Structured Memory Subsystem', () => {
  const companyA = '00000000-0000-0000-0000-000000000001';
  const companyB = '00000000-0000-0000-0000-000000000002';
  const memoryService = defaultMemoryService;

  let leadA1: string;
  let leadA2: string;
  let leadB1: string;

  before(async () => {
    // Setup Lead 1 for Company A
    const l1 = await defaultLeadsRepository.createLead({
      companyId: companyA,
      fullName: 'Sarah Connor',
      contactEmail: 'sarah@cyberdyne.org',
      status: 'ENGAGED',
    });
    leadA1 = l1.id;

    // Setup Lead 2 for Company A
    const l2 = await defaultLeadsRepository.createLead({
      companyId: companyA,
      fullName: 'John Connor',
      contactEmail: 'john@cyberdyne.org',
      status: 'NEW',
    });
    leadA2 = l2.id;

    // Setup Lead 1 for Company B
    const lb = await defaultLeadsRepository.createLead({
      companyId: companyB,
      fullName: 'Miles Dyson',
      contactEmail: 'miles@cyberdyne.org',
      status: 'QUALIFYING',
    });
    leadB1 = lb.id;
  });

  it('1. retrieves structured Company Memory with guidance, policies, and isolation', async () => {
    const memory = await memoryService.getCompanyMemory(companyA);
    assert.ok(memory.profile);
    assert.strictEqual(memory.profile.name, 'HQ-Employee');
    assert.ok(memory.services.length >= 4);
    assert.ok(memory.pricingGuidance.length >= 4);
    assert.ok(memory.timelineGuidance.length >= 4);
    assert.ok(memory.faqs.length >= 3);
    assert.strictEqual(memory.activePolicy.status, 'ACTIVE');

    // Cross-company isolation: Company B cannot access Company A's memory
    await assert.rejects(
      () => memoryService.getCompanyMemory(companyA, companyB),
      /isolation violation/i
    );
  });

  it('2. retrieves Employee Memory with role, persona, and authorized capabilities', async () => {
    const employee = await memoryService.getEmployeeMemory('emp-001', companyA);
    assert.strictEqual(employee.name, 'HQ-Employee Business Development & Client Coordinator');
    assert.strictEqual(employee.role, 'Business Development & Client Coordination');
    assert.ok(employee.persona.includes('Professional'));
    assert.ok(employee.authorizedCapabilities.includes('get_company_profile'));
    assert.ok(employee.authorizedCapabilities.includes('get_service_details'));

    // Cross-company isolation
    await assert.rejects(
      () => memoryService.getEmployeeMemory('emp-001', companyA, companyB),
      /isolation violation/i
    );
  });

  it('3. records structured fact with full provenance and confidence status', async () => {
    const { fact } = await memoryService.recordFact({
      leadId: leadA1,
      companyId: companyA,
      category: 'project_type',
      value: 'Mobile App & Voice AI Integration',
      source: 'voice_turn_02',
      conversationId: 'conv_session_101',
      confidence: 0.95,
    });

    assert.ok(fact.factId);
    assert.strictEqual(fact.category, 'project_type');
    assert.strictEqual(fact.value, 'Mobile App & Voice AI Integration');
    assert.strictEqual(fact.source, 'voice_turn_02');
    assert.strictEqual(fact.conversationId, 'conv_session_101');
    assert.strictEqual(fact.status, 'CONFIRMED');

    // Record low-confidence fact -> TENTATIVE
    const { fact: tentativeFact } = await memoryService.recordFact({
      leadId: leadA1,
      companyId: companyA,
      category: 'urgency',
      value: 'High',
      source: 'voice_turn_03',
      conversationId: 'conv_session_101',
      confidence: 0.5,
    });
    assert.strictEqual(tentativeFact.status, 'TENTATIVE');
  });

  it('4. detects conflicting facts between conversations and marks NEEDS_CONFIRMATION without silent overwrite', async () => {
    // Record initial budget in conversation 1
    await memoryService.recordFact({
      leadId: leadA1,
      companyId: companyA,
      category: 'budget',
      value: '$25,000 - $35,000',
      source: 'voice_turn_04',
      conversationId: 'conv_session_101',
      confidence: 0.9,
    });

    // In a new conversation, lead provides conflicting budget
    const { fact: newFact, conflict } = await memoryService.recordFact({
      leadId: leadA1,
      companyId: companyA,
      category: 'budget',
      value: '$10,000',
      source: 'voice_turn_01',
      conversationId: 'conv_session_102',
      confidence: 0.85,
    });

    assert.ok(conflict, 'Must create a FactConflict record');
    assert.strictEqual(conflict?.category, 'budget');
    assert.strictEqual(conflict?.existingValue, '$25,000 - $35,000');
    assert.strictEqual(conflict?.conflictingValue, '$10,000');
    assert.strictEqual(conflict?.newConversationId, 'conv_session_102');
    assert.strictEqual(newFact.status, 'NEEDS_CONFIRMATION');

    // Check Lead Memory reflects conflict and does not silently overwrite
    const leadMem = await memoryService.getLeadMemory(leadA1, companyA);
    assert.ok(leadMem.conflicts.length >= 1);
    assert.strictEqual(leadMem.conflicts[0].category, 'budget');
  });

  it('5. tracks full Interaction Memory lifecycle: objective, facts, decisions, and outcomes', async () => {
    const convId = 'conv_lifecycle_201';
    await memoryService.startInteraction({
      conversationId: convId,
      leadId: leadA2,
      companyId: companyA,
      objective: 'Discover enterprise requirements and qualify budget',
    });

    // Record decision and tool action
    await memoryService.recordDecision(convId, 'get_pricing_guidance', 'ALLOW');
    await memoryService.recordToolAction(convId, 'get_pricing_guidance', { service: 'Website Development' }, { price: '$15,000' });

    // Complete interaction
    const completed = await memoryService.completeInteraction(convId, 'Lead qualified; consultation recommended', 'Send calendar invitation');
    assert.strictEqual(completed.outcome, 'Lead qualified; consultation recommended');
    assert.strictEqual(completed.nextAction, 'Send calendar invitation');
    assert.strictEqual(completed.decisions.length, 1);
    assert.strictEqual(completed.toolActions.length, 1);

    // Verify interaction memory retrieval
    const retrieved = await memoryService.getInteractionMemory(convId, companyA);
    assert.strictEqual(retrieved.objective, 'Discover enterprise requirements and qualify budget');

    // Cross-company interaction isolation
    await assert.rejects(
      () => memoryService.getInteractionMemory(convId, companyB),
      /isolation violation/i
    );
  });

  it('6. enforces strict Cross-Lead and Cross-Company isolation', async () => {
    // Company A attempting to access Company B's lead memory
    await assert.rejects(
      () => memoryService.getLeadMemory(leadB1, companyA),
      /isolation violation/i
    );

    // Company B attempting to access Company A's lead memory
    await assert.rejects(
      () => memoryService.getLeadMemory(leadA1, companyB),
      /isolation violation/i
    );
  });

  it('7. executes privacy-compliant lead memory deletion (Right to be Forgotten)', async () => {
    // Record facts for leadA2
    await memoryService.recordFact({
      leadId: leadA2,
      companyId: companyA,
      category: 'target_users',
      value: 'Clinical practitioners and nurses',
      source: 'web_form',
      conversationId: 'conv_web_001',
    });

    const beforePurge = await memoryService.getLeadMemory(leadA2, companyA);
    assert.ok(beforePurge.facts.length >= 1);

    // Purge lead memory
    await memoryService.purgeLeadMemory(leadA2, companyA);

    const afterPurge = await memoryService.getLeadMemory(leadA2, companyA);
    assert.strictEqual(afterPurge.facts.length, 0);
    assert.strictEqual(afterPurge.conflicts.length, 0);
  });
});
