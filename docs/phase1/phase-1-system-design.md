# Phase 1: System Design & Architecture (HLD)

Before we initialize our project and write code, we must architect the system. Building a massive monolithic backend works for small projects, but at the scale of Google or Amazon, code is divided into **Microservices** and organized in a **Monorepo**.

## 1. The Monorepo (Turborepo + pnpm workspaces)

We are building three separate backend APIs (microservices). 
* **The Anti-Pattern (Polyrepo)**: Creating 3 separate Git repositories. If you update a TypeScript interface that both services share, you have to publish it as an `npm` package, update the version in both repos, and pull the changes. This is a nightmare for maintenance.
* **The Production Pattern (Monorepo)**: All microservices live in one Git repository. They can instantly share code (like database schemas or Typescript types) locally without publishing to npm. 

We will use **Turborepo** because it caches build steps. If you only modify the `search-service`, Turborepo knows it doesn't need to rebuild the `ingestion-service`, saving massive amounts of CI/CD pipeline time.

### The Folder Structure
```text
nexus-search/
├── apps/
│   ├── api-gateway/          (Fastify - Port 3000)
│   ├── ingestion-service/    (Fastify/BullMQ - Port 3001)
│   └── search-rag-service/   (Fastify - Port 3002)
├── packages/
│   ├── shared-types/         (TypeScript interfaces)
│   ├── database/             (Postgres/Prisma connection + schemas)
│   └── logger/               (Standardized Pino logger)
```

## 2. Microservices Architecture (Bounded Contexts)

Why divide the system? **Resource isolation and independent scaling.**
Search queries require massive CPU and RAM for ranking and LLM generation. Ingestion requires slow, heavy background processing. If they are in the same monolithic server, a massive ingestion job could consume all the CPU, causing user search queries to timeout.

By isolating them, if search traffic spikes, we can deploy 10 copies of the `search-rag-service` in Kubernetes, while leaving only 1 copy of the `ingestion-service` running.

### A. API Gateway (The Entrypoint)
* **Role**: The single public-facing server. Clients (browsers/mobile apps) *only* talk to the Gateway.
* **Responsibilities**: Routing, Rate Limiting, Authentication.
* **Flow**: If a user hits `/search`, the Gateway proxies the request to the internal `search-rag-service`.

### B. Ingestion Service (The Write Path)
* **Role**: Background worker for adding new documents.
* **Responsibilities**: Pulling JSON data, Chunking large text, calling Ollama to generate embeddings, and inserting data into PostgreSQL (Source of Truth) and Typesense (Search Index).
* **Communication**: It reads jobs from a Redis Queue (BullMQ) so it can process them asynchronously without blocking the user.

### C. Search & RAG Service (The Read Path)
* **Role**: The high-speed retrieval engine.
* **Responsibilities**: Takes a user query, talks to Typesense for Hybrid Search, talks to Ollama for LLM answer generation, and returns the result.

## 3. Infrastructure & Data Flow

For local development, we will spin up our core infrastructure using **Docker Compose**.

### The Core Infrastructure
1. **PostgreSQL**: The absolute "Source of Truth". If Typesense crashes and loses its index, we can rebuild it completely from PostgreSQL.
2. **Typesense**: Our RAM-based Inverted Index and Vector Database.
3. **Redis**: Used as a fast, in-memory Message Broker. When the API Gateway receives a 10MB document to ingest, it drops a "Job" into Redis and immediately returns `200 OK` to the user. The Ingestion Service picks up the job from Redis when it has free CPU.
4. **Ollama**: Runs natively on your machine to fully utilize your RTX 4060 GPU.

### The Search Data Flow (HLD)
1. User sends `GET /search?q=raft` to the **API Gateway**.
2. **API Gateway** validates the request (Zod schema) and forwards it to the **Search Service**.
3. **Search Service** queries **Typesense**.
4. **Typesense** executes BM25 ranking via its Inverted Index in RAM and returns the top 10 DocIDs.
5. **Search Service** formats the JSON and returns it through the Gateway to the user in <50ms.

---

### What's Next? (Implementation)
Now that we have designed the architecture, our next step is to actually initialize this codebase. We will:
1. Initialize the `pnpm` monorepo and Turborepo.
2. Create the `docker-compose.yml` for Postgres, Redis, and Typesense.
3. Build the first Fastify API Gateway as a "Fastify Refresher".
