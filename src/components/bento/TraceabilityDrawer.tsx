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
  O: 'bg-[#FEFBEB] text-[#6B5306] border-[#F7D147]',
  A: 'bg-[#F2FBF8] text-[#1E4D42] border-[#96D6C7]',
  K: 'bg-[#F2F7FC] text-[#234B78] border-[#528BCA]/45',
  D: 'bg-[#F3F5FD] text-[#33418A] border-[#7C8CE0]/50',
  T: 'bg-[#FBEAE9] text-[#7A3A36] border-[#D97A75]/45',
  M: 'bg-[#FDF4F3] text-[#7A3A36] border-[#F6BEBA]',
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
        className="fixed inset-0 bg-[#292524]/35 backdrop-blur-[1px] transition-opacity cursor-pointer"
      />

      {/* Right Slide-Over Panel */}
      <aside className="relative z-10 w-full max-w-xl bg-[#FDFCF8] border-l border-[#EAE6DF] rounded-l-3xl shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-[#EAE6DF] px-5 py-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2.5 py-0.5 rounded-full border text-[13px] font-mono font-bold shrink-0 ${
                    DIM_BADGE[item.dimension] || DIM_BADGE.O
                  }`}
                >
                  {item.dimension}
                </span>
                <span className="text-[13px] font-medium text-[#78716C]">
                  {item.fieldLabel}
                </span>
              </div>
              <h3 className="font-heading text-lg sm:text-xl font-bold text-[#292524] tracking-[-0.02em] mt-1 break-words">
                {item.label}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full border border-[#EAE6DF] bg-white hover:bg-[#F7F5F0] text-[#78716C] hover:text-[#292524] transition-colors cursor-pointer shrink-0"
              aria-label="Close traceability drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Exact Reconciled Math Formula Readout */}
          <div className="rounded-2xl border border-[#F7D147] bg-[#FEFBEB] px-3.5 py-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#6B5306] font-mono tabular-nums">
              <Calculator className="w-4 h-4 text-[#6B5306] shrink-0" />
              <span>{item.formulaText}</span>
            </div>
            <div className="text-[13px] text-[#6B5306]/85 font-mono tabular-nums">
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isFilterActive
                    ? 'border-[#528BCA] bg-[#EEF4FB] text-[#234B78] hover:bg-[#DCE8F7]'
                    : 'border-[#D5DDD8] bg-[#F2F5F3] text-[#1C1B1F] hover:bg-[#EEF4FB] hover:border-[#528BCA]/45 hover:text-[#234B78]'
                }`}
              >
                {isFilterActive ? (
                  <>
                    <X className="w-3.5 h-3.5 text-[#528BCA]" />
                    <span>Remove Overview Filter</span>
                  </>
                ) : (
                  <>
                    <Filter className="w-3.5 h-3.5 text-[#528BCA]" />
                    <span>
                      Filter Overview by This Signal ({uniqueMatchedCount})
                    </span>
                  </>
                )}
              </button>
              <span className="text-[13px] text-[#78716C]">
                {isFilterActive ? 'Active on Overview' : 'Cross-filters all 6 cards'}
              </span>
            </div>
          )}
        </div>

        {/* Contributing Interviews + Exact Verbatim Evidence Quotes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between text-[13px] font-semibold text-[#78716C] px-1">
            <span>
              Contributing Interview Record{item.contributors.length === 1 ? '' : 's'}
            </span>
            <span className="font-mono tabular-nums">{item.contributors.length} matched</span>
          </div>

          {item.contributors.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-[#EAE6DF] p-8 text-center">
              <p className="text-lg font-medium text-[#78716C]">
                No contributing interview records matched this entry.
              </p>
            </div>
          ) : (
            item.contributors.map((contrib) => (
              <article
                key={`${contrib.recordId}-${contrib.fieldKey}`}
                className="bg-white rounded-2xl border border-[#EAE6DF] p-4 space-y-2.5 shadow-studio"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-heading text-base font-bold text-[#292524]">
                      <FileAudio className="w-4 h-4 text-[#528BCA] shrink-0" />
                      <span className="truncate">{stripExtension(contrib.fileName)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[13px] text-[#78716C]">
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
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-[#528BCA]/40 bg-[#EEF4FB] hover:bg-[#DCE8F7] text-[13px] font-semibold text-[#234B78] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      <span>Open Review</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {contrib.quote ? (
                  <blockquote className="rounded-xl border border-[#E2E6E4] bg-[#F2F5F3] px-4 py-3 text-base text-[#1C1B1F] leading-[1.65] flex items-start gap-2.5">
                    <Quote className="w-4 h-4 text-[#528BCA] shrink-0 mt-1" />
                    <span>&ldquo;{contrib.quote}&rdquo;</span>
                  </blockquote>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#EAE6DF] bg-[#F7F5F0]/60 px-3.5 py-2.5 text-[13px] leading-[1.65] text-[#78716C]">
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
