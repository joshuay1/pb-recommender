import React, { memo, useState } from 'react';
import type { GradedProject } from '../types/index';
import type { FeedbackType } from '../types/recommender';

interface GradedListProps {
  projects: GradedProject[];
  powerSystem: {
    negativeRatingsAvailable: number;
    progressToNextNegative: number;
    positiveRatingsCount: number;
  };
  onFeedback?: (projectId: number, feedback: FeedbackType) => void;
}

function GradedList({ projects, powerSystem, onFeedback }: GradedListProps) {
  const [isOpen, setIsOpen] = useState(true);

  const gradeEmojis = {
    'love': '❤️',
    'like': '👍',
    'maybe': '🤔',
    'not_convinced': '❌'
  } as const;

  return (
    <>
      {/* Floating show/hide toggle — always visible */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          padding: '12px 20px',
          borderRadius: '100px',
          background: isOpen ? 'var(--accent-tertiary)' : '#5b8e7d',
          color: '#fff',
          border: 'none',
          boxShadow: '0 8px 32px rgba(91, 142, 125, 0.35)',
          fontSize: '0.95rem',
          fontWeight: 700,
          fontFamily: 'Outfit, sans-serif',
          cursor: 'pointer',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.06)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <span style={{ fontSize: '1.1rem' }}>⭐️</span>
        <span>{isOpen ? 'Hide Ratings' : 'Your Ratings'}</span>
        {projects.length > 0 && (
          <span style={{
            background: 'rgba(255,255,255,0.25)',
            borderRadius: '100px',
            padding: '2px 10px',
            fontSize: '0.85rem',
            fontWeight: 800
          }}>{projects.length}</span>
        )}
      </button>

      {/* Inline sticky sidebar — only rendered when open */}
      {isOpen && (
        <div
          className="right-sidebar"
          style={{
            width: '420px',
            minWidth: '420px',
            position: 'sticky',
            top: '32px',
            maxHeight: 'calc(100vh - 64px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignSelf: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>Your Ratings</div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
            >
              ✕
            </button>
          </div>

          {/* Evaluations summary panel */}
          <div className="evaluations-panel" style={{
            background: 'var(--surface-color)',
            borderRadius: 'var(--card-radius)',
            padding: '24px',
            marginBottom: '16px',
            flexShrink: 0,
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>{projects.length} evaluated</div>

            {/* Rating Count Display */}
            <div style={{ marginTop: '16px' }}>
              {(() => {
                const nope = projects.filter(p => p.grade === 'not_convinced').length;
                const maybe = projects.filter(p => p.grade === 'maybe').length;
                const like = projects.filter(p => p.grade === 'like').length;
                const love = projects.filter(p => p.grade === 'love').length;

                const ratingBadge = (emoji: string, label: string, count: number, bg: string, textColor: string) => (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '12px 4px',
                    borderRadius: '16px',
                    background: bg,
                    minHeight: '70px',
                    border: `1px solid rgba(0,0,0,0.03)`
                  }}>
                    <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{emoji}</div>
                    <div style={{
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      color: textColor,
                      lineHeight: 1,
                      fontFamily: 'Outfit, sans-serif'
                    }}>{count}</div>
                  </div>
                );

                const totalRatings = nope + maybe + like + love;

                return (
                  <>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      {ratingBadge('❌', 'Terrible', nope, 'rgba(188, 75, 81, 0.1)', '#7a1f24')}
                      {ratingBadge('🤔', 'Neutral', maybe, 'var(--ui-surface)', 'var(--text-secondary)')}
                      {ratingBadge('👍', 'Good', like, 'rgba(91, 142, 125, 0.12)', '#2e5a4e')}
                      {ratingBadge('❤️', 'Love it', love, 'rgba(244, 226, 133, 0.3)', '#7a5f00')}
                    </div>

                    {/* Total Evaluations Display */}
                    <div style={{
                      background: 'var(--ui-surface)',
                      borderRadius: '16px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.95rem',
                        fontWeight: 600
                      }}>Total Evaluations</div>
                      <div style={{
                        color: 'var(--text-primary)',
                        fontSize: '1.2rem',
                        fontWeight: 800,
                        fontFamily: 'Outfit, sans-serif'
                      }}>{totalRatings}</div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Graded list - Fixed height, always the same size */}
          <div className="evaluations-panel graded-list-container" style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '16px',
            padding: '0'
          }}>
            <div style={{ padding: '20px 24px 12px 24px', fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
              Recent Activity
            </div>
            <div className="graded-list" style={{ padding: '12px 16px', overflowY: 'auto', height: '200px' }}>
              {projects.length === 0 ? (
                <div className="empty-state">
                  No projects evaluated yet. Rate projects to see them here.
                </div>
              ) : (
                [...projects].reverse().map(project => {
                  // Get background color based on rating
                  const getBackgroundColor = (grade: string) => {
                    switch (grade) {
                      case 'not_convinced': return 'rgba(188, 75, 81, 0.08)';
                      case 'maybe': return 'var(--ui-surface)';
                      case 'like': return 'rgba(91, 142, 125, 0.10)';
                      case 'love': return 'rgba(244, 226, 133, 0.25)';
                      default: return 'var(--ui-surface)';
                    }
                  };

                  const getBorderColor = (grade: string) => {
                    switch (grade) {
                      case 'not_convinced': return 'rgba(188, 75, 81, 0.2)';
                      case 'maybe': return 'var(--border-color)';
                      case 'like': return 'rgba(91, 142, 125, 0.25)';
                      case 'love': return 'rgba(244, 226, 133, 0.5)';
                      default: return 'var(--border-color)';
                    }
                  };

                  return (
                    <div
                      key={`graded-${project.id}`}
                      className="graded-item"
                      style={{
                        background: getBackgroundColor(project.grade),
                        border: `1px solid ${getBorderColor(project.grade)}`,
                        boxShadow: 'none',
                        padding: '10px 12px',
                        marginBottom: '6px',
                        borderRadius: '14px',
                        height: '64px',
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}
                    >
                      <div className="graded-thumb" style={{ background: 'transparent', width: 28, height: 28, fontSize: '1.1rem', flexShrink: 0 }}>
                        {gradeEmojis[project.grade as keyof typeof gradeEmojis]}
                      </div>

                      <div className="graded-info" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div className="graded-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {project.title}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {project.category} • {project.district}
                        </div>
                      </div>

                      <div className="graded-actions" style={{ flexShrink: 0 }}>
                        <button
                          className="cart-action-btn"
                          onClick={() => onFeedback && onFeedback(project.id, 'vibe')}
                          aria-label={`More this vibe for ${project.title}`}
                        >🌱</button>
                        <button
                          className="cart-action-btn"
                          onClick={() => onFeedback && onFeedback(project.id, 'around')}
                          aria-label={`More around here for ${project.title}`}
                        >📍</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Reject power panel - Fixed at bottom */}
          <div className="reject-power-panel" style={{
            padding: '24px'
          }}>
            <div style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              fontFamily: 'Outfit, sans-serif',
              color: 'var(--text-primary)',
              marginBottom: '16px'
            }}>
              Reject Power
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Available</span>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-secondary)', lineHeight: 1, fontFamily: 'Outfit, sans-serif' }}>{powerSystem.negativeRatingsAvailable}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{powerSystem.positiveRatingsCount}</span> positive ratings</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Progress to next reject</div>
              </div>
            </div>

            {/* Positive progress (5-segment ring) */}
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <svg className="five-ring" width="100" height="100" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  {/* center circle */}
                  <circle cx="60" cy="60" r="38" fill="var(--ui-surface)" />

                  {/* five segments around the ring */}
                  {Array.from({ length: 5 }).map((_, i) => {
                    // each segment is a path arc; calculate start/end angles
                    const anglePer = (360 / 5) * i - 90; // start angle
                    const anglePerEnd = anglePer + (360 / 5) - 8; // rounded gaps
                    const large = 0; // arc flag (always < 180)
                    const rOuter = 52;
                    const rInner = 44;

                    const toRad = (a: number) => (a * Math.PI) / 180;
                    const xOuter1 = 60 + rOuter * Math.cos(toRad(anglePer));
                    const yOuter1 = 60 + rOuter * Math.sin(toRad(anglePer));
                    const xOuter2 = 60 + rOuter * Math.cos(toRad(anglePerEnd));
                    const yOuter2 = 60 + rOuter * Math.sin(toRad(anglePerEnd));

                    const xInner2 = 60 + rInner * Math.cos(toRad(anglePerEnd));
                    const yInner2 = 60 + rInner * Math.sin(toRad(anglePerEnd));
                    const xInner1 = 60 + rInner * Math.cos(toRad(anglePer));
                    const yInner1 = 60 + rInner * Math.sin(toRad(anglePer));

                    const path = `M ${xOuter1} ${yOuter1} A ${rOuter} ${rOuter} 0 ${large} 1 ${xOuter2} ${yOuter2} L ${xInner2} ${yInner2} A ${rInner} ${rInner} 0 ${large} 0 ${xInner1} ${yInner1} Z`;

                    const filled = i < Math.max(0, Math.min(5, powerSystem.progressToNextNegative));
                    const color = filled ? (powerSystem.progressToNextNegative >= 4 ? 'var(--accent-secondary)' : 'var(--accent-quaternary)') : 'var(--ui-surface)';

                    return <path key={`seg-${i}`} d={path} fill={color} stroke="none" style={{ rx: 4, ry: 4 }} />;
                  })}

                  {/* center label */}
                  <text x="60" y="66" textAnchor="middle" fontSize="18" fill="var(--text-primary)" fontWeight={800} fontFamily="Outfit">{powerSystem.progressToNextNegative}/5</text>
                </svg>
              </div>
            </div>

            {/* Negative power bank */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch', justifyContent: 'center' }}>
                {Array.from({ length: 2 }).map((_, row) => (
                  <div key={`neg-row-${row}`} style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                    {Array.from({ length: 5 }).map((_, col) => {
                      const idx = row * 5 + col;
                      const filled = idx < Math.max(0, Math.min(10, powerSystem.negativeRatingsAvailable));
                      const pillColor = filled ? 'var(--accent-secondary)' : 'var(--ui-surface)';
                      return (
                        <div
                          key={`neg-pill-${idx}`}
                          style={{
                            flex: 1,
                            height: 8,
                            borderRadius: 10,
                            background: pillColor,
                            transition: 'background 0.3s ease',
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(GradedList);
