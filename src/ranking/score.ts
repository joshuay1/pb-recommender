import { RANK_CFG } from './config.ts';
import { cosSim } from './geometry.ts';
import type { Project, ShowAction } from './userVector.ts';

export type UserCtx = { homeLatLng?: { lat:number; lng:number }, preferredCostBucket?: string };

interface ScoringComponents {
  similarity: number;
  userFeedback: number;
  freshness: number;
  quality: number;
  finalScore: number;
}

export function scoreProject(
  p: Project & { exposureCount?: number; gradeCount?: number },
  userVec: number[],
  actionIndex: Map<number, {more:number;less:number}>,
  userCtx?: UserCtx,
  cfg = RANK_CFG
): number {
  const components = calculateScoringComponents(p, userVec, actionIndex, userCtx, cfg);
  return components.finalScore;
}

export function calculateScoringComponents(
  p: Project & { exposureCount?: number; gradeCount?: number },
  userVec: number[],
  actionIndex: Map<number, {more:number;less:number}>,
  userCtx?: UserCtx,
  cfg = RANK_CFG
): ScoringComponents {
  const userVecIsZero = userVec.every(x => Math.abs(x) < 1e-9);
  
  // 1. Content Similarity (0.0 - 1.0)
  const baseSimilarity = userVecIsZero ? 0.5 : cosSim(userVec, p.embedding);
  const similarity = Math.max(0, Math.min(1, (baseSimilarity + 1) / 2)); // Normalize from [-1,1] to [0,1]
  
  // 2. User Feedback Component (0.0 - 1.0)
  const clicks = actionIndex.get(p.id) || {more: 0, less: 0};
  let feedbackMultiplier = 1.0;
  
  if (clicks.more > 0) {
    feedbackMultiplier = Math.min(cfg.feedback.moreMultiplier, 
      1 + (clicks.more * (cfg.feedback.moreMultiplier - 1) / 3)); // Gradual boost
  } else if (clicks.less > 0) {
    feedbackMultiplier = Math.max(cfg.feedback.lessMultiplier,
      1 - (clicks.less * (1 - cfg.feedback.lessMultiplier) / 3)); // Gradual penalty
  }
  
  const userFeedback = Math.max(0, Math.min(1, similarity * feedbackMultiplier));
  
  // 3. Freshness Component (0.0 - 1.0) - boost for less-seen projects
  const exposureCount = p.exposureCount || 0;
  const freshness = Math.max(0, Math.min(1, 1 - (exposureCount / 100))); // Decreases as project is shown more
  
  // 4. Quality Component (0.0 - 1.0) - boost for projects with ratings
  const gradeCount = p.gradeCount || 0;
  const quality = Math.max(0, Math.min(1, Math.min(gradeCount / 10, 1))); // Maxes out at 10 grades
  
  // 5. Weighted Final Score (guaranteed 0.0 - 1.0)
  const finalScore = (
    cfg.weights.similarity * similarity +
    cfg.weights.userFeedback * userFeedback +
    cfg.weights.freshness * freshness +
    cfg.weights.quality * quality
  );
  
  return {
    similarity: similarity,
    userFeedback: userFeedback,
    freshness: freshness,
    quality: quality,
    finalScore: Math.max(0, Math.min(1, finalScore))
  };
}
