import { config } from './config/index.js';
import { createServer } from './server.js';

async function main() {
  try {
    const server = await createServer(config);
    const address = await server.listen({
      port: config.PORT,
      host: config.HOST,
    });
    server.log.info(`Server successfully listening on ${address}`);
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

main();
