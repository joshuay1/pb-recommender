import React, { useState, useMemo, useEffect, useCallback } from 'react';
import './App.css';
import Header from './components/Header';
import FiltersBar from './components/FiltersBar';
import ProjectCard from './components/ProjectCard';
import GradedList from './components/GradedList';
import { OnboardingForm } from './components/OnboardingForm';
import { useSessionActions } from './hooks/useSessionActions';
import { useProjectScoring } from './hooks/useProjectScoring';
import { useSearchAndFilter } from './hooks/useSearchAndFilter';
import { recoService } from './services/RecoService';
import LocalLogger from './services/LocalLogger';
import { calculateAdaptiveWeights } from './ranking/userVector';
import type { Project } from './types/index';
import type { GeoProject, RankedProject } from './types/recommender';

function App() {
  const [displayLimit, setDisplayLimit] = useState<number>(Infinity);
  const [userProfile, setUserProfile] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState<boolean>(false);
  const [onboardData, setOnboardData] = useState<{ userId?: string; text?: string; districts?: string[]; categories?: string[]; openaiKey?: string }>({ openaiKey: localStorage.getItem('pb_openai_key') || '' });

  const [useRealEmbeddings, setUseRealEmbeddings] = useState(true);
  const [useGeoLocation, setUseGeoLocation] = useState(false);
  const [showExplanations, setShowExplanations] = useState(false);
  const [fullProjectsData, setFullProjectsData] = useState<Project[] | null>(null);
  const [isLoadingFullDataset, setIsLoadingFullDataset] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pb_filters_collapsed');
      if (saved === '1') setFiltersCollapsed(true);
    } catch { }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('pb_filters_collapsed', filtersCollapsed ? '1' : '0');
    } catch { }
  }, [filtersCollapsed]);

  const envProjectsFile = (window as any).REACT_APP_PROJECTS_FILE as string | undefined;
  const defaultProjectsFile = envProjectsFile || (localStorage.getItem('projectsFile') as string) || 'projects.json';
  const [projectsFile] = useState<string>(defaultProjectsFile);

  const { actions, logShowAction } = useSessionActions('user');

  useEffect(() => {
    try { localStorage.setItem('projectsFile', projectsFile); } catch (e) { }
    setFullProjectsData(null);
  }, [projectsFile]);

  useEffect(() => {
    const loadFullDataset = async () => {
      if (!fullProjectsData && !isLoadingFullDataset) {
        setIsLoadingFullDataset(true);
        try {
          const fetchPath = projectsFile.startsWith('/') ? projectsFile : `/${projectsFile}`;
          const response = await fetch(fetchPath);
          if (response.ok) {
            const data = await response.json();
            setFullProjectsData(data);
          }
        } catch (error) {
          console.error('Error loading dataset:', error);
        } finally {
          setIsLoadingFullDataset(false);
        }
      }
    };
    loadFullDataset();
  }, [fullProjectsData, isLoadingFullDataset, projectsFile]);

  useEffect(() => {
    const initializeUser = async () => {
      if (!userProfile) {
        const stored = localStorage.getItem('pb_onboard_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          const userId = parsed.userId as string;
          if (userId) {
            await recoService.createProfile(userId);
            setUserProfile(userId);
            setOnboarded(true);
          }
        }
      }
    };
    initializeUser();
  }, [userProfile]);

  useEffect(() => {
    try { (window as any).__CURRENT_USER__ = userProfile || null; } catch (e) { }
  }, [userProfile]);

  const geoProjects = useMemo((): GeoProject[] => {
    return (fullProjectsData || []).map(project => ({
      ...project,
      location: { lat: 37.7749 + (Math.random() - 0.5) * 0.1, lng: -122.4194 + (Math.random() - 0.5) * 0.1 },
      viewCount: Math.floor(Math.random() * 200) + 10,
      evaluationCount: Math.floor(Math.random() * 50) + 1,
      averageRating: Math.random() * 2 + 3
    }));
  }, [fullProjectsData]);

  const availableDistricts = useMemo(() => Array.from(new Set((fullProjectsData || []).map(p => (p as any).district).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [fullProjectsData]);
  const availableCategories = useMemo(() => Array.from(new Set((fullProjectsData || []).map(p => (p as any).category).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [fullProjectsData]);

  const {
    rankedProjects,
    setRankedProjects,
    gradedProjects,
    rankingTrigger,
    setRankingTrigger,
    userInsights,
    setUserInsights,
    positiveRatingsCount,
    negativeRatingsAvailable,
    manualTuningEnabled,
    setManualTuningEnabled,
    manualWeights,
    setManualWeights,
    recentQuickFeedbackIds,
    handleFeedback,
    handleEvaluation
  } = useProjectScoring(userProfile, geoProjects, actions, logShowAction);

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    promptExplain,
    showPromptExplain,
    setShowPromptExplain,
    selectedDistricts,
    setSelectedDistricts,
    selectedCategories,
    setSelectedCategories,
    handleSearchSubmit
  } = useSearchAndFilter(geoProjects, userProfile, availableDistricts, setRankingTrigger, setManualTuningEnabled, setManualWeights);

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = onboardData.userId && onboardData.userId.trim() ? onboardData.userId.trim() : `participant-${Date.now()}`;
    await recoService.createProfile(userId);
    const cats = onboardData.categories || [];
    const dists = onboardData.districts || [];
    if (cats.length > 0 || dists.length > 0) {
      const mapped = (fullProjectsData || []).map(p => ({ ...p, viewCount: (p as any).viewCount || 0, evaluationCount: (p as any).evaluationCount || 0, averageRating: (p as any).averageRating || 3.5 }));
      await recoService.initializeProfile(userId, cats, dists, mapped as any);
    }
    if (onboardData.openaiKey && onboardData.openaiKey.trim()) {
      localStorage.setItem('pb_openai_key', onboardData.openaiKey.trim());
    }
    if (onboardData.openaiKey && onboardData.openaiKey.trim()) {
      localStorage.setItem('pb_openai_key', onboardData.openaiKey.trim());
    }
    localStorage.setItem('pb_onboard_user', JSON.stringify({ userId, text: onboardData.text || '', categories: cats, districts: dists }));
    LocalLogger.recordEvent({ userId, type: 'onboard', payload: { text: onboardData.text || '', categories: cats, districts: dists } });
    setUserProfile(userId);
    setOnboarded(true);
  };

  const handleToggleManualTuning = (enabled: boolean) => {
    setManualTuningEnabled(enabled);
    if (enabled) {
      const total = Math.max(1e-6, manualWeights.content + manualWeights.location + manualWeights.freshness + manualWeights.quality);
      recoService.setManualWeights({ content: manualWeights.content / total, location: manualWeights.location / total, freshness: manualWeights.freshness / total, quality: manualWeights.quality / total } as any);
    } else {
      recoService.setManualWeights(null);
    }
    setRankingTrigger(prev => prev + 1);
  };

  const handleChangeManualWeights = (next: { content: number; location: number; freshness: number; quality: number }) => {
    const total = Math.max(1e-6, next.content + next.location + next.freshness + next.quality);
    const normalized = { content: next.content / total, location: next.location / total, freshness: next.freshness / total, quality: next.quality / total };
    setManualWeights(normalized);
    if (manualTuningEnabled) {
      recoService.setManualWeights(normalized as any);
      setRankingTrigger(prev => prev + 1);
    }
  };

  const handleResetManualWeights = () => {
    const def = { content: 0.6, location: 0.2, freshness: 0.1, quality: 0.1 };
    setManualWeights(def);
    if (manualTuningEnabled) {
      recoService.setManualWeights(def);
      setRankingTrigger(prev => prev + 1);
    }
  };

  useEffect(() => {
    const rankProjectsAsync = async () => {
      if (!userProfile) return;
      try {
        const ranked = await recoService.rank(userProfile, geoProjects);
        setRankedProjects(ranked);
        const insights = await recoService.getProfileInsights(userProfile);
        setUserInsights(insights);
      } catch (error) {
        setRankedProjects(geoProjects.map(p => ({ ...p, score: 0.5, scoring: { themeScore: 0, geoScore: 0, popularityScore: 0, fairnessScore: 0, explorationBonus: 0, finalScore: 0, primaryReason: '', secondaryReasons: [], confidenceLevel: 'low' }, explanation: '', whyShowing: '' })));
      }
    };
    rankProjectsAsync();
  }, [userProfile, geoProjects, rankingTrigger, setRankedProjects, setUserInsights]);

  const rankedProjectsFiltered = useMemo(() => {
    if (selectedDistricts.length === 0 && selectedCategories.length === 0) return rankedProjects;
    const both: RankedProject[] = [];
    const either: RankedProject[] = [];
    const rest: RankedProject[] = [];
    for (const p of rankedProjects) {
      const matchDist = selectedDistricts.length > 0 && selectedDistricts.includes(p.district);
      const matchCat = selectedCategories.length > 0 && selectedCategories.includes(p.category);
      if (matchDist && matchCat) both.push(p);
      else if (matchDist || matchCat) either.push(p);
      else rest.push(p);
    }
    return [...both, ...either, ...rest];
  }, [rankedProjects, selectedDistricts, selectedCategories]);

  const { displayProjects, ungradedProjectsCount, hasMoreProjects } = useMemo(() => {
    const gradedProjectIds = new Set(gradedProjects.map(p => p.id));
    const ungraded = rankedProjectsFiltered.filter(project => !gradedProjectIds.has(project.id));
    const uniqueUngraded = ungraded.filter((project, index, arr) => arr.findIndex(p => p.id === project.id) === index);
    return { displayProjects: uniqueUngraded.slice(0, displayLimit), ungradedProjectsCount: uniqueUngraded.length, hasMoreProjects: displayLimit < uniqueUngraded.length };
  }, [rankedProjectsFiltered, displayLimit, gradedProjects]);

  const computeSessionStats = useCallback((projects: RankedProject[], excludeIds = new Set<number>()) => {
    const slice = projects.filter(p => !excludeIds.has(p.id)).slice(0, Math.min(projects.length, 50));
    const N = slice.length;
    let realThemePct = 0; let realLocationPct = 0;
    if (slice.length > 0) {
      const avgTheme = slice.reduce((s, p) => s + (p.scoring?.themeScore ?? 0), 0) / slice.length;
      const avgGeo = slice.reduce((s, p) => s + (p.scoring?.geoScore ?? 0), 0) / slice.length;
      const totalGeoTheme = avgTheme + avgGeo;
      if (totalGeoTheme > 0) { realThemePct = Math.round((avgTheme / totalGeoTheme) * 100); realLocationPct = Math.round((avgGeo / totalGeoTheme) * 100); }
    }
    const adaptiveWeights = calculateAdaptiveWeights(actions);
    const fallbackThemePct = Math.round((adaptiveWeights.contentWeight ?? 0) * 100);
    const fallbackLocationPct = Math.round((adaptiveWeights.locationWeight ?? 0) * 100);
    const fallbackFreshnessPct = Math.round((adaptiveWeights.freshness ?? 0) * 100);
    const fallbackQualityPct = Math.round((adaptiveWeights.quality ?? 0) * 100);
    const manualThemePct = Math.round((manualWeights.content || 0) * 100);
    const manualLocationPct = Math.round((manualWeights.location || 0) * 100);
    const manualFreshnessPct = Math.round((manualWeights.freshness || 0) * 100);
    const manualQualityPct = Math.round((manualWeights.quality || 0) * 100);

    let learningStatus = 'Getting to know you';
    if (userInsights?.topThemes && userInsights.topThemes.length > 0) learningStatus = userInsights.topThemes[0];
    else if (actions.length > 0) {
      const recentActions = actions.slice(-10);
      const vibeActions = recentActions.filter(a => a.action === 'vibe').length;
      const aroundActions = recentActions.filter(a => a.action === 'around').length;
      if (vibeActions > aroundActions && vibeActions > 0) learningStatus = 'Content preferences';
      else if (aroundActions > vibeActions && aroundActions > 0) learningStatus = 'Location preferences';
      else if (gradedProjects.length > 0) learningStatus = 'Your rating patterns';
      else if (actions.length > 5) learningStatus = 'Your interests';
    }

    if (N === 0) {
      return { projectsViewed: actions.length, projectsGraded: gradedProjects.length, diversityScore: 0, locationWeight: manualTuningEnabled ? manualLocationPct : (realLocationPct || fallbackLocationPct), themeWeight: manualTuningEnabled ? manualThemePct : (realThemePct || fallbackThemePct), freshnessWeight: manualTuningEnabled ? manualFreshnessPct : fallbackFreshnessPct, qualityWeight: manualTuningEnabled ? manualQualityPct : fallbackQualityPct, totalProjects: geoProjects.length, closestDistrict: userInsights?.preferredAreas[0]?.substring(0, 20) || 'Learning preferences', closestTheme: learningStatus };
    }
    const avgNovelty = slice.reduce((s, p) => s + (1 - (p.scoring?.finalScore ?? p.score ?? 0)), 0) / N;
    return { projectsViewed: actions.length, projectsGraded: gradedProjects.length, diversityScore: Math.round(Math.min(1, Math.max(0, avgNovelty)) * 100), locationWeight: manualTuningEnabled ? manualLocationPct : (realLocationPct || fallbackLocationPct), themeWeight: manualTuningEnabled ? manualThemePct : (realThemePct || fallbackThemePct), freshnessWeight: manualTuningEnabled ? manualFreshnessPct : fallbackFreshnessPct, qualityWeight: manualTuningEnabled ? manualQualityPct : fallbackQualityPct, totalProjects: geoProjects.length, closestDistrict: userInsights?.preferredAreas[0]?.substring(0, 20) || 'Learning preferences', closestTheme: learningStatus };
  }, [actions, gradedProjects.length, userInsights, geoProjects.length, manualTuningEnabled, manualWeights]);

  const stats = useMemo(() => computeSessionStats(displayProjects, recentQuickFeedbackIds), [displayProjects, recentQuickFeedbackIds, computeSessionStats]);

  const handleLoadMore = useCallback(() => setDisplayLimit(prev => Math.min(prev + 50, ungradedProjectsCount)), [ungradedProjectsCount, displayLimit]);

  return (
    <div className="main-layout">
      {!onboarded && <OnboardingForm onboardData={onboardData} setOnboardData={setOnboardData} handleOnboardSubmit={handleOnboardSubmit} availableCategories={availableCategories} availableDistricts={availableDistricts} />}
      <div className="left-content">
        <Header
          stats={stats}
          useRealEmbeddings={useRealEmbeddings}
          onToggleEmbeddings={setUseRealEmbeddings}
          isLoadingDataset={isLoadingFullDataset}
          fullDatasetCount={fullProjectsData?.length || null}
          useGeoLocation={useGeoLocation}
          onToggleLocationMode={setUseGeoLocation}
          showExplanations={showExplanations}
          onToggleExplanations={setShowExplanations}
          manualTuningEnabled={manualTuningEnabled}
          onToggleManualTuning={handleToggleManualTuning}
          weights={manualWeights}
          onChangeWeights={handleChangeManualWeights}
          onResetWeights={handleResetManualWeights}
        />
        <div className="sticky-top-bar" style={{
          position: 'sticky',
          top: 'var(--space-md)',
          zIndex: 100,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '24px',
          borderRadius: 'var(--card-radius)',
          boxShadow: '0 16px 40px rgba(45,49,66,0.06)',
          border: '1px solid var(--border-color)',
          marginBottom: 'var(--space-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tell us what you're looking for, in your own words, and our AI will translate it into filters..."
                style={{
                  flex: 1,
                  padding: '16px 24px',
                  fontSize: '1.1rem',
                  background: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--input-radius)',
                  boxShadow: 'none'
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '16px 32px',
                  borderRadius: 'var(--button-radius)',
                  background: 'var(--accent-primary)',
                  color: 'var(--accent-primary-text)',
                  fontFamily: 'Outfit, sans-serif',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Search
              </button>
            </form>
            <button
              type="button"
              onClick={() => setFiltersCollapsed(c => !c)}
              aria-label={filtersCollapsed ? 'Expand filters' : 'Collapse filters'}
              style={{
                border: '1px solid var(--border-color)',
                background: 'var(--surface-color)',
                padding: '16px 24px',
                borderRadius: 'var(--input-radius)',
                fontSize: '1.1rem',
                fontWeight: 700,
                fontFamily: 'Outfit, sans-serif',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {filtersCollapsed ? '▸ Filters' : '▾ Filters'}
            </button>
            {(selectedDistricts.length > 0 || selectedCategories.length > 0) && (
              <button
                type="button"
                onClick={() => { setSelectedDistricts([]); setSelectedCategories([]); }}
                style={{
                  background: 'var(--accent-secondary)',
                  color: 'white',
                  border: 'none',
                  padding: '16px 24px',
                  borderRadius: 'var(--input-radius)',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  fontFamily: 'Outfit, sans-serif',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Clear Filters
              </button>
            )}
            {promptExplain && (
              <button
                type="button"
                onClick={() => setShowPromptExplain(s => !s)}
                style={{
                  border: '1px solid var(--border-color)',
                  background: showPromptExplain ? 'var(--accent-quaternary)' : 'var(--surface-color)',
                  color: showPromptExplain ? '#fff' : 'var(--text-secondary)',
                  padding: '16px 20px',
                  borderRadius: 'var(--input-radius)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  fontFamily: 'Outfit, sans-serif',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                ✨ How was this interpreted?
              </button>
            )}
          </div>
          <FiltersBar
            collapsed={filtersCollapsed}
            availableDistricts={availableDistricts}
            availableCategories={availableCategories}
            selectedDistricts={selectedDistricts}
            selectedCategories={selectedCategories}
            onChangeDistricts={setSelectedDistricts}
            onChangeCategories={setSelectedCategories}
          />
        </div>
        {promptExplain && showPromptExplain && (
          <div style={{ marginBottom: '32px' }}>
            {(() => {
              const u = promptExplain.understood;
              const w = u.weights || {};
              // Find the dominant weight
              const dominant = Object.entries(w).sort(([, a], [, b]) => b - a)[0]?.[0];
              const dominantLabel: Record<string, string> = {
                content: 'topic relevance',
                location: 'location proximity',
                freshness: 'newer projects',
                quality: 'popularity'
              };
              const districts = (u.districts || []).filter(d => d !== 'City-wide');
              const citywide = (u.districts || []).includes('City-wide');
              return (
                <div style={{ marginTop: '16px', padding: '20px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Original request */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Your request</div>
                    <div style={{ color: 'var(--text-primary)', fontStyle: 'italic', fontSize: '1rem' }}>"{promptExplain.text}"</div>
                  </div>

                  <div style={{ height: 1, background: 'var(--border-color)' }} />

                  {/* Topics the AI found */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Topics the AI picked up on</div>
                    {u.content_terms && u.content_terms.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {u.content_terms.map((t, i) => (
                          <span key={`${t}-${i}`} style={{ padding: '6px 14px', borderRadius: 'var(--button-radius)', background: 'rgba(91, 142, 125, 0.15)', color: '#2e5a4e', fontSize: '0.9rem', fontWeight: 600 }}>{t}</span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No specific topics detected — showing a general mix.</div>
                    )}
                  </div>

                  {/* Location */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Location focus</div>
                    {districts.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {districts.map((d, i) => (
                          <span key={`${d}-${i}`} style={{ padding: '6px 14px', borderRadius: 'var(--button-radius)', background: 'rgba(244, 162, 89, 0.18)', color: '#7a3d00', fontSize: '0.9rem', fontWeight: 600 }}>📍 {d}</span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        {citywide ? 'No specific district detected — showing projects from all over Zürich.' : 'No location found in your request.'}
                      </div>
                    )}
                  </div>

                  {/* How results are ranked */}
                  {dominant && (
                    <div style={{ padding: '12px 16px', background: 'var(--neutral-bg)', borderRadius: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      🧠 <strong>The AI is prioritising</strong> <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{dominantLabel[dominant] || dominant}</span> when ranking your results.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        <div className="projects-grid">
          {(searchResults !== null ? searchResults : displayProjects).map((project, index) => (
            <ProjectCard key={`project-${project.id}-${index}`} project={project} onFeedback={handleFeedback} onEvaluation={handleEvaluation} negativeRatingsAvailable={negativeRatingsAvailable} showExplanations={showExplanations} />
          ))}
        </div>
        {searchResults === null && hasMoreProjects && (
          <div className="load-more-container" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
            <button onClick={handleLoadMore} className="load-more">Load More Projects ({Math.min(displayLimit, ungradedProjectsCount)} of {ungradedProjectsCount} ungraded)</button>
          </div>
        )}
      </div>
      <GradedList
        projects={gradedProjects}
        powerSystem={{ negativeRatingsAvailable, progressToNextNegative: positiveRatingsCount % 5, positiveRatingsCount }}
        onFeedback={handleFeedback}
      />
    </div>
  );
}

export default App;
