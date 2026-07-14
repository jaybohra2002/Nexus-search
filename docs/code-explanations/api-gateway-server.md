# API Gateway: Fastify Server Architecture & Code Explanation

This document explains the code written for the API Gateway in `apps/api-gateway/src/server.ts` and `src/routes/health.ts`.

## 1. Code Architecture & Reusability Pattern

In a production application, you **never** write all your logic in one `server.ts` file. 
Our architecture follows the **"Controller-Service-Route"** pattern (though right now we only have routes), and heavily utilizes Fastify's **Encapsulation**.

* `server.ts`: This is the **Bootstrapper**. It does NOT contain business logic. It only wires up global plugins (security, logging) and mounts the route trees.
* `routes/`: These files define the HTTP endpoints (`GET`, `POST`) and attach Zod schemas. They act as the entry point for specific features.

By separating the "Bootstrapper" from the "Routes", we ensure code reusability. If we want to write automated tests later, we can import the Fastify app *without* calling `.listen()`, allowing us to inject fake HTTP requests into it instantly.

## 2. Line-by-Line Breakdown: `server.ts`

### Instantiating Fastify
```typescript
const server = Fastify({
  logger: { transport: { target: 'pino-pretty' } }
}).withTypeProvider<ZodTypeProvider>();
```
* **What this does**: It creates the web server. Instead of using `console.log` (which freezes the Node.js thread), we tell Fastify to use its internal high-performance logger called **Pino**. The `pino-pretty` transport just formats the JSON logs so they are easy for human eyes to read during local development.
* `.withTypeProvider<ZodTypeProvider>()`: This is a TypeScript magic trick. It tells Fastify: "Whenever I define a Zod schema for a route, automatically infer the TypeScript types for the `request.body` so I don't have to write interfaces twice."

### Setting Zod Compilers
```typescript
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);
```
* **What this does**: Fastify is fast because it compiles validation down to raw JavaScript functions at boot time. Here, we are telling Fastify's internal engine: "Use Zod to compile your validation and serialization functions."

### Global Plugins (The Bouncer)
```typescript
await server.register(helmet);
await server.register(rateLimit, { max: 100, timeWindow: '1 minute' });
```
* **What `server.register` does**: This is Fastify's version of `app.use()` in Express, but much safer. When you register `helmet` (which sets security HTTP headers to prevent hacking) and `rateLimit`, they apply to all routes mounted *after* them.

---

## 3. Line-by-Line Breakdown: `routes/health.ts`

### The Encapsulated Plugin
```typescript
export const healthRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
```
* **What this is**: In Express, you use `const router = express.Router()`. In Fastify, a group of routes is just an asynchronous function that takes the `server` instance as an argument. Because of Fastify's tree architecture, anything we do inside this function stays inside this function.

### The Zod Schema
```typescript
const healthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
});
```
* **What this does**: We define exactly what the JSON response must look like.

### The Route Definition
```typescript
server.get('/', {
  schema: { response: { 200: healthResponseSchema } },
}, async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() };
});
```
* **How this works**: We attach the schema to the route. When the code hits `return { status: 'ok' ... }`, Fastify intercepts it. It looks at the `healthResponseSchema`, validates our return object, and uses a highly optimized C-style string builder to serialize it into a JSON string. If we accidentally returned `uptime: "20 seconds"` (a string instead of a number), Fastify would throw an internal server error, preventing us from sending malformed data to the frontend!

## 4. What is `pnpm-lock.yaml`?
When you ran `pnpm install`, it generated a `pnpm-lock.yaml` file. 
* **The Problem**: If `package.json` says `"fastify": "^4.26.2"`, the `^` means "allow minor updates". If you deploy this to AWS tomorrow, it might download version `4.26.5`. If that version has a bug, your server crashes in production, even though it worked locally!
* **The Solution**: The `pnpm-lock.yaml` records the *exact* cryptographic hashes and sub-dependencies of the packages installed today. When AWS reads the lockfile, it installs the *exact* same bytes you tested locally, guaranteeing your code behaves identically in production.
