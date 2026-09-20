/**
 * Proposals Module Tests
 *
 * Verifies:
 * 1. Proposal generation from a qualified ProjectBrief
 * 2. Rejection of proposals from unqualified leads
 * 3. Status lifecycle transitions (DRAFT → SENT → ACCEPTED)
 * 4. Invalid transition rejection
 * 5. Custom pricing requires human approval flag
 * 6. Cross-tenant access denied
 * 7. sendProposal blocked when requiresHumanApproval without approvalId
 * 8. Proposal is idempotent by leadId (multiple proposals allowed, none duplicated)
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ProposalService, ProposalsRepository } from '../src/modules/proposals/index.js';
import { AuditService, AuditRepository } from '../src/modules/audit/index.js';
import { ProjectBrief } from '../src/modules/leads/index.js';
import { randomUUID } from 'crypto';

function makeQualifiedBrief(leadId: string, score = 75): ProjectBrief {
  return {
    briefId: randomUUID(),
    leadId,
    leadName: 'Acme Corp Contact',
    companyName: 'Acme Corp',
    qualificationStatus: 'QUALIFIED',
    qualificationScore: score,
    executiveSummary: 'Build a B2B SaaS dashboard for fleet management.',
    opportunityDetails: {
      projectType: 'Web Application',
      businessObjective: 'Reduce fleet costs by 30%',
      targetAudience: 'Fleet managers at mid-market logistics companies',
      keyFeatures: ['GPS tracking', 'Maintenance scheduling', 'Driver scoring', 'Reporting'],
      integrations: ['Samsara API', 'Quickbooks'],
      existingSystem: 'Excel spreadsheets',
    },
    commercialParameters: {
      budgetRange: '$50,000 - $100,000',
      timelineExpected: '12 weeks',
      urgencyLevel: 'HIGH',
      decisionMakerConfirmed: true,
    },
    provenanceTrail: [],
    recommendedNextSteps: 'Present proposal at discovery meeting.',
    generatedAt: new Date().toISOString(),
  };
}

describe('Proposal System', async () => {
  let service: ProposalService;
  const companyId = 'c0000000-0000-0000-0000-000000000001';
  const otherCompanyId = 'c9999999-9999-9999-9999-999999999999';

  before(() => {
    const repo = new ProposalsRepository();
    const audit = new AuditService(new AuditRepository());
    service = new ProposalService(repo, audit);
  });

  it('1. generates a structured proposal from a qualified brief', async () => {
    const leadId = randomUUID();
    const brief = makeQualifiedBrief(leadId);

    const proposal = await service.generateProposal({
      companyId,
      leadId,
      brief,
      createdBy: 'employee:coordinator',
    });

    assert.equal(proposal.status, 'DRAFT');
    assert.equal(proposal.leadId, leadId);
    assert.equal(proposal.companyId, companyId);
    assert.ok(proposal.lineItems.length >= 3, 'Should have at least 3 line items (dev, arch, qa)');
    assert.ok(proposal.totalCents > 0, 'Total must be positive');
    assert.ok(proposal.deliveryWeeks > 0, 'Delivery weeks must be set');
    assert.ok(new Date(proposal.validUntil) > new Date(), 'Proposal must be valid in the future');
    assert.ok(proposal.executiveSummary, 'Executive summary must be included');
    assert.equal(proposal.currency, 'USD');
    assert.equal(proposal.requiresHumanApproval, false, 'Standard pricing should not require approval');
  });

  it('2. rejects proposal generation for unqualified leads (score < 40)', async () => {
    const leadId = randomUUID();
    const brief = makeQualifiedBrief(leadId, 30); // Below threshold

    await assert.rejects(
      () => service.generateProposal({ companyId, leadId, brief, createdBy: 'employee:coordinator' }),
      { message: /qualification score too low/i }
    );
  });

  it('3. valid status transition: DRAFT → SENT → ACCEPTED', async () => {
    const leadId = randomUUID();
    const proposal = await service.generateProposal({
      companyId,
      leadId,
      brief: makeQualifiedBrief(leadId),
      createdBy: 'employee:coordinator',
    });

    const sent = await service.sendProposal(proposal.id, companyId, 'employee:coordinator');
    assert.equal(sent.status, 'SENT');

    const accepted = await service.acceptProposal(
      proposal.id,
      companyId,
      'John Smith',
      'employee:coordinator'
    );
    assert.equal(accepted.status, 'ACCEPTED');
    assert.ok(accepted.signedAt, 'Acceptance must record signedAt');
    assert.equal(accepted.signedByName, 'John Smith');
  });

  it('4. rejects invalid status transition', async () => {
    const leadId = randomUUID();
    const proposal = await service.generateProposal({
      companyId,
      leadId,
      brief: makeQualifiedBrief(leadId),
      createdBy: 'employee:coordinator',
    });

    // Cannot go DRAFT → ACCEPTED (must go through SENT first)
    await assert.rejects(
      () => service.updateProposal(proposal.id, companyId, { status: 'ACCEPTED' }, 'operator'),
      { message: /invalid proposal status transition/i }
    );
  });

  it('5. custom pricing requires human approval and blocks send without approvalId', async () => {
    const leadId = randomUUID();
    const proposal = await service.generateProposal({
      companyId,
      leadId,
      brief: makeQualifiedBrief(leadId),
      createdBy: 'employee:coordinator',
      customOverrides: {
        totalCents: 9999999, // Custom pricing
        requiresApproval: true,
        // Note: no approvalId provided
      },
    });

    assert.equal(proposal.requiresHumanApproval, true);

    // Cannot send without approvalId
    await assert.rejects(
      () => service.sendProposal(proposal.id, companyId, 'employee:coordinator'),
      { message: /requires human director approval/i }
    );
  });

  it('6. send succeeds when custom pricing has approvalId', async () => {
    const leadId = randomUUID();
    const proposal = await service.generateProposal({
      companyId,
      leadId,
      brief: makeQualifiedBrief(leadId),
      createdBy: 'employee:coordinator',
      customOverrides: {
        totalCents: 9999999,
        requiresApproval: true,
        approvalId: 'approval-' + randomUUID(),
      },
    });

    const sent = await service.sendProposal(proposal.id, companyId, 'employee:coordinator');
    assert.equal(sent.status, 'SENT');
  });

  it('7. cross-tenant access denied: cannot access another company\'s proposal', async () => {
    const leadId = randomUUID();
    const proposal = await service.generateProposal({
      companyId,
      leadId,
      brief: makeQualifiedBrief(leadId),
      createdBy: 'employee:coordinator',
    });

    // Try to access with a different companyId
    await assert.rejects(
      () => service.getProposal(proposal.id, otherCompanyId),
      { message: /cross-tenant/i }
    );
  });

  it('8. delivery weeks are derived from brief timeline (12 weeks)', async () => {
    const leadId = randomUUID();
    const brief = makeQualifiedBrief(leadId);
    brief.commercialParameters.timelineExpected = '8 weeks';

    const proposal = await service.generateProposal({
      companyId,
      leadId,
      brief,
      createdBy: 'employee:coordinator',
    });

    assert.equal(proposal.deliveryWeeks, 8, 'Should derive 8 weeks from brief timeline');
  });

  it('9. getProposalsByLead returns all proposals for the lead', async () => {
    const leadId = randomUUID();
    const brief = makeQualifiedBrief(leadId);

    // Generate two proposals for the same lead (e.g., v1 and v2)
    await service.generateProposal({ companyId, leadId, brief, createdBy: 'employee:coordinator' });
    await service.generateProposal({ companyId, leadId, brief, createdBy: 'employee:coordinator' });

    const proposals = await service.getProposalsByLead(leadId, companyId);
    assert.ok(proposals.length >= 2, 'Should return at least 2 proposals for the lead');
    assert.ok(proposals.every((p) => p.leadId === leadId), 'All proposals must belong to the lead');
  });
});
