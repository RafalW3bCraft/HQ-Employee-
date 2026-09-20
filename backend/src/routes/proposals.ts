/**
 * Proposals Routes
 *
 * GET    /api/proposals                  — List all proposals for company
 * GET    /api/proposals/:id              — Get single proposal
 * GET    /api/proposals/by-lead/:leadId  — Get proposals for a lead
 * POST   /api/proposals/generate         — Generate proposal from ProjectBrief
 * PATCH  /api/proposals/:id              — Update proposal (status, line items, etc.)
 * POST   /api/proposals/:id/send         — Mark as SENT to prospect
 * POST   /api/proposals/:id/accept       — Record prospect acceptance
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { defaultProposalService } from '../modules/proposals/index.js';
import { ValidationError } from '../errors/index.js';

const generateProposalSchema = z.object({
  companyId: z.string().min(1),
  leadId: z.string().min(1),
  brief: z.object({
    briefId: z.string(),
    leadId: z.string(),
    leadName: z.string(),
    companyName: z.string().optional(),
    qualificationStatus: z.string(),
    qualificationScore: z.number().min(0).max(100),
    executiveSummary: z.string(),
    opportunityDetails: z.object({
      projectType: z.string(),
      businessObjective: z.string(),
      targetAudience: z.string(),
      keyFeatures: z.array(z.string()),
      integrations: z.array(z.string()),
      existingSystem: z.string(),
    }),
    commercialParameters: z.object({
      budgetRange: z.string(),
      timelineExpected: z.string(),
      urgencyLevel: z.string(),
      decisionMakerConfirmed: z.boolean(),
    }),
    provenanceTrail: z.array(z.any()),
    recommendedNextSteps: z.string(),
    generatedAt: z.string(),
  }),
  createdBy: z.string().default('employee:coordinator'),
  customOverrides: z
    .object({
      totalCents: z.number().int().positive().optional(),
      deliveryWeeks: z.number().int().positive().optional(),
      requiresApproval: z.boolean().optional(),
      approvalId: z.string().optional(),
    })
    .optional(),
});

const updateProposalSchema = z.object({
  status: z
    .enum([
      'DRAFT',
      'SENT',
      'VIEWED',
      'NEGOTIATING',
      'ACCEPTED',
      'REJECTED',
      'EXPIRED',
    ])
    .optional(),
  requiresHumanApproval: z.boolean().optional(),
  approvalId: z.string().optional(),
});

const acceptProposalSchema = z.object({
  signedByName: z.string().min(1),
  actorId: z.string().default('employee:coordinator'),
});

export const proposalRoutes: FastifyPluginAsync = async (fastify) => {
  const proposalService = defaultProposalService;

  /**
   * GET /api/proposals
   * List all proposals for a company.
   */
  fastify.get('/api/proposals', async (request, reply) => {
    const { companyId } = request.query as { companyId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const proposals = await proposalService.listProposals(companyId);
    return reply.status(200).send({ proposals, total: proposals.length });
  });

  /**
   * GET /api/proposals/by-lead/:leadId
   * Get all proposals for a specific lead.
   */
  fastify.get('/api/proposals/by-lead/:leadId', async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const { companyId } = request.query as { companyId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const proposals = await proposalService.getProposalsByLead(leadId, companyId);
    return reply.status(200).send({ proposals, total: proposals.length });
  });

  /**
   * GET /api/proposals/:id
   * Get a single proposal by ID.
   */
  fastify.get('/api/proposals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.query as { companyId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const proposal = await proposalService.getProposal(id, companyId);
    return reply.status(200).send(proposal);
  });

  /**
   * POST /api/proposals/generate
   * Generate a proposal from a ProjectBrief.
   * Policy-governed: only approved pricing ranges are used.
   * Custom overrides require requiresApproval=true + approvalId.
   */
  fastify.post('/api/proposals/generate', async (request, reply) => {
    const parse = generateProposalSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid proposal generation request', parse.error.format());
    }

    const proposal = await proposalService.generateProposal(parse.data as any);
    return reply.status(201).send(proposal);
  });

  /**
   * PATCH /api/proposals/:id
   * Update proposal details (status, approval tracking).
   */
  fastify.patch('/api/proposals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId, actorId } = request.query as { companyId?: string; actorId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const parse = updateProposalSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid proposal update', parse.error.format());
    }

    const updated = await proposalService.updateProposal(
      id,
      companyId,
      parse.data,
      actorId || 'operator'
    );
    return reply.status(200).send(updated);
  });

  /**
   * POST /api/proposals/:id/send
   * Transition proposal to SENT state.
   * Blocked if proposal requires human approval and none recorded.
   */
  fastify.post('/api/proposals/:id/send', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId, actorId } = request.query as { companyId?: string; actorId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const proposal = await proposalService.sendProposal(
      id,
      companyId,
      actorId || 'employee:coordinator'
    );
    return reply.status(200).send(proposal);
  });

  /**
   * POST /api/proposals/:id/accept
   * Record prospect acceptance of proposal terms.
   * Note: this is a verbal/email confirmation. Formal contract still requires
   * human director countersignature.
   */
  fastify.post('/api/proposals/:id/accept', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { companyId } = request.query as { companyId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const parse = acceptProposalSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid accept request', parse.error.format());
    }

    const proposal = await proposalService.acceptProposal(
      id,
      companyId,
      parse.data.signedByName,
      parse.data.actorId
    );
    return reply.status(200).send(proposal);
  });
};
