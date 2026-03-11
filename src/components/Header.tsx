import React, { memo, useState } from 'react';
// Icons were removed per user preference; keep emojis
import type { AppStats } from '../types/index';

interface HeaderProps {
  stats: AppStats;
  useRealEmbeddings: boolean;
  onToggleEmbeddings: (useReal: boolean) => void;
  isLoadingDataset: boolean;
  fullDatasetCount: number | null;
  useGeoLocation: boolean;
  onToggleLocationMode: (useGeo: boolean) => void;
  showExplanations: boolean;
  onToggleExplanations: (show: boolean) => void;
  // Manual tuning controls
  manualTuningEnabled?: boolean;
  onToggleManualTuning?: (enabled: boolean) => void;
  weights?: { content: number; location: number; freshness: number; quality: number };
  onChangeWeights?: (w: { content: number; location: number; freshness: number; quality: number }) => void;
  onResetWeights?: () => void;
}

function Header({ stats, useRealEmbeddings, onToggleEmbeddings, isLoadingDataset, fullDatasetCount, useGeoLocation, onToggleLocationMode, showExplanations, onToggleExplanations, manualTuningEnabled = false, onToggleManualTuning, weights, onChangeWeights, onResetWeights }: HeaderProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const safe = (v: any, fallback = '—'): string => (v === null || v === undefined ? String(fallback) : String(v));
  // Normalize displayed percentages so they always sum to 100%
  const normDisplay = (() => {
    const t = Number((stats as any)?.themeWeight || 0);
    const l = Number((stats as any)?.locationWeight || 0);
    const f = Number((stats as any)?.freshnessWeight || 0);
    const q = Number((stats as any)?.qualityWeight || 0);
    const vals = [t, l, f, q];
    const sum = vals.reduce((s, x) => s + (isFinite(x) ? x : 0), 0);
    if (sum <= 0) return { t: 0, l: 0, f: 0, q: 0 };
    const raw = vals.map(v => (isFinite(v) ? (v / sum) * 100 : 0));
    const r = raw.map(v => Math.round(v));
    const diff = 100 - (r[0] + r[1] + r[2] + r[3]);
    // Adjust the largest component to fix rounding delta
    let idx = 0; let max = r[0];
    for (let i = 1; i < 4; i++) { if (r[i] > max) { max = r[i]; idx = i; } }
    r[idx] = r[idx] + diff;
    return { t: r[0], l: r[1], f: r[2], q: r[3] };
  })();

  return (
    <header className="header" style={{ paddingBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

        <div className="brand-wrap" style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
          <div className="brand-title">Wähli</div>
          <div className="brand-subtitle" style={{ marginTop: 0, fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>civic majority judgement ai platform</div>
        </div>
      </div>

      {/* subtle gradient stripe under the header title */}
      <div style={{ height: 6, width: '100%', marginTop: 12, borderRadius: 6, background: 'linear-gradient(90deg, rgba(129,178,154,0.12), rgba(242,204,143,0.12))' }} />

      <div style={{ marginTop: '16px', marginBottom: '20px' }}>
        <div style={{
          background: '#ffffff',
          padding: '16px',
          borderRadius: 'var(--card-radius)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', margin: 0, padding: 0 }}>
            {/* Step 1 */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ background: '#5b8e7d', color: '#fff', width: 28, height: 28, minWidth: 28, minHeight: 28, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>1</div>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>Explore & personalize</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.4 }}>Scan titles & descriptions to find projects you like. Use the nudge buttons to start personalizing your feed.</div>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ background: '#8cb369', color: '#fff', width: 28, height: 28, minWidth: 28, minHeight: 28, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>2</div>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>Nudge your feed</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.4 }}>
                  Tap <strong>🌱 More this vibe</strong> or <strong>📍 More around here</strong> to immediately steer recommendations.
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ background: '#f4a259', color: '#fff', width: 28, height: 28, minWidth: 28, minHeight: 28, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>3</div>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>Rate projects</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.4 }}>Pressing a rating submits your vote; votes affect long-term ranking. More ratings make the result fairer.</div>
              </div>
            </div>

            {/* Step 4 */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ background: '#bc4b51', color: '#fff', width: 28, height: 28, minWidth: 28, minHeight: 28, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>4</div>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>Reject power</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.4 }}>Every 5 positive votes earn one reject — a negative vote you can spend to lower a project's ranking.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Algorithm</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Content</div>
          <div style={{ fontSize: '13px', fontWeight: 800 }}>{normDisplay.t}%</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Location</div>
          <div style={{ fontSize: '13px', fontWeight: 800 }}>{normDisplay.l}%</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Freshness</div>
          <div style={{ fontSize: '13px', fontWeight: 800 }}>{normDisplay.f}%</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Popularity</div>
          <div style={{ fontSize: '13px', fontWeight: 800 }}>{normDisplay.q}%</div>
          {/* Discovery moved to technical details to avoid confusion in the main header */}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* embedding & location mode toggles removed (obsolete) */}

          {/* Manual tuning toggle */}
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'transparent', padding: '4px 6px', borderRadius: 'var(--card-radius)', border: 'none', boxShadow: 'none' }}>
            <input type="checkbox" checked={!!manualTuningEnabled} onChange={(e) => onToggleManualTuning && onToggleManualTuning(e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: '13px', fontWeight: '700', color: manualTuningEnabled ? '#0f766e' : '#6c757d' }}>Tune algorithm</span>
          </label>

          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'transparent', padding: '4px 6px', borderRadius: 'var(--card-radius)', border: 'none', boxShadow: 'none' }}>
            <input type="checkbox" checked={showExplanations} onChange={(e) => onToggleExplanations(e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: '13px', fontWeight: '700', color: showExplanations ? '#92400e' : '#6c757d' }}>Why am I seeing this?</span>
          </label>

          <button onClick={() => setShowTechnicalDetails(!showTechnicalDetails)} style={{ fontSize: '13px', fontWeight: '600', padding: '8px 10px', borderRadius: 'var(--card-radius)', border: 'none', boxShadow: 'none', background: '#fff' }}>{showTechnicalDetails ? 'Hide details' : 'How it learns'}</button>
        </div>
      </div>

      {/* Compact 2x2 tuning controls under Algorithm (not in details) */}
      {manualTuningEnabled && (
        <div style={{ marginTop: 10, padding: 12, background: '#ffffff', borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Tune weights</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(['content', 'location', 'freshness', 'quality'] as const).map((k) => {
              const label = k === 'content' ? 'Content' : k === 'location' ? 'Location' : k === 'freshness' ? 'Freshness' : 'Popularity';
              const value = Math.round(((weights as any)?.[k] || 0) * 100);
              return (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 40px', alignItems: 'center', gap: 8 }}>
                  <div style={{ color: '#475569', fontSize: 13 }}>{label}</div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={value}
                    onChange={(e) => {
                      if (!onChangeWeights || !weights) return;
                      const pct = Number(e.target.value) / 100;
                      const next = { ...weights, [k]: pct } as any;
                      onChangeWeights(next);
                    }}
                  />
                  <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{value}%</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#64748b', fontSize: 12 }}>
            <div>Display is normalized to 100%. Values are normalized when applied.</div>
            <button type="button" onClick={() => onResetWeights && onResetWeights()} style={{ border: '1px solid #e2e8f0', background: 'transparent', padding: '6px 10px', borderRadius: 6 }}>Reset</button>
          </div>
        </div>
      )}

      {showTechnicalDetails && (
        <div style={{ marginTop: '12px', padding: '12px', background: '#f1f5f9', border: 'none', borderRadius: 'var(--card-radius)', boxShadow: 'none', color: '#334155', fontSize: '13px' }}>
          <div style={{ marginBottom: '8px' }}><strong>How it learns</strong></div>

          <div style={{ lineHeight: '1.45' }}>
            <div style={{ marginBottom: '8px' }}>
              This system adapts to your actions. Short version:
            </div>

            <ul style={{ marginTop: 0, marginBottom: 8, paddingLeft: 18 }}>
              <li><strong>Tap "🌱 More this vibe"</strong> — the app strengthens content signals (topics and words) so you see similar projects sooner.</li>
              <li><strong>Tap "📍 More around here"</strong> — the app learns locations and districts you prefer and surfaces nearby projects.</li>
              <li><strong>Press a rating (Love it / Good / Neutral / Terrible)</strong> — ratings influence longer-term ranking; positive ratings unlock a small number of "rejects" you can spend to cast negative votes against projects you dislike (reduces their ranking).</li>
            </ul>

            <div style={{ marginBottom: 8 }}>
              What to expect:
            </div>

            <ul style={{ marginTop: 0, marginBottom: 8, paddingLeft: 18 }}>
              <li>Changes from "More" actions take effect immediately and steer the next recommendations.</li>
              <li>Ratings count more for long-term ranking but won't create a preference from a single click; repeat actions strengthen the signal.</li>
              <li>The system gradually "forgets" old signals if you stop interacting — your recent clicks matter most.</li>
            </ul>

            <div style={{ color: '#475569', fontSize: 12 }}>
              Technical note: preferences are tracked locally in your browser (not sent anywhere by default). Developers can enable collection or persist profiles to a server for experiments.
            </div>

            <div style={{ marginTop: 12, padding: 10, background: '#ffffff', borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)', fontFamily: 'monospace', fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Ranking formula (simplified)</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                Final score = w_content * similarity + w_feedback * userFeedback + w_location * (locationBonus / 0.3) + w_freshness * freshness + w_popularity * popularity
              </div>
              <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18, color: '#475569', fontSize: 13 }}>
                <li><strong>similarity</strong> — cosine similarity between your session vector and the project (0–1).</li>
                <li><strong>userFeedback</strong> — immediate nudge strength from recent 'vibe'/'around' clicks (0–1).</li>
                <li><strong>locationBonus</strong> — district/GPS proximity bonus (capped and normalized to 0–0.3; we divide by 0.3 to make it 0–1 in the formula).</li>
                <li><strong>freshness</strong> — shows fresher (less-seen) projects more (0–1).</li>
                <li><strong>popularity</strong> — gentle boost for projects with more grades/engagement (0–1).</li>
                <li><strong>w_*</strong> — active weights (Content, Location, Freshness, Popularity) are learned from your recent actions or fall back to default config.</li>
              </ul>
              <div style={{ marginTop: 8, color: '#334155', fontSize: 12 }}>
                Tip: the header shows the currently active weights (Content / Location / Freshness / Popularity). When you tap “More this vibe” the content weight increases; when you tap “More around here” the location weight increases.
              </div>

              <div style={{ marginTop: 10, padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid rgba(15,23,42,0.04)', fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>About "Discovery"</div>
                <div style={{ color: '#475569', marginBottom: 6 }}>
                  "Discovery" is a measure of how novel the current visible set of projects is — higher values mean the shown projects are, on average, less similar to your session vector (more exploratory).
                </div>
                <div style={{ color: '#334155', fontWeight: 700 }}>
                  Discovery: {safe(stats?.diversityScore, '0')}% — average score ≈ {String(100 - Number(stats?.diversityScore || 0))}%
                </div>
              </div>
            </div>

            {/* Tuning controls moved above under Algorithm */}
          </div>
        </div>
      )}
    </header>
  );
}

export default memo(Header);