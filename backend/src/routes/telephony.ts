import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  defaultOutboundTelephonyCoordinator,
  defaultOptOutRepository,
  defaultCreditsService,
  defaultAssemblySIPProvider,
  CreditExhaustedError,
  OptOutViolationError,
  OutsideCallingWindowError,
} from '../modules/telephony/index.js';
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
});

const optOutSchema = z.object({
  phoneNumberE164: z.string().min(8, 'phoneNumberE164 must be a valid phone number'),
  reason: z.string().default('User requested opt-out'),
});

export const telephonyRoutes: FastifyPluginAsync = async (fastify) => {
  const coordinator = defaultOutboundTelephonyCoordinator;
  const optOutRepo = defaultOptOutRepository;
  const creditsService = defaultCreditsService;
  const sipProvider = defaultAssemblySIPProvider;

  // 1. Initiate Governed Outbound Call
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

  // 2. Query Call Status & Safe Retry State
  fastify.get('/api/telephony/calls/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const callStatus = await coordinator.getCallStatus(id);
    return reply.status(200).send(callStatus);
  });

  // 3. Force Terminate Call
  fastify.post('/api/telephony/calls/:id/end', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    await coordinator.endCall(id, body.reason);
    return reply.status(200).send({ ok: true, message: 'Call terminated' });
  });

  // 4. Opt-out Registry Management
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

  // 5. Query Credit Balances
  fastify.get('/api/telephony/credits', async (request, reply) => {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const balance = await creditsService.getBalance(companyId);
    return reply.status(200).send(balance);
  });

  // 6. AssemblyAI Telephony Signed Webhook Receiver
  fastify.post('/api/telephony/webhooks/assemblyai', async (request, reply) => {
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
