import React, { memo } from 'react';
import type { AppStats } from '../types/index.ts';

interface HeaderProps {
  stats: AppStats;
}

function Header({ stats }: HeaderProps) {
  console.log('🏠 Header render - Stats:', stats);

  return (
    <div className="header">
      <h1>Participatory Budgeting Zürich</h1>
      <p style={{ marginBottom: '16px', lineHeight: '1.6' }}>
        This AI-powered recommender learns your preferences in real-time. Each project is ranked using <strong>multi-interest themes</strong>, <strong>geographic proximity</strong>, and <strong>community popularity</strong>.
      </p>
      <div style={{ 
        background: '#e8f0e1', 
        padding: '20px', 
        borderRadius: '12px', 
        marginBottom: '24px',
        fontSize: '15px',
        lineHeight: '1.6',
        color: '#1c2613',
        border: '1px solid #8cb369'
      }}>
        <strong style={{ color: '#384c26', display: 'block', marginBottom: '12px', fontSize: '16px' }}>🧠 Behind the scenes:</strong>
        Every project has two key representations: a <strong>theme embedding</strong> (transformer-generated vectors capturing text and category) and a <strong>geographic location</strong>. Your profile maintains multiple <strong>interest vectors</strong> for different themes you engage with, plus <strong>geographic centroids</strong> for places you prefer.
        <br/><br/>
        <strong style={{ color: '#384c26' }}>🎯 Real-time learning:</strong><br/>
        • <strong>🌱🍂 Show Me More/Less</strong> immediately updates whichever part of your profile drove that recommendation<br/>
        • <strong>Positive feedback</strong> pulls your interest vectors closer to that project's embedding<br/>
        • <strong>Negative feedback</strong> pushes your preferences away from similar content<br/>
        • <strong>⚖️ Fairness scoring</strong> ensures under-rated projects get equal opportunity in Majority Judgment
      </div>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '0' }}>
        <strong>Learning about:</strong> {stats.closestTheme} | 
        <strong> Exploration level:</strong> {stats.diversityScore}% | 
        <strong> Total projects:</strong> {stats.totalProjects}
      </p>
      <div className="stats-bar">
        <div className="stat">
          <div className="stat-value">{stats.projectsGraded}</div>
          <div className="stat-label">Projects Evaluated</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats.themeWeight}%</div>
          <div className="stat-label">Content Focus</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats.locationWeight}%</div>
          <div className="stat-label">Location Focus</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats.diversityScore}%</div>
          <div className="stat-label">Discovery Rate</div>
        </div>
      </div>
    </div>
  );
}

export default memo(Header);