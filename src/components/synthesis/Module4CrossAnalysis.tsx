import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Settings,
  History,
  Download,
  FileText,
  Printer,
  RotateCcw,
  Search,
  Edit3,
  X,
  Check,
  Eye,
  SlidersHorizontal,
  Sparkles,
  Quote,
  AlertCircle,
  Filter,
} from 'lucide-react';
import type {
  ADKOTMDimensionKey,
  CrossAnalysisFormula,
  GenericCrossAnalysisEvaluation,
  InterviewRecord,
  InterviewSession,
} from '../../types';
import {
  CrossAnalysisEngine,
  DEFAULT_CROSS_ANALYSIS_FORMULAS,
  NULL_SENTINEL,
  NULL_TIER_LABEL,
  resolveTierThresholds,
  type BarDistributionResult,
  type CrossAnalysisComputedRow,
  type CrossAnalysisSlicerState,
} from '../../domain/adkotm';
import { DecodeCrudModal } from '../review/DecodeCrudModal';
import { FormulaBuilderModal } from './FormulaBuilderModal';
import { AdkotmCategoryChartsGrid } from '../charts/AdkotmCategoryCharts';
import type { TraceableBreakdownItem } from '../../lib/decodeAnalytics';
import { exportDecodesToCSV, exportDecodesToDoc, openPrintablePDFReport } from '../../lib/exportUtils';
import { isAnalysisEligibleRecord } from '../../lib/recordEligibility';
import { isHumanVerifiedRecord } from '../../lib/adkotmCopilot';

interface Module4CrossAnalysisProps {
  records: InterviewRecord[];
  sessions: InterviewSession[];
  onUpdateRecord?: (updated: InterviewRecord) => void;
  onAddRecord?: (newRecord: InterviewRecord) => void;
  onDeleteRecord?: (id: string) => void;
  safePostJson: <T = any>(url: string, payload: any) => Promise<T>;
  onOpenAiAssistant?: () => void;
  onOpenVersionHistory?: () => void;
  onRevertFormula?: (formulaId: string) => void;
}

const INITIAL_SLICERS: CrossAnalysisSlicerState = {
  tier: 'ALL',
  FR: 'ALL',
  IL: 'ALL',
  AW: 'ALL',
  PP: 'ALL',
  hideNulls: false,
  search: '',
};

const TIER_PALETTE = [
  { bar: '#4FA896', bg: '#DDF3ED', text: '#1C5B4E', border: '#96D6C7' }, // High / Top tier (Mint Green)
  { bar: '#528BCA', bg: '#DCE8F7', text: '#234B78', border: '#A7C6EA' }, // Medium-High (Cornflower Blue)
  { bar: '#E5B822', bg: '#FDF3C7', text: '#735907', border: '#F7D147' }, // Medium (Sunburst Yellow)
  { bar: '#7C8CE0', bg: '#E9ECFB', text: '#35407A', border: '#C0C8F2' }, // Low (Soft Periwinkle)
];

const DIMENSION_BADGE_COLORS: Record<ADKOTMDimensionKey, { bg: string; text: string; border: string }> = {
  O: { bg: '#FDF3C7', text: '#735907', border: '#F7D147' },
  A: { bg: '#DDF3ED', text: '#1C5B4E', border: '#96D6C7' },
  K: { bg: '#DCE8F7', text: '#234B78', border: '#A7C6EA' },
  D: { bg: '#E9ECFB', text: '#35407A', border: '#C0C8F2' },
  T: { bg: '#E7ECE9', text: '#3A4A43', border: '#C9D2CE' },
  M: { bg: '#F2F5F3', text: '#4F5E57', border: '#D4DFD9' },
};

function loadSavedFormulas(): CrossAnalysisFormula[] {
  try {
    const saved = localStorage.getItem('empathy_cross_analysis_formulas');
    if (saved) {
      const parsed: CrossAnalysisFormula[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasSpending = parsed.some((f) => f.id === 'spending_power');
        return hasSpending ? parsed : [DEFAULT_CROSS_ANALYSIS_FORMULAS[0], ...parsed];
      }
    }
  } catch (e) {
    console.warn('Could not load cached formulas', e);
  }
  return DEFAULT_CROSS_ANALYSIS_FORMULAS;
}

interface HorizontalBarCardProps {
  title: string;
  subtitle: string;
  distribution: BarDistributionResult;
  activeFilterKey: string;
  onSelectBar: (valueKey: string) => void;
  defaultBarColor?: string;
  headerRight?: React.ReactNode;
}

