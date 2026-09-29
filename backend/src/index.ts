import { config } from './config/index.js';
import { createServer } from './server.js';

async function main() {
  let server: Awaited<ReturnType<typeof createServer>> | undefined;

  try {
    server = await createServer(config);
    const address = await server.listen({
      port: config.PORT,
      host: config.HOST,
    });
    server.log.info(`Server successfully listening on ${address}`);
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }

  // ── Graceful shutdown on Cloud Run SIGTERM ──────────────────────────────
  // Cloud Run sends SIGTERM before force-killing the container.
  // Fastify.close() drains in-flight requests before shutting down.
  const shutdown = async (signal: string) => {
    server?.log.info(`Received ${signal}. Starting graceful shutdown...`);
    try {
      if (server) {
        await server.close();
        server.log.info('Server closed gracefully.');
      }
      process.exit(0);
    } catch (err) {
      console.error('Error during graceful shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
