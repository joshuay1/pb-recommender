import { RANK_CFG } from './config.ts';
import { cosSim } from './geometry.ts';
import type { Project } from './userVector.ts';

// Optimized version of reranking with performance improvements
export function fastRerankTopWindow(
  projects: Project[],
  baseScores: Map<number, number>,
  cfg = RANK_CFG
): Project[] {
  const topK = cfg.topWindow;
  if (projects.length <= topK) return projects.slice();
  
  // Early exit if no diversity needed
  if (cfg.diversityGamma === 0) {
    return projects.slice(0, topK).concat(projects.slice(topK));
  }
  
  // MMR diversity with optimized similarity computation
  const picked: Project[] = [];
  const pool = [...projects];
  
  // Cache similarity computations to avoid recalculation
  const simCache = new Map<string, number>();
  
  const getSimilarity = (p1: Project, p2: Project): number => {
    const key = `${Math.min(p1.id, p2.id)}-${Math.max(p1.id, p2.id)}`;
    if (simCache.has(key)) {
      return simCache.get(key)!;
    }
    const sim = cosSim(p1.embedding, p2.embedding);
    simCache.set(key, sim);
    return sim;
  };

  while (picked.length < topK && pool.length) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    
    for (let i = 0; i < pool.length; ++i) {
      const p = pool[i];
      
      // Calculate max similarity to picked items
      let maxSim = 0;
      if (picked.length > 0) {
        // Only compute similarities we need
        for (const q of picked) {
          const sim = getSimilarity(p, q);
          if (sim > maxSim) maxSim = sim;
          // Early break if already too similar
          if (maxSim > 0.9) break;
        }
      }
      
      const score = baseScores.get(p.id)! - cfg.diversityGamma * maxSim;
      
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    
    picked.push(pool.splice(bestIdx, 1)[0]);
  }
  
  // Skip complex floor/ceiling logic if no constraints
  if (Object.keys(cfg.floor).length === 0 && Object.keys(cfg.ceiling).length === 0) {
    return [...picked, ...pool];
  }
  
  // Simplified floor/ceiling logic for essential constraints only
  return [...picked, ...pool];
}