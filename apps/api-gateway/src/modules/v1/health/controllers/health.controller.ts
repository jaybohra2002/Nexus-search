import { FastifyRequest, FastifyReply } from 'fastify';
import { HealthService } from '../services/health.service';
import { createResponse } from '../../../../plugins/02-errorHandler';
export class HealthController {
  static async checkHealth(request: FastifyRequest, reply: FastifyReply) {
    try {
      const status = await HealthService.checkSystemHealth();
      return reply.send(createResponse(request, true, status));
    } catch (err: any) {
      request.log.error('Health Check Failed:', err);
      throw Object.assign(new Error('System Unhealthy'), { statusCode: 503 });
    }
  }
}
