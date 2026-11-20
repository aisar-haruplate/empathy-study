import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sliders,
  ShieldCheck,
  FileText,
  ArrowRight,
  Copy,
  Check,
  Edit3,
  Upload,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  InterviewRecord,
  TranscriptCleaningOptions,
} from '../types';
import {
  cleanTranscriptWithPipeline,
  countPreservedPronouns,
  countWords,
  DEFAULT_CLEANING_OPTIONS,
} from '../lib/textCleaning';
import { isAnalysisEligibleRecord } from '../lib/recordEligibility';

interface Module2DataCleaningProps {
  records: InterviewRecord[];
  onUpdateRecord: (updated: InterviewRecord) => void;
  safePostJson: <T = any>(url: string, payload: any) => Promise<T>;
  onProceedToNext?: () => void;
}

export const Module2DataCleaning: React.FC<Module2DataCleaningProps> = ({
  records,
  onUpdateRecord,
  safePostJson,
  onProceedToNext,
}) => {
  const [cleaningId, setCleaningId] = useState<string | null>(null);
  const [isBatchCleaning, setIsBatchCleaning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [cleanErrors, setCleanErrors] = useState<Record<string, string>>({});
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(
    records.find((r) => r.transcript)?.id || null
  );
  const [copied, setCopied] = useState(false);
  const [isEditingCleaned, setIsEditingCleaned] = useState(false);
  const [editedCleanedText, setEditedCleanedText] = useState('');
  const [cleaningOptions, setCleaningOptions] = useState<TranscriptCleaningOptions>(DEFAULT_CLEANING_OPTIONS);
  const [rawExpandedMap, setRawExpandedMap] = useState<Record<string, boolean>>({});
  const cleanedFileInputRef = useRef<HTMLInputElement>(null);

  const recordsRef = useRef<InterviewRecord[]>(records);
  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  const eligibleRecords = records.filter((r) => r.transcript && isAnalysisEligibleRecord(r));
  const cleanedRecords = eligibleRecords.filter((r) => Boolean(r.cleanedTranscript));
  const pendingCount = Math.max(0, eligibleRecords.length - cleanedRecords.length);

  const activeRecord = eligibleRecords.find((r) => r.id === selectedRecordId) || eligibleRecords[0];
  const isRawExpanded = activeRecord ? rawExpandedMap[activeRecord.id] ?? true : false;
  const isAllCleaned = eligibleRecords.length > 0 && cleanedRecords.length === eligibleRecords.length;
  const isRunningActive = Boolean(activeRecord && cleaningId === activeRecord.id);
  const activeError = activeRecord ? cleanErrors[activeRecord.id] : undefined;

  const toggleRawPanel = (recordId: string, currentlyExpanded: boolean) => {
    setRawExpandedMap((prev) => ({
      ...prev,
      [recordId]: !currentlyExpanded,
    }));
  };

  const handleSaveManualCleaned = (textToSave?: string) => {
    if (!activeRecord) return;
    const finalContent = (textToSave ?? editedCleanedText).trim();
    if (!finalContent) return;

    const cleanedWords = countWords(finalContent);
    const rawWords = activeRecord.wordCount || countWords(activeRecord.transcript || '');
    const removed = Math.max(0, rawWords - cleanedWords);

    setCleanErrors((prev) => {
      if (!prev[activeRecord.id]) return prev;
      const next = { ...prev };
      delete next[activeRecord.id];
      return next;
    });

    const updated: InterviewRecord = {
      ...activeRecord,
      cleanedTranscript: finalContent,
      cleanedWordCount: cleanedWords,
      removedWordsCount: removed,
      preservedPronounsCount: countPreservedPronouns(finalContent),
      cleaningStatus: 'cleaned',
      activeCleanSource: 'manual',
    };

    onUpdateRecord(updated);
    setIsEditingCleaned(false);
  };

  const handleCleanedFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRecord) return;
    try {
      const text = await file.text();
      handleSaveManualCleaned(text);
    } catch (err: any) {
      console.error('Failed to read uploaded cleaned transcript:', err);
    } finally {
      e.target.value = '';
    }
  };

  // Unified 6-step Clean Text pipeline (translation, interviewer/question/noise/filler/phatic removal, proper-name casing)
  const runCleanTextForRecord = async (record: InterviewRecord): Promise<boolean> => {
    if (!record.transcript) return false;
    setCleaningId(record.id);
    setCleanErrors((prev) => {
      if (!prev[record.id]) return prev;
      const next = { ...prev };
      delete next[record.id];
      return next;
    });

    try {
      const res = await cleanTranscriptWithPipeline(
        {
          rawText: record.transcript,
          fileName: record.fileName,
          options: cleaningOptions,
        },
        safePostJson
      );

      const latest = recordsRef.current.find((r) => r.id === record.id) || record;
      onUpdateRecord({
        ...latest,
        cleanedTranscript: res.cleanedText,
        cleanedWordCount: res.cleanedWordCount,
        removedWordsCount: res.removedWordsCount,
        preservedPronounsCount: res.preservedPronounsCount,
        cleaningStats: res.cleaningStats,
        cleaningStatus: 'cleaned',
        quickCleanedResult: undefined,
        aiCleanedResult: undefined,
        activeCleanSource: undefined,
      });
      return true;
    } catch (err: any) {
      console.error('Clean text failed:', err);
      const msg = err?.message || `Failed to clean "${record.fileName}". Please retry.`;
      setCleanErrors((prev) => ({ ...prev, [record.id]: msg }));
      return false;
    } finally {
      setCleaningId((current) => (current === record.id ? null : current));
    }
  };

  const handleBatchClean = async (reCleanAll: boolean) => {
    const targets = reCleanAll
      ? eligibleRecords.filter((r) => Boolean(r.transcript))
      : eligibleRecords.filter((r) => Boolean(r.transcript) && !r.cleanedTranscript);

    if (targets.length === 0) return;

    setIsBatchCleaning(true);
    setBatchProgress({ current: 0, total: targets.length });
    try {
      for (let i = 0; i < targets.length; i++) {
        setBatchProgress({ current: i + 1, total: targets.length });
        await runCleanTextForRecord(targets[i]);
      }
    } finally {
      setIsBatchCleaning(false);
      setBatchProgress(null);
    }
  };

  const toggleCleaningOption = (key: keyof TranscriptCleaningOptions) => {
    setCleaningOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCopyCleaned = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const getPreservedPronounBadges = (text?: string) => {
    if (!text) return [];
    const matches =
      text.match(/\b(he|she|him|her|his|hers|they|them|their|theirs|i|me|my|mine|we|us|our|ours|you|your)\b/gi) || [];
    const counts: Record<string, number> = {};
    matches.forEach((m) => {
      const lower = m.toLowerCase();
      counts[lower] = (counts[lower] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  };

  const activeRawWordCount = activeRecord
    ? activeRecord.wordCount || countWords(activeRecord.transcript || '')
    : 0;
  const activeCleanedWordCount = activeRecord?.cleanedTranscript
    ? activeRecord.cleanedWordCount ?? countWords(activeRecord.cleanedTranscript)
    : 0;
  const activeRemovedWordCount = activeRecord?.cleanedTranscript
    ? activeRecord.removedWordsCount ?? Math.max(0, activeRawWordCount - activeCleanedWordCount)
    : 0;
  const activePronounsCount = activeRecord?.cleanedTranscript
    ? activeRecord.preservedPronounsCount ?? countPreservedPronouns(activeRecord.cleanedTranscript)
    : 0;

  return (
    <div className="space-y-5">
      {/* Step 2 Summary Bar */}
      {!isAllCleaned ? (
        <div className="bg-white border border-stone-200 rounded-xl px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-bold text-stone-900">
                  Step 2: Clean Text
                </h2>
                <span className="text-xs text-stone-500 font-medium tabular-nums">
                  {cleanedRecords.length} of {eligibleRecords.length} transcripts cleaned
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-1 max-w-2xl leading-relaxed">
                Translate speech to English, strip interviewer turns, questions, noise, fillers, and phatics while preserving proper names and original participant phrasing.
              </p>
            </div>
          </div>

          {pendingCount > 0 && (
            <div className="flex items-center shrink-0">
              <button
                type="button"
                disabled={isBatchCleaning || cleaningId !== null || eligibleRecords.length === 0}
                onClick={() => handleBatchClean(false)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-50 text-stone-700 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                {isBatchCleaning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      Cleaning ({batchProgress?.current ?? 1}/{batchProgress?.total ?? pendingCount})...
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Clean All ({pendingCount})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="text-sm font-bold text-emerald-950">
                Step 2 Complete · All {cleanedRecords.length} Transcript Records Cleaned
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Review the cleaned transcripts below or proceed directly to Step 3 theme decoding.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              disabled={isBatchCleaning || cleaningId !== null}
              onClick={() => handleBatchClean(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-emerald-300 bg-white hover:bg-emerald-50 disabled:opacity-50 text-emerald-900 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              {isBatchCleaning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    Re-Cleaning ({batchProgress?.current ?? 1}/{batchProgress?.total ?? eligibleRecords.length})...
                  </span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-Clean All</span>
                </>
              )}
            </button>

            {onProceedToNext && (
              <button
                type="button"
                onClick={onProceedToNext}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <span>Proceed to Step 3: Decode Themes</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cleaning Rule Toggles */}
      {eligibleRecords.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 mr-1">
              <Sliders className="w-3.5 h-3.5 text-emerald-700" />
              Filters:
            </span>
            {(
              [
                { key: 'removeInterviewer', label: 'Remove Interviewer & Questions' },
                { key: 'removeFillers', label: 'Fillers & Crutches' },
                { key: 'removePhatic', label: 'Phatics' },
                { key: 'removeNoise', label: 'Noise & Duplicates' },
                { key: 'translateToEnglish', label: 'Translate to English' },
              ] as const
            ).map((opt) => {
              const active = cleaningOptions[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleCleaningOption(opt.key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] font-bold ${
                      active ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-500'
                    }`}
                  >
                    {active ? '✓' : ''}
                  </span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            Stopwords, pronouns &amp; proper names preserved
          </span>
        </div>
      )}

      {eligibleRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <FileText className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-stone-800">No transcripts available to clean</h3>
          <p className="text-xs text-stone-500 mt-1">
            Import and transcribe recordings in Step 1 first.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Recording Selector */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between mb-1 px-0.5">
              <h3 className="text-xs font-bold text-stone-700">
                Interview Transcripts
              </h3>
              <span className="text-xs text-stone-500 tabular-nums">
                {eligibleRecords.length} total
              </span>
            </div>

            <div className="space-y-1.5 max-h-[680px] overflow-y-auto pr-1">
              {eligibleRecords.map((r) => {
                const isSelected = r.id === activeRecord?.id;
                const isCleaned = Boolean(r.cleanedTranscript);
                const isThisCleaning = cleaningId === r.id;

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedRecordId(r.id);
                      setIsEditingCleaned(false);
                    }}
                    className={`w-full p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-400 text-stone-900'
                        : 'bg-white border-stone-200 hover:border-stone-300 text-stone-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold truncate">{r.fileName}</h4>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-500 tabular-nums truncate">
                        <span>{r.folderName || 'Uploaded recording'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{r.wordCount || countWords(r.transcript || '')} words</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right pt-0.5">
                      {isThisCleaning ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Cleaning</span>
                        </span>
                      ) : (
                        <span
                          className={`text-[11px] font-semibold tabular-nums ${
                            isCleaned ? 'text-emerald-700' : 'text-stone-400'
                          }`}
                        >
                          {isCleaned
                            ? r.activeCleanSource === 'manual'
                              ? 'Edited'
                              : 'Cleaned'
                            : 'Pending'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Unified Clean Text Action + Raw Transcript + Single Cleaned Transcript Panel */}
          <div className="lg:col-span-8">
            {activeRecord ? (
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden flex flex-col">
                {/* Active Record Header */}
                <div className="px-5 py-4 border-b border-stone-200 bg-stone-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-stone-900 truncate">
                      {activeRecord.fileName}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5 flex-wrap">
                      <span>{activeRecord.folderName || 'Direct Upload'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{activeRawWordCount} raw words</span>
                      {activeRecord.cleanedTranscript && (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold whitespace-nowrap">
                          <span className="text-stone-400 font-normal" aria-hidden="true">·</span>
                          <span>
                            {activeRecord.activeCleanSource === 'manual' ? 'Manual Edit Ready' : 'Cleaned & Ready'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <input
                      ref={cleanedFileInputRef}
                      type="file"
                      accept=".txt,.docx,.md,text/plain"
                      className="hidden"
                      onChange={handleCleanedFileUpload}
                    />

                    <button
                      type="button"
                      onClick={() => cleanedFileInputRef.current?.click()}
                      title="Upload your own cleaned text file"
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditedCleanedText(activeRecord.cleanedTranscript || activeRecord.transcript || '');
                        setIsEditingCleaned(!isEditingCleaned);
                      }}
                      title="Edit or paste cleaned text manually"
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    {activeRecord.cleanedTranscript && (
                      <button
                        type="button"
                        onClick={() => handleCopyCleaned(activeRecord.cleanedTranscript!)}
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                        title="Copy cleaned transcript"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isRunningActive || isBatchCleaning}
                      onClick={() => runCleanTextForRecord(activeRecord)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs disabled:opacity-60 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      {isRunningActive ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Cleaning...</span>
                        </>
                      ) : activeRecord.cleanedTranscript ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Re-Clean Text</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Clean Text</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Active Metrics Summary Strip */}
                {activeRecord.cleanedTranscript && !isEditingCleaned && (
                  <div className="px-5 py-2.5 bg-stone-50/40 border-b border-stone-200 text-xs text-stone-600 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap tabular-nums">
                      <span className="font-semibold text-stone-800">Metrics:</span>
                      <span>
                        {activeRawWordCount} raw →{' '}
                        <strong className="text-emerald-700">
                          {activeCleanedWordCount} cleaned words
                        </strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>-{activeRemovedWordCount} removed</span>
                      {getPreservedPronounBadges(activeRecord.cleanedTranscript).length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            Pronouns:{' '}
                            {getPreservedPronounBadges(activeRecord.cleanedTranscript)
                              .map(([w, c]) => `${w} (${c})`)
                              .join(', ')}
                          </span>
                        </>
                      )}
                    </div>

                    {activeRecord.cleaningStats && (
                      <div className="text-[11px] text-stone-500 tabular-nums">
                        Interviewer turns: {activeRecord.cleaningStats.removedInterviewerTurns} · Fillers:{' '}
                        {activeRecord.cleaningStats.removedFillersCount} · Phatic:{' '}
                        {activeRecord.cleaningStats.removedPhaticCount} · Noise:{' '}
                        {activeRecord.cleaningStats.removedNoiseTagsCount}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Raw Transcript Panel */}
                <div className="border-b border-stone-200 bg-stone-50/30">
                  <button
                    type="button"
                    onClick={() => toggleRawPanel(activeRecord.id, isRawExpanded)}
                    aria-expanded={isRawExpanded}
                    className="w-full px-5 py-2.5 flex items-center justify-between text-left hover:bg-stone-100/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      {isRawExpanded ? (
                        <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-stone-500 shrink-0" />
                      )}
                      <span className="font-semibold text-stone-800">Raw Transcript</span>
                      <span className="text-stone-400" aria-hidden="true">·</span>
                      <span className="text-stone-500 tabular-nums">{activeRawWordCount} words</span>
                    </div>
                    <span className="text-xs font-medium text-stone-500">
                      {isRawExpanded ? 'Hide' : 'Show'}
                    </span>
                  </button>

                  {isRawExpanded && (
                    <div className="px-5 pb-4 pt-1 border-t border-stone-200/70">
                      <div className="text-xs text-stone-700 whitespace-pre-wrap font-sans leading-relaxed max-h-56 overflow-y-auto pr-1">
                        {activeRecord.transcript}
                      </div>
                    </div>
                  )}
                </div>

                {/* Single Cleaned Transcript Panel Below Raw Transcript */}
                <div className="p-5 flex-1">
                  {isEditingCleaned ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                          <Edit3 className="w-4 h-4 text-emerald-700" /> Edit Cleaned Transcript Manually
                        </span>
                        <button
                          type="button"
                          onClick={() => cleanedFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload .txt
                        </button>
                      </div>

                      <textarea
                        value={editedCleanedText}
                        onChange={(e) => setEditedCleanedText(e.target.value)}
                        rows={11}
                        placeholder="Paste or edit cleaned transcript text here..."
                        className="w-full p-3 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 leading-relaxed"
                      />

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingCleaned(false)}
                          className="px-3.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveManualCleaned()}
                          disabled={!editedCleanedText.trim()}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Save Manual Edit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-stone-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-stone-200/80">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-stone-900">Cleaned Transcript</span>
                        </div>
                        <div className="text-[11px] text-stone-500 tabular-nums">
                          {isRunningActive ? (
                            <span>Running 6-step Clean Text pipeline...</span>
                          ) : activeRecord.cleanedTranscript ? (
                            <span>
                              {activeCleanedWordCount} words · -{activeRemovedWordCount} removed · {activePronounsCount} pronouns preserved
                            </span>
                          ) : activeError ? (
                            <span className="text-rose-700 font-medium">Cleaning failed</span>
                          ) : (
                            <span>Pending</span>
                          )}
                        </div>
                      </div>

                      {isRunningActive ? (
                        <div className="space-y-2.5 py-2" aria-busy="true" aria-label="Cleaning transcript in progress">
                          <div className="h-3 bg-stone-200/70 rounded w-11/12 animate-pulse" />
                          <div className="h-3 bg-stone-200/70 rounded w-full animate-pulse" />
                          <div className="h-3 bg-stone-200/70 rounded w-5/6 animate-pulse" />
                          <div className="h-3 bg-stone-200/70 rounded w-4/6 animate-pulse" />
                        </div>
                      ) : activeError ? (
                        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 space-y-2.5 text-xs text-rose-900">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <span>{activeError}</span>
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => runCleanTextForRecord(activeRecord)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-rose-300 bg-white hover:bg-rose-100 text-rose-900 font-semibold cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" /> Retry Clean Text
                            </button>
                          </div>
                        </div>
                      ) : activeRecord.cleanedTranscript ? (
                        <div className="text-xs text-stone-800 whitespace-pre-wrap font-sans leading-relaxed max-h-[460px] overflow-y-auto pr-1">
                          {activeRecord.cleanedTranscript}
                        </div>
                      ) : (
                        <div className="py-10 text-center space-y-2.5">
                          <Sparkles className="w-7 h-7 text-emerald-600 mx-auto opacity-70" />
                          <h4 className="text-xs font-bold text-stone-800">
                            Ready to clean this transcript
                          </h4>
                          <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                            Click Clean Text above to translate speech into literal English, strip interviewer turns, questions, noise, fillers, and phatics, and keep brand and store names intact.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
