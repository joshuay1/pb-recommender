import { RANK_CFG } from './config';
import { normalize } from './geometry';

export type ShowAction = { projectId: number; action: "vibe"|"around"; ts: number; district?: string };
export type Project = {
  id: number;
  embedding: number[];
};

export type AdaptiveWeights = {
  contentWeight: number;
  locationWeight: number;
  freshness: number;
  quality: number;
  preferredDistricts: Set<string>; // Districts user clicked 'around' on
};

export function buildUserVector(
  projects: Project[],
  actions: ShowAction[],
  sessionNow: number,
  cfg = RANK_CFG
): number[] {
  if (!actions.length || !projects.length) return new Array(projects[0]?.embedding.length || 5).fill(0);
  // Use click-count based decay if configured: weight recent clicks more strongly based on position
  const useClickDecay = (cfg as any)?.clickDecay?.useClickDecay ?? false;
  const windowSize = (cfg as any)?.clickDecay?.windowSize ?? 20;
  const projectMap = new Map(projects.map(p => [p.id, p.embedding]));
  const influence: Record<number, number> = {};
  let vec = new Array(projects[0].embedding.length).fill(0);
  const capPerProject = (cfg as any)?.capPerProject ?? 10;
    // We'll compute weights based on recency rank within the last `windowSize` actions
    // Most recent action gets weight 1.0, oldest in window gets ~0.0 linearly
    const recentActions = actions.slice(-windowSize);
    const startIndex = Math.max(0, actions.length - recentActions.length);
    for (let i = startIndex; i < actions.length; i++) {
      const a = actions[i];
      const pos = i - startIndex; // 0..recentActions.length-1
      const rankWeight = useClickDecay ? (1 - pos / Math.max(1, recentActions.length - 1)) : 1.0;
      let w = rankWeight;
    if (!projectMap.has(a.projectId)) continue;
    influence[a.projectId] = (influence[a.projectId] || 0) + w;
      if (influence[a.projectId] > capPerProject) {
        w = w - (influence[a.projectId] - capPerProject);
        influence[a.projectId] = capPerProject;
      }
    const emb = projectMap.get(a.projectId)!;
    for (let i = 0; i < vec.length; ++i) {
      // Both 'vibe' and 'around' indicate positive preference - user wants MORE of both
      vec[i] += w * emb[i];
    }
  }
  return normalize(vec);
}

export function calculateAdaptiveWeights(actions: ShowAction[] | undefined, cfg = RANK_CFG): AdaptiveWeights {
  // Defensive guards: ensure callers can't crash this function by passing undefined/null
  if (!actions || !Array.isArray(actions)) {
    // normalize to empty actions array
    actions = [];
  }
  // Ensure cfg has weights; fall back to RANK_CFG if it's missing or malformed
  if (!cfg || (cfg as any).weights === undefined) {
    cfg = RANK_CFG;
  }

  if (actions.length === 0) {
    // No actions yet - use default balanced weights (safe access to cfg now guaranteed)
    return {
      contentWeight: (cfg as any).weights?.similarity ?? RANK_CFG.weights.similarity,
      locationWeight: 0.0, // No location weight until user shows location interest
      freshness: (cfg as any).weights?.freshness ?? RANK_CFG.weights.freshness,
      quality: (cfg as any).weights?.quality ?? RANK_CFG.weights.quality,
      preferredDistricts: new Set()
    };
  }

  // Count recent actions using a click-window: recent clicks within the window get higher linear weight
  const useClickDecay = (cfg as any)?.clickDecay?.useClickDecay ?? false;
  const windowSize = (cfg as any)?.clickDecay?.windowSize ?? 20;
  const preferredDistricts = new Set<string>();
  let vibeSignal = 0;
  let aroundSignal = 0;

  if (useClickDecay) {
    const recent = actions.slice(-windowSize);
    for (let i = 0; i < recent.length; i++) {
      const action = recent[i];
      // linear rank weight: most recent (i = recent.length-1) has weight 1.0
      const rank = i; // 0..recent.length-1 (older->newer)
      const weight = 1 - ( (recent.length - 1 - rank) / Math.max(1, recent.length - 1) );
      if (action.action === 'vibe') {
        vibeSignal += weight;
      } else if (action.action === 'around') {
        aroundSignal += weight;
        if (action.district) {
          preferredDistricts.add(action.district);
          console.log(`📍 Added preferred district: ${action.district}`);
        }
      }
    }
  } else {
    // Fallback to original time-decay approach (10 minutes half-life)
    const now = Date.now();
    const decayMinutes = 10;
    const decayRate = Math.log(2) / (decayMinutes * 60_000);
    for (const action of actions) {
      const ageMs = now - action.ts;
      const weight = Math.exp(-decayRate * ageMs);
      if (action.action === 'vibe') {
        vibeSignal += weight;
      } else if (action.action === 'around') {
        aroundSignal += weight;
        if (action.district) {
          preferredDistricts.add(action.district);
          console.log(`📍 Added preferred district: ${action.district}`);
        }
      }
    }
  }
  
  const totalSignal = vibeSignal + aroundSignal;
  if (totalSignal === 0) {
    return {
      contentWeight: (cfg as any)?.weights?.similarity ?? RANK_CFG.weights.similarity,
      locationWeight: 0.0,
      freshness: (cfg as any)?.weights?.freshness ?? RANK_CFG.weights.freshness,
      quality: (cfg as any)?.weights?.quality ?? RANK_CFG.weights.quality,
      preferredDistricts: new Set()
    };
  }
  
  // Calculate preference ratios
  const vibeRatio = vibeSignal / totalSignal;
  const aroundRatio = aroundSignal / totalSignal;
  
  // Adaptive learning: weights emerge purely from user signals
  const learningRate = (cfg as any)?.adaptiveLearning?.learningRate ?? RANK_CFG.adaptiveLearning.learningRate;
  
  // Content weight emerges only from vibe actions - immediate strong response
  let adaptiveContentWeight = vibeSignal > 0 ? 
    vibeRatio * learningRate * 5 : 0; // Very strong signal from actual usage
  adaptiveContentWeight = Math.min((cfg as any)?.adaptiveLearning?.maxContentWeight ?? RANK_CFG.adaptiveLearning.maxContentWeight, adaptiveContentWeight);
  
  // Location weight emerges only from around actions - immediate strong response
  let adaptiveLocationWeight = aroundSignal > 0 ? 
    aroundRatio * learningRate * 5 : 0; // Very strong signal from actual usage
  adaptiveLocationWeight = Math.min((cfg as any)?.adaptiveLearning?.maxLocationWeight ?? RANK_CFG.adaptiveLearning.maxLocationWeight, adaptiveLocationWeight);
  
  // Distribute remaining weight to freshness and quality
  const remainingWeight = Math.max(0.1, 1.0 - adaptiveContentWeight - adaptiveLocationWeight);
  const freshnessWeight = remainingWeight * 0.7; // Favor showing new projects when no preferences
  const qualityWeight = remainingWeight * 0.3;
  
  // Normalize to ensure weights sum to 1.0
  const totalWeight = adaptiveContentWeight + adaptiveLocationWeight + freshnessWeight + qualityWeight;
  
  return {
    contentWeight: adaptiveContentWeight / totalWeight,
    locationWeight: adaptiveLocationWeight / totalWeight,
    freshness: freshnessWeight / totalWeight,
    quality: qualityWeight / totalWeight,
    preferredDistricts: preferredDistricts
  };
}
