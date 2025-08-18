import React, { useState, useCallback, memo } from 'react';
import type { FeedbackType, EvaluationType } from '../types/recommender';
import type { RankedProject } from '../types/recommender';

interface ProjectCardProps {
  project: RankedProject;
  onFeedback: (projectId: number, feedback: FeedbackType) => void;
  onEvaluation: (projectId: number, evaluation: EvaluationType) => void;
}

function ProjectCard({ project, onFeedback, onEvaluation }: ProjectCardProps) {
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationType | null>(null);
  const [feedbackActive, setFeedbackActive] = useState<FeedbackType | null>(null);

  const handleFeedback = useCallback((feedback: FeedbackType) => {
    console.log('🎯 ProjectCard feedback:', { projectId: project.id, feedback, title: project.title });
    setFeedbackActive(feedback);
    onFeedback(project.id, feedback);
    setTimeout(() => setFeedbackActive(null), 1000);
  }, [project.id, onFeedback, project.title]);

  const handleEvaluation = useCallback((evaluation: EvaluationType) => {
    console.log('⭐ ProjectCard evaluation:', { projectId: project.id, evaluation, title: project.title });
    setSelectedEvaluation(evaluation);
    setTimeout(() => {
      onEvaluation(project.id, evaluation);
    }, 200);
  }, [project.id, onEvaluation, project.title]);

  const handleMoreClick = useCallback(() => handleFeedback('more'), [handleFeedback]);
  const handleLessClick = useCallback(() => handleFeedback('less'), [handleFeedback]);

  return (
    <div className="project-card" data-project-id={project.id} style={{
      background: '#ffffff',
      border: '1px solid rgba(0, 0, 0, 0.04)',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '20px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* TOP: Show Me More / Show Me Less - Primary Controls */}
      <div className="primary-controls" style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <button 
          className={`primary-btn show-more ${feedbackActive === 'more' ? 'active' : ''}`}
          onClick={handleMoreClick}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: feedbackActive === 'more' ? '#8cb369' : '#f8f9fa',
            color: feedbackActive === 'more' ? '#fff' : '#495057',
            border: feedbackActive === 'more' ? 'none' : '1px solid #dee2e6',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          🌱 Show Me More
        </button>
        
        <button 
          className={`primary-btn show-less ${feedbackActive === 'less' ? 'active' : ''}`}
          onClick={handleLessClick}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: feedbackActive === 'less' ? '#bc4b51' : '#f8f9fa',
            color: feedbackActive === 'less' ? '#fff' : '#495057',
            border: feedbackActive === 'less' ? 'none' : '1px solid #dee2e6',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          🍂 Show Me Less
        </button>
      </div>

      {/* PROJECT CONTENT */}
      <div className="project-content" style={{ flex: 1 }}>
        {/* Why am I seeing this? - Transparency */}
        <div className="transparency-section" style={{
          background: '#f8f9fa',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '20px',
          fontSize: '12px',
          color: '#6c757d',
          border: '1px solid #e9ecef'
        }}>
          <span style={{ fontWeight: '500', color: '#495057' }}>🔍 Why am I seeing this? </span>
          {project.whyShowing}
        </div>

        {/* Title and Score */}
        <div className="project-header" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <h3 className="project-title" style={{ 
              margin: 0, 
              fontSize: '22px', 
              fontWeight: '700', 
              color: '#0f172a',
              flex: 1,
              paddingRight: '16px',
              lineHeight: '1.3',
              letterSpacing: '-0.015em'
            }}>
              {project.title}
            </h3>
            <span className="match-score" style={{
              background: project.scoring.confidenceLevel === 'high' ? 
                '#8cb369' : 
                project.scoring.confidenceLevel === 'medium' ? 
                '#f4a259' : 
                '#5b8e7d',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {Math.round(project.score * 100)}%
            </span>
          </div>

          {/* Project Meta */}
          <div className="project-meta" style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <span className="district-badge" style={{
              background: '#e8f0e1',
              color: '#1c2613',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              border: '1px solid #8cb369'
            }}>📍 {project.district}</span>
            
            <span className="category-badge" style={{
              background: '#ddeae5',
              color: '#121d19',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              border: '1px solid #5b8e7d'
            }}>🏷️ {project.category}</span>
            
            <span className="budget-badge" style={{
              background: '#fdecdd',
              color: '#3e1f04',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              border: '1px solid #f4a259'
            }}>💰 {project.budget}</span>
          </div>
        </div>

        {/* Description */}
        <div className="project-description" style={{
          marginBottom: '20px',
          lineHeight: '1.6',
          color: '#475569',
          fontSize: '15px',
          fontWeight: '400'
        }}>
          {project.description}
        </div>

        {/* Advanced Scoring Breakdown (Debug Mode) */}
        {project.scoring && (
          <div className="advanced-scoring" style={{
            background: '#f8fafc',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '11px',
            fontFamily: 'ui-monospace, monospace',
            color: '#64748b',
            border: '1px solid #e2e8f0'
          }}>
            🎯 Theme:{Math.round(project.scoring.themeScore * 100)}% | 
            📍 Geo:{Math.round(project.scoring.geoScore * 100)}% | 
            ⭐ Pop:{Math.round(project.scoring.popularityScore * 100)}% | 
            ⚖️ Fair:{Math.round(project.scoring.fairnessScore * 100)}% | 
            🎲 Explore:{Math.round(project.scoring.explorationBonus * 100)}%
            <br/>
            🧠 Confidence: {project.scoring.confidenceLevel} | Primary: {project.scoring.primaryReason}
          </div>
        )}

        {/* Community Stats */}
        <div className="community-stats" style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#64748b'
        }}>
          <span>👀 {project.viewCount} views</span>
          <span>⭐ {project.evaluationCount} evaluations</span>
          <span>📊 {project.averageRating.toFixed(1)}/5.0 rating</span>
        </div>
      </div>

      {/* BOTTOM: Evaluations - Secondary Controls */}
      <div className="evaluation-section" style={{
        borderTop: '2px solid #8cb369',
        paddingTop: '20px',
        marginTop: 'auto'
      }}>
        <div className="evaluation-label" style={{
          fontSize: '16px',
          fontWeight: '700',
          marginBottom: '16px',
          color: '#1c2613',
          textAlign: 'center'
        }}>
          Rate this project:
        </div>
        
        <div className="rating-spectrum-container" style={{ position: 'relative' }}>
          {/* Spectrum line background */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '8px',
            right: '8px',
            height: '2px',
            background: 'linear-gradient(to right, #bc4b51, #6b7280, #f4a259, #8cb369)',
            borderRadius: '1px',
            zIndex: 0,
            transform: 'translateY(-50%)'
          }}></div>
          
          <div className="evaluation-options" style={{
            display: 'flex',
            gap: '2px',
            position: 'relative',
            zIndex: 1
          }}>
          {([
            { key: 'not_convinced', label: 'Not for me', bgColor: '#fdf2f2', activeColor: '#bc4b51', borderColor: '#e8b4b8', textColor: '#7c2d12' },
            { key: 'maybe', label: 'Neutral', bgColor: '#f7f3f0', activeColor: '#5b8e7d', borderColor: '#c2d5ce', textColor: '#2c5f50' },
            { key: 'like', label: 'Like it', bgColor: '#fef8ec', activeColor: '#f4a259', borderColor: '#f9d5a7', textColor: '#92400e' },
            { key: 'love', label: 'Love it', bgColor: '#f0f7ed', activeColor: '#8cb369', borderColor: '#bdd9a7', textColor: '#365314' }
          ] as const).map(({ key, label, bgColor, activeColor, borderColor, textColor }, index) => (
            <button
              key={key}
              className={`evaluation-btn ${selectedEvaluation === key ? 'selected' : ''}`}
              onClick={() => handleEvaluation(key)}
              style={{
                flex: 1,
                padding: '14px 8px',
                background: selectedEvaluation === key ? activeColor : bgColor,
                color: selectedEvaluation === key ? '#fff' : textColor,
                border: selectedEvaluation === key ? `2px solid ${activeColor}` : `2px solid ${borderColor}`,
                borderRadius: index === 0 ? '8px 4px 4px 8px' : 
                            index === 3 ? '4px 8px 8px 4px' : 
                            '4px',
                fontSize: '13px',
                fontWeight: selectedEvaluation === key ? '700' : '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: 0,
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {label}
            </button>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(ProjectCard);