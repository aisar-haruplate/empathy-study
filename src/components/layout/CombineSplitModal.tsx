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
import { InterviewRecord } from '../../types';
import { SplitCandidatePair } from '../../lib/recordingAudit';

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
    <div className="fixed inset-0 z-50 bg-[#292524]/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-[#EAE6DF] shadow-studio w-full max-w-3xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAE6DF] bg-[#F7F5F0] flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FEFBEB] border border-[#F7D147] text-[#6B5306] flex items-center justify-center shrink-0">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading text-lg font-bold text-[#292524] tracking-[-0.02em]">
                  Split Interview Recording Audit
                </h3>
                <span className="text-[13px] font-bold px-2.5 py-0.5 rounded-full bg-[#FEFBEB] border border-[#F7D147] text-[#6B5306] tracking-wide whitespace-nowrap">
                  Same Name · Different Conversation
                </span>
              </div>
              <p className="text-base leading-[1.65] text-[#57534E] mt-1.5 max-w-xl">
                Both recordings share the name <span className="font-bold text-[#292524]">"{fileName}"</span>, but their first 3 conversation turns are different. This indicates they are two parts of the same interview split into multiple recordings.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#78716C] hover:text-[#292524] hover:bg-[#EAE6DF]/60 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[72vh] overflow-y-auto bg-white">
          {/* Conversation Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recording Part 1 */}
            <div className="bg-[#FDFCF8] border border-[#EAE6DF] rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2.5 border-b border-[#EAE6DF] mb-2.5">
                  <span className="font-heading text-base font-bold text-[#292524] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#528BCA] text-white text-[13px] font-bold flex items-center justify-center tabular-nums">
                      1
                    </span>
                    Part 1 (Uploaded First)
                  </span>
                  <span className="text-[13px] font-mono tabular-nums text-[#78716C]">
                    {wordCountA} words
                  </span>
                </div>

                <div className="text-[13px] text-[#78716C] mb-2 flex items-center gap-2 tabular-nums">
                  <Clock className="w-3.5 h-3.5" />
                  {formatUploadTime(recordA.uploadedAt)}
                  {recordA.folderName && <span>· Folder: {recordA.folderName}</span>}
                </div>

                <div className="space-y-2.5 mt-3">
                  <span className="text-[13px] font-heading font-bold uppercase tracking-wider text-[#78716C] block">
                    First 3 Conversation Turns:
                  </span>
                  {first3A.length > 0 ? (
                    first3A.map((line, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded-xl border border-[#EAE6DF] text-base text-[#292524] leading-[1.65]"
                      >
                        <span className="text-[13px] font-bold text-[#234B78] block mb-0.5 tabular-nums">
                          Turn {idx + 1}
                        </span>
                        {line}
                      </div>
                    ))
                  ) : (
                    <p className="text-base leading-[1.65] text-[#78716C]">No transcript recorded</p>
                  )}
                </div>
              </div>
            </div>

            {/* Recording Part 2 */}
            <div className="bg-[#FDFCF8] border border-[#EAE6DF] rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2.5 border-b border-[#EAE6DF] mb-2.5">
                  <span className="font-heading text-base font-bold text-[#292524] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#7C8CE0] text-white text-[13px] font-bold flex items-center justify-center tabular-nums">
                      2
                    </span>
                    Part 2 (Continued Session)
                  </span>
                  <span className="text-[13px] font-mono tabular-nums text-[#78716C]">
                    {wordCountB} words
                  </span>
                </div>

                <div className="text-[13px] text-[#78716C] mb-2 flex items-center gap-2 tabular-nums">
                  <Clock className="w-3.5 h-3.5" />
                  {formatUploadTime(recordB.uploadedAt)}
                  {recordB.folderName && <span>· Folder: {recordB.folderName}</span>}
                </div>

                <div className="space-y-2.5 mt-3">
                  <span className="text-[13px] font-heading font-bold uppercase tracking-wider text-[#78716C] block">
                    First 3 Conversation Turns:
                  </span>
                  {first3B.length > 0 ? (
                    first3B.map((line, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded-xl border border-[#EAE6DF] text-base text-[#292524] leading-[1.65]"
                      >
                        <span className="text-[13px] font-bold text-[#33418A] block mb-0.5 tabular-nums">
                          Turn {idx + 1}
                        </span>
                        {line}
                      </div>
                    ))
                  ) : (
                    <p className="text-base leading-[1.65] text-[#78716C]">No transcript recorded</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Merge Explanation Card */}
          <div className="p-4 rounded-2xl bg-[#FEFBEB] border border-[#F7D147]/80 text-base text-[#6B5306] space-y-1.5">
            <div className="font-heading font-bold flex items-center gap-1.5 text-[#6B5306]">
              <Sparkles className="w-4 h-4 text-[#B78807]" />
              <span>Recommended Action: Combine into 1 Continuous Recording</span>
            </div>
            <p className="text-[#57534E] leading-[1.65]">
              Combining will merge the audio transcripts in sequential order (<span className="font-semibold text-[#292524] tabular-nums">{totalCombinedWords} words total</span>) with a clear <span className="font-mono text-[13px] bg-white border border-[#EAE6DF] text-[#292524] px-2 py-0.5 rounded-md">--- [Part 2: Continued Recording] ---</span> separator. The redundant file is cleaned up, and all qualitative themes stay intact in one complete participant record.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 border-t border-[#EAE6DF] bg-[#F7F5F0] flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 font-heading text-sm font-semibold text-[#57534E] hover:text-[#292524] hover:bg-[#EAE6DF]/60 rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            Cancel / Review Later
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            {/* Option 2: Keep Separate & Auto-Rename */}
            <button
              type="button"
              onClick={() => {
                onRenameSeparate(recordA, recordB);
                onClose();
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 font-heading text-[13px] font-semibold text-[#292524] bg-white hover:bg-[#FDFCF8] border border-[#EAE6DF] rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Tag className="w-3.5 h-3.5 text-[#78716C]" />
              <span>Keep Separate (Auto-Rename Part 1 & 2)</span>
            </button>

            {/* Option 1: Combine into 1 Continuous Recording */}
            <button
              type="button"
              onClick={() => {
                onCombine(recordA, recordB);
                onClose();
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 font-heading text-sm font-bold text-white bg-[#528BCA] hover:bg-[#3F78B5] rounded-full shadow-xs transition-all cursor-pointer hover:-translate-y-0.5 whitespace-nowrap shrink-0"
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
