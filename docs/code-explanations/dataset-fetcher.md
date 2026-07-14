# Data Ingestion: The Dataset Fetcher Architecture

This document explains the code written in `data/scripts/fetch-dataset.ts` and the foundational theory behind how we structure data for an AI Search Engine.

## 1. The Goal: Why do we need this script?
An AI search engine (Typesense + Ollama) requires data to search through. If we just upload raw PDF files or random `.txt` files directly into a database, the search results will be terrible. Production search engines require **Structured Data**.

We need to convert raw engineering knowledge (Markdown files from GitHub) into a highly strict JSON Schema.

## 2. The JSON Schema (First Principles)
In `fetch-dataset.ts`, we defined this interface:
```typescript
interface SearchDocument {
  id: string;
  title: string;
  content: string;
  url: string;
}
```

**Why this specific structure?**
1. `id`: Typesense requires a unique string ID for every document. We use Node's `crypto` module to hash the URL into a deterministic 16-character string. This ensures that if we run the script twice, we get the exact same ID, preventing database duplication bugs.
2. `content`: This is the raw markdown. In **Phase 3 (Ingestion)**, we will take this massive string of text and run it through a "Chunking Algorithm". LLMs have a context limit; we cannot feed a 10,000-word document into Ollama. We must break `content` into 500-word chunks before embedding it.
3. `url`: We save the original source. When the RAG (Retrieval-Augmented Generation) system answers a user's question, it needs to cite its sources.

## 3. How the Code Works
1. **Native Fetch**: We use Node 18's native `fetch()` API instead of installing heavy libraries like `axios`. This keeps our dependency tree clean.
2. **Deterministic IDs**: `crypto.createHash('sha256').update(source.url)` generates a hash of the URL.
3. **File System**: `fs.writeFile` writes the final `SearchDocument[]` array into `d:\Developer\nexus-search\data\dataset.json`.

## 4. How to Run It
We placed this script in `data/scripts/`. To run it, you must use `tsx` (TypeScript Execute), which compiles and runs the TypeScript file in memory instantly.

```powershell
# 1. Navigate to the scripts folder
cd d:\Developer\nexus-search\data\scripts

# 2. Install the tsx package
npm install

# 3. Run the script
npm run fetch
```

Once run, you will see a new `dataset.json` file in the `data/` folder containing the structured engineering knowledge ready for Phase 2!
