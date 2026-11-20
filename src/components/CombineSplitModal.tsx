import React from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  GitMerge,
  Tag,
  CheckCircle2,
  Clock,
  FileAudio,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { InterviewRecord } from '../types';
import { SplitCandidatePair } from '../lib/recordingAudit';

interface CombineSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  pair: SplitCandidatePair | null;
  onCombine: (recA: InterviewRecord, recB: InterviewRecord) => void;
  onRenameSeparate: (recA: InterviewRecord, recB: InterviewRecord) => void;
}

export const CombineSplitModal: React.FC<CombineSplitModalProps> = ({
  isOpen,
  onClose,
  pair,
  onCombine,
  onRenameSeparate,
}) => {
  if (!isOpen || !pair) return null;

  const { recordA, recordB, fileName, first3A, first3B } = pair;

  const formatUploadTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const wordCountA = recordA.wordCount || (recordA.transcript ? recordA.transcript.split(/\s+/).length : 0);
  const wordCountB = recordB.wordCount || (recordB.transcript ? recordB.transcript.split(/\s+/).length : 0);
  const totalCombinedWords = wordCountA + wordCountB;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-3xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-amber-200 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-stone-900">
                  Split Interview Recording Audit
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase tracking-wide">
                  Same Name • Different Conversation
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-1 max-w-xl">
                Both recordings share the name <span className="font-bold text-stone-900">"{fileName}"</span>, but their first 3 conversation turns are different. This indicates they are two parts of the same interview split into multiple recordings.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/70 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {/* Conversation Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recording Part 1 */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-stone-200 mb-2.5">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                      1
                    </span>
                    Part 1 (Uploaded First)
                  </span>
                  <span className="text-[11px] font-mono text-stone-500">
                    {wordCountA} words
                  </span>
                </div>

                <div className="text-[11px] text-stone-500 mb-2 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  {formatUploadTime(recordA.uploadedAt)}
                  {recordA.folderName && <span>• Folder: {recordA.folderName}</span>}
                </div>

                <div className="space-y-2 mt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                    First 3 Conversation Turns:
                  </span>
                  {first3A.length > 0 ? (
                    first3A.map((line, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2.5 rounded-lg border border-stone-200 text-xs text-stone-800 leading-relaxed font-sans"
                      >
                        <span className="text-[10px] font-bold text-blue-700 block mb-0.5">
                          Turn {idx + 1}
                        </span>
                        {line}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-stone-400 italic">No transcript recorded</p>
                  )}
                </div>
              </div>
            </div>

            {/* Recording Part 2 */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-stone-200 mb-2.5">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[11px] font-bold flex items-center justify-center">
                      2
                    </span>
                    Part 2 (Continued Session)
                  </span>
                  <span className="text-[11px] font-mono text-stone-500">
                    {wordCountB} words
                  </span>
                </div>

                <div className="text-[11px] text-stone-500 mb-2 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  {formatUploadTime(recordB.uploadedAt)}
                  {recordB.folderName && <span>• Folder: {recordB.folderName}</span>}
                </div>

                <div className="space-y-2 mt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                    First 3 Conversation Turns:
                  </span>
                  {first3B.length > 0 ? (
                    first3B.map((line, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2.5 rounded-lg border border-stone-200 text-xs text-stone-800 leading-relaxed font-sans"
                      >
                        <span className="text-[10px] font-bold text-purple-700 block mb-0.5">
                          Turn {idx + 1}
                        </span>
                        {line}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-stone-400 italic">No transcript recorded</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Merge Explanation Card */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Recommended Action: Combine into 1 Continuous Recording</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              Combining will merge the audio transcripts in sequential order (<span className="font-semibold">{totalCombinedWords} words total</span>) with a clear <span className="font-mono text-[11px] bg-amber-100 px-1 py-0.5 rounded">--- [Part 2: Continued Recording] ---</span> separator. The redundant file is cleaned up, and all qualitative themes stay intact in one complete participant record.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-4 border-t border-stone-200 bg-stone-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition-all cursor-pointer"
          >
            Cancel / Review Later
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            {/* Option 2: Keep Separate & Auto-Rename */}
            <button
              type="button"
              onClick={() => {
                onRenameSeparate(recordA, recordB);
                onClose();
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <Tag className="w-3.5 h-3.5 text-stone-500" />
              <span>Keep Separate (Auto-Rename Part 1 & 2)</span>
            </button>

            {/* Option 1: Combine into 1 Continuous Recording */}
            <button
              type="button"
              onClick={() => {
                onCombine(recordA, recordB);
                onClose();
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-all cursor-pointer hover:translate-y-[-0.5px]"
            >
              <GitMerge className="w-4 h-4" />
              <span>Combine into 1 Recording</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
