import {
  UserProfile,
  UserEvent,
  GeoProject,
  RankedProject,
  RecoService,
  RecoConfig,
  ThemeInterest,
  GeoCentroid,
  ScoringBreakdown,
  GeoLocation
} from '../types/recommender';

// Utility functions for vector operations
class VectorUtils {
  static cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  static addVectors(a: number[], b: number[], weight = 1): number[] {
    const result = [...a];
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      result[i] += b[i] * weight;
    }
    return result;
  }

  static normalizeVector(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    return norm === 0 ? vec : vec.map(val => val / norm);
  }

  static geoDistance(a: GeoLocation, b: GeoLocation): number {
    const R = 6371; // Earth's radius in km
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lng - a.lng) * Math.PI / 180;
    const a1 = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(1 - a1));
    return R * c;
  }
}

export class AdvancedRecoService implements RecoService {
  private config: RecoConfig;
  private profiles: Map<string, UserProfile> = new Map();
  private useRealEmbeddings: boolean = true;
  // Optional manual weight override set from UI sliders
  private manualWeights: { content: number; location: number; freshness: number; quality: number } | null = null;
  
  constructor(config?: Partial<RecoConfig>) {
    this.config = {
      // Scoring weights - adaptive based on user preferences
      themeWeight: 0.4,       // Start with moderate theme weight
      geoWeight: 0.4,         // Start with moderate geo weight
      popularityWeight: 0.0,  // Removed - popularity creates bias
      fairnessWeight: 0.2,    // Moderate fairness weight - reduces as users show preferences
      
      // Learning parameters
      defaultLearningRate: 0.1,
      defaultDecayFactor: 0.95,
      defaultExplorationRate: 0.15,
      
      // Multi-interest parameters
      maxThemeInterests: 5,
      minInterestWeight: 0.1,
      interestMergeThreshold: 0.8,
      
      // Geographic parameters
      maxGeoCentroids: 5, // Match theme interests limit
      minGeoWeight: 0.1,
      geoInfluenceRadius: 15, // km - more generous matching
      
      // Exploration parameters
      diversityBoostFactor: 0.3,
      noveltyDecayDays: 30,
      
      // Fairness parameters for MJ rating equity
      targetRatingCount: 20, // Target 20 ratings per project for stable MJ
      fairnessBoostFactor: 0.3, // Gentle boost for under-rated projects
      
      // Feedback strength - much more responsive
      feedbackStrength: {
        vibe: 0.6,        // Strong response to content preferences
        around: 0.6,      // Strong response to location preferences  
        love: 0.5,
        like: 0.2,
        maybe: -0.1,
        not_convinced: -0.4
      },
      
      ...config
    };
  }

  setEmbeddingMode(useReal: boolean): void {
    this.useRealEmbeddings = useReal;
    console.log(`🔄 Embedding mode changed to: ${useReal ? 'Real transformer embeddings (512D)' : 'Simplified category embeddings (5D)'}`);
  }

  // Allow UI to override algorithm weights (values should sum to ~1; we will normalize defensively)
  setManualWeights(weights: { content: number; location: number; freshness: number; quality: number } | null) {
    if (!weights) {
      this.manualWeights = null;
      console.log('🧮 Manual weights disabled');
      return;
    }
    const total = Math.max(1e-6, (weights.content || 0) + (weights.location || 0) + (weights.freshness || 0) + (weights.quality || 0));
    this.manualWeights = {
      content: (weights.content || 0) / total,
      location: (weights.location || 0) / total,
      freshness: (weights.freshness || 0) / total,
      quality: (weights.quality || 0) / total
    };
    console.log('🧮 Manual weights set:', this.manualWeights);
  }

  async createProfile(userId: string, preferences?: Partial<UserProfile>): Promise<UserProfile> {
    const profile: UserProfile = {
      userId,
      themeInterests: [],
      geoCentroids: [],
      alpha: 0.5, // Start completely neutral (50/50 theme/geo when they emerge)
      explorationRate: this.config.defaultExplorationRate,
      learningRate: this.config.defaultLearningRate,
      decayFactor: this.config.defaultDecayFactor,
      isNewUser: true,
      preferredCategories: [],
      preferredDistricts: [],
      createdAt: Date.now(),
      lastActive: Date.now(),
      ...preferences
    };
    
    // Add district preferences tracking
    (profile as any).districtPreferences = new Map<string, { weight: number; confidence: number; lastUpdated: number }>();
    
    this.profiles.set(userId, profile);
    return profile;
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    return this.profiles.get(userId) || null;
  }