const HorizontalBarCard: React.FC<HorizontalBarCardProps> = ({
  title,
  subtitle,
  distribution,
  activeFilterKey,
  onSelectBar,
  defaultBarColor = '#528BCA',
  headerRight,
}) => {
  const maxCount = Math.max(1, ...distribution.items.map((i) => i.count));

  return (
    <div className="bg-[#FDFCF8] rounded-3xl border border-[#D4DFD9] p-5 flex flex-col gap-3.5 shadow-2xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-heading text-sm font-bold text-[#1B2420] leading-snug">{title}</h4>
          <p className="text-xs text-[#4F5E57] mt-0.5 leading-snug">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerRight}
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-[#F2F5F3] text-[#4F5E57] border border-[#E0E7E3]">
            {distribution.statedCount}/{distribution.totalCount} stated
          </span>
        </div>
      </div>

      {distribution.items.length === 0 ? (
        <div className="py-6 text-center text-xs text-[#4F5E57] bg-[#F2F5F3]/60 rounded-2xl border border-dashed border-[#D4DFD9]">
          No matching records in current slicer selection.
        </div>
      ) : (
        <div className="space-y-2.5">
          {distribution.items.map((item) => {
            const isSelected = activeFilterKey === item.valueKey;
            const barWidth = Math.max(item.count > 0 ? 6 : 0, Math.round((item.count / maxCount) * 100));
            const barColor = item.isNull ? '#C9D2CE' : item.color || defaultBarColor;

            return (
              <button
                key={item.valueKey}
                type="button"
                onClick={() => onSelectBar(isSelected ? 'ALL' : item.valueKey)}
                title={`Click to ${isSelected ? 'clear filter' : `filter by ${item.label}`}`}
                className={`w-full text-left p-2.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#DCE8F7]/65 border-[#528BCA] ring-1 ring-[#528BCA]/30'
                    : 'bg-[#F2F5F3]/55 border-transparent hover:bg-[#F2F5F3] hover:border-[#D4DFD9]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span
                    className={`text-xs font-semibold leading-snug break-words ${
                      item.isNull ? 'text-[#5C6B64] italic' : 'text-[#1B2420]'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="text-xs font-mono font-semibold text-[#1B2420] shrink-0 whitespace-nowrap">
                    {item.count}{' '}
                    <span className="text-[#4F5E57] font-normal">
                      {item.isNull ? `(${item.totalPct}% of all)` : `(${item.validPct}% valid)`}
                    </span>
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#E7ECE9] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const Module4CrossAnalysis: React.FC<Module4CrossAnalysisProps> = ({
  records,
  sessions,
  onUpdateRecord,
  onAddRecord,
  onDeleteRecord,
  onOpenAiAssistant,
  onOpenVersionHistory,
}) => {
  // Formula CRUD State (persisted & synced via localStorage)
  const [formulas, setFormulas] = useState<CrossAnalysisFormula[]>(loadSavedFormulas);
  const [activeFormulaId, setActiveFormulaId] = useState<string>('spending_power');
  const activeFormula =
    formulas.find((f) => f.id === activeFormulaId) || formulas[0] || DEFAULT_CROSS_ANALYSIS_FORMULAS[0];

  // Re-sync formulas when updated from AI Copilot or Version Control Modal
  useEffect(() => {
    const handleSync = () => setFormulas(loadSavedFormulas());
    window.addEventListener('empathy_formulas_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('empathy_formulas_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Modals & Drawers
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);
  const [formulaToEdit, setFormulaToEdit] = useState<CrossAnalysisFormula | null>(null);
  const [isCrudModalOpen, setIsCrudModalOpen] = useState(false);
  const [crudRecordToEdit, setCrudRecordToEdit] = useState<InterviewRecord | null>(null);
  const [evidenceRowId, setEvidenceRowId] = useState<string | null>(null);

  // Manual Tier Override Modal
  const [overrideRow, setOverrideRow] = useState<CrossAnalysisComputedRow | null>(null);
  const [overrideTier, setOverrideTier] = useState<string>('');
  const [overrideJustification, setOverrideJustification] = useState<string>('');

  // Interactive Slicers & Formula Driver Scope Toggle
  const [slicers, setSlicers] = useState<CrossAnalysisSlicerState>(INITIAL_SLICERS);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const visibleDimensions = useMemo<readonly ADKOTMDimensionKey[]>(
    () =>
      showAllCategories
        ? (['O', 'A', 'K', 'D', 'T', 'M'] as const)
        : activeFormula.dimensions,
    [showAllCategories, activeFormula.dimensions]
  );

  // Strictly Human Verified records feed Step 4 Cross-Analysis
  const allAnalysisEligible = useMemo(
    () => records.filter((r) => (r.transcript || r.cleanedTranscript) && isAnalysisEligibleRecord(r)),
    [records]
  );
  const eligibleRecords = useMemo(
    () => allAnalysisEligible.filter(isHumanVerifiedRecord),
    [allAnalysisEligible]
  );
  const pendingVerificationCount = allAnalysisEligible.length - eligibleRecords.length;

  // Deterministic Cross-Analysis Engine
  const engine = useMemo(() => new CrossAnalysisEngine(sessions), [sessions]);

  // All computed rows for active formula
  const allComputedRows = useMemo(
    () => engine.evaluateAll(eligibleRecords, activeFormula),
    [engine, eligibleRecords, activeFormula]
  );

  // Filtered rows via slicer bar
  const filteredRows = useMemo(
    () => engine.filterRows(allComputedRows, slicers),
    [engine, allComputedRows, slicers]
  );

  // Selected row for Source Evidence Drawer
  const activeEvidenceRow = useMemo(
    () => (evidenceRowId ? allComputedRows.find((r) => r.record.id === evidenceRowId) || null : null),
    [allComputedRows, evidenceRowId]
  );

  // Unique slicer options derived from verified records
  const slicerOptions = useMemo(() => {
    const collect = (fn: (r: CrossAnalysisComputedRow) => string | null) => {
      const vals = new Set<string>();
      let hasNull = false;
      for (const r of allComputedRows) {
        const v = fn(r);
        if (v === null) hasNull = true;
        else vals.add(v);
      }
      return { values: Array.from(vals).sort(), hasNull };
    };
    return {
      FR: collect((r) => r.signals.FR),
      IL: collect((r) => r.signals.IL),
      AW: collect((r) => r.signals.AW),
      PP: collect((r) => r.signals.PP),
    };
  }, [allComputedRows]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (slicers.tier !== 'ALL') n++;
    if (slicers.FR !== 'ALL') n++;
    if (slicers.IL !== 'ALL') n++;
    if (slicers.AW !== 'ALL') n++;
    if (slicers.PP !== 'ALL') n++;
    if (slicers.hideNulls) n++;
    if (slicers.search.trim()) n++;
    return n;
  }, [slicers]);

  // Tier Color Map & Thresholds
  const tierThresholds = useMemo(() => resolveTierThresholds(activeFormula), [activeFormula]);
  const tierColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    activeFormula.outputTiers.forEach((tier, idx) => {
      map[tier] = TIER_PALETTE[idx % TIER_PALETTE.length].bar;
    });
    return map;
  }, [activeFormula]);

  const getTierStyle = (tier: string | null) => {
    if (!tier) {
      return { bg: '#E7ECE9', text: '#4F5E57', border: '#C9D2CE', bar: '#C9D2CE' };
    }
    const idx = activeFormula.outputTiers.indexOf(tier);
    return TIER_PALETTE[(idx >= 0 ? idx : 0) % TIER_PALETTE.length];
  };

  // KPI counts (reflects non-tier slicers or full filtered set cleanly)
  const kpiBaseRows = useMemo(
    () => engine.filterRows(allComputedRows, { ...slicers, tier: 'ALL' }),
    [engine, allComputedRows, slicers]
  );

  // Horizontal Bar Distributions (computed from filteredRows so every slicer cross-filters charts)
  const tierDistribution = useMemo(
    () =>
      engine.computeDistribution(filteredRows, (r) => r.tier, {
        hideNulls: slicers.hideNulls,
        nullLabel: NULL_TIER_LABEL,
        orderedKeys: activeFormula.outputTiers,
        colorMap: tierColorMap,
      }),
    [engine, filteredRows, slicers.hideNulls, activeFormula.outputTiers, tierColorMap]
  );

  // Filtered InterviewRecords fed live into the shared 6-card ADKOTM Category Charts suite
  const filteredInterviewRecords = useMemo(
    () => filteredRows.map((r) => r.record),
    [filteredRows]
  );

  const handleSelectAdkotmChartItem = (item: TraceableBreakdownItem) => {
    const valKey = item.key === '__null__' ? NULL_SENTINEL : item.label;
    if (item.dimension === 'D' && item.fieldKey === 'familyRole') {
      setSlicers((prev) => ({ ...prev, FR: prev.FR === valKey ? 'ALL' : valKey }));
      return;
    }
    if (item.dimension === 'M') {
      setSlicers((prev) => ({ ...prev, IL: prev.IL === valKey ? 'ALL' : valKey }));
      return;
    }
    if (item.dimension === 'K' && item.fieldKey === 'awarenessLevel') {
      setSlicers((prev) => ({ ...prev, AW: prev.AW === valKey ? 'ALL' : valKey }));
      return;
    }
    if (item.dimension === 'O' && item.fieldKey === 'productsPurchased') {
      setSlicers((prev) => ({ ...prev, PP: prev.PP === valKey ? 'ALL' : valKey }));
      return;
    }
    if (item.key !== '__null__') {
      setSlicers((prev) => ({
        ...prev,
        search: prev.search === item.label ? '' : item.label,
      }));
    }
  };

  // Persist formula changes & broadcast update event
  const persistFormulas = (next: CrossAnalysisFormula[]) => {
    try {
      localStorage.setItem('empathy_cross_analysis_formulas', JSON.stringify(next));
      window.dispatchEvent(new Event('empathy_formulas_updated'));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  };

  const handleSaveFormula = (saved: CrossAnalysisFormula) => {
    setFormulas((prev) => {
      const idx = prev.findIndex((f) => f.id === saved.id);
      const next = idx !== -1 ? prev.map((f, i) => (i === idx ? saved : f)) : [...prev, saved];
      persistFormulas(next);
      return next;
    });
    setActiveFormulaId(saved.id);
    setSlicers((prev) => ({ ...prev, tier: 'ALL' }));
  };

  const handleDeleteFormula = (formulaId: string) => {
    if (formulaId === 'spending_power') return;
    const target = formulas.find((f) => f.id === formulaId);
    if (!confirm(`Delete formula "${target?.name || formulaId}"?`)) return;

    setFormulas((prev) => {
      const next = prev.filter((f) => f.id !== formulaId);
      persistFormulas(next);
      return next;
    });
    if (activeFormulaId === formulaId) {
      setActiveFormulaId('spending_power');
      setSlicers((prev) => ({ ...prev, tier: 'ALL' }));
    }
  };

  // Manual Tier Override Handlers
  const handleOpenOverride = (row: CrossAnalysisComputedRow) => {
    setOverrideRow(row);
    setOverrideTier(row.tier || NULL_SENTINEL);
    setOverrideJustification(row.evaluation.justification || row.breakdownText);
  };

  const handleSaveOverride = (resetToFormula = false) => {
    if (!overrideRow || !onUpdateRecord) {
      setOverrideRow(null);
      return;
    }

    const matching = overrideRow.record;
    const nextEval: GenericCrossAnalysisEvaluation = resetToFormula
      ? {
          ...overrideRow.evaluation,
          isManualOverride: false,
          evaluatedAt: new Date().toISOString(),
        }
      : {
          ...overrideRow.evaluation,
          tier: overrideTier === NULL_SENTINEL ? null : overrideTier,
          justification: overrideJustification.trim() || overrideRow.breakdownText,
          isManualOverride: true,
          evaluatedAt: new Date().toISOString(),
        };

    const updatedRec: InterviewRecord = {
      ...matching,
      crossAnalysisEvaluations: {
        ...(matching.crossAnalysisEvaluations || {}),
        [activeFormula.id]: nextEval,
      },
    };

    if (activeFormula.id === 'spending_power') {
      const recomputedRow = engine.evaluateRecord(updatedRec, activeFormula);
      updatedRec.spendingPower = engine.toSpendingPowerAnalysis(recomputedRow);
    }

    onUpdateRecord(updatedRec);
    setOverrideRow(null);
  };

  // Build export-ready records synced with current formula scores/tiers
  const getExportSyncedRecords = (): InterviewRecord[] => {
    const spendingFormula =
      formulas.find((f) => f.id === 'spending_power') || DEFAULT_CROSS_ANALYSIS_FORMULAS[0];

    return eligibleRecords.map((rec) => {
      const activeRow = allComputedRows.find((r) => r.record.id === rec.id);
      const spRow =
        activeFormula.id === 'spending_power' && activeRow
          ? activeRow
          : engine.evaluateRecord(rec, spendingFormula);

      return {
        ...rec,
        spendingPower: engine.toSpendingPowerAnalysis(spRow),
        crossAnalysisEvaluations: {
          ...(rec.crossAnalysisEvaluations || {}),
          ...(activeRow ? { [activeFormula.id]: activeRow.evaluation } : {}),
        },
      };
    });
  };

  const handleExportCSV = () =>
    exportDecodesToCSV(getExportSyncedRecords(), { dimensions: visibleDimensions });
  const handleExportDoc = () =>
    exportDecodesToDoc(getExportSyncedRecords(), { dimensions: visibleDimensions });
  const handleExportPDF = () =>
    openPrintablePDFReport(getExportSyncedRecords(), { dimensions: visibleDimensions });

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Header + Formula CRUD Bar */}
      <div className="bg-[#FDFCF8] rounded-3xl border border-[#D4DFD9] p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-heading text-xl font-bold text-[#1B2420] tracking-[-0.02em]">
                Step 4 · Cross-Analysis &amp; Decision Matrix
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#DDF3ED] text-[#1C5B4E] border border-[#96D6C7]">
                {eligibleRecords.length} Verified
              </span>
              {pendingVerificationCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FDF3C7] text-[#735907] border border-[#F7D147]">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {pendingVerificationCount} pending Step 3 verification
                </span>
              )}
            </div>
            <p className="text-sm text-[#4F5E57] mt-1">
              {activeFormula.description}
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setFormulaToEdit(null);
                setIsFormulaModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white cursor-pointer transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Formula
            </button>
            <button
              type="button"
              onClick={() => {
                setFormulaToEdit(activeFormula);
                setIsFormulaModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-[#F2F5F3] hover:bg-[#DCE8F7] text-[#1B2420] border border-[#D4DFD9] cursor-pointer transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-[#528BCA]" />
              Configure
            </button>
            {activeFormula.id !== 'spending_power' && (
              <button
                type="button"
                onClick={() => handleDeleteFormula(activeFormula.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-[#FDFCF8] hover:bg-[#FDECEC] text-[#B93838] border border-[#EBC4C4] cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
            {onOpenVersionHistory && (
              <button
                type="button"
                onClick={onOpenVersionHistory}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-[#F2F5F3] hover:bg-[#E7ECE9] text-[#4F5E57] border border-[#D4DFD9] cursor-pointer transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                Revert History
              </button>
            )}
            {onOpenAiAssistant && (
              <button
                type="button"
                onClick={onOpenAiAssistant}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-[#DDF3ED] hover:bg-[#C6EBE0] text-[#1C5B4E] border border-[#96D6C7] cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Copilot
              </button>
            )}
            <div className="h-5 w-px bg-[#D4DFD9] mx-0.5 hidden sm:block" />
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={eligibleRecords.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-[#FDFCF8] hover:bg-[#F2F5F3] text-[#1B2420] border border-[#D4DFD9] disabled:opacity-45 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#4FA896]" />
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportDoc}
              disabled={eligibleRecords.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-[#FDFCF8] hover:bg-[#F2F5F3] text-[#1B2420] border border-[#D4DFD9] disabled:opacity-45 cursor-pointer transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-[#528BCA]" />
              Word
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={eligibleRecords.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-[#FDFCF8] hover:bg-[#F2F5F3] text-[#1B2420] border border-[#D4DFD9] disabled:opacity-45 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-[#E5B822]" />
              PDF
            </button>
          </div>
        </div>

        {/* Formula Switcher Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#E0E7E3]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#4F5E57] mr-1">
            Active Model:
          </span>
          {formulas.map((f) => {
            const isActive = f.id === activeFormula.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setActiveFormulaId(f.id);
                  setSlicers((prev) => ({ ...prev, tier: 'ALL' }));
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[#528BCA] text-white border-[#528BCA] shadow-2xs'
                    : 'bg-[#F2F5F3] text-[#1B2420] border-[#D4DFD9] hover:bg-[#DCE8F7]/60 hover:border-[#528BCA]/40'
                }`}
              >
                <span>{f.name}</span>
                <span
                  className={`font-mono text-[11px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[#FDFCF8] text-[#4F5E57]'
                  }`}
                >
                  {f.code}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {eligibleRecords.length === 0 ? (
        <div className="bg-[#FDFCF8] rounded-3xl border border-[#D4DFD9] p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F2F5F3] border border-[#D4DFD9] mx-auto flex items-center justify-center text-[#528BCA]">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <h3 className="font-heading text-base font-bold text-[#1B2420]">
            No Verified Interviews Ready for Cross-Analysis
          </h3>
          <p className="text-sm text-[#4F5E57] max-w-md mx-auto">
            Verify at least one interview in Step 3 (Decode &amp; Review) so its coded ADKOTM signals can feed into Step 4 formulas.
          </p>
          {onAddRecord && (
            <button
              type="button"
              onClick={() => {
                setCrudRecordToEdit(null);
                setIsCrudModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#528BCA] text-white hover:bg-[#3F78B5] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Manual Record
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Interactive Tier KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {activeFormula.outputTiers.map((tier, idx) => {
              const count = kpiBaseRows.filter((r) => r.tier === tier).length;
              const statedTotal = kpiBaseRows.filter((r) => r.tier !== null).length;
              const validPct = statedTotal > 0 ? Math.round((count / statedTotal) * 100) : 0;
              const style = TIER_PALETTE[idx % TIER_PALETTE.length];
              const isSelected = slicers.tier === tier;
              const minPts = tierThresholds[idx] ?? 0;

              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() =>
                    setSlicers((prev) => ({ ...prev, tier: prev.tier === tier ? 'ALL' : tier }))
                  }
                  className={`text-left p-4 rounded-3xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#DCE8F7]/75 border-[#528BCA] ring-2 ring-[#528BCA]/25 shadow-xs'
                      : 'bg-[#FDFCF8] border-[#D4DFD9] hover:bg-[#F2F5F3]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: style.bar }}
                    />
                    <span className="text-[11px] font-mono text-[#4F5E57]">≥ {minPts} pts</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-heading text-2xl font-bold text-[#1B2420]">{count}</span>
                    <span className="text-xs font-mono text-[#4F5E57]">{validPct}% valid</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[#1B2420] leading-snug break-words">
                    {tier}
                  </div>
                </button>
              );
            })}

            {/* Null / Insufficient Signals KPI Card */}
            {(() => {
              const nullCount = kpiBaseRows.filter((r) => r.tier === null).length;
              const total = kpiBaseRows.length;
              const pct = total > 0 ? Math.round((nullCount / total) * 100) : 0;
              const isSelected = slicers.tier === NULL_SENTINEL;
              return (
                <button
                  type="button"
                  onClick={() =>
                    setSlicers((prev) => ({
                      ...prev,
                      tier: prev.tier === NULL_SENTINEL ? 'ALL' : NULL_SENTINEL,
                      hideNulls: prev.tier === NULL_SENTINEL ? prev.hideNulls : false,
                    }))
                  }
                  className={`text-left p-4 rounded-3xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#DCE8F7]/75 border-[#528BCA] ring-2 ring-[#528BCA]/25 shadow-xs'
                      : 'bg-[#F2F5F3]/80 border-[#D4DFD9] hover:bg-[#E7ECE9]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#9BA8A2] shrink-0" />
                    <span className="text-[11px] font-mono text-[#4F5E57]">&lt; 2 dims</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-heading text-2xl font-bold text-[#1B2420]">{nullCount}</span>
                    <span className="text-xs font-mono text-[#4F5E57]">{pct}% of all</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[#4F5E57] leading-snug">
                    {NULL_TIER_LABEL}
                  </div>
                </button>
              );
            })()}
          </div>

          {/* Interactive Slicer Bar */}
          <div className="bg-[#F2F5F3] rounded-3xl border border-[#D4DFD9] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#528BCA]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#1B2420]">
                  Interactive Slicers
                </span>
                <span className="text-xs font-mono text-[#4F5E57]">
                  Showing {filteredRows.length} of {allComputedRows.length} interviews
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSlicers((prev) => ({ ...prev, hideNulls: !prev.hideNulls }))}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                    slicers.hideNulls
                      ? 'bg-[#528BCA] text-white border-[#528BCA]'
                      : 'bg-[#FDFCF8] text-[#4F5E57] border-[#D4DFD9] hover:bg-[#E7ECE9]'
                  }`}
                >
                  {slicers.hideNulls && <Check className="w-3 h-3" />}
                  Hide Nulls
                </button>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSlicers(INITIAL_SLICERS)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FDF3C7] text-[#735907] border border-[#F7D147] hover:bg-[#F7D147]/40 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Filters ({activeFilterCount})
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              {/* Tier Slicer */}
              <select
                aria-label="Filter by Tier"
                value={slicers.tier}
                onChange={(e) => setSlicers((prev) => ({ ...prev, tier: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-xs font-medium text-[#1B2420] focus:outline-none focus:border-[#528BCA]"
              >
                <option value="ALL">Tier: All</option>
                {activeFormula.outputTiers.map((t) => (
                  <option key={t} value={t}>
                    Tier: {t}
                  </option>
                ))}
                <option value={NULL_SENTINEL}>Tier: {NULL_TIER_LABEL}</option>
              </select>

              {/* Family Role Slicer */}
              <select
                aria-label="Filter by Family Role"
                value={slicers.FR}
                onChange={(e) => setSlicers((prev) => ({ ...prev, FR: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-xs font-medium text-[#1B2420] focus:outline-none focus:border-[#528BCA]"
              >
                <option value="ALL">Family Role [FR]: All</option>
                {slicerOptions.FR.values.map((v) => (
                  <option key={v} value={v}>
                    FR: {v}
                  </option>
                ))}
                {slicerOptions.FR.hasNull && <option value={NULL_SENTINEL}>FR: Unstated (null)</option>}
              </select>

              {/* Venue Slicer */}
              <select
                aria-label="Filter by Venue"
                value={slicers.IL}
                onChange={(e) => setSlicers((prev) => ({ ...prev, IL: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-xs font-medium text-[#1B2420] focus:outline-none focus:border-[#528BCA]"
              >
                <option value="ALL">Venue [IL]: All</option>
                {slicerOptions.IL.values.map((v) => (
                  <option key={v} value={v}>
                    IL: {v}
                  </option>
                ))}
                {slicerOptions.IL.hasNull && <option value={NULL_SENTINEL}>IL: Unstated (null)</option>}
              </select>

              {/* Awareness Slicer */}
              <select
                aria-label="Filter by Awareness"
                value={slicers.AW}
                onChange={(e) => setSlicers((prev) => ({ ...prev, AW: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-xs font-medium text-[#1B2420] focus:outline-none focus:border-[#528BCA]"
              >
                <option value="ALL">Awareness [AW]: All</option>
                {slicerOptions.AW.values.map((v) => (
                  <option key={v} value={v}>
                    AW: {v}
                  </option>
                ))}
                {slicerOptions.AW.hasNull && <option value={NULL_SENTINEL}>AW: Unstated (null)</option>}
              </select>

              {/* Product Category Slicer */}
              <select
                aria-label="Filter by Product Category"
                value={slicers.PP}
                onChange={(e) => setSlicers((prev) => ({ ...prev, PP: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-xs font-medium text-[#1B2420] focus:outline-none focus:border-[#528BCA]"
              >
                <option value="ALL">Product [PP]: All</option>
                {slicerOptions.PP.values.map((v) => (
                  <option key={v} value={v}>
                    PP: {v}
                  </option>
                ))}
                {slicerOptions.PP.hasNull && <option value={NULL_SENTINEL}>PP: Unstated (null)</option>}
              </select>

              {/* Quick Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#4F5E57] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={slicers.search}
                  onChange={(e) => setSlicers((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Search participant or signal..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-xs text-[#1B2420] focus:outline-none focus:border-[#528BCA]"
                />
              </div>
            </div>
          </div>

          {/* Formula Tier Distribution Bar Chart */}
          <HorizontalBarCard
            title={`${activeFormula.name} · Tier Distribution`}
            subtitle="Click any tier bar to cross-filter the ADKOTM charts and Evaluation Matrix below"
            distribution={tierDistribution}
            activeFilterKey={slicers.tier}
            onSelectBar={(key) => setSlicers((prev) => ({ ...prev, tier: key }))}
            defaultBarColor="#528BCA"
          />

          {/* Formula-Driven ADKOTM Category Breakdowns (live-reactive to Step 4 slicers) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-[#4F5E57]">
                  ADKOTM Category Breakdowns
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#DCE8F7] text-[#234B78] border border-[#A7C6EA]">
                  {showAllCategories
                    ? 'Showing all 6 ADKOTM categories'
                    : `Showing ${activeFormula.dimensions.length} formula driver${
                        activeFormula.dimensions.length === 1 ? '' : 's'
                      }: ${activeFormula.dimensions.join(' · ')}`}
                </span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <button
                  type="button"
                  disabled={activeFilterCount === 0}
                  onClick={() => setSlicers(INITIAL_SLICERS)}
                  title={
                    activeFilterCount > 0
                      ? 'Clear all active chart, slicer, search, and Hide Nulls filters'
                      : 'No active filters to reset'
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                    activeFilterCount > 0
                      ? 'bg-[#FDECEC] text-[#B93838] border-[#D97A75]/60 hover:bg-[#FBD9D9] cursor-pointer shadow-2xs'
                      : 'bg-[#F2F5F3] text-[#7A8881] border-[#D4DFD9] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>
                    {activeFilterCount > 0 ? `Reset Filter (${activeFilterCount})` : 'Reset Filter'}
                  </span>
                </button>

                <div className="inline-flex items-center rounded-full bg-[#F2F5F3] p-0.5 border border-[#D4DFD9]">
                  <button
                    type="button"
                    onClick={() => setShowAllCategories(false)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                      !showAllCategories
                        ? 'bg-[#528BCA] text-white shadow-2xs'
                        : 'text-[#4F5E57] hover:text-[#1B2420]'
                    }`}
                  >
                    Formula Drivers Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAllCategories(true)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                      showAllCategories
                        ? 'bg-[#528BCA] text-white shadow-2xs'
                        : 'text-[#4F5E57] hover:text-[#1B2420]'
                    }`}
                  >
                    All 6 Categories
                  </button>
                </div>
              </div>
            </div>

            <AdkotmCategoryChartsGrid
              records={filteredInterviewRecords}
              totalRecords={filteredInterviewRecords.length}
              dimensions={visibleDimensions}
              onSelectItem={handleSelectAdkotmChartItem}
            />
          </div>

          {/* Evaluation Matrix Table */}
          <div className="bg-[#FDFCF8] rounded-3xl border border-[#D4DFD9] overflow-hidden shadow-2xs">
            <div className="px-5 py-4 border-b border-[#E0E7E3] bg-[#F2F5F3]/70 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-base font-bold text-[#1B2420]">
                  Evaluation Matrix · {activeFormula.name}
                </h3>
                <p className="text-xs text-[#4F5E57]">
                  Click any participant row to open the Source Evidence Drawer with verbatim transcript quotes.
                </p>
              </div>
              {onAddRecord && (
                <button
                  type="button"
                  onClick={() => {
                    setCrudRecordToEdit(null);
                    setIsCrudModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FDFCF8] hover:bg-[#DCE8F7] text-[#1B2420] border border-[#D4DFD9] cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#528BCA]" />
                  Add Record
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F2F5F3] border-b border-[#E0E7E3] text-[11px] font-bold uppercase tracking-wider text-[#4F5E57]">
                    <th className="py-3 px-4 min-w-[210px]">Participant</th>
                    <th className="py-3 px-3 min-w-[165px]">Venue [IL]</th>
                    <th className="py-3 px-3 min-w-[210px]">Verified Coded Inputs</th>
                    <th className="py-3 px-3 min-w-[150px]">Score &amp; Tier</th>
                    <th className="py-3 px-3 min-w-[270px]">Evidence &amp; Score Breakdown</th>
                    <th className="py-3 px-4 text-right min-w-[130px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7ECE9] text-xs">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-[#4F5E57]">
                        No participants match the current slicer filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const tierStyle = getTierStyle(row.tier);
                      return (
                        <tr
                          key={row.record.id}
                          onClick={() => setEvidenceRowId(row.record.id)}
                          className="hover:bg-[#DCE8F7]/30 transition-colors cursor-pointer align-top"
                        >
                          {/* Full Participant Name (no clipping) */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-[#1B2420] leading-snug break-words">
                              {row.record.fileName}
                            </div>
                            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#528BCA]">
                              <Quote className="w-3 h-3" />
                              {row.verbatimEvidence.length} verbatim quote
                              {row.verbatimEvidence.length === 1 ? '' : 's'}
                            </div>
                          </td>

                          {/* True Individual Venue [IL] */}
                          <td className="py-3.5 px-3">
                            {row.signals.IL ? (
                              <span className="font-medium text-[#1B2420] leading-snug break-words">
                                {row.signals.IL}
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full font-mono text-[11px] bg-[#F2F5F3] text-[#5C6B64] border border-[#E0E7E3]">
                                null
                              </span>
                            )}
                          </td>

                          {/* Coded Inputs */}
                          <td className="py-3.5 px-3">
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { k: 'FR', v: row.signals.FR },
                                { k: 'RL', v: row.signals.RL },
                                { k: 'AW', v: row.signals.AW },
                                { k: 'PP', v: row.signals.PP },
                                { k: 'PP1', v: row.signals.PP1 },
                              ].map(({ k, v }) => (
                                <span
                                  key={k}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${
                                    v
                                      ? 'bg-[#FDFCF8] text-[#1B2420] border-[#D4DFD9]'
                                      : 'bg-[#F2F5F3] text-[#7A8881] border-[#E7ECE9]'
                                  }`}
                                >
                                  <span className="font-mono font-bold text-[#528BCA]">{k}:</span>
                                  <span className="break-words">{v || 'null'}</span>
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Numeric Score + Tier Badge */}
                          <td className="py-3.5 px-3">
                            <div className="flex flex-col items-start gap-1.5">
                              <span
                                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border"
                                style={{
                                  backgroundColor: tierStyle.bg,
                                  color: tierStyle.text,
                                  borderColor: tierStyle.border,
                                }}
                              >
                                {row.tier || NULL_TIER_LABEL}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[11px] font-bold text-[#1B2420]">
                                  {row.totalScore}/{row.maxScore} pts
                                </span>
                                {row.evaluation.isManualOverride && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FDF3C7] text-[#735907] border border-[#F7D147]">
                                    Manual
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Transparent Numeric Breakdown */}
                          <td className="py-3.5 px-3">
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {row.dimensionDetails.map((d) => {
                                const c = DIMENSION_BADGE_COLORS[d.dimension];
                                return (
                                  <span
                                    key={d.dimension}
                                    className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] border"
                                    style={
                                      d.stated
                                        ? { backgroundColor: c.bg, color: c.text, borderColor: c.border }
                                        : { backgroundColor: '#F2F5F3', color: '#7A8881', borderColor: '#E0E7E3' }
                                    }
                                  >
                                    {d.dimension}: {d.earned}/{d.weight}
                                    {!d.stated && ' (null)'}
                                  </span>
                                );
                              })}
                            </div>
                            <p className="text-[11px] text-[#4F5E57] leading-relaxed break-words">
                              {row.evaluation.justification}
                            </p>
                          </td>

                          {/* Row Actions */}
                          <td
                            className="py-3.5 px-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setEvidenceRowId(row.record.id)}
                                title="Inspect verbatim evidence"
                                className="p-1.5 rounded-full text-[#4F5E57] hover:text-[#528BCA] hover:bg-[#DCE8F7] cursor-pointer transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {onUpdateRecord && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCrudRecordToEdit(row.record);
                                      setIsCrudModalOpen(true);
                                    }}
                                    title="Edit coded values (recalculates score)"
                                    className="p-1.5 rounded-full text-[#4F5E57] hover:text-[#1C5B4E] hover:bg-[#DDF3ED] cursor-pointer transition-colors"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenOverride(row)}
                                    title="Manual tier override"
                                    className="p-1.5 rounded-full text-[#4F5E57] hover:text-[#735907] hover:bg-[#FDF3C7] cursor-pointer transition-colors"
                                  >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              {onDeleteRecord && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Delete record "${row.record.fileName}"?`)) {
                                      onDeleteRecord(row.record.id);
                                    }
                                  }}
                                  title="Delete record"
                                  className="p-1.5 rounded-full text-[#4F5E57] hover:text-[#B93838] hover:bg-[#FDECEC] cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Source Evidence Drawer */}
      {activeEvidenceRow && (
        <div
          className="fixed inset-0 z-50 bg-[#1B2420]/40 backdrop-blur-xs flex justify-end"
          onClick={() => setEvidenceRowId(null)}
        >
          <div
            className="w-full max-w-xl bg-[#FDFCF8] h-full shadow-2xl border-l border-[#D4DFD9] flex flex-col animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-6 py-4 bg-[#F2F5F3] border-b border-[#E0E7E3] flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#528BCA]">
                  Source Evidence Drawer
                </span>
                <h3 className="font-heading text-base font-bold text-[#1B2420] mt-0.5 break-words">
                  {activeEvidenceRow.record.fileName}
                </h3>
                <p className="text-xs text-[#4F5E57] mt-0.5">
                  Venue: {activeEvidenceRow.signals.IL || 'Unstated (null)'} · Formula:{' '}
                  {activeFormula.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEvidenceRowId(null)}
                aria-label="Close evidence drawer"
                className="p-2 rounded-full text-[#4F5E57] hover:text-[#1B2420] hover:bg-[#E7ECE9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Score Summary Card */}
              <div className="p-4 rounded-2xl bg-[#F2F5F3] border border-[#D4DFD9] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#4F5E57]">
                    Formula Score Breakdown
                  </span>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold border"
                    style={{
                      backgroundColor: getTierStyle(activeEvidenceRow.tier).bg,
                      color: getTierStyle(activeEvidenceRow.tier).text,
                      borderColor: getTierStyle(activeEvidenceRow.tier).border,
                    }}
                  >
                    {activeEvidenceRow.tier || NULL_TIER_LABEL} ({activeEvidenceRow.totalScore}/
                    {activeEvidenceRow.maxScore} pts)
                  </span>
                </div>

                <div className="space-y-2">
                  {activeEvidenceRow.dimensionDetails.map((d) => {
                    const pct = d.weight > 0 ? Math.round((d.earned / d.weight) * 100) : 0;
                    return (
                      <div key={d.dimension} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#1B2420]">
                            <span className="font-mono text-[#528BCA] mr-1">[{d.dimension}]</span>
                            {d.summary || 'Unstated (null)'}
                          </span>
                          <span className="font-mono font-bold text-[#1B2420] shrink-0 ml-2">
                            {d.earned}/{d.weight}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#E7ECE9] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: d.stated ? '#528BCA' : '#C9D2CE',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Verbatim Quotes (Inter Transcript Surface) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-[#4F5E57]">
                    Linked Verbatim Transcript Evidence
                  </h4>
                  <span className="text-xs font-mono text-[#4F5E57]">
                    {activeEvidenceRow.verbatimEvidence.length} quote
                    {activeEvidenceRow.verbatimEvidence.length === 1 ? '' : 's'}
                  </span>
                </div>

                {activeEvidenceRow.verbatimEvidence.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-[#F2F5F3] border border-dashed border-[#D4DFD9] text-xs text-[#4F5E57]">
                    No coded verbatim spans attached yet. Click &ldquo;Edit Coded Values&rdquo; or review spans in Step 3.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeEvidenceRow.verbatimEvidence.map((item, idx) => {
                      const c = DIMENSION_BADGE_COLORS[item.dimension];
                      return (
                        <div
                          key={`${item.dimension}-${idx}`}
                          className="p-4 rounded-2xl bg-[#FDFCF8] border border-[#D4DFD9] space-y-2"
                        >
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border"
                            style={{
                              backgroundColor: c.bg,
                              color: c.text,
                              borderColor: c.border,
                            }}
                          >
                            [{item.dimension}] {item.subLabel}
                          </span>
                          <blockquote className="transcript-surface text-[#1B2420] border-l-2 border-[#96D6C7] pl-3">
                            &ldquo;{item.quote}&rdquo;
                          </blockquote>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-4 bg-[#F2F5F3] border-t border-[#E0E7E3] flex items-center justify-between gap-2">
              {onUpdateRecord && (
                <button
                  type="button"
                  onClick={() => {
                    const rec = activeEvidenceRow.record;
                    setEvidenceRowId(null);
                    setCrudRecordToEdit(rec);
                    setIsCrudModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Coded Values
                </button>
              )}
              <button
                type="button"
                onClick={() => setEvidenceRowId(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-[#4F5E57] hover:bg-[#E7ECE9] cursor-pointer ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Tier Override Modal */}
      {overrideRow && (
        <div
          className="fixed inset-0 z-50 bg-[#1B2420]/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setOverrideRow(null)}
        >
          <div
            className="bg-[#FDFCF8] rounded-3xl border border-[#D4DFD9] shadow-studio w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-bold text-[#1B2420]">
                Manual Tier Override
              </h3>
              <button
                type="button"
                onClick={() => setOverrideRow(null)}
                className="p-1.5 rounded-full text-[#4F5E57] hover:bg-[#E7ECE9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#4F5E57]">
              Participant: <strong className="text-[#1B2420]">{overrideRow.record.fileName}</strong>
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#4F5E57] mb-1">
                Assigned Tier
              </label>
              <select
                value={overrideTier}
                onChange={(e) => setOverrideTier(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-sm text-[#1B2420]"
              >
                {activeFormula.outputTiers.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value={NULL_SENTINEL}>{NULL_TIER_LABEL}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4F5E57] mb-1">
                Justification Note
              </label>
              <textarea
                rows={3}
                value={overrideJustification}
                onChange={(e) => setOverrideJustification(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-xs text-[#1B2420]"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#E0E7E3]">
              {overrideRow.evaluation.isManualOverride ? (
                <button
                  type="button"
                  onClick={() => handleSaveOverride(true)}
                  className="text-xs font-semibold text-[#528BCA] hover:underline cursor-pointer"
                >
                  Reset to Formula Score
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideRow(null)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#4F5E57] hover:bg-[#E7ECE9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOverride(false)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white cursor-pointer"
                >
                  Save Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formula Builder Modal (Create & Configure) */}
      <FormulaBuilderModal
        isOpen={isFormulaModalOpen}
        onClose={() => {
          setIsFormulaModalOpen(false);
          setFormulaToEdit(null);
        }}
        formulaToEdit={formulaToEdit}
        onSaveFormula={handleSaveFormula}
      />

      {/* Participant Coded Values CRUD Modal */}
      {isCrudModalOpen && (
        <DecodeCrudModal
          isOpen={isCrudModalOpen}
          onClose={() => {
            setIsCrudModalOpen(false);
            setCrudRecordToEdit(null);
          }}
          recordToEdit={crudRecordToEdit}
          existingFolders={sessions.map((s) => s.folderName).filter(Boolean)}
          onDeleteRecord={onDeleteRecord}
          onSaveRecord={(savedRecord) => {
            if (crudRecordToEdit && onUpdateRecord) {
              const updatedRow = engine.evaluateRecord(savedRecord, activeFormula);
              const synced: InterviewRecord = {
                ...savedRecord,
                spendingPower:
                  activeFormula.id === 'spending_power'
                    ? engine.toSpendingPowerAnalysis(updatedRow)
                    : savedRecord.spendingPower,
                crossAnalysisEvaluations: {
                  ...(savedRecord.crossAnalysisEvaluations || {}),
                  [activeFormula.id]: updatedRow.evaluation,
                },
              };
              onUpdateRecord(synced);
            } else if (!crudRecordToEdit && onAddRecord) {
              onAddRecord(savedRecord);
            }
            setIsCrudModalOpen(false);
            setCrudRecordToEdit(null);
          }}
        />
      )}
    </div>
  );
};
