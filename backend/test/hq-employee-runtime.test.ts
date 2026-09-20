import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { defaultEmployeeRuntimeService, EmployeeRuntimeService } from '../src/modules/runtime/index.js';
import { defaultLeadsRepository } from '../src/modules/leads/index.js';
import { defaultMemoryService } from '../src/modules/memory/index.js';
import { defaultCompanyBrainRepository, EmployeePolicy } from '../src/modules/company/index.js';

describe('HQ Employee Runtime Layer & Context Builder', () => {
  const companyA = '00000000-0000-0000-0000-000000000001';
  const companyB = '00000000-0000-0000-0000-000000000002';
  const employeeId = '00000000-0000-0000-0000-000000000002';
  const runtimeService = defaultEmployeeRuntimeService;

  let leadA1: string;
  let leadA2_sparse: string;
  let leadB1: string;

  before(async () => {
    // Lead with full facts
    const l1 = await defaultLeadsRepository.createLead({
      companyId: companyA,
      fullName: 'Marcus Wright',
      companyName: 'Cyberdyne Systems',
      contactEmail: 'marcus@cyberdyne.org',
      status: 'QUALIFYING',
    });
    leadA1 = l1.id;

    // Record confirmed fact for Lead A1
    await defaultMemoryService.recordFact({
      leadId: leadA1,
      companyId: companyA,
      category: 'project_type',
      value: 'Voice AI Clinical Assistant',
      source: 'prior_touchpoint',
      conversationId: 'conv_pre_01',
      confidence: 0.95,
    });

    // Sparse lead (new, missing optional fields)
    const l2 = await defaultLeadsRepository.createLead({
      companyId: companyA,
      fullName: 'Kyle Reese',
      status: 'NEW',
    });
    leadA2_sparse = l2.id;

    // Company B Lead
    const lb = await defaultLeadsRepository.createLead({
      companyId: companyB,
      fullName: 'John Connor',
      status: 'NEW',
    });
    leadB1 = lb.id;
  });

  it('1. builds deterministic conversation context with correct employee, company, and lead', async () => {
    const convId = 'conv_runtime_001';
    const ctx = await runtimeService.buildConversationContext({
      employeeId,
      companyId: companyA,
      leadId: leadA1,
      conversationId: convId,
      objective: 'Discover enterprise clinical requirements and qualify budget',
    });

    assert.strictEqual(ctx.conversationId, convId);
    assert.strictEqual(ctx.employee.name, 'HQ Business Development & Client Coordinator');
    assert.strictEqual(ctx.employee.role, 'Business Development & Client Coordination');
    assert.strictEqual(ctx.company.name, 'HQ');
    assert.strictEqual(ctx.lead.id, leadA1);
    assert.strictEqual(ctx.lead.fullName, 'Marcus Wright');
    assert.strictEqual(ctx.lead.companyName, 'Cyberdyne Systems');
    assert.strictEqual(ctx.lead.qualificationStatus, 'QUALIFYING');

    // Verify confirmed facts are included
    assert.ok(ctx.lead.confirmedFacts.length >= 1);
    assert.strictEqual(ctx.lead.confirmedFacts[0].category, 'project_type');
    assert.strictEqual(ctx.lead.confirmedFacts[0].value, 'Voice AI Clinical Assistant');

    // Verify system prompt incorporates objective and persona
    assert.ok(ctx.systemPrompt.includes('Marcus Wright'));
    assert.ok(ctx.systemPrompt.includes('Discover enterprise clinical requirements'));
    assert.ok(ctx.systemPrompt.includes('AI company representative'));
  });

  it('2. records employee_policy_version on the conversation', async () => {
    const convId = 'conv_policy_check_002';
    const ctx = await runtimeService.buildConversationContext({
      employeeId,
      companyId: companyA,
      leadId: leadA1,
      conversationId: convId,
      objective: 'Check policy version recording',
    });

    assert.ok(ctx.policyVersion);
    const recordedVersion = runtimeService.getConversationPolicyVersion(convId);
    assert.strictEqual(recordedVersion, ctx.policyVersion);
  });

  it('3. selects only relevant service knowledge when service slug filter is requested', async () => {
    const ctx = await runtimeService.buildConversationContext({
      employeeId,
      companyId: companyA,
      leadId: leadA1,
      conversationId: 'conv_service_filter_003',
      objective: 'Inquire about AI & Machine Learning Engineering',
      requestedServiceSlug: 'ai-ml',
    });

    assert.strictEqual(ctx.company.approvedServices.length, 1);
    assert.strictEqual(ctx.company.approvedServices[0].slug, 'ai-ml');
  });

  it('4. filters out unauthorized tools according to active policy rules', () => {
    // Policy where schedule_meeting is BLOCKED and sign_contract is BLOCKED
    const restrictedPolicy: EmployeePolicy = {
      id: 'pol_restricted',
      employeeId,
      version: '2.0.0-restricted',
      status: 'ACTIVE',
      systemInstructions: 'Strict policy test',
      authorityRules: [
        { action: 'get_company_profile', category: 'information', decision: 'ALLOW', rationale: 'Public' },
        { action: 'schedule_meeting', category: 'calendar', decision: 'BLOCK', rationale: 'Calendar temporarily disabled' },
        { action: 'apply_custom_discount', category: 'commercial', decision: 'REQUIRE_APPROVAL', rationale: 'Discounts need human' },
        { action: 'sign_contract', category: 'legal', decision: 'BLOCK', rationale: 'Never sign' },
      ],
      escalationRules: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tools = runtimeService.filterToolsForPolicy(restrictedPolicy);
    const toolNames = tools.map((t) => t.name);

    // Allowed tool must be present
    assert.ok(toolNames.includes('get_company_profile'));

    // Blocked tool must be EXCLUDED
    assert.strictEqual(toolNames.includes('schedule_meeting'), false, 'schedule_meeting must be excluded when blocked');
    assert.strictEqual(toolNames.includes('sign_contract'), false, 'sign_contract must be excluded');

    // Escalation tool must be present for approvals
    assert.ok(toolNames.includes('request_human_approval'));
  });

  it('5. handles sparse/missing lead data safely without failing', async () => {
    const ctx = await runtimeService.buildConversationContext({
      employeeId,
      companyId: companyA,
      leadId: leadA2_sparse,
      conversationId: 'conv_sparse_004',
      objective: 'Initial contact with brand new lead',
    });

    assert.strictEqual(ctx.lead.id, leadA2_sparse);
    assert.strictEqual(ctx.lead.companyName, undefined);
    assert.strictEqual(ctx.lead.budget, undefined);
    assert.strictEqual(ctx.lead.timeline, undefined);
    assert.strictEqual(ctx.lead.confirmedFacts.length, 0);
    assert.ok(ctx.systemPrompt.includes('Kyle Reese'));
  });

  it('6. enforces strict Cross-Company and Cross-Lead isolation', async () => {
    // Attempt to access Company B's lead using Company A context
    await assert.rejects(
      () =>
        runtimeService.buildConversationContext({
          employeeId,
          companyId: companyA,
          leadId: leadB1,
          conversationId: 'conv_isolation_005',
          objective: 'Test isolation violation',
        }),
      /isolation violation/i
    );

    // Attempt to access Company A's lead using Company B context
    await assert.rejects(
      () =>
        runtimeService.buildConversationContext({
          employeeId,
          companyId: companyB,
          leadId: leadA1,
          conversationId: 'conv_isolation_006',
          objective: 'Test isolation violation',
        }),
      /isolation violation/i
    );
  });
});
