import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { SearchRequestSchema } from '../dtos/search.dto';
import { SearchController } from '../controllers/search.controller';
const searchRoute: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.post(
    '/',
    {
      schema: {
        body: SearchRequestSchema
      },
    },
    SearchController.handleSearch
  );
};

export default searchRoute;
