import React, { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, Tooltip as RechartsTooltip } from 'recharts';
import { ArrowRight, Info, MapPin } from 'lucide-react';
import type { ADKOTMDimensionKey } from '../../types';
import {
  computeExecutiveCoverageRows,
  computeUnifiedObjectsChartData,
  TIMING_BUCKETS,
  type TraceableBreakdownItem,
  type TraceableDimensionDataset,
  type TraceableGroup,
} from '../../lib/decodeAnalytics';

interface OverviewBentoTabProps {
  datasetsByDim: Record<ADKOTMDimensionKey, TraceableDimensionDataset>;
  totalRecords: number;
  onSelectTab: (tab: ADKOTMDimensionKey) => void;
  onTraceItem: (item: TraceableBreakdownItem) => void;
  onOpenMap?: () => void;
  activeFilterKey?: string | null;
}

const DIM_META: Record<
  ADKOTMDimensionKey,
  { title: string; color: string; badgeClass: string; colSpan: string }
> = {
  O: {
    title: 'Objects [O] · Products & Brands',
    color: '#ea580c',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    colSpan: 'lg:col-span-6',
  },
  A: {
    title: 'Activities [A] · Routines & Habits',
    color: '#059669',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    colSpan: 'lg:col-span-6',
  },
  K: {
    title: 'Knowledge [K] · Gut Health Awareness',
    color: '#4f46e5',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    colSpan: 'lg:col-span-4',
  },
  D: {
    title: 'Demographics [D] · Roles & Residence [RL]',
    color: '#0284c7',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    colSpan: 'lg:col-span-4',
  },
  T: {
    title: 'Timing [T] · Cadence & Occasions',
    color: '#e11d48',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    colSpan: 'lg:col-span-4',
  },
  M: {
    title: 'Metadata [M] · Field Venues [IL]',
    color: '#475569',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    colSpan: 'lg:col-span-12',
  },
};

const ACTIVITY_FIELD_BADGE: Record<string, string> = {
  dailyRoutine: 'Daily',
  shoppingBehaviour: 'Shopping',
  foodConsumptionBehaviour: 'Consumption',
  foodPreparation: 'Prep',
  eatingContext: 'Context',
};

const buildSyntheticUnstatedItem = (
  group: TraceableGroup | undefined,
  dimension: ADKOTMDimensionKey,
  fieldKey: string,
  fieldLabel: string
): TraceableBreakdownItem | null => {
  if (!group) return null;
  const existing = group.items.find((i) => i.key === '__null__');
  if (existing) return existing;
  if (group.unstatedCount <= 0) return null;
  const pct =
    group.totalRecords > 0
      ? Math.round((group.unstatedCount / group.totalRecords) * 100)
      : 0;
  return {
    key: '__null__',
    label: 'Unstated (Null)',
    dimension,
    fieldKey,
    fieldLabel,
    count: group.unstatedCount,
    statedCount: group.statedCount,
    unstatedCount: group.unstatedCount,
    totalRecords: group.totalRecords,
    validPct: 0,
    totalPct: pct,
    formulaText: `Unstated: ${group.unstatedCount} / ${group.totalRecords} total records = ${pct}%`,
    totalContextText: `${group.unstatedCount}/${group.totalRecords} unstated (excluded from Valid %)`,
    color: '#e2e8f0',
    contributors: [],
  };
};

