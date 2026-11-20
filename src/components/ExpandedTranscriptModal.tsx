import React, { useState } from 'react';
import { X, Copy, Check, Download, Search, FileAudio, FileText } from 'lucide-react';
import { InterviewRecord } from '../types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                record.fileType === 'audio'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {record.fileType === 'audio' ? (
                <FileAudio className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">{record.fileName}</h3>
              <p className="text-xs text-stone-500">
                Full Verbatim Transcript • {record.wordCount || 0} words
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download .txt
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search within transcript */}
        <div className="px-6 py-2.5 border-b border-stone-100 bg-white flex items-center gap-2">
          <Search className="w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keywords in this interview (e.g. broccoli, sugar, texture, peer pressure)..."
            className="w-full text-xs text-stone-800 placeholder-stone-400 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-xs text-stone-400 hover:text-stone-700"
            >
              Clear
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 font-sans text-xs sm:text-sm text-stone-800 leading-relaxed bg-stone-50/20">
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
                  className={`p-3.5 rounded-xl border transition-all ${
                    !matchesSearch ? 'opacity-30' : ''
                  } ${
                    isInterviewer
                      ? 'bg-amber-50/60 border-amber-200/80'
                      : isChild
                      ? 'bg-emerald-50/60 border-emerald-200/80'
                      : isDoctor
                      ? 'bg-indigo-50/60 border-indigo-200/80'
                      : 'bg-white border-stone-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5 font-semibold">
                    {timeTag && (
                      <span className="font-mono text-[11px] text-stone-500 bg-white px-1.5 py-0.5 rounded border border-stone-200">
                        {timeTag}
                      </span>
                    )}
                    <span
                      className={`text-xs uppercase tracking-wider font-bold ${
                        isInterviewer
                          ? 'text-amber-900'
                          : isChild
                          ? 'text-emerald-900'
                          : isDoctor
                          ? 'text-indigo-900'
                          : 'text-stone-900'
                      }`}
                    >
                      {speakerName}
                    </span>
                  </div>
                  <div className="text-stone-800 whitespace-pre-wrap">{spokenText}</div>
                </div>
              );
            }

            return (
              <p
                key={idx}
                className={`text-stone-700 whitespace-pre-wrap p-2 rounded ${
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
