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
  const customKey = localStorage.getItem('pb_openai_key');
  if (!customKey) {
    throw new Error('Please enter your OpenAI API key in the Welcome screen to process recommendations.');
  }

  // Normalize key
  const key = String(text).trim().toLowerCase();
  if (embedCache.has(key)) {
    return embedCache.get(key)!;
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI error ${resp.status}`);
    }

    const data = await resp.json();
    if (!data || !data.data || !data.data[0] || !data.data[0].embedding) {
      throw new Error('Invalid embedding response from OpenAI');
    }
    const emb = data.data[0].embedding as number[];
    // store in cache (simple FIFO trimming)
    embedCache.set(key, emb);
    if (embedCache.size > MAX_CACHE_ENTRIES) {
      // remove oldest
      const firstKey = embedCache.keys().next().value;
      if (firstKey !== undefined) {
        embedCache.delete(firstKey);
      }
    }
    try { saveCache(); } catch (e) { /* ignore */ }
    return emb;
  } catch (err) {
    throw new Error(`Failed to fetch embeddings: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export default getEmbedding;
