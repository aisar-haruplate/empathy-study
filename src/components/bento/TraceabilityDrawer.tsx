import React, { useEffect } from 'react';
import { ArrowUpRight, Calculator, FileAudio, Filter, Quote, X } from 'lucide-react';
import type { TraceableBreakdownItem } from '../../lib/decodeAnalytics';

interface TraceabilityDrawerProps {
  item: TraceableBreakdownItem | null;
  onClose: () => void;
  onOpenCard?: (recordId: string) => void;
  isFilterActive?: boolean;
  onToggleOverviewFilter?: (item: TraceableBreakdownItem) => void;
}

const DIM_BADGE: Record<string, string> = {
  O: 'bg-orange-50 text-orange-800 border-orange-200',
  A: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  K: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  D: 'bg-sky-50 text-sky-800 border-sky-200',
  T: 'bg-rose-50 text-rose-800 border-rose-200',
  M: 'bg-slate-100 text-slate-800 border-slate-300',
};

const stripExtension = (name: string): string => name.replace(/\.[^/.]+$/, '');

export const TraceabilityDrawer: React.FC<TraceabilityDrawerProps> = ({
  item,
  onClose,
  onOpenCard,
  isFilterActive = false,
  onToggleOverviewFilter,
}) => {
  useEffect(() => {
    if (!item) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [item, onClose]);

  if (!item) return null;

  const uniqueMatchedCount = new Set(item.contributors.map((c) => c.recordId)).size;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Traceability Audit: ${item.label}`}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close traceability drawer"
        onClick={onClose}
        className="fixed inset-0 bg-stone-900/35 backdrop-blur-[1px] transition-opacity cursor-pointer"
      />

      {/* Right Slide-Over Panel */}
      <aside className="relative z-10 w-full max-w-xl bg-stone-50 border-l border-stone-200 shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-5 py-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold shrink-0 ${
                    DIM_BADGE[item.dimension] || DIM_BADGE.O
                  }`}
                >
                  {item.dimension}
                </span>
                <span className="text-[11px] font-medium text-stone-500">
                  {item.fieldLabel}
                </span>
              </div>
              <h3 className="text-base font-bold text-stone-900 mt-1 break-words">
                {item.label}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-500 hover:text-stone-900 transition-colors cursor-pointer shrink-0"
              aria-label="Close traceability drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Exact Reconciled Math Formula Readout */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950 font-mono tabular-nums">
              <Calculator className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>{item.formulaText}</span>
            </div>
            <div className="text-[11px] text-amber-900/80 font-mono tabular-nums">
              {item.totalContextText}
            </div>
          </div>

          {onToggleOverviewFilter && uniqueMatchedCount > 0 && (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  onToggleOverviewFilter(item);
                  onClose();
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isFilterActive
                    ? 'border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100'
                    : 'border-stone-200 bg-stone-50 text-stone-800 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-900'
                }`}
              >
                {isFilterActive ? (
                  <>
                    <X className="w-3.5 h-3.5 text-orange-700" />
                    <span>Remove Overview Filter</span>
                  </>
                ) : (
                  <>
                    <Filter className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>
                      Filter Overview by This Signal ({uniqueMatchedCount})
                    </span>
                  </>
                )}
              </button>
              <span className="text-[11px] text-stone-400">
                {isFilterActive ? 'Active on Overview' : 'Cross-filters all 6 cards'}
              </span>
            </div>
          )}
        </div>

        {/* Contributing Interviews + Exact Verbatim Evidence Quotes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 px-1">
            <span>
              Contributing Interview Record{item.contributors.length === 1 ? '' : 's'}
            </span>
            <span className="font-mono tabular-nums">{item.contributors.length} matched</span>
          </div>

          {item.contributors.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">
              No contributing interview records matched this entry.
            </div>
          ) : (
            item.contributors.map((contrib) => (
              <article
                key={`${contrib.recordId}-${contrib.fieldKey}`}
                className="bg-white rounded-xl border border-stone-200 p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                      <FileAudio className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">{stripExtension(contrib.fileName)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                      <span>Code: {contrib.code}</span>
                      {contrib.folderName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{contrib.folderName}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {onOpenCard && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenCard(contrib.recordId);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-[11px] font-bold text-amber-900 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      <span>Open Review</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {contrib.quote ? (
                  <blockquote className="rounded-lg border border-stone-200/80 bg-stone-50 px-3 py-2.5 text-xs text-stone-800 leading-relaxed flex items-start gap-2">
                    <Quote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>&ldquo;{contrib.quote}&rdquo;</span>
                  </blockquote>
                ) : (
                  <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/50 px-3 py-2 text-[11px] text-stone-500">
                    Coded from structured/filename metadata without an inline transcript quote span.
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </aside>
    </div>
  );
};
