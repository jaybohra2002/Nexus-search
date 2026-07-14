# Docker Infrastructure Guide

**Applies To**: Local development environment  
**File**: `docker-compose.yml`  
**Commands**: `docker-compose up -d`, `docker ps`, `docker logs <name>`

---

## 1. Why Docker Compose Exists

We have 6 infrastructure components in our project:
- PostgreSQL (database)
- Redis (cache + queue)
- Typesense (vector search)
- Ollama (LLM — coming soon)
- Prometheus (metrics)
- Grafana (dashboards)

Without Docker Compose, you would have to:
1. Manually install each tool on your Windows machine
2. Manually start each one in a separate terminal
3. Manually configure them to talk to each other
4. Manually deal with version conflicts

With Docker Compose, you run ONE command and everything starts up correctly, every single time, on any machine.

---

## 2. The `-d` Flag Explained

```powershell
docker-compose up       # Starts containers, LOCKS your terminal, shows live logs
docker-compose up -d    # Starts containers in background (Detached), returns your terminal
```

`-d` stands for **Detached mode**. In production servers (AWS EC2, Linux boxes), there is no terminal you keep open. Processes run as background daemons. `-d` trains your muscle memory for this reality.

**How to see logs when in detached mode**:
```powershell
docker logs nexus_typesense           # Show all logs
docker logs nexus_typesense --tail 50 # Show last 50 lines
docker logs nexus_typesense -f        # Follow (stream live logs)
```

---

## 3. Port Mapping — The Bridge Between Container and Host

Every container is isolated. By default, port 5432 inside the Postgres container is invisible to your Windows machine.

The `ports` mapping creates a **NAT (Network Address Translation) rule** that forwards traffic:

```yaml
postgres:
  ports:
    - "5432:5432"
#    HOST:CONTAINER
```

This means:
- When YOUR app connects to `localhost:5432` → Windows receives it
- Windows Docker daemon sees the NAT rule → forwards to container's port 5432
- Postgres inside the container receives the connection

```
Your App (Node.js)
      ↓ connects to localhost:5432
Windows Host
      ↓ Docker NAT rule: 5432 → container:5432
nexus_postgres container
      ↓
PostgreSQL listening on 0.0.0.0:5432 inside the container
```

You can see this in `docker ps` output: `0.0.0.0:5432->5432/tcp`
The `->` arrow IS the NAT forwarding. Left is host, right is container.

---

## 4. Docker Networks — How Containers Talk To Each Other

When you run `docker-compose up`, Docker automatically creates a private virtual network: `nexus-search_default`.

Every container in the same `docker-compose.yml` is automatically connected to this network. Inside this network, containers can reach each other using their **service name as a hostname**.

```yaml
# In docker-compose.yml, the service is named "redis"
redis:
  image: redis:7-alpine
```

So inside our Node.js code (inside a container), we connect to Redis using:
```typescript
// NOT localhost:6379 (that would only work on Windows, not inside a container)
const redis = new Redis({ host: 'redis', port: 6379 });
//                              ^^^^^ service name = DNS hostname
```

This is **Service Discovery** — containers finding each other by name. It's the same concept Kubernetes uses (just more sophisticated).

---

## 5. Volumes — Surviving Container Death

Containers are ephemeral (temporary). If you delete a container, everything inside it disappears — including your database data.

Volumes solve this by mounting a directory OUTSIDE the container:

```yaml
postgres:
  volumes:
    - postgres_data:/var/lib/postgresql/data
    # VOLUME_NAME : PATH_INSIDE_CONTAINER
```

`postgres_data` is a Docker-managed volume stored on your Windows hard drive. Even if the container is deleted and recreated, the data persists.

```powershell
docker volume ls          # List all volumes
docker volume inspect postgres_data  # See where on disk it's stored
```

---

## 6. Healthchecks — Telling Docker When a Service Is Ready

The `healthcheck` block defines a command Docker runs periodically to know if the service is truly ready (not just started):

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U nexus_user -d nexus_db"]
  interval: 5s   # Run this check every 5 seconds
  timeout: 5s    # If no response in 5 seconds, mark as failed
  retries: 5     # After 5 failures, mark container as "unhealthy"
```

**Why does this matter?** When we add `depends_on` to our microservices later, Docker will wait for the health check to pass before starting services that depend on it. This prevents our API Gateway from starting before Postgres is ready to accept connections — a common source of "connection refused" bugs.

---

## 7. The Typesense "Unhealthy" Bug We Fixed

The original healthcheck used `curl`:
```yaml
test: ["CMD", "curl", "-f", "http://localhost:8108/health"]
```

The Typesense Docker image is built on a minimal Linux base that does NOT include `curl`. So the healthcheck failed immediately — not because Typesense was broken, but because the health check tool didn't exist inside the container.

**The Fix**: Use `wget` instead, which IS available:
```yaml
test: ["CMD-SHELL", "wget -qO- http://localhost:8108/health || exit 1"]
```

**What the flags mean**:
- `wget -q`: Quiet mode (no verbose output)
- `-O-`: Output to stdout (so we can see the response)
- `|| exit 1`: If wget fails, exit with code 1 (tells Docker: unhealthy)

**The Lesson**: Always test your healthchecks inside the actual container image. Different images have different tools available. This is a real bug you will encounter in production.
