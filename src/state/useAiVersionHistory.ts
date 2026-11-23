import { useEffect, useState } from 'react';
import type { AiVersionHistoryItem, CrossAnalysisFormula } from '../types';

const VERSION_HISTORY_KEY = 'empathy_ai_version_history';
const FORMULAS_KEY = 'empathy_cross_analysis_formulas';

/**
 * Thin React state hook managing AI Copilot version history and formula revert actions.
 */
export function useAiVersionHistory() {
  const [aiVersionHistory, setAiVersionHistory] = useState<AiVersionHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(VERSION_HISTORY_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load AI version history', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(aiVersionHistory));
    } catch (e) {
      console.warn('Could not save AI version history', e);
    }
  }, [aiVersionHistory]);

  const addFormulaFromAi = (formula: CrossAnalysisFormula) => {
    try {
      const saved = localStorage.getItem(FORMULAS_KEY);
      let current: CrossAnalysisFormula[] = saved ? JSON.parse(saved) : [];
      if (!current.some((f) => f.id === formula.id)) {
        current = [...current, formula];
        localStorage.setItem(FORMULAS_KEY, JSON.stringify(current));
        window.dispatchEvent(new Event('empathy_formulas_updated'));
      }

      const versionItem: AiVersionHistoryItem = {
        id: 'ver_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        timestamp: Date.now(),
        actionType: 'add_formula',
        targetId: formula.id,
        title: formula.name,
        description: `${formula.description} (${formula.code} | ${formula.analysisCodes})`,
        snapshot: formula,
        reverted: false,
      };

      setAiVersionHistory((prev) => [
        versionItem,
        ...prev.filter((v) => v.targetId !== formula.id),
      ]);
    } catch (e) {
      console.warn('Failed to save AI formula to localStorage', e);
    }
  };

  const removeStoredFormula = (formulaId: string) => {
    try {
      const saved = localStorage.getItem(FORMULAS_KEY);
      if (saved) {
        const current: CrossAnalysisFormula[] = JSON.parse(saved);
        const updated = current.filter((f) => f.id !== formulaId);
        localStorage.setItem(FORMULAS_KEY, JSON.stringify(updated));
        window.dispatchEvent(new Event('empathy_formulas_updated'));
      }
    } catch (e) {
      console.warn('Failed to remove formula on revert', e);
    }
  };

  const revertAiAction = (versionId: string) => {
    setAiVersionHistory((prev) =>
      prev.map((v) => {
        if (v.id === versionId) {
          if (v.targetId) {
            removeStoredFormula(v.targetId);
          }
          return { ...v, reverted: true, revertedAt: Date.now() };
        }
        return v;
      })
    );
  };

  const revertFormulaById = (formulaId: string) => {
    removeStoredFormula(formulaId);
    setAiVersionHistory((prev) =>
      prev.map((v) =>
        v.targetId === formulaId ? { ...v, reverted: true, revertedAt: Date.now() } : v
      )
    );
  };

  return {
    aiVersionHistory,
    activeVersionCount: aiVersionHistory.filter((v) => !v.reverted).length,
    addFormulaFromAi,
    revertAiAction,
    revertFormulaById,
  };
}
