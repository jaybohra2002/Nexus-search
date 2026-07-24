import { FastifyRequest, FastifyReply } from 'fastify';
import { SearchRequestDTO } from '../dtos/search.dto';
import { SearchService } from '../services/search.service';
import { createResponse } from '../../../../plugins/02-errorHandler';
export class SearchController {
  static async handleSearch(request: FastifyRequest, reply: FastifyReply) {
    const searchParams = request.body as SearchRequestDTO;
    try {
      const results = await SearchService.executeHybridSearch(searchParams);
      return reply.send(createResponse(request, true, results));
    } catch (err: any) {
      request.log.error('Search Controller Caught Error:', err);
      throw Object.assign(new Error('Internal Search Service Error'), { statusCode: 500 });
    }
  }
}
