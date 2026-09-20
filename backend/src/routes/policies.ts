import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { defaultPolicyEngineService } from '../modules/policies/index.js';
import { defaultAuditService } from '../modules/audit/index.js';
import { ValidationError } from '../errors/index.js';

const evaluateActionSchema = z.object({
  action: z.string().min(1, 'Action name is required'),
  args: z.record(z.unknown()).optional(),
  leadId: z.string().optional(),
  callId: z.string().optional(),
  employeeId: z.string().optional(),
});

export const policyRoutes: FastifyPluginAsync = async (fastify) => {
  // Evaluates an action through the policy engine
  fastify.post('/api/policies/evaluate', async (request, reply) => {
    const parse = evaluateActionSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid evaluation request payload', parse.error.format());
    }

    const result = await defaultPolicyEngineService.evaluateAction(parse.data);
    return reply.status(200).send(result);
  });

  // Retrieves recent audit events
  fastify.get('/api/policies/audit', async (request, reply) => {
    const { limit, action } = request.query as { limit?: string; action?: string };
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const events = await defaultAuditService.getRecentEvents(limitNum, action);
    return reply.status(200).send({
      count: events.length,
      events,
    });
  });
};
