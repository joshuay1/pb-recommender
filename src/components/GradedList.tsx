import React, { memo } from 'react';
import type { GradedProject } from '../types/index.ts';

interface GradedListProps {
  projects: GradedProject[];
}

function GradedList({ projects }: GradedListProps) {
  const gradeEmojis = {
    'love': '❤️',
    'like': '👍',
    'maybe': '🤔',
    'not_convinced': '❌'
  } as const;

  return (
    <div className="right-sidebar">
      <div className="graded-header">
        Your Evaluations 
        <span className="graded-count"> ({projects.length} projects)</span>
      </div>
      <div className="graded-list">
        {projects.length === 0 ? (
          <div className="empty-state">
            No projects evaluated yet. Rate projects to see them here.
          </div>
        ) : (
          projects.map(project => (
            <div key={`graded-${project.id}`} className="graded-item">
              <span className="graded-emoji">{gradeEmojis[project.grade as keyof typeof gradeEmojis]}</span>
              <span className="graded-title">{project.title}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default memo(GradedList);