import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { searchClient } from '../grpc-client';


const SearchRequestSchema = z.object({
  query: z.string().min(1),
  k: z.number().int().min(1).max(50).default(10),
  alpha: z.number().min(0).max(1).default(0.5),
});

export const searchRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.post(
    '/',
    {
      schema: {
        body: SearchRequestSchema,
      },
    },
    async (request, reply) => {
      const body = SearchRequestSchema.parse(request.body);


      try {
        const results = await new Promise((resolve, reject) => {
          searchClient.HybridSearch(body, (err, response) => {
            if (err) {
              return reject(err);
            }
            resolve(response);
          });
        });
        return reply.send({ success: true, data: results });
      } catch (err: any) {
        server.log.error('gRPC Search Error:', err);
        return reply.status(500).send({ success: false, error: 'Internal Search Service Error' });
      }
    }
  );
};
