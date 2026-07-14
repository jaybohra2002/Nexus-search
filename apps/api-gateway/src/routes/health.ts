import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createResponse } from '../plugins/errorHandler';
export const healthRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {

  const healthResponseSchema = z.object({
    status: z.string(),
    timestamp: z.string(),
    uptime: z.number(),
  });

  server.get('/', {
    schema: {
      description: 'Liveness probe for infrastructure orchestrators',
      response: {
        200: healthResponseSchema,
      },
    },
  }, async (request, reply) => {


    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
};
