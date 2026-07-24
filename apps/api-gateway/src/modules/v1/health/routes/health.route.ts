import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { HealthController } from '../controllers/health.controller';

const healthRoute: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.get('/', HealthController.checkHealth);
};

export default healthRoute;
