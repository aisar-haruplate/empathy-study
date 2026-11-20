import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Header } from './components/Header';
import { PipelineNav } from './components/PipelineNav';
import { InputSection } from './components/InputSection';
import { SortBar } from './components/SortBar';
import { TranscriptCard } from './components/TranscriptCard';
import { SessionGroupCard } from './components/SessionGroupCard';
import { Module2DataCleaning } from './components/Module2DataCleaning';
import { Module3DecodeAnalysis } from './components/Module3DecodeAnalysis';
import { Module4CrossAnalysis } from './components/Module4CrossAnalysis';
import { DrivePickerModal } from './components/DrivePickerModal';
import { ExpandedTranscriptModal } from './components/ExpandedTranscriptModal';
import { UniversalUploadModal } from './components/UniversalUploadModal';
import { AiAnalysisAssistant } from './components/AiAnalysisAssistant';
import { CombineSplitModal } from './components/CombineSplitModal';
import { VersionControlModal } from './components/VersionControlModal';
import {
  InterviewRecord,
  SortMode,
  DriveFileItem,
  ActiveModule,
  InterviewSession,
  CrossAnalysisFormula,
  AiVersionHistoryItem,
} from './types';
import { initAuth, googleSignIn, logout, getAccessToken } from './lib/firebase';
import { downloadDriveFile, blobToBase64 } from './lib/drive';
import { performRecordingAudit, SplitCandidatePair } from './lib/recordingAudit';
import {
  containsInterviewContent,
  isAnalysisEligibleRecord,
  isMetadataDocumentCandidate,
  parseSessionMetadata,
  splitSessionMetadataFromNotes,
} from './lib/recordEligibility';
import { isHumanVerifiedRecord } from './lib/adkotmCopilot';
import {
  Inbox,
  HeartHandshake,
  HardDrive,
  FolderTree,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Bot,
  AlertTriangle,
  AlertCircle,
  Trash2,
  GitMerge,
  ShieldCheck,
} from 'lucide-react';

