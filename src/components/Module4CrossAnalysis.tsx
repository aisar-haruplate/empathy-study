import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  TrendingUp,
  MapPin,
  Sparkles,
  ShoppingBag,
  Clock,
  UserCheck,
  Building,
  Target,
  Loader2,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Check,
  X,
  Upload,
  Download,
  Plus,
  Trash2,
  Printer,
  BarChart3,
  PieChart as PieIcon,
  Sliders,
  Settings,
  HelpCircle,
  Bookmark,
  History,
  RotateCcw,
} from 'lucide-react';
import {
  InterviewRecord,
  InterviewSession,
  SpendingPowerAnalysis,
  CrossAnalysisFormula,
  GenericCrossAnalysisEvaluation,
} from '../types';
import { AnalysisChart, ChartDataItem } from './charts/AnalysisCharts';
import { DecodeCrudModal } from './DecodeCrudModal';
import { FormulaBuilderModal } from './FormulaBuilderModal';
import { exportDecodesToCSV, exportDecodesToDoc, openPrintablePDFReport } from '../lib/exportUtils';
import { isAnalysisEligibleRecord } from '../lib/recordEligibility';
import { isHumanVerifiedRecord } from '../lib/adkotmCopilot';

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

const DEFAULT_FORMULAS: CrossAnalysisFormula[] = [
  {
    id: 'spending_power',
    name: 'Spending Power Analysis',
    code: 'D + O + T + M',
    analysisCodes: 'RL + PP + IL',
    dimensions: ['D', 'O', 'T', 'M'],
    description: 'Empirical cross-analysis linking Residential Location (RL), Products (PP), Brands (PP1), and Venue (IL) to determine consumer purchasing power without guessing.',
    outputTiers: ['High', 'Medium-High', 'Medium', 'Low'],
    evaluationRules: 'Evaluate neighborhood affluence (RL), product & brand premium selection (PP/PP1), and interview venue tier (IL).',
    isCustom: false,
  },
  {
    id: 'gut_health_proactiveness',
    name: 'Gut Health Proactiveness Index',
    code: 'K + O + A',
    analysisCodes: 'AW + PP + Routine',
    dimensions: ['K', 'O', 'A'],
    description: 'Evaluates consumer proactiveness toward digestive health by linking Gut Knowledge (AW), Probiotic Purchases (PP), and Daily Dietary Habits (A).',
    outputTiers: ['Proactive Leader', 'Moderate Aware', 'Reactive / Low Awareness'],
    evaluationRules: 'Classify as Proactive if aware of probiotics/immunity and routines daily intake; Moderate if aware but irregular; Reactive if purchases only when ill.',
    isCustom: false,
  },
  {
    id: 'brand_loyalty',
    name: 'Brand Loyalty vs Price Sensitivity',
    code: 'O + T + M',
    analysisCodes: 'PP1 + Timing + IL',
    dimensions: ['O', 'T', 'M'],
    description: 'Evaluates brand loyalty versus bulk discount sensitivity by cross-referencing brand preference (PP1), purchase timing (T), and shopping venue (IL).',
    outputTiers: ['Brand Loyal', 'Value-Conscious / Hybrid', 'Price Sensitive Deal-Seeker'],
    evaluationRules: 'Classify as Brand Loyal if strictly seeks designated brand; Price Sensitive if shopping venue is wholesale hypermarket without specific brand commitment.',
    isCustom: false,
  },
];

