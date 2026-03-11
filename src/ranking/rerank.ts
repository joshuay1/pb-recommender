import { RANK_CFG } from './config';
import { cosSim } from './geometry';
import type { Project } from './userVector';

function getFacets(projects: Project[], facet: keyof typeof RANK_CFG.floor): Set<string> {
  return new Set(projects.map(p => String(p[facet])));
}

export function rerankTopWindow(
  projects: Project[],
  baseScores: Map<number, number>,
  cfg = RANK_CFG
): Project[] {
  const topK = cfg.topWindow;
  if (projects.length <= topK) return projects.slice();
  // MMR diversity
  const picked: Project[] = [];
  const pool = [...projects];
  while (picked.length < topK && pool.length) {
    let bestIdx = 0, bestScore = -Infinity;
    for (let i = 0; i < pool.length; ++i) {
      const p = pool[i];
      const score = baseScores.get(p.id)! - cfg.diversityGamma * (picked.length ? Math.max(...picked.map(q => cosSim(p.embedding, q.embedding))) : 0);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    picked.push(pool.splice(bestIdx, 1)[0]);
  }
  // Floors/ceilings
  for (const facet of Object.keys(cfg.floor) as (keyof typeof cfg.floor)[]) {
    const present = getFacets(picked, facet);
    const required = cfg.floor[facet];
    const all = getFacets(projects, facet);
    if (present.size < Math.min(required, all.size)) {
      // Promote best missing facet items
      const missing = [...all].filter(f => !present.has(f));
      for (const miss of missing) {
        const candidate = pool.find(p => String(p[facet]) === miss);
        if (candidate) {
          // Swap with lowest-score item in picked
          let minIdx = 0;
          for (let i = 1; i < picked.length; ++i) {
            if (baseScores.get(picked[i].id)! < baseScores.get(picked[minIdx].id)!) minIdx = i;
          }
          picked[minIdx] = candidate;
        }
      }
    }
    // Ceilings
    const ceiling = cfg.ceiling[facet];
    const facetCounts: Record<string, number> = {};
    for (const p of picked) {
      const val = String(p[facet]);
      facetCounts[val] = (facetCounts[val] || 0) + 1;
    }
    for (const val in facetCounts) {
      if (facetCounts[val] > ceiling) {
        // Swap extras with best under-represented
        let extras = picked.filter(p => String(p[facet]) === val);
        let under = pool.filter(p => !present.has(String(p[facet])));
        for (let i = 0; i < extras.length - ceiling && under.length; ++i) {
          picked[picked.indexOf(extras[i])] = under.shift()!;
        }
      }
    }
  }
  // Return adjusted top window + rest
  return [...picked, ...pool];
}
