import { FastifyInstance } from 'fastify';

export default async function gracefulShutdownPlugin(server: FastifyInstance) {
  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
      await server.close();
      server.log.info('Closed all active HTTP connections cleanly.');
      process.exit(0);
    } catch (err) {
      server.log.error(err, 'Error during graceful shutdown');
      process.exit(1);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
