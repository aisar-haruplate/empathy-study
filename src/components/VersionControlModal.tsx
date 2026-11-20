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
import { AiVersionHistoryItem } from '../types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 bg-stone-50/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <span>AI Version Control &amp; Revert</span>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {activeChanges.length} Active
                </span>
              </h3>
              <p className="text-xs text-stone-500">
                Audit and revert any formulas, custom analytics, or charts created by the AI Assistant
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {history.length === 0 ? (
            <div className="py-12 text-center text-stone-400">
              <History className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-stone-700">No AI modifications recorded yet</p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto">
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
                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isReverted
                        ? 'bg-stone-50/60 border-stone-200 opacity-60'
                        : 'bg-white border-amber-200 shadow-2xs hover:shadow-xs ring-1 ring-amber-100'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                            isReverted
                              ? 'bg-stone-200 text-stone-600'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {item.actionType === 'add_formula' ? 'Analytic Formula' : 'Dynamic Chart'}
                        </span>
                        <span className="text-xs font-bold text-stone-900 truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {formatTime(item.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                        {item.description}
                      </p>

                      {isReverted && item.revertedAt && (
                        <p className="text-[11px] text-stone-400 mt-1 flex items-center gap-1 italic">
                          <span>Reverted {formatTime(item.revertedAt)}</span>
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isReverted ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-500 border border-stone-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-stone-400" />
                          <span>Reverted</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRevert(item.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
                          title="Revert and remove this AI modification"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
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
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs text-stone-500 shrink-0">
          <span>{history.length} total event(s) logged</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
