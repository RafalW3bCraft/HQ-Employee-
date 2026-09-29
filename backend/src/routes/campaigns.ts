import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  defaultCampaignEngine,
  CampaignEngine,
  CreateCampaignParams,
} from '../modules/campaigns/index.js';
import { ValidationError, NotFoundError } from '../errors/index.js';

const createCampaignSchema = z.object({
  name: z.string().min(1, 'name is required'),
  objective: z.string().min(1, 'objective is required'),
  companyId: z.string().optional(),
  employeeId: z.string().optional(),
  persona: z.string().optional(),
  scriptInstructions: z.string().optional(),
  qualificationRules: z.string().optional(),
  meetingBookingPolicy: z.string().optional(),
  humanEscalationPolicy: z.string().optional(),
  concurrencyLimit: z.number().int().min(1).max(10).optional(),
  maxAttempts: z.number().int().min(1).max(5).optional(),
  retryDelayMinutes: z.number().int().min(5).optional(),
  callingHours: z
    .object({
      start: z.number().int().min(0).max(23),
      end: z.number().int().min(0).max(23),
    })
    .optional(),
  timezoneRules: z.string().optional(),
  contacts: z
    .array(
      z.object({
        name: z.string().min(1),
        phone: z.string().min(8),
        company: z.string().optional(),
        email: z.string().optional(),
        timezone: z.string().optional(),
        notes: z.string().optional(),
        preferredLanguage: z.string().optional(),
      })
    )
    .optional(),
});

const validateCsvSchema = z.object({
  csvContent: z.string().min(1, 'csvContent is required'),
});

export const campaignRoutes: FastifyPluginAsync = async (fastify) => {
  const engine = defaultCampaignEngine;

  // 1. List all campaigns
  fastify.get('/api/campaigns', async (request, reply) => {
    const list = await engine.listCampaigns();
    return reply.status(200).send(list);
  });

  // 2. Validate CSV upload
  fastify.post('/api/campaigns/validate-csv', async (request, reply) => {
    const parse = validateCsvSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid CSV validation payload', parse.error.format());
    }

    const validation = await engine.validateCsv(parse.data.csvContent);
    return reply.status(200).send(validation);
  });

  // 3. Create a new campaign
  fastify.post('/api/campaigns', async (request, reply) => {
    const parse = createCampaignSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid campaign creation payload', parse.error.format());
    }

    const campaign = await engine.createCampaign(parse.data as CreateCampaignParams);
    return reply.status(201).send(campaign);
  });

  // 4. Get campaign details
  fastify.get('/api/campaigns/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await engine.getCampaign(id);
    if (!campaign) {
      throw new NotFoundError('Campaign', id);
    }
    return reply.status(200).send(campaign);
  });

  // 5. Start campaign
  fastify.post('/api/campaigns/:id/start', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await engine.startCampaign(id);
    return reply.status(200).send(campaign);
  });

  // 6. Pause campaign
  fastify.post('/api/campaigns/:id/pause', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await engine.pauseCampaign(id);
    return reply.status(200).send(campaign);
  });

  // 7. Resume campaign
  fastify.post('/api/campaigns/:id/resume', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await engine.startCampaign(id);
    return reply.status(200).send(campaign);
  });

  // 8. Stop campaign
  fastify.post('/api/campaigns/:id/stop', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await engine.stopCampaign(id);
    return reply.status(200).send(campaign);
  });
};
