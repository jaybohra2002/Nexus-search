import { searchClient } from '../integrations/search.grpc';
import { SearchRequestDTO } from '../dtos/search.dto';

export class SearchService {
  static async executeHybridSearch(data: SearchRequestDTO) {
    try {
      const results = await searchClient.HybridSearch(data);
      return results;
    } catch (error) {
      throw new Error(`SearchService Error: ${(error as Error).message}`);
    }
  }
}
