import React, { useState } from 'react';
import { X, Copy, Check, Download, Search, FileAudio, FileText } from 'lucide-react';
import { InterviewRecord } from '../../types';

interface ExpandedTranscriptModalProps {
  record: InterviewRecord | null;
  onClose: () => void;
}

export const ExpandedTranscriptModal: React.FC<ExpandedTranscriptModalProps> = ({
  record,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');

  if (!record || !record.transcript) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(record.transcript || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = () => {
    if (!record.transcript) return;
    const blob = new Blob([record.transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${record.fileName.replace(/\.[^/.]+$/, '')}_transcript.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const paragraphs = record.transcript.split('\n').filter((p) => p.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1B1F]/45 backdrop-blur-xs">
      <div className="bg-[#FDFCF8] rounded-[32px] shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 bg-[#F2F5F3]">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                record.fileType === 'audio'
                  ? 'bg-[#FDF3C7] text-[#3B2E00]'
                  : 'bg-[#DCE8F7] text-[#132B47]'
              }`}
            >
              {record.fileType === 'audio' ? (
                <FileAudio className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-heading text-xl font-medium text-[#1C1B1F] truncate">{record.fileName}</h3>
              <p className="text-sm text-[#444846] tabular-nums">
                Full Verbatim Transcript · {record.wordCount || 0} words
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="md3-btn-tonal inline-flex items-center gap-1.5 px-4 py-2 text-sm cursor-pointer whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-[#4FA896]" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="md3-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              Download .txt
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close transcript modal"
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-[#444846] hover:text-[#1C1B1F] rounded-full hover:bg-[#528BCA]/10 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Transcript Font Toolbar */}
        <div className="px-6 py-3 bg-[#F2F5F3]/60 border-b border-[#D5DDD8] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[#444846] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keywords in this interview..."
              className="md3-field min-h-[44px] w-full pl-10 pr-3 py-2 text-sm placeholder-[#727975]"
            />
          </div>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="min-h-[36px] text-xs font-medium text-[#444846] hover:text-[#1C1B1F] px-3 py-1 rounded-full hover:bg-[#528BCA]/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* Content */}
        <div className="doc-canvas transcript-surface flex-1 overflow-y-auto p-6 space-y-3.5 bg-[#FDFCF8]">
          {paragraphs.map((p, idx) => {
            const matchesSearch =
              !search || p.toLowerCase().includes(search.toLowerCase());

            const speakerMatch = p.match(/^(\[?\d{1,2}:\d{2}\]?\s*)?([A-Za-z0-9\s,\(\)]+?):(.*)$/);

            if (speakerMatch) {
              const timeTag = speakerMatch[1]?.trim();
              const speakerName = speakerMatch[2].trim();
              const spokenText = speakerMatch[3];

              const isInterviewer = speakerName.toLowerCase().includes('interviewer');
              const isChild = speakerName.toLowerCase().includes('child');
              const isDoctor =
                speakerName.toLowerCase().includes('dietitian') ||
                speakerName.toLowerCase().includes('nutritionist');

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    !matchesSearch ? 'opacity-30' : ''
                  } ${
                    isInterviewer
                      ? 'bg-[#F7F5F0] border-[#EAE6DF]'
                      : isChild
                      ? 'bg-[#F2FBF8] border-[#96D6C7]'
                      : isDoctor
                      ? 'bg-[#F2F7FC] border-[#528BCA]/40'
                      : 'bg-white border-[#EAE6DF]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5 font-semibold">
                    {timeTag && (
                      <span className="font-mono tabular-nums text-[13px] text-[#78716C] bg-white px-2 py-0.5 rounded-full border border-[#EAE6DF]">
                        {timeTag}
                      </span>
                    )}
                    <span
                      className={`text-[13px] uppercase tracking-wider font-bold ${
                        isInterviewer
                          ? 'text-[#57534E]'
                          : isChild
                          ? 'text-[#1E4D42]'
                          : isDoctor
                          ? 'text-[#234B78]'
                          : 'text-[#292524]'
                      }`}
                    >
                      {speakerName}
                    </span>
                  </div>
                  <div className="text-[#292524] whitespace-pre-wrap">{spokenText}</div>
                </div>
              );
            }

            return (
              <p
                key={idx}
                className={`text-[#57534E] whitespace-pre-wrap p-2 rounded-xl ${
                  !matchesSearch ? 'opacity-30' : ''
                }`}
              >
                {p}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
};
