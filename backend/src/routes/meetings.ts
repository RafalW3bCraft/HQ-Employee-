import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { defaultMeetingsService, MeetingStatus } from '../modules/meetings/index.js';
import { ValidationError } from '../errors/index.js';

const availabilityQuerySchema = z.object({
  fromDate: z.string().min(1, 'fromDate is required'),
  toDate: z.string().min(1, 'toDate is required'),
  timezone: z.string().optional(),
  durationMinutes: z.coerce.number().optional(),
});

const createMeetingSchema = z.object({
  leadId: z.string().min(1, 'leadId is required'),
  slotTime: z.string().min(1, 'slotTime is required'),
  topic: z.string().optional(),
  timezone: z.string().optional(),
  durationMinutes: z.number().optional(),
  idempotencyKey: z.string().optional(),
});

const rescheduleMeetingSchema = z.object({
  newSlotTime: z.string().min(1, 'newSlotTime is required'),
  timezone: z.string().optional(),
  reason: z.string().optional(),
});

const cancelMeetingSchema = z.object({
  reason: z.string().optional(),
});

export const meetingsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultMeetingsService;

  // 1. Check availability
  fastify.get('/api/meetings/availability', async (request, reply) => {
    const parse = availabilityQuerySchema.safeParse(request.query);
    if (!parse.success) {
      throw new ValidationError('Invalid availability query parameters', parse.error.format());
    }
    const result = await service.checkAvailability(parse.data);
    return reply.status(200).send(result);
  });

  // 2. Schedule meeting
  fastify.post('/api/meetings', async (request, reply) => {
    const parse = createMeetingSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid meeting creation payload', parse.error.format());
    }
    const confirmation = await service.createMeeting(parse.data);
    return reply.status(201).send(confirmation);
  });

  // 3. List meetings
  fastify.get('/api/meetings', async (request, reply) => {
    const { leadId, status } = request.query as { leadId?: string; status?: MeetingStatus };
    const meetings = await service.listMeetings({ leadId, status });
    return reply.status(200).send(meetings);
  });

  // 4. Get meeting by ID
  fastify.get('/api/meetings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const meeting = await service.getMeeting(id);
    if (!meeting) {
      return reply.status(404).send({ error: { message: `Meeting '${id}' not found` } });
    }
    return reply.status(200).send(meeting);
  });

  // 5. Reschedule meeting
  fastify.post('/api/meetings/:id/reschedule', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = rescheduleMeetingSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid reschedule payload', parse.error.format());
    }
    const confirmation = await service.rescheduleMeeting(id, parse.data);
    return reply.status(200).send(confirmation);
  });

  // 6. Cancel meeting
  fastify.post('/api/meetings/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = cancelMeetingSchema.safeParse(request.body || {});
    if (!parse.success) {
      throw new ValidationError('Invalid cancellation payload', parse.error.format());
    }
    const result = await service.cancelMeeting(id, parse.data);
    return reply.status(200).send(result);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Calendar API Group (Section 46 requirement: /api/calendar)
  // ──────────────────────────────────────────────────────────────────────────
  fastify.get('/api/calendar/availability', async (request, reply) => {
    const parse = availabilityQuerySchema.safeParse(request.query);
    if (!parse.success) {
      throw new ValidationError('Invalid availability query parameters', parse.error.format());
    }
    const result = await service.checkAvailability(parse.data);
    return reply.status(200).send(result);
  });

  fastify.post('/api/calendar/events', async (request, reply) => {
    const parse = createMeetingSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid event creation payload', parse.error.format());
    }
    const confirmation = await service.createMeeting(parse.data);
    return reply.status(201).send(confirmation);
  });

  fastify.get('/api/calendar/events', async (request, reply) => {
    const { leadId, status } = request.query as { leadId?: string; status?: MeetingStatus };
    const meetings = await service.listMeetings({ leadId, status });
    return reply.status(200).send(meetings);
  });

  fastify.get('/api/calendar/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const meeting = await service.getMeeting(id);
    if (!meeting) {
      return reply.status(404).send({ error: { message: `Calendar event '${id}' not found` } });
    }
    return reply.status(200).send(meeting);
  });

  fastify.delete('/api/calendar/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await service.cancelMeeting(id, { reason: 'Deleted via Calendar API' });
    return reply.status(200).send(result);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Google Webhook Receiver (Section 46: /api/webhooks/google)
  // ──────────────────────────────────────────────────────────────────────────
  fastify.post('/api/webhooks/google', async (request, reply) => {
    const channelId = request.headers['x-goog-channel-id'] as string;
    const resourceState = request.headers['x-goog-resource-state'] as string;
    return reply.status(200).send({
      ok: true,
      message: 'Google webhook received and processed',
      channelId,
      resourceState,
      timestamp: new Date().toISOString(),
    });
  });
};
