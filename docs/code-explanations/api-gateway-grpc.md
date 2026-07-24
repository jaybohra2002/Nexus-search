# API Gateway: gRPC Client Architecture

This document provides a line-by-line explanation of the `search.grpc.ts` file. 
If you have ever been confused by how Node.js communicates via gRPC, this is the definitive guide.

## The Goal
The API Gateway needs to act as a **gRPC Client**. It needs to send a binary request over the network to the `search-service` (which acts as the **gRPC Server**).

---

## Line-by-Line Breakdown

### 1. The Core Libraries
```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
```
- `@grpc/grpc-js`: This is the official Google library that handles the actual HTTP/2 networking. It opens sockets, encodes binary data, and sends it across the wire.
- `@grpc/proto-loader`: This library reads the `.proto` text file from your hard drive and converts it into a JavaScript object that `grpc-js` can understand.

### 2. The TypeScript Types
```typescript
import type { ProtoGrpcType } from '@nexus/proto/dist/search';
import type { SearchRequest } from '@nexus/proto/dist/search/SearchRequest';
import type { SearchResponse } from '@nexus/proto/dist/search/SearchResponse';
```
Earlier in this project, we ran a tool called `proto-loader-gen-types`. It looked at our `search.proto` file and automatically generated TypeScript interfaces for every message. 
- **`SearchRequest`**: A strict TypeScript interface ensuring you pass `{ query: string, k: number, alpha: number }`. If you pass `{ query: 123 }`, the IDE will yell at you.
- **`SearchResponse`**: A strict TypeScript interface describing the data returned by the server. 
- **`ProtoGrpcType`**: A massive root-level type that maps exactly how the entire `search` package is structured. It proves that `SearchService` exists and that it has a `HybridSearch` method.

*(Crucial Note: These imports use `type`. That means they disappear when the code is compiled to JavaScript. They exist purely for your IDE to give you autocomplete and error checking).*

### 3. Loading the Proto File into Memory
```typescript
const PROTO_PATH = path.resolve(__dirname, '../../../../../../../../packages/proto/src/search.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
```
Even though we have TypeScript types, Node.js still needs the *actual physical `.proto` file* at runtime to know how to compress and serialize the data into binary format. `loadSync` reads the file and parses it.
- `longs: String`: In C++, a `long` can hold a massive 64-bit integer. JavaScript's native Number maxes out at 53 bits. This setting tells the parser to convert 64-bit numbers to JavaScript Strings so they don't lose precision.

### 4. Creating the Client Engine
```typescript
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;

const rawSearchClient = new protoDescriptor.search.SearchService(
  'localhost:50051', 
  grpc.credentials.createInsecure() 
);
```
- `protoDescriptor`: This injects the parsed `.proto` file into the gRPC engine. We use `as unknown as ProtoGrpcType` to legally force TypeScript to understand this dynamic object matches our generated interfaces.
- `rawSearchClient`: We instantiate the client pointing to `localhost:50051`. We use `createInsecure()` because this traffic happens inside our internal Docker network, so we don't need to encrypt it with SSL certificates (which saves massive CPU overhead).

### 5. The Promise Wrapper (The Senior Engineer Pattern)
```typescript
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
```
**Why do we do this?**
The `grpc-js` library was built years ago using the old **Callback Pattern**. If we used `rawSearchClient` directly in our Service layer, it would look like this:
```typescript
// BAD: Callback Hell
rawSearchClient.HybridSearch(data, (err, response) => {
   if (err) throw err;
   console.log(response);
})
```
Modern Node.js demands `async/await`. We wrap the ugly callback in a native `Promise`. Now, our Service layer can simply write:
```typescript
// GOOD: Clean Async/Await
const response = await searchClient.HybridSearch(data);
```

We explicitly type this wrapper: `(data: SearchRequest): Promise<SearchResponse>`. 
This guarantees that anywhere else in our application, if someone uses `searchClient.HybridSearch`, the IDE knows exactly what must go in, and exactly what will come out. Zero hallucinations. Zero type errors.
