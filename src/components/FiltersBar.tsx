import React, { useEffect, useState } from 'react';

type FiltersBarProps = {
  collapsed: boolean;
  availableDistricts: string[];
  availableCategories: string[];
  selectedDistricts: string[];
  selectedCategories: string[];
  onChangeDistricts: (next: string[]) => void;
  onChangeCategories: (next: string[]) => void;
};

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  border: '1px solid var(--border-color)',
  background: 'var(--ui-surface)',
  padding: '8px 16px',
  borderRadius: 'var(--button-radius)',
  fontSize: '0.9rem',
  fontWeight: '700',
  fontFamily: 'Outfit, sans-serif',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: 'none'
};

export default function FiltersBar({
  collapsed,
  availableDistricts,
  availableCategories,
  selectedDistricts,
  selectedCategories,
  onChangeDistricts,
  onChangeCategories
}: FiltersBarProps) {
  const toggle = (list: string[], set: (n: string[]) => void, value: string) => {
    const s = new Set(list);
    if (s.has(value)) s.delete(value); else s.add(value);
    set(Array.from(s));
  };


  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', marginBottom: '12px' }}>Districts</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {availableDistricts.map((d) => {
                const active = selectedDistricts.includes(d);
                return (
                  <label key={d} style={{
                    ...chipStyle,
                    background: active ? 'var(--accent-tertiary)' : 'var(--surface-color)',
                    color: active ? '#0A3C39' : 'var(--text-primary)',
                    border: active ? '1px solid var(--accent-tertiary)' : '1px solid var(--border-color)',
                    boxShadow: active ? '0 4px 12px rgba(78, 205, 196, 0.2)' : 'none'
                  }}>
                    <input type="checkbox" checked={active} onChange={() => toggle(selectedDistricts, onChangeDistricts, d)} style={{ display: 'none' }} />
                    <span style={{ fontSize: '1.2rem', display: active ? 'inline-block' : 'none' }}>✓</span> {d}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', marginBottom: '12px' }}>Themes</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {availableCategories.map((c) => {
                const active = selectedCategories.includes(c);
                return (
                  <label key={c} style={{
                    ...chipStyle,
                    background: active ? 'var(--accent-secondary)' : 'var(--surface-color)',
                    color: active ? '#5C4A19' : 'var(--text-primary)',
                    border: active ? '1px solid var(--accent-secondary)' : '1px solid var(--border-color)',
                    boxShadow: active ? '0 4px 12px rgba(255, 209, 102, 0.2)' : 'none'
                  }}>
                    <input type="checkbox" checked={active} onChange={() => toggle(selectedCategories, onChangeCategories, c)} style={{ display: 'none' }} />
                    <span style={{ fontSize: '1.2rem', display: active ? 'inline-block' : 'none' }}>✓</span> {c}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
