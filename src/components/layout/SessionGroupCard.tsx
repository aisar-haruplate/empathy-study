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
import { InterviewRecord, InterviewSession } from '../../types';
import { TranscriptCard } from './TranscriptCard';
import { RecordAuditInfo, SplitCandidatePair } from '../../lib/recordingAudit';
import { isAnalysisEligibleRecord } from '../../lib/recordEligibility';

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
        className={`rounded-3xl overflow-hidden transition-all shadow-studio ${
          session.isDuplicate
            ? 'bg-[#FDF4F3]/50 border-2 border-[#D97A75]'
            : 'bg-white border border-[#EAE6DF]'
        }`}
      >
        {/* Highlight Banner if Duplicate Session Detected */}
        {session.isDuplicate && (
          <div className="bg-[#D97A75] text-white px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[15px]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="p-1.5 rounded-full bg-white/20 shrink-0">
                <AlertTriangle className="w-4 h-4 text-white" />
              </span>
              <div className="min-w-0">
                <span className="font-bold tracking-wide text-[13px] bg-black/20 px-2.5 py-0.5 rounded-full mr-2">
                  Duplicate Session
                </span>
                <span className="text-white font-medium">
                  {session.duplicateReason || 'Identical date folder, location, or audio recordings detected.'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {session.duplicateFileNames && session.duplicateFileNames.length > 0 && onRemoveDuplicatesInSession && (
                <button
                  type="button"
                  onClick={() => onRemoveDuplicatesInSession(session)}
                  className="px-3.5 py-1.5 bg-white text-[#7A3A36] hover:bg-[#FDF4F3] rounded-full text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap"
                >
                  Remove Duplicate Files ({session.duplicateFileNames.length})
                </button>
              )}
              {onDeleteSession && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3.5 py-1.5 bg-[#292524] hover:bg-black text-white rounded-full text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap"
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
              ? 'bg-[#FDF4F3] border-[#D97A75]/40'
              : 'bg-[#F7F5F0] border-[#EAE6DF]'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                session.isDuplicate ? 'bg-[#D97A75] text-white' : 'bg-[#292524] text-white'
              }`}
            >
              <Folder className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-[#292524] tracking-[-0.02em]">
                  Interview Session: {session.folderName}
                </h3>
                {session.sessionDate && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-semibold border ${
                      session.isDuplicate
                        ? 'bg-[#F6BEBA] text-[#292524] border-[#D97A75]/45'
                        : 'bg-[#FEFBEB] text-[#6B5306] border-[#F7D147]'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {session.sessionDate}
                  </span>
                )}
                {session.isDuplicate && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold bg-[#D97A75] text-white tracking-wide">
                    <AlertCircle className="w-3.5 h-3.5" /> Duplicate
                  </span>
                )}
              </div>

              {/* Folder path and location */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[15px] text-[#57534E]">
                {session.folderPath && (
                  <span className="font-mono text-[13px] text-[#78716C]">
                    {session.folderPath}
                  </span>
                )}

                {session.sessionLocation && (
                  <span className="inline-flex items-center gap-1 text-[#292524] font-medium">
                    <MapPin className="w-4 h-4 text-[#D97A75] shrink-0" />
                    {session.sessionLocation}
                  </span>
                )}

                <span className="text-[#78716C] tabular-nums">
                  · {audioRecords.length} audio ({completedCount} transcribed)
                  {docRecords.length > 0 && ` · ${docRecords.length} docs`}
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
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] sm:text-sm font-semibold text-[#292524] bg-white hover:bg-[#EEF4FB] border border-[#EAE6DF] hover:border-[#528BCA]/45 rounded-full cursor-pointer transition-all whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-[#528BCA]" />
                <span>Upload to {session.folderName}</span>
              </button>
            )}

            {/* Remove whole interview session button */}
            {onDeleteSession && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                title={`Remove the whole interview session and all its ${session.records.length} recordings`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] sm:text-sm font-semibold text-[#7A3A36] bg-[#FDF4F3] hover:bg-[#F6BEBA]/70 border border-[#D97A75]/45 rounded-full cursor-pointer transition-all whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#D97A75]" />
                <span className="tabular-nums">Delete Session ({session.records.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 px-3.5 py-1.5 text-[13px] sm:text-sm font-semibold text-[#57534E] hover:text-[#292524] bg-white border border-[#EAE6DF] rounded-full transition-colors cursor-pointer whitespace-nowrap"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" /> Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" /> Expand ({session.records.length})
                </>
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Natural Language Meta Data Document Display if present in this session */}
            {session.metaDataRecord && (
              <div className="bg-[#F2F7FC] border border-[#528BCA]/35 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#528BCA] text-white flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-[#234B78] flex items-center gap-2 flex-wrap">
                        <span>{session.metaDataRecord.fileName}</span>
                        <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#234B78] border border-[#528BCA]/30">
                          Session Metadata
                        </span>
                      </h4>
                      <p className="text-[13px] text-[#528BCA]">
                        Natural language field recording context
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onExpandRecord(session.metaDataRecord!)}
                      title="Expand Meta Data"
                      className="p-1.5 text-[#528BCA] hover:bg-white rounded-full cursor-pointer transition-colors"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Natural language formatted metadata content */}
                <div className="bg-white rounded-xl p-4 border border-[#EAE6DF] text-base text-[#292524] whitespace-pre-wrap leading-[1.65]">
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
                <p className="text-base text-[#78716C] text-center py-5 leading-relaxed">
                  No interview records in this folder session yet.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Delete Whole Session Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-[#292524]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-studio border border-[#EAE6DF] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FDF4F3] border border-[#E89994] text-[#D97A75] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#292524]">
                  Delete Interview Session?
                </h3>
                <p className="text-base text-[#57534E] mt-1 leading-relaxed">
                  You are about to delete <span className="font-bold text-[#292524]">Interview Session: {session.folderName}</span>.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-[#78716C] hover:text-[#292524] p-1.5 rounded-full hover:bg-[#F7F5F0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#FDF4F3] border border-[#D97A75]/40 rounded-2xl p-3.5 text-[15px] text-[#7A3A36] space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-[#D97A75]" />
                This action will delete all {session.records.length} recording(s):
              </div>
              <ul className="list-disc list-inside text-[13px] text-[#7A3A36]/90 max-h-28 overflow-y-auto pl-1 space-y-0.5">
                {session.records.map((r) => (
                  <li key={r.id} className="truncate">
                    {r.fileName} {r.isMetaDataDoc ? '(Metadata Doc)' : ''}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm text-[#78716C] leading-relaxed">
              All transcriptions, cleaned text, and qualitative decodes associated with these recordings will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-semibold text-[#57534E] hover:bg-[#F7F5F0] rounded-full cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  if (onDeleteSession) onDeleteSession(session);
                }}
                className="px-4 py-2 text-sm font-semibold bg-[#D97A75] hover:bg-[#C66661] text-white rounded-full shadow-xs cursor-pointer transition-colors"
              >
                Delete Session &amp; {session.records.length} Recordings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
