# Phase 1: Monorepo & Tooling Fundamentals

Before we write code, we must understand the build tools and repository architecture we are using. Tech giants like Google, Meta, and Vercel don't use standard `npm` setups; they use optimized Monorepos. Here is the first-principles breakdown of why.

## 1. The Need for a Monorepo

To understand the Monorepo, you must understand the problem it solves: **The Polyrepo Nightmare**.

### The Polyrepo (The Anti-Pattern at Scale)
Imagine you are building a Microservices architecture with three separate apps:
1. `api-gateway`
2. `ingestion-service`
3. `search-service`

In a Polyrepo, you create three separate Git repositories. 
Now, imagine all three services need to use the exact same TypeScript interface for a `Document`:
```typescript
interface Document {
  id: string;
  title: string;
  content: string;
}
```
**How do they share this code?**
You have to create a *fourth* Git repository just for `shared-types`. You write the code, build it, and publish it to `npmjs.com` as `@my-company/shared-types v1.0.0`. 
Then, you go to all three of your microservice repos and run `npm install @my-company/shared-types@1.0.0`.

**The Nightmare**: Tomorrow, you need to add an `authorId` to the `Document`.
1. Open the `shared-types` repo, make the change.
2. Publish v1.0.1 to npm.
3. Open `api-gateway` repo, update to v1.0.1, push to Git.
4. Open `ingestion-service` repo, update to v1.0.1, push to Git.
5. Open `search-service` repo, update to v1.0.1, push to Git.
This process takes 30 minutes just to add one string to an interface!

### The Monorepo (The Solution)
A Monorepo puts *all* your microservices and shared packages into a single Git repository.

```text
nexus-search/ (One Git Repo)
├── apps/
│   ├── api-gateway/
│   ├── ingestion-service/
│   └── search-service/
├── packages/
│   └── shared-types/
```

**How we handle code here**: Instead of publishing to npm, the package manager creates a **Symlink** (a shortcut) on your computer. The `api-gateway` says "I need `shared-types`", and the package manager just points directly to the local folder.
When you change the `Document` interface in `shared-types`, the change is **instantly** reflected across all three microservices without publishing anything or updating versions. 

## 2. Why use `pnpm` instead of `npm`?

To manage a Monorepo, we need a package manager that supports "Workspaces" (linking local folders). While `npm` supports this, it has severe architectural flaws.

### The Flaw of `npm` (Disk Space & Speed)
If you have 10 microservices in your monorepo, and they all use `fastify`, `npm` will download the `fastify` code from the internet 10 separate times, and save it in 10 different `node_modules` folders.
If `fastify` is 100MB, you just wasted 1GB of hard drive space. Because it downloads everything multiple times, `npm install` is very slow.

### The Innovation of `pnpm` (Hard Links)
`pnpm` uses a completely different architecture. It creates a hidden **Global Store** on your computer. 
When you run `pnpm install fastify`, it downloads it *once* to the global store. 
Then, for all 10 of your microservices, it creates a **Hard Link** in their `node_modules`. A hard link is basically an alias that points to the global store. 
* **Result**: `pnpm install` takes seconds instead of minutes, and saves Gigabytes of disk space. It is the industry standard for Monorepos.

## 3. What is Turborepo? The Build Problem

A Monorepo solves code sharing, but it creates a new problem: **Build Times**.

If you have 50 apps and packages in one repository, and you type `pnpm build`, your computer will try to compile all 50 projects. This could take an hour! But what if you only changed one line of code in the `api-gateway`? Rebuilding the other 49 apps is a massive waste of time.

### Turborepo to the Rescue
Turborepo is a build system designed specifically for JavaScript/TypeScript Monorepos.

1. **The Dependency Graph**: Turborepo reads your project and understands exactly who depends on who. It knows that `api-gateway` depends on `shared-types`. 
2. **Caching**: When you run `turbo run build`, Turborepo builds your apps and saves the output into a hidden `.turbo` cache folder.
3. **Smart Rebuilds**: The next time you run `turbo run build`, Turborepo calculates a cryptographic hash of your files. If the files haven't changed, it **skips the build entirely** and just pulls the result from the cache in 15 milliseconds.
4. **Concurrency**: If `api-gateway` and `search-service` don't depend on each other, Turborepo builds them simultaneously on multiple CPU cores, slashing build times.

**Summary**: 
* We use a **Monorepo** to share code instantly without npm publishing.
* We use **pnpm** because it links files globally, saving disk space and making installs lightning fast.
* We use **Turborepo** so we only ever rebuild exactly what has changed, keeping our development loop fast.
