import React, { useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Check,
  Edit3,
  FileSpreadsheet,
  Filter,
  Image as ImageIcon,
  Info,
  MoreHorizontal,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { ADKOTMDimensionKey } from '../../types';
import type {
  ActivityCooccurrenceMatrix,
  TraceableBreakdownItem,
  TraceableDimensionDataset,
  TraceableGroup,
} from '../../lib/decodeAnalytics';
import { exportBentoCardAsPng, exportCardDataAsCsv } from '../../lib/cardExport';
import { stripRecordingExtension } from '../../lib/adkotmCopilot';

interface DimensionBreakdownSectionProps {
  dataset: TraceableDimensionDataset;
  activityCooccurrence?: ActivityCooccurrenceMatrix;
  onTraceItem: (item: TraceableBreakdownItem) => void;
  onRenameCode: (params: {
    dimension: ADKOTMDimensionKey;
    fieldKey?: string;
    oldLabel: string;
    newLabel: string;
    customCategoryId?: string;
  }) => void;
  onDeleteCode: (params: {
    dimension: ADKOTMDimensionKey;
    fieldKey?: string;
    targetLabel?: string;
    mode: 'null' | 'reassign';
    reassignToLabel?: string;
    customCategoryId?: string;
    removeCustomParameterKey?: string;
  }) => void;
}

const MD3_BAR_PALETTE = [
  '#528BCA', // Cornflower Blue
  '#4FA896', // Mint Green
  '#F7D147', // Sunburst Yellow
  '#96D6C7', // Soft Mint
  '#E5B822', // Deep Sunburst
  '#7CA9DB', // Soft Cornflower
];

function buildDetailDonutArcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number
): string {
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  const x1 = cx + outerR * Math.cos(toRad(startDeg));
  const y1 = cy + outerR * Math.sin(toRad(startDeg));
  const x2 = cx + outerR * Math.cos(toRad(endDeg));
  const y2 = cy + outerR * Math.sin(toRad(endDeg));
  const x3 = cx + innerR * Math.cos(toRad(endDeg));
  const y3 = cy + innerR * Math.sin(toRad(endDeg));
  const x4 = cx + innerR * Math.cos(toRad(startDeg));
  const y4 = cy + innerR * Math.sin(toRad(startDeg));

  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function wrapLabelLines(label: string, maxCharsPerLine = 26): string[] {
  const words = label.trim().split(/\s+/);
  if (words.length <= 1 || label.length <= maxCharsPerLine) return [label];

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= 2) return lines;
  return [lines[0], lines.slice(1).join(' ')];
}

