/**
 * Objectives Routes
 *
 * POST   /api/objectives/generate           — Scan leads and generate pending objectives
 * GET    /api/objectives/next               — Get the next actionable objective
 * GET    /api/objectives                    — List all objectives for company
 * GET    /api/objectives/by-lead/:leadId    — List objectives for a lead
 * POST   /api/objectives/:id/complete       — Mark objective as completed
 * POST   /api/objectives/:id/fail           — Mark objective as failed (with retry)
 * POST   /api/objectives/:id/defer          — Defer objective to a later time
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { defaultObjectiveEngine } from '../modules/objectives/index.js';
import { ValidationError } from '../errors/index.js';

const completeSchema = z.object({
  result: z.string().min(1),
  actorId: z.string().default('employee:coordinator'),
});

const failSchema = z.object({
  reason: z.string().min(1),
});

const deferSchema = z.object({
  deferUntil: z.string().datetime(),
});

export const objectiveRoutes: FastifyPluginAsync = async (fastify) => {
  const engine = defaultObjectiveEngine;

  /**
   * POST /api/objectives/generate
   * Trigger objective generation for a company (cron/webhook calls this).
   */
  fastify.post('/api/objectives/generate', async (request, reply) => {
    const { companyId } = request.query as { companyId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const objectives = await engine.generateObjectives(companyId);
    return reply.status(201).send({
      generated: objectives.length,
      objectives,
    });
  });

  /**
   * GET /api/objectives/next
   * Get the highest-priority actionable objective with policy evaluation.
   */
  fastify.get('/api/objectives/next', async (request, reply) => {
    const { companyId } = request.query as { companyId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const evaluation = await engine.getNextObjective(companyId);
    if (!evaluation) {
      return reply.status(200).send({
        hasNext: false,
        message: 'No pending objectives. All leads are on track.',
      });
    }

    return reply.status(200).send({
      hasNext: true,
      ...evaluation,
    });
  });

  /**
   * GET /api/objectives
   * List all objectives for a company.
   */
  fastify.get('/api/objectives', async (request, reply) => {
    const { companyId } = request.query as { companyId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const objectives = await engine['repository'].listAll(companyId);
    return reply.status(200).send({
      objectives,
      total: objectives.length,
    });
  });

  /**
   * GET /api/objectives/by-lead/:leadId
   * List objectives for a specific lead.
   */
  fastify.get('/api/objectives/by-lead/:leadId', async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const { companyId } = request.query as { companyId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const objectives = await engine['repository'].listByLead(leadId, companyId);
    return reply.status(200).send({
      objectives,
      total: objectives.length,
    });
  });

  /**
   * POST /api/objectives/:id/complete
   * Mark an objective as completed after the employee has taken action.
   */
  fastify.post('/api/objectives/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = completeSchema.safeParse(request.body);
    if (!parse.success) throw new ValidationError('Invalid completion request', parse.error.format());

    const objective = await engine.completeObjective(id, parse.data.result, parse.data.actorId);
    return reply.status(200).send(objective);
  });

  /**
   * POST /api/objectives/:id/fail
   * Mark an objective as failed. Retries if under maxAttempts.
   */
  fastify.post('/api/objectives/:id/fail', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = failSchema.safeParse(request.body);
    if (!parse.success) throw new ValidationError('Invalid fail request', parse.error.format());

    const objective = await engine.failObjective(id, parse.data.reason);
    return reply.status(200).send(objective);
  });

  /**
   * POST /api/objectives/:id/defer
   * Defer an objective to a later time.
   */
  fastify.post('/api/objectives/:id/defer', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = deferSchema.safeParse(request.body);
    if (!parse.success) throw new ValidationError('Invalid defer request', parse.error.format());

    const objective = await engine.deferObjective(id, new Date(parse.data.deferUntil));
    return reply.status(200).send(objective);
  });
};
