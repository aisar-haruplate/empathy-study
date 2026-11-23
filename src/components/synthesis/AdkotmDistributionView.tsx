import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  MapPin,
  Package,
  Quote,
  Users,
} from 'lucide-react';
import type { ADKOTMDimensionKey, InterviewRecord } from '../../types';
import { AdkotmAnalyticsEngine } from '../../domain/adkotm';
import { stripRecordingExtension } from '../../lib/adkotmCopilot';

interface AdkotmDistributionViewProps {
  records: InterviewRecord[];
  onProceedToAnalytics?: () => void;
  onSelectRecord?: (recordId: string) => void;
  embedded?: boolean;
}

export type DimensionKey = ADKOTMDimensionKey;

export interface DimensionMeta {
  key: DimensionKey;
  name: string;
  fullName: string;
  color: string;
  barTextColor: string;
  bgLight: string;
  borderLight: string;
  textDark: string;
  icon: React.FC<{ className?: string }>;
  description: string;
  subfields: string[];
}

export const DIMENSIONS: Record<DimensionKey, DimensionMeta> = {
  A: {
    key: 'A',
    name: 'Activity (A)',
    fullName: 'Activities & Behaviour',
    color: '#4FA896',
    barTextColor: '#FFFFFF',
    bgLight: 'bg-[#DDF3ED]',
    borderLight: 'border-[#96D6C7]',
    textDark: 'text-[#133830]',
    icon: Activity,
    description: 'Daily routines, shopping behaviour, eating context & food prep',
    subfields: ['Daily Routine', 'Shopping Behaviour', 'Food Consumption', 'Food Preparation', 'Eating Context'],
  },
  D: {
    key: 'D',
    name: 'Demographic (D)',
    fullName: 'Demographics & Drivers',
    color: '#528BCA',
    barTextColor: '#FFFFFF',
    bgLight: 'bg-[#DCE8F7]',
    borderLight: 'border-[#528BCA]/45',
    textDark: 'text-[#132B47]',
    icon: Users,
    description: 'Family role (Mum, Dad, Elderly), residential location, age & household',
    subfields: ['Family Role (FR)', 'Location (RL)', 'Age Bracket', 'Gender', 'Household'],
  },
  K: {
    key: 'K',
    name: 'Knowledge (K)',
    fullName: 'Knowledge & Awareness',
    color: '#E5B822',
    barTextColor: '#3B2E00',
    bgLight: 'bg-[#FDF3C7]',
    borderLight: 'border-[#F7D147]',
    textDark: 'text-[#3B2E00]',
    icon: BookOpen,
    description: 'Awareness on gut health, probiotics, and understanding level',
    subfields: ['Gut Health Awareness (AW)', 'Awareness Level', 'Understanding Summary'],
  },
  O: {
    key: 'O',
    name: 'Object (O)',
    fullName: 'Objects & Products',
    color: '#96D6C7',
    barTextColor: '#133830',
    bgLight: 'bg-[#DDF3ED]',
    borderLight: 'border-[#96D6C7]',
    textDark: 'text-[#133830]',
    icon: Package,
    description: 'Products purchased, brands, food vs supplement solutions',
    subfields: ['Products Purchased (PP)', 'Brand Preferences (PP1)', 'Food Products', 'Supplements', 'Actions to Solve'],
  },
  T: {
    key: 'T',
    name: 'Time (T)',
    fullName: 'Time & Context',
    color: '#7C8CE0',
    barTextColor: '#FFFFFF',
    bgLight: 'bg-[#DCE8F7]',
    borderLight: 'border-[#7C8CE0]/50',
    textDark: 'text-[#132B47]',
    icon: Clock,
    description: 'Purchase frequency, consumption timing & occasions',
    subfields: ['Purchase Frequency', 'Consumption Frequency', 'Purchase Timing', 'Occasions'],
  },
  M: {
    key: 'M',
    name: 'Metadata (M)',
    fullName: 'Meaning & Session Context',
    color: '#F7D147',
    barTextColor: '#3B2E00',
    bgLight: 'bg-[#FDF3C7]',
    borderLight: 'border-[#F7D147]',
    textDark: 'text-[#3B2E00]',
    icon: MapPin,
    description: 'Interview retail venue, date & field recording context',
    subfields: ['Interview Location (IL)', 'Session Date', 'Field Context'],
  },
};

export const DIMENSION_KEYS: DimensionKey[] = ['O', 'A', 'K', 'D', 'T', 'M'];
const DISPLAY_DIMENSION_ORDER: DimensionKey[] = ['A', 'D', 'K', 'O', 'T', 'M'];

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

