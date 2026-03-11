import React from 'react';

interface OnboardingFormProps {
    onboardData: { userId?: string; text?: string; districts?: string[]; categories?: string[]; openaiKey?: string };
    setOnboardData: React.Dispatch<React.SetStateAction<{ userId?: string; text?: string; districts?: string[]; categories?: string[]; openaiKey?: string }>>;
    handleOnboardSubmit: (e: React.FormEvent) => void;
    availableCategories: string[];
    availableDistricts: string[];
}

export const OnboardingForm: React.FC<OnboardingFormProps> = ({ onboardData, setOnboardData, handleOnboardSubmit, availableCategories, availableDistricts }) => {
    return (
        <div className="onboard-overlay" style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(216, 226, 235, 0.85)', /* Matches the darker cool gray #E8EDF2 */
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 400,
            padding: 'var(--space-md)'
        }}>
            <form onSubmit={handleOnboardSubmit} style={{
                background: 'var(--surface-color)',
                padding: 'var(--space-xl)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--card-radius)',
                width: '100%',
                maxWidth: '800px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 24px 64px rgba(45, 49, 66, 0.15)',
                animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <h2 style={{
                    marginTop: 0,
                    fontSize: '2.5rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    fontFamily: 'Outfit, sans-serif',
                    marginBottom: 'var(--space-xs)'
                }}>Welcome! 👋</h2>
                <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '1.1rem',
                    marginBottom: 'var(--space-lg)'
                }}>Let's personalize your experience. Tell us a bit about what you're looking for in Zürich.</p>

                <div style={{ marginBottom: 'var(--space-md)' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>OpenAI API Key (Required for Custom AI Prompts)</label>
                    <input
                        value={onboardData.openaiKey || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOnboardData((prev: any) => ({ ...prev, openaiKey: e.target.value }))}
                        placeholder="sk-..."
                        style={{ width: '100%', fontFamily: 'monospace' }}
                        type="password"
                    />
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        Your key is stored locally in your browser and sent securely only to the local backend.
                    </div>
                </div>

                <div style={{ marginBottom: 'var(--space-md)' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>Participant ID (optional)</label>
                    <input
                        value={onboardData.userId || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOnboardData((prev: any) => ({ ...prev, userId: e.target.value }))}
                        placeholder="Leave blank for auto-generated ID"
                        style={{ width: '100%' }}
                        type="text"
                    />
                </div>

                <div style={{ marginBottom: 'var(--space-lg)' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Describe your ideal city, and our AI will translate it into project filters ✨
                    </label>
                    <textarea
                        value={onboardData.text || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOnboardData((prev: any) => ({ ...prev, text: e.target.value }))}
                        placeholder="e.g. 'I want more green spaces for kids to play safely' or 'I love arts and culture events in the center'"
                        style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Select some themes</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {availableCategories.map((cat: string) => {
                                const isSel = onboardData.categories?.includes(cat);
                                return (
                                    <button
                                        key={cat} type="button"
                                        onClick={() => {
                                            const c = onboardData.categories || [];
                                            setOnboardData((prev: any) => ({ ...prev, categories: isSel ? c.filter((x: string) => x !== cat) : [...c, cat] }));
                                        }}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: 'var(--button-radius)',
                                            background: isSel ? 'var(--accent-secondary)' : 'var(--neutral-bg)',
                                            color: isSel ? '#5C4A19' : 'var(--text-secondary)',
                                            border: `2px solid ${isSel ? 'transparent' : 'var(--border-color)'}`,
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontFamily: 'Outfit, sans-serif',
                                            transition: 'all 0.2s',
                                            boxShadow: isSel ? '0 4px 12px rgba(255, 209, 102, 0.3)' : 'none'
                                        }}
                                    >
                                        {isSel && <span style={{ marginRight: '6px' }}>✓</span>}{cat}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Select preferred districts</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {availableDistricts.map((dist: string) => {
                                const isSel = onboardData.districts?.includes(dist);
                                return (
                                    <button
                                        key={dist} type="button"
                                        onClick={() => {
                                            const d = onboardData.districts || [];
                                            setOnboardData((prev: any) => ({ ...prev, districts: isSel ? d.filter((x: string) => x !== dist) : [...d, dist] }));
                                        }}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: 'var(--button-radius)',
                                            background: isSel ? 'var(--accent-tertiary)' : 'var(--neutral-bg)',
                                            color: isSel ? '#0A3C39' : 'var(--text-secondary)',
                                            border: `2px solid ${isSel ? 'transparent' : 'var(--border-color)'}`,
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontFamily: 'Outfit, sans-serif',
                                            transition: 'all 0.2s',
                                            boxShadow: isSel ? '0 4px 12px rgba(78, 205, 196, 0.3)' : 'none'
                                        }}
                                    >
                                        {isSel && <span style={{ marginRight: '6px' }}>✓</span>}{dist}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: 'var(--space-xl)', textAlign: 'center' }}>
                    <button type="submit" style={{
                        padding: '18px 48px',
                        background: 'var(--accent-primary)',
                        color: 'var(--accent-primary-text)',
                        border: 'none',
                        borderRadius: 'var(--button-radius)',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '1.25rem',
                        fontFamily: 'Outfit, sans-serif',
                        boxShadow: '0 8px 24px rgba(255, 107, 107, 0.4)',
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
                    >
                        Start Exploring ✨
                    </button>
                </div>
            </form>
        </div>
    );
};
