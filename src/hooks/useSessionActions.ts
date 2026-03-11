import { useState } from 'react';
import type { ShowAction } from '../types/index';

interface ActionIndex {
  vibe: number;
  around: number;
}

// Session-only action log for ranking
export function useSessionActions(userId: string) {
  const [actions, setActions] = useState<ShowAction[]>([]);
  
  // Index: projectId -> {vibe, around}
  const index = new Map<number, ActionIndex>();
  actions.forEach(a => {
    if (!index.has(a.projectId)) index.set(a.projectId, {vibe:0, around:0});
    // TS: a.action is 'vibe'|'around' per ShowAction type
    index.get(a.projectId)![a.action as keyof ActionIndex]++;
  });
  
  function logShowAction({ projectId, action, ts }: ShowAction) {
    setActions(prev => [...prev, { projectId, action, ts }]);
  }
  
  return { actions, index, logShowAction };
}
