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
  Image as ImageIcon,
  Info,
  MoreHorizontal,
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

const truncateLabel = (str: string, max = 26): string =>
  str.length > max ? `${str.slice(0, max - 1)}…` : str;

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

  const statedItems = group.items.filter((item) => item.key !== '__null__');

  const chartItems = statedItems.map((item) => ({
    ...item,
    shortLabel: truncateLabel(item.label, 24),
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

  const barChartHeight = Math.max(180, chartItems.length * 34 + 24);

  return (
    <div
      ref={cardRef}
      className="rounded-2xl border border-stone-200 bg-white overflow-hidden"
    >
      {/* Card Header + Reconciled Denominator Math */}
      <div className="p-5 border-b border-stone-100 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-stone-900">{group.title}</h4>
              {group.infoTooltipBody && (
                <div className="relative inline-flex">
                  <button
                    type="button"
                    onClick={() => setInfoOpen((prev) => !prev)}
                    aria-label={group.infoTooltipTitle || 'Architecture distinction'}
                    className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
                    title="Click for RL vs IL separation details"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {infoOpen && (
                    <div
                      role="tooltip"
                      className="absolute left-0 top-full mt-1.5 z-30 w-72 rounded-xl border border-stone-200 bg-white p-3 shadow-lg text-left"
                    >
                      {group.infoTooltipTitle && (
                        <div className="text-[11px] font-bold text-stone-900 mb-1">
                          {group.infoTooltipTitle}
                        </div>
                      )}
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        {group.infoTooltipBody}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">{group.subtitle}</p>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-500 hover:text-stone-800 cursor-pointer"
              aria-label={`Export options for ${group.title}`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1.5 z-30 w-44 rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExportCsv}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Table CSV</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExportPng}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                  <span>Export Chart PNG</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Three Reconciled Numbers: Stated (n) + Unstated (null) = Total (N) */}
        <div className="rounded-xl bg-stone-50 border border-stone-200/80 px-3.5 py-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
              <span className="font-bold text-stone-900">
                Stated: {group.statedCount}
              </span>
              <span className="text-stone-300" aria-hidden="true">|</span>
              <span className="text-stone-600">
                Unstated (null): {group.unstatedCount}
              </span>
              <span className="text-stone-300" aria-hidden="true">|</span>
              <span className="text-stone-700 font-semibold">
                Total Active: {group.totalRecords}
              </span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-amber-800 font-semibold">
              Valid % computed strictly over {group.statedCount} stated record{group.statedCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-600 rounded-full transition-all duration-300"
              style={{ width: `${group.validCoveragePct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Purpose-Built Chart */}
      <div className="p-5 border-b border-stone-100">
        {group.items.length === 0 ? (
          <div className="py-8 text-center rounded-xl border border-dashed border-stone-200 bg-stone-50/50">
            <p className="text-xs font-semibold text-stone-700">
              No stated records for {group.title} yet
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              {group.unstatedCount} of {group.totalRecords} Human-Verified records currently have null for this field.
            </p>
          </div>
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
                        <div className="bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
                          {group.items.map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between gap-4 font-mono tabular-nums"
                            >
                              <span className="font-semibold text-stone-800">{item.label}</span>
                              <span className="text-stone-600">
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
                  className="text-left rounded-xl border border-stone-200 bg-stone-50/70 hover:bg-amber-50/60 hover:border-amber-300 p-3 transition-colors cursor-pointer"
                  title="Click to open Traceability Drawer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-800 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="font-mono text-sm font-bold text-stone-900 tabular-nums">
                      {item.count}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono tabular-nums text-stone-500">
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
        ) : (
          <div className="w-full" style={{ height: barChartHeight }}>
            <ResponsiveContainer width="100%" height={barChartHeight}>
              <BarChart
                data={chartItems}
                layout="vertical"
                margin={{ top: 4, right: 86, left: 6, bottom: 4 }}
                barSize={20}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f5f5f4" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="shortLabel"
                  width={170}
                  tick={{ fontSize: 11, fill: '#292524', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#fafaf9' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const datum = payload[0].payload as (typeof chartItems)[number];
                    return (
                      <div className="bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
                        <div className="font-bold text-stone-900">{datum.label}</div>
                        <div className="font-mono tabular-nums text-stone-700">
                          {datum.formulaText}
                        </div>
                        <div className="font-mono tabular-nums text-stone-500 text-[11px]">
                          {datum.totalContextText}
                        </div>
                        <div className="text-[10px] font-semibold text-amber-700">
                          Click bar to trace verbatim quotes
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 6, 6, 0]}
                  className="cursor-pointer"
                  onClick={(_bar, idx) => {
                    const target = chartItems[idx];
                    if (target) onTraceItem(target);
                  }}
                >
                  {chartItems.map((item) => (
                    <Cell key={item.key} fill={item.color} />
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
                          fontSize={11}
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
        )}
      </div>

      {/* Inline Safe Delete Banner (from Breakdown Table Row) */}
      {deletingItem && (
        <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-rose-950">
                Remove &ldquo;{deletingItem.label}&rdquo;
              </div>
              <p className="text-xs text-rose-800 mt-0.5">
                Affects <strong className="font-mono">{deletingItem.count}</strong> Human-Verified record{deletingItem.count === 1 ? '' : 's'} (and matching drafts). Choose action:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-6">
            <label className="flex items-start gap-2 rounded-lg border border-rose-200 bg-white p-2.5 text-xs cursor-pointer">
              <input
                type="radio"
                name={`row-del-${group.id}`}
                checked={deleteMode === 'null'}
                onChange={() => setDeleteMode('null')}
                className="mt-0.5"
              />
              <div>
                <div className="font-semibold text-stone-900">Set fields back to null</div>
                <div className="text-[11px] text-stone-500">Preserves quotes; clears label</div>
              </div>
            </label>

            <label className="flex items-start gap-2 rounded-lg border border-rose-200 bg-white p-2.5 text-xs cursor-pointer">
              <input
                type="radio"
                name={`row-del-${group.id}`}
                checked={deleteMode === 'reassign'}
                onChange={() => setDeleteMode('reassign')}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-stone-900">Reassign to category</div>
                {deleteMode === 'reassign' && (
                  <div className="mt-1.5">
                    <input
                      type="text"
                      list={`row-reassign-${group.id}`}
                      value={reassignTo}
                      onChange={(e) => setReassignTo(e.target.value)}
                      placeholder="Target category..."
                      className="w-full px-2 py-1 text-xs rounded border border-stone-300"
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
              className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 cursor-pointer"
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
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
            >
              Apply Removal
            </button>
          </div>
        </div>
      )}

      {/* Breakdown Table Directly Beneath Chart */}
      {statedItems.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50/80 border-b border-stone-200 text-[11px] font-semibold text-stone-500">
              <tr>
                <th className="py-2.5 px-4">Category Name</th>
                <th className="py-2.5 px-3 text-right">Count</th>
                <th className="py-2.5 px-3 text-right">% of Stated</th>
                <th className="py-2.5 px-4">Source Recordings</th>
                <th className="py-2.5 px-4 text-right">Edit / Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {statedItems.map((item) => {
                const isEditing = editingKey === item.key;
                const recordingNames = item.contributors.map((c) =>
                  stripRecordingExtension(c.fileName)
                );
                const visibleNames = recordingNames.slice(0, 2).join(', ');
                const extraCount = Math.max(0, recordingNames.length - 2);

                return (
                  <tr key={item.key} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-stone-900">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            className="px-2 py-1 text-xs rounded border border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500 w-48"
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
                            className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                            title="Save rename"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingKey(null)}
                            className="p-1 rounded border border-stone-200 bg-white text-stone-500 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span>{item.label}</span>
                          {item.isCustom && (
                            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
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
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-200 font-mono font-bold text-amber-900 tabular-nums cursor-pointer"
                        title={`Trace ${item.count} interview${item.count === 1 ? '' : 's'}`}
                      >
                        {item.count}
                      </button>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-700 font-semibold">
                      {item.validPct}%
                    </td>

                    <td className="py-2.5 px-4 text-stone-600">
                      <button
                        type="button"
                        onClick={() => onTraceItem(item)}
                        className="text-left hover:text-amber-800 hover:underline cursor-pointer"
                        title="Open Traceability Drawer"
                      >
                        {visibleNames}
                        {extraCount > 0 ? ` +${extraCount} more` : ''}
                      </button>
                    </td>

                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingKey(item.key);
                            setEditDraft(item.label);
                          }}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
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
                          className="p-1.5 rounded-lg text-stone-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
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
      bgClass: 'bg-emerald-50 border-emerald-200',
      textClass: 'text-emerald-900 font-bold',
    };
  }
  if (count === 0) {
    return {
      bgClass: 'bg-stone-50/70 border-stone-100',
      textClass: 'text-stone-300',
    };
  }
  const ratio = maxCooccurrence > 0 ? count / maxCooccurrence : 1;
  if (ratio >= 0.75) {
    return {
      bgClass: 'bg-emerald-600 border-emerald-700 hover:bg-emerald-700',
      textClass: 'text-white font-bold',
    };
  }
  if (ratio >= 0.4) {
    return {
      bgClass: 'bg-emerald-200 border-emerald-300 hover:bg-emerald-300',
      textClass: 'text-emerald-950 font-bold',
    };
  }
  return {
    bgClass: 'bg-emerald-100/90 border-emerald-200 hover:bg-emerald-200',
    textClass: 'text-emerald-900 font-semibold',
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
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-stone-900">
                  Routine Co-Occurrence Matrix (Heatmap)
                </h4>
                <span className="px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-[10px] font-mono font-bold text-emerald-800">
                  Top {activityCooccurrence.habits.length} Habits
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Shows how frequently top specific routines appear together inside the same interview across {activityCooccurrence.totalRecords} verified interviews. Click any shaded cell to inspect shared transcripts and quotes.
              </p>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono text-stone-500 shrink-0">
              <span>Low</span>
              <span className="w-3.5 h-3.5 rounded bg-stone-50 border border-stone-200" />
              <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-200" />
              <span className="w-3.5 h-3.5 rounded bg-emerald-200 border border-emerald-300" />
              <span className="w-3.5 h-3.5 rounded bg-emerald-600 border border-emerald-700" />
              <span>High</span>
            </div>
          </div>

          <div className="p-5 overflow-x-auto">
            <table className="w-full border-collapse text-xs min-w-[620px]">
              <thead>
                <tr>
                  <th className="p-2 text-left text-[11px] font-semibold text-stone-500 w-52">
                    Routine / Habit
                  </th>
                  {activityCooccurrence.habits.map((colHabit, colIdx) => (
                    <th
                      key={colHabit.key}
                      className="p-1.5 text-center align-bottom font-medium text-stone-700 max-w-[110px]"
                      title={`${colHabit.label} (${colHabit.fieldLabel})`}
                    >
                      <div className="text-[10px] font-mono text-emerald-700 font-bold mb-0.5">
                        H{colIdx + 1}
                      </div>
                      <div className="text-[10px] leading-tight line-clamp-2 break-words font-normal text-stone-600">
                        {colHabit.shortLabel}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activityCooccurrence.habits.map((rowHabit, rowIdx) => (
                  <tr key={rowHabit.key} className="border-t border-stone-100">
                    <th
                      scope="row"
                      className="py-2 pr-3 text-left font-medium text-stone-800 align-middle"
                      title={`${rowHabit.label} (${rowHabit.fieldLabel})`}
                    >
                      <button
                        type="button"
                        onClick={() => onTraceItem(rowHabit.item)}
                        className="text-left hover:text-emerald-800 cursor-pointer flex items-start gap-1.5"
                      >
                        <span className="text-[10px] font-mono font-bold text-emerald-700 mt-0.5 shrink-0">
                          H{rowIdx + 1}
                        </span>
                        <span className="text-xs leading-snug line-clamp-2 break-words">
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
                            className={`w-full h-10 rounded-lg border font-mono text-xs tabular-nums transition-colors flex flex-col items-center justify-center ${style.bgClass} ${style.textClass} ${
                              clickable ? 'cursor-pointer' : 'cursor-default'
                            }`}
                          >
                            <span>{cell.count}</span>
                            {!isDiagonal && cell.count > 0 && (
                              <span className="text-[9px] leading-none opacity-80">
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

