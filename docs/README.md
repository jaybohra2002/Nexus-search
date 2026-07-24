# docs/ — Knowledge Base Index

This folder is the living brain of the Nexus-Search project. Every concept we discuss, every design decision we take, every library we add — it goes here, permanently documented.

## Folder Structure

```
docs/
├── README.md                          ← You are here (index of everything)
│
├── distributed-systems/               ← Theory: First principles of distributed systems
│   ├── 01-thundering-herd.md          ← Thundering herd problem + solutions
│   ├── 02-circuit-breakers.md         ← Circuit breaker pattern (opossum)
│   ├── 03-zero-hallucinations-rag.md  ← Enterprise RAG, Hybrid Search, Hallucination prevention
│   ├── 04-chunking-strategies.md      ← Data ingestion, Semantic vs Recursive chunking, Overlaps
│   ├── 05-caching-strategies.md       ← Cache-aside, write-through, TTL, invalidation
│   ├── 06-distributed-tracing.md      ← OpenTelemetry, Jaeger, spans, trace IDs
│   └── 07-feature-flags-canary.md     ← Feature flags, Unleash, canary deployments
│
├── infrastructure/                    ← How our Docker/K8s setup works
│   ├── 01-docker-networking.md        ← Ports, bridge networks, DNS resolution
│   ├── 02-docker-compose-guide.md     ← Every service in our compose file explained
│   └── 03-kubernetes-preview.md       ← K8s concepts: Pods, Deployments, HPA, Ingress
│
├── code-explanations/                 ← Low-level design (LLD) patterns
│   ├── grpc-protobuf.md               ← Why we use Protobuf over JSON
│   ├── api-gateway-grpc.md            ← The Fastify gRPC client logic
│   ├── api-gateway-hardening.md       ← Error handlers and graceful shutdown
│   ├── api-gateway-autoload.md        ← Domain-driven folder structure
│   ├── 02-n-tier-architecture.md      ← N-Tier Clean Architecture (Controllers, Services)
│   ├── 03-api-versioning.md           ← Semantic versioning and Deep Directory Tiering
│   ├── search-service.md              ← (Upcoming) gRPC server + Typesense
│   └── ingestion-service.md           ← (Upcoming) BullMQ workers + Ollama
│
└── learning_log.md                    ← Chronological journal of every decision made
```

## Reading Order (If Starting Fresh)
1. Start with `distributed-systems/01-thundering-herd.md` — it explains why distributed systems are hard
2. Then `infrastructure/01-docker-networking.md` — understand how our services talk to each other
3. Then pick up `code-explanations/` in order of what we are building

## How This Docs System Works
Every time we introduce a new concept, library, or architectural pattern in this project:
1. A new markdown file is created in the appropriate folder
2. `learning_log.md` gets a timestamped entry linking to it
3. The code file that uses the concept has a JSDoc comment pointing to the doc

This is how senior engineers at Google, Stripe, and Netflix maintain institutional knowledge across large teams.