export default function App() {
  const [isUniversalUploadOpen, setIsUniversalUploadOpen] = useState(false);
  const [splitModalPair, setSplitModalPair] = useState<SplitCandidatePair | null>(null);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [records, setRecords] = useState<InterviewRecord[]>(() => {
    try {
      const saved = localStorage.getItem('empathy_study_records');
      if (saved) {
        const parsed: InterviewRecord[] = JSON.parse(saved);
        // Exclude any legacy sample records
        return parsed.filter((r) => (r.source as string) !== 'sample');
      }
    } catch (e) {
      console.warn('Could not load cached records', e);
    }
    return [];
  });

  // Pipeline Module State
  const [activeModule, setActiveModule] = useState<ActiveModule>('module1_transcript');

  // Hierarchy & Sorting State
  const [groupByFolder, setGroupByFolder] = useState<boolean>(true);
  const [sortMode, setSortMode] = useState<SortMode>('date_desc'); // Default: date latest at front
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'audio' | 'text'>('all');

  // Google Auth & Drive State
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Expanded Modal
  const [expandedRecord, setExpandedRecord] = useState<InterviewRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // In-App AI Assistant & Version Control State
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [aiVersionHistory, setAiVersionHistory] = useState<AiVersionHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('empathy_ai_version_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load AI version history', e);
    }
    return [];
  });

  // Persist version history
  useEffect(() => {
    try {
      localStorage.setItem('empathy_ai_version_history', JSON.stringify(aiVersionHistory));
    } catch (e) {
      console.warn('Could not save AI version history', e);
    }
  }, [aiVersionHistory]);

  const handleAddFormulaFromAi = (formula: CrossAnalysisFormula) => {
    try {
      const saved = localStorage.getItem('empathy_cross_analysis_formulas');
      let current: CrossAnalysisFormula[] = saved ? JSON.parse(saved) : [];
      if (!current.some((f) => f.id === formula.id)) {
        current = [...current, formula];
        localStorage.setItem('empathy_cross_analysis_formulas', JSON.stringify(current));
        window.dispatchEvent(new Event('empathy_formulas_updated'));
      }

      // Record in version history
      const versionItem: AiVersionHistoryItem = {
        id: 'ver_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        timestamp: Date.now(),
        actionType: 'add_formula',
        targetId: formula.id,
        title: formula.name,
        description: `${formula.description} (${formula.code} | ${formula.analysisCodes})`,
        snapshot: formula,
        reverted: false,
      };

      setAiVersionHistory((prev) => [versionItem, ...prev.filter((v) => v.targetId !== formula.id)]);
    } catch (e) {
      console.warn('Failed to save AI formula to localStorage', e);
    }
  };

  const handleRevertAiAction = (versionId: string) => {
    setAiVersionHistory((prev) =>
      prev.map((v) => {
        if (v.id === versionId) {
          if (v.targetId) {
            try {
              const saved = localStorage.getItem('empathy_cross_analysis_formulas');
              if (saved) {
                const current: CrossAnalysisFormula[] = JSON.parse(saved);
                const updated = current.filter((f) => f.id !== v.targetId);
                localStorage.setItem('empathy_cross_analysis_formulas', JSON.stringify(updated));
                window.dispatchEvent(new Event('empathy_formulas_updated'));
              }
            } catch (e) {
              console.warn('Failed to remove formula on revert', e);
            }
          }
          return { ...v, reverted: true, revertedAt: Date.now() };
        }
        return v;
      })
    );
  };

  const handleRevertFormulaById = (formulaId: string) => {
    try {
      const saved = localStorage.getItem('empathy_cross_analysis_formulas');
      if (saved) {
        const current: CrossAnalysisFormula[] = JSON.parse(saved);
        const updated = current.filter((f) => f.id !== formulaId);
        localStorage.setItem('empathy_cross_analysis_formulas', JSON.stringify(updated));
        window.dispatchEvent(new Event('empathy_formulas_updated'));
      }
    } catch (e) {
      console.warn('Failed to remove formula on revert', e);
    }

    setAiVersionHistory((prev) =>
      prev.map((v) =>
        v.targetId === formulaId ? { ...v, reverted: true, revertedAt: Date.now() } : v
      )
    );
  };

  // Sync to local storage
  useEffect(() => {
    try {
      // Exclude audio blob URLs since they can't be serialized
      const serializable = records.map((r) => {
        if (r.audioUrl?.startsWith('blob:')) {
          return { ...r, audioUrl: undefined };
        }
        return r;
      });
      localStorage.setItem('empathy_study_records', JSON.stringify(serializable));
    } catch (err) {
      console.warn('Failed to save to localStorage', err);
    }
  }, [records]);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setIsDriveModalOpen(true);
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      const code = err?.code ? ` (${err.code})` : '';
      setAuthError(err?.message ? `Google sign-in failed${code}: ${err.message}` : 'Google sign-in failed. Please allow popups and try again.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
  };

  const handleOpenGoogleDrive = () => {
    if (!accessToken) {
      handleConnectGoogle();
    } else {
      setIsDriveModalOpen(true);
    }
  };

  // Helper to calculate word count
  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  /**
   * Safe JSON POST helper that gracefully handles HTML gateway timeouts (504, 502)
   * and prevents "Unexpected token <" syntax errors
   */
  const safePostJson = async <T = any>(url: string, payload: any): Promise<T> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!res.ok) {
      if (isJson) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error (HTTP ${res.status})`);
      } else {
        const rawText = await res.text().catch(() => '');
        if (res.status === 504 || rawText.includes('504 Gateway')) {
          throw new Error('Transcription server busy or timed out. Please retry this recording.');
        }
        if (res.status === 502 || rawText.includes('502 Bad Gateway')) {
          throw new Error('Transcription service temporarily unavailable. Please retry.');
        }
        if (res.status === 413 || rawText.includes('Payload Too Large')) {
          throw new Error('Audio file exceeds server upload size limit.');
        }
        throw new Error(`Server returned status ${res.status}. Please retry.`);
      }
    }

    if (!isJson) {
      const rawText = await res.text().catch(() => '');
      const trimmed = rawText.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return JSON.parse(trimmed) as T;
        } catch {
          // Fall through to structured error
        }
      }
      if (trimmed.startsWith('<')) {
        console.warn(`[safePostJson] HTML response (HTTP ${res.status}) from ${url}:`, trimmed.substring(0, 120));
        throw new Error('Server request timed out or returned a gateway page. Please retry.');
      }
      console.warn(`[safePostJson] Non-JSON ${res.status} response from ${url}:`, rawText.substring(0, 80));
      throw new Error('Unexpected response format from server. Please retry.');
    }

    return await res.json();
  };

  const confirmSessionMetadata = (fileName: string, text: string): boolean => {
    if (!isMetadataDocumentCandidate(fileName, text)) return false;
    return window.confirm(
      `"${fileName}" includes session-level metadata. Split those details from any participant interview sections? Interview content will remain available for analysis, and the original filename will not change.`
    );
  };

  // 1. Handle Audio Upload (MP3 / WAV / M4A)
  const handleAudioUpload = async (file: File, customFolderName?: string) => {
    const audioUrl = URL.createObjectURL(file);
    const newRecordId = 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    let detectedMime = file.type || 'audio/mp3';
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.m4a')) detectedMime = 'audio/mp4';
    else if (lower.endsWith('.wav')) detectedMime = 'audio/wav';

    // Infer date folder if present in file name (e.g. "Brem Mall Kepong 10/26.m4a" -> "10/26")
    const dateMatch = file.name.match(/(\d{1,2}[\/\-]\d{1,2})/);
    const folderName = customFolderName || (dateMatch ? dateMatch[1].replace('-', '/') : 'Direct Uploads');

    const newRecord: InterviewRecord = {
      id: newRecordId,
      fileName: file.name,
      fileType: 'audio',
      mimeType: detectedMime,
      source: 'local_upload',
      uploadedAt: Date.now(), // latest at front
      fileSizeBytes: file.size,
      audioUrl,
      folderName,
      folderPath: `Recording / ${folderName}`,
      status: 'transcribing',
    };

    setRecords((prev) => [newRecord, ...prev]);
    setIsProcessing(true);

    try {
      const base64Data = await blobToBase64(file);

      const data = await safePostJson<{ transcript: string }>('/api/transcribe/audio', {
        audioBase64: base64Data,
        mimeType: detectedMime,
        fileName: file.name,
      });

      setRecords((prev) =>
        prev.map((r) =>
          r.id === newRecordId
            ? {
                ...r,
                status: 'completed',
                transcript: data.transcript,
                wordCount: countWords(data.transcript),
              }
            : r
        )
      );
    } catch (err: any) {
      console.error('Failed to transcribe audio file:', err);
      setRecords((prev) =>
        prev.map((r) =>
          r.id === newRecordId
            ? {
                ...r,
                status: 'error',
                errorMessage: err.message || 'Transcription failed',
              }
            : r
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Handle Text Doc Upload (.txt, .docx, .md)
  const handleTextDocUpload = async (file: File, customFolderName?: string) => {
    const newRecordId = 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const folderName = customFolderName || 'Direct Uploads';

    const newRecord: InterviewRecord = {
      id: newRecordId,
      fileName: file.name,
      fileType: 'text',
      mimeType: file.type || 'text/plain',
      source: 'local_upload',
      uploadedAt: Date.now(),
      fileSizeBytes: file.size,
      folderName,
      folderPath: `Recording / ${folderName}`,
      isMetaDataDoc: false,
      status: 'transcribing',
    };

    setRecords((prev) => [newRecord, ...prev]);
    setIsProcessing(true);

    try {
      const textContent = await file.text();
      const metadataConfirmed = confirmSessionMetadata(file.name, textContent);
      const splitContent = metadataConfirmed
        ? splitSessionMetadataFromNotes(textContent)
        : { metadataText: '', interviewText: '' };
      const isMetadataOnly = metadataConfirmed && !splitContent.interviewText;
      const transcript = metadataConfirmed && splitContent.interviewText
        ? splitContent.interviewText
        : textContent;
      const sessionMetadataText = metadataConfirmed && splitContent.interviewText
        ? splitContent.metadataText
        : undefined;
      const { date, location } = metadataConfirmed
        ? parseSessionMetadata(splitContent.metadataText)
        : { date: '', location: '' };

      setRecords((prev) =>
        prev.map((r) => {
          if (r.id === newRecordId) {
            return {
              ...r,
              isMetaDataDoc: isMetadataOnly,
              sessionMetadataText,
              status: 'completed',
              transcript,
              wordCount: countWords(transcript),
              sessionDate: date || r.sessionDate,
              sessionLocation: location || r.sessionLocation,
            };
          }
          if (metadataConfirmed && r.folderPath === newRecord.folderPath) {
            return {
              ...r,
              sessionDate: r.sessionDate || date || undefined,
              sessionLocation: r.sessionLocation || location || undefined,
            };
          }
          return r;
        })
      );
    } catch (err: any) {
      console.error('Failed to process text document:', err);
      setRecords((prev) =>
        prev.map((r) =>
          r.id === newRecordId
            ? {
                ...r,
                status: 'error',
                errorMessage: err.message || 'Processing failed',
              }
            : r
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Handle Batch Google Drive Files Selected (Captures Folder Hierarchy & Meta Data)
  const handleBatchDriveImport = async (
    selectedFiles: DriveFileItem[],
    targetFolderName = 'Recording',
    targetFolderPath = 'Recording'
  ) => {
    const currentToken = accessToken || (await getAccessToken());
    if (!currentToken) {
      handleConnectGoogle();
      return;
    }

    if (selectedFiles.length === 0) return;

    // Create record entries for all selected files immediately
    const now = Date.now();
    const newRecords: InterviewRecord[] = selectedFiles.map((file, idx) => {
      const isAudio =
        file.mimeType.includes('audio') ||
        file.name.toLowerCase().endsWith('.mp3') ||
        file.name.toLowerCase().endsWith('.wav') ||
        file.name.toLowerCase().endsWith('.m4a');

      return {
        id: 'rec_gdrive_' + now + '_' + idx,
        fileName: file.name,
        fileType: isAudio ? 'audio' : 'text',
        mimeType: file.mimeType,
        source: 'google_drive',
        uploadedAt: now + idx, // latest at front
        driveFileId: file.id,
        driveIconLink: file.iconLink,
        folderName: file.targetFolderName || targetFolderName,
        folderPath: file.targetFolderPath || targetFolderPath,
        isMetaDataDoc: false,
        status: 'transcribing',
      };
    });

    setRecords((prev) => [...newRecords, ...prev]);
    setIsProcessing(true);

    // Process files sequentially with defensive error isolation
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const recordId = newRecords[i].id;

      try {
        const downloaded = await downloadDriveFile(file, currentToken);

        if (downloaded.fileType === 'audio' && downloaded.audioBase64) {
          if (downloaded.blob) {
            const audioUrl = URL.createObjectURL(downloaded.blob);
            setRecords((prev) =>
              prev.map((r) => (r.id === recordId ? { ...r, audioUrl } : r))
            );
          }

          const data = await safePostJson<{ transcript: string }>('/api/transcribe/audio', {
            audioBase64: downloaded.audioBase64,
            mimeType: downloaded.mimeType,
            fileName: file.name,
          });

          setRecords((prev) =>
            prev.map((r) =>
              r.id === recordId
                ? {
                    ...r,
                    status: 'completed',
                    transcript: data.transcript,
                    wordCount: countWords(data.transcript),
                  }
                : r
            )
          );
        } else if (downloaded.text) {
          const metadataConfirmed = confirmSessionMetadata(file.name, downloaded.text);
          const splitContent = metadataConfirmed
            ? splitSessionMetadataFromNotes(downloaded.text)
            : { metadataText: '', interviewText: '' };
          const isMetadataOnly = metadataConfirmed && !splitContent.interviewText;
          const textTranscript = metadataConfirmed && splitContent.interviewText
            ? splitContent.interviewText
            : downloaded.text;
          const sessionMetadataText = metadataConfirmed && splitContent.interviewText
            ? splitContent.metadataText
            : undefined;
          const { date, location } = metadataConfirmed
            ? parseSessionMetadata(splitContent.metadataText)
            : { date: '', location: '' };

          setRecords((prev) =>
            prev.map((r) => {
              if (r.id === recordId) {
                return {
                  ...r,
                  isMetaDataDoc: isMetadataOnly,
                  sessionMetadataText,
                  status: 'completed',
                  transcript: textTranscript,
                  wordCount: countWords(textTranscript),
                  sessionDate: date || r.sessionDate,
                  sessionLocation: location || r.sessionLocation,
                };
              }
              if (metadataConfirmed && r.folderPath === newRecords[i].folderPath) {
                return {
                  ...r,
                  sessionDate: r.sessionDate || date || undefined,
                  sessionLocation: r.sessionLocation || location || undefined,
                };
              }
              return r;
            })
          );

        }
      } catch (err: any) {
        console.error(`Failed to transcribe ${file.name}:`, err);
        setRecords((prev) =>
          prev.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  status: 'error',
                  errorMessage: err.message || 'Failed to import from Google Drive',
                }
              : r
          )
        );
      }
    }

    setIsProcessing(false);
  };

  // 4. Handle Pasted Text Notes
  const handlePastedTextSubmit = async (text: string, title?: string) => {
    const finalTitle = title || `Interview Notes - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.txt`;
    const newRecordId = 'rec_paste_' + Date.now();

    const newRecord: InterviewRecord = {
      id: newRecordId,
      fileName: finalTitle,
      fileType: 'text',
      mimeType: 'text/plain',
      source: 'pasted_text',
      uploadedAt: Date.now(),
      folderName: 'Direct Notes',
      folderPath: 'Manual Entry / Direct Notes',
      status: 'completed',
      transcript: text,
      wordCount: countWords(text),
    };

    setRecords((prev) => [newRecord, ...prev]);
  };

  // Delete record
  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  // Update a single record (e.g. from Module 2 data cleaning or Module 3 decode)
  const handleUpdateRecord = (updated: InterviewRecord) => {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  // Batch update records (e.g. after Module 3 batch decode)
  const handleBatchUpdateRecords = (updatedList: InterviewRecord[]) => {
    const map = new Map(updatedList.map((r) => [r.id, r]));
    setRecords((prev) => prev.map((r) => map.get(r.id) || r));
  };

  // Add a newly created or uploaded record
  const handleAddRecord = (newRecord: InterviewRecord) => {
    setRecords((prev) => [newRecord, ...prev]);
  };

  // Upload a file directly into a specific session folder
  const handleUploadToSession = async (folderName: string, file: File) => {
    const isAudio =
      file.type.startsWith('audio/') ||
      file.name.toLowerCase().endsWith('.mp3') ||
      file.name.toLowerCase().endsWith('.wav') ||
      file.name.toLowerCase().endsWith('.m4a') ||
      file.name.toLowerCase().endsWith('.webm');

    if (isAudio) {
      await handleAudioUpload(file, folderName);
    } else {
      await handleTextDocUpload(file, folderName);
    }
  };

  // Retry transcription
  const handleRetryRecord = async (record: InterviewRecord) => {
    if (record.source === 'pasted_text' && record.transcript) {
      handlePastedTextSubmit(record.transcript, record.fileName);
      return;
    }
    if (record.source === 'google_drive' && record.driveFileId) {
      const driveFileItem: DriveFileItem = {
        id: record.driveFileId,
        name: record.fileName,
        mimeType: record.mimeType,
        modifiedTime: new Date(record.uploadedAt).toISOString(),
      };
      // Delete old record and re-import freshly
      handleDeleteRecord(record.id);
      handleBatchDriveImport([driveFileItem], record.folderName, record.folderPath);
    }
  };

  // Remove whole interview session and all its recordings
  const handleDeleteSession = (session: InterviewSession) => {
    const idsToDelete = new Set(session.records.map((r) => r.id));
    setRecords((prev) => prev.filter((r) => !idsToDelete.has(r.id)));
  };

  // Grouping into Sessions (Folder Hierarchy) with Duplicate Detection
  const sessions = useMemo((): InterviewSession[] => {
    const sessionMap = new Map<string, { folderKey: string; folderPath: string; records: InterviewRecord[] }>();

    records.forEach((r) => {
      let folderKey = r.folderName ? r.folderName.trim() : 'General Recordings';
      if (!r.folderName) {
        const dateMatch = r.fileName.match(/(\d{1,2}[\/\-]\d{1,2})/);
        if (dateMatch) {
          folderKey = dateMatch[1].replace('-', '/');
        }
      }

      // Group key: preserve distinct folder paths if separate imports/folders exist
      const sessionGroupKey = r.folderPath ? r.folderPath.trim() : `Recording / ${folderKey}`;

      if (!sessionMap.has(sessionGroupKey)) {
        sessionMap.set(sessionGroupKey, {
          folderKey,
          folderPath: sessionGroupKey,
          records: [],
        });
      }
      sessionMap.get(sessionGroupKey)!.records.push(r);
    });

    const result: InterviewSession[] = [];

    sessionMap.forEach(({ folderKey, folderPath, records: sessionRecords }, sessionKey) => {
      // Find Meta Data document in this session
      const metaRecord = sessionRecords.find(
        (r) => Boolean(r.sessionMetadataText) || (r.isMetaDataDoc && !containsInterviewContent(r.transcript))
      );

      let sessionDate = folderKey;
      let sessionLocation = '';
      let metaDataContent = '';

      const sessionMetadataText = metaRecord?.sessionMetadataText || metaRecord?.transcript;
      if (metaRecord && sessionMetadataText) {
        metaDataContent = sessionMetadataText;
        const { date, location } = parseSessionMetadata(sessionMetadataText);
        if (date) sessionDate = date;
        if (location) sessionLocation = location;
      } else {
        if (/^\d{1,2}\/\d{1,2}$/.test(folderKey)) {
          const [m, d] = folderKey.split('/');
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const mIdx = parseInt(m, 10) - 1;
          if (mIdx >= 0 && mIdx < 12) {
            sessionDate = `${d} ${months[mIdx]} 2026 (${folderKey})`;
          }
        }
      }

      const latestUpload = Math.max(...sessionRecords.map((r) => r.uploadedAt));

      // Check intra-session duplicate files (same file name in the same session)
      const fileNameCounts = new Map<string, number>();
      sessionRecords.forEach((r) => {
        const cleanName = r.fileName.trim().toLowerCase();
        fileNameCounts.set(cleanName, (fileNameCounts.get(cleanName) || 0) + 1);
      });
      const intraDuplicateFiles: string[] = [];
      fileNameCounts.forEach((count, name) => {
        if (count > 1) {
          const original = sessionRecords.find((r) => r.fileName.trim().toLowerCase() === name)?.fileName || name;
          intraDuplicateFiles.push(`${original} (${count}x)`);
        }
      });

      result.push({
        id: 'session_' + sessionKey.replace(/[^a-zA-Z0-9_-]/g, '_'),
        folderName: folderKey,
        folderPath,
        sessionDate,
        sessionLocation,
        metaDataRecord: metaRecord,
        records: sessionRecords,
        latestUploadTime: latestUpload,
        duplicateFileNames: intraDuplicateFiles,
        isDuplicate: intraDuplicateFiles.length > 0,
        duplicateReason:
          intraDuplicateFiles.length > 0
            ? `Contains ${intraDuplicateFiles.length} duplicate file(s): ${intraDuplicateFiles.slice(0, 2).join(', ')}${intraDuplicateFiles.length > 2 ? '...' : ''}`
            : undefined,
      });
    });

    // Cross-session duplicate detection:
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const s1 = result[i];
        const s2 = result[j];

        const sameName = s1.folderName.trim().toLowerCase() === s2.folderName.trim().toLowerCase();
        const sameDate =
          s1.sessionDate &&
          s2.sessionDate &&
          s1.sessionDate.length > 2 &&
          s1.sessionDate.trim().toLowerCase() === s2.sessionDate.trim().toLowerCase();

        // Check shared audio file names
        const s1Files = new Set(s1.records.filter((r) => !r.isMetaDataDoc).map((r) => r.fileName.trim().toLowerCase()));
        const sharedFiles = s2.records.filter((r) => !r.isMetaDataDoc && s1Files.has(r.fileName.trim().toLowerCase())).map((r) => r.fileName);

        if (sameName || sameDate || sharedFiles.length > 0) {
          s1.isDuplicate = true;
          s2.isDuplicate = true;

          const conflictDetails = sameName
            ? `Identical session folder "${s1.folderName}"`
            : sharedFiles.length > 0
            ? `Shares ${sharedFiles.length} audio file(s) with session ${s1.folderName === s2.folderName ? s1.folderPath : s2.folderName}`
            : `Identical date "${s1.sessionDate}"`;

          s1.duplicateReason = s1.duplicateReason
            ? `${s1.duplicateReason}; ${conflictDetails}`
            : `Duplicate session detected: ${conflictDetails}`;
          s2.duplicateReason = s2.duplicateReason
            ? `${s2.duplicateReason}; ${conflictDetails}`
            : `Duplicate session detected: ${conflictDetails}`;

          s1.duplicateSessionIds = [...(s1.duplicateSessionIds || []), s2.id];
          s2.duplicateSessionIds = [...(s2.duplicateSessionIds || []), s1.id];
        }
      }
    }

    // Sort sessions according to sortMode
    return result.sort((a, b) => {
      if (sortMode === 'date_desc' || sortMode === 'upload_desc') {
        return b.latestUploadTime - a.latestUploadTime;
      }
      if (sortMode === 'date_asc' || sortMode === 'upload_asc') {
        return a.latestUploadTime - b.latestUploadTime;
      }
      if (sortMode === 'name_asc') {
        return a.folderName.localeCompare(b.folderName, undefined, { numeric: true });
      }
      if (sortMode === 'name_desc') {
        return b.folderName.localeCompare(a.folderName, undefined, { numeric: true });
      }
      return b.latestUploadTime - a.latestUploadTime;
    });
  }, [records, sortMode]);

  const duplicateSessions = useMemo(() => sessions.filter((s) => s.isDuplicate), [sessions]);

  // Project-wide Recording Audit (compares first 3 conversation turns of duplicate filenames)
  const recordingAudit = useMemo(() => {
    return performRecordingAudit(records);
  }, [records]);

  // Combine split recordings into 1 continuous interview transcript
  const handleCombineSplitRecordings = (recA: InterviewRecord, recB: InterviewRecord) => {
    const textA = recA.transcript?.trim() || '';
    const textB = recB.transcript?.trim() || '';
    const combinedTranscript =
      textA && textB
        ? `${textA}\n\n--- [Part 2: Continued Recording] ---\n\n${textB}`
        : textA || textB;
    const words = combinedTranscript.split(/\s+/).filter(Boolean).length;

    const mergedQuotes = [
      ...(recA.adkotmDecode?.evidenceQuotes || []),
      ...(recB.adkotmDecode?.evidenceQuotes || []),
    ];

    const updatedA: InterviewRecord = {
      ...recA,
      transcript: combinedTranscript,
      wordCount: words,
      status: 'completed',
      adkotmDecode: recA.adkotmDecode
        ? {
            ...recA.adkotmDecode,
            evidenceQuotes: mergedQuotes,
          }
        : recB.adkotmDecode,
    };

    setRecords((prev) =>
      prev.map((r) => (r.id === recA.id ? updatedA : r)).filter((r) => r.id !== recB.id)
    );
  };

  // Keep separate & auto-rename to Part 1 and Part 2
  const handleRenameSplitRecordings = (recA: InterviewRecord, recB: InterviewRecord) => {
    const extMatchA = recA.fileName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatchA ? extMatchA[1] : 'm4a';
    const baseName = recA.fileName.replace(/\.[^/.]+$/, '').replace(/\s*\(Part\s*\d+\)$/i, '');

    const updatedA: InterviewRecord = {
      ...recA,
      fileName: `${baseName} (Part 1).${ext}`,
    };
    const updatedB: InterviewRecord = {
      ...recB,
      fileName: `${baseName} (Part 2).${ext}`,
    };

    setRecords((prev) =>
      prev.map((r) => {
        if (r.id === recA.id) return updatedA;
        if (r.id === recB.id) return updatedB;
        return r;
      })
    );
  };

  // Remove exact redundant duplicate recordings across the project
  const handleRemoveExactDuplicates = () => {
    const idsToRemove = recordingAudit.exactDuplicateRecordIds;
    if (idsToRemove.size === 0) return;
    if (confirm(`Remove ${idsToRemove.size} redundant exact duplicate recording(s)?`)) {
      setRecords((prev) => prev.filter((r) => !idsToRemove.has(r.id)));
    }
  };

  // Remove duplicate recordings within a specific session (handles split vs exact)
  const handleRemoveDuplicatesInSession = (session: InterviewSession) => {
    const sessionRecords = session.records.filter((r) => !r.isMetaDataDoc);

    // If any duplicate in this session is a split recording, prompt user to review & combine
    const splitPairsInSession = recordingAudit.splitRecordingPairs.filter(
      (p) =>
        sessionRecords.some((sr) => sr.id === p.recordA.id) &&
        sessionRecords.some((sr) => sr.id === p.recordB.id)
    );

    if (splitPairsInSession.length > 0) {
      setSplitModalPair(splitPairsInSession[0]);
      setIsSplitModalOpen(true);
      return;
    }

    // Otherwise remove exact duplicate copies
    const seen = new Set<string>();
    const idsToDelete = new Set<string>();
    const sorted = [...sessionRecords].sort((a, b) => a.uploadedAt - b.uploadedAt);
    sorted.forEach((r) => {
      const key = r.fileName.toLowerCase().trim();
      if (seen.has(key)) {
        idsToDelete.add(r.id);
      } else {
        seen.add(key);
      }
    });
    setRecords((prev) => prev.filter((r) => !idsToDelete.has(r.id)));
  };

  const handleRemoveAllDuplicateSessions = () => {
    const seenFilesGlobal = new Set<string>();
    const seenFolders = new Set<string>();
    const sortedSessions = [...sessions].sort(
      (a, b) => b.records.length - a.records.length || b.latestUploadTime - a.latestUploadTime
    );

    const allowedSessionIds = new Set<string>();
    sortedSessions.forEach((s) => {
      const nameKey = s.folderName.toLowerCase().trim();
      if (!seenFolders.has(nameKey)) {
        seenFolders.add(nameKey);
        allowedSessionIds.add(s.id);
      }
    });

    const finalRecordsToKeep: InterviewRecord[] = [];
    const sortedRecords = [...records].sort((a, b) => a.uploadedAt - b.uploadedAt);

    sortedRecords.forEach((r) => {
      const parentSession = sessions.find((s) => s.records.some((sr) => sr.id === r.id));
      if (!parentSession || !allowedSessionIds.has(parentSession.id)) {
        return; // drop duplicate session records
      }
      const fileKey = `${parentSession.folderName}_${r.fileName.toLowerCase().trim()}`;
      if (!seenFilesGlobal.has(fileKey)) {
        seenFilesGlobal.add(fileKey);
        finalRecordsToKeep.push(r);
      }
    });

    setRecords(finalRecordsToKeep);
  };

  // Filtered flat records for search or flat view
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        if (typeFilter === 'audio' && r.fileType !== 'audio') return false;
        if (typeFilter === 'text' && r.fileType !== 'text') return false;

        if (searchFilter.trim()) {
          const q = searchFilter.toLowerCase();
          const matchName = r.fileName.toLowerCase().includes(q);
          const matchTranscript = r.transcript?.toLowerCase().includes(q);
          const matchFolder = r.folderName?.toLowerCase().includes(q);
          return matchName || matchTranscript || matchFolder;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortMode) {
          case 'date_desc':
          case 'upload_desc':
            return b.uploadedAt - a.uploadedAt;
          case 'date_asc':
          case 'upload_asc':
            return a.uploadedAt - b.uploadedAt;
          case 'name_asc':
            return a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' });
          case 'name_desc':
            return b.fileName.localeCompare(a.fileName, undefined, { numeric: true, sensitivity: 'base' });
          default:
            return b.uploadedAt - a.uploadedAt;
        }
      });
  }, [records, sortMode, searchFilter, typeFilter]);

  // Completed counts for workflow navigation (excluding metadata doc from cleanable/decodable counts)
  const completedTranscriptCount = records.filter((r) => r.status === 'completed').length;
  const cleanableTotal = records.filter((r) => isAnalysisEligibleRecord(r) && r.status === 'completed').length;
  const cleanedCount = records.filter((r) => isAnalysisEligibleRecord(r) && !!r.cleanedTranscript).length;
  const decodableTotal = records.filter((r) => isAnalysisEligibleRecord(r) && (r.cleanedTranscript || r.transcript)).length;
  const decodedCount = records.filter(isHumanVerifiedRecord).length;
  const evaluatedCount = records.filter((r) => isHumanVerifiedRecord(r) && r.crossAnalysisEvaluations && Object.keys(r.crossAnalysisEvaluations).length > 0).length;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans selection:bg-amber-200 w-full max-w-full overflow-x-hidden">
      {/* Unified Space-Saving Top Navigation Bar */}
      <Header
        user={user}
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        isConnectingGoogle={isConnectingGoogle}
        onConnectGoogle={handleConnectGoogle}
        onLogout={handleLogout}
        onOpenDriveModal={handleOpenGoogleDrive}
        onOpenUniversalUpload={() => setIsUniversalUploadOpen(true)}
        recordCount={records.length}
        completedTranscriptCount={completedTranscriptCount}
        cleanedCount={cleanedCount}
        cleanableTotal={cleanableTotal}
        decodedCount={decodedCount}
        decodableTotal={decodableTotal}
        evaluatedCount={evaluatedCount}
        onOpenVersionHistory={() => setIsVersionModalOpen(true)}
        activeVersionCount={aiVersionHistory.filter((v) => !v.reverted).length}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
      />

      {/* Main App Container */}
      <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 pb-28 min-w-0 overflow-x-hidden">
        {/* MODULE 1: INTAKE & TRANSCRIPTION (Grouped by Folder Hierarchy) */}
        {activeModule === 'module1_transcript' && (
          <div className="space-y-6">
            {/* Module 1 Context Intro */}
            <div className="bg-gradient-to-r from-amber-50 via-orange-50/50 to-stone-50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-stone-900">
                        Step 1: Transcribe
                      </h2>
                      <span className="text-xs text-stone-500 font-medium">
                        ({completedTranscriptCount} of {records.length} transcribed)
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-1 max-w-2xl">
                      Import interview recordings and notes from Google Drive or local files, organized automatically by interview date.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    View:
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-stone-800 border border-stone-200 shadow-2xs">
                    {groupByFolder ? 'Date Folders' : 'All Files'}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 1 Completion Signal */}
            {records.length > 0 && completedTranscriptCount === records.length && !isProcessing && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                      <span>Step 1 Complete</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        All {completedTranscriptCount} Transcribed
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      All interview recordings are transcribed and organized. You are ready to clean and polish conversational text.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('module2_clean')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer transition-all shrink-0 hover:translate-x-0.5"
                >
                  <span>Proceed to Step 2: Clean Text</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Google Sign-In Error Banner */}
            {authError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start justify-between gap-3 text-xs text-rose-900">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthError(null)}
                  className="text-rose-700 hover:text-rose-900 font-semibold shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Input & Upload Section */}
            <InputSection
              onAudioUpload={handleAudioUpload}
              onTextDocUpload={handleTextDocUpload}
              onPastedTextSubmit={handlePastedTextSubmit}
              onOpenGoogleDrive={handleOpenGoogleDrive}
              onOpenUniversalUpload={() => setIsUniversalUploadOpen(true)}
              isProcessing={isProcessing}
              googleConnected={!!user}
            />

            {/* Sort & Filter Controls */}
            <SortBar
              totalCount={filteredRecords.length}
              sortMode={sortMode}
              onSortChange={setSortMode}
              searchFilter={searchFilter}
              onSearchChange={setSearchFilter}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              groupByFolder={groupByFolder}
              onToggleGroupByFolder={() => setGroupByFolder(!groupByFolder)}
            />

            {/* Top Duplicate Interview Session Reminder Banner */}
            {duplicateSessions.length > 0 && (
              <div className="bg-rose-50 border-2 border-rose-500 rounded-2xl p-4 sm:p-5 shadow-sm text-rose-950 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-rose-950">
                        Duplicate Interview Session Detected ({duplicateSessions.length} session{duplicateSessions.length > 1 ? 's' : ''} highlighted in red)
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 uppercase tracking-wide">
                        Action Required
                      </span>
                    </div>
                    <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                      Sessions <span className="font-bold underline">{duplicateSessions.map((s) => s.folderName).join(', ')}</span> share identical dates, folders, or duplicate audio files. Review highlighted cards below or clean up with one click.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRemoveAllDuplicateSessions}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove All Duplicates</span>
                  </button>
                </div>
              </div>
            )}

            {/* Split Recordings Detected Alert Banner */}
            {recordingAudit.splitRecordingPairs.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-500 rounded-2xl p-4 sm:p-5 shadow-sm text-amber-950 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <GitMerge className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-amber-950">
                        Split Recording Detected ({recordingAudit.splitRecordingPairs.length} pair{recordingAudit.splitRecordingPairs.length > 1 ? 's' : ''} found)
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase tracking-wide">
                        Same Name • Different Conversation
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      Files like <span className="font-bold underline">{recordingAudit.splitRecordingPairs.map((p) => p.fileName).slice(0, 3).join(', ')}</span> share the same name but have completely different opening dialogues (likely Part 1 &amp; Part 2 of the same interview). Combine them into a continuous transcript without losing either half!
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSplitModalPair(recordingAudit.splitRecordingPairs[0]);
                      setIsSplitModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>Review &amp; Combine Recordings</span>
                  </button>
                </div>
              </div>
            )}

            {/* Exact Duplicate Recordings Alert Banner */}
            {recordingAudit.exactDuplicateRecordIds.size > 0 && (
              <div className="bg-rose-50 border-2 border-rose-500 rounded-2xl p-4 sm:p-5 shadow-sm text-rose-950 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-rose-950">
                        Exact Duplicate Recordings Detected ({recordingAudit.exactDuplicateRecordIds.size} file{recordingAudit.exactDuplicateRecordIds.size > 1 ? 's' : ''} highlighted in red)
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 uppercase tracking-wide">
                        Identical Dialogue
                      </span>
                    </div>
                    <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                      Audit verified the first 3 conversation lines match existing files. You can safely remove redundant duplicates while keeping the original.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRemoveExactDuplicates}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete All Exact Duplicates ({recordingAudit.exactDuplicateRecordIds.size})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Transcript Results: Either Grouped by Date Folder or Flat List */}
            {records.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-2xs">
                <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
                  <Inbox className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-stone-800">
                  No interview recordings imported yet
                </h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  Browse Google Drive & Shared Drives to select your interview date folder (e.g. 10/26 with audio recordings & Meta Data document).
                </p>

                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleOpenGoogleDrive}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    Import from Google Drive / Shared Drives
                  </button>
                </div>
              </div>
            ) : groupByFolder && !searchFilter ? (
              /* Grouped by File Hierarchy / Date Folder */
              <div className="space-y-6">
                {sessions.map((session) => (
                  <SessionGroupCard
                    key={session.id}
                    session={session}
                    allRecords={records}
                    auditInfoByRecordId={recordingAudit.auditInfoByRecordId}
                    onOpenCombineModal={(pair) => {
                      setSplitModalPair(pair);
                      setIsSplitModalOpen(true);
                    }}
                    onDeleteRecord={handleDeleteRecord}
                    onRetryRecord={handleRetryRecord}
                    onExpandRecord={setExpandedRecord}
                    onCleanRecord={(rec) => {
                      setActiveModule('module2_clean');
                    }}
                    onUpdateRecord={handleUpdateRecord}
                    onUploadToSession={handleUploadToSession}
                    onDeleteSession={handleDeleteSession}
                    onRemoveDuplicatesInSession={handleRemoveDuplicatesInSession}
                  />
                ))}
              </div>
            ) : (
              /* Flat List View (or when searching) */
              <div className="grid grid-cols-1 gap-4">
                {filteredRecords.map((record) => {
                  const audit = recordingAudit.auditInfoByRecordId.get(record.id);
                  const partner = audit?.partnerRecordId
                    ? records.find((r) => r.id === audit.partnerRecordId)
                    : undefined;
                  return (
                    <TranscriptCard
                      key={record.id}
                      record={record}
                      onDelete={handleDeleteRecord}
                      onRetry={handleRetryRecord}
                      onExpand={setExpandedRecord}
                      onUpdate={handleUpdateRecord}
                      auditInfo={audit}
                      onCombineSplit={() => {
                        if (partner && audit) {
                          const recA = record.uploadedAt <= partner.uploadedAt ? record : partner;
                          const recB = record.uploadedAt <= partner.uploadedAt ? partner : record;
                          setSplitModalPair({
                            recordA: recA,
                            recordB: recB,
                            fileName: recA.fileName,
                            first3A: audit.first3Current,
                            first3B: audit.first3Partner,
                            isExactDuplicate: audit.duplicateType === 'exact_duplicate',
                            isSplitRecording: audit.duplicateType === 'split_recording',
                            reason: audit.reason,
                          });
                          setIsSplitModalOpen(true);
                        }
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODULE 2: DATA CLEANING, PREPROCESSING & TRANSFORMATION */}
        {activeModule === 'module2_clean' && (
          <Module2DataCleaning
            records={records}
            onUpdateRecord={handleUpdateRecord}
            safePostJson={safePostJson}
            onProceedToNext={() => setActiveModule('module3_decode')}
          />
        )}

        {/* MODULE 3: DECODE & DECODE ANALYSIS (ADKOTM & POST-ANALYSIS CODES) */}
        {activeModule === 'module3_decode' && (
          <Module3DecodeAnalysis
            records={records}
            onUpdateRecord={handleUpdateRecord}
            onBatchUpdateRecords={handleBatchUpdateRecords}
            onAddRecord={handleAddRecord}
            onDeleteRecord={handleDeleteRecord}
            safePostJson={safePostJson}
            onProceedToNext={() => setActiveModule('module4_cross')}
            onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
          />
        )}

        {/* MODULE 4: POST & CROSS ANALYSIS (SPENDING POWER = D + O + T + M) */}
        {activeModule === 'module4_cross' && (
          <Module4CrossAnalysis
            records={records}
            sessions={sessions}
            onUpdateRecord={handleUpdateRecord}
            onAddRecord={handleAddRecord}
            onDeleteRecord={handleDeleteRecord}
            safePostJson={safePostJson}
            onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
            onOpenVersionHistory={() => setIsVersionModalOpen(true)}
            onRevertFormula={handleRevertFormulaById}
          />
        )}
      </main>

      {/* In-App AI Assistant Drawer */}
      <AiAnalysisAssistant
        records={records}
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        safePostJson={safePostJson}
        onAddFormula={handleAddFormulaFromAi}
        onRevertFormula={handleRevertFormulaById}
        onOpenVersionHistory={() => setIsVersionModalOpen(true)}
        versionHistoryCount={aiVersionHistory.filter((v) => !v.reverted).length}
      />

      {/* AI Version Control & Revert History Modal */}
      <VersionControlModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        history={aiVersionHistory}
        onRevert={handleRevertAiAction}
      />

      {/* Google Drive File Picker Modal */}
      <DrivePickerModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        accessToken={accessToken}
        onImportFiles={handleBatchDriveImport}
        onConnectGoogle={handleConnectGoogle}
      />

      {/* Expanded Transcript Modal */}
      <ExpandedTranscriptModal
        record={expandedRecord}
        onClose={() => setExpandedRecord(null)}
      />

      {/* Universal Self-Entry / Upload Modal for any Module */}
      <UniversalUploadModal
        isOpen={isUniversalUploadOpen}
        onClose={() => setIsUniversalUploadOpen(false)}
        initialModule={activeModule}
        records={records}
        onAddRecord={handleAddRecord}
        onUpdateRecord={handleUpdateRecord}
      />

      {/* Combine Split Recordings Modal */}
      <CombineSplitModal
        isOpen={isSplitModalOpen}
        onClose={() => {
          setIsSplitModalOpen(false);
          setSplitModalPair(null);
        }}
        pair={splitModalPair}
        onCombine={handleCombineSplitRecordings}
        onRenameSeparate={handleRenameSplitRecordings}
      />
    </div>
  );
}
