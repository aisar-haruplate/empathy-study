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
  Languages,
} from 'lucide-react';
import {
  InterviewRecord,
  TranscriptCleaningOptions,
} from '../../types';
import {
  cleanTranscriptWithPipeline,
  countPreservedPronouns,
  countWords,
  DEFAULT_CLEANING_OPTIONS,
  translateTranscriptToEnglish,
} from '../../lib/textCleaning';
import { isAnalysisEligibleRecord } from '../../lib/recordEligibility';

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
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [isBatchCleaning, setIsBatchCleaning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [cleanErrors, setCleanErrors] = useState<Record<string, string>>({});
  const [translateErrors, setTranslateErrors] = useState<Record<string, string>>({});
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(
    records.find((r) => r.transcript)?.id || null
  );
  const [copied, setCopied] = useState(false);
  const [copiedTranslated, setCopiedTranslated] = useState(false);
  const [isEditingCleaned, setIsEditingCleaned] = useState(false);
  const [editedCleanedText, setEditedCleanedText] = useState('');
  const [isEditingTranslated, setIsEditingTranslated] = useState(false);
  const [editedTranslatedText, setEditedTranslatedText] = useState('');
  const [cleaningOptions, setCleaningOptions] = useState<TranscriptCleaningOptions>(DEFAULT_CLEANING_OPTIONS);
  const [rawExpandedMap, setRawExpandedMap] = useState<Record<string, boolean>>({});
  const cleanedFileInputRef = useRef<HTMLInputElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const [isListScrolled, setIsListScrolled] = useState(false);
  const [hoveredTranscriptTip, setHoveredTranscriptTip] = useState<{
    fileName: string;
    meta: string;
    left: number;
    top: number;
  } | null>(null);

  const clearHoverTip = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredTranscriptTip(null);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const scheduleHoverTip = (
    e: React.MouseEvent<HTMLButtonElement>,
    fileName: string,
    meta: string
  ) => {
    clearHoverTip();
    const rect = e.currentTarget.getBoundingClientRect();
    const POPOVER_W = 320;
    const POPOVER_H = 84;
    const MARGIN = 12;

    // Prefer placing cleanly to the right of the sidebar card; fall back above/inside viewport if narrow
    let left = rect.right + 10;
    let top = rect.top + 4;
    if (left + POPOVER_W > window.innerWidth - MARGIN) {
      left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - POPOVER_W - MARGIN));
      top = rect.top - POPOVER_H - 8;
      if (top < MARGIN) {
        top = Math.min(rect.bottom + 8, window.innerHeight - POPOVER_H - MARGIN);
      }
    } else {
      top = Math.max(MARGIN, Math.min(top, window.innerHeight - POPOVER_H - MARGIN));
    }

    hoverTimerRef.current = window.setTimeout(() => {
      setHoveredTranscriptTip({ fileName, meta, left, top });
    }, 1200);
  };

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
  const isTranslatingActive = Boolean(activeRecord && translatingId === activeRecord.id);
  const activeError = activeRecord ? cleanErrors[activeRecord.id] : undefined;
  const activeTranslationError = activeRecord ? translateErrors[activeRecord.id] : undefined;

  useEffect(() => {
    setIsEditingTranslated(false);
    setIsEditingCleaned(false);
  }, [activeRecord?.id]);

  const handleTranslateRecord = async (record: InterviewRecord): Promise<string | null> => {
    if (!record.transcript) return null;
    setTranslatingId(record.id);
    setTranslateErrors((prev) => {
      if (!prev[record.id]) return prev;
      const next = { ...prev };
      delete next[record.id];
      return next;
    });

    try {
      const res = await translateTranscriptToEnglish(
        {
          rawText: record.transcript,
          fileName: record.fileName,
        },
        safePostJson
      );
      const translatedText = (res.translatedText || '').trim();
      if (!translatedText) {
        throw new Error('Translation service returned an empty transcript. Please retry.');
      }

      const latest = recordsRef.current.find((r) => r.id === record.id) || record;
      onUpdateRecord({
        ...latest,
        translatedTranscript: translatedText,
        translatedWordCount: res.wordCount || countWords(translatedText),
        translatedAt: res.translatedAt || new Date().toISOString(),
      });
      setIsEditingTranslated(false);
      return translatedText;
    } catch (err: any) {
      console.error('Translation failed:', err);
      const msg = err?.message || `Failed to translate "${record.fileName}". Please retry.`;
      setTranslateErrors((prev) => ({ ...prev, [record.id]: msg }));
      return null;
    } finally {
      setTranslatingId((current) => (current === record.id ? null : current));
    }
  };

  const handleSaveManualTranslated = () => {
    if (!activeRecord) return;
    const finalContent = editedTranslatedText.trim();
    if (!finalContent) return;

    setTranslateErrors((prev) => {
      if (!prev[activeRecord.id]) return prev;
      const next = { ...prev };
      delete next[activeRecord.id];
      return next;
    });

    onUpdateRecord({
      ...activeRecord,
      translatedTranscript: finalContent,
      translatedWordCount: countWords(finalContent),
      translatedAt: new Date().toISOString(),
    });
    setIsEditingTranslated(false);
  };

  const handleCopyTranslated = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTranslated(true);
      setTimeout(() => setCopiedTranslated(false), 2000);
    } catch (err) {
      console.error('Copy translated failed', err);
    }
  };

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

  // Unified 6-step Clean Text pipeline (uses translated English transcript when available,
  // or translates first when translateToEnglish is enabled so the Translated Transcript pane stays in sync)
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
      let sourceForCleaning = record.translatedTranscript?.trim() || '';
      let freshlyTranslatedText: string | undefined;

      if (!sourceForCleaning && cleaningOptions.translateToEnglish) {
        const translated = await translateTranscriptToEnglish(
          {
            rawText: record.transcript,
            fileName: record.fileName,
          },
          safePostJson
        );
        if (translated.translatedText?.trim()) {
          sourceForCleaning = translated.translatedText.trim();
          freshlyTranslatedText = sourceForCleaning;
        }
      }

      const effectiveInput = sourceForCleaning || record.transcript;
      const res = await cleanTranscriptWithPipeline(
        {
          rawText: effectiveInput,
          fileName: record.fileName,
          options: {
            ...cleaningOptions,
            translateToEnglish: sourceForCleaning ? false : cleaningOptions.translateToEnglish,
          },
        },
        safePostJson
      );

      const latest = recordsRef.current.find((r) => r.id === record.id) || record;
      onUpdateRecord({
        ...latest,
        ...(freshlyTranslatedText
          ? {
              translatedTranscript: freshlyTranslatedText,
              translatedWordCount: countWords(freshlyTranslatedText),
              translatedAt: new Date().toISOString(),
            }
          : {}),
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
        <div className="bg-white border border-[#EAE6DF] rounded-3xl px-5 sm:px-6 py-4 sm:py-5 shadow-studio flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#F2FBF8] border border-[#96D6C7] text-[#1E4D42] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-[#292524] tracking-[-0.02em]">
                  Step 2: Clean Text
                </h2>
                <span className="px-3 py-0.5 rounded-full text-[13px] text-[#57534E] font-semibold bg-[#F7F5F0] border border-[#EAE6DF] tabular-nums">
                  {cleanedRecords.length} of {eligibleRecords.length} transcripts cleaned
                </span>
              </div>
              <p className="text-base text-[#57534E] mt-1.5 max-w-2xl leading-relaxed">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-[#528BCA] hover:bg-[#3F78B5] disabled:opacity-50 text-white shadow-xs cursor-pointer transition-all whitespace-nowrap shrink-0"
              >
                {isBatchCleaning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      Cleaning ({batchProgress?.current ?? 1}/{batchProgress?.total ?? pendingCount})...
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span className="tabular-nums">Clean All ({pendingCount})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#F2FBF8] border border-[#96D6C7] rounded-3xl px-5 sm:px-6 py-4 sm:py-5 shadow-studio flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#96D6C7] text-[#1E4D42] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-heading font-bold text-[#1E4D42] tabular-nums">
                Step 2 Complete · All {cleanedRecords.length} Transcript Records Cleaned
              </div>
              <p className="text-base text-[#1E4D42]/90 mt-1 leading-relaxed">
                Review the cleaned transcripts below or proceed directly to Step 3 theme decoding.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              disabled={isBatchCleaning || cleaningId !== null}
              onClick={() => handleBatchClean(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-[#96D6C7] bg-white hover:bg-[#F7F5F0] disabled:opacity-50 text-[#1E4D42] cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              {isBatchCleaning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    Re-Cleaning ({batchProgress?.current ?? 1}/{batchProgress?.total ?? eligibleRecords.length})...
                  </span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Re-Clean All</span>
                </>
              )}
            </button>

            {onProceedToNext && (
              <button
                type="button"
                onClick={onProceedToNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white shadow-xs cursor-pointer transition-all whitespace-nowrap shrink-0"
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
        <div className="bg-white rounded-2xl border border-[#EAE6DF] px-4 py-3.5 shadow-studio flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#292524] mr-1">
              <Sliders className="w-4 h-4 text-[#1E4D42]" />
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#F2FBF8] text-[#1E4D42] border-[#96D6C7]'
                      : 'bg-[#F7F5F0] text-[#78716C] border-[#EAE6DF] hover:text-[#292524]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[13px] font-bold ${
                      active ? 'bg-[#96D6C7] text-[#1E4D42]' : 'bg-[#EAE6DF] text-[#78716C]'
                    }`}
                  >
                    {active ? '✓' : ''}
                  </span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <span className="inline-flex items-center gap-1.5 text-sm text-[#57534E]">
            <ShieldCheck className="w-4 h-4 text-[#1E4D42] shrink-0" />
            Stopwords, pronouns &amp; proper names preserved
          </span>
        </div>
      )}

      {eligibleRecords.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#EAE6DF] p-12 text-center shadow-studio">
          <FileText className="w-10 h-10 text-[#78716C]/50 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-[#292524] tracking-[-0.02em]">No transcripts available to clean</h3>
          <p className="text-lg text-[#57534E] mt-2 leading-relaxed">
            Import and transcribe recordings in Step 1 first.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Recording Selector */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-[#E2E6E4] bg-[#FDFCF8] overflow-hidden shadow-2xs">
              {/* Sidebar Card Header Bar */}
              <div className="px-4 py-3 bg-[#F2F5F3]/80 border-b border-[#E2E6E4] flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#4F5E57]">
                  Interview Transcripts
                </h3>
                <span className="text-xs text-[#5C6B64] font-mono font-semibold tabular-nums">
                  {eligibleRecords.length} total
                </span>
              </div>

              <div className="relative">
                <div
                  ref={listScrollRef}
                  onScroll={(e) => {
                    setIsListScrolled(e.currentTarget.scrollTop > 40);
                    clearHoverTip();
                  }}
                  className="p-2.5 space-y-2 max-h-[680px] overflow-y-auto pb-5"
                >
                  {eligibleRecords.map((r) => {
                    const isSelected = r.id === activeRecord?.id;
                    const isCleaned = Boolean(r.cleanedTranscript);
                    const isThisCleaning = cleaningId === r.id;
                    const wordTotal = r.wordCount || countWords(r.transcript || '');
                    const metaText = `${r.folderName || 'Uploaded recording'} · ${wordTotal} words`;

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onMouseEnter={(e) => scheduleHoverTip(e, r.fileName, metaText)}
                        onMouseLeave={clearHoverTip}
                        onClick={() => {
                          clearHoverTip();
                          setSelectedRecordId(r.id);
                          setIsEditingCleaned(false);
                        }}
                        className={`w-full px-3.5 py-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-[#EEF4FB] border-[#528BCA] ring-1 ring-[#528BCA]/25 text-[#1C1B1F] shadow-2xs'
                            : 'bg-[#FFFFFF] border-[#E2E6E4]/85 hover:border-[#528BCA]/50 hover:bg-[#F2F5F3]/40 text-[#1C1B1F]'
                        }`}
                      >
                        {/* Row 1: Bold Truncated Title */}
                        <h4 className="text-[15px] font-bold text-[#1C1B1F] truncate leading-snug">
                          {r.fileName}
                        </h4>

                        {/* Row 2: Metadata (bottom-left) + Status Pill (bottom-right) */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-[#5C6B64] tabular-nums truncate min-w-0">
                            <span className="truncate">{r.folderName || 'Uploaded recording'}</span>
                            <span aria-hidden="true">·</span>
                            <span className="shrink-0">{wordTotal} words</span>
                          </div>

                          <div className="shrink-0">
                            {isThisCleaning ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EEF4FB] text-xs font-semibold text-[#234B78] border border-[#528BCA]/30">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Cleaning</span>
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                                  isCleaned
                                    ? 'bg-[#96D6C7] text-[#1E4D42]'
                                    : 'bg-[#F2F5F3] text-[#5C6B64] border border-[#E2E6E4]'
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
                        </div>
                      </button>
                    );
                  })}

                  {/* Clean End-of-List Marker */}
                  <div className="pt-2 pb-1 flex items-center justify-center gap-2.5">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-[#F2F5F3] text-[#5C6B64] border border-[#E2E6E4] tabular-nums">
                      End of {eligibleRecords.length} transcripts
                    </span>
                    {isListScrolled && (
                      <button
                        type="button"
                        onClick={() =>
                          listScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                        }
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#528BCA] bg-[#EEF4FB] hover:bg-[#DCE8F7] border border-[#528BCA]/30 cursor-pointer transition-colors"
                      >
                        Back to top ↑
                      </button>
                    )}
                  </div>
                </div>

                {/* Subtle Bottom Fade Overlay */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#FDFCF8] via-[#FDFCF8]/75 to-transparent"
                />
              </div>
            </div>

            {/* 1.2s Delayed Hover Popover for Full Untruncated Filename */}
            {hoveredTranscriptTip && (
              <div
                role="tooltip"
                style={{
                  left: `${hoveredTranscriptTip.left}px`,
                  top: `${hoveredTranscriptTip.top}px`,
                }}
                className="fixed z-50 w-[320px] max-w-[calc(100vw-24px)] pointer-events-none rounded-2xl bg-[#FFFFFF] border border-[#E2E6E4] shadow-studio px-3.5 py-2.5 animate-in fade-in duration-150"
              >
                <div className="font-heading text-xs font-bold text-[#1C1B1F] break-words leading-snug">
                  {hoveredTranscriptTip.fileName}
                </div>
                <div className="mt-1 text-[11px] font-mono text-[#5C6B64] tabular-nums">
                  {hoveredTranscriptTip.meta}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Unified Clean Text Action + Raw Transcript + Single Cleaned Transcript Panel */}
          <div className="lg:col-span-8">
            {activeRecord ? (
              <div className="bg-white rounded-3xl border border-[#EAE6DF] shadow-studio overflow-hidden flex flex-col">
                {/* Active Record Header */}
                <div className="px-5 py-4 border-b border-[#EAE6DF] bg-[#F7F5F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-[#292524] truncate tracking-[-0.02em]">
                      {activeRecord.fileName}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-[#57534E] mt-1 flex-wrap">
                      <span>{activeRecord.folderName || 'Direct Upload'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{activeRawWordCount} raw words</span>
                      {activeRecord.cleanedTranscript && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#96D6C7] text-[#1E4D42] text-[13px] font-bold whitespace-nowrap">
                          {activeRecord.activeCleanSource === 'manual' ? 'Manual Edit Ready' : 'Cleaned & Ready'}
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
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] sm:text-sm font-medium text-[#57534E] hover:text-[#234B78] bg-white border border-[#EAE6DF] hover:bg-[#EEF4FB] hover:border-[#528BCA]/45 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
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
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] sm:text-sm font-medium text-[#57534E] hover:text-[#234B78] bg-white border border-[#EAE6DF] hover:bg-[#EEF4FB] hover:border-[#528BCA]/45 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    {activeRecord.cleanedTranscript && (
                      <button
                        type="button"
                        onClick={() => handleCopyCleaned(activeRecord.cleanedTranscript!)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] sm:text-sm font-medium text-[#57534E] hover:text-[#234B78] bg-white border border-[#EAE6DF] hover:bg-[#EEF4FB] hover:border-[#528BCA]/45 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                        title="Copy cleaned transcript"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#1E4D42]" />
                            <span className="text-[#1E4D42]">Copied</span>
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
                      className="md3-btn-primary inline-flex items-center gap-1.5 px-5 py-2 cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      {isRunningActive ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Cleaning...</span>
                        </>
                      ) : activeRecord.cleanedTranscript ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Re-Clean Transcript</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Clean Transcript</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Active Metrics Summary Strip */}
                {activeRecord.cleanedTranscript && !isEditingCleaned && (
                  <div className="px-5 py-3 bg-[#F2FBF8]/70 border-b border-[#EAE6DF] text-sm text-[#57534E] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap tabular-nums">
                      <span className="font-semibold text-[#292524]">Metrics:</span>
                      <span>
                        {activeRawWordCount} raw →{' '}
                        <strong className="text-[#1E4D42]">
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
                      <div className="text-[13px] text-[#78716C] tabular-nums">
                        Interviewer turns: {activeRecord.cleaningStats.removedInterviewerTurns} · Fillers:{' '}
                        {activeRecord.cleaningStats.removedFillersCount} · Phatic:{' '}
                        {activeRecord.cleaningStats.removedPhaticCount} · Noise:{' '}
                        {activeRecord.cleaningStats.removedNoiseTagsCount}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Side-by-Side Raw Transcript & Translated Transcript Row */}
                <div className="border-b border-[#D5DDD8] bg-[#F2F5F3]/80">
                  <div className="px-5 py-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleRawPanel(activeRecord.id, isRawExpanded)}
                      aria-expanded={isRawExpanded}
                      className="inline-flex items-center gap-2 text-left cursor-pointer group"
                    >
                      {isRawExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[#444846] shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#444846] shrink-0" />
                      )}
                      <span className="font-heading font-medium text-base text-[#1C1B1F]">
                        Raw &amp; Translated Transcript
                      </span>
                      <span className="text-[#727975]" aria-hidden="true">·</span>
                      <span className="text-xs font-medium text-[#444846] tabular-nums">
                        {activeRawWordCount} raw words
                        {activeRecord.translatedTranscript
                          ? ` · ${activeRecord.translatedWordCount ?? countWords(activeRecord.translatedTranscript)} translated words`
                          : ''}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleRawPanel(activeRecord.id, isRawExpanded)}
                      className="min-h-[36px] px-3 py-1 rounded-full text-xs font-medium text-[#528BCA] hover:bg-[#528BCA]/10 cursor-pointer transition-colors"
                    >
                      {isRawExpanded ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  {isRawExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-[#D5DDD8] grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                      {/* Left Pane: Raw Transcript */}
                      <section
                        aria-label="Raw Transcript"
                        className="rounded-3xl bg-[#FDFCF8] p-4 sm:p-5 shadow-sm flex flex-col h-full min-h-[300px] max-h-[420px] min-w-0"
                      >
                        <div className="shrink-0 flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-[#D5DDD8]">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-[#528BCA] shrink-0" />
                            <h4 className="font-heading text-base font-medium text-[#1C1B1F] truncate">
                              Raw Transcript
                            </h4>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E7ECE9] text-[#444846] tabular-nums shrink-0">
                            {activeRawWordCount} words
                          </span>
                        </div>

                        <div className="transcript-surface text-[#444846] whitespace-pre-wrap flex-1 min-h-0 overflow-y-auto pr-2 pb-3">
                          {activeRecord.transcript}
                        </div>
                      </section>

                      {/* Right Pane: Translated Transcript (English) */}
                      <section
                        aria-label="Translated Transcript"
                        className="rounded-3xl bg-[#FDFCF8] p-4 sm:p-5 shadow-sm flex flex-col h-full min-h-[300px] max-h-[420px] min-w-0"
                      >
                        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-[#D5DDD8]">
                          <div className="flex items-center gap-2 min-w-0">
                            <Languages className="w-4 h-4 text-[#4FA896] shrink-0" />
                            <h4 className="font-heading text-base font-medium text-[#1C1B1F] truncate">
                              Translated Transcript
                            </h4>
                            {activeRecord.translatedTranscript && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DDF3ED] text-[#133830] tabular-nums shrink-0">
                                {activeRecord.translatedWordCount ?? countWords(activeRecord.translatedTranscript)} words
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {activeRecord.translatedTranscript && !isEditingTranslated && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditedTranslatedText(activeRecord.translatedTranscript || '');
                                    setIsEditingTranslated(true);
                                  }}
                                  className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#E7ECE9] hover:bg-[#528BCA]/15 text-[#1C1B1F] cursor-pointer transition-colors"
                                  title="Edit translated transcript inline"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-[#528BCA]" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyTranslated(activeRecord.translatedTranscript!)}
                                  className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#E7ECE9] hover:bg-[#528BCA]/15 text-[#1C1B1F] cursor-pointer transition-colors"
                                  title="Copy translated transcript"
                                >
                                  {copiedTranslated ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-[#4FA896]" />
                                      <span className="text-[#133830]">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 text-[#444846]" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              disabled={isTranslatingActive || isRunningActive || isBatchCleaning}
                              onClick={() => handleTranslateRecord(activeRecord)}
                              className={`min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium cursor-pointer disabled:opacity-50 transition-all active:scale-95 whitespace-nowrap ${
                                activeRecord.translatedTranscript
                                  ? 'bg-[#DDF3ED] hover:bg-[#96D6C7]/60 text-[#133830]'
                                  : 'bg-[#528BCA] hover:bg-[#528BCA]/90 text-white shadow-2xs'
                              }`}
                            >
                              {isTranslatingActive ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Translating...</span>
                                </>
                              ) : activeRecord.translatedTranscript ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Re-Translate</span>
                                </>
                              ) : (
                                <>
                                  <Languages className="w-3.5 h-3.5" />
                                  <span>Translate</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {isTranslatingActive ? (
                          <div className="space-y-2.5 py-2" aria-busy="true" aria-label="Translating transcript">
                            <div className="h-3 bg-[#E7ECE9] rounded-full w-11/12" />
                            <div className="h-3 bg-[#E7ECE9] rounded-full w-full" />
                            <div className="h-3 bg-[#E7ECE9] rounded-full w-5/6" />
                            <div className="h-3 bg-[#E7ECE9] rounded-full w-4/6" />
                          </div>
                        ) : activeTranslationError ? (
                          <div
                            role="alert"
                            className="rounded-2xl bg-[#FBEAE9] p-3.5 space-y-2.5 text-sm text-[#7A3A36]"
                          >
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-[#D97A75] shrink-0 mt-0.5" />
                              <span className="leading-[1.65]">{activeTranslationError}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleTranslateRecord(activeRecord)}
                              className="min-h-[36px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FDFCF8] hover:bg-[#F2F5F3] text-[#7A3A36] text-xs font-medium cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Retry Translate
                            </button>
                          </div>
                        ) : isEditingTranslated ? (
                          <div className="space-y-2.5">
                            <textarea
                              value={editedTranslatedText}
                              onChange={(e) => setEditedTranslatedText(e.target.value)}
                              rows={7}
                              placeholder="Edit English translated transcript here..."
                              className="md3-field doc-editor transcript-surface w-full p-3.5"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setIsEditingTranslated(false)}
                                className="min-h-[36px] px-4 py-1.5 rounded-full text-xs font-medium text-[#444846] hover:bg-[#528BCA]/10 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveManualTranslated}
                                disabled={!editedTranslatedText.trim()}
                                className="min-h-[36px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-[#528BCA] hover:bg-[#528BCA]/90 text-white disabled:opacity-50 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" /> Save Translation
                              </button>
                            </div>
                          </div>
                        ) : activeRecord.translatedTranscript ? (
                          <div className="flex flex-col flex-1 min-h-0 gap-2.5">
                            <div className="transcript-surface text-[#1C1B1F] whitespace-pre-wrap flex-1 min-h-0 overflow-y-auto pr-2 pb-3">
                              {activeRecord.translatedTranscript}
                            </div>
                            <div className="shrink-0 pt-2 border-t border-[#D5DDD8]/70 flex flex-wrap items-center justify-between gap-2 text-xs text-[#444846]">
                              <span>Pure English translation (timestamps, speakers, fillers &amp; phatics preserved)</span>
                              <button
                                type="button"
                                disabled={isRunningActive || isTranslatingActive || isBatchCleaning}
                                onClick={() => runCleanTextForRecord(activeRecord)}
                                className="min-h-[32px] inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#DDF3ED] hover:bg-[#96D6C7]/60 text-[#133830] font-medium cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>{activeRecord.cleanedTranscript ? 'Re-Clean from Translation' : 'Clean from Translation'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 px-3 text-center space-y-2">
                            <p className="text-sm text-[#444846] leading-[1.65]">
                              No English translation saved yet. Click <strong className="font-medium text-[#1C1B1F]">Translate</strong> to translate this transcript while preserving brands and venues, or run <strong className="font-medium text-[#1C1B1F]">Clean Transcript</strong>.
                            </p>
                          </div>
                        )}
                      </section>
                    </div>
                  )}
                </div>

                {/* Single Cleaned Transcript Panel Below Raw Transcript */}
                <div className="p-5 flex-1 bg-white">
                  {isEditingCleaned ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-heading text-base font-bold text-[#292524] flex items-center gap-1.5">
                          <Edit3 className="w-4 h-4 text-[#528BCA]" /> Edit Cleaned Transcript Manually
                        </span>
                        <button
                          type="button"
                          onClick={() => cleanedFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-full border border-[#EAE6DF] text-[#292524] hover:bg-[#F7F5F0] cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload .txt
                        </button>
                      </div>

                      <textarea
                        value={editedCleanedText}
                        onChange={(e) => setEditedCleanedText(e.target.value)}
                        rows={11}
                        placeholder="Paste or edit cleaned transcript text here..."
                        className="md3-field doc-editor transcript-surface w-full p-4"
                      />

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingCleaned(false)}
                          className="px-4 py-2 text-sm font-semibold text-[#57534E] hover:bg-[#F7F5F0] rounded-full cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveManualCleaned()}
                          disabled={!editedCleanedText.trim()}
                          className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white rounded-full cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                          <Check className="w-4 h-4" /> Save Manual Edit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl bg-[#FDFCF8] p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 mb-3 border-b border-[#D5DDD8]">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#4FA896] shrink-0" />
                          <span className="font-heading text-lg font-medium text-[#1C1B1F]">Cleaned Transcript</span>
                        </div>
                        <div className="text-xs text-[#444846] tabular-nums">
                          {isRunningActive ? (
                            <span>Running 6-step Clean Text pipeline...</span>
                          ) : activeRecord.cleanedTranscript ? (
                            <span>
                              {activeCleanedWordCount} words · -{activeRemovedWordCount} removed · {activePronounsCount} pronouns preserved
                            </span>
                          ) : activeError ? (
                            <span className="text-[#7A3A36] font-semibold">Cleaning failed</span>
                          ) : (
                            <span>Pending</span>
                          )}
                        </div>
                      </div>

                      {isRunningActive ? (
                        <div className="space-y-2.5 py-2" aria-busy="true" aria-label="Cleaning transcript in progress">
                          <div className="h-3 bg-[#F7F5F0] rounded-full w-11/12" />
                          <div className="h-3 bg-[#F7F5F0] rounded-full w-full" />
                          <div className="h-3 bg-[#F7F5F0] rounded-full w-5/6" />
                          <div className="h-3 bg-[#F7F5F0] rounded-full w-4/6" />
                        </div>
                      ) : activeError ? (
                        <div className="rounded-2xl bg-[#FDF4F3] border border-[#D97A75]/45 p-4 space-y-2.5 text-base text-[#7A3A36]">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-[#D97A75] shrink-0 mt-1" />
                            <span>{activeError}</span>
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => runCleanTextForRecord(activeRecord)}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#D97A75]/45 bg-white hover:bg-[#FBEAE9] text-[#7A3A36] text-sm font-semibold cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Retry Clean Text
                            </button>
                          </div>
                        </div>
                      ) : activeRecord.cleanedTranscript ? (
                        <div className="transcript-surface whitespace-pre-wrap max-h-[460px] overflow-y-auto pr-1">
                          {activeRecord.cleanedTranscript}
                        </div>
                      ) : (
                        <div className="py-12 text-center space-y-2.5">
                          <Sparkles className="w-8 h-8 text-[#96D6C7] mx-auto" />
                          <h4 className="text-lg font-bold text-[#292524]">
                            Ready to clean this transcript
                          </h4>
                          <p className="text-base text-[#78716C] max-w-md mx-auto leading-relaxed">
                            Click Clean Transcript above to strip filler words and keep participant voices clear.
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