  async initializeProfile(userId: string, categories: string[], districts: string[], allProjects?: GeoProject[]): Promise<UserProfile> {
    const profile = await this.createProfile(userId, {
      preferredCategories: categories,
      preferredDistricts: districts,
      isNewUser: false
    });
    
    // Initialize with category-based interests
    categories.forEach((category, index) => {
      const projectsInCategory = allProjects?.filter(p => p.category === category) || [];
      const interest: ThemeInterest = {
        embedding: this.generateCategoryEmbedding(category, projectsInCategory),
        weight: 1.0 / categories.length,
        confidence: 0.5, // Low initial confidence
        category,
        lastUpdated: Date.now()
      };
      profile.themeInterests.push(interest);
    });
    
    return profile;
  }

  async rank(userId: string, projects: GeoProject[]): Promise<RankedProject[]> {
    console.log('🎯 Advanced ranking for user:', userId, 'projects:', projects.length);
    
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error('User profile not found');
    }

    const rankedProjects: RankedProject[] = [];
    const now = Date.now();

    // Cold start: If user is new, prioritize least-rated projects
    const isNewUser = profile.isNewUser || (profile.themeInterests.length === 0 && profile.geoCentroids.length === 0);
    
    if (isNewUser) {
      console.log('🆕 Cold start mode: prioritizing least-rated projects for fairness');
      // Sort projects by evaluation count (ascending) for new users
      projects.sort((a, b) => a.evaluationCount - b.evaluationCount);
    }

    for (const project of projects) {
      const scoring = await this.scoreProject(project, profile, now);
      
      const rankedProject: RankedProject = {
        ...project,
        score: scoring.finalScore,
        scoring,
        explanation: this.generateExplanation(scoring, profile),
        whyShowing: this.generateWhyShowing(scoring, profile, project)
      };
      
      rankedProjects.push(rankedProject);
    }

    // Sort by score with exploration randomness and fairness considerations
    rankedProjects.sort((a, b) => {
      if (Math.random() < profile.explorationRate) {
        return Math.random() - 0.5; // Random for exploration
      }
      
      // For new users, maintain some bias toward under-rated projects
      if (isNewUser && Math.abs(a.score - b.score) < 0.1) {
        return a.evaluationCount - b.evaluationCount; // Favor less-rated projects
      }
      
      return b.score - a.score;
    });

    console.log('🏆 Top 3 ranked projects:', rankedProjects.slice(0, 3).map(p => ({
      title: p.title.substring(0, 30),
      score: Math.round(p.score * 100) + '%',
      whyShowing: p.whyShowing
    })));

