import React, { useState, useRef } from 'react';
import {
  FileAudio,
  FileText,
  HardDrive,
  Copy,
  Check,
  Download,
  Trash2,
  Maximize2,
  Clock,
  Play,
  Pause,
  AlertCircle,
  Loader2,
  Volume2,
  Sparkles,
  RotateCw,
  Edit3,
  Upload,
  GitMerge,
  AlertTriangle,
} from 'lucide-react';
import { InterviewRecord } from '../types';
import { RecordAuditInfo } from '../lib/recordingAudit';

interface TranscriptCardProps {
  record: InterviewRecord;
  onDelete: (id: string) => void;
  onRetry: (record: InterviewRecord) => void;
  onExpand: (record: InterviewRecord) => void;
  onUpdate?: (updated: InterviewRecord) => void;
  auditInfo?: RecordAuditInfo;
  onCombineSplit?: () => void;
}

export const TranscriptCard: React.FC<TranscriptCardProps> = ({
  record,
  onDelete,
  onRetry,
  onExpand,
  onUpdate,
  auditInfo,
  onCombineSplit,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(record.transcript || '');
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveEdit = () => {
    if (!onUpdate) return;
    const words = editText.trim().split(/\s+/).filter(Boolean).length;
    onUpdate({
      ...record,
      status: 'completed',
      transcript: editText.trim(),
      wordCount: words,
      errorMessage: undefined,
    });
    setIsEditing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdate) return;
    try {
      const text = await file.text();
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      onUpdate({
        ...record,
        status: 'completed',
        transcript: text.trim(),
        wordCount: words,
        errorMessage: undefined,
      });
      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to read uploaded transcript:', err);
    }
  };

  const handleCopy = async () => {
    if (!record.transcript) return;
    try {
      await navigator.clipboard.writeText(record.transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy transcript', err);
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

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatUploadTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Render transcript with nice speaker highlights
  const renderFormattedTranscript = (text: string) => {
    const paragraphs = text.split('\n').filter((p) => p.trim().length > 0);

    return (
      <div className="space-y-2.5 font-sans text-xs text-stone-800 leading-relaxed">
        {paragraphs.map((p, idx) => {
          // Check for speaker pattern like "Speaker:", "[00:15] Parent (Sarah):", etc.
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
                className={`p-2.5 rounded-lg border text-xs transition-colors ${
                  isInterviewer
                    ? 'bg-amber-50/50 border-amber-200/70'
                    : isChild
                    ? 'bg-emerald-50/50 border-emerald-200/70'
                    : isDoctor
                    ? 'bg-indigo-50/50 border-indigo-200/70'
                    : 'bg-stone-50/70 border-stone-200/70'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 font-semibold">
                  {timeTag && (
                    <span className="font-mono text-[10px] text-stone-400 bg-white px-1.5 py-0.5 rounded border border-stone-200">
                      {timeTag}
                    </span>
                  )}
                  <span
                    className={`${
                      isInterviewer
                        ? 'text-amber-800'
                        : isChild
                        ? 'text-emerald-800'
                        : isDoctor
                        ? 'text-indigo-800'
                        : 'text-stone-900'
                    }`}
                  >
                    {speakerName}:
                  </span>
                </div>
                <div className="text-stone-700 whitespace-pre-wrap pl-0.5">{spokenText}</div>
              </div>
            );
          }

          return (
            <p key={idx} className="text-stone-700 whitespace-pre-wrap">
              {p}
            </p>
          );
        })}
      </div>
    );
  };

  const isAudio = record.fileType === 'audio';
  const isSplitRecording = auditInfo?.isDuplicate && auditInfo.duplicateType === 'split_recording';
  const isExactDuplicate = auditInfo?.isDuplicate && auditInfo.duplicateType === 'exact_duplicate';

  return (
    <article
      className={`rounded-xl transition-all overflow-hidden flex flex-col ${
        isExactDuplicate
          ? 'bg-rose-50/20 border-2 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
          : isSplitRecording
          ? 'bg-amber-50/15 border-2 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
          : 'bg-white border border-stone-200 shadow-2xs hover:shadow-xs'
      }`}
    >
      {/* Split Recording Banner (Same name, different conversation turns -> Ask user to combine) */}
      {isSplitRecording && (
        <div className="bg-amber-500/15 border-b border-amber-300 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <span className="p-1 rounded bg-amber-200 text-amber-900 shrink-0 mt-0.5 sm:mt-0">
              <GitMerge className="w-4 h-4 text-amber-800" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                  ⚡ Split Recording Detected
                </span>
                <span className="text-stone-900 font-semibold text-xs">
                  Same file name, but conversation content is different!
                </span>
              </div>
              <p className="text-[11px] text-stone-600 mt-0.5">
                Audit checked first 3 dialogue lines against partner recording. Likely Part 1 & Part 2 of same interview.
              </p>
            </div>
          </div>

          {onCombineSplit && (
            <button
              type="button"
              onClick={onCombineSplit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer self-start sm:self-auto hover:translate-y-[-0.5px]"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Combine Recordings</span>
            </button>
          )}
        </div>
      )}

      {/* Exact Duplicate Banner (Identical conversation -> Redundant duplicate file) */}
      {isExactDuplicate && (
        <div className="bg-rose-500/15 border-b border-rose-300 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <span className="p-1 rounded bg-rose-200 text-rose-900 shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-4 h-4 text-rose-700 animate-pulse" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-600 text-white">
                  ⚠️ Duplicate Recording
                </span>
                <span className="text-rose-950 font-semibold text-xs">
                  Exact duplicate file & conversation of "{auditInfo?.partnerFileName}".
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">
                First 3 conversation lines are identical. Redundant file upload.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onDelete(record.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Duplicate</span>
          </button>
        </div>
      )}

      {/* Header bar */}
      <div
        className={`px-4 py-3 border-b flex items-start justify-between gap-3 ${
          isExactDuplicate
            ? 'bg-rose-50/40 border-rose-200'
            : isSplitRecording
            ? 'bg-amber-50/40 border-amber-200'
            : 'border-stone-100 bg-stone-50/50'
        }`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              isExactDuplicate
                ? 'bg-rose-100 text-rose-700'
                : isSplitRecording
                ? 'bg-amber-100 text-amber-800'
                : isAudio
                ? 'bg-amber-100 text-amber-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {isAudio ? <FileAudio className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold text-stone-900 truncate tracking-tight">
                {record.fileName}
              </h4>
              {isSplitRecording && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  ⚡ Split Part
                </span>
              )}
              {isExactDuplicate && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  ⚠️ Duplicate
                </span>
              )}
            </div>

            {/* Badges: Source & Uploaded Time */}
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-stone-500">
              {/* Source badge */}
              {record.source === 'google_drive' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <HardDrive className="w-3 h-3 text-blue-600" /> Google Drive
                </span>
              )}
              {record.source === 'local_upload' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                  {isAudio ? 'MP3 Upload' : 'Document Upload'}
                </span>
              )}
              {record.source === 'pasted_text' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  Pasted Notes
                </span>
              )}

              {/* Upload timestamp */}
              <span className="flex items-center gap-1 text-stone-400">
                <Clock className="w-3 h-3" />
                Attached {formatUploadTime(record.uploadedAt)}
              </span>

              {record.wordCount && (
                <span className="text-stone-400">• {record.wordCount} words</span>
              )}
            </div>
          </div>
        </div>

        {/* Card Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {record.status === 'completed' && record.transcript && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy Transcript"
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                title="Download transcript as .txt"
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>

              {onUpdate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditText(record.transcript || '');
                    setIsEditing(!isEditing);
                  }}
                  title="Edit or replace transcript manually"
                  className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => onExpand(record)}
                title="Expand full screen"
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              {record.source === 'google_drive' && (
                <button
                  type="button"
                  onClick={() => onRetry(record)}
                  title="Re-transcribe with Multilingual Engine"
                  className="p-1.5 text-stone-500 hover:text-amber-700 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.docx,.md,text/plain"
            className="hidden"
            onChange={handleFileUpload}
          />

          <button
            type="button"
            onClick={() => onDelete(record.id)}
            title="Remove recording"
            className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audio player if audio recording */}
      {record.audioUrl && (
        <div className="px-4 py-2 bg-amber-50/30 border-b border-stone-100 flex items-center gap-3">
          <audio
            ref={audioRef}
            src={record.audioUrl}
            onTimeUpdate={() => {
              if (audioRef.current) setAudioCurrentTime(audioRef.current.currentTime);
            }}
            onLoadedMetadata={() => {
              if (audioRef.current) setAudioDuration(audioRef.current.duration);
            }}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <button
            type="button"
            onClick={togglePlayAudio}
            className="w-7 h-7 rounded-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-2xs"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>

          <div className="flex-1 flex items-center gap-2">
            <span className="text-[11px] font-mono text-stone-500 min-w-[32px]">
              {formatTime(audioCurrentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={audioDuration || 100}
              value={audioCurrentTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setAudioCurrentTime(val);
                if (audioRef.current) audioRef.current.currentTime = val;
              }}
              className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
            <span className="text-[11px] font-mono text-stone-500 min-w-[32px]">
              {formatTime(audioDuration)}
            </span>
          </div>

          <Volume2 className="w-4 h-4 text-stone-400 shrink-0" />
        </div>
      )}

      {/* Transcript Body / Status Area */}
      <div className="p-4 flex-1">
        {/* Inline Manual Transcript Editor */}
        {isEditing && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Edit / Replace Transcript Manually
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer shadow-2xs"
              >
                <Upload className="w-3 h-3" /> Upload File (.txt)
              </button>
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={8}
              placeholder="Paste or type interview transcript here..."
              className="w-full p-2.5 text-xs font-mono bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-200/60 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editText.trim()}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" /> Save Transcript
              </button>
            </div>
          </div>
        )}

        {record.status === 'transcribing' && !isEditing && (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600 mb-2" />
            <p className="text-xs font-semibold text-stone-800">
              {record.fileType === 'audio' ? 'Transcribing interview recording...' : 'Importing text document...'}
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {record.fileType === 'audio'
                ? 'Powered by Gemini 3.1 Flash Lite. Structuring dialogue and speaker turns.'
                : 'Reading the original text directly; no transcription needed.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditText(record.transcript || '');
                setIsEditing(true);
              }}
              className="mt-3 text-[11px] font-semibold text-amber-700 hover:text-amber-800 underline cursor-pointer"
            >
              Or upload / paste transcript yourself
            </button>
          </div>
        )}

        {record.status === 'error' && !isEditing && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2.5">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {record.fileType === 'audio' ? 'Transcription failed:' : 'Text import failed:'}{' '}
                {record.errorMessage || (record.fileType === 'audio' ? 'Unable to transcribe audio recording.' : 'Unable to import this text document.')}
              </span>
            </div>
            <p className="text-stone-600 text-[11px] leading-relaxed">
              {record.fileType === 'audio'
                ? 'If automatic transcription does not work for this recording, upload a transcript or type/paste it directly.'
                : 'The original text is imported directly. Retry the import or type/paste the content manually.'}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onRetry(record)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
              >
                <RotateCw className="w-3.5 h-3.5" /> {record.fileType === 'audio' ? 'Retry Transcription' : 'Retry Import'}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-stone-500" /> Upload Transcript (.txt)
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditText(record.transcript || '');
                  setIsEditing(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-white cursor-pointer shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" /> Type / Paste Manually
              </button>
            </div>
          </div>
        )}

        {record.status === 'completed' && record.transcript && !isEditing && (
          <div>
            {record.transcript.toLowerCase().includes('no audible speech') && (
              <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <p className="font-semibold text-amber-950">Multilingual audio notice</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Recorded in English, Malay, and Chinese. Re-transcribe or upload your own transcript.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditText(record.transcript || '');
                      setIsEditing(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Upload / Edit
                  </button>
                  {record.source === 'google_drive' && (
                    <button
                      type="button"
                      onClick={() => onRetry(record)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shrink-0 cursor-pointer shadow-2xs"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Re-transcribe
                    </button>
                  )}
                </div>
              </div>
            )}
            {renderFormattedTranscript(record.transcript)}
          </div>
        )}

        {record.status === 'pending' && (
          <div className="py-6 text-center text-xs text-stone-400">
            Waiting in queue...
          </div>
        )}
      </div>
    </article>
  );
};
