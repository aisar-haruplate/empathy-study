import React, { useMemo, useState } from 'react';
import { ArrowRight, MapPin, Search, X } from 'lucide-react';
import type { ADKOTMDimensionKey, InterviewRecord } from '../../types';
import { AdkotmAnalyticsEngine } from '../../domain/adkotm';
import {
  TIMING_BUCKETS,
  type TraceableBreakdownItem,
  type TraceableDimensionDataset,
} from '../../lib/decodeAnalytics';

export interface CategoryChartBaseProps {
  dataset: TraceableDimensionDataset;
  totalRecords: number;
  onSelectTab?: (dim: ADKOTMDimensionKey) => void;
  onSelectItem?: (item: TraceableBreakdownItem) => void;
  activeFilterKey?: string | null;
}

const getItemKey = (item: TraceableBreakdownItem) =>
  `${item.dimension}::${item.fieldKey}::${item.key}`;

interface CardShellProps {
  dimension: ADKOTMDimensionKey;
  badgeText: string;
  badgeStyle: { bg: string; text: string; border: string };
  title: string;
  subtitle: string;
  coverageText: string;
  onSelectTab?: (dim: ADKOTMDimensionKey) => void;
  extraAction?: React.ReactNode;
  children: React.ReactNode;
}

const CategoryCardShell: React.FC<CardShellProps> = ({
  dimension,
  badgeText,
  badgeStyle,
  title,
  subtitle,
  coverageText,
  onSelectTab,
  extraAction,
  children,
}) => (
  <div className="bg-[#FDFCF8] rounded-3xl border border-[#D4DFD9] p-5 flex flex-col gap-3.5 shadow-2xs">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border"
            style={{
              backgroundColor: badgeStyle.bg,
              color: badgeStyle.text,
              borderColor: badgeStyle.border,
            }}
          >
            {badgeText}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#F2F5F3] text-[#4F5E57] border border-[#E0E7E3]">
            {coverageText}
          </span>
        </div>
        <h4 className="font-heading text-sm font-bold text-[#1B2420] mt-1.5 leading-snug">
          {title}
        </h4>
        <p className="text-xs text-[#4F5E57] mt-0.5 leading-snug">{subtitle}</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {extraAction}
        {onSelectTab && (
          <button
            type="button"
            onClick={() => onSelectTab(dimension)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#528BCA] bg-[#DCE8F7]/60 hover:bg-[#DCE8F7] border border-[#528BCA]/25 cursor-pointer transition-colors"
            title={`Drill into ${badgeText}`}
          >
            <span>Explore</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>

    {children}
  </div>
);

/**
 * A · Activities → Sorted Horizontal Bar Chart (#4FA896 / #96D6C7 mint green)
 * Includes compact search/filter box automatically when > 8 routines appear.
 */
export const ActivitiesCategoryChart: React.FC<CategoryChartBaseProps> = ({
  dataset,
  totalRecords,
  onSelectTab,
  onSelectItem,
  activeFilterKey,
}) => {
  const [query, setQuery] = useState('');
  const group = dataset.groups[0];

  const sortedItems = useMemo(
    () =>
      [...(group?.items || [])]
        .filter((i) => i.key !== '__null__' && i.count > 0)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    [group]
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedItems;
    return sortedItems.filter((i) => i.label.toLowerCase().includes(q));
  }, [sortedItems, query]);

  if (sortedItems.length === 0) return null;

  const maxCount = Math.max(1, ...sortedItems.map((i) => i.count));
  const showSearch = sortedItems.length > 8;

  return (
    <CategoryCardShell
      dimension="A"
      badgeText="A · ACTIVITIES"
      badgeStyle={{ bg: '#DDF3ED', text: '#1C5B4E', border: '#96D6C7' }}
      title="Routines, Shopping & Consumption Habits"
      subtitle="Ranked by signal frequency · Click a bar to inspect quotes or filter"
      coverageText={`${group?.statedCount ?? 0}/${totalRecords} stated`}
      onSelectTab={onSelectTab}
    >
      {showSearch && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#4F5E57] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${sortedItems.length} routines...`}
            className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-[#D4DFD9] bg-[#F2F5F3]/70 text-xs text-[#1B2420] focus:outline-none focus:bg-[#FDFCF8] focus:border-[#4FA896]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear routine filter"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4F5E57] hover:text-[#1B2420] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
        {filteredItems.length === 0 ? (
          <p className="text-xs text-[#4F5E57] py-4 text-center">No routines match &ldquo;{query}&rdquo;.</p>
        ) : (
          filteredItems.map((item, idx) => {
            const isSelected = activeFilterKey === getItemKey(item);
            const widthPct = Math.max(8, Math.round((item.count / maxCount) * 100));
            const barColor = idx === 0 ? '#4FA896' : '#96D6C7';
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectItem?.(item)}
                className={`w-full text-left p-2.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#DDF3ED]/75 border-[#4FA896] ring-1 ring-[#4FA896]/30'
                    : 'bg-[#F2F5F3]/55 border-transparent hover:bg-[#F2F5F3] hover:border-[#D4DFD9]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span className="text-xs font-semibold text-[#1B2420] leading-snug break-words">
                    {item.label}
                  </span>
                  <span className="text-xs font-mono font-semibold text-[#1B2420] shrink-0 whitespace-nowrap">
                    {item.count}{' '}
                    <span className="text-[#4F5E57] font-normal">({item.validPct}% stated)</span>
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#E7ECE9] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                  />
                </div>
              </button>
            );
          })
        )}
      </div>
    </CategoryCardShell>
  );
};

/**
 * D · Demographics (FR & RL) → Horizontal Bar Chart (replaces pie chart)
 * Cornflower blue (#528BCA), periwinkle (#6E8FDB), sunburst yellow (#F7D147) accents.
 */
export const DemographicsCategoryChart: React.FC<CategoryChartBaseProps> = ({
  dataset,
  totalRecords,
  onSelectTab,
  onSelectItem,
  activeFilterKey,
}) => {
  const [subMode, setSubMode] = useState<'FR' | 'RL'>('FR');
  const frGroup = dataset.groups[0];
  const rlGroup = dataset.groups[1];

  const hasFR = (frGroup?.statedCount ?? 0) > 0;
  const hasRL = (rlGroup?.statedCount ?? 0) > 0;
  if (!hasFR && !hasRL) return null;

  const activeGroup = subMode === 'RL' && hasRL ? rlGroup : frGroup || rlGroup;
  const items = [...(activeGroup?.items || [])].filter((i) => i.count > 0);
  const maxCount = Math.max(1, ...items.map((i) => i.count));
  const BAR_ACCENTS = ['#528BCA', '#6E8FDB', '#F7D147', '#4FA896'];

  return (
    <CategoryCardShell
      dimension="D"
      badgeText="D · DEMOGRAPHICS"
      badgeStyle={{ bg: '#DCE8F7', text: '#234B78', border: '#A7C6EA' }}
      title={subMode === 'RL' && hasRL ? 'Residential Location [RL]' : 'Family Roles [FR]'}
      subtitle="Horizontal comparison bars including Unstated (Null) without pie crowding"
      coverageText={`${activeGroup?.statedCount ?? 0}/${totalRecords} stated`}
      onSelectTab={onSelectTab}
      extraAction={
        hasFR && hasRL ? (
          <div className="inline-flex rounded-full bg-[#F2F5F3] p-0.5 border border-[#D4DFD9]">
            {(['FR', 'RL'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSubMode(m)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold cursor-pointer transition-colors ${
                  subMode === m ? 'bg-[#528BCA] text-white' : 'text-[#4F5E57] hover:text-[#1B2420]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-2">
        {items.map((item, idx) => {
          const isNull = item.key === '__null__';
          const isSelected = activeFilterKey === getItemKey(item);
          const widthPct = Math.max(8, Math.round((item.count / maxCount) * 100));
          const barColor = isNull ? '#E2E6E4' : BAR_ACCENTS[idx % BAR_ACCENTS.length];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectItem?.(item)}
              className={`w-full text-left p-2.5 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#DCE8F7]/75 border-[#528BCA] ring-1 ring-[#528BCA]/30'
                  : 'bg-[#F2F5F3]/55 border-transparent hover:bg-[#F2F5F3] hover:border-[#D4DFD9]'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span
                  className={`text-xs font-semibold leading-snug break-words ${
                    isNull ? 'text-[#5C6B64] italic' : 'text-[#1B2420]'
                  }`}
                >
                  {item.label}
                </span>
                <span className="text-xs font-mono font-semibold text-[#1B2420] shrink-0 whitespace-nowrap">
                  {item.count}{' '}
                  <span className="text-[#4F5E57] font-normal">
                    {isNull ? `(${item.totalPct}% of N)` : `(${item.validPct}% stated)`}
                  </span>
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#E7ECE9] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </CategoryCardShell>
  );
};

/**
 * K · Knowledge → 100% Stacked Horizontal Bar Chart
 * Contrasts Aware (#4FA896), Not Aware (#F7D147), and Unstated (Null) (#E2E6E4).
 */
export const KnowledgeCategoryChart: React.FC<CategoryChartBaseProps> = ({
  dataset,
  totalRecords,
  onSelectTab,
  onSelectItem,
  activeFilterKey,
}) => {
  const group = dataset.groups[0];
  if (!group || group.statedCount === 0) return null;

  const awareItem = group.items.find((i) => i.label === 'Aware') || null;
  const notAwareItem = group.items.find((i) => i.label === 'Not Aware') || null;
  const unstatedCount = Math.max(
    0,
    group.unstatedCount ?? totalRecords - (awareItem?.count ?? 0) - (notAwareItem?.count ?? 0)
  );
  const unstatedItem = group.items.find((i) => i.key === '__null__') || null;

  const segments = [
    {
      key: 'aware',
      label: 'Aware',
      count: awareItem?.count ?? 0,
      validPct: awareItem?.validPct ?? 0,
      totalPct: totalRecords > 0 ? Math.round(((awareItem?.count ?? 0) / totalRecords) * 100) : 0,
      color: '#4FA896',
      textColor: '#FFFFFF',
      item: awareItem,
      isNull: false,
    },
    {
      key: 'not_aware',
      label: 'Not Aware',
      count: notAwareItem?.count ?? 0,
      validPct: notAwareItem?.validPct ?? 0,
      totalPct:
        totalRecords > 0 ? Math.round(((notAwareItem?.count ?? 0) / totalRecords) * 100) : 0,
      color: '#F7D147',
      textColor: '#3B2E00',
      item: notAwareItem,
      isNull: false,
    },
    {
      key: 'unstated',
      label: 'Unstated (Null)',
      count: unstatedCount,
      validPct: 0,
      totalPct: totalRecords > 0 ? Math.round((unstatedCount / totalRecords) * 100) : 0,
      color: '#E2E6E4',
      textColor: '#4F5E57',
      item: unstatedItem,
      isNull: true,
    },
  ];

  const nonZeroSegments = segments.filter((s) => s.count > 0);

  return (
    <CategoryCardShell
      dimension="K"
      badgeText="K · KNOWLEDGE"
      badgeStyle={{ bg: '#DCE8F7', text: '#234B78', border: '#A7C6EA' }}
      title="Gut Health Awareness [AW]"
      subtitle="100% proportional breakdown showing both % of stated and % of total N"
      coverageText={`${group.statedCount}/${totalRecords} stated`}
      onSelectTab={onSelectTab}
    >
      {/* 100% Stacked Horizontal Bar */}
      <div className="w-full h-9 rounded-2xl overflow-hidden flex border border-[#D4DFD9] bg-[#E2E6E4]">
        {nonZeroSegments.map((seg) => (
          <button
            key={seg.key}
            type="button"
            onClick={() => seg.item && onSelectItem?.(seg.item)}
            style={{ width: `${Math.max(seg.totalPct, 6)}%`, backgroundColor: seg.color, color: seg.textColor }}
            title={`${seg.label}: ${seg.count} (${seg.isNull ? `${seg.totalPct}% of N` : `${seg.validPct}% stated · ${seg.totalPct}% of N`})`}
            className="h-full flex items-center justify-center text-[11px] font-mono font-bold transition-opacity hover:opacity-90 cursor-pointer px-1 truncate"
          >
            {seg.totalPct >= 14 ? `${seg.totalPct}%` : ''}
          </button>
        ))}
      </div>

      {/* Interactive Segment Legend Cards */}
      <div className="grid grid-cols-3 gap-2">
        {segments.map((seg) => {
          const isSelected = seg.item ? activeFilterKey === getItemKey(seg.item) : false;
          return (
            <button
              key={seg.key}
              type="button"
              disabled={!seg.item}
              onClick={() => seg.item && onSelectItem?.(seg.item)}
              className={`text-left p-2.5 rounded-2xl border transition-all ${
                seg.item ? 'cursor-pointer' : 'cursor-default opacity-75'
              } ${
                isSelected
                  ? 'bg-[#DCE8F7]/75 border-[#528BCA] ring-1 ring-[#528BCA]/30'
                  : 'bg-[#F2F5F3]/65 border-[#E0E7E3] hover:bg-[#F2F5F3]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-[11px] font-semibold text-[#1B2420] truncate">
                  {seg.label}
                </span>
              </div>
              <div className="mt-1 font-heading text-base font-bold text-[#1B2420]">
                {seg.count}
              </div>
              <div className="text-[10px] font-mono text-[#4F5E57] leading-tight mt-0.5">
                {seg.isNull ? `${seg.totalPct}% of N` : `${seg.validPct}% stated · ${seg.totalPct}% N`}
              </div>
            </button>
          );
        })}
      </div>
    </CategoryCardShell>
  );
};

/**
 * O · Objects & Products → Single outer card with two separate horizontal bar sub-charts:
 *   1. Products Purchased [PP] (mint green #4FA896 / #96D6C7)
 *   2. Brand Preferences [PP1] (sunburst yellow/gold #E5B822 / #F7D147)
 * Each uses its own stated denominator from AdkotmAnalyticsEngine with no inner scroll clipping.
 */
export const ObjectsCategoryChart: React.FC<CategoryChartBaseProps> = ({
  dataset,
  totalRecords,
  onSelectTab,
  onSelectItem,
  activeFilterKey,
}) => {
  const ppGroup =
    dataset.groups.find((g) => g.id === 'o_products_pp' || g.fieldKey === 'productsPurchased') ||
    dataset.groups[0];
  const pp1Group =
    dataset.groups.find((g) => g.id === 'o_brands_pp1' || g.fieldKey === 'brandPreferences') ||
    dataset.groups[1];

  const ppItems = [...(ppGroup?.items || [])]
    .filter((i) => i.key !== '__null__' && i.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const pp1Items = [...(pp1Group?.items || [])]
    .filter((i) => i.key !== '__null__' && i.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  if (ppItems.length === 0 && pp1Items.length === 0) return null;

  const ppMax = Math.max(1, ...ppItems.map((i) => i.count));
  const pp1Max = Math.max(1, ...pp1Items.map((i) => i.count));
  const totalSignals =
    dataset.totalSignals ||
    ppItems.reduce((sum, i) => sum + i.count, 0) + pp1Items.reduce((sum, i) => sum + i.count, 0);

  return (
    <CategoryCardShell
      dimension="O"
      badgeText="O · OBJECTS"
      badgeStyle={{ bg: '#FDF3C7', text: '#735907', border: '#F7D147' }}
      title="Objects & Products [PP & PP1]"
      subtitle="Separate stated denominators for products purchased and named brands"
      coverageText={`${totalSignals} coded signal${totalSignals === 1 ? '' : 's'}`}
      onSelectTab={onSelectTab}
    >
      <div className="space-y-4">
        {/* Sub-Chart 1: Products Purchased [PP] */}
        {ppItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#4FA896] shrink-0" />
                <h5 className="text-xs font-bold text-[#1B2420]">Products Purchased [PP]</h5>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#DDF3ED] text-[#1C5B4E] border border-[#96D6C7]">
                {ppGroup?.statedCount ?? 0}/{totalRecords} stated
              </span>
            </div>

            <div className="space-y-1.5">
              {ppItems.map((item, idx) => {
                const isSelected = activeFilterKey === getItemKey(item);
                const widthPct = Math.max(8, Math.round((item.count / ppMax) * 100));
                const barColor = idx === 0 ? '#4FA896' : '#96D6C7';

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onSelectItem?.(item)}
                    className={`w-full text-left p-2.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#DDF3ED]/75 border-[#4FA896] ring-1 ring-[#4FA896]/30'
                        : 'bg-[#F2F5F3]/55 border-transparent hover:bg-[#F2F5F3] hover:border-[#D4DFD9]'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="text-xs font-semibold text-[#1B2420] leading-snug break-words">
                        {item.label}
                      </span>
                      <span className="text-xs font-mono font-semibold text-[#1B2420] shrink-0 whitespace-nowrap">
                        {item.count}{' '}
                        <span className="text-[#4F5E57] font-normal">· {item.validPct}%</span>
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#E7ECE9] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Subtle Divider */}
        {ppItems.length > 0 && pp1Items.length > 0 && (
          <div className="border-t border-[#E2E6E4]" />
        )}

        {/* Sub-Chart 2: Brand Preferences [PP1] */}
        {pp1Items.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E5B822] shrink-0" />
                <h5 className="text-xs font-bold text-[#1B2420]">Brand Preferences [PP1]</h5>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#FDF3C7] text-[#735907] border border-[#F7D147]">
                {pp1Group?.statedCount ?? 0}/{totalRecords} stated
              </span>
            </div>

            <div className="space-y-1.5">
              {pp1Items.map((item, idx) => {
                const isSelected = activeFilterKey === getItemKey(item);
                const widthPct = Math.max(8, Math.round((item.count / pp1Max) * 100));
                const barColor = idx === 0 ? '#E5B822' : '#F7D147';

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onSelectItem?.(item)}
                    className={`w-full text-left p-2.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#FDF3C7]/80 border-[#E5B822] ring-1 ring-[#E5B822]/30'
                        : 'bg-[#F2F5F3]/55 border-transparent hover:bg-[#F2F5F3] hover:border-[#D4DFD9]'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="text-xs font-semibold text-[#1B2420] leading-snug break-words">
                        {item.label}
                      </span>
                      <span className="text-xs font-mono font-semibold text-[#1B2420] shrink-0 whitespace-nowrap">
                        {item.count}{' '}
                        <span className="text-[#4F5E57] font-normal">
                          · {item.validPct}% stated
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#E7ECE9] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </CategoryCardShell>
  );
};

/**
 * T · Timing & Context → 100% Stacked Horizontal Bar Chart
 * Contrasts cadence tiers (Daily / Every Morning, Weekly, Occasionally / As Needed, Unstated (Null)).
 */
export const TimingCategoryChart: React.FC<CategoryChartBaseProps> = ({
  dataset,
  totalRecords,
  onSelectTab,
  onSelectItem,
  activeFilterKey,
}) => {
  const group = dataset.groups[0];
  if (!group || group.statedCount === 0) return null;

  const byLabel = new Map<string, TraceableBreakdownItem>();
  for (const item of group.items) {
    if (item.key !== '__null__') byLabel.set(item.label, item);
  }
  const unstatedItem = group.items.find((i) => i.key === '__null__') || null;
  const unstatedCount = group.unstatedCount ?? Math.max(0, totalRecords - group.statedCount);

  const BUCKET_COLORS = ['#4FA896', '#528BCA', '#F7D147', '#96D6C7', '#6E8FDB'];
  const segments: Array<{
    key: string;
    label: string;
    count: number;
    validPct: number;
    totalPct: number;
    color: string;
    textColor: string;
    item: TraceableBreakdownItem | null;
    isNull: boolean;
  }> = TIMING_BUCKETS.map((b, idx) => {
    const match = byLabel.get(b.label) || null;
    const count = match?.count ?? 0;
    const totalPct = totalRecords > 0 ? Math.round((count / totalRecords) * 100) : 0;
    return {
      key: String(b.id),
      label: String(b.label),
      count,
      validPct: match?.validPct ?? 0,
      totalPct,
      color: BUCKET_COLORS[idx % BUCKET_COLORS.length],
      textColor: BUCKET_COLORS[idx % BUCKET_COLORS.length] === '#F7D147' ? '#3B2E00' : '#FFFFFF',
      item: match,
      isNull: false,
    };
  }).filter((s) => s.count > 0);

  if (unstatedCount > 0) {
    segments.push({
      key: '__null__',
      label: 'Unstated (Null)',
      count: unstatedCount,
      validPct: 0,
      totalPct: totalRecords > 0 ? Math.round((unstatedCount / totalRecords) * 100) : 0,
      color: '#E2E6E4',
      textColor: '#4F5E57',
      item: unstatedItem,
      isNull: true,
    });
  }

  return (
    <CategoryCardShell
      dimension="T"
      badgeText="T · TIMING"
      badgeStyle={{ bg: '#E7ECE9', text: '#3A4A43', border: '#C9D2CE' }}
      title="Consumption & Purchase Cadence"
      subtitle="100% stacked cadence tiers with exact counts and valid percentages"
      coverageText={`${group.statedCount}/${totalRecords} stated`}
      onSelectTab={onSelectTab}
    >
      {/* 100% Stacked Horizontal Bar */}
      <div className="w-full h-9 rounded-2xl overflow-hidden flex border border-[#D4DFD9] bg-[#E2E6E4]">
        {segments.map((seg) => (
          <button
            key={seg.key}
            type="button"
            onClick={() => seg.item && onSelectItem?.(seg.item)}
            style={{ width: `${Math.max(seg.totalPct, 6)}%`, backgroundColor: seg.color, color: seg.textColor }}
            title={`${seg.label}: ${seg.count} (${seg.isNull ? `${seg.totalPct}% of N` : `${seg.validPct}% stated`})`}
            className="h-full flex items-center justify-center text-[11px] font-mono font-bold transition-opacity hover:opacity-90 cursor-pointer px-1 truncate"
          >
            {seg.totalPct >= 14 ? `${seg.totalPct}%` : ''}
          </button>
        ))}
      </div>

      {/* Segment Breakdown Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {segments.map((seg) => {
          const isSelected = seg.item ? activeFilterKey === getItemKey(seg.item) : false;
          return (
            <button
              key={seg.key}
              type="button"
              disabled={!seg.item}
              onClick={() => seg.item && onSelectItem?.(seg.item)}
              className={`text-left p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                seg.item ? 'cursor-pointer' : 'cursor-default opacity-75'
              } ${
                isSelected
                  ? 'bg-[#DCE8F7]/75 border-[#528BCA] ring-1 ring-[#528BCA]/30'
                  : 'bg-[#F2F5F3]/65 border-[#E0E7E3] hover:bg-[#F2F5F3]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span
                  className={`text-xs font-semibold leading-snug break-words ${
                    seg.isNull ? 'text-[#5C6B64] italic' : 'text-[#1B2420]'
                  }`}
                >
                  {seg.label}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-[#1B2420] shrink-0 whitespace-nowrap">
                {seg.count}{' '}
                <span className="text-[#4F5E57] font-normal">
                  ({seg.isNull ? `${seg.totalPct}% N` : `${seg.validPct}%`})
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </CategoryCardShell>
  );
};

/**
 * M · Metadata & Venues (IL) → Horizontal Bar Chart
 * Retail interview venues with interview counts and share.
 */
export const MetadataVenuesCategoryChart: React.FC<
  CategoryChartBaseProps & { onOpenMap?: () => void }
> = ({ dataset, totalRecords, onSelectTab, onSelectItem, onOpenMap, activeFilterKey }) => {
  const group = dataset.groups[0];
  const venues = [...(group?.items || [])]
    .filter((i) => i.key !== '__null__' && i.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  if (venues.length === 0) return null;

  const maxCount = Math.max(1, ...venues.map((v) => v.count));
  const VENUE_COLORS = ['#4FA896', '#528BCA', '#E5B822', '#96D6C7', '#6E8FDB'];

  return (
    <CategoryCardShell
      dimension="M"
      badgeText="M · METADATA"
      badgeStyle={{ bg: '#DDF3ED', text: '#1C5B4E', border: '#96D6C7' }}
      title="Retail Fieldwork Venues [IL]"
      subtitle="Interview counts and stated share across fieldwork locations"
      coverageText={`${group?.statedCount ?? 0}/${totalRecords} stated`}
      onSelectTab={onSelectTab}
      extraAction={
        onOpenMap ? (
          <button
            type="button"
            onClick={onOpenMap}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#1C5B4E] bg-[#DDF3ED] hover:bg-[#C6EBE0] border border-[#96D6C7] cursor-pointer transition-colors"
          >
            <MapPin className="w-3 h-3" />
            <span>Map</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-2">
        {venues.map((item, idx) => {
          const isSelected = activeFilterKey === getItemKey(item);
          const widthPct = Math.max(8, Math.round((item.count / maxCount) * 100));
          const barColor = VENUE_COLORS[idx % VENUE_COLORS.length];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectItem?.(item)}
              className={`w-full text-left p-2.5 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#DDF3ED]/75 border-[#4FA896] ring-1 ring-[#4FA896]/30'
                  : 'bg-[#F2F5F3]/55 border-transparent hover:bg-[#F2F5F3] hover:border-[#D4DFD9]'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className="text-xs font-semibold text-[#1B2420] leading-snug break-words">
                  {item.label}
                </span>
                <span className="text-xs font-mono font-semibold text-[#1B2420] shrink-0 whitespace-nowrap">
                  {item.count}{' '}
                  <span className="text-[#4F5E57] font-normal">({item.validPct}% share)</span>
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#E7ECE9] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </CategoryCardShell>
  );
};

const DEFAULT_GRID_DIMENSIONS: readonly ADKOTMDimensionKey[] = ['O', 'A', 'K', 'D', 'T', 'M'];

export interface AdkotmCategoryChartsGridProps {
  /** Pass either precomputed datasetsByDim (Step 3) OR raw filtered records (Step 4) */
  datasetsByDim?: Record<ADKOTMDimensionKey, TraceableDimensionDataset>;
  records?: readonly InterviewRecord[];
  totalRecords?: number;
  /** Optional ordered subset of ADKOTM dimensions to display (defaults to all 6) */
  dimensions?: readonly ADKOTMDimensionKey[];
  onSelectTab?: (dim: ADKOTMDimensionKey) => void;
  onSelectItem?: (item: TraceableBreakdownItem) => void;
  onOpenMap?: () => void;
  activeFilterKey?: string | null;
}

/**
 * Reusable ADKOTM Category Charts Grid.
 * Automatically skips any category with zero valid signals rather than rendering empty placeholders.
 */
export const AdkotmCategoryChartsGrid: React.FC<AdkotmCategoryChartsGridProps> = ({
  datasetsByDim,
  records,
  totalRecords,
  dimensions,
  onSelectTab,
  onSelectItem,
  onOpenMap,
  activeFilterKey,
}) => {
  const resolved = useMemo(() => {
    if (datasetsByDim) {
      return {
        byDim: datasetsByDim,
        total: totalRecords ?? datasetsByDim.O.groups[0]?.totalRecords ?? 0,
      };
    }
    const engine = new AdkotmAnalyticsEngine(records || []);
    const snap = engine.computeSnapshot();
    return {
      byDim: snap.byDimension,
      total: totalRecords ?? snap.eligibleRecordCount,
    };
  }, [datasetsByDim, records, totalRecords]);

  const orderedDimensions = useMemo(() => {
    const list = dimensions && dimensions.length > 0 ? dimensions : DEFAULT_GRID_DIMENSIONS;
    return Array.from(new Set(list));
  }, [dimensions]);

  if (resolved.total === 0) {
    return (
      <div className="bg-[#F2F5F3] rounded-3xl border border-dashed border-[#D4DFD9] p-6 text-center text-xs text-[#4F5E57]">
        No verified coded interviews match the active filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {orderedDimensions.map((dim) => {
        switch (dim) {
          case 'O':
            return (
              <ObjectsCategoryChart
                key="O"
                dataset={resolved.byDim.O}
                totalRecords={resolved.total}
                onSelectTab={onSelectTab}
                onSelectItem={onSelectItem}
                activeFilterKey={activeFilterKey}
              />
            );
          case 'A':
            return (
              <ActivitiesCategoryChart
                key="A"
                dataset={resolved.byDim.A}
                totalRecords={resolved.total}
                onSelectTab={onSelectTab}
                onSelectItem={onSelectItem}
                activeFilterKey={activeFilterKey}
              />
            );
          case 'K':
            return (
              <KnowledgeCategoryChart
                key="K"
                dataset={resolved.byDim.K}
                totalRecords={resolved.total}
                onSelectTab={onSelectTab}
                onSelectItem={onSelectItem}
                activeFilterKey={activeFilterKey}
              />
            );
          case 'D':
            return (
              <DemographicsCategoryChart
                key="D"
                dataset={resolved.byDim.D}
                totalRecords={resolved.total}
                onSelectTab={onSelectTab}
                onSelectItem={onSelectItem}
                activeFilterKey={activeFilterKey}
              />
            );
          case 'T':
            return (
              <TimingCategoryChart
                key="T"
                dataset={resolved.byDim.T}
                totalRecords={resolved.total}
                onSelectTab={onSelectTab}
                onSelectItem={onSelectItem}
                activeFilterKey={activeFilterKey}
              />
            );
          case 'M':
            return (
              <MetadataVenuesCategoryChart
                key="M"
                dataset={resolved.byDim.M}
                totalRecords={resolved.total}
                onSelectTab={onSelectTab}
                onSelectItem={onSelectItem}
                onOpenMap={onOpenMap}
                activeFilterKey={activeFilterKey}
              />
            );
        }
      })}
    </div>
  );
};
