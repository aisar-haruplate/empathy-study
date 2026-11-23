import React from 'react';
import {
  History,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  TrendingUp,
  Trash2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { AiVersionHistoryItem } from '../../types';

interface VersionControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: AiVersionHistoryItem[];
  onRevert: (versionId: string) => void;
}

export const VersionControlModal: React.FC<VersionControlModalProps> = ({
  isOpen,
  onClose,
  history,
  onRevert,
}) => {
  if (!isOpen) return null;

  const activeChanges = history.filter((h) => !h.reverted);
  const revertedChanges = history.filter((h) => h.reverted);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#292524]/45 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] rounded-3xl shadow-studio border border-[#EAE6DF] w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAE6DF] bg-[#F7F5F0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#292524] text-white flex items-center justify-center shadow-2xs shrink-0">
              <History className="w-4 h-4 text-[#F7D147]" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-[#292524] tracking-[-0.02em] flex items-center gap-2 flex-wrap">
                <span>AI Version Control &amp; Revert</span>
                <span className="text-[13px] font-bold px-2.5 py-0.5 rounded-full bg-[#F2FBF8] text-[#1E4D42] border border-[#96D6C7] tabular-nums">
                  {activeChanges.length} Active
                </span>
              </h3>
              <p className="text-base leading-[1.65] text-[#57534E]">
                Audit and revert any formulas, custom analytics, or charts created by the AI Assistant
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close version control modal"
            className="p-2 text-[#78716C] hover:text-[#292524] rounded-full hover:bg-[#EAE6DF]/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {history.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#F7F5F0] border border-[#EAE6DF] text-[#78716C] flex items-center justify-center mx-auto mb-2">
                <History className="w-6 h-6" />
              </div>
              <p className="font-heading text-lg font-bold text-[#292524]">No AI modifications recorded yet</p>
              <p className="text-base leading-[1.65] text-[#57534E]">
                Every formula &amp; chart snapshot lands here
              </p>
              <p className="text-base leading-[1.65] text-[#78716C] mt-1 max-w-xs mx-auto">
                When you ask the AI Copilot to generate a new formula or custom chart, snapshot versions will be logged here with instant 1-click revert.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => {
                const isReverted = !!item.reverted;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isReverted
                        ? 'bg-[#F7F5F0]/60 border-[#EAE6DF] opacity-65'
                        : 'bg-[#FFFFFF] border-[#96D6C7] shadow-2xs ring-1 ring-[#96D6C7]/35'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[13px] font-bold px-2.5 py-0.5 rounded-full ${
                            isReverted
                              ? 'bg-[#EAE6DF] text-[#57534E]'
                              : 'bg-[#F2FBF8] text-[#1E4D42] border border-[#96D6C7]'
                          }`}
                        >
                          {item.actionType === 'add_formula' ? 'Analytic Formula' : 'Dynamic Chart'}
                        </span>
                        <span className="font-heading text-base font-bold text-[#292524] truncate">
                          {item.title}
                        </span>
                        <span className="text-[13px] text-[#78716C] tabular-nums">
                          {formatTime(item.timestamp)}
                        </span>
                      </div>

                      <p className="text-base text-[#57534E] mt-1 leading-[1.65]">
                        {item.description}
                      </p>

                      {isReverted && item.revertedAt && (
                        <p className="text-[13px] text-[#78716C] mt-1 flex items-center gap-1 italic tabular-nums">
                          <span>Reverted {formatTime(item.revertedAt)}</span>
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isReverted ? (
                        <span className="px-3 py-1 rounded-full text-[13px] font-semibold bg-[#F7F5F0] text-[#78716C] border border-[#EAE6DF] flex items-center gap-1 whitespace-nowrap shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#78716C]" />
                          <span>Reverted</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRevert(item.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-bold bg-[#FDF4F3] hover:bg-[#F6BEBA]/45 text-[#7A3A36] border border-[#D97A75]/45 transition-all cursor-pointer whitespace-nowrap shrink-0"
                          title="Revert and remove this AI modification"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#D97A75]" />
                          <span>Revert Change</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#EAE6DF] bg-[#F7F5F0] flex items-center justify-between text-[13px] text-[#57534E] shrink-0">
          <span className="tabular-nums">{history.length} total event(s) logged</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-[13px] font-semibold text-[#292524] hover:bg-[#EAE6DF]/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
