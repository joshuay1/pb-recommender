// Client wrapper for prompt understanding via backend
// POST /api/understand { prompt }

export interface PromptUnderstanding {
  content_terms: string[];
  districts: string[]; // e.g., ["Kreis 4"], or ["City-wide"]
  weights: { content: number; location: number; freshness: number; quality: number };
}

export async function understandPrompt(prompt: string): Promise<PromptUnderstanding> {
  async function post(url: string) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
  }

  // Try same-origin first, then fallback to local proxy on 8080 (dev convenience)
  let resp = await post('/api/understand');
  if (resp.status === 404) {
    try {
      resp = await post('http://localhost:8080/api/understand');
    } catch (_) {
      // ignore here; will be handled by !ok below
    }
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Prompt understanding failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  // Basic validation and normalization
  const weights = data.weights || {};
  const c = Number(weights.content || 0);
  const l = Number(weights.location || 0);
  const f = Number(weights.freshness || 0);
  const q = Number(weights.quality || 0);
  const sum = Math.max(1e-6, c + l + f + q || 1);
  const normalized = { content: c / sum, location: l / sum, freshness: f / sum, quality: q / sum };

  const result: PromptUnderstanding = {
    content_terms: Array.isArray(data.content_terms) ? data.content_terms : [],
    districts: Array.isArray(data.districts) ? data.districts : (data.district ? [data.district] : []),
    weights: normalized
  };
  return result;
}

export default understandPrompt;
