import React, { useMemo, useState, useEffect } from 'react';
import { X, Tags, Check, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import type { InterviewRecord } from '../types';
import {
  applyTaxonomyNormalizations,
  proposeTaxonomyNormalizations,
} from '../lib/adkotmCopilot';

interface NormalizeTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: InterviewRecord[];
  onApplyNormalizedRecords: (updatedRecords: InterviewRecord[]) => void;
}

export const NormalizeTagsModal: React.FC<NormalizeTagsModalProps> = ({
  isOpen,
  onClose,
  records,
  onApplyNormalizedRecords,
}) => {
  const proposals = useMemo(() => proposeTaxonomyNormalizations(records), [records]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(proposals.map((p) => p.id));
    }
  }, [isOpen, proposals]);

  if (!isOpen) return null;

  const toggleProposal = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApply = () => {
    if (selectedIds.length === 0) return;
    const updated = applyTaxonomyNormalizations(records, proposals, selectedIds);
    onApplyNormalizedRecords(updated);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="normalize-tags-title"
    >
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 border-b border-stone-200 bg-gradient-to-r from-amber-50 via-orange-50/50 to-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
              <Tags className="w-4 h-4" />
            </div>
            <div>
              <h3 id="normalize-tags-title" className="text-sm font-bold text-stone-900">
                Normalize Cross-Interview Tags
              </h3>
              <p className="text-xs text-stone-500">
                Standardize fragmented Product [PP] labels across records while preserving granular Brands [PP1].
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close normalize tags modal"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {proposals.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-stone-800">
                All Product [PP] tags are already standardized
              </p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                No fragmented brand-in-category labels (such as Vitagen or Yakult inside PP) were detected across your decoded interviews.
              </p>
            </div>
          ) : (
            proposals.map((prop) => {
              const checked = selectedIds.includes(prop.id);
              const sampleBrands = Object.values(prop.preservedBrands).slice(0, 3);
              return (
                <label
                  key={prop.id}
                  className={`block p-4 rounded-xl border cursor-pointer transition-all ${
                    checked
                      ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProposal(prop.id)}
                      className="mt-1 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                            {prop.field} Standardization
                          </span>
                          <span className="text-xs font-semibold text-stone-500">
                            {prop.affectedRecordIds.length} interview{prop.affectedRecordIds.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <div className="flex flex-wrap gap-1">
                          {prop.originalValues.map((orig) => (
                            <span
                              key={orig}
                              className="px-2 py-0.5 rounded bg-stone-100 text-stone-600 line-through border border-stone-200"
                            >
                              {orig}
                            </span>
                          ))}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold border border-emerald-200">
                          PP: {prop.normalizedValue}
                        </span>
                      </div>

                      {sampleBrands.length > 0 && (
                        <p className="text-[11px] text-stone-600">
                          Preserved in <span className="font-semibold">PP1 (Brands)</span>: {sampleBrands.join(' • ')}
                        </p>
                      )}

                      <p className="text-[11px] text-stone-500">
                        Affected: {prop.affectedFileNames.slice(0, 4).join(', ')}
                        {prop.affectedFileNames.length > 4 ? ` +${prop.affectedFileNames.length - 4} more` : ''}
                      </p>
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <span className="text-xs text-stone-500">
            {proposals.length > 0
              ? `${selectedIds.length} of ${proposals.length} merge${proposals.length > 1 ? 's' : ''} selected`
              : 'Up to date'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200 cursor-pointer"
            >
              Cancel
            </button>
            {proposals.length > 0 && (
              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={handleApply}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Apply Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