interface DeduplicatedTheme {
  label: string;
  count: number;
  groupTitle: string;
  dimension: DimensionKey;
}

interface SupportingQuote {
  id: string;
  quote: string;
  recordId: string;
  fileName: string;
  themeLabel: string;
  dimension: DimensionKey;
}

const INITIAL_THEMES_CAP = 10;
const INITIAL_QUOTES_CAP = 5;

export const AdkotmDistributionView: React.FC<AdkotmDistributionViewProps> = ({
  records,
  onProceedToAnalytics,
  onSelectRecord,
  embedded = false,
}) => {
  const [selectedScopeId, setSelectedScopeId] = useState<string>('all');
  const [selectedCode, setSelectedCode] = useState<'ALL' | DimensionKey>('O');
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [showAllQuotes, setShowAllQuotes] = useState(false);
  const [showAdvancedRows, setShowAdvancedRows] = useState(false);

  // Single source of truth via AdkotmAnalyticsEngine
  const fullEngine = useMemo(() => new AdkotmAnalyticsEngine(records), [records]);
  const allEligibleRecords = fullEngine.getEligibleRecords();

  const scopedRecords = useMemo(() => {
    if (selectedScopeId === 'all') return [...allEligibleRecords];
    return allEligibleRecords.filter((r) => r.id === selectedScopeId);
  }, [allEligibleRecords, selectedScopeId]);

  const scopedSnapshot = useMemo(
    () => new AdkotmAnalyticsEngine(scopedRecords).computeSnapshot(),
    [scopedRecords]
  );

  const chartRows = useMemo(() => {
    const totalSignals = scopedSnapshot.totalSignals;
    return DISPLAY_DIMENSION_ORDER.map((key) => {
      const ds = scopedSnapshot.byDimension[key];
      const cov = scopedSnapshot.dimensionCoverage[key];
      const sharePct =
        totalSignals > 0 ? Math.round((ds.totalSignals / totalSignals) * 1000) / 10 : 0;
      return {
        key,
        meta: DIMENSIONS[key],
        signals: ds.totalSignals,
        sharePct,
        coverageRatio: cov.ratioText,
        coveragePct: cov.percent,
      };
    });
  }, [scopedSnapshot]);

  // Deduplicated themes and verbatim quotes for the currently selected code (or ALL)
  const { themes, quotes } = useMemo(() => {
    const activeDims: DimensionKey[] = selectedCode === 'ALL' ? DISPLAY_DIMENSION_ORDER : [selectedCode];

    const themeMap = new Map<string, DeduplicatedTheme>();
    const quoteMap = new Map<string, SupportingQuote>();

    for (const dim of activeDims) {
      const ds = scopedSnapshot.byDimension[dim];
      for (const group of ds.groups) {
        for (const item of group.items) {
          const cleanLabel = (item.label || '').trim();
          if (!cleanLabel) continue;
          const normKey = `${dim}::${cleanLabel.toLowerCase()}`;
          const existing = themeMap.get(normKey);
          if (existing) {
            existing.count += item.count;
          } else {
            themeMap.set(normKey, {
              label: cleanLabel,
              count: item.count,
              groupTitle: group.title,
              dimension: dim,
            });
          }

          for (const contrib of item.contributors || []) {
            const q = (contrib.quote || '').trim();
            if (!q) continue;
            const qKey = `${contrib.recordId}::${q.toLowerCase()}`;
            if (!quoteMap.has(qKey)) {
              quoteMap.set(qKey, {
                id: qKey,
                quote: q,
                recordId: contrib.recordId,
                fileName: contrib.fileName,
                themeLabel: cleanLabel,
                dimension: dim,
              });
            }
          }
        }
      }
    }

    const sortedThemes = Array.from(themeMap.values()).sort((a, b) => b.count - a.count);
    const allQuotes = Array.from(quoteMap.values());
    return { themes: sortedThemes, quotes: allQuotes };
  }, [scopedSnapshot, selectedCode]);

  const handleSelectCode = (code: 'ALL' | DimensionKey) => {
    setSelectedCode(code);
    setShowAllThemes(false);
    setShowAllQuotes(false);
  };

  const visibleThemes = showAllThemes ? themes : themes.slice(0, INITIAL_THEMES_CAP);
  const visibleQuotes = showAllQuotes ? quotes : quotes.slice(0, INITIAL_QUOTES_CAP);

  const selectedRow =
    selectedCode === 'ALL' ? null : chartRows.find((r) => r.key === selectedCode) || null;

  // Per-recording quick summary for the collapsed drawer
  const recordingBreakdowns = useMemo(() => {
    if (!showAdvancedRows) return [];
    return allEligibleRecords.map((rec) => {
      const snap = new AdkotmAnalyticsEngine([rec]).computeSnapshot();
      return {
        record: rec,
        totalSignals: snap.totalSignals,
        counts: Object.fromEntries(
          DIMENSION_KEYS.map((k) => [k, snap.byDimension[k].totalSignals])
        ) as Record<DimensionKey, number>,
      };
    });
  }, [allEligibleRecords, showAdvancedRows]);

  if (allEligibleRecords.length === 0) {
    return (
      <div className="bg-[#F2F5F3] rounded-3xl p-8 text-center shadow-sm">
        <BarChart3 className="w-8 h-8 text-[#528BCA] mx-auto mb-2.5" />
        <h3 className="font-heading text-xl font-medium text-[#1C1B1F]">
          No Decoded Interviews Available Yet
        </h3>
        <p className="text-base text-[#444846] mt-1.5 max-w-md mx-auto leading-relaxed">
          Complete Step 3 theme decoding and verify interviews to view the ADKOTM breakdown.
        </p>
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-5' : 'space-y-5 bg-[#FDFCF8] p-4 sm:p-6 rounded-[32px]'}>
      {/* TOP SECTION: All-Category ADKOTM Breakdown Chart */}
      <section
        aria-label="All ADKOTM Categories Breakdown"
        className="bg-[#F2F5F3] rounded-[32px] p-5 sm:p-6 shadow-sm space-y-5"
      >
        {/* Header + Scope Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-heading text-2xl font-medium text-[#1C1B1F] tracking-[-0.01em]">
                All ADKOTM Categories Breakdown
              </h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-[#DDF3ED] text-[#133830] tabular-nums">
                {scopedSnapshot.totalSignals} signals · {scopedSnapshot.eligibleRecordCount}{' '}
                {scopedSnapshot.eligibleRecordCount === 1 ? 'interview' : 'interviews'}
              </span>
            </div>
            <p className="text-sm text-[#444846] mt-1">
              Click any ADKOTM code below to inspect its deduplicated themes and verbatim evidence.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="min-h-[44px] inline-flex items-center gap-2 bg-[#E7ECE9] rounded-full px-3.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-[#528BCA] shrink-0" />
              <select
                aria-label="Filter ADKOTM breakdown by recording"
                value={selectedScopeId}
                onChange={(e) => {
                  setSelectedScopeId(e.target.value);
                  setShowAllThemes(false);
                  setShowAllQuotes(false);
                }}
                className="text-sm font-medium text-[#1C1B1F] bg-transparent border-none focus:outline-none cursor-pointer max-w-[230px]"
              >
                <option value="all">All Verified Interviews ({allEligibleRecords.length})</option>
                {allEligibleRecords.map((r) => (
                  <option key={r.id} value={r.id}>
                    {stripRecordingExtension(r.fileName)}
                  </option>
                ))}
              </select>
            </div>

            {onProceedToAnalytics && (
              <button
                type="button"
                onClick={onProceedToAnalytics}
                className="md3-btn-tonal inline-flex items-center gap-1.5 px-4 py-2 cursor-pointer whitespace-nowrap"
              >
                <span>Analytics</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Code Switcher (All / A / D / K / O / T / M) */}
        <div
          role="tablist"
          aria-label="Select ADKOTM dimension"
          className="flex items-center gap-1.5 flex-wrap"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedCode === 'ALL'}
            onClick={() => handleSelectCode('ALL')}
            className={`min-h-[40px] px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer active:scale-95 ${
              selectedCode === 'ALL'
                ? 'bg-[#528BCA] text-white shadow-xs'
                : 'bg-[#E7ECE9] text-[#444846] hover:bg-[#DCE8F7] hover:text-[#132B47]'
            }`}
          >
            All ({scopedSnapshot.totalSignals})
          </button>
          {chartRows.map((row) => {
            const isActive = selectedCode === row.key;
            return (
              <button
                key={row.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSelectCode(row.key)}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-[#528BCA] text-white shadow-xs'
                    : 'bg-[#FDFCF8] text-[#1C1B1F] hover:bg-[#DCE8F7] hover:text-[#132B47]'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: isActive ? '#FDF3C7' : row.meta.color }}
                />
                <span>{row.key}</span>
                <span className={`text-xs tabular-nums ${isActive ? 'text-white/90' : 'text-[#444846]'}`}>
                  {row.sharePct}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Unified 100% Proportion Strip */}
        {scopedSnapshot.totalSignals > 0 && (
          <div
            className="w-full h-4 rounded-full overflow-hidden flex bg-[#E7ECE9] p-0.5 gap-0.5"
            aria-label="Proportional distribution across A, D, K, O, T, M"
          >
            {chartRows.map((row) => {
              if (row.sharePct <= 0) return null;
              const isSelected = selectedCode === row.key;
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => handleSelectCode(row.key)}
                  style={{
                    width: `${Math.max(row.sharePct, 3)}%`,
                    backgroundColor: row.meta.color,
                  }}
                  title={`${row.meta.name}: ${row.sharePct}% (${row.signals} signals)`}
                  className={`h-full first:rounded-l-full last:rounded-r-full transition-opacity cursor-pointer ${
                    selectedCode !== 'ALL' && !isSelected ? 'opacity-40 hover:opacity-80' : 'opacity-100'
                  }`}
                />
              );
            })}
          </div>
        )}

        {/* Interactive 6-Dimension Bar Chart Rows */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {chartRows.map((row) => {
            const Icon = row.meta.icon;
            const isSelected = selectedCode === row.key;
            return (
              <button
                key={row.key}
                type="button"
                onClick={() => handleSelectCode(row.key)}
                className={`text-left rounded-2xl p-3.5 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] cursor-pointer ${
                  isSelected
                    ? 'bg-[#DCE8F7] ring-2 ring-[#528BCA] shadow-xs'
                    : 'bg-[#FDFCF8] hover:bg-[#E7ECE9]/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: row.meta.color, color: row.meta.barTextColor }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-heading text-sm font-medium text-[#1C1B1F] truncate">
                      {row.meta.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs tabular-nums shrink-0">
                    <span className="font-semibold text-[#1C1B1F]">{row.sharePct}%</span>
                    <span className="text-[#444846]">{row.signals} signals</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#E7ECE9] text-[#444846]">
                      {row.coverageRatio}
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-[#E7ECE9] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, row.sharePct)}%`,
                      backgroundColor: row.meta.color,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* BELOW THE CHART: Focused Breakdown for Selected Code */}
      <section
        aria-label="Selected ADKOTM code breakdown"
        className="bg-[#FDFCF8] rounded-[32px] p-5 sm:p-6 shadow-sm border border-[#D5DDD8]/70 space-y-5"
      >
        {/* Selected Dimension Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D5DDD8]">
          <div className="flex items-start gap-3">
            {selectedRow ? (
              <span
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: selectedRow.meta.color,
                  color: selectedRow.meta.barTextColor,
                }}
              >
                <selectedRow.meta.icon className="w-5 h-5" />
              </span>
            ) : (
              <span className="w-11 h-11 rounded-2xl bg-[#DCE8F7] text-[#528BCA] flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5" />
              </span>
            )}
            <div>
              <h3 className="font-heading text-2xl font-medium text-[#1C1B1F] tracking-[-0.01em]">
                {selectedRow ? selectedRow.meta.fullName : 'All ADKOTM Dimensions'}
              </h3>
              <p className="text-sm text-[#444846] mt-0.5">
                {selectedRow
                  ? selectedRow.meta.description
                  : 'Consolidated deduplicated themes and verbatim quotes across all 6 dimensions.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0 tabular-nums">
            {selectedRow && (
              <span className="px-3.5 py-1 rounded-full text-sm font-medium bg-[#DCE8F7] text-[#132B47]">
                {selectedRow.sharePct}% share
              </span>
            )}
            <span className="px-3.5 py-1 rounded-full text-sm font-medium bg-[#DDF3ED] text-[#133830]">
              {selectedRow ? selectedRow.signals : scopedSnapshot.totalSignals} signals
            </span>
            {selectedRow && (
              <span className="px-3.5 py-1 rounded-full text-sm font-medium bg-[#FDF3C7] text-[#3B2E00]">
                Coverage {selectedRow.coverageRatio}
              </span>
            )}
          </div>
        </div>

        {/* Deduplicated Decoded Themes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-heading text-base font-medium text-[#1C1B1F]">
              Decoded Themes &amp; Values ({themes.length})
            </h4>
            {themes.length > INITIAL_THEMES_CAP && (
              <button
                type="button"
                onClick={() => setShowAllThemes((prev) => !prev)}
                className="text-xs font-medium text-[#528BCA] hover:underline cursor-pointer"
              >
                {showAllThemes ? 'Show less' : `Show all (${themes.length})`}
              </button>
            )}
          </div>

          {visibleThemes.length === 0 ? (
            <p className="text-sm text-[#444846] py-3">
              No decoded values recorded for this dimension in the selected scope.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleThemes.map((theme) => {
                const dimMeta = DIMENSIONS[theme.dimension];
                return (
                  <div
                    key={`${theme.dimension}-${theme.label}`}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#F2F5F3] text-sm text-[#1C1B1F]"
                  >
                    {selectedCode === 'ALL' && (
                      <span
                        className="w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: dimMeta.color, color: dimMeta.barTextColor }}
                      >
                        {theme.dimension}
                      </span>
                    )}
                    <span className="font-medium">{theme.label}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#E7ECE9] text-[#444846] tabular-nums">
                      {theme.count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Supporting Verbatim Quotes */}
        <div className="space-y-3 pt-2 border-t border-[#D5DDD8]">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-heading text-base font-medium text-[#1C1B1F] flex items-center gap-2">
              <Quote className="w-4 h-4 text-[#528BCA]" />
              <span>Supporting Verbatim Quotes ({quotes.length})</span>
            </h4>
            {quotes.length > INITIAL_QUOTES_CAP && (
              <button
                type="button"
                onClick={() => setShowAllQuotes((prev) => !prev)}
                className="text-xs font-medium text-[#528BCA] hover:underline cursor-pointer"
              >
                {showAllQuotes ? 'Show fewer quotes' : `Show all quotes (${quotes.length})`}
              </button>
            )}
          </div>

          {visibleQuotes.length === 0 ? (
            <p className="text-sm text-[#444846] py-2">
              No verbatim evidence quotes attached for this dimension yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {visibleQuotes.map((q) => {
                const dimMeta = DIMENSIONS[q.dimension];
                return (
                  <div
                    key={q.id}
                    className="rounded-2xl bg-[#F2F5F3] px-4 py-3 space-y-1.5"
                  >
                    <p className="transcript-surface text-[#1C1B1F]">
                      &ldquo;{q.quote}&rdquo;
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#444846]">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: dimMeta.color, color: dimMeta.barTextColor }}
                        >
                          {q.dimension} · {q.themeLabel}
                        </span>
                      </div>
                      {onSelectRecord ? (
                        <button
                          type="button"
                          onClick={() => onSelectRecord(q.recordId)}
                          className="font-medium text-[#528BCA] hover:underline cursor-pointer"
                        >
                          {stripRecordingExtension(q.fileName)}
                        </button>
                      ) : (
                        <span>{stripRecordingExtension(q.fileName)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* COLLAPSED BY DEFAULT: Core Ratio Notes & Browse Recording Rows */}
      <div className="bg-[#F2F5F3] rounded-3xl overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setShowAdvancedRows((prev) => !prev)}
          aria-expanded={showAdvancedRows}
          className="w-full min-h-[48px] px-5 py-3 flex items-center justify-between text-left hover:bg-[#E7ECE9]/70 transition-colors cursor-pointer"
        >
          <span className="font-heading text-sm font-medium text-[#444846]">
            Core Ratio &amp; Browse All {allEligibleRecords.length} Recording Rows
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#528BCA]">
            {showAdvancedRows ? (
              <>
                <span>Hide</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Show</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </span>
        </button>

        {showAdvancedRows && (
          <div className="px-5 pb-5 pt-2 border-t border-[#D5DDD8] space-y-3">
            <p className="text-xs text-[#444846] leading-relaxed">
              <strong>Core Ratio:</strong> Signal percentages reflect each ADKOTM dimension&apos;s share of total verified signals from <code className="font-mono">AdkotmAnalyticsEngine</code>; coverage ratios (<code className="font-mono">X/{allEligibleRecords.length}</code>) report distinct interviews stating at least one signal in that dimension.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#D5DDD8] text-[#444846]">
                    <th className="py-2 pr-3 font-medium">Recording</th>
                    {DIMENSION_KEYS.map((k) => (
                      <th key={k} className="py-2 px-2 font-medium text-center">
                        {k}
                      </th>
                    ))}
                    <th className="py-2 pl-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5DDD8]/60">
                  {recordingBreakdowns.map(({ record, counts, totalSignals }) => (
                    <tr key={record.id} className="hover:bg-[#FDFCF8]">
                      <td className="py-2 pr-3 font-medium text-[#1C1B1F]">
                        <button
                          type="button"
                          onClick={() => setSelectedScopeId(record.id)}
                          className="text-left text-[#528BCA] hover:underline cursor-pointer"
                        >
                          {stripRecordingExtension(record.fileName)}
                        </button>
                      </td>
                      {DIMENSION_KEYS.map((k) => (
                        <td key={k} className="py-2 px-2 text-center tabular-nums text-[#444846]">
                          {counts[k]}
                        </td>
                      ))}
                      <td className="py-2 pl-2 text-right font-semibold tabular-nums text-[#1C1B1F]">
                        {totalSignals}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
