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
  
  constructor(config?: Partial<RecoConfig>) {
    this.config = {
      // Scoring weights
      themeWeight: 0.6,
      geoWeight: 0.2,
      popularityWeight: 0.1,
      fairnessWeight: 0.1,
      
      // Learning parameters
      defaultLearningRate: 0.1,
      defaultDecayFactor: 0.95,
      defaultExplorationRate: 0.15,
      
      // Multi-interest parameters
      maxThemeInterests: 5,
      minInterestWeight: 0.1,
      interestMergeThreshold: 0.8,
      
      // Geographic parameters
      maxGeoCentroids: 3,
      minGeoWeight: 0.1,
      geoInfluenceRadius: 10, // km
      
      // Exploration parameters
      diversityBoostFactor: 0.3,
      noveltyDecayDays: 30,
      
      // Fairness parameters for MJ rating equity
      targetRatingCount: 20, // Target 20 ratings per project for stable MJ
      fairnessBoostFactor: 0.8, // Strong boost for under-rated projects
      
      // Feedback strength
      feedbackStrength: {
        more: 0.3,
        less: -0.2,
        love: 0.4,
        like: 0.1,
        maybe: -0.05,
        not_convinced: -0.3
      },
      
      ...config
    };
  }

  async createProfile(userId: string, preferences?: Partial<UserProfile>): Promise<UserProfile> {
    const profile: UserProfile = {
      userId,
      themeInterests: [],
      geoCentroids: [],
      alpha: 0.7, // Start theme-focused
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
    
    this.profiles.set(userId, profile);
    return profile;
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    return this.profiles.get(userId) || null;
  }

  async initializeProfile(userId: string, categories: string[], districts: string[]): Promise<UserProfile> {
    const profile = await this.createProfile(userId, {
      preferredCategories: categories,
      preferredDistricts: districts,
      isNewUser: false
    });
    
    // Initialize with category-based interests (simplified)
    categories.forEach((category, index) => {
      const interest: ThemeInterest = {
        embedding: this.generateCategoryEmbedding(category),
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
    
    const profile = await this.getProfile(userId);
    if (!profile) return;

    const strength = this.getEventStrength(event);
    const now = Date.now();

    // Update theme interests
    await this.updateThemeInterests(profile, event, strength, now);
    
    // Update geographic preferences if location available
    if (event.projectLocation) {
      await this.updateGeoCentroids(profile, event, strength, now);
    }
    
    // Adapt alpha (theme vs geo balance) based on feedback patterns
    this.adaptAlpha(profile, event);
    
    // Apply time decay to existing interests
    this.applyTimeDecay(profile, now);
    
    profile.lastActive = now;
    console.log('✅ Profile updated - Theme interests:', profile.themeInterests.length, 'Geo centroids:', profile.geoCentroids.length);
  }

  private async scoreProject(project: GeoProject, profile: UserProfile, now: number): Promise<ScoringBreakdown> {
    // 1. Theme similarity score
    const themeScore = this.calculateThemeScore(project, profile);
    
    // 2. Geographic proximity score
    const geoScore = this.calculateGeoScore(project, profile);
    
    // 3. Popularity score for cold start
    const popularityScore = this.calculatePopularityScore(project);
    
    // 4. Fairness score for MJ rating equity
    const fairnessScore = this.calculateFairnessScore(project);
    
    // 5. Exploration bonus
    const explorationBonus = Math.random() < profile.explorationRate ? this.config.diversityBoostFactor : 0;
    
    // 6. Combine scores with fairness weighting
    const baseScore = profile.alpha * themeScore + (1 - profile.alpha) * geoScore;
    const finalScore = Math.max(0, Math.min(1,
      baseScore * (1 - this.config.popularityWeight - this.config.fairnessWeight) +
      this.config.popularityWeight * popularityScore +
      this.config.fairnessWeight * fairnessScore +
      explorationBonus
    ));

    const scoring: ScoringBreakdown = {
      themeScore,
      geoScore,
      popularityScore,
      fairnessScore,
      explorationBonus,
      finalScore,
      primaryReason: this.determinePrimaryReason(themeScore, geoScore, popularityScore, fairnessScore, explorationBonus),
      secondaryReasons: this.determineSecondaryReasons(themeScore, geoScore, popularityScore, fairnessScore, project),
      confidenceLevel: this.determineConfidenceLevel(profile, themeScore, geoScore)
    };

    return scoring;
  }

  private calculateThemeScore(project: GeoProject, profile: UserProfile): number {
    if (profile.themeInterests.length === 0) return 0.5; // Neutral for new users
    
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
    if (!project.location || profile.geoCentroids.length === 0) return 0.5;
    
    let bestScore = 0;
    
    for (const centroid of profile.geoCentroids) {
      const distance = VectorUtils.geoDistance(project.location, centroid.center);
      const influence = Math.max(0, 1 - distance / this.config.geoInfluenceRadius);
      const score = influence * Math.abs(centroid.weight) * centroid.confidence;
      
      if (centroid.weight > 0) {
        bestScore = Math.max(bestScore, score);
      } else {
        bestScore = Math.max(bestScore, 1 - score); // Penalty becomes low score
      }
    }
    
    return bestScore;
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
    const coldStartBoost = project.evaluationCount < 5 ? 0.2 : 0;
    
    return Math.min(1, fairnessScore + coldStartBoost);
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
      // Update existing centroid
      const centroid = nearestCentroid.centroid;
      const learningRate = profile.learningRate;
      
      // Move centroid towards/away from location
      if (strength > 0) {
        centroid.center.lat += (location.lat - centroid.center.lat) * learningRate;
        centroid.center.lng += (location.lng - centroid.center.lng) * learningRate;
      }
      
      // Update weight
      centroid.weight += strength * 0.2;
      centroid.weight = Math.max(-1, Math.min(1, centroid.weight));
      centroid.confidence = Math.min(1.0, centroid.confidence + Math.abs(strength) * 0.1);
      centroid.lastUpdated = now;
      
    } else if (strength > 0 && profile.geoCentroids.length < this.config.maxGeoCentroids) {
      // Create new centroid
      const newCentroid: GeoCentroid = {
        center: { ...location },
        weight: strength,
        confidence: 0.3,
        lastUpdated: now
      };
      profile.geoCentroids.push(newCentroid);
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

  private applyTimeDecay(profile: UserProfile, now: number): void {
    // Decay theme interests
    for (const interest of profile.themeInterests) {
      const daysSinceUpdate = (now - interest.lastUpdated) / (1000 * 60 * 60 * 24);
      interest.confidence *= Math.pow(0.99, daysSinceUpdate);
    }
    
    // Decay geo centroids
    for (const centroid of profile.geoCentroids) {
      const daysSinceUpdate = (now - centroid.lastUpdated) / (1000 * 60 * 60 * 24);
      centroid.confidence *= Math.pow(0.99, daysSinceUpdate);
    }
  }

  private getEventStrength(event: UserEvent): number {
    if (event.eventType === 'feedback') {
      return this.config.feedbackStrength[event.feedbackType!];
    } else if (event.eventType === 'evaluation') {
      return this.config.feedbackStrength[event.evaluationType!];
    }
    return 0;
  }

  private generateCategoryEmbedding(category: string): number[] {
    // Simplified category embedding - in production, use real embeddings
    const embeddings: { [key: string]: number[] } = {
      'Health and Wellbeing': [0.8, 0.2, 0.1, 0.4, 0.6],
      'Environment': [0.1, 0.9, 0.3, 0.2, 0.5],
      'Education': [0.6, 0.3, 0.8, 0.7, 0.2],
      'Transportation': [0.4, 0.1, 0.2, 0.9, 0.3],
      'Culture': [0.2, 0.4, 0.7, 0.3, 0.8]
    };
    
    return embeddings[category] || [0.5, 0.5, 0.5, 0.5, 0.5];
  }

  private determinePrimaryReason(theme: number, geo: number, popularity: number, fairness: number, exploration: number): string {
    const scores = { theme, geo, popularity, fairness, exploration };
    const maxKey = Object.keys(scores).reduce((a, b) => 
      scores[a as keyof typeof scores] > scores[b as keyof typeof scores] ? a : b
    );
    
    const reasons = {
      theme: 'content_match',
      geo: 'location_preference', 
      popularity: 'popular_choice',
      fairness: 'rating_equity',
      exploration: 'diversity_exploration'
    };
    
    return reasons[maxKey as keyof typeof reasons];
  }

  private determineSecondaryReasons(theme: number, geo: number, popularity: number, fairness: number, project: GeoProject): string[] {
    const reasons: string[] = [];
    
    if (theme > 0.6) reasons.push('strong_theme_match');
    if (geo > 0.6) reasons.push('preferred_area');
    if (popularity > 0.7) reasons.push('highly_rated');
    if (fairness > 0.7) reasons.push('needs_more_ratings');
    if (project.evaluationCount > 50) reasons.push('community_favorite');
    if (project.evaluationCount < 5) reasons.push('new_project');
    
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
    } else if (scoring.primaryReason === 'popular_choice') {
      return 'Popular choice among users';
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
    
    if (scoring.popularityScore > 0.7) {
      reasons.push('popular with other users');
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