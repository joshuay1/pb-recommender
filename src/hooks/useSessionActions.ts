import { useState } from 'react';
import type { ShowAction } from '../types/index.ts';

interface ActionIndex {
  more: number;
  less: number;
}

// Session-only action log for ranking
export function useSessionActions(userId: string) {
  const [actions, setActions] = useState<ShowAction[]>([]);
  
  // Index: projectId -> {more, less}
  const index = new Map<number, ActionIndex>();
  actions.forEach(a => {
    if (!index.has(a.projectId)) index.set(a.projectId, {more:0, less:0});
    index.get(a.projectId)![a.action]++;
  });
  
  function logShowAction({ projectId, action, ts }: ShowAction) {
    setActions(prev => [...prev, { projectId, action, ts }]);
  }
  
  return { actions, index, logShowAction };
}
