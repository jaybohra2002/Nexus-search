import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import type { ProtoGrpcType } from '@nexus/proto/dist/search';
import type { SearchRequest } from '@nexus/proto/dist/search/SearchRequest';
import type { SearchResponse } from '@nexus/proto/dist/search/SearchResponse';
const PROTO_PATH = path.resolve(__dirname, '../../../../../../../../packages/proto/src/search.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;
const rawSearchClient = new protoDescriptor.search.SearchService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);
export const searchClient = {
  HybridSearch: (data: SearchRequest): Promise<SearchResponse> => {
    return new Promise((resolve, reject) => {
      rawSearchClient.HybridSearch(data, (err, response) => {
        if (err) {
          return reject(err);
        }
        resolve(response as SearchResponse);
      });
    });
  },
};
