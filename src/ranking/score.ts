import { RANK_CFG } from './config';
import { cosSim } from './geometry';
import type { Project, ShowAction, AdaptiveWeights } from './userVector';

export type UserCtx = { 
  homeLatLng?: { lat:number; lng:number }, 
  preferredCostBucket?: string,
  useGeoLocation?: boolean // Toggle between district and GPS location
};

interface ScoringComponents {
  similarity: number;
  userFeedback: number;
  freshness: number;
  quality: number;
  locationBonus: number;
  finalScore: number;
}

export function scoreProject(
  p: Project & { exposureCount?: number; gradeCount?: number },
  userVec: number[],
  actionIndex: Map<number, {vibe:number;around:number}>,
  userCtx?: UserCtx,
  cfg = RANK_CFG,
  adaptiveWeights?: AdaptiveWeights
): number {
  const components = calculateScoringComponents(p, userVec, actionIndex, userCtx, cfg, adaptiveWeights);
  return components.finalScore;
}

export function calculateScoringComponents(
  p: Project & { exposureCount?: number; gradeCount?: number },
  userVec: number[],
  actionIndex: Map<number, {vibe:number;around:number}>,
  userCtx?: UserCtx,
  cfg = RANK_CFG,
  adaptiveWeights?: AdaptiveWeights
): ScoringComponents {
  const userVecIsZero = userVec.every(x => Math.abs(x) < 1e-9);
  
  // 1. Content Similarity (0.0 - 1.0)
  const baseSimilarity = userVecIsZero ? 0.5 : cosSim(userVec, p.embedding);
  const similarity = Math.max(0, Math.min(1, (baseSimilarity + 1) / 2)); // Normalize from [-1,1] to [0,1]
  
  // 2. User Feedback Component (0.0 - 1.0)
  const clicks = actionIndex.get(p.id) || {vibe: 0, around: 0};
  let feedbackMultiplier = 1.0;
  
  if (clicks.vibe > 0 || clicks.around > 0) {
    // Both vibe and around actions indicate positive preference
    const mult = cfg.feedback.moreMultiplier;
    const totalClicks = clicks.vibe + clicks.around;
    // More immediate and stronger response - no gradual ramping
    feedbackMultiplier = Math.min(mult, 1 + (totalClicks * (mult - 1) / 1.5));
  }
  
  const userFeedback = Math.max(0, Math.min(1, similarity * feedbackMultiplier));
  
  // 3. Freshness Component (0.0 - 1.0) - boost for less-seen projects
  const exposureCount = p.exposureCount || 0;
  const freshness = Math.max(0, Math.min(1, 1 - (exposureCount / 100))); // Decreases as project is shown more
  
  // 4. Quality Component (0.0 - 1.0) - minimal boost for projects with some engagement
  const gradeCount = p.gradeCount || 0;
  const quality = Math.max(0, Math.min(1, Math.min(gradeCount / 20, 1))); // Very gentle influence, maxes out at 20 grades
  
  // 5. Location bonus based on "around" clicks and preferred districts
  let locationBonus = 0;
  if (clicks.around > 0 && adaptiveWeights?.preferredDistricts) {
    // Apply location bonus based on the toggle mode
    if (userCtx?.useGeoLocation && userCtx?.homeLatLng && (p as any).location) {
      // GPS mode: calculate distance-based bonus
      const projectLoc = (p as any).location;
      const distance = calculateDistance(userCtx.homeLatLng, projectLoc);
      locationBonus = Math.max(0, Math.min(0.3, 0.3 * (1 - distance / 5000))); // 5km max range
    } else {
      // District mode: check if project is in preferred districts
      const projectDistrict = (p as any).district;
      if (projectDistrict && adaptiveWeights.preferredDistricts.has(projectDistrict)) {
        locationBonus = 0.4; // Strong bonus for preferred districts
        console.log(`🏘️ District bonus applied: ${projectDistrict} (project ${p.id})`);
      }
    }
  }
  
  // 6. Weighted Final Score using adaptive weights (guaranteed 0.0 - 1.0)
  const weights = adaptiveWeights || {
    contentWeight: cfg.weights.similarity,
    locationWeight: 0,
    freshness: cfg.weights.freshness,
    quality: cfg.weights.quality
  };
  
  const finalScore = (
    weights.contentWeight * similarity +
    cfg.weights.userFeedback * userFeedback +
    weights.locationWeight * (locationBonus / 0.3) + // Normalize locationBonus to 0-1 range
    weights.freshness * freshness +
    weights.quality * quality
  );
  
  return {
    similarity: similarity,
    userFeedback: userFeedback,
    freshness: freshness,
    quality: quality,
    locationBonus: locationBonus,
    finalScore: Math.max(0, Math.min(1, finalScore))
  };
}

// Helper function to calculate distance between two GPS points (in meters)
function calculateDistance(point1: {lat: number, lng: number}, point2: {lat: number, lng: number}): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
  const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}
