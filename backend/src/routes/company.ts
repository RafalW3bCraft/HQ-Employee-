import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { defaultCompanyBrainService } from '../modules/company/index.js';
import { ValidationError } from '../errors/index.js';

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  tagline: z.string().min(1).optional(),
  website: z.string().url().optional(),
  description: z.string().min(1).optional(),
});

const upsertServiceSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  minPriceCents: z.number().int().positive(),
  maxPriceCents: z.number().int().positive().optional(),
  minDurationWeeks: z.number().int().positive(),
  maxDurationWeeks: z.number().int().positive(),
  tierName: z.string().optional(),
  scopeDescription: z.string().optional(),
});

const upsertFaqSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(1),
  answer: z.string().min(1),
  displayOrder: z.number().int().optional(),
});

const authorityRuleSchema = z.object({
  action: z.string().min(1),
  category: z.string().min(1),
  decision: z.enum(['ALLOW', 'REQUIRE_APPROVAL', 'BLOCK']),
  rationale: z.string().min(1),
});

const escalationRuleSchema = z.object({
  condition: z.string().min(1),
  targetRole: z.string().min(1),
  notificationChannel: z.string().min(1),
  timeoutMinutes: z.number().int().positive(),
});

const createPolicySchema = z.object({
  version: z.string().min(1),
  systemInstructions: z.string().min(1),
  authorityRules: z.array(authorityRuleSchema),
  escalationRules: z.array(escalationRuleSchema),
});

export const companyRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultCompanyBrainService;

  // Complete company brain payload
  fastify.get('/api/company/brain', async (request, reply) => {
    const brain = await service.getCompanyBrain();
    return reply.status(200).send(brain);
  });

  // Profile endpoints
  fastify.get('/api/company/profile', async (request, reply) => {
    const brain = await service.getCompanyBrain();
    return reply.status(200).send(brain.profile);
  });

  fastify.put('/api/company/profile', async (request, reply) => {
    const parse = updateProfileSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid profile payload', parse.error.format());
    }
    const updated = await service.updateProfile(undefined, parse.data);
    return reply.status(200).send(updated);
  });

  // Services endpoints
  fastify.get('/api/company/services', async (request, reply) => {
    const services = await service.listServices();
    return reply.status(200).send(services);
  });

  fastify.post('/api/company/services', async (request, reply) => {
    const parse = upsertServiceSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid service guidance payload', parse.error.format());
    }
    const upserted = await service.upsertService(undefined, parse.data);
    return reply.status(200).send(upserted);
  });

  // FAQ endpoints
  fastify.get('/api/company/faqs', async (request, reply) => {
    const faqs = await service.listFaqs();
    return reply.status(200).send(faqs);
  });

  fastify.post('/api/company/faqs', async (request, reply) => {
    const parse = upsertFaqSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid FAQ payload', parse.error.format());
    }
    const faq = await service.upsertFaq(undefined, parse.data);
    return reply.status(200).send(faq);
  });

  // Policy versioning endpoints
  fastify.get('/api/company/policies', async (request, reply) => {
    const policies = await service.listPolicies();
    return reply.status(200).send(policies);
  });

  fastify.get('/api/company/policies/active', async (request, reply) => {
    const active = await service.getActivePolicy();
    return reply.status(200).send(active);
  });

  fastify.post('/api/company/policies', async (request, reply) => {
    const parse = createPolicySchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid policy specification', parse.error.format());
    }
    const created = await service.createPolicyVersion(undefined, parse.data);
    return reply.status(201).send(created);
  });

  fastify.post('/api/company/policies/:id/activate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const activated = await service.activatePolicyVersion(undefined, id);
    return reply.status(200).send(activated);
  });

  // Runtime context for the AI employee runtime
  fastify.get('/api/company/runtime-context', async (request, reply) => {
    const { service: serviceSlug } = request.query as { service?: string };
    const context = await service.getRuntimeContext(undefined, serviceSlug);
    return reply.status(200).send(context);
  });
};
