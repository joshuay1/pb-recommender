// Client wrapper for prompt understanding via backend
// POST /api/understand { prompt }

export interface PromptUnderstanding {
  content_terms: string[];
  districts: string[]; // e.g., ["Kreis 4"], or ["City-wide"]
  weights: { content: number; location: number; freshness: number; quality: number };
}

export async function understandPrompt(prompt: string): Promise<PromptUnderstanding> {
  const customKey = localStorage.getItem('pb_openai_key');
  if (!customKey) {
    throw new Error('Please enter your OpenAI API key in the Welcome screen to use natural language search.');
  }

  const systemPrompt = `You are a prompt parser for a participatory budgeting recommender in Zürich.
Return a strict JSON object with keys: content_terms (array of 3-8 short keywords), districts (array of Zürich districts or ["City-wide" ]), weights (object with numeric fields content, location, freshness, quality where all are 0..1 and sum to ~1).
Map any neighborhood/location mention to the closest of these districts: ["Kreis 1","Kreis 2","Kreis 3","Kreis 4","Kreis 5","Kreis 6","Kreis 7","Kreis 8","Kreis 9","Kreis 10","Kreis 11","Kreis 12","City-wide"].
Infer weights from the prompt focus: if it emphasizes topics, increase content; if it emphasizes place/distance, increase location; if it says new/latest/recent, increase freshness; otherwise distribute reasonably.
Only output valid JSON.`;

  const body = {
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customKey}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenAI API failed: ${resp.status} ${text}`);
  }

  const responseData = await resp.json();
  const text = responseData?.choices?.[0]?.message?.content || '{}';

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { content_terms: [], districts: ['City-wide'], weights: { content: 0.6, location: 0.2, freshness: 0.1, quality: 0.1 } };
  }
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