export const Module4CrossAnalysis: React.FC<Module4CrossAnalysisProps> = ({
  records,
  sessions,
  onUpdateRecord,
  onAddRecord,
  onDeleteRecord,
  safePostJson,
  onOpenAiAssistant,
  onOpenVersionHistory,
  onRevertFormula,
}) => {
  // Formula Management
  const [formulas, setFormulas] = useState<CrossAnalysisFormula[]>(() => {
    try {
      const saved = localStorage.getItem('empathy_cross_analysis_formulas');
      if (saved) {
        const parsed: CrossAnalysisFormula[] = JSON.parse(saved);
        const hasSpending = parsed.some((f) => f.id === 'spending_power');
        return hasSpending ? parsed : [DEFAULT_FORMULAS[0], ...parsed];
      }
    } catch (e) {
      console.warn('Could not load cached formulas', e);
    }
    return DEFAULT_FORMULAS;
  });

  // Re-sync formulas when updated from AI Copilot or Version Control Modal
  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem('empathy_cross_analysis_formulas');
        if (saved) {
          const parsed: CrossAnalysisFormula[] = JSON.parse(saved);
          const hasSpending = parsed.some((f) => f.id === 'spending_power');
          setFormulas(hasSpending ? parsed : [DEFAULT_FORMULAS[0], ...parsed]);
        } else {
          setFormulas(DEFAULT_FORMULAS);
        }
      } catch (e) {
        console.warn('Could not reload formulas', e);
      }
    };

    window.addEventListener('empathy_formulas_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('empathy_formulas_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const [activeFormulaId, setActiveFormulaId] = useState<string>('spending_power');
  const activeFormula =
    formulas.find((f) => f.id === activeFormulaId) || formulas[0] || DEFAULT_FORMULAS[0];

  // Formula Builder Modal State
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);
  const [formulaToEdit, setFormulaToEdit] = useState<CrossAnalysisFormula | null>(null);

  // Evaluations state for active formula
  const [evaluations, setEvaluations] = useState<GenericCrossAnalysisEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [evaluatedFormulas, setEvaluatedFormulas] = useState<Set<string>>(new Set());

  // Full CRUD participant modal state
  const [isCrudModalOpen, setIsCrudModalOpen] = useState(false);
  const [crudRecordToEdit, setCrudRecordToEdit] = useState<InterviewRecord | null>(null);

  // Visual Chart Mode: Pie / Donut vs Bar Chart
  const [chartMode, setChartMode] = useState<'pie' | 'bar'>('pie');

  // Demographic sub-dimension switcher: Family Role, Residential Location, Age, Gender, Education
  type DemoSubDimension = 'FR' | 'RL' | 'age' | 'gender' | 'education';
  const [demoDimension, setDemoDimension] = useState<DemoSubDimension>('FR');

  // Secondary qualitative sub-dimension switcher: Products (PP), Brand Preferences (PP1), Interview Venue (IL)
  type ObjSubDimension = 'PP' | 'PP1' | 'IL';
  const [objDimension, setObjDimension] = useState<ObjSubDimension>('PP');

  // Table search & filter
  const [tableSearch, setTableSearch] = useState('');

  // In-place Override state for active formula evaluation
  const [overrideEval, setOverrideEval] = useState<GenericCrossAnalysisEvaluation | null>(null);
  const [overrideTier, setOverrideTier] = useState<string>('');
  const [overrideJustification, setOverrideJustification] = useState<string>('');

  // Strictly Human Verified records feed into Step 4 Cross-Analysis
  const allAnalysisEligible = records.filter((r) => (r.transcript || r.cleanedTranscript) && isAnalysisEligibleRecord(r));
  const eligibleRecords = allAnalysisEligible.filter(isHumanVerifiedRecord);
  const decodedRecords = eligibleRecords;
  const pendingVerificationCount = allAnalysisEligible.length - eligibleRecords.length;

  // Compute or Evaluate active formula across all verified records
  const runActiveFormulaEvaluation = async (targetFormula?: CrossAnalysisFormula) => {
    const formulaToRun = targetFormula || activeFormula;
    if (eligibleRecords.length === 0) {
      setEvaluations([]);
      return;
    }
    setIsLoading(true);

    try {
      const res = await safePostJson<{
        success: boolean;
        evaluations: GenericCrossAnalysisEvaluation[];
        analyses?: SpendingPowerAnalysis[];
        analyzedCount: number;
      }>('/api/cross-analysis/evaluate', {
        formula: formulaToRun,
        decodedRecords: eligibleRecords.map((r) => ({
          id: r.id,
          fileName: r.fileName,
          adkotmDecode: r.adkotmDecode || null,
        })),
      });

      if (res.success && Array.isArray(res.evaluations)) {
        setEvaluations(res.evaluations);
        setEvaluatedFormulas((prev) => new Set(prev).add(formulaToRun.id));

        // Sync into records in memory
        if (onUpdateRecord) {
          res.evaluations.forEach((ev) => {
            const matching = records.find((r) => r.id === ev.recordId);
            if (matching) {
              const currentEvals = matching.crossAnalysisEvaluations || {};
              const updatedRec: InterviewRecord = {
                ...matching,
                crossAnalysisEvaluations: {
                  ...currentEvals,
                  [formulaToRun.id]: ev,
                },
              };

              // If this is spending power, sync spendingPower property as well
              if (formulaToRun.id === 'spending_power') {
                const spTier = (ev.tier === 'High' || ev.tier === 'Medium-High' || ev.tier === 'Medium' || ev.tier === 'Low') ? ev.tier : null;
                updatedRec.spendingPower = {
                  recordId: ev.recordId,
                  fileName: ev.fileName,
                  spendingPowerTier: spTier,
                  components: {
                    D_demographic: ev.components['FR'] || null,
                    O_objects: ev.components['PP'] || null,
                    T_time: ev.components['T_time'] || null,
                    M_metadata: ev.components['IL'] || null,
                    RL_residentialLocation: ev.components['RL'] || null,
                    PP_productsPurchased: ev.components['PP'] || null,
                    PP1_brandPreferences: ev.components['PP1'] || null,
                    IL_interviewLocation: ev.components['IL'] || null,
                  },
                  justification: ev.justification,
                };
              }

              onUpdateRecord(updatedRec);
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to evaluate formula:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-run evaluation on formula change or initial mount
  useEffect(() => {
    if (eligibleRecords.length === 0) {
      setEvaluations([]);
      return;
    }
    // Check if we already have saved evaluations in records for this formula
    const existing = eligibleRecords
      .map((r) => r.crossAnalysisEvaluations?.[activeFormula.id])
      .filter(Boolean) as GenericCrossAnalysisEvaluation[];

    if (existing.length > 0 && existing.length === eligibleRecords.length) {
      setEvaluations(existing);
      setEvaluatedFormulas((prev) => new Set(prev).add(activeFormula.id));
    } else {
      runActiveFormulaEvaluation(activeFormula);
    }
  }, [activeFormula.id, eligibleRecords.length, decodedRecords.length]);

  // Handle saving new or updated formula
  const handleSaveFormula = (saved: CrossAnalysisFormula) => {
    setFormulas((prev) => {
      const idx = prev.findIndex((f) => f.id === saved.id);
      let next: CrossAnalysisFormula[];
      if (idx !== -1) {
        next = [...prev];
        next[idx] = saved;
      } else {
        next = [...prev, saved];
      }
      try {
        localStorage.setItem('empathy_cross_analysis_formulas', JSON.stringify(next));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      return next;
    });

    setActiveFormulaId(saved.id);
    runActiveFormulaEvaluation(saved);
  };

  // Delete custom formula
  const handleDeleteFormula = (formulaId: string) => {
    if (formulaId === 'spending_power') {
      alert('The core Spending Power formula is permanent and cannot be deleted.');
      return;
    }
    if (!confirm('Are you sure you want to delete this custom formula?')) return;

    setFormulas((prev) => {
      const next = prev.filter((f) => f.id !== formulaId);
      try {
        localStorage.setItem('empathy_cross_analysis_formulas', JSON.stringify(next));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      return next;
    });

    setActiveFormulaId('spending_power');
  };

  // In-place evaluation override
  const handleOpenOverride = (ev: GenericCrossAnalysisEvaluation) => {
    setOverrideEval(ev);
    setOverrideTier(ev.tier || 'null');
    setOverrideJustification(ev.justification || '');
  };

  const handleSaveOverride = () => {
    if (!overrideEval) return;
    const finalTier = overrideTier === 'null' || !overrideTier.trim() ? null : overrideTier.trim();
    const updatedEval: GenericCrossAnalysisEvaluation = {
      ...overrideEval,
      tier: finalTier,
      justification:
        overrideJustification.trim() ||
        (finalTier ? `${finalTier} tier override` : 'Insufficient empirical signals (null)'),
      evaluatedAt: new Date().toISOString(),
    };

    setEvaluations((prev) =>
      prev.map((item) => (item.recordId === overrideEval.recordId ? updatedEval : item))
    );

    if (onUpdateRecord) {
      const matching = records.find((r) => r.id === overrideEval.recordId);
      if (matching) {
        const curEvals = matching.crossAnalysisEvaluations || {};
        const updatedRec: InterviewRecord = {
          ...matching,
          crossAnalysisEvaluations: {
            ...curEvals,
            [activeFormula.id]: updatedEval,
          },
        };

        if (activeFormula.id === 'spending_power') {
          const spTier = (finalTier === 'High' || finalTier === 'Medium-High' || finalTier === 'Medium' || finalTier === 'Low') ? finalTier : null;
          updatedRec.spendingPower = {
            recordId: matching.id,
            fileName: matching.fileName,
            spendingPowerTier: spTier,
            components: {
              D_demographic: overrideEval.components['FR'] || null,
              O_objects: overrideEval.components['PP'] || null,
              T_time: overrideEval.components['T_time'] || null,
              M_metadata: overrideEval.components['IL'] || null,
              RL_residentialLocation: overrideEval.components['RL'] || null,
              PP_productsPurchased: overrideEval.components['PP'] || null,
              PP1_brandPreferences: overrideEval.components['PP1'] || null,
              IL_interviewLocation: overrideEval.components['IL'] || null,
            },
            justification: updatedEval.justification,
          };
        }

        onUpdateRecord(updatedRec);
      }
    }

    setOverrideEval(null);
  };

  // Helper to safely render explicit null badges without crashing on non-string types
  const renderValue = (val: any) => {
    if (val === null || val === undefined) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-stone-100 text-stone-400 border border-stone-200">
          null
        </span>
      );
    }

    let strVal = '';
    if (typeof val === 'string') {
      strVal = val;
    } else if (Array.isArray(val)) {
      strVal = val.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ');
    } else if (typeof val === 'object') {
      strVal = Object.entries(val)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    } else {
      strVal = String(val);
    }

    if (!strVal || strVal.trim() === '') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-stone-100 text-stone-400 border border-stone-200">
          null
        </span>
      );
    }

    return (
      <span className="text-xs font-semibold text-stone-800 break-words leading-relaxed">
        {strVal}
      </span>
    );
  };

  // Dynamic distribution of active formula output tiers
  const tierDistribution: Record<string, number> = {};
  activeFormula.outputTiers.forEach((tier) => {
    tierDistribution[tier] = evaluations.filter((e) => e.tier === tier).length;
  });
  const nullCount = evaluations.filter((e) => e.tier === null).length;
  const totalAnalyzed = evaluations.length;

  // Chart data preparations for active formula
  const TIER_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4'];
  const formulaTierChartData: ChartDataItem[] = [
    ...activeFormula.outputTiers.map((tier, idx) => ({
      label: tier,
      count: tierDistribution[tier] || 0,
      color: TIER_COLORS[idx % TIER_COLORS.length],
    })),
    {
      label: 'Null (Insufficient Signals)',
      count: nullCount,
      color: '#94a3b8',
    },
  ].filter((d) => d.count > 0);

  // --- DEMOGRAPHIC SEPARATED SUB-DIMENSIONS ---
  // 1. Family Role (FR: Mum, Dad, Elderly)
  const frCounts: Record<string, number> = {};
  evaluations.forEach((e) => {
    const matching = records.find((r) => r.id === e.recordId);
    const val =
      e.components?.['FR'] ||
      e.components?.['FR_familyRole'] ||
      matching?.adkotmDecode?.postAnalysisCodes?.FR ||
      matching?.adkotmDecode?.demographic?.familyRole ||
      'null (unstated)';
    frCounts[val] = (frCounts[val] || 0) + 1;
  });
  const frChartData: ChartDataItem[] = Object.entries(frCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // 2. Residential Location (RL: Kepong, Ampang, PJ, Subang, etc.)
  const rlCounts: Record<string, number> = {};
  evaluations.forEach((e) => {
    const matching = records.find((r) => r.id === e.recordId);
    const val =
      e.components?.['RL'] ||
      e.components?.['RL_residentialLocation'] ||
      matching?.adkotmDecode?.postAnalysisCodes?.RL ||
      matching?.adkotmDecode?.demographic?.residentialLocation ||
      matching?.adkotmDecode?.demographic?.residentialDistrict ||
      'null (unstated)';
    rlCounts[val] = (rlCounts[val] || 0) + 1;
  });
  const rlChartData: ChartDataItem[] = Object.entries(rlCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // 3. Age Distribution (20-29, 30-39, 40-49, 50-59, 60+ Elderly)
  const ageCounts: Record<string, number> = {};
  evaluations.forEach((e) => {
    const matching = records.find((r) => r.id === e.recordId);
    const val =
      e.components?.['age'] ||
      matching?.adkotmDecode?.demographic?.age ||
      'null (unstated)';
    ageCounts[val] = (ageCounts[val] || 0) + 1;
  });
  const ageChartData: ChartDataItem[] = Object.entries(ageCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // 4. Gender (Female, Male)
  const genderCounts: Record<string, number> = {};
  evaluations.forEach((e) => {
    const matching = records.find((r) => r.id === e.recordId);
    const val =
      e.components?.['gender'] ||
      matching?.adkotmDecode?.demographic?.gender ||
      'null (unstated)';
    genderCounts[val] = (genderCounts[val] || 0) + 1;
  });
  const genderChartData: ChartDataItem[] = Object.entries(genderCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // 5. Education Level (Secondary / SPM, Diploma, Bachelor's, Master's)
  const eduCounts: Record<string, number> = {};
  evaluations.forEach((e) => {
    const matching = records.find((r) => r.id === e.recordId);
    const val =
      e.components?.['educationLevel'] ||
      matching?.adkotmDecode?.demographic?.educationLevel ||
      'null (unstated)';
    eduCounts[val] = (eduCounts[val] || 0) + 1;
  });
  const eduChartData: ChartDataItem[] = Object.entries(eduCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Active Demographic Chart Data based on user sub-dimension toggle
  const activeDemoData =
    demoDimension === 'FR'
      ? frChartData
      : demoDimension === 'RL'
      ? rlChartData
      : demoDimension === 'age'
      ? ageChartData
      : demoDimension === 'gender'
      ? genderChartData
      : eduChartData;

  const demoTitles: Record<DemoSubDimension, { title: string; subtitle: string; code: string }> = {
    FR: { title: 'Demographic: Family Role (FR)', subtitle: 'Mums, Dads, Elderly qualitative distribution', code: 'FR' },
    RL: { title: 'Demographic: Residential Location (RL)', subtitle: 'Klang Valley residential districts & catchment areas', code: 'RL' },
    age: { title: 'Demographic: Age Distribution', subtitle: 'Participant age brackets & life-stages', code: 'Age' },
    gender: { title: 'Demographic: Gender', subtitle: 'Pronoun-preserved gender identification', code: 'Gender' },
    education: { title: 'Demographic: Education Level', subtitle: 'Highest educational qualification attained', code: 'Edu' },
  };

  // --- OBJECTS & VENUE SEPARATED QUALITATIVE SIGNALS ---
  // 1. Products Purchased (PP: Gut health, probiotic yogurt, supplements)
  const ppCounts: Record<string, number> = {};
  evaluations.forEach((e) => {
    const matching = records.find((r) => r.id === e.recordId);
    const val =
      e.components?.['PP'] ||
      e.components?.['PP_productsPurchased'] ||
      matching?.adkotmDecode?.postAnalysisCodes?.PP ||
      matching?.adkotmDecode?.objects?.productsPurchased ||
      'null (unstated)';
    ppCounts[val] = (ppCounts[val] || 0) + 1;
  });
  const ppChartData: ChartDataItem[] = Object.entries(ppCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // 2. Brand Preferences (PP1: Karihome, Yakult, Vitagen, etc.)
  const pp1Counts: Record<string, number> = {};
  evaluations.forEach((e) => {
    const matching = records.find((r) => r.id === e.recordId);
    const val =
      e.components?.['PP1'] ||
      e.components?.['PP1_brandPreferences'] ||
      matching?.adkotmDecode?.postAnalysisCodes?.PP1 ||
      matching?.adkotmDecode?.objects?.brandPreferences ||
      'null (unstated)';
    pp1Counts[val] = (pp1Counts[val] || 0) + 1;
  });
  const pp1ChartData: ChartDataItem[] = Object.entries(pp1Counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // 3. Interview Venue (IL: Publika, Brem Mall Kepong NSK, Jaya Grocer, etc.)
  const ilCounts: Record<string, number> = {};
  evaluations.forEach((e) => {
    const matching = records.find((r) => r.id === e.recordId);
    const val =
      e.components?.['IL'] ||
      e.components?.['IL_interviewLocation'] ||
      matching?.adkotmDecode?.postAnalysisCodes?.IL ||
      matching?.adkotmDecode?.metadata?.interviewLocation ||
      'null (unstated)';
    ilCounts[val] = (ilCounts[val] || 0) + 1;
  });
  const ilChartData: ChartDataItem[] = Object.entries(ilCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const activeObjData =
    objDimension === 'PP' ? ppChartData : objDimension === 'PP1' ? pp1ChartData : ilChartData;

  const objTitles: Record<ObjSubDimension, { title: string; subtitle: string; code: string }> = {
    PP: { title: 'Products Purchased (PP)', subtitle: 'Gut health & digestive product categories', code: 'PP' },
    PP1: { title: 'Brand Preferences (PP1)', subtitle: 'Identified brands & product loyalty', code: 'PP1' },
    IL: { title: 'Interview Venue (IL)', subtitle: 'Field interview retail venues & hypermarkets', code: 'IL' },
  };

  return (
    <div className="space-y-6">
      {/* Formula Selector & Model Switcher Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-3.5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              Formula:
            </span>

            {formulas.map((f) => {
              const isActive = f.id === activeFormulaId;
              return (
                <div key={f.id} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveFormulaId(f.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/20'
                        : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
                    }`}
                  >
                    <span>{f.name}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                        isActive ? 'bg-indigo-700/80 text-indigo-100' : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      {f.code}
                    </span>
                  </button>
                  {f.isCustom && onRevertFormula && (
                    <button
                      type="button"
                      onClick={() => onRevertFormula(f.id)}
                      title={`Revert and remove AI formula "${f.name}"`}
                      className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenVersionHistory && (
              <button
                type="button"
                onClick={onOpenVersionHistory}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 cursor-pointer transition-all shadow-2xs"
                title="AI Version Control & Revert History"
              >
                <History className="w-3.5 h-3.5 text-stone-600" />
                <span>Revert History</span>
              </button>
            )}
            {onOpenAiAssistant && (
              <button
                type="button"
                onClick={onOpenAiAssistant}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer transition-all shadow-2xs"
                title="Ask AI Assistant to suggest new qualitative analytics formulas"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> AI Formula Copilot
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setFormulaToEdit(null);
                setIsFormulaModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer transition-all shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" /> + Add Formula
            </button>
          </div>
        </div>
      </div>

      {/* Main Banner for Step 4 */}
      <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-stone-50 border border-indigo-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-stone-900">
                  Step 4: Cross-Analysis
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-indigo-100 text-indigo-900 border border-indigo-200">
                  {activeFormula.name} ({activeFormula.code})
                </span>
                {activeFormula.isCustom && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    Custom Model
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 mt-1 max-w-2xl">
                Combines demographics, brands, and interview details to evaluate behavioral insights without guessing.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Export Toolbar (Human Verified dataset only) */}
            <div className="flex items-center bg-white border border-stone-200 rounded-xl p-1 shadow-2xs">
              <span className="text-[11px] font-bold text-stone-500 px-2 flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Export:
              </span>
              <button
                type="button"
                disabled={eligibleRecords.length === 0}
                onClick={() => exportDecodesToCSV(eligibleRecords)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-stone-100 text-stone-700 disabled:opacity-40 cursor-pointer transition-colors"
                title="Export Human Verified dataset to CSV"
              >
                CSV
              </button>
              <button
                type="button"
                disabled={eligibleRecords.length === 0}
                onClick={() => exportDecodesToDoc(eligibleRecords)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-stone-100 text-blue-700 disabled:opacity-40 cursor-pointer transition-colors"
                title="Export formatted Word report (.doc) of Human Verified records"
              >
                Word (.doc)
              </button>
              <button
                type="button"
                disabled={eligibleRecords.length === 0}
                onClick={() => openPrintablePDFReport(eligibleRecords)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-stone-100 text-rose-700 disabled:opacity-40 cursor-pointer transition-colors"
                title="Print or Save Human Verified report as PDF"
              >
                PDF
              </button>
            </div>

            {/* Formula Edit / Settings */}
            <button
              type="button"
              onClick={() => {
                setFormulaToEdit(activeFormula);
                setIsFormulaModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 shadow-2xs cursor-pointer"
              title="Edit active formula settings"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configure</span>
            </button>

            {activeFormula.isCustom && (
              <button
                type="button"
                onClick={() => handleDeleteFormula(activeFormula.id)}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                title="Delete this custom formula"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* CRUD: Add Participant */}
            <button
              type="button"
              onClick={() => {
                setCrudRecordToEdit(null);
                setIsCrudModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 shadow-2xs cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4 text-indigo-600" /> + Add Participant
            </button>

            {/* Re-Compute Button for Active Formula */}
            <button
              type="button"
              disabled={isLoading || eligibleRecords.length === 0}
              onClick={() => runActiveFormulaEvaluation(activeFormula)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-xs cursor-pointer transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Evaluating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" /> Re-Compute {activeFormula.name}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Human Verified Gating Notice */}
      {pendingVerificationCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2.5 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Cross-analysis includes <strong>{eligibleRecords.length} Human Verified</strong> interview
            {eligibleRecords.length === 1 ? '' : 's'}. {pendingVerificationCount} interview
            {pendingVerificationCount === 1 ? ' is' : 's are'} still unverified in Step 3 Review Workspace and excluded until verified.
          </span>
        </div>
      )}

      {/* Step 4 Done Signal & Report Export Action */}
      {evaluations.length > 0 && !isLoading && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                <span>Step 4 Analysis Complete</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {evaluations.length} Participants Evaluated
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Full study analysis is complete! Review the charts and participant table below, or export the report.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={eligibleRecords.length === 0}
              onClick={() => openPrintablePDFReport(eligibleRecords)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white shadow-xs cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5" /> PDF Report
            </button>
            <button
              type="button"
              disabled={eligibleRecords.length === 0}
              onClick={() => exportDecodesToDoc(eligibleRecords)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white shadow-xs cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Word (.doc)
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Methodology Formula Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-stone-100 flex-wrap gap-2">
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-4 h-4 text-indigo-600" />
            Cross-Analysis Methodology Specification ({activeFormula.name})
          </span>
          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            {activeFormula.name} = {activeFormula.code} ({activeFormula.analysisCodes})
          </span>
        </div>

        {/* Dynamic Dimension Cards based on formula.dimensions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {activeFormula.dimensions.includes('D') && (
            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80">
              <span className="font-bold text-blue-900 block mb-1">
                [D] Demographic & [RL / FR]
              </span>
              <p className="text-stone-600 leading-relaxed">
                Family Role (FR) + Residential Location (RL). Neighborhood affluence, housing type, and family role load.
              </p>
            </div>
          )}

          {activeFormula.dimensions.includes('O') && (
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
              <span className="font-bold text-emerald-900 block mb-1">
                [O] Objects & [PP / PP1]
              </span>
              <p className="text-stone-600 leading-relaxed">
                Products Purchased (PP) and Brand Preferences (PP1). Specialty organic/probiotic vs value commodity brands.
              </p>
            </div>
          )}

          {activeFormula.dimensions.includes('K') && (
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80">
              <span className="font-bold text-amber-900 block mb-1">
                [K] Knowledge & [AW]
              </span>
              <p className="text-stone-600 leading-relaxed">
                Gut Health Awareness (AW). Understanding of microbiome immunity, probiotics, and digestive wellness.
              </p>
            </div>
          )}

          {activeFormula.dimensions.includes('A') && (
            <div className="p-3 rounded-xl bg-violet-50/60 border border-violet-200/80">
              <span className="font-bold text-violet-900 block mb-1">
                [A] Activities & Habits
              </span>
              <p className="text-stone-600 leading-relaxed">
                Daily routine, food preparation habits, shopping behaviour, and household meal consumption context.
              </p>
            </div>
          )}

          {activeFormula.dimensions.includes('T') && (
            <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-200/80">
              <span className="font-bold text-orange-900 block mb-1">
                [T] Time & Frequency
              </span>
              <p className="text-stone-600 leading-relaxed">
                Purchase frequency, timing, and consumption occasions (daily routine vs sporadic/reactive buying).
              </p>
            </div>
          )}

          {activeFormula.dimensions.includes('M') && (
            <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/80">
              <span className="font-bold text-rose-900 block mb-1">
                [M] Metadata & [IL]
              </span>
              <p className="text-stone-600 leading-relaxed">
                Interview Location (IL) venue tier (e.g. Publika / Mont Kiara upscale retail vs Kepong / NSK hypermarkets).
              </p>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-16 text-center shadow-2xs">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-stone-800">
            Evaluating {activeFormula.name} [{activeFormula.code}]...
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Analyzing variables ({activeFormula.analysisCodes}) across decoded interview verbatim.
          </p>
        </div>
      ) : evaluations.length > 0 ? (
        <div className="space-y-6">
          {/* Dynamic Summary Breakdown Cards for Active Formula Tiers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {activeFormula.outputTiers.map((tier, idx) => {
              const count = tierDistribution[tier] || 0;
              const percent = totalAnalyzed ? Math.round((count / totalAnalyzed) * 100) : 0;
              const colorClasses = [
                'text-emerald-700',
                'text-blue-700',
                'text-amber-700',
                'text-violet-700',
                'text-stone-700',
              ];

              return (
                <div key={tier} className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block truncate" title={tier}>
                    {tier}
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-lg font-mono font-bold ${colorClasses[idx % colorClasses.length]}`}>
                      {count}
                    </span>
                    <span className="text-xs text-stone-400">({percent}%)</span>
                  </div>
                </div>
              );
            })}

            <div className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Null (No Signals)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-mono font-bold text-stone-400">
                  {nullCount}
                </span>
                <span className="text-xs text-stone-400">
                  ({totalAnalyzed ? Math.round((nullCount / totalAnalyzed) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>

          {/* Visual Charts Section for Active Formula */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  {activeFormula.name} Distribution & Cross-Variable Visualizations
                </span>
              </div>
              <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
                <button
                  type="button"
                  onClick={() => setChartMode('pie')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    chartMode === 'pie'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <PieIcon className="w-3 h-3 inline mr-1" /> All Pie / Donut
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('bar')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    chartMode === 'bar'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <BarChart3 className="w-3 h-3 inline mr-1" /> All Bar Charts
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Card 1: Formula Tiers Distribution */}
              <div className="flex flex-col h-full">
                <AnalysisChart
                  key={`tier-${activeFormula.id}-${chartMode}`}
                  title={`${activeFormula.name} Tiers`}
                  subtitle={`Empirical evaluation across ${activeFormula.outputTiers.join(', ')}`}
                  code={activeFormula.code}
                  dimension="Cross"
                  data={formulaTierChartData}
                  totalRecords={totalAnalyzed}
                  defaultChartType={chartMode}
                />
              </div>

              {/* Card 2: Demographic Analysis - Cleanly Divided Sub-dimensions */}
              <div className="flex flex-col h-full bg-white rounded-2xl border border-stone-200 shadow-2xs p-4 justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-2 border-b border-stone-100">
                    <div>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                        Code D • Demographic
                      </span>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Separated qualitative sub-dimensions
                      </p>
                    </div>

                    {/* Sub-dimension tabs - Clean flex-wrap with no overflow scrollbars */}
                    <div className="flex items-center flex-wrap gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setDemoDimension('FR')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all whitespace-nowrap ${
                          demoDimension === 'FR'
                            ? 'bg-white text-stone-900 shadow-2xs'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="Family Role (Mum, Dad, Elderly)"
                      >
                        Role (FR)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDemoDimension('RL')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all whitespace-nowrap ${
                          demoDimension === 'RL'
                            ? 'bg-white text-stone-900 shadow-2xs'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="Residential Location (Kepong, Ampang, PJ)"
                      >
                        Location (RL)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDemoDimension('age')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all whitespace-nowrap ${
                          demoDimension === 'age'
                            ? 'bg-white text-stone-900 shadow-2xs'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="Age distribution"
                      >
                        Age
                      </button>
                      <button
                        type="button"
                        onClick={() => setDemoDimension('gender')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all whitespace-nowrap ${
                          demoDimension === 'gender'
                            ? 'bg-white text-stone-900 shadow-2xs'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="Gender (Pronoun preserved)"
                      >
                        Gender
                      </button>
                      <button
                        type="button"
                        onClick={() => setDemoDimension('education')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all whitespace-nowrap ${
                          demoDimension === 'education'
                            ? 'bg-white text-stone-900 shadow-2xs'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="Education level"
                      >
                        Edu
                      </button>
                    </div>
                  </div>

                  <AnalysisChart
                    key={`demo-${demoDimension}-${chartMode}`}
                    title={demoTitles[demoDimension].title}
                    subtitle={demoTitles[demoDimension].subtitle}
                    code={demoTitles[demoDimension].code}
                    dimension="D"
                    data={activeDemoData}
                    totalRecords={totalAnalyzed}
                    defaultChartType={chartMode}
                  />
                </div>
              </div>

              {/* Card 3: Objects & Venue Signals - Cleanly Divided */}
              <div className="flex flex-col h-full bg-white rounded-2xl border border-stone-200 shadow-2xs p-4 justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-2 border-b border-stone-100">
                    <div>
                      <span className="text-[10px] font-bold text-violet-800 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                        Codes O & M • Qualitative Signals
                      </span>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Products, brands & interview venue
                      </p>
                    </div>

                    {/* Sub-dimension tabs - Clean flex-wrap */}
                    <div className="flex items-center flex-wrap gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setObjDimension('PP')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all whitespace-nowrap ${
                          objDimension === 'PP'
                            ? 'bg-white text-stone-900 shadow-2xs'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="Products Purchased categories"
                      >
                        Products (PP)
                      </button>
                      <button
                        type="button"
                        onClick={() => setObjDimension('PP1')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all whitespace-nowrap ${
                          objDimension === 'PP1'
                            ? 'bg-white text-stone-900 shadow-2xs'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="Brand Preferences & product loyalty"
                      >
                        Brands (PP1)
                      </button>
                      <button
                        type="button"
                        onClick={() => setObjDimension('IL')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all whitespace-nowrap ${
                          objDimension === 'IL'
                            ? 'bg-white text-stone-900 shadow-2xs'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="Interview Location venue"
                      >
                        Venue (IL)
                      </button>
                    </div>
                  </div>

                  <AnalysisChart
                    key={`obj-${objDimension}-${chartMode}`}
                    title={objTitles[objDimension].title}
                    subtitle={objTitles[objDimension].subtitle}
                    code={objTitles[objDimension].code}
                    dimension={objDimension === 'IL' ? 'M' : 'O'}
                    data={activeObjData}
                    totalRecords={totalAnalyzed}
                    defaultChartType={chartMode}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Deep Analysis Matrix Table for Active Formula */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-stone-900">
                    {activeFormula.name} Evaluation Matrix
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                    {evaluations.length} Records
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Record-by-record formula evaluation: {activeFormula.name} = {activeFormula.code} ({activeFormula.analysisCodes}).
                </p>
              </div>

              {/* Table search filter */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filter by role, area, brand, tier..."
                  className="w-full sm:w-64 px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {tableSearch && (
                  <button
                    type="button"
                    onClick={() => setTableSearch('')}
                    className="text-xs text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto w-full max-w-full">
              <table className="w-full text-xs text-left min-w-[700px]">
                <thead className="bg-stone-50 text-stone-700 uppercase font-semibold text-[10px] border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Participant / File</th>
                    <th className="py-3 px-4">
                      FR <span className="font-normal text-stone-400 block sm:inline">(Role - D)</span>
                    </th>
                    <th className="py-3 px-4">
                      RL <span className="font-normal text-stone-400 block sm:inline">(Location - D)</span>
                    </th>
                    <th className="py-3 px-4">
                      Age & Gender <span className="font-normal text-stone-400 block sm:inline">(D)</span>
                    </th>
                    <th className="py-3 px-4">
                      Products & Brands <span className="font-normal text-stone-400 block sm:inline">(PP / PP1 - O)</span>
                    </th>
                    <th className="py-3 px-4">
                      Venue <span className="font-normal text-stone-400 block sm:inline">(IL - M)</span>
                    </th>
                    <th className="py-3 px-4">{activeFormula.name} Tier</th>
                    <th className="py-3 px-4 min-w-[220px]">Evidence & Justification</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {evaluations
                    .filter((ev) => {
                      if (!tableSearch.trim()) return true;
                      const q = tableSearch.toLowerCase();
                      const matching = records.find((r) => r.id === ev.recordId);
                      const fr = ev.components?.['FR'] || matching?.adkotmDecode?.postAnalysisCodes?.FR || '';
                      const rl = ev.components?.['RL'] || matching?.adkotmDecode?.postAnalysisCodes?.RL || '';
                      const pp = ev.components?.['PP'] || matching?.adkotmDecode?.postAnalysisCodes?.PP || '';
                      const pp1 = ev.components?.['PP1'] || matching?.adkotmDecode?.postAnalysisCodes?.PP1 || '';
                      const il = ev.components?.['IL'] || matching?.adkotmDecode?.postAnalysisCodes?.IL || '';
                      const tier = ev.tier || '';
                      const just = ev.justification || '';
                      return (
                        ev.fileName.toLowerCase().includes(q) ||
                        fr.toLowerCase().includes(q) ||
                        rl.toLowerCase().includes(q) ||
                        pp.toLowerCase().includes(q) ||
                        pp1.toLowerCase().includes(q) ||
                        il.toLowerCase().includes(q) ||
                        tier.toLowerCase().includes(q) ||
                        just.toLowerCase().includes(q)
                      );
                    })
                    .map((ev) => {
                      const tier = ev.tier;
                      const matchingRec = records.find((r) => r.id === ev.recordId);
                      const dec = matchingRec?.adkotmDecode;
                      const fr = ev.components?.['FR'] || ev.components?.['FR_familyRole'] || dec?.postAnalysisCodes?.FR || dec?.demographic?.familyRole || null;
                      const rl = ev.components?.['RL'] || ev.components?.['RL_residentialLocation'] || dec?.postAnalysisCodes?.RL || dec?.demographic?.residentialLocation || dec?.demographic?.residentialDistrict || null;
                      const ageVal = ev.components?.['age'] || dec?.demographic?.age || null;
                      const genderVal = ev.components?.['gender'] || dec?.demographic?.gender || null;
                      const ppVal = ev.components?.['PP'] || ev.components?.['PP_productsPurchased'] || dec?.postAnalysisCodes?.PP || dec?.objects?.productsPurchased || null;
                      const pp1Val = ev.components?.['PP1'] || ev.components?.['PP1_brandPreferences'] || dec?.postAnalysisCodes?.PP1 || dec?.objects?.brandPreferences || null;
                      const ilVal = ev.components?.['IL'] || ev.components?.['IL_interviewLocation'] || dec?.postAnalysisCodes?.IL || dec?.metadata?.interviewLocation || null;

                      return (
                        <tr key={ev.recordId} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3 px-4 max-w-[180px]">
                            <div className="font-semibold text-stone-900 truncate" title={ev.fileName}>
                              {ev.fileName}
                            </div>
                            {matchingRec?.folderName && (
                              <div className="text-[10px] text-stone-400 truncate mt-0.5">
                                Folder: {matchingRec.folderName}
                              </div>
                            )}
                          </td>
                          {/* FR: Family Role */}
                          <td className="py-3 px-4">
                            {renderValue(fr)}
                          </td>
                          {/* RL: Residential Location */}
                          <td className="py-3 px-4">
                            {renderValue(rl)}
                          </td>
                          {/* Age & Gender */}
                          <td className="py-3 px-4">
                            {ageVal || genderVal ? (
                              <div className="text-stone-800">
                                {ageVal ? <span className="font-semibold">{ageVal}</span> : <span className="font-mono text-stone-400">null</span>}
                                <span className="text-stone-400 mx-1">•</span>
                                {genderVal ? <span>{genderVal}</span> : <span className="font-mono text-stone-400">null</span>}
                              </div>
                            ) : (
                              renderValue(null)
                            )}
                          </td>
                          {/* Products & Brands */}
                          <td className="py-3 px-4 max-w-[200px]">
                            {ppVal || pp1Val ? (
                              <div>
                                {ppVal && <div className="font-semibold text-stone-800 truncate" title={ppVal}>{ppVal}</div>}
                                {pp1Val && (
                                  <div className="text-[11px] text-stone-500 font-medium truncate mt-0.5" title={pp1Val}>
                                    Brand: {pp1Val}
                                  </div>
                                )}
                              </div>
                            ) : (
                              renderValue(null)
                            )}
                          </td>
                          {/* Venue IL */}
                          <td className="py-3 px-4 max-w-[140px] truncate" title={ilVal || ''}>
                            {renderValue(ilVal)}
                          </td>
                          {/* Tier */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {tier ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                                {tier}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-stone-100 text-stone-400 border border-stone-200">
                                null
                              </span>
                            )}
                          </td>
                          {/* Evidence & Justification */}
                          <td className="py-3 px-4 text-stone-600 leading-relaxed max-w-[260px]">
                            {ev.justification || (
                              <span className="font-mono text-stone-400 text-[11px]">null</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenOverride(ev)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Override</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const matchingRec = records.find((r) => r.id === ev.recordId);
                                if (matchingRec) {
                                  setCrudRecordToEdit(matchingRec);
                                  setIsCrudModalOpen(true);
                                }
                              }}
                              className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded cursor-pointer"
                            >
                              CRUD
                            </button>
                            {onDeleteRecord && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Delete participant and analysis for "${ev.fileName}"?`)) {
                                    onDeleteRecord(ev.recordId);
                                  }
                                }}
                                className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                                title="Delete record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-2xs">
          <Info className="w-8 h-8 text-stone-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-stone-800">
            No data evaluated for {activeFormula.name}
          </h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Click "Re-Compute {activeFormula.name}" above to evaluate {activeFormula.code} against decoded interview recordings.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                setCrudRecordToEdit(null);
                setIsCrudModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> + Add First Participant
            </button>
          </div>
        </div>
      )}

      {/* Manual Formula Tier Override Modal */}
      {overrideEval && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-stone-200 bg-indigo-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Override {activeFormula.name}: {overrideEval.fileName}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Formula: {activeFormula.name} = {activeFormula.code} ({activeFormula.analysisCodes})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOverrideEval(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1.5">
                  Select Classification Tier
                </label>
                <div className="flex flex-wrap gap-2">
                  {[...activeFormula.outputTiers, 'null'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOverrideTier(t)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                        overrideTier === t
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Qualitative Rationale & Evidentiary Justification
                </label>
                <textarea
                  value={overrideJustification}
                  onChange={(e) => setOverrideJustification(e.target.value)}
                  rows={3}
                  placeholder="Provide research justification for this classification..."
                  className="w-full p-2.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOverrideEval(null)}
                className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOverride}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer shadow-xs"
              >
                <Check className="w-3.5 h-3.5" /> Save Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formula Builder Modal: Add or Edit Formulas */}
      <FormulaBuilderModal
        isOpen={isFormulaModalOpen}
        onClose={() => {
          setIsFormulaModalOpen(false);
          setFormulaToEdit(null);
        }}
        formulaToEdit={formulaToEdit}
        onSaveFormula={handleSaveFormula}
      />

      {/* Full Qualitative Decode & Cross-Analysis CRUD Modal */}
      <DecodeCrudModal
        isOpen={isCrudModalOpen}
        onClose={() => setIsCrudModalOpen(false)}
        recordToEdit={crudRecordToEdit}
        onSaveRecord={(savedRecord) => {
          if (onUpdateRecord) {
            onUpdateRecord(savedRecord);
          }
          if (!crudRecordToEdit && onAddRecord) {
            onAddRecord(savedRecord);
          }
        }}
        onDeleteRecord={(id) => {
          if (onDeleteRecord) {
            onDeleteRecord(id);
          }
          setEvaluations((prev) => prev.filter((e) => e.recordId !== id));
        }}
      />
    </div>
  );
};
