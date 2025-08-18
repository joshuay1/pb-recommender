import { RANK_CFG } from './config.ts';
import { dot, norm, normalize } from './geometry.ts';

export type ShowAction = { projectId: number; action: "more"|"less"; ts: number };
export type Project = {
  id: number;
  embedding: number[];
};

export function buildUserVector(
  projects: Project[],
  actions: ShowAction[],
  sessionNow: number,
  cfg = RANK_CFG
): number[] {
  if (!actions.length || !projects.length) return new Array(projects[0]?.embedding.length || 5).fill(0);
  const lambda = Math.log(2) / (cfg.halfLifeMinutes * 60_000);
  const projectMap = new Map(projects.map(p => [p.id, p.embedding]));
  const influence: Record<number, number> = {};
  let vec = new Array(projects[0].embedding.length).fill(0);
  for (const a of actions) {
    const ageMs = sessionNow - a.ts;
    let w = Math.exp(-lambda * ageMs);
    if (!projectMap.has(a.projectId)) continue;
    influence[a.projectId] = (influence[a.projectId] || 0) + w;
    if (influence[a.projectId] > cfg.capPerProject) {
      w = w - (influence[a.projectId] - cfg.capPerProject);
      influence[a.projectId] = cfg.capPerProject;
    }
    const emb = projectMap.get(a.projectId)!;
    for (let i = 0; i < vec.length; ++i) {
      vec[i] += (a.action === "more" ? w : -w) * emb[i];
    }
  }
  return normalize(vec);
}
