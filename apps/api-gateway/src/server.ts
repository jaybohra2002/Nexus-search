import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import app from './app';
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
const start = async () => {
  try {
    await server.register(app);
    await server.listen({ port: 3000, host: '0.0.0.0' });
    server.log.info('API Gateway successfully started using Autoload Architecture.');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
