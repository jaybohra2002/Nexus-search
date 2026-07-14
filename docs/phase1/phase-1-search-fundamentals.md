# Phase 1: Search Fundamentals & Local Stack

To build a production search system, we must first understand why we can't just use a standard database like PostgreSQL for search, and how traditional search engines solve this problem.

## 1. Why Databases Fail at Search

Imagine you have a PostgreSQL database with a table of 10 million engineering documents. You want to find all documents containing the phrase "distributed systems".

In SQL, you would write:
```sql
SELECT * FROM documents WHERE content LIKE '%distributed systems%';
```

**The Problem: B-Trees**
Standard databases use **B-Tree (Balanced Tree)** indexes. B-Trees are fantastic for exact matches (e.g., `id = 5`) or range queries (e.g., `created_at > '2023-01-01'`) because they keep data sorted. 

However, a `LIKE '%...%'` query cannot use a B-Tree index. The database has to scan every single row in the table (a **Full Table Scan**). For 10 million large text documents, this will take seconds or even minutes. In production, search must return in milliseconds.

## 2. The Solution: The Inverted Index

Search engines (like Typesense, Elasticsearch, and Lucene) solve this using an **Inverted Index**. 

Instead of mapping a Document ID to its Text, an inverted index maps a **Term (Word)** to a list of Document IDs (a **Posting List**).

Imagine two documents:
- **Doc 1**: "Raft is a consensus algorithm."
- **Doc 2**: "Paxos is an older consensus algorithm."

The Inverted Index looks like this:
| Term | Posting List (Doc IDs) |
| :--- | :--- |
| raft | [1] |
| is | [1, 2] |
| a | [1] |
| consensus | [1, 2] |
| algorithm | [1, 2] |
| paxos | [2] |
| an | [2] |
| older | [2] |

When a user searches for "consensus algorithm", the engine:
1. Looks up "consensus" in the index → Gets `[1, 2]`
2. Looks up "algorithm" in the index → Gets `[1, 2]`
3. Computes the intersection (documents that contain both) → Result: `[1, 2]`

This lookup happens in **O(1)** or **O(log N)** time. It is infinitely faster than a database table scan.

## 3. The Text Analysis Pipeline (Deep Dive)

Before text can be put into the inverted index, it must be processed. If we just dumped raw text into the index, searches would constantly fail due to minor formatting differences. The **Analyzer Pipeline** solves this.

### Step A: Character Filtering
* **What it does**: Strips out raw characters we don't care about (like HTML tags).
* **Example**: `"<h1>System Design</h1>"` becomes `"System Design"`.
* **Why we do it**: We don't want users to have to type `<h1>` to find the document. We only care about the human-readable content.

### Step B: Tokenization
* **What it does**: Splits a continuous string of text into individual units called "tokens" (usually words).
* **Example**: `"Error: 500 Internal Server Error!"` becomes `["Error", "500", "Internal", "Server", "Error"]`. Notice the punctuation (:, !) is used as splitting points and discarded.
* **Why we do it / What help we get**: The Inverted Index needs a "Key". A whole sentence cannot be a key, because if a user searches for just one word in that sentence, the index lookup would fail. By breaking the sentence into tokens, every single word becomes an independent, searchable Key in the index.

### Step C: Token Filtering (Stemming & Stop Words)
* **Stop Words**:
  * **What**: Removing extremely common words (a, an, the, is, and).
  * **Why**: The word "the" might exist in 99% of your documents. Storing it in the index takes up massive amounts of RAM and slows down search, but provides zero value (nobody searches for "the"). Removing it optimizes memory and speed.
* **Stemming**:
  * **What**: Reducing words to their base or root form.
  * **Example**: The words `["connecting", "connected", "connects"]` are all converted to the root `["connect"]` before being put in the index.
  * **Why we do it / What help we get**: Human language is messy. If a document contains the phrase *"Failed connecting to the database"*, and a user searches for *"database connect error"*, an exact-match search would fail because `"connecting" != "connect"`. Stemming ensures that regardless of the verb tense the author used, the search engine matches the core *intent*. This drastically increases the **recall** (ability to find relevant documents) of the search engine.

## 4. How do we rank results? TF-IDF vs BM25

When you search for "database replication", the Inverted Index might instantly find 50,000 documents that contain those words. But which document should be result #1? We need a scoring algorithm.

### The Old Standard: TF-IDF (Term Frequency - Inverse Document Frequency)
TF-IDF calculates a score based on two simple metrics:

1. **TF (Term Frequency)**: How many times does the search term appear in Document A?
   * *Example*: If Doc A has the word "replication" 5 times, and Doc B has it 1 time, Doc A gets a higher TF score. (More mentions = more relevant).
