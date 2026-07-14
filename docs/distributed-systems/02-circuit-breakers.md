# Circuit Breakers — From First Principles

**Concept Category**: Distributed Systems Resilience  
**Applies To**: Any service calling an external dependency (database, another microservice, third-party API)  
**In Our Project**: Search Service → Typesense | API Gateway → Search Service  
**Library We Use**: `opossum` (Node.js implementation of Netflix's Hystrix pattern)

---

## 1. The Problem: Cascading Failure

In a microservices system, services depend on other services. If one service goes down, what happens?

Without circuit breakers:
```
Typesense crashes
   ↓
Search Service tries to connect → waits 30 seconds for timeout → throws error
   ↓
API Gateway receives error → retries immediately
   ↓
All 500 concurrent users trigger retries simultaneously → Thundering Herd on a DEAD service
   ↓
Typesense can't restart because it's getting bombarded with retry connections
   ↓
The ENTIRE system is now down, not just Typesense
```

This is called a **Cascading Failure**. One broken dependency takes down the whole system.

---

## 2. The Solution: The Circuit Breaker (Named After Electrical Engineering)

A circuit breaker in your house has three states:
- **CLOSED**: Normal operation. Electricity flows. 
- **OPEN**: A fault detected (overload). Electricity is CUT immediately. No current flows.
- **HALF-OPEN**: After a cooldown period, the breaker tests if the fault is resolved by allowing a small amount of current.

Software circuit breakers work identically:

```
CLOSED State (normal):
  Every request → passes through to Typesense
  Success count increments normally

  [5 failures within 10 seconds]
         ↓
OPEN State (tripped):
  ALL requests → immediately rejected with "Service Unavailable"
  NO requests reach Typesense (it gets breathing room to recover)

  [After 30 second timeout]
         ↓
HALF-OPEN State (testing):
  ONE request is allowed through to Typesense
  If it succeeds → circuit CLOSES (back to normal)
  If it fails    → circuit stays OPEN (back to 30 second wait)
```

---

## 3. Why This Saves The System

With a circuit breaker:
```
Typesense crashes
   ↓
Search Service: 5 failures detected → Circuit OPENS
   ↓
All 500 concurrent requests → immediately get "503 Service Unavailable" in 1ms
   ↓
Typesense receives ZERO retry connections → can restart cleanly
   ↓
After 30 seconds → circuit HALF-OPENS → test request succeeds → circuit CLOSES
   ↓
Normal operation resumes
```

Total downtime: ~30 seconds instead of indefinite cascading failure.

---

## 4. Where Each Circuit Breaker Sits In Our Architecture

```
API Gateway
  └── Circuit Breaker #1 → Search Service (gRPC)
      └── If search-service is down, return cached result or graceful error

Search Service  
  └── Circuit Breaker #2 → Typesense
      └── If Typesense is down, serve stale cache results

Ingestion Service
  └── Circuit Breaker #3 → Ollama (Embedding Model)
      └── If Ollama is down, pause queue processing (don't fail jobs, retry later)
```

---

## 5. The `opossum` Library — How It Works

```typescript
// In search-service/src/typesense-client.ts
import CircuitBreaker from 'opossum';

// The function we want to protect
async function queryTypesense(params: SearchParams) {
  return client.collections('documents').documents().search(params);
}

// Wrap it in a circuit breaker
const breaker = new CircuitBreaker(queryTypesense, {
  timeout: 3000,          // If the call takes > 3 seconds, treat as failure
  errorThresholdPercentage: 50, // Open circuit if 50% of calls fail
  resetTimeout: 30000,    // Try again after 30 seconds (HALF-OPEN)
  volumeThreshold: 5,     // Need at least 5 calls before opening
});

// Listen to state changes (this is where we emit metrics to Prometheus!)
breaker.on('open', () => logger.error('Circuit OPENED: Typesense unreachable'));
breaker.on('close', () => logger.info('Circuit CLOSED: Typesense recovered'));
breaker.on('halfOpen', () => logger.warn('Circuit HALF-OPEN: Testing Typesense'));

// Fallback: serve stale cache data when circuit is open
breaker.fallback(() => getCachedFallback());

export { breaker };
```

---

## Interview Answer
> "We implement the circuit breaker pattern using `opossum` (Node.js Hystrix port). Each service wraps its external dependencies — Typesense, Ollama, downstream gRPC services — in a breaker with a 50% error threshold and 30-second reset timeout. When the breaker opens, we emit a Prometheus metric that triggers a Grafana alert, and fall back to stale cache data where possible. This prevents cascading failures and gives struggling dependencies breathing room to recover."
