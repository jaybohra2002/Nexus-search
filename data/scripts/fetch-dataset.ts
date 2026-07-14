import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// The Schema we will use to structure our raw Markdown for Typesense
interface SearchDocument {
  id: string;
  title: string;
  content: string;
  url: string;
}

// A hardcoded list of highly technical Markdown files covering Distributed Systems
const SOURCES = [
  // --- DISTRIBUTED SYSTEMS ---
  {
    title: 'CAP Theorem & System Design',
    url: 'https://raw.githubusercontent.com/donnemartin/system-design-primer/master/solutions/system_design/scaling_aws/README.md',
  },
  {
    title: 'Consistent Hashing',
    url: 'https://raw.githubusercontent.com/donnemartin/system-design-primer/master/solutions/system_design/pastebin/README.md',
  },

  // --- AI ENGINEERING & VECTOR DATABASES ---
  {
    title: 'Ollama (Local LLM Architecture)',
    url: 'https://raw.githubusercontent.com/ollama/ollama/main/README.md',
  },
  {
    title: 'Milvus (Vector Database Internals)',
    url: 'https://raw.githubusercontent.com/milvus-io/milvus/master/README.md',
  },
  {
    title: 'LangChain (AI Agents & RAG)',
    url: 'https://raw.githubusercontent.com/langchain-ai/langchain/master/README.md',
  },

  // --- CORE BACKEND SYSTEMS ---
  {
    title: 'Redis Architecture',
    url: 'https://raw.githubusercontent.com/redis/redis/unstable/README.md',
  },
  {
    title: 'PostgreSQL Architecture',
    url: 'https://raw.githubusercontent.com/postgres/postgres/master/README.md',
  }
];

async function fetchDataset() {
  console.log('🚀 Starting Dataset Fetcher...');
  const dataset: SearchDocument[] = [];

  for (const source of SOURCES) {
    try {
      console.log(`📥 Fetching: ${source.title}`);

      // Node 18+ has native fetch()
      const response = await fetch(source.url);
      console.log(response);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const content = await response.text();

      // We generate a deterministic UUID based on the URL so we don't insert duplicates later
      const id = crypto.createHash('sha256').update(source.url).digest('hex').substring(0, 16);

      dataset.push({
        id,
        title: source.title,
        content,
        url: source.url,
      });

      console.log(`✅ Success! Extracted ${content.length} characters.`);
    } catch (err) {
      console.error(`❌ Failed to fetch ${source.title}:`, err);
    }
  }

  // Save the JSON to the parent directory (data/)
  const outputPath = path.join(__dirname, '..', 'dataset.json');
  await fs.writeFile(outputPath, JSON.stringify(dataset, null, 2));

  console.log(`\n🎉 Dataset successfully written to: ${outputPath}`);
  console.log(`Total Documents: ${dataset.length}`);
}

fetchDataset();
