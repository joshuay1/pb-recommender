// Advanced Recommender System Types

export type EvaluationType = 'love' | 'like' | 'maybe' | 'not_convinced';
export type FeedbackType = 'more' | 'less';

// Geographic types
export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface GeoCentroid {
  center: GeoLocation;
  weight: number; // positive = attracted, negative = repelled
  confidence: number; // how certain we are about this preference
  lastUpdated: number;
}

// Multi-interest theme profile
export interface ThemeInterest {
  embedding: number[]; // theme vector
  weight: number; // importance of this interest
  confidence: number;
  category?: string; // optional category label
  lastUpdated: number;
}

// User profile with multi-interest and geo awareness
export interface UserProfile {
  userId: string;
  
  // Multi-interest theme embeddings
  themeInterests: ThemeInterest[];
  
  // Geographic preferences
  geoCentroids: GeoCentroid[];
  
  // Dynamic balance between theme and geography
  alpha: number; // 0.0 = all geo, 1.0 = all theme
  
  // Exploration parameters
  explorationRate: number; // epsilon for epsilon-greedy
  
  // Learning parameters
  learningRate: number;
  decayFactor: number;
  
  // Cold start data
  isNewUser: boolean;
  preferredCategories: string[];
  preferredDistricts: string[];
  
  // Metadata
  createdAt: number;
  lastActive: number;
}

// User events for learning
export interface UserEvent {
  userId: string;
  projectId: number;
  eventType: 'feedback' | 'evaluation';
  feedbackType?: FeedbackType;
  evaluationType?: EvaluationType;
  timestamp: number;
  
  // Context for learning
  projectEmbedding: number[];
  projectLocation?: GeoLocation;
  projectCategory: string;
  projectDistrict: string;
}

// Extended project with geographic data
export interface GeoProject {
  id: number;
  title: string;
  description: string;
  district: string;
  category: string;
  budget: string;
  embedding: number[];
  
  // Geographic data
  location?: GeoLocation;
  
  // Popularity metrics for cold start
  viewCount: number;
  evaluationCount: number;
  averageRating: number;
}

// Scoring components for transparency
export interface ScoringBreakdown {
  themeScore: number; // 0-1
  geoScore: number; // 0-1
  popularityScore: number; // 0-1
  fairnessScore: number; // 0-1
  explorationBonus: number; // 0-1
  finalScore: number; // 0-1
  
  // Explanation components
  primaryReason: string;
  secondaryReasons: string[];
  confidenceLevel: 'high' | 'medium' | 'low';
}

// Ranked project with explanation
export interface RankedProject extends GeoProject {
  score: number;
  scoring: ScoringBreakdown;
  explanation: string;
  whyShowing: string; // "Why am I seeing this?"
}

// Recommender service interface
export interface RecoService {
  // Main functions
  rank(userId: string, projects: GeoProject[]): Promise<RankedProject[]>;
  update(userId: string, event: UserEvent): Promise<void>;
  
  // Profile management
  createProfile(userId: string, preferences?: Partial<UserProfile>): Promise<UserProfile>;
  getProfile(userId: string): Promise<UserProfile | null>;
  
  // Cold start
  initializeProfile(userId: string, categories: string[], districts: string[]): Promise<UserProfile>;
  
  // Analytics
  getProfileInsights(userId: string): Promise<{
    topThemes: string[];
    preferredAreas: string[];
    explorationLevel: number;
  }>;
}

// Configuration for the recommender
export interface RecoConfig {
  // Scoring weights
  themeWeight: number;
  geoWeight: number;
  popularityWeight: number;
  fairnessWeight: number;
  
  // Learning parameters
  defaultLearningRate: number;
  defaultDecayFactor: number;
  defaultExplorationRate: number;
  
  // Multi-interest parameters
  maxThemeInterests: number;
  minInterestWeight: number;
  interestMergeThreshold: number; // cosine similarity threshold for merging
  
  // Geographic parameters
  maxGeoCentroids: number;
  minGeoWeight: number;
  geoInfluenceRadius: number; // km
  
  // Exploration parameters
  diversityBoostFactor: number;
  noveltyDecayDays: number;
  
  // Fairness parameters for MJ rating equity
  targetRatingCount: number; // Ideal number of ratings per project
  fairnessBoostFactor: number; // How much to boost under-rated projects
  
  // Feedback strength
  feedbackStrength: {
    more: number;
    less: number;
    love: number;
    like: number;
    maybe: number;
    not_convinced: number;
  };
}