    return rankedProjects;
  }

  async update(userId: string, event: UserEvent): Promise<void> {
    console.log('📚 Learning from user event:', event.eventType, event.feedbackType || event.evaluationType);
    console.log('📚 Event details:', { projectId: event.projectId, feedbackType: event.feedbackType, userId });
    
    const profile = await this.getProfile(userId);
    if (!profile) {
      console.log('❌ No profile found for user:', userId);
      return;
    }
    
    console.log('📚 Profile before update:', { 
      themeInterests: profile.themeInterests.length, 
      geoCentroids: profile.geoCentroids.length 
    });

    const rawStrength = this.getEventStrength(event);
    console.log('📚 Event strength calculated:', rawStrength, 'for', event.feedbackType || event.evaluationType);
    const now = Date.now();

    // Map rawStrength to theme vs geo contributions depending on feedbackType
    // For 'vibe' we apply strength to theme interests; for 'around' apply to geo centroids.
    let themeStrength = 0;
    let geoStrength = 0;

    if (event.eventType === 'feedback') {
      if (event.feedbackType === 'vibe') {
        themeStrength = rawStrength;
        geoStrength = 0;
      } else if (event.feedbackType === 'around') {
        themeStrength = 0;
        geoStrength = rawStrength;
      } else {
        // Fallback: apply equally
        themeStrength = rawStrength * 0.6;
        geoStrength = rawStrength * 0.4;
      }
    } else {
      // Evaluations should NOT create interests that the user hasn't shown preference for
      // Only apply evaluation learning to dimensions the user has already indicated interest in
      const hasThemeInterests = profile.themeInterests.length > 0;
      const hasGeoInterests = profile.geoCentroids.length > 0 || ((profile as any).districtPreferences?.size || 0) > 0;
      
      if (hasThemeInterests && hasGeoInterests) {
        // User has shown both types of preferences - split evaluation
        themeStrength = rawStrength * 0.6; // Favor theme slightly in mixed case
        geoStrength = rawStrength * 0.4;
      } else if (hasThemeInterests) {
        // User only showed theme preferences - only update themes
        themeStrength = rawStrength;
        geoStrength = 0;
        console.log(`👤 Evaluation: User only showed theme preferences, applying ${rawStrength} to theme only`);
      } else if (hasGeoInterests) {
        // User only showed location preferences - only update location
        themeStrength = 0;
        geoStrength = rawStrength;
        console.log(`👤 Evaluation: User only showed location preferences, applying ${rawStrength} to geo only`);
      } else {
        // User hasn't shown any specific preferences yet - don't create any interests from evaluations alone
        themeStrength = 0;
        geoStrength = 0;
        console.log(`👤 Evaluation: User hasn't shown specific preferences yet, not creating interests from evaluation alone`);
      }
    }

    // Update theme interests
    if (Math.abs(themeStrength) > 0) {
      await this.updateThemeInterests(profile, event, themeStrength, now);
    }
    
    // Update location preferences - UNIFIED system for 'around' feedback
    if (event.feedbackType === 'around' && Math.abs(geoStrength) > 0) {
      console.log(`🎯 Processing 'around' action: geoStrength=${geoStrength}, district=${event.projectDistrict}, hasLocation=${!!event.projectLocation}`);
      
      // Update BOTH district and GPS preferences for unified learning
      if (event.projectDistrict) {
        console.log(`📍 Updating district preference for: ${event.projectDistrict}`);
        await this.updateDistrictPreferences(profile, event.projectDistrict, geoStrength);
      }
      if (event.projectLocation) {
        console.log(`🗺️ Updating GPS centroid`);
        const geoEvent = { ...event } as UserEvent;
        await this.updateGeoCentroids(profile, geoEvent, geoStrength, now);
      }
    } else if (event.projectLocation && Math.abs(geoStrength) > 0) {
      // For non-'around' events, still update GPS if location available
      const geoEvent = { ...event } as UserEvent;
      await this.updateGeoCentroids(profile, geoEvent, geoStrength, now);
    }
    
    // Adapt alpha (theme vs geo balance) based on feedback patterns
    this.adaptAlpha(profile, event);
    
  // Update a global action counter on the profile to track click/activity counts
  (profile as any).globalActionCount = ((profile as any).globalActionCount || 0) + 1;

  // Apply click-count based decay to existing interests
  this.applyClickDecay(profile, now);
    
    profile.lastActive = now;
    console.log('✅ Profile updated - Theme interests:', profile.themeInterests.length, 'Geo centroids:', profile.geoCentroids.length);
    if (profile.themeInterests.length > 0) {
      console.log('🎨 Theme interests:', profile.themeInterests.map(i => ({ 
        weight: Math.round(i.weight * 100) / 100, 
        confidence: Math.round(i.confidence * 100) / 100,
        category: i.category 
      })));
    }
    if (profile.geoCentroids.length > 0) {
      console.log('📍 Geo centroids:', profile.geoCentroids.map(c => ({ 
        weight: Math.round(c.weight * 100) / 100, 
        confidence: Math.round(c.confidence * 100) / 100 
      })));
    }
  }

  private async scoreProject(project: GeoProject, profile: UserProfile, now: number): Promise<ScoringBreakdown> {
    // 1. Theme similarity score
    const themeScore = this.calculateThemeScore(project, profile);
    
    // 2. Geographic proximity score
    const geoScore = this.calculateGeoScore(project, profile);
    
    // 3. Fairness score for MJ rating equity
    const fairnessScore = this.calculateFairnessScore(project);
    
    // 4. Exploration bonus
    const explorationBonus = Math.random() < profile.explorationRate ? this.config.diversityBoostFactor : 0;
    
    // 5. Use adaptive alpha based on actual user interests
    const adaptiveAlpha = this.calculateAdaptiveAlpha(profile);

    // Derived components to align with header sliders
    const exposureCount = (project as any).exposureCount || 0;
    const freshness = Math.max(0, Math.min(1, 1 - (exposureCount / 100)));
    const evaluationCount = (project as any).evaluationCount || 0;
    const quality = Math.max(0, Math.min(1, Math.min(evaluationCount / 20, 1)));
    
    // Calculate dynamic fairness influence - decreases as user shows more preferences
    const userPreferenceStrength = profile.themeInterests.length * 0.2 + 
                                   profile.geoCentroids.length * 0.2 + 
                                   ((profile as any).districtPreferences?.size || 0) * 0.2;
    const dynamicFairnessWeight = Math.max(0.05, this.config.fairnessWeight * (1 - Math.min(1, userPreferenceStrength)));
    
    // Log adaptive alpha occasionally for debugging
    if (Math.random() < 0.01) { // 1% chance to avoid spam
      console.log(`🎯 Adaptive alpha: ${Math.round(adaptiveAlpha * 100)}% theme, ${Math.round((1-adaptiveAlpha) * 100)}% geo`);
      console.log(`⚖️ Dynamic fairness: ${Math.round(dynamicFairnessWeight * 100)}% (user strength: ${Math.round(userPreferenceStrength * 100)}%)`);
    }
    
    let baseScore: number;
    if (this.manualWeights) {
      // Manual override: combine components according to user-selected weights
      const w = this.manualWeights;
      baseScore = (
        w.content * themeScore +
        w.location * geoScore +
        w.freshness * freshness +
        w.quality * quality
      );
    } else {
      // Default behavior: blend theme and geo via adaptive alpha
      baseScore = adaptiveAlpha * themeScore + (1 - adaptiveAlpha) * geoScore;
      // Freshness/quality implicitly show up via fairness/exploration in this path
    }

    const finalScore = Math.max(0, Math.min(1,
      baseScore * (1 - dynamicFairnessWeight) + // User preferences get most weight
      dynamicFairnessWeight * fairnessScore +
      explorationBonus * 0.1 // Reduce exploration noise
    ));

    const scoring: ScoringBreakdown = {
      themeScore,
      geoScore,
      popularityScore: 0, // No longer used but keeping for interface compatibility
      fairnessScore,
      explorationBonus,
      finalScore,
      primaryReason: this.determinePrimaryReason(themeScore, geoScore, 0, fairnessScore, explorationBonus),
      secondaryReasons: this.determineSecondaryReasons(themeScore, geoScore, 0, fairnessScore, project),
      confidenceLevel: this.determineConfidenceLevel(profile, themeScore, geoScore)
    };

    return scoring;
  }

  private calculateThemeScore(project: GeoProject, profile: UserProfile): number {
    if (profile.themeInterests.length === 0) return 0; // No theme interests = no theme score
    
    let maxSimilarity = 0;
    let totalWeightedSimilarity = 0;
    let totalWeight = 0;

    for (const interest of profile.themeInterests) {
      const similarity = VectorUtils.cosineSimilarity(project.embedding, interest.embedding);
      const weightedSim = similarity * interest.weight * interest.confidence;
      
      maxSimilarity = Math.max(maxSimilarity, similarity);
      totalWeightedSimilarity += weightedSim;
      totalWeight += interest.weight * interest.confidence;
    }

    // Combine max similarity with weighted average
    const avgSimilarity = totalWeight > 0 ? totalWeightedSimilarity / totalWeight : 0;
    return (maxSimilarity * 0.6 + avgSimilarity * 0.4);
  }

  private calculateGeoScore(project: GeoProject, profile: UserProfile): number {
    const districtPrefs = (profile as any).districtPreferences as Map<string, { weight: number; confidence: number; lastUpdated: number }>;
    
    let districtScore = 0;
    let gpsScore = 0;
    let hasDistrictPrefs = false;
    let hasGpsPrefs = false;
    
    // Calculate district score (Kreis-based matching)
    if (districtPrefs && districtPrefs.size > 0 && project.district) {
      hasDistrictPrefs = true;
      if (districtPrefs.has(project.district)) {
        const pref = districtPrefs.get(project.district)!;
        districtScore = pref.weight * pref.confidence;
        console.log(`🏘️ District match: ${project.district} -> ${Math.round(districtScore*100)}%`);
      }
    }
    
    // Calculate GPS score (coordinate-based matching)
    if (project.location && profile.geoCentroids.length > 0) {
      hasGpsPrefs = true;
      let bestScore = 0;
      
      for (const centroid of profile.geoCentroids) {
        const distance = VectorUtils.geoDistance(project.location, centroid.center);
        const influence = Math.max(0, 1 - distance / this.config.geoInfluenceRadius);
        const score = influence * Math.abs(centroid.weight) * centroid.confidence;
        
        if (centroid.weight > 0) {
          bestScore = Math.max(bestScore, score);
        } else {
          bestScore = Math.max(bestScore, 1 - score);
        }
      }
      gpsScore = bestScore;
      if (gpsScore > 0) {
        console.log(`🗺️ GPS match: ${Math.round(gpsScore*100)}% (${Math.round(VectorUtils.geoDistance(project.location, profile.geoCentroids[0].center)*10)/10}km)`);
      }
    }
    
    // Unified scoring: combine both systems intelligently
    if (hasDistrictPrefs && hasGpsPrefs) {
      // Both systems active: prioritize district but boost with GPS
      const combinedScore = districtScore * 0.7 + gpsScore * 0.3;
      console.log(`🎯 Combined location score: ${Math.round(combinedScore*100)}% (district: ${Math.round(districtScore*100)}%, GPS: ${Math.round(gpsScore*100)}%)`);
      return Math.min(1.0, combinedScore);
    } else if (hasDistrictPrefs) {
      return Math.min(1.0, districtScore);
    } else if (hasGpsPrefs) {
      return gpsScore;
    }
    
    // No geographic preferences yet - return 0
    return 0;
  }

  private calculatePopularityScore(project: GeoProject): number {
    // Normalize popularity metrics
    const viewScore = Math.min(1, project.viewCount / 100);
    const evalScore = Math.min(1, project.evaluationCount / 20);
    const ratingScore = Math.max(0, Math.min(1, project.averageRating / 5));
    
    return (viewScore * 0.3 + evalScore * 0.4 + ratingScore * 0.3);
  }

  private calculateFairnessScore(project: GeoProject): number {
    // Calculate how under-rated this project is compared to target
    const ratingGap = Math.max(0, this.config.targetRatingCount - project.evaluationCount);
    const ratingEquityScore = Math.min(1, ratingGap / this.config.targetRatingCount);
    
    // Apply fairness boost - projects with fewer ratings get higher scores
    const fairnessScore = ratingEquityScore * this.config.fairnessBoostFactor;
    
    // Additional boost for projects with very few ratings (cold start)
    const coldStartBoost = project.evaluationCount < 5 ? 0.05 : 0;
    
    return Math.min(1, fairnessScore + coldStartBoost);
  }

  private calculateAdaptiveAlpha(profile: UserProfile): number {
    // If user has no interests yet, start neutral
    if (profile.themeInterests.length === 0 && profile.geoCentroids.length === 0) {
      const districtPrefs = (profile as any).districtPreferences as Map<string, any>;
      const hasDistricts = districtPrefs && districtPrefs.size > 0;
      
      // Check if there are ONLY district preferences and no other interests
      if (!hasDistricts) {
        console.log(`🎯 No interests learned yet - using 50/50 split`);
        return 0.5; // 50/50 theme/geo when no preferences learned
      }
    }
    
    // Calculate theme strength (number and confidence of theme interests)
    const themeStrength = profile.themeInterests.length > 0 
      ? profile.themeInterests.reduce((sum, interest) => sum + interest.weight * interest.confidence, 0)
      : 0;
    
    // Calculate geo strength: INCLUDE both GPS AND district preferences
    let geoStrength = 0;
    
    // GPS centroids contribution
    if (profile.geoCentroids.length > 0) {
      geoStrength += profile.geoCentroids.reduce((sum, centroid) => sum + Math.abs(centroid.weight) * centroid.confidence, 0);
    }
    
    // District preferences contribution (this was missing!)
    const districtPrefs = (profile as any).districtPreferences as Map<string, { weight: number; confidence: number; lastUpdated: number }>;
    if (districtPrefs && districtPrefs.size > 0) {
      for (const [district, pref] of districtPrefs) {
        geoStrength += pref.weight * pref.confidence;
      }
    }
    
    console.log(`🔍 Alpha calculation: themeStrength=${Math.round(themeStrength*100)/100}, geoStrength=${Math.round(geoStrength*100)/100} (GPS: ${profile.geoCentroids.length}, districts: ${districtPrefs?.size || 0})`);
    
    // No interests = neutral
    if (themeStrength === 0 && geoStrength === 0) {
      return 0.5;
    }
    
    // Calculate adaptive alpha based on relative strengths
    const totalStrength = themeStrength + geoStrength;
    let adaptiveAlpha = themeStrength / totalStrength;
    
    console.log(`📊 Raw alpha: ${Math.round((1-adaptiveAlpha)*100)}% location, ${Math.round(adaptiveAlpha*100)}% theme`);
    
    // Instead of squaring (which hurts the weaker signal), apply gentle amplification
    // Move away from 0.5 towards the stronger preference, but not as aggressively
    if (adaptiveAlpha > 0.5) {
      // Theme is stronger - gently increase theme bias
      adaptiveAlpha = 0.5 + (adaptiveAlpha - 0.5) * 1.5; // 50% amplification instead of squaring
    } else {
      // Location is stronger - gently increase location bias  
      adaptiveAlpha = 0.5 + (adaptiveAlpha - 0.5) * 1.5; // 50% amplification instead of squaring
    }
    
    console.log(`📊 Amplified alpha: ${Math.round((1-adaptiveAlpha)*100)}% location, ${Math.round(adaptiveAlpha*100)}% theme (before clamping)`);
    
    // Clamp to reasonable bounds (20-80% for more balanced adaptation)
    const finalAlpha = Math.max(0.2, Math.min(0.8, adaptiveAlpha));
    console.log(`✅ Final alpha: ${Math.round((1-finalAlpha)*100)}% location, ${Math.round(finalAlpha*100)}% theme`);
    
    return finalAlpha;
  }

  private async updateThemeInterests(profile: UserProfile, event: UserEvent, strength: number, now: number): Promise<void> {
    const projectEmbedding = event.projectEmbedding;
    
    // Find most similar existing interest
    let bestMatch: { interest: ThemeInterest; similarity: number; index: number } | null = null;
    
    for (let i = 0; i < profile.themeInterests.length; i++) {
      const interest = profile.themeInterests[i];
      const similarity = VectorUtils.cosineSimilarity(projectEmbedding, interest.embedding);
      
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { interest, similarity, index: i };
      }
    }

    if (bestMatch && bestMatch.similarity > this.config.interestMergeThreshold) {
      // Update existing interest
      const interest = bestMatch.interest;
      const learningRate = profile.learningRate * Math.abs(strength);
      
      // Update embedding (move towards or away from project)
      if (strength > 0) {
        interest.embedding = VectorUtils.normalizeVector(
          VectorUtils.addVectors(interest.embedding, projectEmbedding, learningRate)
        );
      } else {
        interest.embedding = VectorUtils.normalizeVector(
          VectorUtils.addVectors(interest.embedding, projectEmbedding, -learningRate)
        );
      }
      
      // Update weight and confidence
      interest.weight += strength * 0.1;
      interest.weight = Math.max(this.config.minInterestWeight, Math.min(1.0, interest.weight));
      interest.confidence = Math.min(1.0, interest.confidence + Math.abs(strength) * 0.05);
      interest.lastUpdated = now;
      
    } else if (strength > 0 && profile.themeInterests.length < this.config.maxThemeInterests) {
      // Create new interest
      const newInterest: ThemeInterest = {
        embedding: [...projectEmbedding],
        weight: Math.abs(strength),
        confidence: 0.3,
        category: event.projectCategory,
        lastUpdated: now
      };
      profile.themeInterests.push(newInterest);
    }

    // Remove weak interests
    profile.themeInterests = profile.themeInterests.filter(
      interest => interest.weight >= this.config.minInterestWeight
    );
  }

  private async updateGeoCentroids(profile: UserProfile, event: UserEvent, strength: number, now: number): Promise<void> {
    if (!event.projectLocation) return;
    
    const location = event.projectLocation;
    
    // Find nearest centroid
    let nearestCentroid: { centroid: GeoCentroid; distance: number; index: number } | null = null;
    
    for (let i = 0; i < profile.geoCentroids.length; i++) {
      const centroid = profile.geoCentroids[i];
      const distance = VectorUtils.geoDistance(location, centroid.center);
      
      if (!nearestCentroid || distance < nearestCentroid.distance) {
        nearestCentroid = { centroid, distance, index: i };
      }
    }

    if (nearestCentroid && nearestCentroid.distance < this.config.geoInfluenceRadius) {
      // Update existing centroid - amplified learning like themes
      const centroid = nearestCentroid.centroid;
      const amplifiedLearningRate = profile.learningRate * Math.abs(strength); // Match theme amplification
      
      // Move centroid towards/away from location
      if (strength > 0) {
        centroid.center.lat += (location.lat - centroid.center.lat) * amplifiedLearningRate;
        centroid.center.lng += (location.lng - centroid.center.lng) * amplifiedLearningRate;
      }
      
      // Update weight - match theme multiplier
      centroid.weight += strength * 0.1; // Match theme 0.1 multiplier
      centroid.weight = Math.max(-1, Math.min(1, centroid.weight));
      centroid.confidence = Math.min(1.0, centroid.confidence + Math.abs(strength) * 0.05); // Match theme confidence boost
      centroid.lastUpdated = now;
      
      console.log(`🗺️ Updated GPS centroid: weight=${Math.round(centroid.weight*100)/100}, confidence=${Math.round(centroid.confidence*100)/100}`);
      
    } else if (strength > 0 && profile.geoCentroids.length < this.config.maxGeoCentroids) {
      // Create new centroid - full strength, no penalty
      const newCentroid: GeoCentroid = {
        center: { ...location },
        weight: Math.abs(strength), // Full strength like themes
        confidence: 0.3,
        lastUpdated: now
      };
      profile.geoCentroids.push(newCentroid);
      console.log(`🗺️ Added new GPS centroid: weight=${Math.round(newCentroid.weight*100)/100}`);
    }

    // Remove weak centroids
    profile.geoCentroids = profile.geoCentroids.filter(
      centroid => Math.abs(centroid.weight) >= this.config.minGeoWeight
    );
  }

  private adaptAlpha(profile: UserProfile, event: UserEvent): void {
    // Adapt theme vs geo balance based on user behavior patterns
    const feedbackStrength = this.getEventStrength(event);
    
    if (Math.abs(feedbackStrength) > 0.2) { // Strong feedback
      if (event.projectLocation) {
        // Has geographic context, slightly favor geo
        profile.alpha = Math.max(0.3, profile.alpha - 0.02);
      } else {
        // No geographic context, favor theme
        profile.alpha = Math.min(0.9, profile.alpha + 0.02);
      }
    }
  }

  private async updateDistrictPreferences(profile: UserProfile, district: string, strength: number): Promise<void> {
    const districtPrefs = (profile as any).districtPreferences as Map<string, { weight: number; confidence: number; lastUpdated: number }>;
    
    if (districtPrefs.has(district)) {
      // Update existing district preference - match theme sensitivity
      const pref = districtPrefs.get(district)!;
      pref.weight += strength * 0.1; // Match theme multiplier for consistency
      pref.weight = Math.max(0, Math.min(1, pref.weight)); // Clamp between 0 and 1
      pref.confidence = Math.min(1.0, pref.confidence + Math.abs(strength) * 0.05); // Match theme confidence boost
      pref.lastUpdated = Date.now();
      console.log(`🏘️ Updated district preference: ${district} -> weight=${Math.round(pref.weight*100)/100}, confidence=${Math.round(pref.confidence*100)/100}`);
    } else {
      // Create new district preference - full strength, no penalty
      districtPrefs.set(district, {
        weight: Math.abs(strength), // Full strength like themes - no 50% penalty
        confidence: 0.3,
        lastUpdated: Date.now()
      });
      console.log(`🏘️ Added new district preference: ${district} -> weight=${Math.round(Math.abs(strength)*100)/100}`);
    }
    
    // Reinforce GPS centroids when district preferences are strong
    this.reinforceGeoWithDistrict(profile, district, strength);
  }

  private reinforceGeoWithDistrict(profile: UserProfile, district: string, strength: number): void {
    // Cross-reinforce GPS and district systems
    const districtPrefs = (profile as any).districtPreferences as Map<string, { weight: number; confidence: number; lastUpdated: number }>;
    
    // When we learn district preferences, also boost GPS centroids in similar areas
    if (Math.abs(strength) > 0.3 && profile.geoCentroids.length > 0) {
      for (const centroid of profile.geoCentroids) {
        // Boost confidence of GPS centroids when district preferences align
        const reinforcement = Math.abs(strength) * 0.05; // 5% of the district strength
        centroid.confidence = Math.min(1.0, centroid.confidence + reinforcement);
        console.log(`🔗 GPS↔️District reinforcement: +${Math.round(reinforcement*100)}% confidence from ${district}`);
      }
    }
    
    // When we learn GPS preferences, also boost related districts (reverse reinforcement)
    if (districtPrefs.size > 0) {
      const currentDistrict = districtPrefs.get(district);
      if (currentDistrict && profile.geoCentroids.length > 0) {
        // Small cross-system confidence boost
        currentDistrict.confidence = Math.min(1.0, currentDistrict.confidence + Math.abs(strength) * 0.02);
      }
    }
  }

  private applyClickDecay(profile: UserProfile, now: number): void {
    // Click-based decay: reduce confidence for interests/centroids/districts when there
    // hasn't been recent click activity. We expect the profile to track `lastActionCount`
    // which represents the total number of actions observed when the profile was last updated.
    // Newer actions increase that count; absence of new actions implies decay.

    const globalActionCount = (profile as any).globalActionCount ?? 0;
    const lastSeen = (profile as any).lastActionCount ?? globalActionCount;
    const actionsMissed = Math.max(0, globalActionCount - lastSeen);

    // Decay factor per missed action (small per-click decay)
    const perActionDecay = 0.995; // ~0.5% confidence loss per missed action
    const decayMultiplier = Math.pow(perActionDecay, actionsMissed);

    // Apply to theme interests
    for (const interest of profile.themeInterests) {
      interest.confidence *= decayMultiplier;
    }

    // Apply to geo centroids
    for (const centroid of profile.geoCentroids) {
      centroid.confidence *= decayMultiplier;
    }

    // Apply to district preferences and prune weak ones
    const districtPrefs = (profile as any).districtPreferences as Map<string, { weight: number; confidence: number; lastUpdated: number }>;
    if (districtPrefs) {
      for (const [district, pref] of districtPrefs) {
        pref.confidence *= decayMultiplier;
        if (pref.confidence < 0.1) {
          districtPrefs.delete(district);
        }
      }
    }

    // Update lastActionCount marker
    (profile as any).lastActionCount = globalActionCount;
  }

  private getEventStrength(event: UserEvent): number {
    if (event.eventType === 'feedback') {
      return (this.config.feedbackStrength as any)[event.feedbackType!] ?? 0;
    } else if (event.eventType === 'evaluation') {
      return (this.config.feedbackStrength as any)[event.evaluationType!] ?? 0;
    }
    return 0;
  }

  private generateCategoryEmbedding(category: string, projectsInCategory?: GeoProject[]): number[] {
    if (this.useRealEmbeddings && projectsInCategory && projectsInCategory.length > 0) {
      // Use real embeddings: average embeddings from projects in this category
      console.log(`📊 Generating real embedding for "${category}" from ${projectsInCategory.length} projects`);
      
      const dimensionCount = projectsInCategory[0].embedding.length;
      const avgEmbedding = new Array(dimensionCount).fill(0);
      
      // Average all project embeddings in this category
      for (const project of projectsInCategory) {
        for (let i = 0; i < dimensionCount; i++) {
          avgEmbedding[i] += project.embedding[i];
        }
      }
      
      // Normalize by count
      for (let i = 0; i < dimensionCount; i++) {
        avgEmbedding[i] /= projectsInCategory.length;
      }
      
      return avgEmbedding;
    } else {
      // Simplified category embedding - 5D vectors
      console.log(`🔧 Using simplified embedding for "${category}"`);
      const embeddings: { [key: string]: number[] } = {
        'Health and Wellbeing': [0.8, 0.2, 0.1, 0.4, 0.6],
        'Environment': [0.1, 0.9, 0.3, 0.2, 0.5],
        'Education': [0.6, 0.3, 0.8, 0.7, 0.2],
        'Transportation': [0.4, 0.1, 0.2, 0.9, 0.3],
        'Culture': [0.2, 0.4, 0.7, 0.3, 0.8]
      };
      
      return embeddings[category] || [0.5, 0.5, 0.5, 0.5, 0.5];
    }
  }

  private determinePrimaryReason(theme: number, geo: number, popularity: number, fairness: number, exploration: number): string {
    const scores = { theme, geo, popularity, fairness, exploration };
    const maxKey = Object.keys(scores).reduce((a, b) => 
      scores[a as keyof typeof scores] > scores[b as keyof typeof scores] ? a : b
    );
    
    const reasons = {
      theme: 'content_match',
      geo: 'location_preference', 
      popularity: 'content_match', // Fallback to content match
      fairness: 'rating_equity',
      exploration: 'diversity_exploration'
    };
    
    return reasons[maxKey as keyof typeof reasons];
  }

  private determineSecondaryReasons(theme: number, geo: number, popularity: number, fairness: number, project: GeoProject): string[] {
    const reasons: string[] = [];
    
    if (theme > 0.6) reasons.push('strong_theme_match');
    if (geo > 0.6) reasons.push('preferred_area');
    if (fairness > 0.7) reasons.push('needs_more_ratings');
    if (project.evaluationCount < 5) reasons.push('new_project');
    if (project.evaluationCount > 5 && project.evaluationCount < 15) reasons.push('getting_feedback');
    
    return reasons;
  }

  private determineConfidenceLevel(profile: UserProfile, theme: number, geo: number): 'high' | 'medium' | 'low' {
    const avgThemeConfidence = profile.themeInterests.length > 0 
      ? profile.themeInterests.reduce((sum, i) => sum + i.confidence, 0) / profile.themeInterests.length 
      : 0;
    
    const avgGeoConfidence = profile.geoCentroids.length > 0
      ? profile.geoCentroids.reduce((sum, c) => sum + c.confidence, 0) / profile.geoCentroids.length
      : 0;

    const overallConfidence = (avgThemeConfidence * profile.alpha) + (avgGeoConfidence * (1 - profile.alpha));
    
    if (overallConfidence > 0.7) return 'high';
    if (overallConfidence > 0.4) return 'medium';
    return 'low';
  }

  private generateExplanation(scoring: ScoringBreakdown, profile: UserProfile): string {
    if (scoring.primaryReason === 'content_match') {
      return 'Strong content match to your interests';
    } else if (scoring.primaryReason === 'location_preference') {
      return 'Located in your preferred area';
    } else if (scoring.primaryReason === 'rating_equity') {
      return 'Needs more ratings for fair evaluation';
    } else {
      return 'Recommended for diversity';
    }
  }

  private generateWhyShowing(scoring: ScoringBreakdown, profile: UserProfile, project: GeoProject): string {
    const reasons: string[] = [];
    
    if (scoring.themeScore > 0.6) {
      reasons.push(`similar to ${project.category.toLowerCase()} projects you liked`);
    }
    
    if (scoring.geoScore > 0.6) {
      reasons.push(`near areas you're interested in`);
    }
    
    if (scoring.fairnessScore > 0.7) {
      if (project.evaluationCount < 5) {
        reasons.push('new project that needs initial ratings');
      } else {
        reasons.push('needs more ratings for fair comparison');
      }
    }
    
    if (scoring.explorationBonus > 0) {
      reasons.push('to show you something different');
    }

    if (reasons.length === 0) {
      return 'Based on your overall preferences';
    }
    
    return reasons.length === 1 ? reasons[0] : reasons.slice(0, 2).join(' and ');
  }

  async getProfileInsights(userId: string): Promise<{ topThemes: string[]; preferredAreas: string[]; explorationLevel: number; }> {
    const profile = await this.getProfile(userId);
    if (!profile) {
      return { topThemes: [], preferredAreas: [], explorationLevel: 0 };
    }

    const topThemes = profile.themeInterests
      .sort((a, b) => b.weight * b.confidence - a.weight * a.confidence)
      .slice(0, 3)
      .map(i => i.category || 'Unknown')
      .filter(Boolean);

    const preferredAreas = profile.geoCentroids
      .filter(c => c.weight > 0)
      .sort((a, b) => b.weight * b.confidence - a.weight * a.confidence)
      .slice(0, 3)
      .map(c => `${c.center.lat.toFixed(3)}, ${c.center.lng.toFixed(3)}`);

    return {
      topThemes,
      preferredAreas,
      explorationLevel: profile.explorationRate
    };
  }
}

// Export singleton instance
export const recoService = new AdvancedRecoService();