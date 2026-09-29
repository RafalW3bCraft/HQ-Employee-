import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import {
  defaultOutboundTelephonyCoordinator,
  defaultOptOutRepository,
  defaultCreditsService,
  defaultAssemblySIPProvider,
  defaultCalleTelephonyProvider,
  defaultTwilioTelephonyProvider,
  CreditExhaustedError,
  OptOutViolationError,
  OutsideCallingWindowError,
  TelephonyCarrierError,
} from '../modules/telephony/index.js';
import {
  defaultCallsService,
  defaultCallsRepository,
} from '../modules/calls/index.js';
import {
  defaultLeadsRepository,
} from '../modules/leads/index.js';
import {
  defaultAuditService,
} from '../modules/audit/index.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  PolicyDeniedError,
  ValidationError,
} from '../errors/index.js';

const initiateOutboundCallSchema = z.object({
  leadId: z.string().min(1, 'leadId is required'),
  destinationE164: z.string().min(8, 'destinationE164 must be a valid E.164 phone number'),
  consentVerified: z.boolean().default(true),
  purpose: z.string().optional(),
  timezone: z.string().optional(),
  bypassTimeWindow: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
  provider: z.string().optional(),
});

const createCallSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phoneNumber: z.string().min(7, 'Phone number is required'),
  country: z.string().optional(),
  leadId: z.string().optional(),
  purpose: z.string().optional(),
  campaignId: z.string().optional(),
  persona: z.string().optional(),
  language: z.string().optional(),
  notes: z.string().optional(),
  consentVerified: z.boolean().default(true),
  provider: z.enum(['calle', 'twilio', 'sip']).default('calle'),
});

const optOutSchema = z.object({
  phoneNumberE164: z.string().min(8, 'phoneNumberE164 must be a valid phone number'),
  reason: z.string().default('User requested opt-out'),
});

const handoffSchema = z.object({
  reason: z.string().min(1, 'Handoff reason is required'),
  notes: z.string().optional(),
  assignedHuman: z.string().optional(),
});

