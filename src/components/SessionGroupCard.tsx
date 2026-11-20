import React, { useState } from 'react';
import {
  Folder,
  Calendar,
  MapPin,
  ChevronDown,
  ChevronUp,
  FileText,
  FileAudio,
  CheckCircle2,
  HardDrive,
  Copy,
  Maximize2,
  Sparkles,
  Upload,
  Trash2,
  AlertTriangle,
  AlertCircle,
  X,
} from 'lucide-react';
import { InterviewRecord, InterviewSession } from '../types';
import { TranscriptCard } from './TranscriptCard';
import { RecordAuditInfo, SplitCandidatePair } from '../lib/recordingAudit';
import { isAnalysisEligibleRecord } from '../lib/recordEligibility';

interface SessionGroupCardProps {
  session: InterviewSession;
  allRecords?: InterviewRecord[];
  onDeleteRecord: (id: string) => void;
  onRetryRecord: (record: InterviewRecord) => void;
  onExpandRecord: (record: InterviewRecord) => void;
  onCleanRecord?: (record: InterviewRecord) => void;
  onUpdateRecord?: (record: InterviewRecord) => void;
  onUploadToSession?: (folderName: string, file: File) => void;
  onDeleteSession?: (session: InterviewSession) => void;
  onRemoveDuplicatesInSession?: (session: InterviewSession) => void;
  auditInfoByRecordId?: Map<string, RecordAuditInfo>;
  onOpenCombineModal?: (pair: SplitCandidatePair) => void;
}

