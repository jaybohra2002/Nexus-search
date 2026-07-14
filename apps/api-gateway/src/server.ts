import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { healthRoutes } from './routes/health';
import { searchRoutes } from './routes/search';
import errorHandlerPlugin from './plugins/errorHandler';
import gracefulShutdownPlugin from './plugins/gracefulShutdown';

const server = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
}).withTypeProvider<ZodTypeProvider>();

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

const registerPlugins = async () => {
  await server.register(helmet);
  await server.register(cors, {
    origin: '*', // We'll restrict this in production
  });
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
};

const registerRoutes = async () => {
  await server.register(healthRoutes, { prefix: '/health' });
  await server.register(searchRoutes, { prefix: '/search' });
};
const registerHardening = async () => {
  await server.register(errorHandlerPlugin);
  await server.register(gracefulShutdownPlugin);
};


const start = async () => {
  try {
    await registerPlugins();
    await registerRoutes();
    await registerHardening();
    await server.listen({ port: 3000, host: '0.0.0.0' });
    server.log.info('API Gateway successfully started and protected.');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
