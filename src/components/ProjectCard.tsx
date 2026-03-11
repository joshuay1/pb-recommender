import React, { useState, useCallback, memo } from 'react';
import type { FeedbackType, EvaluationType } from '../types/recommender';
import type { RankedProject } from '../types/recommender';
import LocalLogger from '../services/LocalLogger';

interface ProjectCardProps {
  project: RankedProject;
  onFeedback: (projectId: number, feedback: FeedbackType) => void;
  onEvaluation: (projectId: number, evaluation: EvaluationType) => void;
  negativeRatingsAvailable: number;
  showExplanations?: boolean;
  userId?: string | null;
}

function ProjectCard({ project, onFeedback, onEvaluation, negativeRatingsAvailable, showExplanations = false }: ProjectCardProps) {
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationType | null>(null);
  const [feedbackActive, setFeedbackActive] = useState<FeedbackType | null>(null);

  const handleFeedback = useCallback((feedback: FeedbackType) => {
    setFeedbackActive(feedback);
    onFeedback(project.id, feedback);
    setTimeout(() => setFeedbackActive(null), 1000);
  }, [project.id, onFeedback]);

  const handleEvaluation = useCallback((evaluation: EvaluationType) => {
    setSelectedEvaluation(evaluation);
    setTimeout(() => {
      onEvaluation(project.id, evaluation);
    }, 200);
  }, [project.id, onEvaluation]);

  const handleMoreClick = useCallback(() => handleFeedback('vibe'), [handleFeedback]);
  const handleLessClick = useCallback(() => handleFeedback('around'), [handleFeedback]);

  return (
    <div className="project-card" data-project-id={project.id}>
      <div className="project-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="project-header">
          <h3 className="project-title">{project.title}</h3>
        </div>

        <div className="project-meta">
          <span className="district-badge">{project.district}</span>
          <span className="category-badge">{project.category}</span>
          {project.budget && (
            <span className="project-budget">💰 {project.budget}</span>
          )}
        </div>

        <div className="project-description">
          {project.description}
        </div>

        {/* ALWAYS SHOW TOP REASON */}
        <div style={{ margin: '0 24px 16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          💡 {(() => {
            const reason = project.scoring?.primaryReason;
            const fairness = project.scoring?.fairnessScore;
            if (reason === 'rating_equity' || (fairness && fairness > 0.7) || project.evaluationCount < 3) return `Needs more ratings — ${project.evaluationCount} so far.`;
            if (reason === 'content_match') return 'Matches your interests.';
            if (reason === 'location_preference') return 'Close to your preferred area.';
            if (reason) return reason.replace(/[__]/g, ' ');
            return project.whyShowing || 'Recommended for you';
          })()}
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div style={{
        padding: '16px 24px',
        background: 'var(--surface-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        borderTop: '1px solid var(--border-color)'
      }}>
        {/* ROW 1: Compact Grading Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '8px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          {([
            { key: 'not_convinced', label: 'Terrible', score: -1, requiresPower: true },
            { key: 'maybe', label: 'Neutral', score: 0, requiresPower: false },
            { key: 'like', label: 'Good', score: 1, requiresPower: false },
            { key: 'love', label: 'Love it', score: 2, requiresPower: false }
          ] as const).map(({ key, label, score, requiresPower }) => {
            const isDisabled = requiresPower && negativeRatingsAvailable <= 0;
            const isSelected = selectedEvaluation === key;

            let gradeClass = '';
            if (key === 'not_convinced') gradeClass = 'grade-not';
            if (key === 'maybe') gradeClass = 'grade-maybe';
            if (key === 'like') gradeClass = 'grade-like';
            if (key === 'love') gradeClass = 'grade-love';

            return (
              <button
                key={key}
                className={`grade-btn ${gradeClass} ${isSelected ? 'selected' : ''}`}
                onClick={() => !isDisabled && handleEvaluation(key)}
                disabled={isDisabled}
                style={{
                  flex: 1,
                  position: 'relative',
                  opacity: isDisabled ? 0.6 : 1,
                  boxShadow: isSelected ? 'none' : 'var(--shadow-sm)',
                  padding: '8px 4px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.85rem'
                }}
                title={isDisabled ? 'Need more positive ratings to unlock reject power' : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <span className="score-badge">{score}</span>
                  {label}
                  {requiresPower && isDisabled && (
                    <span style={{ fontSize: '0.8rem' }}>🔒</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ROW 2: Context actions and info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-tertiary)' }}>
            <span>👀 {project.viewCount} views</span>
            <span>⭐ {project.evaluationCount} ratings</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`cart-action-btn ${feedbackActive === 'vibe' ? 'active' : ''}`}
              onClick={handleMoreClick}
              aria-label="More this vibe"
              style={{
                background: feedbackActive === 'vibe' ? 'var(--accent-tertiary)' : 'var(--surface-color)',
                color: feedbackActive === 'vibe' ? '#fff' : 'var(--text-primary)',
                border: feedbackActive === 'vibe' ? '1px solid var(--accent-tertiary)' : '1px solid var(--border-color)',
                borderRadius: 'var(--button-radius)',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: 600,
                fontSize: '0.85rem',
                boxShadow: feedbackActive === 'vibe' ? '0 4px 12px rgba(91, 142, 125, 0.25)' : 'var(--shadow-sm)'
              }}
            >🌱 More this vibe</button>
            <button
              className={`cart-action-btn ${feedbackActive === 'around' ? 'active' : ''}`}
              onClick={handleLessClick}
              aria-label="More around here"
              style={{
                background: feedbackActive === 'around' ? 'var(--accent-warm)' : 'var(--surface-color)',
                color: feedbackActive === 'around' ? '#fff' : 'var(--text-primary)',
                border: feedbackActive === 'around' ? '1px solid var(--accent-warm)' : '1px solid var(--border-color)',
                borderRadius: 'var(--button-radius)',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: 600,
                fontSize: '0.85rem',
                boxShadow: feedbackActive === 'around' ? '0 4px 12px rgba(244, 162, 89, 0.25)' : 'var(--shadow-sm)'
              }}
            >📍 More around here</button>
          </div>
        </div>
      </div>

      {/* EXPLANATIONS (Only visible if enabled globally via Header) */}
      {showExplanations && project.scoring && (
        <div style={{ background: 'var(--neutral-bg)', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ padding: '16px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Score Breakdown
              </div>
              <div style={{ fontWeight: 800, color: 'var(--accent-secondary)', fontSize: '1rem', fontFamily: 'Outfit, sans-serif' }}>
                {Math.round((project.score ?? 0) * 100)}% Match
              </div>
            </div>
            <div style={{
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              background: 'var(--surface-color)',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontWeight: 500
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Theme:</span>
                <span style={{ fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>{Math.round(project.scoring.themeScore * 100)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Location:</span>
                <span style={{ fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>{Math.round(project.scoring.geoScore * 100)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Popularity:</span>
                <span style={{ fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>{Math.round(project.scoring.popularityScore * 100)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Novelty:</span>
                <span style={{ fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>{Math.round(project.scoring.explorationBonus * 100)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ProjectCard);
