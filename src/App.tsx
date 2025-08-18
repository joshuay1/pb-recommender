import React, { useState, useMemo, useCallback, useEffect } from 'react';
import './App.css';
import Header from './components/Header.tsx';
import ProjectCard from './components/ProjectCard.tsx';
import GradedList from './components/GradedList.tsx';
import { useSessionActions } from './hooks/useSessionActions.ts';
import { recoService } from './services/RecoService.ts';
import projectsData from './data/projects.json';
import type { Project, GradedProject, AppStats } from './types/index.ts';
import type { GeoProject, RankedProject, FeedbackType, EvaluationType, UserEvent } from './types/recommender.ts';

function App() {
  const [gradedProjects, setGradedProjects] = useState<GradedProject[]>([]);
  const [displayLimit, setDisplayLimit] = useState(50); // Start with 50 projects
  const [userProfile, setUserProfile] = useState<string | null>(null);
  const [rankedProjects, setRankedProjects] = useState<RankedProject[]>([]);
  const { actions, logShowAction } = useSessionActions('user');

  // Initialize user profile on first load
  useEffect(() => {
    const initializeUser = async () => {
      if (!userProfile) {
        const userId = 'user-' + Date.now();
        await recoService.createProfile(userId);
        setUserProfile(userId);
        console.log('👤 Created user profile:', userId);
      }
    };
    initializeUser();
  }, [userProfile]);

  // Testing console logs
  console.log('🔄 App render - Display limit:', displayLimit);
  console.log('👤 User profile:', userProfile);
  console.log('🏆 Graded projects:', gradedProjects.length);

  // Convert projects to GeoProject format with mock geographic data
  const geoProjects = useMemo((): GeoProject[] => {
    console.log('📚 Loading projects data - Total projects:', (projectsData as Project[]).length);
    return (projectsData as Project[]).map(project => ({
      ...project,
      location: {
        lat: 37.7749 + (Math.random() - 0.5) * 0.1, // San Francisco area
        lng: -122.4194 + (Math.random() - 0.5) * 0.1
      },
      viewCount: Math.floor(Math.random() * 200) + 10,
      evaluationCount: Math.floor(Math.random() * 50) + 1,
      averageRating: Math.random() * 2 + 3 // 3-5 rating
    }));
  }, []);

  // Rank projects using the advanced recommender service
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rankingTrigger, setRankingTrigger] = useState(0);
  
  useEffect(() => {
    const rankProjectsAsync = async () => {
      if (!userProfile) return;
      
      console.log('🔮 Ranking projects with AdvancedRecoService (trigger:', rankingTrigger, ')');
      const startTime = performance.now();
      
      try {
        const ranked = await recoService.rank(userProfile, geoProjects);
        setRankedProjects(ranked);
        
        const endTime = performance.now();
        console.log('✅ Advanced ranking complete in', Math.round(endTime - startTime), 'ms');
        console.log('🏆 Top 5 projects:', ranked.slice(0, 5).map(p => ({ 
          id: p.id, 
          title: p.title?.substring(0, 30) || 'Project', 
          score: Math.round(p.score * 100) + '%',
          whyShowing: p.whyShowing
        })));
      } catch (error) {
        console.error('❌ Ranking error:', error);
        // Fallback to simple ordering
        setRankedProjects(geoProjects.map(p => ({
          ...p,
          score: 0.5,
          scoring: {
            themeScore: 0.5,
            geoScore: 0.5,
            popularityScore: 0.5,
            explorationBonus: 0,
            finalScore: 0.5,
            primaryReason: 'default',
            secondaryReasons: [],
            confidenceLevel: 'low' as const
          },
          explanation: 'Default recommendation',
          whyShowing: 'Getting to know your preferences'
        })));
      }
    };
    
    rankProjectsAsync();
  }, [userProfile, geoProjects, rankingTrigger]);

  // State for user insights
  const [userInsights, setUserInsights] = useState<{
    topThemes: string[];
    preferredAreas: string[];
    explorationLevel: number;
  } | null>(null);

  // Fetch user insights when profile changes
  useEffect(() => {
    const fetchInsights = async () => {
      if (userProfile) {
        try {
          const insights = await recoService.getProfileInsights(userProfile);
          setUserInsights(insights);
        } catch (error) {
          console.error('Error fetching user insights:', error);
        }
      }
    };
    fetchInsights();
  }, [userProfile, gradedProjects.length]); // Update when user evaluates projects

  // Memoize stats object with real user data
  const stats = useMemo((): AppStats => {
    const topTheme = userInsights?.topThemes[0] || 'Getting to know you';
    const explorationPercentage = userInsights ? Math.round(userInsights.explorationLevel * 100) : 15;
    const themeConfidence = gradedProjects.length > 5 ? 80 : Math.min(gradedProjects.length * 15, 75);
    const locationConfidence = 100 - themeConfidence;

    return {
      projectsViewed: actions.length,
      projectsGraded: gradedProjects.length,
      diversityScore: explorationPercentage,
      locationWeight: locationConfidence,
      themeWeight: themeConfidence,
      totalProjects: geoProjects.length,
      closestDistrict: userInsights?.preferredAreas[0]?.substring(0, 20) || 'Learning preferences',
      closestTheme: topTheme
    };
  }, [actions.length, gradedProjects.length, geoProjects.length, userInsights]);


  // Handle feedback with new recommender service
  const handleFeedback = useCallback(async (projectId: number, feedback: FeedbackType) => {
    console.log('👍 User feedback:', { projectId, feedback, timestamp: Date.now() });
    logShowAction({ projectId, action: feedback, ts: Date.now() });
    
    if (!userProfile) return;
    
    const project = geoProjects.find(p => p.id === projectId);
    if (!project) return;
    
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
    console.log('🧠 Profile updated from feedback - triggering re-rank');
    
    // Trigger immediate re-ranking for instant feed update
    setRankingTrigger(prev => prev + 1);
  }, [logShowAction, userProfile, geoProjects]);

  // Handle evaluation with new recommender service
  const handleEvaluation = useCallback(async (projectId: number, evaluation: EvaluationType) => {
    console.log('⭐ User evaluated project:', { projectId, evaluation });
    
    if (!userProfile) return;
    
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
    console.log('🧠 Profile updated from evaluation - triggering re-rank');
    
    // Trigger immediate re-ranking for instant feed update
    setRankingTrigger(prev => prev + 1);
    
    // Add to graded projects for display
    setGradedProjects(prev => {
      const existing = prev.find(p => p.id === projectId);
      if (existing) {
        return prev.map(p => p.id === projectId ? { ...p, grade: evaluation } : p);
      } else {
        const rankedProject = rankedProjects.find(p => p.id === projectId);
        if (rankedProject) {
          return [...prev, { ...rankedProject, grade: evaluation } as GradedProject];
        }
        return prev;
      }
    });
  }, [userProfile, geoProjects, rankedProjects]);

  // Memoize ungraded projects and display logic
  const { displayProjects, ungradedProjectsCount, hasMoreProjects } = useMemo(() => {
    const gradedProjectIds = new Set(gradedProjects.map(p => p.id));
    
    // First filter out graded projects
    const ungraded = rankedProjects.filter(project => !gradedProjectIds.has(project.id));
    
    // Deduplicate by ID to prevent duplicate keys
    const uniqueUngraded = ungraded.filter((project, index, arr) => 
      arr.findIndex(p => p.id === project.id) === index
    );
    
    const displayed = uniqueUngraded.slice(0, displayLimit);
    const hasMore = displayLimit < uniqueUngraded.length;
    
    console.log('🔍 Filtering projects - Total:', rankedProjects.length, 'Graded:', gradedProjectIds.size, 'Ungraded:', ungraded.length, 'Unique:', uniqueUngraded.length, 'Displayed:', displayed.length);
    
    // Check for duplicates in displayed projects
    const displayedIds = displayed.map(p => p.id);
    const duplicateIds = displayedIds.filter((id, index) => displayedIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      console.error('🚨 Found duplicate project IDs in displayProjects:', duplicateIds);
    }
    
    return {
      displayProjects: displayed,
      ungradedProjectsCount: uniqueUngraded.length,
      hasMoreProjects: hasMore
    };
  }, [rankedProjects, displayLimit, gradedProjects]);

  // Load more projects handler
  const handleLoadMore = useCallback(() => {
    console.log('📈 Loading more projects - Current:', displayLimit, 'Total ungraded:', ungradedProjectsCount);
    setDisplayLimit(prev => Math.min(prev + 50, ungradedProjectsCount));
  }, [ungradedProjectsCount, displayLimit]);

  return (
    <div className="main-layout">
      <div className="left-content">
        <Header stats={stats} />
        
        <div className="projects-grid">
          {displayProjects.map((project, index) => (
            <ProjectCard
              key={`project-${project.id}-${index}`}
              project={project}
              onFeedback={handleFeedback}
              onEvaluation={handleEvaluation}
            />
          ))}
        </div>
        
        {hasMoreProjects && (
          <div className="load-more-container" style={{ textAlign: 'center', padding: '20px' }}>
            <button 
              onClick={handleLoadMore}
              className="load-more-button"
              style={{
                padding: '12px 24px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Load More Projects ({Math.min(displayLimit, ungradedProjectsCount)} of {ungradedProjectsCount} ungraded)
            </button>
          </div>
        )}
      </div>
      
      <GradedList projects={gradedProjects} />
    </div>
  );
}

export default App;