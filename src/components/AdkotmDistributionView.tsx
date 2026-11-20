import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Layers,
  ArrowRight,
  Package,
  Activity,
  BookOpen,
  Users,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { InterviewRecord, ADKOTMDecode } from '../types';
import { isAnalysisEligibleRecord } from '../lib/recordEligibility';

interface AdkotmDistributionViewProps {
  records: InterviewRecord[];
  onProceedToAnalytics?: () => void;
  onSelectRecord?: (recordId: string) => void;
  embedded?: boolean;
}

export type DimensionKey = 'O' | 'A' | 'K' | 'D' | 'T' | 'M';

export interface DimensionMeta {
  key: DimensionKey;
  name: string;
  fullName: string;
  color: string;
  bgLight: string;
  borderLight: string;
  textDark: string;
  icon: React.FC<{ className?: string }>;
  description: string;
  subfields: string[];
}

export const DIMENSIONS: Record<DimensionKey, DimensionMeta> = {
  O: {
    key: 'O',
    name: 'Object (O)',
    fullName: 'Objects & Products',
    color: '#f59e0b', // amber-500
    bgLight: 'bg-amber-50',
    borderLight: 'border-amber-200',
    textDark: 'text-amber-900',
    icon: Package,
    description: 'Products purchased, brands, food vs supplement solutions',
    subfields: ['Products Purchased (PP)', 'Brand Preferences (PP1)', 'Food Products', 'Supplements', 'Actions to Solve'],
  },
  A: {
    key: 'A',
    name: 'Activity (A)',
    fullName: 'Activities & Behaviors',
    color: '#10b981', // emerald-500
    bgLight: 'bg-emerald-50',
    borderLight: 'border-emerald-200',
    textDark: 'text-emerald-900',
    icon: Activity,
    description: 'Daily routines, shopping behaviour, eating context & food prep',
    subfields: ['Daily Routine', 'Shopping Behaviour', 'Food Consumption', 'Food Preparation', 'Eating Context'],
  },
  K: {
    key: 'K',
    name: 'Knowledge (K)',
    fullName: 'Knowledge & Awareness',
    color: '#6366f1', // indigo-500
    bgLight: 'bg-indigo-50',
    borderLight: 'border-indigo-200',
    textDark: 'text-indigo-900',
    icon: BookOpen,
    description: 'Awareness on gut health, probiotics, understanding level',
    subfields: ['Gut Health Awareness (AW)', 'Awareness Level', 'Understanding Summary'],
  },
  D: {
    key: 'D',
    name: 'Demographic (D)',
    fullName: 'Demographics & Life Stage',
    color: '#0ea5e9', // sky-500
    bgLight: 'bg-sky-50',
    borderLight: 'border-sky-200',
    textDark: 'text-sky-900',
    icon: Users,
    description: 'Family role (Mum, Dad, Elderly), residential location, age',
    subfields: ['Family Role (FR)', 'Location (RL)', 'Age Bracket', 'Gender', 'Household'],
  },
  T: {
    key: 'T',
    name: 'Time (T)',
    fullName: 'Timing & Frequency',
    color: '#f43f5e', // rose-500
    bgLight: 'bg-rose-50',
    borderLight: 'border-rose-200',
    textDark: 'text-rose-900',
    icon: Clock,
    description: 'Purchase frequency, consumption timing & occasions',
    subfields: ['Purchase Frequency', 'Consumption Frequency', 'Purchase Timing', 'Occasions'],
  },
  M: {
    key: 'M',
    name: 'Metadata (M)',
    fullName: 'Session Context & Venue',
    color: '#64748b', // slate-500
    bgLight: 'bg-slate-50',
    borderLight: 'border-slate-200',
    textDark: 'text-slate-900',
    icon: MapPin,
    description: 'Interview retail venue, date & field recording context',
    subfields: ['Interview Location (IL)', 'Session Date', 'Field Context'],
  },
};

export const DIMENSION_KEYS: DimensionKey[] = ['O', 'A', 'K', 'D', 'T', 'M'];

export const calculateAverageDimensionPercentages = (
  breakdowns: { total: number; percentages: Record<DimensionKey, number> }[]
): { recordingCount: number; percentages: Record<DimensionKey, number> } => {
  const recordingsWithSignals = breakdowns.filter((recording) => recording.total > 0);
  const percentages: Record<DimensionKey, number> = { O: 0, A: 0, K: 0, D: 0, T: 0, M: 0 };

  DIMENSION_KEYS.forEach((key) => {
    const sum = recordingsWithSignals.reduce((total, recording) => total + recording.percentages[key], 0);
    percentages[key] = recordingsWithSignals.length
      ? Math.round((sum / recordingsWithSignals.length) * 10) / 10
      : 0;
  });

  if (recordingsWithSignals.length > 0) {
    const largestDimension = DIMENSION_KEYS.reduce((largest, key) =>
      percentages[key] > percentages[largest] ? key : largest
    );
    const roundedTotal = DIMENSION_KEYS.reduce((sum, key) => sum + percentages[key], 0);
    percentages[largestDimension] = Math.round((percentages[largestDimension] + 100 - roundedTotal) * 10) / 10;
  }

  return { recordingCount: recordingsWithSignals.length, percentages };
};

