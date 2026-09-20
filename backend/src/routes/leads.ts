import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { defaultLeadQualificationService, LeadFactKey } from '../modules/leads/index.js';
import { ValidationError } from '../errors/index.js';

const createLeadSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  companyName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
});

const factKeyEnum = z.enum([
  'project_type',
  'business_objective',
  'target_users',
  'required_features',
  'integrations',
  'existing_system',
  'timeline',
  'budget',
  'decision_maker',
  'urgency',
]);

const recordFactSchema = z.object({
  key: factKeyEnum,
  value: z.string().min(1, 'Fact value is required'),
  confidence: z.number().min(0).max(1),
  source: z.string().min(1, 'Source provenance is required'),
  conversationId: z.string().optional(),
});

export const leadsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultLeadQualificationService;

  // List leads
  fastify.get('/api/leads', async (request, reply) => {
    const { status, companyId } = request.query as { status?: any; companyId?: string };
    const leads = await service.listLeads({ status, companyId });
    return reply.status(200).send(leads);
  });

  // Create lead
  fastify.post('/api/leads', async (request, reply) => {
    const parse = createLeadSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid lead creation payload', parse.error.format());
    }
    const lead = await service.createLead(parse.data);
    return reply.status(201).send(lead);
  });

  // Get lead details
  fastify.get('/api/leads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const lead = await service.getLead(id);
    return reply.status(200).send(lead);
  });

  // Record extracted conversation fact with provenance & validation
  fastify.post('/api/leads/:id/facts', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = recordFactSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid conversation fact payload', parse.error.format());
    }

    const result = await service.recordFact({
      leadId: id,
      key: parse.data.key as LeadFactKey,
      value: parse.data.value,
      confidence: parse.data.confidence,
      source: parse.data.source,
      conversationId: parse.data.conversationId,
    });

    return reply.status(200).send(result);
  });

  // Get next adaptive question
  fastify.get('/api/leads/:id/next-question', async (request, reply) => {
    const { id } = request.params as { id: string };
    const question = await service.getNextAdaptiveQuestion(id);
    return reply.status(200).send(question);
  });

  // Trigger deterministic qualification evaluation
  fastify.post('/api/leads/:id/qualify', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await service.evaluateQualification(id);
    return reply.status(200).send(result);
  });

  // Generate structured Project Brief
  fastify.get('/api/leads/:id/brief', async (request, reply) => {
    const { id } = request.params as { id: string };
    const brief = await service.generateProjectBrief(id);
    return reply.status(200).send(brief);
  });
};
