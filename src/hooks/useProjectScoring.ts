import { useState, useCallback, useMemo } from 'react';
import { recoService } from '../services/RecoService';
import LocalLogger from '../services/LocalLogger';
import type { RankedProject, EvaluationType, FeedbackType, UserEvent, GeoProject } from '../types/recommender';
import { calculateAdaptiveWeights } from '../ranking/userVector';

export function useProjectScoring(
  userProfile: string | null,
  geoProjects: GeoProject[],
  actions: any[],
  logShowAction: (data: any) => void
) {
  const [rankedProjects, setRankedProjects] = useState<RankedProject[]>([]);
  const [gradedProjects, setGradedProjects] = useState<any[]>([]);
  const [rankingTrigger, setRankingTrigger] = useState(0);
  const [userInsights, setUserInsights] = useState<any>(null);
  
  // Power system
  const [positiveRatingsCount, setPositiveRatingsCount] = useState(0);
  const [negativeRatingsUsed, setNegativeRatingsUsed] = useState(0);
  
  const negativeRatingsEarned = Math.floor(positiveRatingsCount / 5);
  const negativeRatingsAvailable = negativeRatingsEarned - negativeRatingsUsed;

  // Manual tuning
  const [manualTuningEnabled, setManualTuningEnabled] = useState(false);
  const [manualWeights, setManualWeights] = useState({ content: 0.6, location: 0.2, freshness: 0.1, quality: 0.1 });
  const [recentQuickFeedbackIds, setRecentQuickFeedbackIds] = useState<Set<number>>(new Set());

  const handleFeedback = useCallback(async (projectId: number, feedback: FeedbackType) => {
    console.log('👍 User feedback:', { projectId, feedback, timestamp: Date.now() });
    
    const project = geoProjects.find(p => p.id === projectId);
    if (!project) return;
    
    const actionData = {
      projectId, 
      action: feedback, 
      ts: Date.now(),
      ...(feedback === 'around' ? { district: project.district } : {})
    };
    logShowAction(actionData);
    LocalLogger.recordEvent({ userId: userProfile || undefined, type: 'feedback', payload: actionData });
    
    if (!userProfile) return;
    
    const event: UserEvent = {
      userId: userProfile,
      projectId,
      eventType: 'feedback',
      feedbackType: feedback,
      timestamp: Date.now(),
      projectEmbedding: project.embedding,
      projectLocation: project.location,
      projectCategory: project.category,
      projectDistrict: project.district
    };
    
    await recoService.update(userProfile, event);
    
    if (manualTuningEnabled) {
      const floor = 0.15;
      let w = { ...manualWeights };
      if (feedback === 'vibe' && (w.content || 0) < floor) w.content = floor;
      else if (feedback === 'around' && (w.location || 0) < floor) w.location = floor;
      
      const total = Math.max(1e-6, w.content + w.location + w.freshness + w.quality);
      w = { content: w.content / total, location: w.location / total, freshness: w.freshness / total, quality: w.quality / total };
      setManualWeights(w);
      try { recoService.setManualWeights(w); } catch {}
    }
    
    if (feedback === 'vibe' || feedback === 'around') {
      setRecentQuickFeedbackIds(prev => {
        const copy = new Set(prev);
        copy.add(projectId);
        return copy;
      });
      setTimeout(() => setRecentQuickFeedbackIds(prev => {
        const copy = new Set(prev);
        copy.delete(projectId);
        return copy;
      }), 60_000);
    }

    setRankingTrigger(prev => prev + 1);
  }, [logShowAction, userProfile, geoProjects, manualTuningEnabled, manualWeights]);

  const handleEvaluation = useCallback(async (projectId: number, evaluation: EvaluationType) => {
    console.log('⭐ User evaluated project:', { projectId, evaluation });
    
    if (!userProfile) return;
    
    const isNegativeRating = evaluation === 'not_convinced';
    if (isNegativeRating && negativeRatingsAvailable <= 0) return;
    
    const project = geoProjects.find(p => p.id === projectId);
    if (!project) return;
    
    const event: UserEvent = {
      userId: userProfile,
      projectId,
      eventType: 'evaluation',
      evaluationType: evaluation,
      timestamp: Date.now(),
      projectEmbedding: project.embedding,
      projectLocation: project.location,
      projectCategory: project.category,
      projectDistrict: project.district
    };
    
    await recoService.update(userProfile, event);
    LocalLogger.recordEvent({ userId: userProfile, type: 'evaluation', payload: event });
    
    if (evaluation === 'like' || evaluation === 'love') {
      setPositiveRatingsCount(prev => prev + 1);
    } else if (evaluation === 'not_convinced') {
      setNegativeRatingsUsed(prev => prev + 1);
    }
    
    setRankingTrigger(prev => prev + 1);
    
    setGradedProjects(prev => {
      const existing = prev.find(p => p.id === projectId);
      if (existing) return prev.map(p => p.id === projectId ? { ...p, grade: evaluation } : p);
      const rankedProject = rankedProjects.find(p => p.id === projectId);
      if (rankedProject) return [...prev, { ...rankedProject, grade: evaluation } as any];
      return prev;
    });
  }, [userProfile, geoProjects, rankedProjects, negativeRatingsAvailable]);

  return {
    rankedProjects,
    setRankedProjects,
    gradedProjects,
    setGradedProjects,
    rankingTrigger,
    setRankingTrigger,
    userInsights,
    setUserInsights,
    positiveRatingsCount,
    negativeRatingsAvailable,
    manualTuningEnabled,
    setManualTuningEnabled,
    manualWeights,
    setManualWeights,
    recentQuickFeedbackIds,
    handleFeedback,
    handleEvaluation
  };
}
