# API Gateway Hardening — From First Principles

This document explains the code we wrote to harden the API Gateway in Phase 2A. A production gateway cannot just route traffic; it must survive crashes, protect internal network topology from leaking, and ensure every request can be tracked across distributed systems.

## 1. Request ID Tracing (Observability)
**The Problem**: A user complains that their search failed. You look at the logs and see 10,000 logs from the Gateway, 50,000 from the Search Service, and 20,000 from the Ingestion Service. How do you find the exact log lines for *that specific user's request*?
**The Solution**: Every time the Gateway receives a request, it generates a unique UUID (e.g., `req-12345`). Fastify does this out of the box. We configure our Pino logger to inject this `reqId` into every log line. When the Gateway calls a downstream gRPC service, we will pass this ID in the gRPC metadata. This allows us to trace the request across the entire system.

## 2. Global Error Handler (Security & UX)
**The Problem**: If a route throws an error (e.g., `throw new Error("DB Connection Refused")`), Fastify's default behavior might leak the stack trace or return an unformatted 500 error. An attacker can use stack traces to understand our internal directory structure and dependencies.
**The Solution**: We intercept ALL errors before they reach the user using `server.setErrorHandler()`. 
- If it is a Zod validation error, we return a `400 Bad Request`.
- If it is a rate limit error, we return `429 Too Many Requests`.
- If it is an unhandled internal error, we log the full stack trace internally (with the `reqId`), but return a generic, safe message to the user (`500 Internal Server Error`).

## 3. Standardized Response Envelope
**The Problem**: If `/health` returns `{ status: 'ok' }` but `/search` returns `[...results]`, frontend developers will hate us because they have to write different logic for every API call.
**The Solution**: Every single API response must look exactly like this:
```json
{
  "success": true,
  "requestId": "req-12345",
  "data": { ... }
}
```
Or on error:
```json
{
  "success": false,
  "requestId": "req-12345",
  "error": { "message": "Too many requests", "code": "RATE_LIMIT" }
}
```

## 4. Graceful Shutdown
**The Problem**: When you deploy a new version of the API Gateway, Kubernetes sends a `SIGTERM` signal to the old container telling it to shut down. If we just kill the Node.js process immediately, any user currently waiting for a search result gets their connection dropped abruptly.
**The Solution**: We listen for `SIGTERM` and `SIGINT`. When received, we:
1. Stop accepting *new* HTTP requests.
2. Wait for all currently executing requests to finish and return to the user.
3. Close the gRPC connections cleanly.
4. Exit the process with code 0.
