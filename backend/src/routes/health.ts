import { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  const startTime = Date.now();

  fastify.get('/health', async (request, reply) => {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    return reply.status(200).send({
      status: 'ok',
      service: 'hq-employee-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: uptimeSeconds,
      requestId: request.id,
    });
  });
};
