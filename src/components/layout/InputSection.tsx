import React, { useRef, useState } from 'react';
import {
  Upload,
  CloudUpload,
  FileAudio,
  FileText,
  HardDrive,
  ClipboardPaste,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Folder,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

import {
  ACCEPTED_FILE_EXTENSIONS,
  collectDroppedFiles,
  collectInputFiles,
  DiscoveredFile,
  formatFileSize,
  validateDiscoveredFiles,
} from '../../services/fileIngestionService';

interface InputSectionProps {
  onAudioUpload: (file: File, customFolderName?: string) => Promise<void> | void;
  onTextDocUpload: (file: File, customFolderName?: string) => Promise<void> | void;
  onPastedTextSubmit: (text: string, title?: string) => void;
  onOpenGoogleDrive: () => void;
  onOpenUniversalUpload?: () => void;
  isProcessing: boolean;
  googleConnected: boolean;
}

interface DeviceUploadItem {
  id: string;
  fileName: string;
  folderPath?: string;
  sizeBytes: number;
  kind: 'audio' | 'text';
  extension: string;
  status: 'uploading' | 'done' | 'error';
  errorMessage?: string;
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

  const [attachedItems, setAttachedItems] = useState<DeviceUploadItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);
  const [isScanningFolder, setIsScanningFolder] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      // Only clear dragActive when leaving the dropzone container itself
      if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragActive(false);
      }
    }
  };

  const processDiscoveredFiles = async (
    discovered: DiscoveredFile[],
    sourceLabel: 'files' | 'folder'
  ) => {
    setUploadError(null);
    setUploadSummary(null);

    if (discovered.length === 0) {
      setUploadError(
        sourceLabel === 'folder'
          ? 'The selected folder is empty. Choose a folder containing audio recordings or transcript documents.'
          : 'No files were selected. Choose supported audio or transcript files to upload.'
      );
      return;
    }

    const { validItems, skippedUnsupported, skippedEmpty, folderRootNames } =
      validateDiscoveredFiles(discovered);

    if (validItems.length === 0) {
      const reasons: string[] = [];
      if (skippedEmpty > 0) {
        reasons.push(`${skippedEmpty} empty (0 B) file${skippedEmpty === 1 ? '' : 's'}`);
      }
      if (skippedUnsupported > 0) {
        reasons.push(
          `${skippedUnsupported} unsupported file${skippedUnsupported === 1 ? '' : 's'}`
        );
      }
      const detail = reasons.length > 0 ? ` Found ${reasons.join(' and ')}.` : '';
      setUploadError(
        `No supported non-empty audio or transcript files were found.${detail} Supported formats: MP3, M4A, WAV, TXT, DOCX, CSV, SRT, VTT.`
      );
      return;
    }

    const newCards: DeviceUploadItem[] = validItems.map((entry, idx) => ({
      id: `dev_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      fileName: entry.file.name,
      folderPath: entry.folderPath,
      sizeBytes: entry.file.size,
      kind: entry.kind,
      extension: entry.extension,
      status: 'uploading',
    }));

    setAttachedItems((prev) => [...newCards, ...prev]);

    let completedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < validItems.length; i++) {
      const entry = validItems[i];
      const cardId = newCards[i].id;
      setUploadSummary(
        `Processing ${i + 1} of ${validItems.length} file${validItems.length === 1 ? '' : 's'}...`
      );
      try {
        if (entry.kind === 'audio') {
          await onAudioUpload(entry.file, entry.folderName);
        } else {
          await onTextDocUpload(entry.file, entry.folderName);
        }
        completedCount++;
        setAttachedItems((prev) =>
          prev.map((item) => (item.id === cardId ? { ...item, status: 'done' } : item))
        );
      } catch (err: any) {
        failedCount++;
        setAttachedItems((prev) =>
          prev.map((item) =>
            item.id === cardId
              ? {
                  ...item,
                  status: 'error',
                  errorMessage: err?.message || 'Upload failed',
                }
              : item
          )
        );
      }
    }

    const skippedTotal = skippedUnsupported + skippedEmpty;
    const folderLabel =
      folderRootNames.length === 1
        ? ` from folder "${folderRootNames[0]}"`
        : folderRootNames.length > 1
        ? ` across ${folderRootNames.length} folders`
        : '';
    const skippedNote =
      skippedTotal > 0 ? ` (${skippedTotal} unsupported or empty skipped)` : '';

    if (failedCount > 0 && completedCount === 0) {
      setUploadSummary(null);
      setUploadError(
        `Failed to process ${failedCount} file${failedCount === 1 ? '' : 's'}${folderLabel}.`
      );
    } else {
      setUploadSummary(
        `Loaded ${completedCount} file${completedCount === 1 ? '' : 's'}${folderLabel}${skippedNote}.`
      );
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (isProcessing || isScanningFolder) return;

    setIsScanningFolder(true);
    try {
      const { discovered, hadDirectory } = await collectDroppedFiles(e.dataTransfer);
      await processDiscoveredFiles(discovered, hadDirectory ? 'folder' : 'files');
    } finally {
      setIsScanningFolder(false);
    }
  };

  const handleFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    sourceLabel: 'files' | 'folder'
  ) => {
    const discovered = collectInputFiles(e.target.files);
    // Reset input value so selecting the same file/folder again triggers onChange
    e.target.value = '';
    if (discovered.length === 0) return;
    void processDiscoveredFiles(discovered, sourceLabel);
  };

  const handleRemoveAttachedItem = (id: string) => {
    setAttachedItems((prev) => prev.filter((item) => item.id !== id));
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
    <div className="bg-[#F2F5F3] rounded-[32px] shadow-sm p-5 sm:p-7 mb-8">
      {/* Consolidated Header */}
      <div className="mb-5">
        <h2 className="font-heading text-2xl sm:text-[28px] font-medium text-[#1C1B1F] tracking-[-0.01em]">
          Upload Interview Recordings &amp; Documents
        </h2>
        <p className="text-base text-[#444846] mt-1.5 leading-[1.65]">
          Consolidated upload: Import recordings directly from Google Drive / Shared Drives or upload files and folders from your device.
        </p>
      </div>

      {/* Two Consolidated Upload Options Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* OPTION 1: Google Drive & Shared Drives */}
        <div className="group rounded-3xl bg-[#DCE8F7]/65 p-5 sm:p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]">
          <div>
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-[#528BCA] text-white flex items-center justify-center shadow-xs shrink-0 transition-transform duration-300 group-hover:scale-105">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading text-2xl font-medium text-[#1C1B1F] leading-snug">
                    Google Drive &amp; Shared Drives
                  </h3>
                  <span className="text-xs text-[#132B47] font-medium">
                    My Drive · Shared Drives · Shared with Me
                  </span>
                </div>
              </div>

              {googleConnected && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#133830] bg-[#DDF3ED] px-3 py-1 rounded-full whitespace-nowrap shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4FA896]" /> Connected
                </span>
              )}
            </div>

            <p className="text-base text-[#444846] leading-[1.65] mb-5">
              Browse your Google Drive folders and Shared Team Drives, then use <strong className="text-[#1C1B1F] font-medium">&quot;Select All by MP3&quot;</strong> to batch-transcribe interview recordings.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onOpenGoogleDrive}
              className="md3-btn-primary flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 cursor-pointer whitespace-nowrap"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Open Google Drive &amp; Shared Drives</span>
            </button>
            {onOpenUniversalUpload && (
              <button
                type="button"
                onClick={onOpenUniversalUpload}
                title="Upload audio, transcripts, cleaned data, or ADKOTM codes manually"
                className="md3-btn-tonal inline-flex items-center justify-center gap-1.5 px-5 py-2.5 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Upload className="w-4 h-4 text-[#4FA896]" />
                <span>Self-Entry</span>
              </button>
            )}
          </div>
        </div>

        {/* OPTION 2: Upload from Device (Dashed Dropzone + Single/Folder Upload + Attached File Cards) */}
        <div className="group rounded-3xl bg-[#FDFCF8] p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]">
          {/* Hidden native inputs: multi-file & whole-folder */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_EXTENSIONS}
            className="hidden"
            onChange={(e) => handleFileInputChange(e, 'files')}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
            className="hidden"
            onChange={(e) => handleFileInputChange(e, 'folder')}
          />

          {/* Card Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#DDF3ED] text-[#133830] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
                <Laptop className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-heading text-2xl font-medium text-[#1C1B1F] leading-snug">
                  Upload from Device
                </h3>
                <span className="text-xs text-[#444846] font-medium">
                  Single files or entire folders · Computer or Phone
                </span>
              </div>
            </div>

            {attachedItems.length > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#FDF3C7] text-[#3B2E00] tabular-nums shrink-0">
                {attachedItems.length} {attachedItems.length === 1 ? 'file' : 'files'}
              </span>
            )}
          </div>

          {/* Material 3 Tonal Dashed Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`rounded-3xl border-2 border-dashed px-5 py-6 text-center transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] flex flex-col items-center justify-center ${
              dragActive
                ? 'border-[#528BCA] bg-[#DCE8F7]/70'
                : 'border-[#727975]/50 bg-[#E7ECE9] hover:border-[#528BCA] hover:bg-[#DCE8F7]/35'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                dragActive
                  ? 'bg-[#528BCA] text-white'
                  : 'bg-[#DCE8F7] text-[#528BCA]'
              }`}
            >
              {isScanningFolder ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <CloudUpload className="w-6 h-6" />
              )}
            </div>

            <p className="font-heading text-base sm:text-lg font-medium text-[#1C1B1F] leading-snug">
              {dragActive
                ? 'Drop your files or folder here'
                : 'Choose files or a folder, or drag & drop them here'}
            </p>
            <p className="text-sm text-[#444846] mt-1 leading-[1.65]">
              MP3, M4A, WAV, TXT, DOCX, CSV, SRT, VTT
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing || isScanningFolder}
                className="md3-btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                <span>Browse Files</span>
              </button>

              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                disabled={isProcessing || isScanningFolder}
                className="md3-btn-tonal inline-flex items-center justify-center gap-2 px-5 py-2.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Folder className="w-4 h-4 text-[#133830]" />
                <span>Browse Folder</span>
              </button>
            </div>
          </div>

          {/* Feedback Banners (Progress / Summary / Validation Error) */}
          {uploadError && (
            <div
              role="alert"
              className="rounded-2xl bg-[#FBEAE9] px-4 py-3 text-sm text-[#7A3A36] flex items-start justify-between gap-2.5"
            >
              <div className="flex items-start gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-[#D97A75] shrink-0 mt-0.5" />
                <span className="leading-[1.65]">{uploadError}</span>
              </div>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                aria-label="Dismiss upload error"
                className="p-1 text-[#D97A75] hover:text-[#7A3A36] cursor-pointer shrink-0 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {uploadSummary && !uploadError && (
            <div className="rounded-2xl bg-[#DDF3ED] px-4 py-2.5 text-sm text-[#133830] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-[#4FA896] shrink-0" />
                <span className="truncate font-medium">{uploadSummary}</span>
              </div>
              <button
                type="button"
                onClick={() => setUploadSummary(null)}
                aria-label="Dismiss upload summary"
                className="p-1 text-[#133830]/75 hover:text-[#133830] cursor-pointer shrink-0 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Attached / Uploaded File Item Cards */}
          {attachedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-[#444846] px-1">
                <span>Uploaded from device</span>
                <button
                  type="button"
                  onClick={() => {
                    setAttachedItems([]);
                    setUploadSummary(null);
                  }}
                  className="text-[#D97A75] hover:underline cursor-pointer"
                >
                  Clear list
                </button>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
                {attachedItems.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                      item.status === 'error'
                        ? 'bg-[#FBEAE9]'
                        : 'bg-[#F2F5F3]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                          item.kind === 'audio'
                            ? 'bg-[#FDF3C7] text-[#3B2E00]'
                            : 'bg-[#DCE8F7] text-[#132B47]'
                        }`}
                      >
                        {item.kind === 'audio' ? (
                          <FileAudio className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                        <span className="text-[9px] font-bold tracking-wide leading-none mt-0.5">
                          {item.extension.slice(0, 4)}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1C1B1F] truncate">
                          {item.fileName}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#444846] mt-0.5">
                          <span className="tabular-nums">{formatFileSize(item.sizeBytes)}</span>
                          {item.folderPath && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                                <Folder className="w-3 h-3 shrink-0" />
                                <span className="truncate">{item.folderPath}</span>
                              </span>
                            </>
                          )}
                          <span>·</span>
                          {item.status === 'uploading' ? (
                            <span className="inline-flex items-center gap-1 text-[#528BCA] font-medium">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Uploading
                            </span>
                          ) : item.status === 'done' ? (
                            <span className="inline-flex items-center gap-1 text-[#133830] font-medium">
                              <CheckCircle2 className="w-3 h-3 text-[#4FA896]" />
                              Added
                            </span>
                          ) : (
                            <span className="text-[#D97A75] font-medium">
                              {item.errorMessage || 'Failed'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveAttachedItem(item.id)}
                      aria-label={`Remove ${item.fileName}`}
                      title="Remove from list"
                      className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-full text-[#444846] hover:text-[#D97A75] hover:bg-[#FBEAE9] transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Direct Paste Toggle */}
      <div className="mt-5 pt-4 border-t border-[#D5DDD8] flex flex-col">
        <button
          type="button"
          onClick={() => setShowPasteForm((prev) => !prev)}
          className="min-h-[44px] self-start inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-[#444846] hover:text-[#1C1B1F] hover:bg-[#528BCA]/10 cursor-pointer transition-colors"
        >
          <ClipboardPaste className="w-4 h-4 text-[#528BCA]" />
          <span>Or insert / paste text interview notes directly</span>
          {showPasteForm ? (
            <ChevronUp className="w-4 h-4 text-[#444846]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#444846]" />
          )}
        </button>

        {showPasteForm && (
          <form onSubmit={handlePastedSubmit} className="mt-3 space-y-3.5 bg-[#FDFCF8] p-5 rounded-3xl shadow-sm">
            <div>
              <label className="block text-xs font-medium text-[#444846] mb-1.5">
                Document / Recording Name (Optional)
              </label>
              <input
                type="text"
                value={pastedTitle}
                onChange={(e) => setPastedTitle(e.target.value)}
                placeholder="e.g. Interview Notes - Mother of 4yo Toddler Snack Habits.txt"
                className="md3-field min-h-[44px] w-full px-4 py-2.5 text-base"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#444846] mb-1.5">
                Interview Notes Content
              </label>
              <textarea
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                rows={5}
                required
                placeholder="Paste interview notes or session transcript here..."
                className="md3-field transcript-surface w-full px-4 py-3"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPastedContent('');
                  setShowPasteForm(false);
                }}
                className="min-h-[44px] px-5 py-2 text-sm font-medium text-[#444846] hover:text-[#1C1B1F] rounded-full hover:bg-[#528BCA]/10 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!pastedContent.trim() || isProcessing}
                className="md3-btn-primary inline-flex items-center gap-2 px-6 py-2.5 cursor-pointer disabled:opacity-50"
              >
                <ClipboardPaste className="w-4 h-4" />
                Add &amp; Process Notes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
