import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Sparkles,
  PieChart,
  GitCompare,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  FolderOpen,
} from 'lucide-react';
import {
  ActiveModule,
  InterviewRecord,
  ADKOTMDecode,
  SpendingPowerAnalysis,
} from '../types';
import { countPreservedPronouns, countWords } from '../lib/textCleaning';

interface UniversalUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialModule?: ActiveModule;
  records: InterviewRecord[];
  onAddRecord: (record: InterviewRecord) => void;
  onUpdateRecord: (updated: InterviewRecord) => void;
}

export const UniversalUploadModal: React.FC<UniversalUploadModalProps> = ({
  isOpen,
  onClose,
  initialModule = 'module1_transcript',
  records,
  onAddRecord,
  onUpdateRecord,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveModule>(initialModule);

  // Sync initial module when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialModule);
    }
  }, [isOpen, initialModule]);

  // Tab 1 state: Manual Transcript
  const [m1FileName, setM1FileName] = useState('');
  const [m1FolderName, setM1FolderName] = useState('');
  const [m1Content, setM1Content] = useState('');

  // Tab 2 state: Cleaned Transcript
  const [m2RecordId, setM2RecordId] = useState<string>(records[0]?.id || '');
  const [m2CleanedText, setM2CleanedText] = useState('');

  // Tab 3 state: ADKOTM Decode
  const [m3RecordId, setM3RecordId] = useState<string>(records[0]?.id || '');
  const [m3FR, setM3FR] = useState('Mum');
  const [m3RL, setM3RL] = useState('');
  const [m3AW, setM3AW] = useState('');
  const [m3PP, setM3PP] = useState('');
  const [m3PP1, setM3PP1] = useState('');
  const [m3IL, setM3IL] = useState('');
  const [m3JsonText, setM3JsonText] = useState('');

  // Tab 4 state: Spending Power
  const [m4RecordId, setM4RecordId] = useState<string>(records[0]?.id || '');
  const [m4Tier, setM4Tier] = useState<'High' | 'Medium-High' | 'Medium' | 'Low' | 'null'>('Medium-High');
  const [m4Justification, setM4Justification] = useState('');

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Tab 1: Submit new transcript
  const handleSaveTranscript = () => {
    if (!m1Content.trim()) {
      setNotification({ type: 'error', message: 'Please provide transcript text.' });
      return;
    }

    const title = m1FileName.trim() || `Manual Transcript - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.txt`;
    const folder = m1FolderName.trim() || 'Manual Uploads';
    const newId = 'rec_manual_' + Date.now();

    const words = m1Content.trim().split(/\s+/).filter(Boolean).length;

    const newRecord: InterviewRecord = {
      id: newId,
      fileName: title,
      fileType: 'text',
      mimeType: 'text/plain',
      source: 'local_upload',
      uploadedAt: Date.now(),
      folderName: folder,
      folderPath: `Recording / ${folder}`,
      status: 'completed',
      transcript: m1Content.trim(),
      wordCount: words,
    };

    onAddRecord(newRecord);
    setNotification({ type: 'success', message: `Added "${title}" directly to ${folder}!` });
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Tab 2: Save cleaned text to an existing record
  const handleSaveCleaned = () => {
    const target = records.find((r) => r.id === m2RecordId);
    if (!target) {
      setNotification({ type: 'error', message: 'Please select a valid interview record.' });
      return;
    }
    if (!m2CleanedText.trim()) {
      setNotification({ type: 'error', message: 'Cleaned transcript text cannot be empty.' });
      return;
    }

    const cleanedText = m2CleanedText.trim();
    const cleanedWords = countWords(cleanedText);
    const rawWords = target.wordCount || countWords(target.transcript);
    const removed = Math.max(0, rawWords - cleanedWords);

    const updated: InterviewRecord = {
      ...target,
      cleanedTranscript: cleanedText,
      cleanedWordCount: cleanedWords,
      removedWordsCount: removed,
      preservedPronounsCount: countPreservedPronouns(cleanedText),
      cleaningStatus: 'cleaned',
      activeCleanSource: 'manual',
    };

    onUpdateRecord(updated);
    setNotification({ type: 'success', message: `Saved cleaned transcript for "${target.fileName}"!` });
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Tab 3: Save ADKOTM Decode
  const handleSaveDecode = () => {
    const target = records.find((r) => r.id === m3RecordId);
    if (!target) {
      setNotification({ type: 'error', message: 'Please select an interview record.' });
      return;
    }

    let decodeObj: ADKOTMDecode;

    if (m3JsonText.trim()) {
      try {
        const parsed = JSON.parse(m3JsonText.trim());
        decodeObj = parsed;
      } catch (err: any) {
        setNotification({ type: 'error', message: 'Invalid JSON format: ' + err.message });
        return;
      }
    } else {
      decodeObj = {
        activities: {
          dailyRoutine: null,
          shoppingBehaviour: null,
          foodConsumptionBehaviour: null,
          foodPreparation: null,
          eatingContext: null,
        },
        demographic: {
          gender: null,
          age: null,
          residentialLocation: m3RL.trim() || null,
          residentialDistrict: m3RL.trim() || null,
          educationLevel: null,
          householdComposition: null,
          familyRole: m3FR.trim() || null,
        },
        knowledge: {
          awarenessOnGutHealth: m3AW.trim() || null,
          awarenessLevel: m3AW.trim() ? 'Aware' : null,
          understandingSummary: m3AW.trim() || null,
        },
        objects: {
          productsPurchased: m3PP.trim() || null,
          supplementProducts: null,
          foodProducts: null,
          actionsToSolve: null,
          productCategory: null,
          brandPreferences: m3PP1.trim() || null,
          productPreference: null,
        },
        time: {
          purchaseFrequency: null,
          consumptionFrequency: null,
          purchaseTiming: null,
          purchaseOccasion: null,
          consumptionTiming: null,
        },
        metadata: {
          interviewTime: null,
          interviewLocation: m3IL.trim() || null,
        },
        postAnalysisCodes: {
          FR: m3FR.trim() || null,
          RL: m3RL.trim() || null,
          AW: m3AW.trim() || null,
          PP: m3PP.trim() || null,
          PP1: m3PP1.trim() || null,
          IL: m3IL.trim() || null,
        },
        evidenceQuotes: [],
        decodedAt: new Date().toISOString(),
      };
    }

    const updated: InterviewRecord = {
      ...target,
      decodeStatus: 'decoded',
      adkotmDecode: decodeObj,
    };

    onUpdateRecord(updated);
    setNotification({ type: 'success', message: `Saved ADKOTM qualitative decode for "${target.fileName}"!` });
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Tab 4: Save Spending Power Override
  const handleSaveSpendingPower = () => {
    const target = records.find((r) => r.id === m4RecordId);
    if (!target) {
      setNotification({ type: 'error', message: 'Please select an interview record.' });
      return;
    }

    const tierVal = m4Tier === 'null' ? null : m4Tier;

    const spAnalysis: SpendingPowerAnalysis = {
      recordId: target.id,
      fileName: target.fileName,
      spendingPowerTier: tierVal,
      components: {
        D_demographic: target.adkotmDecode?.demographic?.familyRole || null,
        O_objects: target.adkotmDecode?.objects?.productsPurchased || null,
        T_time: target.adkotmDecode?.time?.purchaseFrequency || null,
        M_metadata: target.adkotmDecode?.metadata?.interviewLocation || null,
        RL_residentialLocation: target.adkotmDecode?.postAnalysisCodes?.RL || null,
        PP_productsPurchased: target.adkotmDecode?.postAnalysisCodes?.PP || null,
        PP1_brandPreferences: target.adkotmDecode?.postAnalysisCodes?.PP1 || null,
        IL_interviewLocation: target.adkotmDecode?.postAnalysisCodes?.IL || null,
      },
      justification: m4Justification.trim() || (tierVal ? `Manual assessment: ${tierVal} tier` : 'Insufficient signals (null)'),
    };

    const updated: InterviewRecord = {
      ...target,
      spendingPower: spAnalysis,
    };

    onUpdateRecord(updated);
    setNotification({ type: 'success', message: `Updated Spending Power for "${target.fileName}"!` });
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Helper file drop / upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      if (activeTab === 'module1_transcript') {
        setM1FileName(file.name);
        setM1Content(text);
      } else if (activeTab === 'module2_clean') {
        setM2CleanedText(text);
      } else if (activeTab === 'module3_decode') {
        setM3JsonText(text);
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Failed to read file: ' + err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center shadow-xs">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Manual Upload & Self-Entry Fallback
              </h3>
              <p className="text-[11px] text-stone-500">
                If automated processing fails or you have pre-prepared files, upload or enter data manually for any module.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/80 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Module Tabs */}
        <div className="grid grid-cols-4 border-b border-stone-200 bg-stone-100/60 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('module1_transcript')}
            className={`py-2.5 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'module1_transcript'
                ? 'border-amber-600 text-amber-950 bg-white'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate">1. Transcript</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('module2_clean')}
            className={`py-2.5 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'module2_clean'
                ? 'border-emerald-600 text-emerald-950 bg-white'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="truncate">2. Cleaned Data</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('module3_decode')}
            className={`py-2.5 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'module3_decode'
                ? 'border-amber-600 text-amber-950 bg-white'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span className="truncate">3. ADKOTM</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('module4_cross')}
            className={`py-2.5 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'module4_cross'
                ? 'border-indigo-600 text-indigo-950 bg-white'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span className="truncate">4. Spending</span>
          </button>
        </div>

        {/* Notification Banner */}
        {notification && (
          <div
            className={`px-4 py-2.5 text-xs flex items-center justify-between ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-b border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-b border-rose-200'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-stone-400 hover:text-stone-700 ml-2"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.json,.md,.docx,text/plain,application/json"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Modal Body */}
        <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4">
          {/* TAB 1: Upload or Paste Transcript */}
          {activeTab === 'module1_transcript' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Module 1: Intake & Transcript Manual Upload
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  <Upload className="w-3 h-3" /> Select Text File from Computer
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Recording / Document Name
                  </label>
                  <input
                    type="text"
                    value={m1FileName}
                    onChange={(e) => setM1FileName(e.target.value)}
                    placeholder="e.g. Brem Mall Kepong NSK 10/26.txt"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Folder / Session Date
                  </label>
                  <input
                    type="text"
                    value={m1FolderName}
                    onChange={(e) => setM1FolderName(e.target.value)}
                    placeholder="e.g. 10/26 or 26 Oct 2026"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Transcript Content (Verbatim Dialogue)
                </label>
                <textarea
                  value={m1Content}
                  onChange={(e) => setM1Content(e.target.value)}
                  rows={8}
                  placeholder="Paste interview transcript text here or upload a file above..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveTranscript}
                  disabled={!m1Content.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save Manual Transcript
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Upload Cleaned Data */}
          {activeTab === 'module2_clean' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Module 2: Cleaned & Transformed Data Manual Entry
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  <Upload className="w-3 h-3" /> Upload Cleaned File
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Select Target Interview Recording
                </label>
                <select
                  value={m2RecordId}
                  onChange={(e) => setM2RecordId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                >
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fileName} {r.folderName ? `(${r.folderName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Cleaned Transcript (Fillers removed, pronouns preserved)
                </label>
                <textarea
                  value={m2CleanedText}
                  onChange={(e) => setM2CleanedText(e.target.value)}
                  rows={8}
                  placeholder="Paste or upload your cleaned transcript for this interview..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveCleaned}
                  disabled={!m2CleanedText.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save Cleaned Data
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: ADKOTM Decode */}
          {activeTab === 'module3_decode' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Module 3: ADKOTM Qualitative Decode Entry
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  <Upload className="w-3 h-3" /> Upload ADKOTM JSON
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Select Target Interview Recording
                </label>
                <select
                  value={m3RecordId}
                  onChange={(e) => setM3RecordId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                >
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fileName} {r.folderName ? `(${r.folderName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Post-Analysis Code Inputs */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block">
                  Quick Post-Analysis Code Fields (FR, RL, AW, PP, PP1, IL)
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 block mb-0.5">
                      FR: Family Role (D)
                    </label>
                    <select
                      value={m3FR}
                      onChange={(e) => setM3FR(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-stone-300 bg-white"
                    >
                      <option value="Mum">Mum</option>
                      <option value="Dad">Dad</option>
                      <option value="Elderly">Elderly</option>
                      <option value="">null (not mentioned)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 block mb-0.5">
                      RL: Residential Location (D)
                    </label>
                    <input
                      type="text"
                      value={m3RL}
                      onChange={(e) => setM3RL(e.target.value)}
                      placeholder="e.g. Kepong, Ampang, PJ"
                      className="w-full px-2 py-1 text-xs rounded border border-stone-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 block mb-0.5">
                      AW: Gut Health Awareness (K)
                    </label>
                    <input
                      type="text"
                      value={m3AW}
                      onChange={(e) => setM3AW(e.target.value)}
                      placeholder="e.g. Probiotics awareness"
                      className="w-full px-2 py-1 text-xs rounded border border-stone-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 block mb-0.5">
                      PP: Products Purchased (O)
                    </label>
                    <input
                      type="text"
                      value={m3PP}
                      onChange={(e) => setM3PP(e.target.value)}
                      placeholder="e.g. goat milk, probiotic drink"
                      className="w-full px-2 py-1 text-xs rounded border border-stone-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 block mb-0.5">
                      PP1: Brands (O)
                    </label>
                    <input
                      type="text"
                      value={m3PP1}
                      onChange={(e) => setM3PP1(e.target.value)}
                      placeholder="e.g. Karihome, Yakult"
                      className="w-full px-2 py-1 text-xs rounded border border-stone-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 block mb-0.5">
                      IL: Interview Location (M)
                    </label>
                    <input
                      type="text"
                      value={m3IL}
                      onChange={(e) => setM3IL(e.target.value)}
                      placeholder="e.g. Brem Mall Kepong"
                      className="w-full px-2 py-1 text-xs rounded border border-stone-300"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Or Paste Full ADKOTM JSON (Optional Override)
                </label>
                <textarea
                  value={m3JsonText}
                  onChange={(e) => setM3JsonText(e.target.value)}
                  rows={4}
                  placeholder="Paste ADKOTM JSON object here..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 font-mono"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveDecode}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save ADKOTM Decode
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Spending Power Override */}
          {activeTab === 'module4_cross' && (
            <div className="space-y-3.5">
              <div className="pb-2 border-b border-stone-100">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Module 4: Spending Power Assessment Manual Override
                </span>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Spending power formula: D + O + T + M (specifically RL + PP + IL).
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Select Target Interview Recording
                </label>
                <select
                  value={m4RecordId}
                  onChange={(e) => setM4RecordId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fileName} {r.folderName ? `(${r.folderName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Spending Power Classification Tier
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(['High', 'Medium-High', 'Medium', 'Low', 'null'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setM4Tier(t)}
                      className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                        m4Tier === t
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {t === 'null' ? 'null' : t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Assessment Evidence & Justification
                </label>
                <textarea
                  value={m4Justification}
                  onChange={(e) => setM4Justification(e.target.value)}
                  rows={4}
                  placeholder="e.g. High spending power indicated by residential area (Ampang) and premium imported brand basket..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveSpendingPower}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save Spending Power Assessment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
