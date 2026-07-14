# API Gateway: gRPC Client Architecture

This document explains the code we just wrote to turn our HTTP API Gateway into a **gRPC Client**.

## The Goal
1. The user's browser sends an HTTP JSON request to `POST /search`.
2. The Gateway receives it, validates it with Zod, and then translates it into a binary gRPC request.
3. The Gateway sends the gRPC request to our internal `search-service` running on port `50051`.

## 1. The gRPC Client Setup (`src/grpc-client.ts`)
We created a dedicated file to hold our gRPC connections.
```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
```
Wait, we statically compiled our `.proto` files using `proto-loader-gen-types`. However, in Node.js, even with static TypeScript interfaces, we still need to load the physical `.proto` file into memory at runtime so the underlying C++ network engine knows how to encode the bits over the wire.
The TypeScript files we generated in `packages/proto/dist/` are purely for our IDE and compiler to prevent typos. They don't contain the actual network logic.

So, in `grpc-client.ts`, we use `protoLoader.loadSync()` to read the `.proto` file, and then we inject it into `grpc.loadPackageDefinition()`.
Finally, we instantiate the client:
```typescript
const searchClient = new proto.search.SearchService(
  'localhost:50051', // The address of our internal microservice
  grpc.credentials.createInsecure() // No SSL/TLS needed for internal traffic
);
```

## 2. The Search Route (`src/routes/search.ts`)
This Fastify route accepts the HTTP request. We use Zod to ensure the user sent `query` and `k`.
Then, we wrap the gRPC call in a `Promise`. 
Why? Because the official Node.js gRPC library uses old-school *callbacks* (`client.HybridSearch(payload, (err, response) => {...})`). Modern Node.js uses `async/await`. So we wrap it in a `Promise` to make the code clean and prevent callback hell.

## 3. Registering the Route (`src/server.ts`)
We simply register the new search route in our Fastify instance. 

**Summary:** 
The API Gateway is now a hybrid server. It is an HTTP Server facing the outside world, and a gRPC Client facing the internal network.