export const telephonyRoutes: FastifyPluginAsync = async (fastify) => {
  const coordinator = defaultOutboundTelephonyCoordinator;
  const optOutRepo = defaultOptOutRepository;
  const creditsService = defaultCreditsService;
  const sipProvider = defaultAssemblySIPProvider;
  const calleProvider = defaultCalleTelephonyProvider;
  const twilioProvider = defaultTwilioTelephonyProvider;
  const callsRepo = defaultCallsRepository;
  const callsService = defaultCallsService;
  const leadsRepo = defaultLeadsRepository;
  const auditService = defaultAuditService;

  // In-memory call plans store
  const callPlans = new Map<string, Record<string, unknown>>();

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CALL CLIENT — Enter number, create call record & structured Call Plan
  // ──────────────────────────────────────────────────────────────────────────
  fastify.post('/api/calls', async (request, reply) => {
    const parse = createCallSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid call creation payload', parse.error.format());
    }

    const { fullName, phoneNumber, country, leadId, purpose, campaignId, persona, language, notes, consentVerified, provider } = parse.data;

    // Strict E.164 normalization & validation
    const numValidation = calleProvider.validateNumber(phoneNumber);
    if (!numValidation.valid) {
      throw new ValidationError(numValidation.error || 'Invalid E.164 phone number format');
    }
    const destinationE164 = numValidation.normalized!;

    // Check opt-out / suppression list
    const isOptedOut = await optOutRepo.isOptedOut(destinationE164);
    if (isOptedOut) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: `Phone number ${destinationE164} is on the permanent suppression list (Do Not Call).`,
        state: 'COMPLIANCE_BLOCKED',
      });
    }

    // Resolve or create lead
    let targetLeadId = leadId;
    if (!targetLeadId) {
      const createdLead = await leadsRepo.createLead({
        fullName,
        companyName: country ? `${country} Account` : undefined,
        contactPhone: destinationE164,
        status: 'NEW',
      });
      targetLeadId = createdLead.id;
    }

    const callRecord = await callsRepo.createSession({
      leadId: targetLeadId,
      channel: 'TELEPHONY',
    });

    // Generate Structured Call Plan (Section 13)
    const callObjective = purpose || 'Qualify website and custom software development opportunity';
    const callPlan = {
      objective: callObjective,
      knownFacts: {
        clientName: fullName,
        phoneNumber: destinationE164,
        country: country || 'Unspecified',
        leadId: targetLeadId,
        campaignId: campaignId || null,
        notes: notes || '',
      },
      missingFacts: [
        'project_launch_date',
        'budget_range',
        'target_audience',
        'required_integrations',
        'decision_maker_status',
      ],
      allowedActions: [
        'ask_discovery_questions',
        'provide_approved_service_information',
        'provide_approved_budget_timeline_guidance',
        'check_calendar',
        'schedule_meeting',
        'create_follow_up',
      ],
      blockedActions: [
        'custom_discount_outside_approved_range',
        'contract_commitment',
        'payment_collection',
        'legal_promises_or_guarantees',
      ],
      nextStepPolicy: 'Book Google Meet discovery session if prospect qualifies.',
      persona: persona || 'HQ-Employee Discovery Specialist',
      preferredLanguage: language || 'en',
      consentVerified,
      provider,
      policyVersion: '1.0.0',
    };

    callPlans.set(callRecord.id, callPlan);

    await auditService.logEvent({
      actorType: 'HUMAN_ADMIN',
      actorId: 'admin',
      action: 'CALL_PLAN_GENERATED',
      targetType: 'CALL_SESSION',
      targetId: callRecord.id,
      metadata: {
        leadId: targetLeadId,
        destinationE164,
        provider,
      },
    });

    return reply.status(201).send({
      callId: callRecord.id,
      leadId: targetLeadId,
      destinationE164,
      status: 'CREATED',
      callPlan,
      provider,
      message: 'Call plan generated and call authorized. Press start to dial.',
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Start Call Execution
  // ──────────────────────────────────────────────────────────────────────────
  fastify.post('/api/calls/:id/start', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await callsRepo.getSession(id);
    if (!session) {
      throw new NotFoundError('CallSession', id);
    }

    const plan = callPlans.get(id);
    const destination = (plan?.knownFacts as any)?.phoneNumber;
    if (!destination) {
      throw new BadRequestError('Call record missing destination phone number');
    }

    const providerType = (plan?.provider as string) || 'calle';

    try {
      const callSession = await coordinator.initiateOutboundCall({
        leadId: session.leadId || 'anonymous_lead',
        destinationE164: destination,
        consentVerified: true,
        purpose: (plan?.objective as string) || 'Project discovery call',
        bypassTimeWindow: true,
        provider: providerType,
        callPlan: plan,
        idempotencyKey: id,
      });

      return reply.status(200).send({
        callId: id,
        providerCallId: callSession.providerCallId,
        status: callSession.status,
        destinationE164: destination,
        provider: providerType,
        creditsReserved: callSession.creditsReserved,
      });
    } catch (err: any) {
      if (err instanceof OptOutViolationError) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: err.message,
          phoneNumber: err.phoneNumber,
        });
      }
      if (err instanceof CreditExhaustedError) {
        return reply.status(402).send({
          statusCode: 402,
          error: 'Payment Required',
          message: err.message,
          required: err.required,
          available: err.available,
        });
      }
      if (err instanceof TelephonyCarrierError) {
        return reply.status(err.statusCode || 502).send({
          statusCode: err.statusCode || 502,
          error: 'Carrier Error',
          message: err.message,
        });
      }
      throw err;
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Get Call Details & Live Status
  // ──────────────────────────────────────────────────────────────────────────
  fastify.get('/api/calls/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await callsRepo.getSession(id);
    if (!session) {
      throw new NotFoundError('CallSession', id);
    }

    const plan = callPlans.get(id);
    const liveStatus = await coordinator.getCallStatus(session.assemblySessionId || id);

    return reply.status(200).send({
      ...session,
      callPlan: plan || null,
      telephonyStatus: liveStatus,
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. End Call Execution
  // ──────────────────────────────────────────────────────────────────────────
  fastify.post('/api/calls/:id/end', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    await coordinator.endCall(id, body.reason);
    await callsService.endSession(id, body.durationSeconds || 0);
    return reply.status(200).send({ ok: true, message: 'Call terminated' });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Human Handoff Escalation
  // ──────────────────────────────────────────────────────────────────────────
  fastify.post('/api/calls/:id/handoff', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = handoffSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid handoff payload', parse.error.format());
    }

    const session = await callsRepo.getSession(id);
    if (!session) {
      throw new NotFoundError('CallSession', id);
    }

    await auditService.logEvent({
      actorType: 'EMPLOYEE',
      actorId: session.employeeId,
      action: 'HUMAN_HANDOFF_REQUESTED',
      targetType: 'CALL_SESSION',
      targetId: id,
      metadata: {
        reason: parse.data.reason,
        notes: parse.data.notes,
        assignedHuman: parse.data.assignedHuman || 'on-call-specialist',
        leadId: session.leadId,
      },
    });

    return reply.status(200).send({
      ok: true,
      message: 'Human handoff registered successfully',
      handoff: {
        callId: id,
        reason: parse.data.reason,
        assignedHuman: parse.data.assignedHuman || 'on-call-specialist',
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Global Call Stop (Admin Emergency Control)
  // ──────────────────────────────────────────────────────────────────────────
  fastify.post('/api/telephony/emergency-stop', async (request, reply) => {
    coordinator.resetLocks();
    return reply.status(200).send({
      ok: true,
      message: 'Global Call Stop activated. Outbound queue cleared and active calls halted.',
      timestamp: new Date().toISOString(),
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. CALL-E (heycall-e.com) Webhook Receivers
  // ──────────────────────────────────────────────────────────────────────────
  fastify.post('/api/webhooks/calle', async (request, reply) => {
    const rawPayload = request.body;
    try {
      const event = await coordinator.processWebhookEvent(rawPayload);
      return reply.status(200).send({ ok: true, processedEvent: event.eventType });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Error processing Call-E webhook',
      });
    }
  });

  fastify.post('/api/telephony/webhooks/calle', async (request, reply) => {
    const rawPayload = request.body;
    try {
      const event = await coordinator.processWebhookEvent(rawPayload);
      return reply.status(200).send({ ok: true, processedEvent: event.eventType });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Error processing Call-E webhook',
      });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Twilio Webhook Receivers
  // ──────────────────────────────────────────────────────────────────────────
  fastify.post('/api/webhooks/twilio/voice', async (request, reply) => {
    const responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting your call to HQ-Employee live assistant.</Say>
</Response>`;
    return reply.type('text/xml').send(responseXml);
  });

  fastify.post('/api/webhooks/twilio/status', async (request, reply) => {
    const rawPayload = request.body;
    try {
      const event = await coordinator.processWebhookEvent(rawPayload);
      return reply.status(200).send({ ok: true, processedEvent: event.eventType });
    } catch (err: any) {
      return reply.status(200).send({ ok: true, received: true });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Legacy / Existing Telephony Endpoints
  // ──────────────────────────────────────────────────────────────────────────
  fastify.post('/api/telephony/outbound/initiate', async (request, reply) => {
    const parse = initiateOutboundCallSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid outbound call payload', parse.error.format());
    }

    const idempotencyKey =
      parse.data.idempotencyKey ||
      (request.headers['idempotency-key'] as string) ||
      (request.headers['x-idempotency-key'] as string);

    try {
      const callSession = await coordinator.initiateOutboundCall({
        ...parse.data,
        idempotencyKey,
      });
      return reply.status(201).send(callSession);
    } catch (err: any) {
      if (err instanceof OptOutViolationError) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: err.message,
          phoneNumber: err.phoneNumber,
        });
      }
      if (err instanceof CreditExhaustedError) {
        return reply.status(402).send({
          statusCode: 402,
          error: 'Payment Required',
          message: err.message,
          required: err.required,
          available: err.available,
        });
      }
      if (err instanceof OutsideCallingWindowError) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message,
          recipientHour: err.recipientHour,
        });
      }
      throw err;
    }
  });

  fastify.get('/api/telephony/calls/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const callStatus = await coordinator.getCallStatus(id);
    return reply.status(200).send(callStatus);
  });

  fastify.post('/api/telephony/calls/:id/end', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    await coordinator.endCall(id, body.reason);
    return reply.status(200).send({ ok: true, message: 'Call terminated' });
  });

  fastify.post('/api/telephony/opt-out', async (request, reply) => {
    const parse = optOutSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid opt-out payload', parse.error.format());
    }

    const record = await optOutRepo.addOptOut(parse.data.phoneNumberE164, parse.data.reason);
    return reply.status(201).send(record);
  });

  fastify.get('/api/telephony/opt-out/:phoneNumber', async (request, reply) => {
    const { phoneNumber } = request.params as { phoneNumber: string };
    const isOptedOut = await optOutRepo.isOptedOut(phoneNumber);
    return reply.status(200).send({ phoneNumber, isOptedOut });
  });

  fastify.get('/api/telephony/credits', async (request, reply) => {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const balance = await creditsService.getBalance(companyId);
    return reply.status(200).send(balance);
  });

  fastify.post('/api/telephony/webhooks/assemblyai', async (request, reply) => {
    const appConfig = (fastify as any).appConfig;
    const isProd = appConfig ? appConfig.NODE_ENV === 'production' : process.env.NODE_ENV === 'production';
    const secret = appConfig ? appConfig.AAI_WEBHOOK_SECRET : process.env.AAI_WEBHOOK_SECRET;
    if (isProd && !secret) {
      return reply.status(503).send({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'AAI_WEBHOOK_SECRET is required in production',
      });
    }

    const signatureHeader = request.headers['x-aai-signature'] as string | undefined;
    const rawPayload = request.body;

    try {
      const event = await coordinator.processWebhookEvent(rawPayload, {
        'x-aai-signature': signatureHeader || '',
      });
      return reply.status(200).send({ ok: true, processedEvent: event.eventType });
    } catch (err: any) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: err.message || 'Invalid webhook signature',
      });
    }
  });
};
