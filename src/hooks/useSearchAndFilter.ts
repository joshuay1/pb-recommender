import { useState } from 'react';
import getEmbedding from '../services/embeddings';
import understandPrompt, { type PromptUnderstanding } from '../services/PromptService';
import { cosSim } from '../ranking/geometry';
import type { GeoProject, RankedProject, UserEvent } from '../types/recommender';
import { recoService } from '../services/RecoService';

export function useSearchAndFilter(
    geoProjects: GeoProject[],
    userProfile: string | null,
    availableDistricts: string[],
    setRankingTrigger: (v: any) => void,
    setManualTuningEnabled: (v: boolean) => void,
    setManualWeights: (v: any) => void
) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<RankedProject[] | null>(null);
    const [promptExplain, setPromptExplain] = useState<{ text: string; understood: PromptUnderstanding } | null>(null);
    const [showPromptExplain, setShowPromptExplain] = useState<boolean>(false);
    const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    const wrapProject = (p: any, score: number, matchedTokens: string[] = [], exact = false, searchText = ''): RankedProject => {
        const confidence = score >= 0.75 ? 'high' : (score >= 0.4 ? 'medium' : 'low');
        let primaryReason = exact ? `Exact phrase match: "${searchText}"`
            : (matchedTokens.length > 0 ? `Matched keywords: ${matchedTokens.slice(0, 4).join(', ')}`
                : (score > 0 ? `Semantic match (score ${Math.round(score * 100)}%)` : 'Popular / fallback result'));

        return {
            ...p,
            score: Math.max(0, Math.min(1, score || 0)),
            scoring: { themeScore: 0, geoScore: 0, popularityScore: 0, fairnessScore: 0, explorationBonus: 0, finalScore: Math.max(0, Math.min(1, score || 0)), primaryReason, secondaryReasons: [], confidenceLevel: confidence },
            explanation: primaryReason,
            whyShowing: `Search: ${primaryReason}`
        } as RankedProject;
    };

    const performSearch = async (searchText: string) => {
        if (!searchText) {
            setSearchResults(null);
            return;
        }
        const query = searchText.trim().toLowerCase();
        const qTokens = query.split(/\W+/).filter(Boolean);
        const SEMANTIC_ALPHA = 0.8;
        const MIN_SEMANTIC_SIM = 0.08;

        try {
            const qEmb = await getEmbedding(searchText);
            const scored = geoProjects.map(p => {
                const sem = cosSim(qEmb, p.embedding) || 0;
                const text = `${p.title} ${p.description}`.toLowerCase();
                const pTokens = Array.from(new Set(text.split(/\W+/).filter(Boolean)));
                const matchedTokens = qTokens.filter(t => pTokens.includes(t));
                const tokenScore = matchedTokens.length / Math.sqrt(Math.max(1, qTokens.length) * Math.max(1, pTokens.length));
                return { project: p, score: SEMANTIC_ALPHA * (sem >= MIN_SEMANTIC_SIM ? sem : 0) + (1 - SEMANTIC_ALPHA) * tokenScore, matchedTokens, exact: text.includes(query) };
            });
            scored.sort((a, b) => b.score - a.score);
            setSearchResults(scored.slice(0, 200).map(s => wrapProject(s.project, s.score, s.matchedTokens, s.exact, searchText)));
            return;
        } catch {
            // Fallback keyword search
            const scored = geoProjects.map(p => {
                const text = `${p.title} ${p.description}`.toLowerCase();
                const pTokens = Array.from(new Set(text.split(/\W+/).filter(Boolean)));
                const matchedTokens = qTokens.filter(t => pTokens.includes(t));
                return { project: p, score: (matchedTokens.length / Math.sqrt(Math.max(1, qTokens.length) * Math.max(1, pTokens.length))) + (text.includes(query) ? 0.6 : 0), matchedTokens, exact: text.includes(query) };
            });
            scored.sort((a, b) => Math.abs(b.score - a.score) > 1e-6 ? b.score - a.score : ((b.project as any).evaluationCount || 0) - ((a.project as any).evaluationCount || 0));
            setSearchResults(scored.slice(0, 200).map(s => wrapProject(s.project, s.score, s.matchedTokens, s.exact, searchText)));
        }
    };

    const handleSearchSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const text = searchQuery.trim();
        if (!text) {
            setSearchResults(null);
            return;
        }

        try {
            const understood = await understandPrompt(text);
            setPromptExplain({ text, understood });
            setShowPromptExplain(true);

            setManualTuningEnabled(true);
            const w = understood.weights || { content: 0.6, location: 0.2, freshness: 0.1, quality: 0.1 };
            setManualWeights(w);
            try { recoService.setManualWeights(w); } catch { }

            if (userProfile && understood.content_terms?.length) {
                try {
                    const emb = await getEmbedding(understood.content_terms.join(' '));
                    await recoService.update(userProfile, { userId: userProfile, projectId: -1, eventType: 'feedback', feedbackType: 'vibe', timestamp: Date.now(), projectEmbedding: emb, projectCategory: 'Prompt', projectDistrict: '' } as UserEvent);
                } catch { }
            }

            const availableSet = new Set(availableDistricts);
            const mapped = (understood.districts || []).filter(d => d && d.toLowerCase() !== 'city-wide').map(d => availableSet.has(d) ? d : (availableDistricts.find(x => x.toLowerCase() === d.toLowerCase()) || d));
            setSelectedDistricts(mapped);

            if (userProfile) {
                for (const dist of mapped) {
                    try { await recoService.update(userProfile, { userId: userProfile, projectId: -2, eventType: 'feedback', feedbackType: 'around', timestamp: Date.now(), projectEmbedding: new Array((geoProjects[0]?.embedding?.length || 5)).fill(0), projectCategory: 'Prompt', projectDistrict: dist } as UserEvent); } catch { }
                }
            }

            setSearchResults(null);
            setRankingTrigger((prev: number) => prev + 1);
        } catch {
            setPromptExplain(null);
            setShowPromptExplain(false);
            await performSearch(text);
        }
    };

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        promptExplain,
        showPromptExplain,
        setShowPromptExplain,
        selectedDistricts,
        setSelectedDistricts,
        selectedCategories,
        setSelectedCategories,
        handleSearchSubmit,
        performSearch
    };
}
