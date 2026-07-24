import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';

async function securityPlugin(server: FastifyInstance) {
  await server.register(helmet);
  await server.register(cors, {
    origin: '*', // WILL BE CHANGING IT LATER I have just added all origins for now.
  });
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
};
export default fp(securityPlugin);
