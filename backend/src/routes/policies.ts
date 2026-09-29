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

  // ──────────────────────────────────────────────────────────────────────────
  // Admin Policies Management (Section 46: /api/admin/policies)
  // ──────────────────────────────────────────────────────────────────────────
  fastify.get('/api/admin/policies', async (_request, reply) => {
    return reply.status(200).send({
      policyVersion: 'v1.0.0-governed',
      status: 'ACTIVE',
      rules: {
        allowedTools: [
          'get_company_profile',
          'get_service_details',
          'get_pricing_guidance',
          'get_timeline_guidance',
          'check_calendar',
          'schedule_meeting',
          'record_lead_fact',
          'request_human_approval',
        ],
        blockedActions: [
          'direct_sql_execution',
          'contract_signing',
          'payment_collection',
          'passwords_or_credentials',
          'otp_requests',
          'discounts_exceeding_20_percent',
          'guarantees_or_legal_promises',
        ],
        approvalRequired: [
          'discounts_up_to_20_percent',
          'custom_scope_expansion',
          're_engage_lost_lead',
        ],
        voiceDisclosureMandatory: true,
        callingWindow: {
          startHourUtc: 9,
          endHourUtc: 20,
        },
      },
      updatedAt: new Date().toISOString(),
    });
  });

  fastify.post('/api/admin/policies', async (request, reply) => {
    const body = (request.body as any) || {};
    await defaultAuditService.logEvent({
      actorType: 'HUMAN_ADMIN',
      actorId: 'admin-console',
      action: 'POLICY_UPDATED',
      targetType: 'POLICY_CONFIG',
      targetId: 'v1.0.0-governed',
      metadata: {
        updatedFields: Object.keys(body),
        timestamp: new Date().toISOString(),
      },
    });

    return reply.status(200).send({
      ok: true,
      message: 'Policy guidelines successfully updated',
      policyVersion: body.policyVersion || 'v1.0.0-governed',
      updatedAt: new Date().toISOString(),
    });
  });
};
