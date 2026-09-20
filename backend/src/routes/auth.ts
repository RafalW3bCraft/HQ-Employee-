/**
 * Auth Routes
 *
 * POST /api/auth/token  — Issue a JWT for a validated operator session
 * GET  /api/auth/me     — Return the decoded user from current Bearer token
 * POST /api/auth/dev-token — Dev-only: issue a token for local testing
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { defaultAuthService } from '../modules/auth/index.js';
import { AppError, ValidationError } from '../errors/index.js';

const issueTokenSchema = z.object({
  companyId: z.string().uuid('companyId must be a valid UUID'),
  role: z.enum(['admin', 'operator', 'system']).default('operator'),
  // In production, these would be validated against a real user store.
  // For now, we trust the caller to provide valid credentials.
  operatorId: z.string().uuid('operatorId must be a valid UUID'),
  // Dev-only secret passed in the body; in production replace with real credential flow.
  devSecret: z.string().optional(),
});

const DEV_OPERATOR_SECRET = process.env.DEV_OPERATOR_SECRET || 'hq_dev_operator_2026';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = defaultAuthService;

  /**
   * POST /api/auth/token
   * Issue a JWT for an operator session.
   * In development: accepts devSecret in body.
   * In production: replace devSecret check with real identity verification.
   */
  fastify.post(
    '/api/auth/token',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parse = issueTokenSchema.safeParse(request.body);
      if (!parse.success) {
        throw new ValidationError('Invalid token request', parse.error.format());
      }

      const { companyId, role, operatorId, devSecret } = parse.data;

      // In non-production: validate the dev secret
      if (process.env.NODE_ENV !== 'production') {
        if (devSecret !== DEV_OPERATOR_SECRET) {
          throw new AppError('Invalid dev operator secret', 401, 'UNAUTHORIZED');
        }
      } else {
        // Production: replace this block with real identity verification
        // e.g., validate against a users table or identity provider
        throw new AppError(
          'Production auth not yet implemented. Integrate with your identity provider.',
          501,
          'NOT_IMPLEMENTED'
        );
      }

      const payload = authService.buildPayload({ id: operatorId, companyId, role });
      const token = fastify.jwt.sign(payload);

      return reply.status(200).send({
        token,
        expiresIn: '24h',
        companyId,
        role,
      });
    }
  );

  /**
   * GET /api/auth/me
   * Return the decoded JWT user. Requires valid Bearer token.
   */
  fastify.get(
    '/api/auth/me',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      return reply.status(200).send({
        user: request.user,
        requestId: request.id,
      });
    }
  );

  /**
   * POST /api/auth/dev-token
   * Quick dev-only token generation. Blocked in production.
   */
  fastify.post(
    '/api/auth/dev-token',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('Dev tokens are not available in production', 403, 'FORBIDDEN');
      }

      const { companyId } = (request.body as any) || {};
      const payload = authService.buildDevToken(
        companyId || 'c0000000-0000-0000-0000-000000000001'
      );
      const token = fastify.jwt.sign(payload);

      return reply.status(200).send({
        token,
        expiresIn: '24h',
        warning: 'Dev-only token. Do not use in production.',
        ...payload,
      });
    }
  );
};