const WrappedYAxisTick: React.FC<{
  x?: number;
  y?: number;
  payload?: { value?: string };
}> = ({ x = 0, y = 0, payload }) => {
  const raw = String(payload?.value || '');
  const lines = wrapLabelLines(raw, 28);
  const startDy = lines.length === 2 ? -4 : 4;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-6}
        y={0}
        textAnchor="end"
        fill="#1C1B1F"
        fontSize={13}
        fontWeight={500}
        fontFamily="Roboto, Inter, sans-serif"
      >
        {lines.map((line, idx) => (
          <tspan key={idx} x={-6} dy={idx === 0 ? startDy : 15}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};

interface GroupCardProps {
  group: TraceableGroup;
  onTraceItem: (item: TraceableBreakdownItem) => void;
  onRenameCode: DimensionBreakdownSectionProps['onRenameCode'];
  onDeleteCode: DimensionBreakdownSectionProps['onDeleteCode'];
}

const TraceableGroupCard: React.FC<GroupCardProps> = ({
  group,
  onTraceItem,
  onRenameCode,
  onDeleteCode,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Inline row Edit / Delete state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [deletingItem, setDeletingItem] = useState<TraceableBreakdownItem | null>(null);
  const [deleteMode, setDeleteMode] = useState<'null' | 'reassign'>('null');
  const [reassignTo, setReassignTo] = useState('');

  // Quick search & recording filter (especially useful for A · Activities routines)
  const [searchQuery, setSearchQuery] = useState('');
  const [recordingFilter, setRecordingFilter] = useState<string>('all');
  const [showAllChartBars, setShowAllChartBars] = useState(false);
  const [expandedRecRowKeys, setExpandedRecRowKeys] = useState<Record<string, boolean>>({});
  const [hoveredItemKey, setHoveredItemKey] = useState<string | null>(null);
  const [includeNullInDonut, setIncludeNullInDonut] = useState(true);

  const statedItems = group.items.filter((item) => item.key !== '__null__');

  const recordingOptions = Array.from(
    new Set(
      statedItems.flatMap((item) =>
        (item.contributors || []).map((c) => stripRecordingExtension(c.fileName))
      )
    )
  ).sort((a, b) => a.localeCompare(b));

  const showFilterBar = group.dimension === 'A' || statedItems.length > 8;

  const filteredStatedItems = statedItems.filter((item) => {
    if (recordingFilter !== 'all') {
      const hasRec = (item.contributors || []).some(
        (c) => stripRecordingExtension(c.fileName) === recordingFilter
      );
      if (!hasRec) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchesLabel = item.label.toLowerCase().includes(q);
      const matchesRec = (item.contributors || []).some((c) =>
        stripRecordingExtension(c.fileName).toLowerCase().includes(q)
      );
      if (!matchesLabel && !matchesRec) return false;
    }
    return true;
  });

  const CHART_CAP = 8;
  const visibleChartSource =
    showAllChartBars || searchQuery.trim() || recordingFilter !== 'all'
      ? filteredStatedItems
      : filteredStatedItems.slice(0, CHART_CAP);

  const chartItems = visibleChartSource.map((item, idx) => ({
    ...item,
    barColor: MD3_BAR_PALETTE[idx % MD3_BAR_PALETTE.length],
  }));

  const stackedRow =
    group.chartKind === 'stacked_100'
      ? [
          Object.fromEntries([
            ['name', group.title],
            ...group.items.map((item) => [item.label, item.totalPct]),
          ]),
        ]
      : [];

  const reassignOptions = statedItems
    .filter((i) => i.key !== deletingItem?.key)
    .map((i) => i.label);

  const handleExportCsv = () => {
    setMenuOpen(false);
    exportCardDataAsCsv(
      group.title,
      group.items.map((i) => ({
        label: i.label,
        count: i.count,
        percentage: i.key === '__null__' ? `${i.totalPct}% of total` : `${i.validPct}% of stated`,
        notes: `${i.totalContextText} | Recordings: ${i.contributors
          .map((c) => stripRecordingExtension(c.fileName))
          .join('; ')}`,
      })),
      {
        statedCount: group.statedCount,
        unstatedCount: group.unstatedCount,
        totalRecords: group.totalRecords,
      }
    );
  };

  const handleExportPng = async () => {
    setMenuOpen(false);
    await exportBentoCardAsPng({
      containerEl: cardRef.current,
      title: group.title,
      code: group.dimension,
      subtitle: group.subtitle,
      fallbackData: statedItems.map((i) => ({
        label: i.label,
        count: i.count,
        color: i.color,
      })),
      fallbackTotal: group.statedCount,
    });
  };

  const barChartHeight = Math.max(180, chartItems.length * 46 + 24);

  return (
    <div
      ref={cardRef}
      className="rounded-3xl border border-[#D5DDD8] bg-[#FDFCF8] shadow-sm overflow-hidden"
    >
      {/* Card Header + Compact Single-Line Coverage Strip */}
      <div className="px-5 py-4 border-b border-[#D5DDD8] space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-heading text-base sm:text-lg font-bold text-[#292524] tracking-[-0.02em]">{group.title}</h4>
              {group.infoTooltipBody && (
                <div className="relative inline-flex">
                  <button
                    type="button"
                    onClick={() => setInfoOpen((prev) => !prev)}
                    aria-label={group.infoTooltipTitle || 'Architecture distinction'}
                    className="p-1 rounded-full text-[#78716C] hover:text-[#292524] hover:bg-[#F7F5F0] cursor-pointer"
                    title="Click for RL vs IL separation details"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  {infoOpen && (
                    <div
                      role="tooltip"
                      className="absolute left-0 top-full mt-1.5 z-30 w-72 rounded-2xl border border-[#EAE6DF] bg-white p-3.5 shadow-studio text-left"
                    >
                      {group.infoTooltipTitle && (
                        <div className="font-heading text-[13px] font-bold text-[#292524] mb-1">
                          {group.infoTooltipTitle}
                        </div>
                      )}
                      <p className="text-[13px] text-[#57534E] leading-[1.65]">
                        {group.infoTooltipBody}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-base leading-[1.65] text-[#57534E] mt-1">{group.subtitle}</p>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="p-1.5 rounded-full border border-[#EAE6DF] bg-white hover:bg-[#F7F5F0] text-[#57534E] hover:text-[#292524] cursor-pointer"
              aria-label={`Export options for ${group.title}`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1.5 z-30 w-48 rounded-2xl border border-[#EAE6DF] bg-white py-1.5 shadow-studio"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExportCsv}
                  className="w-full px-3.5 py-2 text-left text-[13px] font-medium text-[#292524] hover:bg-[#F7F5F0] flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#2B7A67]" />
                  <span>Export Table CSV</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExportPng}
                  className="w-full px-3.5 py-2 text-left text-[13px] font-medium text-[#292524] hover:bg-[#F7F5F0] flex items-center gap-2 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-[#528BCA]" />
                  <span>Export Chart PNG</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Compact Single-Line Coverage Summary Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs font-mono tabular-nums text-[#444846]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-[#1C1B1F]">
              Stated: {group.statedCount}
            </span>
            <span className="text-[#D5DDD8]" aria-hidden="true">·</span>
            <span>Unstated (null): {group.unstatedCount}</span>
            <span className="text-[#D5DDD8]" aria-hidden="true">·</span>
            <span className="font-medium text-[#1C1B1F]">
              Total Active: {group.totalRecords}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[#132B47] font-medium">
              Valid % over {group.statedCount} stated
            </span>
            <div
              className="w-20 h-1.5 bg-[#E7ECE9] rounded-full overflow-hidden shrink-0"
              aria-hidden="true"
            >
              <div
                className="h-full bg-[#528BCA] rounded-full transition-all duration-300"
                style={{ width: `${group.validCoveragePct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Purpose-Built Chart */}
      <div className="px-5 py-4 border-b border-[#D5DDD8] space-y-3">
        {/* Compact Quick Filter Bar for Activities & Large Lists */}
        {showFilterBar && statedItems.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-[#444846] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter routines by keyword or source recording..."
                aria-label={`Filter ${group.title}`}
                className="md3-field min-h-[38px] w-full pl-9 pr-3 py-1.5 text-sm placeholder-[#727975]"
              />
            </div>

            {recordingOptions.length > 0 && (
              <div className="min-h-[38px] inline-flex items-center gap-1.5 bg-[#E7ECE9] rounded-full px-3 py-1 shrink-0">
                <Filter className="w-3.5 h-3.5 text-[#528BCA] shrink-0" />
                <select
                  aria-label={`Filter ${group.title} by recording`}
                  value={recordingFilter}
                  onChange={(e) => setRecordingFilter(e.target.value)}
                  className="text-xs font-medium text-[#1C1B1F] bg-transparent border-none focus:outline-none cursor-pointer max-w-[200px]"
                >
                  <option value="all">All Recordings ({recordingOptions.length})</option>
                  {recordingOptions.map((recName) => (
                    <option key={recName} value={recName}>
                      {recName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(searchQuery.trim() || recordingFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRecordingFilter('all');
                }}
                className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FBEAE9] hover:bg-[#D97A75]/25 text-xs font-medium text-[#7A3A36] cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        )}

        {group.items.length === 0 ? (
          <div className="py-8 text-center rounded-2xl border border-dashed border-[#EAE6DF] bg-[#F7F5F0]/55">
            <p className="font-heading text-lg font-semibold text-[#292524]">
              No stated records for {group.title} yet
            </p>
            <p className="text-base leading-[1.65] text-[#78716C] mt-1">
              {group.unstatedCount} of {group.totalRecords} Human-Verified records currently have null for this field.
            </p>
          </div>
        ) : group.dimension === 'D' && group.chartKind === 'stacked_100' ? (
          (() => {
            const ROLE_PALETTE = ['#528BCA', '#4FA896', '#F7D147', '#6E8FDB', '#E5B822'];
            const allRoleItems = group.items.map((item, idx) => ({
              ...item,
              donutColor:
                item.key === '__null__'
                  ? '#E2E6E4'
                  : ROLE_PALETTE[idx % ROLE_PALETTE.length],
            }));
            const hasNullItem = allRoleItems.some((i) => i.key === '__null__' && i.count > 0);
            const donutItems = allRoleItems.filter(
              (i) => i.count > 0 && (includeNullInDonut || i.key !== '__null__')
            );
            const donutTotal = donutItems.reduce((sum, i) => sum + i.count, 0);

            const cx = 100;
            const cy = 100;
            const outerR = 88;
            const innerR = 60;
            let currentAngle = 0;
            const arcs = donutItems.map((item) => {
              const sweep = donutTotal > 0 ? (item.count / donutTotal) * 360 : 0;
              const startAngle = currentAngle;
              const endAngle = currentAngle + sweep;
              currentAngle = endAngle;
              return { item, startAngle, endAngle };
            });

            return (
              <div className="space-y-3">
                {hasNullItem && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIncludeNullInDonut((prev) => !prev)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        includeNullInDonut
                          ? 'bg-[#F2F5F3] text-[#4F5E57] border-[#D5DDD8] hover:bg-[#E7ECE9]'
                          : 'bg-[#DCE8F7] text-[#234B78] border-[#528BCA]/45'
                      }`}
                    >
                      {includeNullInDonut ? 'Exclude Unstated (Null) from Ring' : 'Include Unstated (Null) in Ring'}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-6 py-1">
                  {/* Left: Clean 2D Donut Ring */}
                  <div className="flex items-center justify-center">
                    <svg
                      viewBox="0 0 200 200"
                      className="w-[196px] h-[196px] overflow-visible"
                      role="img"
                      aria-label={`${group.title}: ${group.statedCount} stated of ${group.totalRecords} total`}
                    >
                      {donutItems.length === 1 ? (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={(outerR + innerR) / 2}
                          fill="none"
                          stroke={donutItems[0].donutColor}
                          strokeWidth={outerR - innerR}
                          className="cursor-pointer transition-opacity"
                          onMouseEnter={() => setHoveredItemKey(donutItems[0].key)}
                          onMouseLeave={() => setHoveredItemKey(null)}
                          onClick={() => onTraceItem(donutItems[0])}
                        />
                      ) : (
                        arcs.map(({ item, startAngle, endAngle }) => {
                          const isDimmed = hoveredItemKey !== null && hoveredItemKey !== item.key;
                          return (
                            <path
                              key={item.key}
                              d={buildDetailDonutArcPath(cx, cy, outerR, innerR, startAngle, endAngle)}
                              fill={item.donutColor}
                              stroke="#FDFCF8"
                              strokeWidth={2}
                              strokeLinejoin="round"
                              style={{
                                opacity: isDimmed ? 0.38 : 1,
                                transition: 'opacity 180ms ease',
                              }}
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredItemKey(item.key)}
                              onMouseLeave={() => setHoveredItemKey(null)}
                              onClick={() => onTraceItem(item)}
                            >
                              <title>
                                {item.label}: {item.count} (
                                {item.key === '__null__'
                                  ? `${item.totalPct}% of N`
                                  : `${item.validPct}% stated · ${item.totalPct}% of N`}
                                )
                              </title>
                            </path>
                          );
                        })
                      )}
                      <text
                        x={cx}
                        y={cy - 8}
                        textAnchor="middle"
                        className="font-heading font-bold fill-[#1C1B1F]"
                        style={{ fontSize: '28px' }}
                      >
                        {group.statedCount}
                      </text>
                      <text
                        x={cx}
                        y={cy + 10}
                        textAnchor="middle"
                        className="font-mono font-bold fill-[#4F5E57]"
                        style={{ fontSize: '10.5px', letterSpacing: '0.08em' }}
                      >
                        STATED
                      </text>
                      <text
                        x={cx}
                        y={cy + 25}
                        textAnchor="middle"
                        className="font-mono fill-[#727975]"
                        style={{ fontSize: '10px' }}
                      >
                        {group.totalRecords} total
                      </text>
                    </svg>
                  </div>

                  {/* Right: Role Breakdown Cards (Synced with Donut & Table) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
                    {allRoleItems.map((item) => {
                      const isNull = item.key === '__null__';
                      const isHovered = hoveredItemKey === item.key;
                      const isExcludedFromRing = isNull && !includeNullInDonut;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onMouseEnter={() => setHoveredItemKey(item.key)}
                          onMouseLeave={() => setHoveredItemKey(null)}
                          onClick={() => onTraceItem(item)}
                          className={`text-left rounded-2xl border p-3.5 transition-all cursor-pointer ${
                            isHovered
                              ? 'bg-[#DCE8F7]/60 border-[#528BCA] shadow-2xs'
                              : 'bg-[#F2F5F3]/65 border-[#D5DDD8]/80 hover:bg-[#F2F5F3] hover:border-[#528BCA]/45'
                          } ${isExcludedFromRing ? 'opacity-60' : ''}`}
                          title="Click to open Traceability Drawer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1C1B1F] min-w-0">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: item.donutColor }}
                              />
                              <span className={`truncate ${isNull ? 'text-[#5C6B64] italic' : ''}`}>
                                {item.label}
                              </span>
                            </span>
                            <span className="font-mono text-base font-bold text-[#1C1B1F] tabular-nums shrink-0">
                              {item.count}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-xs font-mono tabular-nums text-[#5C6B64]">
                            <span>
                              {isNull ? 'Excluded from Valid %' : `${item.validPct}% of stated`}
                            </span>
                            <span>{item.totalPct}% of N</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()
        ) : group.chartKind === 'stacked_100' ? (
          <div className="space-y-4">
            <div className="h-[52px] w-full">
              <ResponsiveContainer width="100%" height={52}>
                <BarChart
                  data={stackedRow}
                  layout="vertical"
                  margin={{ top: 4, right: 0, left: 0, bottom: 4 }}
                  barSize={26}
                >
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip
                    cursor={false}
                    content={({ active }) => {
                      if (!active) return null;
                      return (
                        <div className="bg-white border border-[#EAE6DF] rounded-2xl px-3.5 py-2.5 shadow-studio text-[13px] space-y-1">
                          {group.items.map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between gap-4 font-mono tabular-nums"
                            >
                              <span className="font-semibold text-[#292524]">{item.label}</span>
                              <span className="text-[#57534E]">
                                {item.count} ({item.key === '__null__' ? `${item.totalPct}% total` : `${item.validPct}% valid`})
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  {group.items.map((item, idx) => (
                    <Bar
                      key={item.key}
                      dataKey={item.label}
                      stackId="pct100"
                      fill={item.color}
                      radius={
                        group.items.length === 1
                          ? [6, 6, 6, 6]
                          : idx === 0
                          ? [6, 0, 0, 6]
                          : idx === group.items.length - 1
                          ? [0, 6, 6, 0]
                          : [0, 0, 0, 0]
                      }
                      className="cursor-pointer"
                      onClick={() => onTraceItem(item)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Click-to-Trace Segment Readout Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onTraceItem(item)}
                  className="text-left rounded-xl border border-[#EAE6DF] bg-[#F7F5F0]/65 hover:bg-[#FEFBEB] hover:border-[#F7D147] p-3.5 transition-colors cursor-pointer"
                  title="Click to open Traceability Drawer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#292524] truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="font-mono text-base font-bold text-[#292524] tabular-nums">
                      {item.count}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[13px] font-mono tabular-nums text-[#78716C]">
                    <span>
                      {item.key === '__null__'
                        ? 'Excluded from Valid %'
                        : `${item.validPct}% of stated`}
                    </span>
                    <span>{item.totalPct}% of N</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : chartItems.length === 0 ? (
          <div className="py-6 text-center rounded-2xl bg-[#F2F5F3] text-sm text-[#444846]">
            No routines match your current filter.
          </div>
        ) : (group.dimension === 'K' || group.dimension === 'D') && chartItems.length === 1 ? (
          (() => {
            const single = chartItems[0];
            const sourceRecordings = Array.from(
              new Set(
                (single.contributors || []).map((c) => stripRecordingExtension(c.fileName))
              )
            );
            const previewQuotes = Array.from(
              new Map(
                (single.contributors || [])
                  .filter((c) => c.quote && c.quote.trim())
                  .map((c) => [`${c.recordId}::${c.quote!.trim().toLowerCase()}`, c])
              ).values()
            ).slice(0, 3);

            return (
              <div className="rounded-2xl bg-[#F2F5F3] p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-heading text-lg font-medium text-[#1C1B1F]">
                      {single.label}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DCE8F7] text-[#132B47] tabular-nums">
                      {single.count} {single.count === 1 ? 'interview' : 'interviews'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DDF3ED] text-[#133830] tabular-nums">
                      {single.validPct}% of stated
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTraceItem(single)}
                    className="text-xs font-medium text-[#528BCA] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Inspect Quotes →
                  </button>
                </div>

                {sourceRecordings.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#444846]">
                    <span className="font-medium text-[#1C1B1F]">Source:</span>
                    {sourceRecordings.map((recName) => (
                      <span
                        key={recName}
                        className="px-2.5 py-0.5 rounded-full bg-[#FDFCF8] text-[#444846]"
                      >
                        {recName}
                      </span>
                    ))}
                  </div>
                )}

                {previewQuotes.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {previewQuotes.map((c, idx) => (
                      <div
                        key={`${c.recordId}-${idx}`}
                        className="rounded-xl bg-[#FDFCF8] px-3.5 py-2.5 space-y-1"
                      >
                        <p className="transcript-surface text-sm text-[#1C1B1F]">
                          &ldquo;{c.quote}&rdquo;
                        </p>
                        <div className="text-xs text-[#444846] font-medium">
                          — {stripRecordingExtension(c.fileName)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()
        ) : group.dimension === 'O' ? (
          (() => {
            const totalMentions = chartItems.reduce((sum, i) => sum + i.count, 0);
            const showMentionsSub = totalMentions > 0 && totalMentions !== group.statedCount;
            const cx = 100;
            const cy = 100;
            const outerR = 88; // 88%
            const innerR = 60; // 60%
            let currentAngle = 0;
            const arcs = chartItems.map((item) => {
              const sweep = totalMentions > 0 ? (item.count / totalMentions) * 360 : 0;
              const startAngle = currentAngle;
              const endAngle = currentAngle + sweep;
              currentAngle = endAngle;
              return { item, startAngle, endAngle };
            });

            return (
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-6 py-2">
                {/* Left: Clean 2D Donut Chart */}
                <div className="flex items-center justify-center">
                  <svg
                    viewBox="0 0 200 200"
                    className="w-[196px] h-[196px] overflow-visible"
                    role="img"
                    aria-label={`${group.title}: ${group.statedCount} stated`}
                  >
                    {chartItems.length === 1 ? (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={(outerR + innerR) / 2}
                        fill="none"
                        stroke={chartItems[0].barColor}
                        strokeWidth={outerR - innerR}
                        className="cursor-pointer transition-opacity"
                        onMouseEnter={() => setHoveredItemKey(chartItems[0].key)}
                        onMouseLeave={() => setHoveredItemKey(null)}
                        onClick={() => onTraceItem(chartItems[0])}
                      />
                    ) : (
                      arcs.map(({ item, startAngle, endAngle }) => {
                        const isDimmed = hoveredItemKey !== null && hoveredItemKey !== item.key;
                        return (
                          <path
                            key={item.key}
                            d={buildDetailDonutArcPath(cx, cy, outerR, innerR, startAngle, endAngle)}
                            fill={item.barColor}
                            stroke="#FDFCF8"
                            strokeWidth={2}
                            strokeLinejoin="round"
                            style={{
                              opacity: isDimmed ? 0.38 : 1,
                              transition: 'opacity 180ms ease',
                            }}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredItemKey(item.key)}
                            onMouseLeave={() => setHoveredItemKey(null)}
                            onClick={() => onTraceItem(item)}
                          >
                            <title>
                              {item.label}: {item.count} ({item.validPct}% of stated) — Click to trace quotes
                            </title>
                          </path>
                        );
                      })
                    )}
                    <text
                      x={cx}
                      y={showMentionsSub ? cy - 8 : cy - 2}
                      textAnchor="middle"
                      className="font-heading font-bold fill-[#1C1B1F]"
                      style={{ fontSize: '28px' }}
                    >
                      {group.statedCount}
                    </text>
                    <text
                      x={cx}
                      y={showMentionsSub ? cy + 10 : cy + 16}
                      textAnchor="middle"
                      className="font-mono font-bold fill-[#4F5E57]"
                      style={{ fontSize: '10.5px', letterSpacing: '0.08em' }}
                    >
                      STATED
                    </text>
                    {showMentionsSub && (
                      <text
                        x={cx}
                        y={cy + 25}
                        textAnchor="middle"
                        className="font-mono fill-[#727975]"
                        style={{ fontSize: '10px' }}
                      >
                        {totalMentions} mentions
                      </text>
                    )}
                  </svg>
                </div>

                {/* Right: Direct Breakdown Legend (Synced with Table) */}
                <div className="space-y-1.5 min-w-0">
                  {chartItems.map((item) => {
                    const isHovered = hoveredItemKey === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onMouseEnter={() => setHoveredItemKey(item.key)}
                        onMouseLeave={() => setHoveredItemKey(null)}
                        onClick={() => onTraceItem(item)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isHovered
                            ? 'bg-[#DCE8F7]/60 border-[#528BCA] shadow-2xs'
                            : 'bg-[#F2F5F3]/65 border-transparent hover:bg-[#F2F5F3] hover:border-[#D5DDD8]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: item.barColor }}
                          />
                          <span className="text-sm font-semibold text-[#1C1B1F] leading-snug break-words">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-semibold text-[#1C1B1F] shrink-0 whitespace-nowrap tabular-nums">
                          {item.count}{' '}
                          <span className="text-[#4F5E57] font-normal">({item.validPct}%)</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="space-y-2">
            <div className="w-full" style={{ height: barChartHeight }}>
            <ResponsiveContainer width="100%" height={barChartHeight}>
              <BarChart
                data={chartItems}
                layout="vertical"
                margin={{ top: 4, right: 92, left: 8, bottom: 4 }}
                barSize={22}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#D5DDD8" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={235}
                  tick={<WrappedYAxisTick />}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: '#F2F5F3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const datum = payload[0].payload as (typeof chartItems)[number];
                    return (
                      <div className="bg-[#FDFCF8] border border-[#D5DDD8] rounded-2xl px-3.5 py-2.5 shadow-sm text-[13px] space-y-1">
                        <div className="font-semibold text-[#1C1B1F]">{datum.label}</div>
                        <div className="font-mono tabular-nums text-[#444846]">
                          {datum.formulaText}
                        </div>
                        <div className="font-mono tabular-nums text-[#727975] text-xs">
                          {datum.totalContextText}
                        </div>
                        <div className="text-xs font-medium text-[#528BCA]">
                          Click bar to trace verbatim quotes
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 8, 8, 0]}
                  className="cursor-pointer"
                  onClick={(_bar, idx) => {
                    const target = chartItems[idx];
                    if (target) onTraceItem(target);
                  }}
                >
                  {chartItems.map((item) => (
                    <Cell key={item.key} fill={item.barColor} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    content={(props) => {
                      const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props as {
                        x?: number;
                        y?: number;
                        width?: number;
                        height?: number;
                        index?: number;
                      };
                      const datum = chartItems[index];
                      if (!datum) return null;
                      return (
                        <text
                          x={Number(x) + Number(width) + 8}
                          y={Number(y) + Number(height) / 2 + 4}
                          fill="#292524"
                          fontSize={13}
                          fontFamily="monospace"
                          fontWeight={600}
                        >
                          {datum.count} ({datum.validPct}%)
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
            {filteredStatedItems.length > CHART_CAP && !searchQuery.trim() && recordingFilter === 'all' && (
              <div className="flex items-center justify-between pt-1 text-xs text-[#444846]">
                <span>
                  Showing {visibleChartSource.length} of {filteredStatedItems.length} routines in chart
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllChartBars((prev) => !prev)}
                  className="font-medium text-[#528BCA] hover:underline cursor-pointer"
                >
                  {showAllChartBars ? `Show top ${CHART_CAP}` : `Show all (${filteredStatedItems.length})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline Safe Delete Banner (from Breakdown Table Row) */}
      {deletingItem && (
        <div className="mx-5 mt-4 rounded-2xl border border-[#D97A75]/45 bg-[#FDF4F3] p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#D97A75] shrink-0 mt-1" />
            <div>
              <div className="font-heading text-base font-bold text-[#7A3A36]">
                Remove &ldquo;{deletingItem.label}&rdquo;
              </div>
              <p className="text-base leading-[1.65] text-[#7A3A36]/90 mt-0.5">
                Affects <strong className="font-mono">{deletingItem.count}</strong> Human-Verified record{deletingItem.count === 1 ? '' : 's'} (and matching drafts). Choose action:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-6">
            <label className="flex items-start gap-2 rounded-xl border border-[#D97A75]/35 bg-white p-3 text-sm cursor-pointer">
              <input
                type="radio"
                name={`row-del-${group.id}`}
                checked={deleteMode === 'null'}
                onChange={() => setDeleteMode('null')}
                className="mt-1"
              />
              <div>
                <div className="font-semibold text-[#292524]">Set fields back to null</div>
                <div className="text-[13px] text-[#78716C]">Preserves quotes; clears label</div>
              </div>
            </label>

            <label className="flex items-start gap-2 rounded-xl border border-[#D97A75]/35 bg-white p-3 text-sm cursor-pointer">
              <input
                type="radio"
                name={`row-del-${group.id}`}
                checked={deleteMode === 'reassign'}
                onChange={() => setDeleteMode('reassign')}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#292524]">Reassign to category</div>
                {deleteMode === 'reassign' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      list={`row-reassign-${group.id}`}
                      value={reassignTo}
                      onChange={(e) => setReassignTo(e.target.value)}
                      placeholder="Target category..."
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-[#EAE6DF] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/40"
                    />
                    <datalist id={`row-reassign-${group.id}`}>
                      {reassignOptions.map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </div>
                )}
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingItem(null)}
              className="px-4 py-1.5 rounded-full border border-[#EAE6DF] bg-white text-[13px] font-semibold text-[#57534E] hover:bg-[#F7F5F0] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteMode === 'reassign' && !reassignTo.trim()}
              onClick={() => {
                onDeleteCode({
                  dimension: deletingItem.dimension,
                  fieldKey: deletingItem.fieldKey,
                  targetLabel: deletingItem.label,
                  mode: deleteMode,
                  reassignToLabel: deleteMode === 'reassign' ? reassignTo.trim() : undefined,
                  customCategoryId: deletingItem.customCategoryId,
                });
                setDeletingItem(null);
                setReassignTo('');
              }}
              className="px-4 py-1.5 rounded-full bg-[#D97A75] hover:bg-[#C66661] text-white text-[13px] font-semibold cursor-pointer disabled:opacity-40"
            >
              Apply Removal
            </button>
          </div>
        </div>
      )}

      {/* Breakdown Table Directly Beneath Chart */}
      {statedItems.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead className="bg-[#F7F5F0] border-b border-[#EAE6DF] text-[13px] font-semibold text-[#57534E]">
              <tr>
                <th className="py-3 px-4">Category Name</th>
                <th className="py-3 px-3 text-right">Count</th>
                <th className="py-3 px-3 text-right">% of Stated</th>
                <th className="py-3 px-4">Source Recordings</th>
                <th className="py-3 px-4 text-right">Edit / Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5DDD8]/70">
              {filteredStatedItems.map((item) => {
                const isEditing = editingKey === item.key;
                const recordingNames = item.contributors.map((c) =>
                  stripRecordingExtension(c.fileName)
                );
                const visibleNames = recordingNames.slice(0, 2).join(', ');
                const extraCount = Math.max(0, recordingNames.length - 2);

                return (
                  <tr
                    key={item.key}
                    onMouseEnter={() => setHoveredItemKey(item.key)}
                    onMouseLeave={() => setHoveredItemKey(null)}
                    className={`transition-colors ${
                      hoveredItemKey === item.key ? 'bg-[#DCE8F7]/50' : 'hover:bg-[#FDFCF8]'
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-[#292524]">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            className="px-3 py-1 text-base rounded-lg border border-[#528BCA] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/35 w-52"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (editDraft.trim()) {
                                onRenameCode({
                                  dimension: item.dimension,
                                  fieldKey: item.fieldKey,
                                  oldLabel: item.label,
                                  newLabel: editDraft.trim(),
                                  customCategoryId: item.customCategoryId,
                                });
                              }
                              setEditingKey(null);
                            }}
                            className="p-1.5 rounded-full bg-[#96D6C7] text-[#1E4D42] hover:bg-[#82C9B8] cursor-pointer"
                            title="Save rename"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingKey(null)}
                            className="p-1.5 rounded-full border border-[#EAE6DF] bg-white text-[#78716C] cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span>{item.label}</span>
                          {item.isCustom && (
                            <span className="text-[13px] font-medium text-[#6B5306] bg-[#FEFBEB] border border-[#F7D147]/60 px-2.5 py-0.5 rounded-full">
                              Custom
                            </span>
                          )}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onTraceItem(item)}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FEFBEB] hover:bg-[#F7D147]/35 border border-[#F7D147]/60 font-mono font-bold text-[#6B5306] tabular-nums cursor-pointer"
                        title={`Trace ${item.count} interview${item.count === 1 ? '' : 's'}`}
                      >
                        {item.count}
                      </button>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#57534E] font-semibold">
                      {item.validPct}%
                    </td>

                    <td className="py-2.5 px-4 text-[#444846]">
                      {(() => {
                        const isRecExpanded = Boolean(expandedRecRowKeys[item.key]);
                        const uniqueContributors = Array.from(
                          new Map(
                            item.contributors.map((c) => [c.recordId, c])
                          ).values()
                        );
                        return (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onTraceItem(item)}
                                className="text-left hover:text-[#528BCA] hover:underline cursor-pointer"
                                title="Open Traceability Drawer"
                              >
                                {isRecExpanded
                                  ? recordingNames.join(', ')
                                  : visibleNames}
                              </button>
                              {extraCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedRecRowKeys((prev) => ({
                                      ...prev,
                                      [item.key]: !prev[item.key],
                                    }))
                                  }
                                  className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#DCE8F7] hover:bg-[#528BCA]/25 text-[#132B47] cursor-pointer whitespace-nowrap transition-colors"
                                  aria-expanded={isRecExpanded}
                                >
                                  {isRecExpanded ? 'Show less' : `+${extraCount} more`}
                                </button>
                              )}
                            </div>

                            {isRecExpanded && uniqueContributors.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                {uniqueContributors.map((c) => (
                                  <div
                                    key={c.recordId}
                                    className="rounded-xl bg-[#F2F5F3] px-3 py-2 text-xs space-y-0.5"
                                  >
                                    <div className="font-medium text-[#1C1B1F]">
                                      {stripRecordingExtension(c.fileName)}
                                    </div>
                                    {c.quote && (
                                      <p className="transcript-surface text-xs text-[#444846] italic">
                                        &ldquo;{c.quote}&rdquo;
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingKey(item.key);
                            setEditDraft(item.label);
                          }}
                          className="p-1.5 rounded-full text-[#78716C] hover:text-[#528BCA] hover:bg-[#F2F7FC] cursor-pointer"
                          title="Inline rename across dataset"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingItem(item);
                            setDeleteMode('null');
                            setReassignTo(reassignOptions[0] || '');
                          }}
                          className="p-1.5 rounded-full text-[#78716C] hover:text-[#D97A75] hover:bg-[#FDF4F3] cursor-pointer"
                          title="Delete or reassign category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const getHeatmapCellStyle = (
  count: number,
  maxCooccurrence: number,
  isDiagonal: boolean
): { bgClass: string; textClass: string } => {
  if (isDiagonal) {
    return {
      bgClass: 'bg-[#FDF3C7] border-[#F7D147]',
      textClass: 'text-[#3B2E00] font-bold',
    };
  }
  if (count === 0) {
    return {
      bgClass: 'bg-[#F2F5F3]/80 border-[#D5DDD8]',
      textClass: 'text-[#727975]/60',
    };
  }
  const ratio = maxCooccurrence > 0 ? count / maxCooccurrence : 1;
  if (ratio >= 0.75) {
    return {
      bgClass: 'bg-[#528BCA] border-[#3F76B4] hover:bg-[#4178B6]',
      textClass: 'text-white font-bold',
    };
  }
  if (ratio >= 0.4) {
    return {
      bgClass: 'bg-[#4FA896] border-[#3D8B7B] hover:bg-[#3F9382]',
      textClass: 'text-white font-bold',
    };
  }
  return {
    bgClass: 'bg-[#DDF3ED] border-[#96D6C7] hover:bg-[#C6ECE1]',
    textClass: 'text-[#133830] font-semibold',
  };
};

export const DimensionBreakdownSection: React.FC<DimensionBreakdownSectionProps> = ({
  dataset,
  activityCooccurrence,
  onTraceItem,
  onRenameCode,
  onDeleteCode,
}) => {
  const showHeatmap =
    dataset.dimension === 'A' &&
    activityCooccurrence &&
    activityCooccurrence.habits.length >= 2;

  return (
    <div className="space-y-5">
      {dataset.groups.map((group) => (
        <TraceableGroupCard
          key={group.id}
          group={group}
          onTraceItem={onTraceItem}
          onRenameCode={onRenameCode}
          onDeleteCode={onDeleteCode}
        />
      ))}

      {showHeatmap && activityCooccurrence && (
        <div className="rounded-2xl border border-[#EAE6DF] bg-white shadow-studio overflow-hidden">
          <div className="p-5 border-b border-[#EAE6DF] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="font-heading text-base sm:text-lg font-bold text-[#292524] tracking-[-0.02em]">
                  Routine Co-Occurrence Matrix (Heatmap)
                </h4>
                <span className="px-3 py-0.5 rounded-full border border-[#96D6C7] bg-[#F2FBF8] text-[13px] font-mono font-bold text-[#1E4D42]">
                  Top {activityCooccurrence.habits.length} Habits
                </span>
              </div>
              <p className="text-base leading-[1.65] text-[#57534E] mt-1">
                Shows how frequently top specific routines appear together inside the same interview across {activityCooccurrence.totalRecords} verified interviews. Click any shaded cell to inspect shared transcripts and quotes.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-[#444846] shrink-0 flex-wrap">
              <span className="inline-flex items-center gap-1 mr-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#FDF3C7] border border-[#F7D147]" />
                <span>Self</span>
              </span>
              <span>Low</span>
              <span className="w-3.5 h-3.5 rounded bg-[#F2F5F3] border border-[#D5DDD8]" />
              <span className="w-3.5 h-3.5 rounded bg-[#DDF3ED] border border-[#96D6C7]" />
              <span className="w-3.5 h-3.5 rounded bg-[#4FA896] border border-[#3D8B7B]" />
              <span className="w-3.5 h-3.5 rounded bg-[#528BCA] border border-[#3F76B4]" />
              <span>High</span>
            </div>
          </div>

          <div className="p-5 overflow-x-auto">
            <table className="w-full border-collapse text-[13px] min-w-[640px]">
              <thead>
                <tr>
                  <th className="p-2 text-left text-[13px] font-semibold text-[#78716C] w-56">
                    Routine / Habit
                  </th>
                  {activityCooccurrence.habits.map((colHabit, colIdx) => (
                    <th
                      key={colHabit.key}
                      className="p-1.5 text-center align-bottom font-medium text-[#57534E] max-w-[110px]"
                      title={`${colHabit.label} (${colHabit.fieldLabel})`}
                    >
                      <div className="text-[13px] font-mono text-[#2B7A67] font-bold mb-0.5">
                        H{colIdx + 1}
                      </div>
                      <div className="text-[13px] leading-tight line-clamp-2 break-words font-normal text-[#57534E]">
                        {colHabit.shortLabel}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activityCooccurrence.habits.map((rowHabit, rowIdx) => (
                  <tr key={rowHabit.key} className="border-t border-[#EAE6DF]/70">
                    <th
                      scope="row"
                      className="py-2 pr-3 text-left font-medium text-[#292524] align-middle"
                      title={`${rowHabit.label} (${rowHabit.fieldLabel})`}
                    >
                      <button
                        type="button"
                        onClick={() => onTraceItem(rowHabit.item)}
                        className="text-left hover:text-[#1E4D42] cursor-pointer flex items-start gap-1.5"
                      >
                        <span className="text-[13px] font-mono font-bold text-[#2B7A67] mt-0.5 shrink-0">
                          H{rowIdx + 1}
                        </span>
                        <span className="text-[13px] sm:text-sm leading-snug line-clamp-2 break-words">
                          {rowHabit.label}
                        </span>
                      </button>
                    </th>

                    {activityCooccurrence.cells[rowIdx].map((cell) => {
                      const isDiagonal = cell.rowIndex === cell.colIndex;
                      const style = getHeatmapCellStyle(
                        cell.count,
                        activityCooccurrence.maxCooccurrence,
                        isDiagonal
                      );
                      const clickable = cell.count > 0;
                      return (
                        <td key={`${cell.rowIndex}-${cell.colIndex}`} className="p-1 text-center">
                          <button
                            type="button"
                            disabled={!clickable}
                            onClick={() => clickable && onTraceItem(cell.traceItem)}
                            title={
                              isDiagonal
                                ? `${rowHabit.label}: ${cell.count} interview${cell.count === 1 ? '' : 's'}`
                                : `${rowHabit.label} + ${activityCooccurrence.habits[cell.colIndex].label}: ${cell.count} co-occurrence${cell.count === 1 ? '' : 's'} (${cell.pctOfTotal}%)`
                            }
                            className={`w-full h-12 rounded-lg border font-mono text-[13px] tabular-nums transition-colors flex flex-col items-center justify-center ${style.bgClass} ${style.textClass} ${
                              clickable ? 'cursor-pointer' : 'cursor-default'
                            }`}
                          >
                            <span>{cell.count}</span>
                            {!isDiagonal && cell.count > 0 && (
                              <span className="text-[13px] leading-none opacity-85 mt-0.5">
                                {cell.pctOfTotal}%
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

