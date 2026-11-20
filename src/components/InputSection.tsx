import React, { useRef, useState } from 'react';
import {
  Upload,
  FileAudio,
  FileText,
  HardDrive,
  ClipboardPaste,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Laptop,
  CheckCircle2,
} from 'lucide-react';

interface InputSectionProps {
  onAudioUpload: (file: File) => Promise<void> | void;
  onTextDocUpload: (file: File) => Promise<void> | void;
  onPastedTextSubmit: (text: string, title?: string) => void;
  onOpenGoogleDrive: () => void;
  onOpenUniversalUpload?: () => void;
  isProcessing: boolean;
  googleConnected: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({
  onAudioUpload,
  onTextDocUpload,
  onPastedTextSubmit,
  onOpenGoogleDrive,
  onOpenUniversalUpload,
  isProcessing,
  googleConnected,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [showPasteForm, setShowPasteForm] = useState(false);
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedContent, setPastedContent] = useState('');

  const audioInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      const isAudio =
        file.type.startsWith('audio/') ||
        file.name.toLowerCase().endsWith('.mp3') ||
        file.name.toLowerCase().endsWith('.wav') ||
        file.name.toLowerCase().endsWith('.m4a') ||
        file.name.toLowerCase().endsWith('.webm');

      if (isAudio) {
        await onAudioUpload(file);
      } else {
        await onTextDocUpload(file);
      }
    }
  };

  const handlePastedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedContent.trim()) return;
    onPastedTextSubmit(pastedContent.trim(), pastedTitle.trim() || undefined);
    setPastedContent('');
    setPastedTitle('');
    setShowPasteForm(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 mb-8">
      {/* Consolidated Header */}
      <div className="mb-4">
        <h2 className="text-base font-bold text-stone-900">
          Upload Interview Recordings & Documents
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Consolidated upload: Import recordings directly from Google Drive / Shared Drives or upload files from your device.
        </p>
      </div>

      {/* Two Consolidated Upload Options Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* OPTION 1: Google Drive & Shared Drives */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                    Google Drive & Shared Drives
                  </h3>
                  <span className="text-[11px] text-blue-700 font-medium">
                    My Drive • Shared Drives • Shared with Me
                  </span>
                </div>
              </div>

              {googleConnected && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Connected
                </span>
              )}
            </div>

            <p className="text-xs text-stone-600 leading-relaxed mb-4">
              Browse your Google Drive folders and Shared Team Drives, then use <strong>"Select All by MP3"</strong> to batch-transcribe interview recordings.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onOpenGoogleDrive}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Open Google Drive &amp; Shared Drives</span>
            </button>
            {onOpenUniversalUpload && (
              <button
                type="button"
                onClick={onOpenUniversalUpload}
                title="Upload audio, transcripts, cleaned data, or ADKOTM codes manually"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-stone-900 hover:bg-stone-800 text-white shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Upload Data (Self-Entry)</span>
              </button>
            )}
          </div>
        </div>

        {/* OPTION 2: Upload from Device (Computer / Phone) */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
            dragActive
              ? 'border-amber-500 bg-amber-50/50'
              : 'border-stone-200 bg-stone-50/50 hover:border-stone-300'
          }`}
        >
          {/* Hidden native file inputs */}
          <input
            ref={audioInputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.m4a,.webm"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(Array.from(e.target.files));
            }}
          />
          <input
            ref={textInputRef}
            type="file"
            multiple
            accept=".txt,.doc,.docx,.md,text/plain"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(Array.from(e.target.files));
            }}
          />

          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-lg bg-stone-800 text-white flex items-center justify-center shadow-xs">
                <Laptop className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                  Upload from Device
                </h3>
                <span className="text-[11px] text-stone-500 font-medium">
                  Computer or Phone
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed mb-4">
              Drag and drop your audio files here, or choose MP3 / M4A / WAV recordings and interview text files (.txt, .docx).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>Upload MP3 / Audio</span>
            </button>

            <button
              type="button"
              onClick={() => textInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-stone-800 hover:bg-stone-900 text-white shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Upload Text Doc</span>
            </button>
          </div>
        </div>
      </div>

      {/* Direct Paste Toggle */}
      <div className="mt-4 pt-3 border-t border-stone-100 flex flex-col">
        <button
          type="button"
          onClick={() => setShowPasteForm((prev) => !prev)}
          className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
        >
          <ClipboardPaste className="w-3.5 h-3.5 text-stone-400" />
          <span>Or insert / paste text interview notes directly</span>
          {showPasteForm ? (
            <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
          )}
        </button>

        {showPasteForm && (
          <form onSubmit={handlePastedSubmit} className="mt-3 space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Document / Recording Name (Optional)
              </label>
              <input
                type="text"
                value={pastedTitle}
                onChange={(e) => setPastedTitle(e.target.value)}
                placeholder="e.g. Interview Notes - Mother of 4yo Toddler Snack Habits.txt"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Interview Notes Content
              </label>
              <textarea
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                rows={5}
                required
                placeholder="Paste interview notes or session transcript here..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPastedContent('');
                  setShowPasteForm(false);
                }}
                className="px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!pastedContent.trim() || isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-white cursor-pointer disabled:opacity-50"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Add & Process Notes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
