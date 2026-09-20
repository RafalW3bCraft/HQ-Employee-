/**
 * Auth Module
 * JWT-based authentication for HQ Employee API.
 *
 * Provides:
 * - Token issuance (for admin sessions)
 * - Token validation (preHandler hook)
 * - Typed user context attached to FastifyRequest
 *
 * The `authenticate` decorator is registered on the Fastify instance in server.ts.
 * Individual routes opt in by adding it as a preHandler.
 */
import { randomUUID } from 'crypto';
import { AppError } from '../../errors/index.js';

export type UserRole = 'admin' | 'operator' | 'system';

export interface AuthUser {
  id: string;
  companyId: string;
  email?: string;
  role: UserRole;
}

export interface TokenPayload {
  sub: string;
  companyId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * AuthService: handles JWT token issuance for internal sessions.
 * Token verification itself is handled by @fastify/jwt on the Fastify instance.
 *
 * For the current implementation, this provides an admin-issued token flow.
 * In a full deployment, this would integrate with an identity provider.
 */
export class AuthService {
  /**
   * Build a token payload for a known operator.
   * The actual signing is delegated to fastify.jwt.sign() in the route handler.
   */
  buildPayload(user: { id: string; companyId: string; role: UserRole }): TokenPayload {
    return {
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
    };
  }

  /**
   * Validates that user extracted from JWT has authority over the given companyId.
   * Used in route handlers to prevent cross-tenant access.
   */
  assertCompanyAccess(user: TokenPayload, companyId: string): void {
    // System actors can access any company (used for internal tooling).
    if (user.role === 'system') return;

    if (user.companyId !== companyId) {
      throw new AppError(
        `Access denied: token is scoped to company '${user.companyId}', not '${companyId}'`,
        403,
        'FORBIDDEN'
      );
    }
  }

  /**
   * Generate a dev-only ephemeral token payload for local testing.
   * NEVER use this in production.
   */
  buildDevToken(companyId = 'c0000000-0000-0000-0000-000000000001'): TokenPayload {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Dev tokens are not available in production', 403, 'FORBIDDEN');
    }
    return {
      sub: randomUUID(),
      companyId,
      role: 'admin',
    };
  }
}

export const defaultAuthService = new AuthService();

export const authModule = {
  name: 'auth',
  status: 'active',
  description: 'JWT-based authentication and company-scoped authorization boundary',
  service: defaultAuthService,
};
