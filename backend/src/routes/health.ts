import { FastifyPluginAsync } from 'fastify';
import { pool } from '../db/index.js';
import { config } from '../config/index.js';

const SERVICE_VERSION = '0.1.0';
const startTime = Date.now();

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // ── /health/live ─────────────────────────────────────────────────────────
  // Liveness: process is alive and event loop is running.
  // Cloud Run kills and restarts the container if this returns non-2xx.
  fastify.get('/health/live', async (request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      service: 'hq-employee-api',
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      requestId: request.id,
    });
  });

  // ── /health/ready ─────────────────────────────────────────────────────────
  // Readiness: required dependencies are available.
  // Cloud Run only sends traffic once this returns 2xx.
  fastify.get('/health/ready', async (request, reply) => {
    const checks: Record<string, 'ok' | 'degraded' | 'unavailable'> = {};
    let overallStatus: 'ok' | 'degraded' = 'ok';

    // Database connectivity check
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      checks.database = 'ok';
    } catch {
      checks.database = 'unavailable';
      overallStatus = 'degraded';
    }

    // Required configuration check (non-secret presence only)
    const requiredConfigKeys = ['ASSEMBLYAI_API_KEY', 'JWT_SECRET'] as const;
    const configMissing = requiredConfigKeys.filter(
      (k) =>
        !config[k] ||
        config[k] === 'dummy_dev_key_for_testing'
    );
    checks.config = configMissing.length === 0 ? 'ok' : 'degraded';
    if (configMissing.length > 0) overallStatus = 'degraded';

    const statusCode = overallStatus === 'ok' ? 200 : 503;
    return reply.status(statusCode).send({
      status: overallStatus,
      service: 'hq-employee-api',
      version: SERVICE_VERSION,
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      checks,
      requestId: request.id,
    });
  });

  // ── Legacy aliases ─────────────────────────────────────────────────────────
  // /health and /api/health kept for backward compatibility with existing tests.
  const legacyHandler = async (request: any, reply: any) => {
    return reply.status(200).send({
      status: 'ok',
      service: 'hq-employee-api',
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      requestId: request.id,
    });
  };
  fastify.get('/health', legacyHandler);
  fastify.get('/api/health', legacyHandler);
};
