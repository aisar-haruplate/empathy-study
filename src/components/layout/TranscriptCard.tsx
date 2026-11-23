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
import { InterviewRecord } from '../../types';
import { RecordAuditInfo } from '../../lib/recordingAudit';

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
      <div className="space-y-3 font-sans text-base text-[#292524] leading-[1.65]">
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
                className={`p-4 rounded-xl border text-base transition-colors ${
                  isInterviewer
                    ? 'bg-[#EEF4FB] border-[#528BCA]/35'
                    : isChild
                    ? 'bg-[#F2FBF8] border-[#96D6C7]'
                    : isDoctor
                    ? 'bg-[#F2F7FC] border-[#528BCA]/40'
                    : 'bg-[#F7F5F0]/70 border-[#EAE6DF]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 font-semibold">
                  {timeTag && (
                    <span className="font-mono text-[13px] text-[#78716C] bg-white px-2 py-0.5 rounded-full border border-[#EAE6DF] tabular-nums">
                      {timeTag}
                    </span>
                  )}
                  <span
                    className={`text-[14px] ${
                      isInterviewer
                        ? 'text-[#234B78]'
                        : isChild
                        ? 'text-[#1E4D42]'
                        : isDoctor
                        ? 'text-[#234B78]'
                        : 'text-[#292524]'
                    }`}
                  >
                    {speakerName}:
                  </span>
                </div>
                <div className="text-[#292524] whitespace-pre-wrap pl-0.5 leading-[1.65]">{spokenText}</div>
              </div>
            );
          }

          return (
            <p key={idx} className="text-[#292524] whitespace-pre-wrap leading-[1.65]">
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
      className={`rounded-2xl transition-all duration-200 overflow-hidden flex flex-col ${
        isExactDuplicate
          ? 'bg-[#FDF4F3]/50 border-2 border-[#D97A75]'
          : isSplitRecording
          ? 'bg-[#FEFBEB]/40 border-2 border-[#F7D147]'
          : 'bg-white border border-[#EAE6DF] shadow-2xs hover:border-[#D6CFC5]'
      }`}
    >
      {/* Split Recording Banner (Same name, different conversation turns -> Ask user to combine) */}
      {isSplitRecording && (
        <div className="bg-[#FEFBEB] border-b border-[#F7D147] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-sm">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-full bg-[#F7D147] text-[#292524] shrink-0 mt-0.5 sm:mt-0">
              <GitMerge className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[13px] tracking-wide px-2.5 py-0.5 rounded-full bg-[#F7D147] text-[#292524]">
                  Split Recording Detected
                </span>
                <span className="text-[#292524] font-semibold text-[15px]">
                  Same file name, but conversation content is different.
                </span>
              </div>
              <p className="text-[13px] text-[#57534E] mt-0.5">
                Audit checked first 3 dialogue lines against partner recording. Likely Part 1 &amp; Part 2 of same interview.
              </p>
            </div>
          </div>

          {onCombineSplit && (
            <button
              type="button"
              onClick={onCombineSplit}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#292524] hover:bg-[#3F3A38] text-white rounded-full text-[13px] sm:text-sm font-semibold transition-all shrink-0 cursor-pointer self-start sm:self-auto whitespace-nowrap"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Combine Recordings</span>
            </button>
          )}
        </div>
      )}

      {/* Exact Duplicate Banner (Identical conversation -> Redundant duplicate file) */}
      {isExactDuplicate && (
        <div className="bg-[#FDF4F3] border-b border-[#D97A75]/45 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-sm">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-full bg-[#F6BEBA] text-[#7A3A36] shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[13px] tracking-wide px-2.5 py-0.5 rounded-full bg-[#D97A75] text-white">
                  Duplicate Recording
                </span>
                <span className="text-[#7A3A36] font-semibold text-[15px]">
                  Exact duplicate file &amp; conversation of &ldquo;{auditInfo?.partnerFileName}&rdquo;.
                </span>
              </div>
              <p className="text-[13px] text-[#7A3A36]/85 mt-0.5">
                First 3 conversation lines are identical. Redundant file upload.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onDelete(record.id)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#D97A75] hover:bg-[#C66661] text-white rounded-full text-[13px] sm:text-sm font-semibold transition-all shrink-0 cursor-pointer self-start sm:self-auto whitespace-nowrap"
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
            ? 'bg-[#FDF4F3]/70 border-[#D97A75]/35'
            : isSplitRecording
            ? 'bg-[#FEFBEB]/60 border-[#F7D147]/50'
            : 'border-[#EAE6DF] bg-[#F7F5F0]/70'
        }`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              isExactDuplicate
                ? 'bg-[#FDF4F3] text-[#D97A75] border border-[#E89994]'
                : isSplitRecording
                ? 'bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147]'
                : isAudio
                ? 'bg-[#E6F5F1] text-[#1E4D42] border border-[#96D6C7]'
                : 'bg-[#EEF4FB] text-[#234B78] border border-[#528BCA]/40'
            }`}
          >
            {isAudio ? <FileAudio className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base sm:text-lg font-bold text-[#292524] truncate tracking-[-0.02em]">
                {record.fileName}
              </h4>
              {isSplitRecording && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147]">
                  Split Part
                </span>
              )}
              {isExactDuplicate && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold bg-[#FDF4F3] text-[#7A3A36] border border-[#D97A75]/45">
                  Duplicate
                </span>
              )}
            </div>

            {/* Badges: Source & Uploaded Time */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[13px] text-[#78716C]">
              {record.source === 'google_drive' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-semibold bg-[#F2F7FC] text-[#234B78] border border-[#528BCA]/35">
                  <HardDrive className="w-3.5 h-3.5 text-[#528BCA]" /> Google Drive
                </span>
              )}
              {record.source === 'local_upload' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-semibold bg-white text-[#57534E] border border-[#EAE6DF]">
                  {isAudio ? 'MP3 Upload' : 'Document Upload'}
                </span>
              )}
              {record.source === 'pasted_text' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-semibold bg-[#F3F5FD] text-[#33418A] border border-[#7C8CE0]/40">
                  Pasted Notes
                </span>
              )}

              <span className="flex items-center gap-1 text-[#78716C]">
                <Clock className="w-3.5 h-3.5" />
                Attached {formatUploadTime(record.uploadedAt)}
              </span>

              {record.wordCount && (
                <span className="text-[#78716C] tabular-nums">· {record.wordCount} words</span>
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
                className="p-1.5 text-[#57534E] hover:text-[#292524] rounded-full hover:bg-white transition-colors cursor-pointer"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[#1E4D42]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                title="Download transcript as .txt"
                className="p-1.5 text-[#57534E] hover:text-[#292524] rounded-full hover:bg-white transition-colors cursor-pointer"
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
                  className="p-1.5 text-[#57534E] hover:text-[#292524] rounded-full hover:bg-white transition-colors cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => onExpand(record)}
                title="Expand full screen"
                className="p-1.5 text-[#57534E] hover:text-[#292524] rounded-full hover:bg-white transition-colors cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              {record.source === 'google_drive' && (
                <button
                  type="button"
                  onClick={() => onRetry(record)}
                  title="Re-transcribe with Multilingual Engine"
                  className="p-1.5 text-[#57534E] hover:text-[#528BCA] rounded-full hover:bg-[#F2F7FC] transition-colors cursor-pointer"
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
            className="p-1.5 text-[#78716C] hover:text-[#7A3A36] rounded-full hover:bg-[#FDF4F3] transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audio player if audio recording */}
      {record.audioUrl && (
        <div className="px-4 py-2.5 bg-[#F2F5F3]/80 border-b border-[#E2E6E4] flex items-center gap-3">
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
            className="w-8 h-8 rounded-full bg-[#528BCA] hover:bg-[#3F78B5] text-white flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-2xs"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>

          <div className="flex-1 flex items-center gap-2">
            <span className="text-[13px] font-mono text-[#57534E] min-w-[42px] tabular-nums">
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
              className="w-full h-1.5 bg-[#E2E6E4] rounded-full appearance-none cursor-pointer accent-[#528BCA]"
            />
            <span className="text-[13px] font-mono text-[#57534E] min-w-[42px] tabular-nums">
              {formatTime(audioDuration)}
            </span>
          </div>

          <Volume2 className="w-4 h-4 text-[#78716C] shrink-0" />
        </div>
      )}

      {/* Transcript Body / Status Area */}
      <div className="p-5 flex-1">
        {/* Inline Manual Transcript Editor */}
        {isEditing && (
          <div className="mb-4 p-4 rounded-2xl bg-[#F7F5F0] border border-[#EAE6DF] space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[13px] font-bold text-[#292524] uppercase tracking-wider flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-[#528BCA]" /> Edit / Replace Transcript Manually
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 text-[13px] font-semibold rounded-full bg-white border border-[#EAE6DF] text-[#292524] hover:bg-[#EEF4FB] hover:border-[#528BCA]/45 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Upload File (.txt)
              </button>
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={8}
              placeholder="Paste or type interview transcript here..."
              className="w-full p-3.5 text-base bg-white border border-[#EAE6DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 focus:border-[#528BCA] text-[#292524] leading-[1.65]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-1.5 text-sm font-semibold text-[#57534E] hover:bg-[#EAE6DF]/60 rounded-full cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white rounded-full cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Save Transcript
              </button>
            </div>
          </div>
        )}

        {record.status === 'transcribing' && !isEditing && (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#528BCA] mb-2.5" />
            <p className="text-lg font-semibold text-[#292524]">
              {record.fileType === 'audio' ? 'Transcribing interview recording...' : 'Importing text document...'}
            </p>
            <p className="text-base text-[#78716C] mt-1 leading-relaxed">
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
              className="mt-3 text-sm font-semibold text-[#528BCA] hover:underline cursor-pointer"
            >
              Or upload / paste transcript yourself
            </button>
          </div>
        )}

        {record.status === 'error' && !isEditing && (
          <div className="p-4 rounded-2xl bg-[#FDF4F3] border border-[#D97A75]/45 text-[#7A3A36] text-base space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-[#D97A75] shrink-0" />
              <span>
                {record.fileType === 'audio' ? 'Transcription failed:' : 'Text import failed:'}{' '}
                {record.errorMessage || (record.fileType === 'audio' ? 'Unable to transcribe audio recording.' : 'Unable to import this text document.')}
              </span>
            </div>
            <p className="text-[#57534E] text-[15px] leading-relaxed">
              {record.fileType === 'audio'
                ? 'If automatic transcription does not work for this recording, upload a transcript or type/paste it directly.'
                : 'The original text is imported directly. Retry the import or type/paste the content manually.'}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onRetry(record)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-full bg-[#D97A75] hover:bg-[#C66661] text-white cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" /> {record.fileType === 'audio' ? 'Retry Transcription' : 'Retry Import'}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-full bg-white border border-[#EAE6DF] text-[#292524] hover:bg-[#F7F5F0] cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#57534E]" /> Upload Transcript (.txt)
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditText(record.transcript || '');
                  setIsEditing(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-full bg-[#292524] hover:bg-[#3F3A38] text-white cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Type / Paste Manually
              </button>
            </div>
          </div>
        )}

        {record.status === 'completed' && record.transcript && !isEditing && (
          <div>
            {record.transcript.toLowerCase().includes('no audible speech') && (
              <div className="mb-3 p-4 rounded-2xl bg-[#FEFBEB] border border-[#F7D147] text-base text-[#6B5306] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <p className="font-semibold text-[#292524]">Multilingual audio notice</p>
                  <p className="text-[15px] text-[#57534E] mt-0.5 leading-relaxed">
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold rounded-full bg-white border border-[#EAE6DF] text-[#292524] hover:bg-[#F7F5F0] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Upload / Edit
                  </button>
                  {record.source === 'google_drive' && (
                    <button
                      type="button"
                      onClick={() => onRetry(record)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold rounded-full bg-[#292524] hover:bg-[#3F3A38] text-white shrink-0 cursor-pointer"
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
          <div className="py-8 text-center text-lg text-[#78716C] leading-relaxed">
            Waiting in queue...
          </div>
        )}
      </div>
    </article>
  );
};
