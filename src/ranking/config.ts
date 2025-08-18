export const RANK_CFG = {
  // User preference learning
  halfLifeMinutes: 15,
  
  // Base scoring weights (must sum to 1.0 for proper 0-100% range)
  weights: {
    similarity: 0.7,      // Content similarity (70%)
    userFeedback: 0.2,    // User actions boost (20%) 
    freshness: 0.05,      // New/less-seen projects (5%)
    quality: 0.05         // Grade count bonus (5%)
  },
  
  // User feedback multipliers (applied to base similarity)
  feedback: {
    moreMultiplier: 1.3,    // "More like this" boosts by 30%
    lessMultiplier: 0.7,    // "Less like this" reduces by 30%
    maxFeedbackEffect: 0.4  // Maximum total feedback boost/penalty
  },
  
  // Diversity and freshness
  diversityGamma: 0.25,
  topWindow: 50,
  
  // Category constraints  
  floor: { district: 1, category: 1 },
  ceiling: { district: 15, category: 15 }
} as const;
