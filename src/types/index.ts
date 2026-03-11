// Base project interface from ranking system
export interface BaseProject {
  id: number;
  embedding: number[];
}

// Full project interface with all properties
export interface Project extends BaseProject {
  title: string;
  description: string;
  district: string;
  category: string;
  budget: string;
  score?: number;
  explanation?: string;
  gradeCount?: number;
  matchReason?: string;
}

// Ranked project (what comes from rankProjects)
export interface RankedProject extends Project {
  score: number;
  explanation: string;
}

// Graded project includes the user's grade
export interface GradedProject extends Project {
  grade: 'not_convinced' | 'maybe' | 'like' | 'love';
}

// User action types
export interface ShowAction {
  projectId: number;
  action: 'vibe' | 'around';
  ts: number;
  district?: string; // District info for 'around' actions
}

// Stats interface for Header component
export interface AppStats {
  projectsViewed: number;
  projectsGraded: number;
  diversityScore: number;
  locationWeight: number;
  themeWeight: number;
  freshnessWeight?: number;
  qualityWeight?: number;
  totalProjects: number;
  closestDistrict: string;
  closestTheme: string;
}

// Feedback type
export type FeedbackType = 'vibe' | 'around';

// Grade type
export type GradeType = 'not_convinced' | 'maybe' | 'like' | 'love';