// Helper to check if a value is meaningful
const hasValue = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s !== '' && s !== 'null' && s !== 'not mentioned' && s !== 'unstated';
  }
  if (Array.isArray(val)) {
    return val.some(hasValue);
  }
  if (typeof val === 'object') {
    return Object.values(val).some(hasValue);
  }
  return true;
};

// Count qualitative signal units for a decode across each dimension
export const countDimensionSignals = (decode?: ADKOTMDecode | null): Record<DimensionKey, number> => {
  const counts: Record<DimensionKey, number> = { O: 0, A: 0, K: 0, D: 0, T: 0, M: 0 };
  if (!decode) return counts;

  // 1. Objects (O)
  if (hasValue(decode.objects?.productsPurchased)) counts.O++;
  if (hasValue(decode.objects?.brandPreferences)) counts.O++;
  if (hasValue(decode.objects?.productCategory)) counts.O++;
  if (Array.isArray(decode.objects?.foodProducts)) {
    counts.O += decode.objects.foodProducts.filter(hasValue).length;
  } else if (hasValue(decode.objects?.foodProducts)) counts.O++;

  if (Array.isArray(decode.objects?.supplementProducts)) {
    counts.O += decode.objects.supplementProducts.filter(hasValue).length;
  } else if (hasValue(decode.objects?.supplementProducts)) counts.O++;

  if (Array.isArray(decode.objects?.actionsToSolve)) {
    counts.O += decode.objects.actionsToSolve.filter(hasValue).length;
  } else if (hasValue(decode.objects?.actionsToSolve)) counts.O++;

  if (hasValue(decode.postAnalysisCodes?.PP) && !counts.O) counts.O++;
  if (hasValue(decode.postAnalysisCodes?.PP1) && counts.O <= 1) counts.O++;

  // 2. Activities (A)
  if (hasValue(decode.activities?.dailyRoutine)) counts.A++;
  if (hasValue(decode.activities?.shoppingBehaviour)) counts.A++;
  if (hasValue(decode.activities?.foodConsumptionBehaviour)) counts.A++;
  if (hasValue(decode.activities?.foodPreparation)) counts.A++;
  if (hasValue(decode.activities?.eatingContext)) counts.A++;

  // 3. Knowledge (K)
  if (hasValue(decode.knowledge?.awarenessOnGutHealth)) counts.K++;
  if (hasValue(decode.knowledge?.awarenessLevel)) counts.K++;
  if (hasValue(decode.knowledge?.understandingSummary)) counts.K++;
  if (hasValue(decode.postAnalysisCodes?.AW) && !counts.K) counts.K++;

  // 4. Demographic (D)
  if (hasValue(decode.demographic?.familyRole)) counts.D++;
  if (hasValue(decode.demographic?.residentialLocation) || hasValue(decode.demographic?.residentialDistrict)) counts.D++;
  if (hasValue(decode.demographic?.age)) counts.D++;
  if (hasValue(decode.demographic?.gender)) counts.D++;
  if (hasValue(decode.demographic?.householdComposition)) counts.D++;
  if (hasValue(decode.demographic?.educationLevel)) counts.D++;
  if (hasValue(decode.postAnalysisCodes?.FR) && !counts.D) counts.D++;
  if (hasValue(decode.postAnalysisCodes?.RL) && counts.D <= 1) counts.D++;

  // 5. Time (T)
  if (hasValue(decode.time?.purchaseFrequency)) counts.T++;
  if (hasValue(decode.time?.consumptionFrequency)) counts.T++;
  if (hasValue(decode.time?.purchaseTiming)) counts.T++;
  if (hasValue(decode.time?.purchaseOccasion)) counts.T++;
  if (hasValue(decode.time?.consumptionTiming)) counts.T++;

  // 6. Metadata (M)
  if (hasValue(decode.metadata?.interviewLocation)) counts.M++;
  if (hasValue(decode.metadata?.interviewTime)) counts.M++;
  if (hasValue(decode.postAnalysisCodes?.IL) && !counts.M) counts.M++;

  return counts;
};

