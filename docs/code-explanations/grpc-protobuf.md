# Brainstorming & Architecture: gRPC and Protocol Buffers

This document explains why we chose gRPC, how the libraries work under the hood, and the exact patterns we are using in `packages/proto`.

## 1. The Core Problem: Why JSON/HTTP Fails at Scale
As you correctly identified, JSON is plain text.
When `api-gateway` sends a JSON request to `search-service`:
1. The Gateway must serialize the JavaScript object into a massive text string (spending CPU cycles).
2. It sends all the brackets `{`, quotes `"`, and keys (`"query":`, `"alpha":`), which wastes network bandwidth.
3. The Search service receives the text, allocates memory, and parses it back into an object (spending CPU cycles).
4. **No Type Safety**: If the Gateway sends `"k": "ten"` instead of `"k": 10`, the Search service crashes at runtime because HTTP doesn't enforce types.

## 2. The Solution: gRPC and Protocol Buffers
**gRPC** (gRPC Remote Procedure Calls) is an open-source framework developed by Google. Instead of JSON, it uses **Protocol Buffers (.proto)**.

A `.proto` file is a strict contract. Look at `packages/proto/src/search.proto`:
```proto
message SearchRequest {
  string query = 1;
  int32 k = 2;
  float alpha = 3;
}
```
**How it works under the hood:**
1. **Binary Serialization**: When the Gateway sends a request, it converts the data into binary format. Instead of sending text like `{ "query": "CAP", "k": 10 }`, it sends raw bytes. This is much smaller and faster to process than JSON.
2. **Schema Evolution**: The numbers (1, 2, 3) are "field tags". You can change the field names or types in the `.proto` file without breaking existing clients, as long as you don't change the field numbers.
3. **Strict Typing**: Because both servers must agree on the `.proto` schema, you cannot accidentally send a string where a number is expected. This prevents bugs before runtime.
4. **HTTP/2**: gRPC uses HTTP/2, which allows for multiplexing (sending multiple requests over a single connection) and efficient compression, significantly reducing latency compared to traditional HTTP/1.1.

## 3. The Libraries Used
In `packages/proto/package.json`, we installed specific libraries. Here is exactly why we need them:

### `@grpc/grpc-js`
*   **What it is:** The official, pure JavaScript implementation of the gRPC protocol.
*   **Why we use it:** To spin up the actual HTTP/2 servers and clients in Node.js.
*   **Pattern:** We use this to bind our Fastify API Gateway to our internal Microservices.

### `@grpc/proto-loader` & `proto-loader-gen-types`
*   **What it is:** A utility that reads our `.proto` files.
*   **Why we use it:** Native JavaScript doesn't understand `.proto` files. `proto-loader` parses the file so Node.js can use it. Even better, we use `proto-loader-gen-types` to **statically compile** the `.proto` files into strictly typed TypeScript `.ts` interfaces.
*   **Pattern:** In an Enterprise Monorepo, you put all `.proto` files in a shared `packages/proto` workspace. You run the build script once, and it generates TypeScript definitions. Then, the `api-gateway` and `search-service` just import those shared types. If you change a field in the `.proto` file, TypeScript will instantly throw a red error in your code, preventing production outages!