export const OverviewBentoTab: React.FC<OverviewBentoTabProps> = ({
  datasetsByDim,
  totalRecords,
  onSelectTab,
  onTraceItem,
  onOpenMap,
  activeFilterKey,
}) => {
  const [rlTooltipOpen, setRlTooltipOpen] = useState(false);
  const [ilTooltipOpen, setIlTooltipOpen] = useState(false);
  const [hoveredExecDim, setHoveredExecDim] = useState<ADKOTMDimensionKey | null>(null);

  const dims: ADKOTMDimensionKey[] = ['O', 'A', 'K', 'D', 'T', 'M'];
  const totalEmpiricalSignals = dims.reduce(
    (sum, d) => sum + datasetsByDim[d].totalSignals,
    0
  );

  const executiveRows = useMemo(
    () => computeExecutiveCoverageRows(datasetsByDim, totalRecords),
    [datasetsByDim, totalRecords]
  );

  // [O] Unified Food + Brand Ranked Items
  const unifiedObjects = useMemo(
    () => computeUnifiedObjectsChartData(datasetsByDim.O),
    [datasetsByDim.O]
  );
  const topUnifiedObjects = unifiedObjects.items.slice(0, 6);
  const maxObjectCount = Math.max(...topUnifiedObjects.map((i) => i.count), 1);

  // [A] Cleveland Dot Plot Data
  const activitiesGroup = datasetsByDim.A.groups[0];
  const topActivities = (activitiesGroup?.items || [])
    .filter((i) => i.key !== '__null__')
    .slice(0, 6);
  const maxActivityCount = Math.max(...topActivities.map((i) => i.count), 1);
  const activityAxisMax = Math.max(3, maxActivityCount);
  const activityTicks = Array.from({ length: activityAxisMax + 1 }, (_, i) => i);

  // [K] Knowledge Donut Data
  const kAwarenessGroup = datasetsByDim.K.groups[0];
  const kThemesGroup = datasetsByDim.K.groups[1];
  const kAwareItem = kAwarenessGroup?.items.find((i) => i.label === 'Aware') || null;
  const kNotAwareItem =
    kAwarenessGroup?.items.find((i) => i.label === 'Not Aware') || null;
  const kUnstatedItem = buildSyntheticUnstatedItem(
    kAwarenessGroup,
    'K',
    'awarenessLevel',
    'Awareness Level [AW]'
  );

  const knowledgeSlices = useMemo(() => {
    const slices: {
      key: string;
      name: string;
      count: number;
      pctOfTotal: number;
      color: string;
      traceItem: TraceableBreakdownItem | null;
    }[] = [
      {
        key: 'aware',
        name: 'Stated Aware',
        count: kAwareItem?.count ?? 0,
        pctOfTotal:
          totalRecords > 0
            ? Math.round(((kAwareItem?.count ?? 0) / totalRecords) * 100)
            : 0,
        color: '#10b981',
        traceItem: kAwareItem,
      },
      {
        key: 'not_aware',
        name: 'Stated Unaware',
        count: kNotAwareItem?.count ?? 0,
        pctOfTotal:
          totalRecords > 0
            ? Math.round(((kNotAwareItem?.count ?? 0) / totalRecords) * 100)
            : 0,
        color: '#f59e0b',
        traceItem: kNotAwareItem,
      },
      {
        key: 'unstated',
        name: 'Unstated (Null)',
        count: kUnstatedItem?.count ?? Math.max(0, totalRecords - (kAwarenessGroup?.statedCount ?? 0)),
        pctOfTotal:
          totalRecords > 0
            ? Math.round(
                ((kUnstatedItem?.count ?? Math.max(0, totalRecords - (kAwarenessGroup?.statedCount ?? 0))) /
                  totalRecords) *
                  100
              )
            : 0,
        color: '#e2e8f0',
        traceItem: kUnstatedItem,
      },
    ];
    return slices;
  }, [kAwareItem, kNotAwareItem, kUnstatedItem, kAwarenessGroup?.statedCount, totalRecords]);

  const knowledgeDonutData = knowledgeSlices.filter((s) => s.count > 0);
  const kStatedCoveragePct = kAwarenessGroup?.validCoveragePct ?? 0;

  // [D] Split Roles & Residence Data
  const dRoleGroup = datasetsByDim.D.groups[0];
  const dResidenceGroup = datasetsByDim.D.groups[1];
  const dRoleStatedItems = (dRoleGroup?.items || []).filter((i) => i.key !== '__null__');
  const dRoleUnstated = buildSyntheticUnstatedItem(
    dRoleGroup,
    'D',
    'familyRole',
    'Family Role [FR]'
  );
  const dResStatedItems = (dResidenceGroup?.items || []).filter(
    (i) => i.key !== '__null__'
  );
  const dResUnstated = buildSyntheticUnstatedItem(
    dResidenceGroup,
    'D',
    'residentialLocation',
    'Residential Location [RL]'
  );

  // [T] Ordered Cadence Spectrum
  const tGroup = datasetsByDim.T.groups[0];
  const timingSpectrum = useMemo(() => {
    const byLabel = new Map<string, TraceableBreakdownItem>();
    (tGroup?.items || []).forEach((item) => {
      if (item.key !== '__null__') byLabel.set(item.label, item);
    });
    return TIMING_BUCKETS.map((bucket) => {
      const match = byLabel.get(bucket.label) || null;
      return {
        id: bucket.id,
        label: bucket.label,
        color: bucket.color,
        count: match?.count ?? 0,
        validPct: match?.validPct ?? 0,
        item: match,
      };
    });
  }, [tGroup]);
  const maxTimingCount = Math.max(...timingSpectrum.map((b) => b.count), 1);

  // [M] Metadata Venues
  const mGroup = datasetsByDim.M.groups[0];
  const topVenues = (mGroup?.items || [])
    .filter((i) => i.key !== '__null__')
    .slice(0, 6);
  const maxVenueCount = Math.max(...topVenues.map((i) => i.count), 1);

  const isItemFilterActive = (item: TraceableBreakdownItem | null | undefined) => {
    if (!item || !activeFilterKey) return false;
    return activeFilterKey === `${item.dimension}::${item.fieldKey}::${item.key}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* 1. Executive ADKOTM Signal Coverage — 100% Stacked Horizontal Bar Chart */}
      <section className="lg:col-span-12 rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-stone-900">
              Executive ADKOTM Signal Coverage
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              100% stacked interview coverage across {totalRecords} Human-Verified interview
              {totalRecords === 1 ? '' : 's'} ·{' '}
              <span className="font-mono font-semibold text-stone-700 tabular-nums">
                {totalEmpiricalSignals} total verified signals
              </span>
              . Click any row to inspect its full breakdown.
            </p>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-stone-600 shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#ea580c]" />
              <span>Stated Interviews %</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#e2e8f0] border border-stone-300" />
              <span>Unstated / Null %</span>
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {executiveRows.map((row) => {
            const isHovered = hoveredExecDim === row.dimension;
            return (
              <div
                key={row.dimension}
                className="relative group"
                onMouseEnter={() => setHoveredExecDim(row.dimension)}
                onMouseLeave={() => setHoveredExecDim(null)}
              >
                <button
                  type="button"
                  onClick={() => onSelectTab(row.dimension)}
                  className="w-full flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl px-2.5 py-1.5 hover:bg-stone-50 transition-colors text-left cursor-pointer"
                >
                  {/* Dimension Label */}
                  <div className="w-full sm:w-44 shrink-0 flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold shrink-0 ${DIM_META[row.dimension].badgeClass}`}
                    >
                      {row.dimension}
                    </span>
                    <span className="text-xs font-semibold text-stone-800 group-hover:text-stone-950 truncate">
                      {row.label.replace(/\s*\[[A-Z]+\]/, '')}
                    </span>
                  </div>

                  {/* 100% Stacked SVG Horizontal Bar */}
                  <div className="flex-1 min-w-0 flex items-center">
                    <svg
                      viewBox="0 0 400 20"
                      preserveAspectRatio="none"
                      className="w-full h-5 rounded-md overflow-hidden"
                      role="img"
                      aria-label={`${row.label}: ${row.statedPct}% stated, ${row.unstatedPct}% unstated`}
                    >
                      <rect
                        x={0}
                        y={0}
                        width={400}
                        height={20}
                        rx={5}
                        fill="#e2e8f0"
                      />
                      {row.statedPct > 0 && (
                        <rect
                          x={0}
                          y={0}
                          width={(400 * row.statedPct) / 100}
                          height={20}
                          rx={row.statedPct >= 98 ? 5 : 0}
                          fill={row.color}
                        />
                      )}
                      {row.statedPct >= 14 && (
                        <text
                          x={8}
                          y={13.5}
                          fill="#ffffff"
                          fontSize={10}
                          fontWeight={700}
                          fontFamily="monospace"
                        >
                          {row.statedPct}%
                        </text>
                      )}
                    </svg>
                  </div>

                  {/* Coverage + Signal Volume Readout */}
                  <div className="sm:w-44 shrink-0 flex items-center justify-between sm:justify-end gap-2 text-[11px] font-mono tabular-nums whitespace-nowrap">
                    <span className="font-bold text-stone-900">
                      {row.statedCount}/{row.totalRecords} stated
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-600 font-semibold">
                      {row.totalSignals} signal{row.totalSignals === 1 ? '' : 's'}
                    </span>
                  </div>
                </button>

                {/* Hover Tooltip */}
                {isHovered && (
                  <div className="hidden sm:block absolute left-48 -top-2 -translate-y-full z-30 pointer-events-none bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-0.5 font-mono tabular-nums">
                    <div className="font-sans font-bold text-stone-900">{row.label}</div>
                    <div className="text-stone-700">
                      Stated: {row.statedCount}/{row.totalRecords} ({row.statedPct}%) · Unstated:{' '}
                      {row.unstatedCount} ({row.unstatedPct}%)
                    </div>
                    <div className="text-stone-500">
                      Total extracted signals: {row.totalSignals} · Click to open {row.dimension} tab
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Objects [O] — Unified Ranked Horizontal Bar Chart (Generic Food vs Brand) */}
      <section
        className={`${DIM_META.O.colSpan} rounded-2xl border border-stone-200 bg-white p-5 flex flex-col justify-between space-y-4`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${DIM_META.O.badgeClass}`}
              >
                O
              </span>
              <h4 className="text-sm font-bold text-stone-900">{DIM_META.O.title}</h4>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('O')}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>Full Table</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="mt-2.5 pb-2.5 border-b border-stone-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="font-mono tabular-nums text-stone-600">
              <strong className="text-stone-900">{unifiedObjects.statedCount}</strong> Stated ·{' '}
              {unifiedObjects.unstatedCount} Null · {unifiedObjects.totalRecords} Total (
              {unifiedObjects.validCoveragePct}%)
            </span>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-800">
                <span className="w-2 h-2 rounded-full bg-[#ea580c]" />
                Brand
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                Generic Food
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {topUnifiedObjects.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-4">
                No stated O products or brands in verified records yet.
              </p>
            ) : (
              topUnifiedObjects.map((item) => {
                const widthPct = Math.max(8, Math.round((item.count / maxObjectCount) * 100));
                const isBrand = item.objectKind === 'brand';
                const active = isItemFilterActive(item);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onTraceItem(item)}
                    title={`${item.label} (${isBrand ? 'Commercial Brand' : 'Generic Food / Product'}) — ${item.formulaText}`}
                    className={`w-full text-left rounded-xl px-2.5 py-2 transition-colors cursor-pointer group border ${
                      active
                        ? 'bg-orange-50/90 border-orange-300'
                        : 'border-transparent hover:bg-orange-50/50 hover:border-orange-200/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 text-xs mb-1.5">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span
                          className={`mt-0.5 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide shrink-0 ${
                            isBrand
                              ? 'bg-orange-100/90 text-orange-800 border-orange-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {isBrand ? 'Brand' : 'Food'}
                        </span>
                        <span className="font-medium text-stone-800 group-hover:text-stone-950 leading-snug line-clamp-2 break-words">
                          {item.label}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-stone-800 tabular-nums shrink-0 pt-0.5">
                        {item.count} ({item.validPct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {unifiedObjects.items.length > 6 && (
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
            <span>Showing top 6 of {unifiedObjects.items.length} products & brands</span>
            <button
              type="button"
              onClick={() => onSelectTab('O')}
              className="font-semibold text-orange-700 hover:underline cursor-pointer"
            >
              Inspect all →
            </button>
          </div>
        )}
      </section>

      {/* 3. Activities [A] — Cleveland Dot Plot */}
      <section
        className={`${DIM_META.A.colSpan} rounded-2xl border border-stone-200 bg-white p-5 flex flex-col justify-between space-y-4`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${DIM_META.A.badgeClass}`}
              >
                A
              </span>
              <h4 className="text-sm font-bold text-stone-900">{DIM_META.A.title}</h4>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('A')}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>Full Table</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {activitiesGroup && (
            <div className="mt-2.5 pb-2.5 border-b border-stone-100 flex items-center justify-between text-[11px] font-mono tabular-nums text-stone-600">
              <span>
                <strong className="text-stone-900">{activitiesGroup.statedCount}</strong> Stated ·{' '}
                {activitiesGroup.unstatedCount} Null · {activitiesGroup.totalRecords} Total
              </span>
              <span className="font-semibold text-emerald-700">
                {activitiesGroup.validCoveragePct}% coverage
              </span>
            </div>
          )}

          {topActivities.length === 0 ? (
            <p className="text-xs text-stone-400 italic py-4">
              No stated A routines in verified records yet.
            </p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {/* Cleveland Dot Plot Rows */}
              {topActivities.map((item) => {
                const ratio = Math.min(1, item.count / activityAxisMax);
                const dotX = 8 + ratio * 184;
                const active = isItemFilterActive(item);
                const fieldBadge = ACTIVITY_FIELD_BADGE[item.fieldKey] || 'Routine';
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onTraceItem(item)}
                    title={`${item.label} (${fieldBadge}) — ${item.formulaText}`}
                    className={`w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors cursor-pointer group border ${
                      active
                        ? 'bg-emerald-50/90 border-emerald-300'
                        : 'border-transparent hover:bg-emerald-50/50 hover:border-emerald-200/70'
                    }`}
                  >
                    <div className="w-[44%] min-w-0 shrink-0">
                      <div className="text-xs font-medium text-stone-800 group-hover:text-emerald-950 line-clamp-2 leading-snug break-words">
                        {item.label}
                      </div>
                      <span className="inline-block mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                        {fieldBadge}
                      </span>
                    </div>

                    {/* Responsive SVG Cleveland Dot Track */}
                    <div className="flex-1 min-w-[90px]">
                      <svg
                        viewBox="0 0 200 26"
                        className="w-full h-6 overflow-visible"
                        role="img"
                        aria-label={`${item.label}: ${item.count} mentions`}
                      >
                        {activityTicks.map((tick) => {
                          const tx = 8 + (tick / activityAxisMax) * 184;
                          return (
                            <line
                              key={tick}
                              x1={tx}
                              y1={2}
                              x2={tx}
                              y2={24}
                              stroke="#e7e5e4"
                              strokeDasharray="2 2"
                              strokeWidth={1}
                            />
                          );
                        })}
                        {/* Baseline track */}
                        <line
                          x1={8}
                          y1={13}
                          x2={192}
                          y2={13}
                          stroke="#f5f5f4"
                          strokeWidth={2}
                        />
                        {/* Lollipop stem */}
                        <line
                          x1={8}
                          y1={13}
                          x2={dotX}
                          y2={13}
                          stroke="#10b981"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                        />
                        {/* Dot marker */}
                        <circle
                          cx={dotX}
                          cy={13}
                          r={5.5}
                          fill="#059669"
                          stroke="#ffffff"
                          strokeWidth={1.75}
                        />
                      </svg>
                    </div>

                    <span className="w-16 text-right font-mono text-[11px] font-bold text-stone-800 tabular-nums shrink-0">
                      {item.count} ({item.validPct}%)
                    </span>
                  </button>
                );
              })}

              {/* Axis Scale Labels */}
              <div className="flex items-center gap-2.5 px-2 pt-0.5">
                <div className="w-[44%] shrink-0 text-[10px] text-stone-400">
                  Interviews mentioning habit
                </div>
                <div className="flex-1 min-w-[90px] flex items-center justify-between text-[10px] font-mono tabular-nums text-stone-400 px-1">
                  {activityTicks.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <div className="w-16 shrink-0" />
              </div>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
          <span className="text-stone-500">Routine co-occurrence matrix available in sub-tab</span>
          <button
            type="button"
            onClick={() => onSelectTab('A')}
            className="font-semibold text-emerald-700 hover:underline cursor-pointer whitespace-nowrap"
          >
            View Heatmap →
          </button>
        </div>
      </section>

      {/* 4. Knowledge [K] — Donut Ring Chart (Aware vs Unaware vs Unstated) */}
      <section
        className={`${DIM_META.K.colSpan} rounded-2xl border border-stone-200 bg-white p-5 flex flex-col justify-between space-y-4`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${DIM_META.K.badgeClass}`}
              >
                K
              </span>
              <h4 className="text-sm font-bold text-stone-900">{DIM_META.K.title}</h4>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('K')}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>Full Table</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Donut + Interactive 3-State Legend */}
          <div className="mt-4 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4">
            <div className="relative w-[136px] h-[136px] shrink-0 flex items-center justify-center">
              {totalRecords === 0 ? (
                <div className="w-28 h-28 rounded-full border-8 border-stone-100 flex items-center justify-center text-xs text-stone-400">
                  0
                </div>
              ) : (
                <PieChart width={136} height={136}>
                  <Pie
                    data={knowledgeDonutData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={43}
                    outerRadius={62}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={knowledgeDonutData.length > 1 ? 2 : 0}
                    stroke="none"
                    className="cursor-pointer outline-none"
                    onClick={(_data, idx) => {
                      const slice = knowledgeDonutData[idx];
                      if (slice?.traceItem) onTraceItem(slice.traceItem);
                    }}
                  >
                    {knowledgeDonutData.map((slice) => (
                      <Cell key={slice.key} fill={slice.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const datum = payload[0].payload as (typeof knowledgeDonutData)[number];
                      return (
                        <div className="bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 shadow-lg text-[11px] font-mono tabular-nums">
                          <div className="font-sans font-bold text-stone-900">{datum.name}</div>
                          <div className="text-stone-700">
                            {datum.count} / {totalRecords} ({datum.pctOfTotal}%)
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              )}

              {/* Center Metric: Stated Coverage % */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold font-mono tabular-nums text-stone-900 leading-none">
                  {kStatedCoveragePct}%
                </span>
                <span className="text-[10px] font-semibold text-stone-500 mt-0.5">
                  stated
                </span>
                <span className="text-[10px] font-mono tabular-nums text-stone-400">
                  {kAwarenessGroup?.statedCount ?? 0}/{totalRecords}
                </span>
              </div>
            </div>

            {/* 3-Segment Clickable Legend */}
            <div className="flex-1 w-full space-y-1.5">
              {knowledgeSlices.map((slice) => {
                const canTrace = Boolean(slice.traceItem && slice.count > 0);
                const active = isItemFilterActive(slice.traceItem);
                return (
                  <button
                    key={slice.key}
                    type="button"
                    disabled={!canTrace}
                    onClick={() => slice.traceItem && onTraceItem(slice.traceItem)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-indigo-50 border-indigo-300'
                        : canTrace
                        ? 'bg-stone-50/70 border-stone-200/80 hover:bg-indigo-50/50 hover:border-indigo-200 cursor-pointer'
                        : 'bg-stone-50/40 border-stone-100 opacity-60 cursor-default'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: slice.color,
                          border: slice.key === 'unstated' ? '1px solid #cbd5e1' : undefined,
                        }}
                      />
                      <span className="text-xs font-medium text-stone-800 truncate">
                        {slice.name}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] font-bold tabular-nums text-stone-800 shrink-0">
                      {slice.count} ({slice.pctOfTotal}%)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Qualitative Themes Pills */}
        {kThemesGroup && kThemesGroup.items.length > 0 && (
          <div className="pt-2.5 border-t border-stone-100 space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              Top Understanding Themes
            </div>
            <div className="flex flex-wrap gap-1.5">
              {kThemesGroup.items
                .filter((t) => t.key !== '__null__')
                .slice(0, 3)
                .map((theme) => (
                  <button
                    key={theme.key}
                    type="button"
                    onClick={() => onTraceItem(theme)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-indigo-200/80 bg-indigo-50/60 hover:bg-indigo-100/70 text-[11px] text-indigo-950 font-medium cursor-pointer"
                  >
                    <span className="truncate max-w-[165px]">{theme.label}</span>
                    <strong className="font-mono tabular-nums">{theme.count}</strong>
                  </button>
                ))}
            </div>
          </div>
        )}
      </section>

      {/* 5. Demographics [D] — Split Roles & Residence Stacked Mini-Bars */}
      <section
        className={`${DIM_META.D.colSpan} rounded-2xl border border-stone-200 bg-white p-5 flex flex-col justify-between space-y-4`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${DIM_META.D.badgeClass}`}
              >
                D
              </span>
              <h4 className="text-sm font-bold text-stone-900">{DIM_META.D.title}</h4>
              <div className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => setRlTooltipOpen((v) => !v)}
                  className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
                  aria-label="RL vs IL separation info"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {rlTooltipOpen && (
                  <div className="absolute left-0 top-full mt-1 z-20 w-64 rounded-xl border border-stone-200 bg-white p-3 shadow-lg text-[11px] text-stone-600 leading-relaxed">
                    Residential Location [RL] tracks participant home townships inside Demographics [D], strictly split from retail venues [IL].
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('D')}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>Full Table</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Two Split Stacked Mini-Bars: Roles [FR] vs Residence [RL] */}
          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
            {/* Sub-card 1: Family Roles [FR] */}
            <div className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-stone-800">Roles [FR]</span>
                <span className="text-[11px] font-mono tabular-nums text-stone-600">
                  {dRoleGroup?.statedCount ?? 0}/{totalRecords} stated
                </span>
              </div>

              {/* 100% Stacked Mini-Bar */}
              <div className="w-full h-3.5 bg-[#e2e8f0] rounded-md overflow-hidden flex">
                {dRoleStatedItems.map((seg) => {
                  const pct =
                    totalRecords > 0 ? (seg.count / totalRecords) * 100 : 0;
                  return (
                    <button
                      key={seg.key}
                      type="button"
                      onClick={() => onTraceItem(seg)}
                      title={`${seg.label}: ${seg.count}/${totalRecords} (${seg.totalPct}%)`}
                      className="h-full cursor-pointer hover:opacity-85 transition-opacity"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  );
                })}
              </div>

              <div className="space-y-1">
                {dRoleStatedItems.slice(0, 3).map((seg) => (
                  <button
                    key={seg.key}
                    type="button"
                    onClick={() => onTraceItem(seg)}
                    className={`w-full flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded hover:bg-sky-50 cursor-pointer ${
                      isItemFilterActive(seg) ? 'bg-sky-100/70 font-bold' : ''
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 text-stone-700 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="truncate">{seg.label}</span>
                    </span>
                    <span className="font-mono font-bold tabular-nums text-stone-800">
                      {seg.count}
                    </span>
                  </button>
                ))}
                {dRoleUnstated && (
                  <button
                    type="button"
                    onClick={() => onTraceItem(dRoleUnstated)}
                    className="w-full flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded hover:bg-stone-100 text-stone-500 cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#e2e8f0] border border-stone-300 shrink-0" />
                      <span>Unstated</span>
                    </span>
                    <span className="font-mono tabular-nums">{dRoleUnstated.count}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sub-card 2: Residence [RL] */}
            <div className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-stone-800">Residence [RL]</span>
                <span className="text-[11px] font-mono tabular-nums text-stone-600">
                  {dResidenceGroup?.statedCount ?? 0}/{totalRecords} stated
                </span>
              </div>

              {/* 100% Stacked Mini-Bar */}
              <div className="w-full h-3.5 bg-[#e2e8f0] rounded-md overflow-hidden flex">
                {dResStatedItems.map((seg) => {
                  const pct =
                    totalRecords > 0 ? (seg.count / totalRecords) * 100 : 0;
                  return (
                    <button
                      key={seg.key}
                      type="button"
                      onClick={() => onTraceItem(seg)}
                      title={`${seg.label}: ${seg.count}/${totalRecords} (${seg.totalPct}%)`}
                      className="h-full cursor-pointer hover:opacity-85 transition-opacity"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  );
                })}
              </div>

              <div className="space-y-1">
                {dResStatedItems.slice(0, 3).map((seg) => (
                  <button
                    key={seg.key}
                    type="button"
                    onClick={() => onTraceItem(seg)}
                    className={`w-full flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded hover:bg-sky-50 cursor-pointer ${
                      isItemFilterActive(seg) ? 'bg-sky-100/70 font-bold' : ''
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 text-stone-700 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="truncate">{seg.label}</span>
                    </span>
                    <span className="font-mono font-bold tabular-nums text-stone-800">
                      {seg.count}
                    </span>
                  </button>
                ))}
                {dResUnstated && (
                  <button
                    type="button"
                    onClick={() => onTraceItem(dResUnstated)}
                    className="w-full flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded hover:bg-stone-100 text-stone-500 cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#e2e8f0] border border-stone-300 shrink-0" />
                      <span>Unstated</span>
                    </span>
                    <span className="font-mono tabular-nums">{dResUnstated.count}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Timing [T] — Ordered Frequency Spectrum Bar Chart */}
      <section
        className={`${DIM_META.T.colSpan} rounded-2xl border border-stone-200 bg-white p-5 flex flex-col justify-between space-y-4`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${DIM_META.T.badgeClass}`}
              >
                T
              </span>
              <h4 className="text-sm font-bold text-stone-900">{DIM_META.T.title}</h4>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('T')}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>Full Table</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {tGroup && (
            <div className="mt-2.5 pb-2.5 border-b border-stone-100 flex items-center justify-between text-[11px] font-mono tabular-nums text-stone-600">
              <span>
                <strong className="text-stone-900">{tGroup.statedCount}</strong> Stated ·{' '}
                {tGroup.unstatedCount} Null
              </span>
              <span className="font-semibold text-rose-700">
                {tGroup.validCoveragePct}% coverage
              </span>
            </div>
          )}

          {/* Ordered Spectrum: Daily -> Weekly -> Occasional -> Trigger -> Monthly */}
          <div className="mt-3 space-y-2">
            {timingSpectrum.map((bucket, idx) => {
              const widthPct =
                bucket.count > 0
                  ? Math.max(10, Math.round((bucket.count / maxTimingCount) * 100))
                  : 0;
              const hasData = Boolean(bucket.item && bucket.count > 0);
              const active = isItemFilterActive(bucket.item);
              return (
                <button
                  key={bucket.id}
                  type="button"
                  disabled={!hasData}
                  onClick={() => bucket.item && onTraceItem(bucket.item)}
                  title={
                    bucket.item
                      ? `${bucket.label} — ${bucket.item.formulaText}`
                      : `${bucket.label}: 0 mentions`
                  }
                  className={`w-full text-left rounded-lg px-2 py-1.5 transition-colors border ${
                    active
                      ? 'bg-rose-50 border-rose-300 cursor-pointer'
                      : hasData
                      ? 'border-transparent hover:bg-rose-50/60 hover:border-rose-200/70 cursor-pointer'
                      : 'border-transparent opacity-55 cursor-default'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs mb-1">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-1.5 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: bucket.color }}
                      />
                      <span className="font-medium text-stone-800 truncate">
                        {bucket.label}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] font-bold text-stone-800 tabular-nums shrink-0">
                      {hasData ? `${bucket.count} (${bucket.validPct}%)` : '0'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    {hasData && (
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: bucket.color,
                        }}
                      />
                    )}
                  </div>
                  {idx === 0 && hasData && (
                    <div className="text-[10px] text-rose-700 font-medium mt-0.5">
                      Highest habit strength
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. Metadata [M] — Field Venues Ranked Horizontal Bar Chart + Map Link */}
      <section
        className={`${DIM_META.M.colSpan} rounded-2xl border border-stone-200 bg-white p-5 flex flex-col justify-between space-y-4`}
      >
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${DIM_META.M.badgeClass}`}
              >
                M
              </span>
              <h4 className="text-sm font-bold text-stone-900">{DIM_META.M.title}</h4>
              <div className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => setIlTooltipOpen((v) => !v)}
                  className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
                  aria-label="RL vs IL separation info"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {ilTooltipOpen && (
                  <div className="absolute left-0 top-full mt-1 z-20 w-64 rounded-xl border border-stone-200 bg-white p-3 shadow-lg text-[11px] text-stone-600 leading-relaxed">
                    Interview Location [IL] tracks retail field malls inside Metadata [M], strictly split from home districts [RL].
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {onOpenMap && (
                <button
                  type="button"
                  onClick={onOpenMap}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-orange-50 hover:border-orange-300 text-[11px] font-bold text-stone-700 hover:text-orange-900 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <MapPin className="w-3 h-3 text-[#EA580C]" />
                  <span>View on Fieldwork Map</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelectTab('M')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span>Full Table</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {mGroup && (
            <div className="mt-2.5 pb-2.5 border-b border-stone-100 flex items-center justify-between text-[11px] font-mono tabular-nums text-stone-600">
              <span>
                <strong className="text-stone-900">{mGroup.statedCount}</strong> Stated ·{' '}
                {mGroup.unstatedCount} Null · {mGroup.totalRecords} Total
              </span>
              <span className="font-semibold text-slate-700">
                {mGroup.validCoveragePct}% coverage
              </span>
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {topVenues.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-2 md:col-span-2">
                No stated field venues [IL] in verified records yet.
              </p>
            ) : (
              topVenues.map((venue) => {
                const widthPct = Math.max(8, Math.round((venue.count / maxVenueCount) * 100));
                const active = isItemFilterActive(venue);
                return (
                  <button
                    key={venue.key}
                    type="button"
                    onClick={() => onTraceItem(venue)}
                    title={`${venue.label} — ${venue.formulaText}`}
                    className={`w-full text-left rounded-xl px-3 py-2 border transition-colors cursor-pointer group ${
                      active
                        ? 'bg-slate-100 border-slate-400'
                        : 'bg-stone-50/60 border-stone-200/70 hover:bg-slate-100/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                      <span className="font-semibold text-stone-800 group-hover:text-slate-950 truncate">
                        {venue.label}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-800 tabular-nums shrink-0">
                        {venue.count} ({venue.validPct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-200/70 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: '#475569',
                        }}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