export const AdkotmDistributionView: React.FC<AdkotmDistributionViewProps> = ({
  records,
  onProceedToAnalytics,
  onSelectRecord,
  embedded = false,
}) => {
  const [selectedDimension, setSelectedDimension] = useState<DimensionKey>('O');
  const [activeVisualMode, setActiveVisualMode] = useState<'consolidated' | 'average'>('consolidated');
  const [participantSort, setParticipantSort] = useState<'name' | 'object' | 'activity' | 'signals'>('signals');
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(null);
  const [selectedDropdownRecordingId, setSelectedDropdownRecordingId] = useState<string | null>(null);
  const [showAllAccordion, setShowAllAccordion] = useState(false);

  const eligibleRecords = useMemo(
    () => records.filter(isAnalysisEligibleRecord),
    [records]
  );
  const decodedRecords = useMemo(
    () => eligibleRecords.filter((r) => r.adkotmDecode),
    [eligibleRecords]
  );

  // Compute aggregate signal counts and percentages
  const stats = useMemo(() => {
    const totalSignalsPerDim: Record<DimensionKey, number> = { O: 0, A: 0, K: 0, D: 0, T: 0, M: 0 };
    const participantBreakdowns: {
      record: InterviewRecord;
      signals: Record<DimensionKey, number>;
      total: number;
      percentages: Record<DimensionKey, number>;
    }[] = [];

    decodedRecords.forEach((record) => {
      const counts = countDimensionSignals(record.adkotmDecode);
      let participantTotal = 0;

      DIMENSION_KEYS.forEach((k) => {
        totalSignalsPerDim[k] += counts[k];
        participantTotal += counts[k];
      });

      const percentages: Record<DimensionKey, number> = { O: 0, A: 0, K: 0, D: 0, T: 0, M: 0 };
      DIMENSION_KEYS.forEach((k) => {
        percentages[k] = participantTotal > 0 ? (counts[k] / participantTotal) * 100 : 0;
      });

      participantBreakdowns.push({
        record,
        signals: counts,
        total: participantTotal,
        percentages,
      });
    });

    const grandTotal = Object.values(totalSignalsPerDim).reduce((sum, n) => sum + n, 0);

    const overallPercentages: Record<DimensionKey, number> = { O: 0, A: 0, K: 0, D: 0, T: 0, M: 0 };
    DIMENSION_KEYS.forEach((k) => {
      overallPercentages[k] = grandTotal > 0 ? Math.round((totalSignalsPerDim[k] / grandTotal) * 1000) / 10 : 0;
    });

    const averageDistribution = calculateAverageDimensionPercentages(participantBreakdowns);
    const recordingsWithSignals = participantBreakdowns.filter((participant) => participant.total > 0);
    const averageSignalsPerDim: Record<DimensionKey, number> = { O: 0, A: 0, K: 0, D: 0, T: 0, M: 0 };
    DIMENSION_KEYS.forEach((k) => {
      averageSignalsPerDim[k] = recordingsWithSignals.length
        ? Math.round((totalSignalsPerDim[k] / recordingsWithSignals.length) * 10) / 10
        : 0;
    });
    const averageSignalsPerRecording = recordingsWithSignals.length
      ? Math.round((grandTotal / recordingsWithSignals.length) * 10) / 10
      : 0;

    const sortedDims = [...DIMENSION_KEYS].sort(
      (a, b) => totalSignalsPerDim[b] - totalSignalsPerDim[a]
    );

    return {
      totalSignalsPerDim,
      grandTotal,
      overallPercentages,
      averagePercentages: averageDistribution.percentages,
      averageSignalsPerDim,
      averageSignalsPerRecording,
      recordingsWithSignals: averageDistribution.recordingCount,
      sortedDims,
      participantBreakdowns,
    };
  }, [decodedRecords]);

  // Sorted participants for the participant-level breakdown
  const sortedParticipants = useMemo(() => {
    return [...stats.participantBreakdowns].sort((a, b) => {
      if (participantSort === 'name') return a.record.fileName.localeCompare(b.record.fileName);
      if (participantSort === 'object') return b.percentages.O - a.percentages.O;
      if (participantSort === 'activity') return b.percentages.A - a.percentages.A;
      return b.total - a.total;
    });
  }, [stats.participantBreakdowns, participantSort]);

  // Extract qualitative samples for selected dimension
  const qualitativeTokens = useMemo(() => {
    const tokens: { text: string; count: number; participant: string }[] = [];
    const quoteList: { quote: string; participant: string; code: string }[] = [];

    decodedRecords.forEach((r) => {
      const d = r.adkotmDecode;
      if (!d) return;

      const pName = r.fileName;

      if (selectedDimension === 'O') {
        if (d.objects?.productsPurchased) tokens.push({ text: d.objects.productsPurchased, count: 1, participant: pName });
        if (d.objects?.brandPreferences) tokens.push({ text: d.objects.brandPreferences, count: 1, participant: pName });
        if (Array.isArray(d.objects?.foodProducts)) {
          d.objects.foodProducts.forEach((f) => tokens.push({ text: String(f), count: 1, participant: pName }));
        }
        if (Array.isArray(d.objects?.supplementProducts)) {
          d.objects.supplementProducts.forEach((s) => tokens.push({ text: String(s), count: 1, participant: pName }));
        }
      } else if (selectedDimension === 'A') {
        if (d.activities?.dailyRoutine) tokens.push({ text: d.activities.dailyRoutine, count: 1, participant: pName });
        if (d.activities?.shoppingBehaviour) tokens.push({ text: d.activities.shoppingBehaviour, count: 1, participant: pName });
        if (d.activities?.foodConsumptionBehaviour) tokens.push({ text: d.activities.foodConsumptionBehaviour, count: 1, participant: pName });
        if (d.activities?.eatingContext) tokens.push({ text: d.activities.eatingContext, count: 1, participant: pName });
      } else if (selectedDimension === 'K') {
        if (d.knowledge?.awarenessOnGutHealth) tokens.push({ text: d.knowledge.awarenessOnGutHealth, count: 1, participant: pName });
        if (d.knowledge?.understandingSummary) tokens.push({ text: d.knowledge.understandingSummary, count: 1, participant: pName });
      } else if (selectedDimension === 'D') {
        if (d.demographic?.familyRole) tokens.push({ text: d.demographic.familyRole, count: 1, participant: pName });
        if (d.demographic?.residentialLocation) tokens.push({ text: d.demographic.residentialLocation, count: 1, participant: pName });
        if (d.demographic?.age) tokens.push({ text: `Age: ${d.demographic.age}`, count: 1, participant: pName });
      } else if (selectedDimension === 'T') {
        if (d.time?.purchaseFrequency) tokens.push({ text: d.time.purchaseFrequency, count: 1, participant: pName });
        if (d.time?.consumptionTiming) tokens.push({ text: d.time.consumptionTiming, count: 1, participant: pName });
      } else if (selectedDimension === 'M') {
        if (d.metadata?.interviewLocation) tokens.push({ text: d.metadata.interviewLocation, count: 1, participant: pName });
      }

      // Collect quotes
      if (Array.isArray(d.evidenceQuotes)) {
        d.evidenceQuotes.forEach((eq) => {
          if (eq.code?.toUpperCase().startsWith(selectedDimension) || selectedDimension === 'O') {
            quoteList.push({ quote: eq.quote, participant: pName, code: eq.code });
          }
        });
      }
    });

    return { tokens: tokens.slice(0, 16), quotes: quoteList.slice(0, 4) };
  }, [decodedRecords, selectedDimension]);

  const displayedPercentages = activeVisualMode === 'average' ? stats.averagePercentages : stats.overallPercentages;
  const displayedSignalCounts = activeVisualMode === 'average' ? stats.averageSignalsPerDim : stats.totalSignalsPerDim;

  // Helper to detect unstated/null values for consistent grey rendering
  const isUnstatedText = (text?: string | null): boolean => {
    if (!text) return true;
    const t = text.trim().toLowerCase();
    return (
      t === '' ||
      t === 'null' ||
      t === 'unstated' ||
      t === 'unknown' ||
      t === 'none' ||
      t.includes('unstated') ||
      t.includes('null') ||
      t.includes('not mentioned')
    );
  };

  const activeRecordingBreakdown = useMemo(() => {
    if (selectedDropdownRecordingId) {
      const found = sortedParticipants.find((p) => p.record.id === selectedDropdownRecordingId);
      if (found) return found;
    }
    return sortedParticipants[0] || null;
  }, [selectedDropdownRecordingId, sortedParticipants]);

  return (
    <div className={embedded ? 'divide-y divide-stone-200' : 'space-y-6'}>
      {/* 1. CONSOLIDATED OVERVIEW: Overall ADKOTM Dimension Distribution (Meaningful info only) */}
      <div
        className={
          embedded
            ? 'p-5 sm:p-6 space-y-5'
            : 'bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-5'
        }
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                %
              </span>
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2 flex-wrap">
                  <span>ADKOTM Dimension Breakdown</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    ADKOTM Taxonomy
                  </span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {activeVisualMode === 'average'
                    ? `Average code distribution across ${stats.recordingsWithSignals} recordings with extracted signals; each recording is weighted equally.`
                    : `Consolidated distribution across all ${stats.grandTotal} empirical qualitative signals from ${decodedRecords.length} interview recordings.`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* Distribution mode switcher */}
            <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveVisualMode('consolidated')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold cursor-pointer transition-all ${
                  activeVisualMode === 'consolidated'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Consolidated</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveVisualMode('average')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold cursor-pointer transition-all ${
                  activeVisualMode === 'average'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Average per Recording</span>
              </button>
            </div>

            {onProceedToAnalytics && (
              <button
                type="button"
                onClick={onProceedToAnalytics}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-xs cursor-pointer transition-all whitespace-nowrap shrink-0"
              >
                <span>Theme Insights →</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Visualization Area: pooled or equal-weight per-recording shares */}
        <div className="space-y-2">
          <div className="w-full h-11 rounded-xl overflow-hidden flex shadow-inner border border-stone-200 p-0.5 bg-stone-100">
            {DIMENSION_KEYS.map((k) => {
              const meta = DIMENSIONS[k];
              const pct = displayedPercentages[k];
              if (pct <= 0) return null;
              const isSelected = selectedDimension === k;
              const signalText = activeVisualMode === 'average'
                ? `${stats.averageSignalsPerDim[k]} average signals per recording`
                : `${stats.totalSignalsPerDim[k]} signals`;

              return (
                <div
                  key={k}
                  onClick={() => setSelectedDimension(k)}
                  className={`h-full transition-all cursor-pointer relative group flex items-center justify-center text-white font-bold text-xs ${
                    isSelected ? 'ring-2 ring-stone-900 ring-offset-1 z-10' : 'opacity-95 hover:opacity-100'
                  }`}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: meta.color,
                    minWidth: pct > 4 ? '36px' : '16px',
                  }}
                  title={`${meta.fullName}: ${pct}% (${signalText}) — Click to inspect`}
                >
                  {pct >= 6 && (
                    <span className="drop-shadow-xs truncate px-1 text-[11px] font-mono">
                      {k} {pct}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono px-1">
            <span>0%</span>
            <span>{activeVisualMode === 'average'
              ? `100% Average Code Distribution (${stats.recordingsWithSignals} recordings)`
              : `100% Consolidated Distribution (${stats.grandTotal} signals)`}</span>
            <span>100%</span>
          </div>
        </div>

        {/* Consolidated Interactive Dimension Metric Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {DIMENSION_KEYS.map((k) => {
            const meta = DIMENSIONS[k];
            const count = displayedSignalCounts[k];
            const pct = displayedPercentages[k];
            const isSelected = selectedDimension === k;
            const isCore = k === 'O' || k === 'A';

            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedDimension(k)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'ring-2 shadow-xs scale-101'
                    : 'hover:border-stone-300'
                } ${meta.bgLight} ${meta.borderLight}`}
                style={isSelected ? { outlineColor: meta.color } : {}}
              >
                {isCore && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded text-[8px] font-bold tracking-wider uppercase bg-white/90 text-stone-700 border border-stone-200">
                    Core
                  </span>
                )}
                <div className={`flex items-start gap-1.5 mb-1 ${isCore ? 'pr-9' : ''}`}>
                  <span
                    className="w-4 h-4 mt-0.5 rounded text-white flex items-center justify-center font-bold text-[10px] shrink-0"
                    style={{ backgroundColor: meta.color }}
                  >
                    {k}
                  </span>
                  <span className={`text-xs font-bold leading-tight ${meta.textDark}`}>
                    {meta.fullName}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-lg font-extrabold text-stone-900 font-mono tracking-tight tabular-nums">
                    {pct}%
                  </span>
                  <span className="text-[10px] font-mono text-stone-500 tabular-nums">
                    ({activeVisualMode === 'average' ? `${count.toFixed(1)} avg` : count})
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Meaningful Behavioral Balance Callout (Object vs Activity) */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-full font-bold font-mono text-[11px] bg-amber-200 text-amber-950 border border-amber-300">
              Core Ratio
            </span>
            <span className="text-amber-950 font-medium">
              <strong>Object (O: {displayedPercentages.O}%)</strong> vs <strong>Activity (A: {displayedPercentages.A}%)</strong> — {activeVisualMode === 'average' ? 'Average recording composition' : 'Pooled signals'} has <strong>{(displayedPercentages.O / Math.max(displayedPercentages.A, 1)).toFixed(1)}x</strong> the Object share of Activity.
            </span>
          </div>
          <span className="text-[11px] text-amber-800 font-mono shrink-0">
            {activeVisualMode === 'average'
              ? `${stats.averageSignalsPerDim.O.toFixed(1)} Object • ${stats.averageSignalsPerDim.A.toFixed(1)} Activity signals per recording`
              : `${stats.totalSignalsPerDim.O} Object signals • ${stats.totalSignalsPerDim.A} Activity signals`}
          </span>
        </div>

        {/* Active Dimension Qualitative Deep Dive */}
        <div className={`p-4 rounded-xl border ${DIMENSIONS[selectedDimension].bgLight} ${DIMENSIONS[selectedDimension].borderLight}`}>
          <div className="flex items-center justify-between pb-2 border-b border-black/5">
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-md text-white flex items-center justify-center font-bold text-xs"
                style={{ backgroundColor: DIMENSIONS[selectedDimension].color }}
              >
                {selectedDimension}
              </span>
              <div>
                <h5 className="text-xs font-bold text-stone-900">
                  {DIMENSIONS[selectedDimension].fullName} ({displayedPercentages[selectedDimension]}% {activeVisualMode === 'average' ? 'of the average recording' : 'of all pooled signals'})
                </h5>
                <p className="text-[11px] text-stone-600">
                  {DIMENSIONS[selectedDimension].description}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-stone-800">
              {activeVisualMode === 'average'
                ? `${stats.averageSignalsPerDim[selectedDimension].toFixed(1)} Avg Signals / Recording`
                : `${stats.totalSignalsPerDim[selectedDimension]} Signals`}
            </span>
          </div>

          <div className="mt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1.5">
              Parameters Mapped in Dimension {selectedDimension}:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DIMENSIONS[selectedDimension].subfields.map((sf) => (
                <span
                  key={sf}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/90 text-stone-800 border border-stone-200/80 shadow-2xs"
                >
                  {sf}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-black/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1.5">
              Sample Extracted Empirical Values from Interviews:
            </span>
            {qualitativeTokens.tokens.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No signals extracted for this dimension yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {qualitativeTokens.tokens.map((token, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md text-xs font-semibold bg-white text-stone-800 border border-stone-200 truncate max-w-[240px]"
                    title={`${token.text} (${token.participant})`}
                  >
                    {token.text}
                  </span>
                ))}
              </div>
            )}
          </div>

          {qualitativeTokens.quotes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-black/5 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                Verbatim Interview Quotes:
              </span>
              {qualitativeTokens.quotes.map((q, idx) => (
                <div key={idx} className="bg-white/90 rounded-lg p-2 border border-stone-200/80 text-xs">
                  <p className="italic text-stone-800">"{q.quote}"</p>
                  <span className="text-[10px] font-mono text-stone-400 mt-0.5 block">
                    — {q.participant}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. PER-RECORDING DECODE RESULTS (DROPDOWN SELECTION & COLLAPSIBLE ACCORDION) */}
      <div
        className={
          embedded
            ? 'p-5 sm:p-6 space-y-4'
            : 'bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-4'
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>Per-Recording Decode Breakdown</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700">
                {sortedParticipants.length} Interviews
              </span>
            </h4>
            <p className="text-xs text-stone-500 mt-0.5">
              Inspect how any individual recording balances Object, Activity, and other qualitative dimensions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-stone-500">Sort by:</span>
            <select
              value={participantSort}
              onChange={(e) => setParticipantSort(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-700 cursor-pointer"
            >
              <option value="signals">Total Signals</option>
              <option value="object">% Object (O)</option>
              <option value="activity">% Activity (A)</option>
              <option value="name">Participant Name</option>
            </select>
          </div>
        </div>

        {/* PRIMARY DROPDOWN SELECTOR: HIDES PER-RECORDING RESULTS CLEANLY */}
        <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-bold text-stone-800">
              Select Recording to Inspect Decode:
            </span>
          </div>

          <select
            value={selectedDropdownRecordingId || (sortedParticipants[0]?.record.id ?? '')}
            onChange={(e) => setSelectedDropdownRecordingId(e.target.value)}
            className="w-full sm:w-auto sm:min-w-[320px] max-w-full text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white font-medium text-stone-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
          >
            {sortedParticipants.map(({ record, total }) => {
              const fr = record.adkotmDecode?.postAnalysisCodes?.FR || record.adkotmDecode?.demographic?.familyRole || 'Unstated';
              return (
                <option key={record.id} value={record.id}>
                  {record.fileName} ({total} signals • {fr})
                </option>
              );
            })}
          </select>
        </div>

        {/* SELECTED RECORDING DECODE PREVIEW CARD */}
        {activeRecordingBreakdown && (
          <div className="p-4 rounded-xl border-2 border-amber-300/80 bg-amber-50/20 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-xs font-bold text-stone-900">
                  {activeRecordingBreakdown.record.fileName}
                </span>
                {(() => {
                  const fr = activeRecordingBreakdown.record.adkotmDecode?.postAnalysisCodes?.FR || activeRecordingBreakdown.record.adkotmDecode?.demographic?.familyRole || 'Unstated';
                  const isGreyFr = isUnstatedText(fr);
                  return (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        isGreyFr
                          ? 'bg-stone-100 text-stone-600 border border-stone-300 font-medium'
                          : 'bg-amber-50 text-amber-900 border border-amber-200 font-semibold'
                      }`}
                    >
                      {fr}
                    </span>
                  );
                })()}
                {(() => {
                  const fr = activeRecordingBreakdown.record.adkotmDecode?.postAnalysisCodes?.FR || activeRecordingBreakdown.record.adkotmDecode?.demographic?.familyRole || 'Unstated';
                  const isGreyFr = isUnstatedText(fr);
                  return (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        isGreyFr
                          ? 'bg-stone-100 text-stone-600 border border-stone-300 font-medium'
                          : 'bg-amber-50 text-amber-900 border border-amber-200 font-semibold'
                      }`}
                    >
                      FR: {fr}
                    </span>
                  );
                })()}
                {(() => {
                  const rl = activeRecordingBreakdown.record.adkotmDecode?.postAnalysisCodes?.RL || activeRecordingBreakdown.record.adkotmDecode?.demographic?.residentialLocation || 'Unstated';
                  const isGreyRl = isUnstatedText(rl);
                  return (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        isGreyRl
                          ? 'bg-stone-100 text-stone-600 border border-stone-300 font-medium'
                          : 'bg-sky-50 text-sky-900 border border-sky-200 font-semibold'
                      }`}
                    >
                      RL (Home): {rl}
                    </span>
                  );
                })()}
                {(() => {
                  const il = activeRecordingBreakdown.record.adkotmDecode?.postAnalysisCodes?.IL || activeRecordingBreakdown.record.adkotmDecode?.metadata?.interviewLocation || activeRecordingBreakdown.record.sessionLocation || 'Unstated';
                  const isGreyIl = isUnstatedText(il);
                  return (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        isGreyIl
                          ? 'bg-stone-100 text-stone-600 border border-stone-300 font-medium'
                          : 'bg-slate-100 text-slate-800 border border-slate-300 font-semibold'
                      }`}
                    >
                      IL (Venue): {il}
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-mono font-bold text-stone-700">
                  {activeRecordingBreakdown.total} signals decoded
                </span>
                {onSelectRecord && (
                  <button
                    type="button"
                    onClick={() => onSelectRecord(activeRecordingBreakdown.record.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white border border-stone-300 hover:bg-stone-100 cursor-pointer shadow-2xs"
                  >
                    Inspect Full Card
                  </button>
                )}
              </div>
            </div>

            {/* Individual 100% Stacked Bar */}
            <div className="w-full h-4 rounded-md overflow-hidden flex bg-stone-100 border border-stone-200">
              {DIMENSION_KEYS.map((k) => {
                const pct = Math.round(activeRecordingBreakdown.percentages[k] * 10) / 10;
                if (pct <= 0) return null;
                return (
                  <div
                    key={k}
                    className="h-full relative group transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: DIMENSIONS[k].color,
                    }}
                    title={`${DIMENSIONS[k].name}: ${pct}% (${activeRecordingBreakdown.signals[k]} signals)`}
                  />
                );
              })}
            </div>

            {/* Quantitative % Tagline */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-stone-600">
              <span className="font-semibold text-amber-700">
                O: {Math.round(activeRecordingBreakdown.percentages.O)}% ({activeRecordingBreakdown.signals.O})
              </span>
              <span className="font-semibold text-emerald-700">
                A: {Math.round(activeRecordingBreakdown.percentages.A)}% ({activeRecordingBreakdown.signals.A})
              </span>
              <span className="text-indigo-700">
                K: {Math.round(activeRecordingBreakdown.percentages.K)}% ({activeRecordingBreakdown.signals.K})
              </span>
              <span className="text-sky-700">
                D: {Math.round(activeRecordingBreakdown.percentages.D)}% ({activeRecordingBreakdown.signals.D})
              </span>
              <span className="text-rose-700">
                T: {Math.round(activeRecordingBreakdown.percentages.T)}% ({activeRecordingBreakdown.signals.T})
              </span>
              <span className="text-slate-600">
                M: {Math.round(activeRecordingBreakdown.percentages.M)}% ({activeRecordingBreakdown.signals.M})
              </span>
            </div>

            {/* Qualitative Mentions Preview */}
            {activeRecordingBreakdown.record.adkotmDecode && (
              <div className="pt-2.5 border-t border-amber-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-stone-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">
                    Object (O) Mentions
                  </span>
                  <p className="text-stone-800 text-[11px] leading-relaxed truncate">
                    {activeRecordingBreakdown.record.adkotmDecode.objects?.productsPurchased || activeRecordingBreakdown.record.adkotmDecode.postAnalysisCodes?.PP || 'null'}
                    {activeRecordingBreakdown.record.adkotmDecode.objects?.brandPreferences ? ` • Brand: ${activeRecordingBreakdown.record.adkotmDecode.objects.brandPreferences}` : ''}
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-stone-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                    Activity (A) Routines
                  </span>
                  <p className="text-stone-800 text-[11px] leading-relaxed truncate">
                    {activeRecordingBreakdown.record.adkotmDecode.activities?.dailyRoutine || activeRecordingBreakdown.record.adkotmDecode.activities?.foodConsumptionBehaviour || 'null'}
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-stone-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 block mb-1">
                    Knowledge (K) Literacy
                  </span>
                  <p className="text-stone-800 text-[11px] leading-relaxed truncate">
                    {activeRecordingBreakdown.record.adkotmDecode.knowledge?.awarenessOnGutHealth || activeRecordingBreakdown.record.adkotmDecode.postAnalysisCodes?.AW || 'null'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ACCORDION TOGGLE: BROWSE ALL RECORDINGS IN COLLAPSIBLE ROWS */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAllAccordion(!showAllAccordion)}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200/80 text-stone-700 flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>
              {showAllAccordion ? 'Hide All Recording Rows' : `Browse All ${sortedParticipants.length} Recording Rows in Dropdowns`}
            </span>
            {showAllAccordion ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAllAccordion && (
            <div className="space-y-2 mt-3 pt-2 border-t border-stone-100">
              {sortedParticipants.map(({ record, signals, total, percentages }) => {
                const isExpanded = expandedParticipantId === record.id;
                const fr = record.adkotmDecode?.postAnalysisCodes?.FR || record.adkotmDecode?.demographic?.familyRole || 'Unstated';
                const rl = record.adkotmDecode?.postAnalysisCodes?.RL || record.adkotmDecode?.demographic?.residentialLocation || 'Unstated';
                const il = record.adkotmDecode?.postAnalysisCodes?.IL || record.adkotmDecode?.metadata?.interviewLocation || record.sessionLocation || 'Unstated';
                const isGreyFr = isUnstatedText(fr);
                const isGreyRl = isUnstatedText(rl);
                const isGreyIl = isUnstatedText(il);

                return (
                  <div
                    key={record.id}
                    className="p-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-50/50 transition-all space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-xs font-bold text-stone-900 truncate">
                          {record.fileName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            isGreyFr
                              ? 'bg-stone-100 text-stone-600 border border-stone-300 font-medium'
                              : 'bg-amber-50 text-amber-900 border border-amber-200 font-semibold'
                          }`}
                        >
                          FR: {fr}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            isGreyRl
                              ? 'bg-stone-100 text-stone-600 border border-stone-300 font-medium'
                              : 'bg-sky-50 text-sky-900 border border-sky-200 font-semibold'
                          }`}
                        >
                          RL (Home): {rl}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            isGreyIl
                              ? 'bg-stone-100 text-stone-600 border border-stone-300 font-medium'
                              : 'bg-slate-100 text-slate-800 border border-slate-300 font-semibold'
                          }`}
                        >
                          IL (Venue): {il}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono font-bold text-stone-600">
                          {total} signals
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedParticipantId(isExpanded ? null : record.id)}
                          className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide' : 'Details'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        {onSelectRecord && (
                          <button
                            type="button"
                            onClick={() => onSelectRecord(record.id)}
                            className="px-2 py-1 rounded text-[11px] font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 cursor-pointer"
                          >
                            Inspect Card
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Individual 100% Stacked Bar */}
                    <div className="w-full h-3 rounded-md overflow-hidden flex bg-stone-100 border border-stone-200">
                      {DIMENSION_KEYS.map((k) => {
                        const pct = Math.round(percentages[k] * 10) / 10;
                        if (pct <= 0) return null;
                        return (
                          <div
                            key={k}
                            className="h-full relative group transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: DIMENSIONS[k].color,
                            }}
                            title={`${DIMENSIONS[k].name}: ${pct}% (${signals[k]} signals)`}
                          />
                        );
                      })}
                    </div>

                    {/* Expanded Details Pane in Dropdown */}
                    {isExpanded && record.adkotmDecode && (
                      <div className="pt-2 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="bg-amber-50/60 p-2 rounded-lg border border-amber-200/70">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-0.5">
                            Object (O) Mentions
                          </span>
                          <p className="text-stone-800 text-[11px] leading-relaxed">
                            {record.adkotmDecode.objects?.productsPurchased || record.adkotmDecode.postAnalysisCodes?.PP || 'null'}
                            {record.adkotmDecode.objects?.brandPreferences ? ` • Brand: ${record.adkotmDecode.objects.brandPreferences}` : ''}
                          </p>
                        </div>

                        <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-200/70">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block mb-0.5">
                            Activity (A) Routines
                          </span>
                          <p className="text-stone-800 text-[11px] leading-relaxed">
                            {record.adkotmDecode.activities?.dailyRoutine || record.adkotmDecode.activities?.foodConsumptionBehaviour || 'null'}
                          </p>
                        </div>

                        <div className="bg-indigo-50/60 p-2 rounded-lg border border-indigo-200/70">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 block mb-0.5">
                            Knowledge (K) & Literacy
                          </span>
                          <p className="text-stone-800 text-[11px] leading-relaxed">
                            {record.adkotmDecode.knowledge?.awarenessOnGutHealth || record.adkotmDecode.postAnalysisCodes?.AW || 'null'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
