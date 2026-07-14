# Phase 2 Theory: Embeddings, Vector Search & Architecture

Before we write code for our `search-rag-service`, we must understand the math and the system design behind how modern AI search engines actually work.

---

## 1. The Limitation of BM25 (Keyword Search)
In Phase 1, we learned about **BM25** and the **Inverted Index**. BM25 is phenomenal at exact keyword matching.
* If a user searches: *"Redis pub sub"*
* BM25 finds the exact words "Redis", "pub", and "sub" in the documents.

**The Problem**: What if the user searches: *"How to send asynchronous messages fast?"*
BM25 will fail terribly. The document about Redis might use the words "broker", "events", and "in-memory", but it might never use the words "asynchronous messages fast". BM25 has **zero semantic understanding** of human language.

---

## 2. Neural Embeddings & Vector Space
To give a computer semantic understanding, we use **Embeddings**. 
An embedding model (like `nomic-embed-text` which we will use via Ollama) reads a paragraph of text and converts the entire *meaning* of that text into an array of floating-point numbers.

```javascript
// E.g. [0.012, -0.455, 0.881, ... 768 dimensions]
```
Imagine a 3D graph (X, Y, Z axes).
* The word "Dog" might be plotted at `[1.0, 0.5, -0.2]`.
* The word "Puppy" might be plotted right next to it at `[0.9, 0.6, -0.1]`.
* The word "Car" is completely unrelated, so it's plotted far away at `[-5.0, 8.0, 9.9]`.

When a user searches *"How to send asynchronous messages fast?"*, we run their query through the *exact same* embedding model. It generates an array of numbers.

**Cosine Similarity**: To find the answer, the Vector Database (Typesense) just looks at the graph and calculates the angle between the Query Vector and all the Document Vectors. The vectors that are closest together in space have the closest *meaning*. 

---

## 3. How Vector DBs Scale: HNSW Graphs
Calculating the angle between the query and 100 documents is fast. But what if we have 1 Billion documents? Comparing 1 Billion arrays of 768 floating-point numbers would take hours for a single search query.

Vector Databases solve this using **ANN (Approximate Nearest Neighbors)** algorithms, specifically **HNSW (Hierarchical Navigable Small World)** graphs.
* **How it works**: HNSW builds a multi-layered web of pointers between vectors. Instead of scanning all 1 Billion documents, it starts at the top layer, makes a few hops to find the "general neighborhood" of your query, drops down a layer, and zeroes in on the closest vectors in milliseconds.
* **The Tradeoff**: It is "Approximate". You trade 1% accuracy for 10,000x speed. This is how Google Search and Amazon handle billions of AI queries instantly.

---

## 4. Hybrid Search (Rank Fusion)
Vector Search is amazing for concepts, but terrible for specific exact-matches (e.g., searching for an error code like `ERR_CONNECTION_REFUSED`). 
Production systems use **Hybrid Search**:
1. Run BM25 for exact keywords.
2. Run Vector Search for meaning.
3. Combine the scores using a formula called **RRF (Reciprocal Rank Fusion)** to return the ultimate top 10 results. Typesense does this automatically for us!

---

## 5. System Design: Inter-Service Communication
We are about to build the `search-rag-service`. How does the `api-gateway` talk to it?

There are two ways microservices talk to each other:
1. **Asynchronous (Queues/PubSub)**: Service A drops a message in Redis and forgets about it. Service B picks it up whenever it has free CPU. (We will use this for Data Ingestion in Phase 3 because chunking and embedding massive datasets takes minutes and we can't let the user's browser timeout).
2. **Synchronous (HTTP / gRPC)**: Service A sends a request to Service B and waits with the connection open until it gets an answer. 

**Our Decision**: For the `search-rag-service`, we *must* use **Synchronous HTTP**. When a user types a query into the UI, they expect an answer in milliseconds. The `api-gateway` will hold the user's HTTP request open, make an internal HTTP request to the `search-rag-service`, wait for the Typesense results, and return it to the user.
