# Nexus Search Monorepo

Nexus Search is a highly performant, distributed search and indexing platform designed using microservices architecture. This repository is managed as a monorepo using **pnpm** and **Turborepo** for build caching and pipeline orchestration.

---

## 🏗️ Architecture Overview

The system is split into multiple service and package boundaries, facilitating high scalability, fault tolerance, and separation of concerns:

- **`apps/api-gateway`**: A Fastify-based, hardened API gateway. It serves as the external REST API endpoint, providing rate-limiting, CORS, and request validations (via Zod), and maps incoming requests to downstream services via gRPC.
- **`packages/proto`**: Shared gRPC Protobuf definitions (`search.proto`, `ingest.proto`). It generates types automatically for both clients and servers to ensure consistent service contracts.
- **`data`**: Local data management, dataset seeding, and ingest script orchestrations.
- **`docs`**: Comprehensive documentation library covering first principles of distributed systems (thundering herd, circuit breakers, caching, distributed tracing), infrastructure guides, and code walkthroughs.

---

## 🛠️ Technology Stack

- **Runtime**: [Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/)
- **Monorepo Manager**: [pnpm Workspaces](https://pnpm.io/workspaces)
- **Build System**: [Turborepo](https://turbo.build/)
- **API Gateway**: [Fastify](https://fastify.dev/) (with Zod, Helmet, Rate-Limit, and CORS)
- **Communication Protocol**: [gRPC](https://grpc.io/) (via `@grpc/grpc-js` and `@grpc/proto-loader`)
- **Infrastructure**: [Docker Compose](https://www.docker.com/)
  - **PostgreSQL**: Primary SQL Database (Source of Truth)
  - **Redis**: BullMQ Queue Broker & Caching Layer
  - **Typesense**: Vector Database & Search Engine

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed on your machine:
- **Node.js** (v18+ recommended)
- **pnpm** (v9+ recommended)
- **Docker** and **Docker Compose**

### 1. Set Up Infrastructure

Spin up the local PostgreSQL, Redis, and Typesense instances in docker containers:

```bash
docker compose up -d
```

To verify the containers are up and healthy, run:
```bash
docker compose ps
```

### 2. Install Dependencies

Install the workspace-wide dependencies from the root directory:

```bash
pnpm install
```

### 3. Run the Development Server

Start the development build loop for the entire monorepo:

```bash
pnpm dev
```

This command runs `turbo run dev` and starts all workspace applications, including the API Gateway, in hot-reload mode.

### 4. Build for Production

To build all apps and packages inside the monorepo:

```bash
pnpm build
```

---

## 📖 Documentation & Deep Dives

For structural guides, code explanations, or theoretical concepts, check out the [docs folder](./docs/README.md):
- [Distributed Systems Best Practices](./docs/distributed-systems/) (e.g., Cache Strategies, Circuit Breakers, Trace IDs)
- [Infrastructure Setup Details](./docs/infrastructure/)
- [Code Walkthroughs](./docs/code-explanations/)

---

## 📜 Development Scripts

Run these commands from the root directory:

*   `pnpm dev` - Starts all apps in development mode with watch/hot-reload.
*   `pnpm build` - Builds all packages and applications.
*   `pnpm lint` - Lints code across the entire monorepo.
*   `pnpm format` - Formats the codebase using Prettier.
