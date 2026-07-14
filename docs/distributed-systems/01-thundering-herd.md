# Thundering Herd Problem — From First Principles

**Concept Category**: Distributed Systems  
**Applies To**: Any service with a cache sitting in front of a database or expensive computation  
**In Our Project**: Redis cache → Typesense in the Search Service

---

## 1. The Problem: What Is The Thundering Herd?

Imagine our Search Service has a Redis cache. The first time someone searches "CAP theorem," we:
1. Check Redis → cache miss (nothing there yet)
2. Run the expensive Typesense query (takes 150ms)
3. Store the result in Redis with a 5-minute TTL (Time-To-Live)

For the next 5 minutes, all searches for "CAP theorem" return instantly from Redis (< 1ms).

Then the TTL expires at exactly midnight. The cache entry is deleted.

**At 00:00:01**, 500 concurrent users all search "CAP theorem" at the same exact moment (imagine a newsletter just went out). Here is what happens without protection:

```
User 1   → Redis: MISS → Typesense query (150ms)
User 2   → Redis: MISS → Typesense query (150ms)
User 3   → Redis: MISS → Typesense query (150ms)
...
User 500 → Redis: MISS → Typesense query (150ms)
```

**500 simultaneous identical queries hammer Typesense.** Typesense, which was designed to handle maybe 50 concurrent queries, buckles under pressure. Latency spikes to 10 seconds. Users get timeouts. The entire system degrades. This is the **Thundering Herd** — a stampede of requests all hitting the same resource at once.

---

## 2. The Three Solutions (And Which We Use)

### Solution A: Mutex Lock (The Single Worker Pattern)
When a cache miss happens, **only one request** is allowed to fetch from Typesense. All other requests for the same key are held in a queue, waiting.

```
User 1   → Redis: MISS → Acquires lock → Typesense query (150ms) → Releases lock
User 2   → Redis: MISS → Waits for lock → Gets result from User 1's work
User 3   → Redis: MISS → Waits for lock → Gets result from User 1's work
...
User 500 → Redis: MISS → Waits for lock → Gets result from User 1's work
```

**Result**: Typesense only gets 1 query instead of 500. **We implement this.**

In Node.js, we implement this using a distributed lock in Redis itself (`SET cache_lock NX PX 200` — "Set this key ONLY IF it doesn't exist (NX), with a 200ms expiry (PX)").

### Solution B: Cache Stale-While-Revalidate
Instead of deleting the cache entry when TTL expires, we let it expire **softly**. We serve the stale (old) data to the user immediately, but trigger a background refresh.

```
User 1   → Redis: STALE → Serves old data immediately + triggers background refresh
Background → Typesense query → Updates Redis
User 2   → Redis: FRESH → Serves new data
```

**Result**: Zero latency for the user. The data might be slightly stale (seconds), but for a search engine, that is acceptable. **We implement this as a secondary defense.**

### Solution C: Probabilistic Early Expiry (XFetch Algorithm)
A more sophisticated academic approach: before the TTL expires, randomly re-fetch early with increasing probability. As time approaches expiry, the probability of an early refresh increases. This prevents the synchronized expiry problem.

We document this for your knowledge but don't implement it — Solution A + B is sufficient for our scale.

---

## 3. Where It Sits In Our System

```
POST /search (User Request)
      ↓
API Gateway (HTTP → gRPC)
      ↓
Search Service
      ↓
[1] Check Redis Cache
      ↓ MISS
[2] Acquire Redis Mutex Lock  ← THUNDERING HERD FIX HERE
      ↓ LOCK ACQUIRED
[3] Check Redis Again (double-check after lock)
      ↓ STILL MISS
[4] Query Typesense
      ↓
[5] Store in Redis (TTL: 5 min, with stale flag at 4 min)
      ↓
[6] Release Lock
      ↓
Return results to all waiting requests
```

---

## 4. The Code Pattern (Preview)

```typescript
// In search-service/src/cache.ts
async function cachedSearch(key: string, fetcher: () => Promise<any>) {
  // 1. Try cache first
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  // 2. Cache miss — acquire distributed lock
  const lockKey = `lock:${key}`;
  const lockAcquired = await redis.set(lockKey, '1', 'NX', 'PX', 200);

  if (!lockAcquired) {
    // 3. Another request is already fetching — wait and retry
    await sleep(50);
    return cachedSearch(key, fetcher); // recursive retry
  }

  // 4. We have the lock — fetch from source
  const result = await fetcher();

  // 5. Store result and release lock
  await redis.set(key, JSON.stringify(result), 'EX', 300);
  await redis.del(lockKey);

  return result;
}
```

---

## Interview Answer
> "We prevent the thundering herd using a Redis-based distributed mutex lock on cache misses, combined with a stale-while-revalidate TTL strategy. This ensures only one goroutine (or Node process) fetches from the origin on a cache miss while all concurrent requests queue, and users always get a response — even if slightly stale."