2. **IDF (Inverse Document Frequency)**: How rare is the search term across the *entire* database?
   * *Example*: If you search for "the database", the word "the" appears in 100,000 documents. Its IDF score is almost 0. The word "database" appears in 5,000 documents. Its IDF score is high. 
   * *Why?* This ensures that matching rare, specific words heavily boosts your score, while matching common filler words doesn't matter much.

**The Flaw in TF-IDF**: TF (Term Frequency) scales infinitely. If a spammer writes the word "replication" 1,000 times invisibly at the bottom of a webpage, TF-IDF will give it a massive score (1000 * IDF). This is called "Keyword Stuffing". 

### The Modern Standard: BM25 (Best Matching 25)
Typesense (and almost all modern search engines) uses BM25. BM25 takes the core idea of TF-IDF but fixes its fatal flaws with two major innovations:

**Fix 1: Term Frequency Saturation (The Curve)**
In BM25, mentioning a word 1000 times does *not* give you 1000x the score. BM25 applies a logarithmic curve to Term Frequency. 
* The 1st time you mention "replication", your score shoots up.
* The 3rd time, your score goes up a little more.
* By the 10th time, the score "saturates" (flattens out). Mentioning it 1,000 times gives you the exact same score as mentioning it 10 times.
* **Why?** It defeats keyword stuffing and models human language better. Once a document establishes it is about "replication", repeating the word doesn't make it *more* about replication.

**Fix 2: Document Length Normalization**
* Imagine a 500-page book on "History of Computers". It naturally contains the word "Redis" 5 times simply because it's a massive book.
* Imagine a 1-paragraph glossary definition of "Redis". It also contains the word "Redis" 5 times.
* TF-IDF would score them equally. 
* **BM25 penalizes long documents.** It calculates the average document length in your database. If a document is much longer than average, its TF score is divided (penalized). 
* **Why?** A short document that mentions a word 5 times is highly concentrated and specific to that topic. A massive document that mentions it 5 times is probably just mentioning it in passing. BM25 ensures the short, highly-dense document ranks #1.

## 5. The Advanced Inverted Index (Memory & Scoring Internals)

You might be wondering: *If the inverted index just maps a word to a list of Document IDs, how does the engine calculate BM25? Doesn't it have to load the full document from disk into RAM to count how many times the word appears?*

**Answer: No, it never scans the document from disk to calculate scores!**

### The Secret: The "Rich" Posting List
The naive explanation of an inverted index is `Term -> [Doc1, Doc2]`.
The **production reality** is that the posting list stores *metadata* alongside the DocID at *index time*. 

When a document is ingested, the engine counts the terms and stores them right inside the index. A real posting list for the word "raft" looks like this:
`raft -> [ (DocID: 1, TF: 5), (DocID: 2, TF: 1) ]`

When you search for "raft", the engine instantly knows Doc 1 has 5 mentions and Doc 2 has 1 mention, purely by reading the RAM-based index. It does **not** touch the disk.

What about Document Length for BM25? The engine maintains a separate, highly optimized, packed array in RAM: `DocLengths: [500, 150, 1200, ...]`. 
To calculate BM25 for Doc 1, it takes the `TF: 5` from the posting list, looks up index `1` in the `DocLengths` array to get `500`, and runs the math instantly in memory.

### What exactly is a "DocID"? Is it the physical address?
**No.** Storing a 36-character UUID (like `550e8400-e29b-41d4-a716-446655440000`) or a 64-bit physical disk pointer inside the posting list would waste massive amounts of RAM.

Instead, search engines use **Internal Sequential DocIDs** (e.g., `0, 1, 2, 3...`). 
* **Why? Compression.** If a word appears in documents 1000, 1005, and 1008, the engine uses **Delta Encoding**. It doesn't store `[1000, 1005, 1008]`. It stores `[1000, +5, +3]`. Small numbers can be bit-packed (using Variable Byte Encoding or Elias-Fano) taking up fractions of a byte instead of 8 bytes per ID. This allows indexes with billions of rows to fit in RAM.

### The Forward Index (Document Store)
If the index only knows about Internal DocID `1`, how do we return the actual JSON document to the user?
There is a separate data structure called the **Forward Index** (or Document Store). It acts as a simple array/map: `Internal DocID -> [External UUID, Physical Disk Address]`. 

**The critical performance trick**: The engine calculates BM25 for all 50,000 matches using *only* the RAM-based posting lists and Internal DocIDs. It sorts them, finds the Top 10 winners, and **only then** does it look up those 10 Internal DocIDs in the Forward Index to read the actual JSON from disk and send it to the user. We only pay the disk I/O penalty for 10 documents, not 50,000!
