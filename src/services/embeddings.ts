// Simple client-side wrapper to call OpenAI Embeddings API.
// Reads API key and optional model from environment variables:
//  - REACT_APP_OPENAI_API_KEY
//  - REACT_APP_EMBED_MODEL (default: text-embedding-3-small)
// Small LRU-like cache stored in-memory and mirrored to localStorage to persist across reloads.
const EMB_CACHE_KEY = 'pb_embedding_cache_v1';
const MAX_CACHE_ENTRIES = 200; // keep cache small

let embedCache: Map<string, number[]> = new Map();

function loadCache() {
  try {
    const raw = localStorage.getItem(EMB_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as [string, number[]][];
    embedCache = new Map(parsed);
  } catch (err) {
    console.warn('Failed to load embedding cache', err);
    embedCache = new Map();
  }
}

function saveCache() {
  try {
    const arr = Array.from(embedCache.entries()).slice(0, MAX_CACHE_ENTRIES);
    localStorage.setItem(EMB_CACHE_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn('Failed to save embedding cache', err);
  }
}

loadCache();

export async function getEmbedding(text: string): Promise<number[]> {
  // Try same-origin proxy first, then fall back to a well-known local port where the
  // minimal embedding proxy server usually runs (default: 8080).
  const payload = { input: text };

  // Normalize key
  const key = String(text).trim().toLowerCase();
  if (embedCache.has(key)) {
    return embedCache.get(key)!;
  }

  async function fetchUrl(url: string) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return resp;
  }

  // Primary: same-origin proxy path
  try {
    let resp = await fetchUrl('/api/embeddings');
    // If server responds 404, try fallback host where proxy commonly runs
    if (resp.status === 404) {
      resp = await fetchUrl('http://localhost:8080/api/embeddings');
    }

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Embedding proxy error: ${resp.status} ${txt}`);
    }

    const data = await resp.json();
    if (!data || !data.data || !data.data[0] || !data.data[0].embedding) {
      throw new Error('Invalid embedding response from proxy');
    }
    const emb = data.data[0].embedding as number[];
    // store in cache (simple FIFO trimming)
    embedCache.set(key, emb);
    if (embedCache.size > MAX_CACHE_ENTRIES) {
      // remove oldest
      const firstKey = embedCache.keys().next().value;
      embedCache.delete(firstKey);
    }
    try { saveCache(); } catch (e) { /* ignore */ }
    return emb;
  } catch (err) {
    // Provide a helpful error message including the fallback suggestion
    const hint = 'Make sure the embedding proxy is running (server/index.js) and OPENAI_API_KEY is set. Try: OPENAI_API_KEY=sk... node server/index.js';
    throw new Error(`${String(err)}\n${hint}`);
  }
}

export default getEmbedding;
