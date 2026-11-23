import React, { useMemo, useState, useEffect } from 'react';
import { X, Tags, Check, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import type { InterviewRecord } from '../../types';
import {
  applyTaxonomyNormalizations,
  proposeTaxonomyNormalizations,
} from '../../lib/adkotmCopilot';

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
      className="fixed inset-0 z-50 bg-[#292524]/45 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="normalize-tags-title"
    >
      <div className="bg-[#FFFFFF] rounded-3xl border border-[#EAE6DF] shadow-studio w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-[#EAE6DF] bg-[#F7F5F0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147]/60 flex items-center justify-center shrink-0">
              <Tags className="w-4 h-4" />
            </div>
            <div>
              <h3 id="normalize-tags-title" className="font-heading text-lg font-bold text-[#292524] tracking-[-0.02em]">
                Normalize Cross-Interview Tags
              </h3>
              <p className="text-base leading-[1.65] text-[#57534E]">
                Standardize fragmented Product [PP] labels across records while preserving granular Brands [PP1].
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close normalize tags modal"
            className="p-2 rounded-full text-[#78716C] hover:text-[#292524] hover:bg-[#EAE6DF]/60 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {proposals.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#F2FBF8] border border-[#96D6C7] text-[#1E4D42] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="font-heading text-lg font-bold text-[#292524]">
                All Product [PP] tags are already standardized
              </p>
              <p className="text-base leading-[1.65] text-[#57534E]">
                No fragmented brand-in-category labels waiting to merge
              </p>
              <p className="text-base leading-[1.65] text-[#78716C] max-w-sm mx-auto">
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
                  className={`block p-4 rounded-2xl border cursor-pointer transition-all ${
                    checked
                      ? 'bg-[#FEFBEB]/60 border-[#F7D147] ring-1 ring-[#F7D147]/40'
                      : 'bg-[#FFFFFF] border-[#EAE6DF] hover:border-[#D6D0C6]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProposal(prop.id)}
                      className="mt-1 rounded border-[#D6D0C6] accent-[#292524] focus:ring-[#528BCA]"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading text-[13px] font-bold px-2.5 py-0.5 rounded-full bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147]/60">
                            {prop.field} Standardization
                          </span>
                          <span className="text-[13px] font-semibold text-[#78716C] tabular-nums">
                            {prop.affectedRecordIds.length} interview{prop.affectedRecordIds.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-[13px]">
                        <div className="flex flex-wrap gap-1.5">
                          {prop.originalValues.map((orig) => (
                            <span
                              key={orig}
                              className="px-2.5 py-0.5 rounded-full bg-[#F7F5F0] text-[#57534E] line-through border border-[#EAE6DF]"
                            >
                              {orig}
                            </span>
                          ))}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F2FBF8] text-[#1E4D42] font-bold border border-[#96D6C7]">
                          PP: {prop.normalizedValue}
                        </span>
                      </div>

                      {sampleBrands.length > 0 && (
                        <p className="text-base leading-[1.65] text-[#57534E]">
                          Preserved in <span className="font-semibold text-[#292524]">PP1 (Brands)</span>: {sampleBrands.join(' · ')}
                        </p>
                      )}

                      <p className="text-[13px] leading-[1.65] text-[#78716C]">
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

        <div className="px-6 py-3.5 border-t border-[#EAE6DF] bg-[#F7F5F0] flex items-center justify-between gap-3">
          <span className="text-[13px] text-[#57534E] tabular-nums">
            {proposals.length > 0
              ? `${selectedIds.length} of ${proposals.length} merge${proposals.length > 1 ? 's' : ''} selected`
              : 'Up to date'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-[13px] font-semibold text-[#57534E] hover:bg-[#EAE6DF]/60 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              Cancel
            </button>
            {proposals.length > 0 && (
              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={handleApply}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-heading text-sm font-bold bg-[#528BCA] hover:bg-[#3F78B5] disabled:opacity-50 text-white shadow-2xs cursor-pointer whitespace-nowrap shrink-0 tabular-nums transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Apply Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