export const SessionGroupCard: React.FC<SessionGroupCardProps> = ({
  session,
  allRecords = [],
  onDeleteRecord,
  onRetryRecord,
  onExpandRecord,
  onCleanRecord,
  onUpdateRecord,
  onUploadToSession,
  onDeleteSession,
  onRemoveDuplicatesInSession,
  auditInfoByRecordId,
  onOpenCombineModal,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const sessionFileInputRef = React.useRef<HTMLInputElement>(null);

  const audioRecords = session.records.filter((r) => r.fileType === 'audio');
  const docRecords = session.records.filter((r) => r.fileType === 'text');
  const completedCount = session.records.filter((r) => r.status === 'completed').length;

  return (
    <>
      <section
        className={`rounded-2xl overflow-hidden transition-all shadow-2xs ${
          session.isDuplicate
            ? 'bg-rose-50/30 border-2 border-rose-500 ring-2 ring-rose-500/20'
            : 'bg-white border border-stone-200'
        }`}
      >
        {/* Highlight Banner if Duplicate Session Detected */}
        {session.isDuplicate && (
          <div className="bg-rose-600 text-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1 rounded-md bg-white/20 shrink-0">
                <AlertTriangle className="w-4 h-4 text-white animate-pulse" />
              </span>
              <div className="min-w-0">
                <span className="font-bold tracking-wide uppercase text-[11px] bg-rose-800/80 px-2 py-0.5 rounded mr-2">
                  Duplicate Session
                </span>
                <span className="text-rose-100 font-medium">
                  {session.duplicateReason || 'Identical date folder, location, or audio recordings detected.'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {session.duplicateFileNames && session.duplicateFileNames.length > 0 && onRemoveDuplicatesInSession && (
                <button
                  type="button"
                  onClick={() => onRemoveDuplicatesInSession(session)}
                  className="px-2.5 py-1 bg-white text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Remove Duplicate Files ({session.duplicateFileNames.length})
                </button>
              )}
              {onDeleteSession && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-2.5 py-1 bg-rose-900/80 hover:bg-rose-950 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer border border-rose-400/40"
                >
                  Remove Entire Session
                </button>
              )}
            </div>
          </div>
        )}

        {/* Session Group Header */}
        <div
          className={`p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            session.isDuplicate
              ? 'bg-gradient-to-r from-rose-50 via-red-50/30 to-rose-50 border-rose-200'
              : 'bg-gradient-to-r from-stone-50 via-amber-50/30 to-stone-50 border-stone-200'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                session.isDuplicate ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
              }`}
            >
              <Folder className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-stone-900 tracking-tight">
                  Interview Session: {session.folderName}
                </h3>
                {session.sessionDate && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      session.isDuplicate
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}
                  >
                    <Calendar className="w-3 h-3 text-amber-700" />
                    {session.sessionDate}
                  </span>
                )}
                {session.isDuplicate && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-600 text-white tracking-wider">
                    <AlertCircle className="w-3 h-3" /> Duplicate
                  </span>
                )}
              </div>

              {/* Folder path and location */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-stone-500">
                {session.folderPath && (
                  <span className="font-mono text-[11px] text-stone-400">
                    {session.folderPath}
                  </span>
                )}

                {session.sessionLocation && (
                  <span className="inline-flex items-center gap-1 text-stone-700 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    {session.sessionLocation}
                  </span>
                )}

                <span className="text-stone-400">
                  • {audioRecords.length} audio ({completedCount} transcribed)
                  {docRecords.length > 0 && ` • ${docRecords.length} docs`}
                </span>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
            <input
              ref={sessionFileInputRef}
              type="file"
              multiple
              accept="audio/*,.mp3,.wav,.m4a,.txt,.docx,.md"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && onUploadToSession) {
                  Array.from(e.target.files).forEach((file) => {
                    onUploadToSession(session.folderName, file);
                  });
                }
              }}
            />

            {onUploadToSession && (
              <button
                type="button"
                onClick={() => sessionFileInputRef.current?.click()}
                title={`Upload audio or text directly into ${session.folderName}`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg shadow-2xs cursor-pointer transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-amber-600" />
                <span>Upload to {session.folderName}</span>
              </button>
            )}

            {/* Remove whole interview session button */}
            {onDeleteSession && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                title={`Remove the whole interview session and all its ${session.records.length} recordings`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 rounded-lg shadow-2xs cursor-pointer transition-all"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Delete Session ({session.records.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Expand ({session.records.length})
                </>
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Natural Language Meta Data Document Display if present in this session */}
            {session.metaDataRecord && (
              <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-stone-50 border border-blue-200/80 rounded-xl p-4 shadow-2xs">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                        <span>{session.metaDataRecord.fileName}</span>
                        <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                          Session Metadata
                        </span>
                      </h4>
                      <p className="text-[11px] text-blue-700/80">
                        Natural language field recording context
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onExpandRecord(session.metaDataRecord!)}
                      title="Expand Meta Data"
                      className="p-1 text-blue-600 hover:bg-blue-100/60 rounded cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Natural language formatted metadata content */}
                <div className="bg-white/80 rounded-lg p-3 border border-blue-100/80 text-xs text-stone-800 font-mono whitespace-pre-wrap leading-relaxed">
                  {session.metaDataRecord.sessionMetadataText ||
                    session.metaDataRecord.transcript ||
                    session.metaDataContent ||
                    'No metadata text content available.'}
                </div>
              </div>
            )}

            {/* List of Interview Recordings in this Date Session */}
            <div className="space-y-4">
              {session.records
                .filter(isAnalysisEligibleRecord)
                .map((record) => {
                  const audit = auditInfoByRecordId?.get(record.id);
                  const partnerRecord = audit?.partnerRecordId
                    ? allRecords.find((r) => r.id === audit.partnerRecordId) ||
                      session.records.find((r) => r.id === audit.partnerRecordId)
                    : undefined;

                  return (
                    <TranscriptCard
                      key={record.id}
                      record={record}
                      onDelete={onDeleteRecord}
                      onRetry={onRetryRecord}
                      onExpand={onExpandRecord}
                      onUpdate={onUpdateRecord}
                      auditInfo={audit}
                      onCombineSplit={() => {
                        if (onOpenCombineModal && partnerRecord && audit) {
                          const recA = record.uploadedAt <= partnerRecord.uploadedAt ? record : partnerRecord;
                          const recB = record.uploadedAt <= partnerRecord.uploadedAt ? partnerRecord : record;
                          onOpenCombineModal({
                            recordA: recA,
                            recordB: recB,
                            fileName: recA.fileName,
                            first3A: audit.first3Current,
                            first3B: audit.first3Partner,
                            isExactDuplicate: audit.duplicateType === 'exact_duplicate',
                            isSplitRecording: audit.duplicateType === 'split_recording',
                            reason: audit.reason,
                          });
                        }
                      }}
                    />
                  );
                })}

              {session.records.filter(isAnalysisEligibleRecord).length === 0 && (
                <p className="text-xs text-stone-400 text-center py-4">
                  No interview records in this folder session.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Delete Whole Session Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-stone-900">
                  Delete Interview Session?
                </h3>
                <p className="text-xs text-stone-500 mt-1">
                  You are about to delete <span className="font-bold text-stone-800">Interview Session: {session.folderName}</span>.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                This action will delete all {session.records.length} recording(s):
              </div>
              <ul className="list-disc list-inside text-[11px] text-rose-700 max-h-28 overflow-y-auto pl-1">
                {session.records.map((r) => (
                  <li key={r.id} className="truncate">
                    {r.fileName} {r.isMetaDataDoc ? '(Metadata Doc)' : ''}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[11px] text-stone-500">
              All transcriptions, cleaned text, and qualitative decodes associated with these recordings will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  if (onDeleteSession) onDeleteSession(session);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                Delete Session & {session.records.length} Recordings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
