import { RANK_CFG } from './config.ts';
import { buildUserVector, ShowAction, Project } from './userVector.ts';
import { scoreProject, calculateScoringComponents, UserCtx } from './score.ts';
import { fastRerankTopWindow } from './fastRerank.ts';

export function rankProjects(
  projects: Project[],
  actions: ShowAction[],
  sessionNow: number,
  userCtx?: UserCtx,
  cfg = RANK_CFG,
  maxProjects: number = 300 // Limit processing to top candidates
): (Project & { score: number; explanation: string })[] {
  const userVec = buildUserVector(projects, actions, sessionNow, cfg);
  // Build action index
  const actionIndex = new Map<number, {more:number;less:number}>();
  for (const a of actions) {
    if (!actionIndex.has(a.projectId)) actionIndex.set(a.projectId, {more:0, less:0});
    actionIndex.get(a.projectId)![a.action]++;
  }
  // For performance: if we have no actions yet, just return first N projects with basic scoring
  if (actions.length === 0) {
    console.log('🚀 Fast path: no user actions, returning first', Math.min(maxProjects, projects.length), 'projects');
    return projects.slice(0, Math.min(maxProjects, projects.length)).map(p => ({
      ...p,
      score: Math.random() * 0.1 + 0.5, // Random baseline score
      explanation: ""
    }));
  }
  
  // Score all projects (limited for performance)
  const projectsToScore = projects.slice(0, maxProjects);
  const scoreMap = new Map<number, number>();
  
  console.log('📊 Scoring', projectsToScore.length, 'of', projects.length, 'projects');
  
  for (const p of projectsToScore) {
    scoreMap.set(p.id, scoreProject(p, userVec, actionIndex, userCtx, cfg));
  }
  
  // Sort by score
  const sorted = [...projectsToScore].sort((a,b) => scoreMap.get(b.id)! - scoreMap.get(a.id)!);
  // Rerank top window with optimized algorithm
  const reranked = fastRerankTopWindow(sorted, scoreMap, cfg);
  // Attach intelligent explanations based on scoring components
  return reranked.map(p => {
    const score = scoreMap.get(p.id)!;
    const components = calculateScoringComponents(p, userVec, actionIndex, userCtx, cfg);
    const clicks = actionIndex.get(p.id) || {more:0, less:0};
    
    // Generate explanation based on strongest scoring component
    let explanation = "";
    const maxComponent = Math.max(components.similarity, components.userFeedback, components.freshness, components.quality);
    
    if (clicks.more > 0) {
      explanation = "Boosted by your positive feedback";
    } else if (clicks.less > 0) {
      explanation = "Included for diversity despite feedback";
    } else if (maxComponent === components.similarity && components.similarity > 0.7) {
      explanation = "Strong content match to your interests";
    } else if (maxComponent === components.freshness && components.freshness > 0.8) {
      explanation = "New project you haven't seen much";
    } else if (maxComponent === components.quality && components.quality > 0.6) {
      explanation = "Popular project with many ratings";
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
        quality: Math.round(components.quality * 100)
      }
    };
  });
}
