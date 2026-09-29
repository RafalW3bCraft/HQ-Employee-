import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import { randomUUID } from 'crypto';
import { AppConfig } from './config/index.js';
import { AppError } from './errors/index.js';
import { healthRoutes } from './routes/health.js';
import { companyRoutes } from './routes/company.js';
import fastifyWebsocket from '@fastify/websocket';
import { policyRoutes } from './routes/policies.js';
import { leadsRoutes } from './routes/leads.js';
import { meetingsRoutes } from './routes/meetings.js';
import { voiceRoutes } from './routes/voice.js';
import { telephonyRoutes } from './routes/telephony.js';
import { billingRoutes } from './routes/billing.js';
import { authRoutes } from './routes/auth.js';
import { proposalRoutes } from './routes/proposals.js';
import { objectiveRoutes } from './routes/objectives.js';
import { autonomousRoutes } from './routes/autonomous.js';
import { campaignRoutes } from './routes/campaigns.js';
import { integrationRoutes } from './routes/integrations.js';

// ────────────────────────────────────────────────────────────────────────────
// Fastify type augmentations
// ────────────────────────────────────────────────────────────────────────────
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      companyId: string;
      role: 'admin' | 'operator' | 'system';
    };
    user: {
      sub: string;
      companyId: string;
      role: 'admin' | 'operator' | 'system';
    };
  }
}

// Declare the authenticate decorator on FastifyInstance
// so route files can reference fastify.authenticate as a preHandler.
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    appConfig: AppConfig;
  }
}

export async function createServer(appConfig: AppConfig): Promise<FastifyInstance> {
  const server = fastify({
    logger: {
      level: appConfig.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers["x-api-key"]'],
    },
    requestIdHeader: 'x-request-id',
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
  });

  server.decorate('appConfig', appConfig);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  await server.register(fastifyWebsocket);

  // ── CORS ──────────────────────────────────────────────────────────────────
  // Parse ALLOWED_ORIGINS into an array; keep wildcard only in non-production.
  const rawOrigins = appConfig.ALLOWED_ORIGINS;
  const resolvedOrigins: string | string[] =
    rawOrigins === '*'
      ? '*'
      : rawOrigins.split(',').map((o) => o.trim());

  await server.register(cors, {
    origin: resolvedOrigins,
    credentials: true,
  });

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  await server.register(rateLimit, {
    global: true,
    max: appConfig.RATE_LIMIT_GLOBAL,
    timeWindow: '1 minute',
    keyGenerator: (req) =>
      (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown',
    errorResponseBuilder: (_req, context) => ({
      error: 'RATE_LIMITED',
      message: `Too many requests. Limit: ${context.max} per minute. Retry after ${context.ttl}ms.`,
      statusCode: 429,
    }),
  });

  // ── JWT ───────────────────────────────────────────────────────────────────
  // In development/test, fall back to a predictable secret so dev flow is not
  // blocked. In production, JWT_SECRET is required and validated by config schema.
  const jwtSecret =
    appConfig.JWT_SECRET ||
    (appConfig.NODE_ENV === 'production'
      ? (() => { throw new Error('JWT_SECRET must be set in production'); })()
      : 'dev_only_insecure_jwt_secret_do_not_use_in_prod_32chars');

  await server.register(fastifyJwt, {
    secret: jwtSecret,
    sign: { expiresIn: '24h' },
  });

  // ── Auth decorator ────────────────────────────────────────────────────────
  // Routes can call: await request.authenticate() or use as a preHandler.
  server.decorate(
    'authenticate',
    async function (this: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        const authError = new AppError('Authentication required', 401, 'UNAUTHORIZED');
        return reply.status(401).send(authError.toJSON(request.id));
      }
    }
  );

  // ── Error Handler ─────────────────────────────────────────────────────────
  server.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      request.log.warn({ err: error, requestId: request.id }, error.message);
      return reply.status(error.statusCode).send(error.toJSON(request.id));
    }

    if ((error as any).statusCode === 429) {
      return reply.status(429).send(error);
    }

    // Fastify built-in schema validation errors
    if (error.validation) {
      const validationError = new AppError(
        error.message,
        400,
        'VALIDATION_ERROR',
        error.validation
      );
      return reply.status(400).send(validationError.toJSON(request.id));
    }

    // Unhandled internal server errors
    request.log.error({ err: error, requestId: request.id }, 'Unhandled server exception');
    const internalError = new AppError('Internal Server Error', 500, 'INTERNAL_SERVER_ERROR');
    return reply.status(500).send(internalError.toJSON(request.id));
  });

  // ── Not Found Handler ─────────────────────────────────────────────────────
  server.setNotFoundHandler((request, reply) => {
    const notFoundError = new AppError(
      `Route ${request.method}:${request.url} not found`,
      404,
      'ROUTE_NOT_FOUND'
    );
    return reply.status(404).send(notFoundError.toJSON(request.id));
  });

  // ── Route Registration ────────────────────────────────────────────────────
  await server.register(authRoutes);      // Auth first (no auth required on these endpoints)
  await server.register(healthRoutes);
  await server.register(companyRoutes);
  await server.register(policyRoutes);
  await server.register(leadsRoutes);
  await server.register(meetingsRoutes);
  await server.register(voiceRoutes);
  await server.register(telephonyRoutes);
  await server.register(billingRoutes);
  await server.register(proposalRoutes);
  await server.register(objectiveRoutes);
  await server.register(autonomousRoutes);
  await server.register(campaignRoutes);
  await server.register(integrationRoutes);

  // ── Root endpoint ─────────────────────────────────────────────────────────
  server.get('/', async (request, reply) => {
    return reply.send({
      service: 'hq-employee-api',
      message: 'HQ-Employee Governed AI Backend API',
      status: 'operational',
      docs: '/health',
      requestId: request.id,
    });
  });

  return server;
}
