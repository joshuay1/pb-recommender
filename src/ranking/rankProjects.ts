import { RANK_CFG } from './config';
import { buildUserVector, ShowAction, Project, calculateAdaptiveWeights } from './userVector';
import { scoreProject, calculateScoringComponents, UserCtx } from './score';
import { fastRerankTopWindow } from './fastRerank';

export function rankProjects(
  projects: Project[],
  actions: ShowAction[],
  sessionNow: number,
  userCtx?: UserCtx,
  cfg = RANK_CFG
): (Project & { score: number; explanation: string })[] {
  const userVec = buildUserVector(projects, actions, sessionNow, cfg);
  const adaptiveWeights = calculateAdaptiveWeights(actions, cfg);
  
  // Log adaptive learning
  if (actions.length > 0) {
    console.log('🧠 Adaptive weights learned:', {
      content: Math.round(adaptiveWeights.contentWeight * 100) + '%',
      location: Math.round(adaptiveWeights.locationWeight * 100) + '%',
      freshness: Math.round(adaptiveWeights.freshness * 100) + '%',
      quality: Math.round(adaptiveWeights.quality * 100) + '%',
      preferredDistricts: Array.from(adaptiveWeights.preferredDistricts)
    });
  }
  
  // Build action index
  const actionIndex = new Map<number, {vibe:number;around:number}>();
  if (actions.length === 0) {
    console.log('🚀 No user signals yet - showing projects based on fairness and freshness only');
    // Use fairness-first ranking: prioritize projects with fewer ratings
    const fairnessRanked = [...projects].sort((a, b) => {
      const aCount = (a as any).evaluationCount || 0;
      const bCount = (b as any).evaluationCount || 0;
      // Add small random component to break ties
      return aCount - bCount + (Math.random() - 0.5) * 0.1;
    });
    
    return fairnessRanked.map(p => ({
      ...p,
      score: 0.5 + Math.random() * 0.1, // Neutral baseline scores
      explanation: "Shown for fairness - no preferences learned yet"
    }));
  }

  // Score all projects
  const scoreMap = new Map<number, number>();
  console.log('📊 Scoring', projects.length, 'projects with adaptive weights');
  for (const p of projects) {
    scoreMap.set(p.id, scoreProject(p, userVec, actionIndex, userCtx, cfg, adaptiveWeights));
  }

  // Sort by score
  const sorted = [...projects].sort((a,b) => scoreMap.get(b.id)! - scoreMap.get(a.id)!);
  // Rerank top window with optimized algorithm
  const reranked = fastRerankTopWindow(sorted, scoreMap, cfg);
  // Attach intelligent explanations based on scoring components
  return reranked.map(p => {
    const score = scoreMap.get(p.id)!;
    const components = calculateScoringComponents(p, userVec, actionIndex, userCtx, cfg, adaptiveWeights);
    const clicks = actionIndex.get(p.id) || {vibe:0, around:0};
    const maxComponent = Math.max(components.similarity, components.userFeedback, components.freshness, components.quality, components.locationBonus);
    // Generate explanation based on strongest scoring component
    let explanation = "";
    if (clicks.vibe > 0) {
      explanation = "Boosted by your positive feedback (vibe)";
    } else if (clicks.around > 0) {
      explanation = "Boosted by your location preference (around)";
    } else if (maxComponent === components.locationBonus && components.locationBonus > 0.1) {
      explanation = "Matches your preferred location";
    } else if (maxComponent === components.similarity && components.similarity > 0.7) {
      explanation = "Strong content match to your interests";
    } else if (maxComponent === components.freshness && components.freshness > 0.8) {
      explanation = "New project you haven't seen much";
    } else if (maxComponent === components.quality && components.quality > 0.3) {
      explanation = "Project with some community engagement";
    } else {
      explanation = "Recommended based on your preferences";
    }
    return { 
      ...p, 
      score, 
      explanation,
      // Add scoring breakdown for debugging (can be removed later)
      _debugScore: {
        similarity: Math.round(components.similarity * 100),
        feedback: Math.round(components.userFeedback * 100),
        freshness: Math.round(components.freshness * 100),
        quality: Math.round(components.quality * 100),
        locationBonus: Math.round(components.locationBonus * 100),
      }
    };
  });
}
