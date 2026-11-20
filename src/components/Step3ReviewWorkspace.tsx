import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Edit3,
  Radar,
  Keyboard,
  FileText,
  Tags,
} from 'lucide-react';
import type {
  ADKOTMDecode,
  ADKOTMDimensionKey,
  ADKOTMFieldItem,
  InterviewRecord,
  MissedSignalSuggestion,
} from '../types';
import {
  ADKOTM_DIMENSION_STYLES,
  ADKOTM_PARAMETER_CATALOG,
  ADKOTM_PARAM_MAP,
  buildTranscriptHighlightSegments,
  computeReviewProgress,
  ensureFieldStates,
  scanMissedSignals,
  stripRecordingExtension,
  syncFlatDecodeFromFieldStates,
} from '../lib/adkotmCopilot';

interface Step3ReviewWorkspaceProps {
  records: InterviewRecord[];
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
  onUpdateRecord: (updated: InterviewRecord) => void;
  onDecodeSingle: (record: InterviewRecord) => Promise<void>;
  onDecodeAll?: () => void;
  isBatchDecoding?: boolean;
  decodingId: string | null;
  safePostJson: <T = any>(url: string, payload: any) => Promise<T>;
  onOpenAnalytics?: () => void;
  onOpenNormalizeTags?: () => void;
  normalizationProposalsCount?: number;
  onOpenAddDecode?: () => void;
}

const POPOVER_DIMENSIONS: { key: ADKOTMDimensionKey; label: string; buttonClass: string }[] = [
  { key: 'O', label: '+ Tag as Object', buttonClass: 'hover:bg-orange-50 text-orange-800 border-orange-200' },
  { key: 'A', label: '+ Tag as Activity', buttonClass: 'hover:bg-emerald-50 text-emerald-800 border-emerald-200' },
  { key: 'K', label: '+ Tag as Knowledge', buttonClass: 'hover:bg-purple-50 text-purple-800 border-purple-200' },
  { key: 'D', label: '+ Tag as Demographic', buttonClass: 'hover:bg-blue-50 text-blue-800 border-blue-200' },
  { key: 'T', label: '+ Tag as Timing', buttonClass: 'hover:bg-rose-50 text-rose-800 border-rose-200' },
];

export const Step3ReviewWorkspace: React.FC<Step3ReviewWorkspaceProps> = ({
  records,
  selectedRecordId,
  onSelectRecord,
  onUpdateRecord,
  onDecodeSingle,
  onDecodeAll,
  isBatchDecoding = false,
  decodingId,
  safePostJson,
  onOpenAnalytics,
  onOpenNormalizeTags,
  normalizationProposalsCount = 0,
  onOpenAddDecode,
}) => {
  // Sidebar collapsible groups
  const [needsReviewExpanded, setNeedsReviewExpanded] = useState(true);
  const [verifiedExpanded, setVerifiedExpanded] = useState(true);

  // Hover-sync and keyboard row selection
  const [hoveredFieldKey, setHoveredFieldKey] = useState<string | null>(null);
  const [focusedFieldKey, setFocusedFieldKey] = useState<string | null>(null);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [showNullFields, setShowNullFields] = useState(false);
  const [isScanningSignals, setIsScanningSignals] = useState(false);

  // Click-to-code floating selection popover
  const [selectionPopover, setSelectionPopover] = useState<{
    quote: string;
    top: number;
    left: number;
    chosenDimension: ADKOTMDimensionKey | null;
    chosenFieldKey: string;
    manualCode: string;
  } | null>(null);

  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const codingSheetRef = useRef<HTMLDivElement>(null);

  // Triage grouping: Needs Review (includes needs_review + unprocessed) vs Verified
  const { needsReviewList, verifiedList } = useMemo(() => {
    const needs: { record: InterviewRecord; progress: ReturnType<typeof computeReviewProgress> }[] = [];
    const verified: { record: InterviewRecord; progress: ReturnType<typeof computeReviewProgress> }[] = [];

    for (const r of records) {
      const progress = computeReviewProgress(r);
      if (progress.status === 'human_verified') {
        verified.push({ record: r, progress });
      } else {
        needs.push({ record: r, progress });
      }
    }

    // Sort needs_review before unprocessed
    needs.sort((a, b) => {
      if (a.progress.status === b.progress.status) return 0;
      return a.progress.status === 'needs_review' ? -1 : 1;
    });

    return { needsReviewList: needs, verifiedList: verified };
  }, [records]);

  const activeRecord = useMemo(() => {
    return (
      records.find((r) => r.id === selectedRecordId) ||
      needsReviewList[0]?.record ||
      verifiedList[0]?.record ||
      null
    );
  }, [records, selectedRecordId, needsReviewList, verifiedList]);

  const activeProgress = useMemo(
    () => (activeRecord ? computeReviewProgress(activeRecord) : null),
    [activeRecord]
  );

  const activeTranscript = activeRecord?.cleanedTranscript || activeRecord?.transcript || '';

  const activeFieldStates = useMemo<Record<string, ADKOTMFieldItem>>(() => {
    if (!activeRecord?.adkotmDecode) return {};
    return ensureFieldStates(
      activeRecord.adkotmDecode,
      activeRecord.reviewStatus === 'human_verified' ? 'ACCEPTED' : 'STAGED'
    );
  }, [activeRecord]);

  // Populated vs Null parameters
  const { populatedParams, nullParams } = useMemo(() => {
    const populated: { param: (typeof ADKOTM_PARAMETER_CATALOG)[number]; item: ADKOTMFieldItem }[] = [];
    const nulls: { param: (typeof ADKOTM_PARAMETER_CATALOG)[number]; item: ADKOTMFieldItem }[] = [];

    for (const param of ADKOTM_PARAMETER_CATALOG) {
      const item = activeFieldStates[param.key] || {
        code: null,
        evidence_quote: null,
        confidence: 'NULL' as const,
        status: 'STAGED' as const,
      };
      if (item.code && item.status !== 'REJECTED') {
        populated.push({ param, item });
      } else {
        nulls.push({ param, item });
      }
    }

    // Put REVIEW_NEEDED items near the top for faster triage, then standard ADKOTM order
    populated.sort((a, b) => {
      const aNeeds = a.item.confidence === 'REVIEW_NEEDED' && a.item.status === 'STAGED' ? 0 : 1;
      const bNeeds = b.item.confidence === 'REVIEW_NEEDED' && b.item.status === 'STAGED' ? 0 : 1;
      return aNeeds - bNeeds;
    });

    return { populatedParams: populated, nullParams: nulls };
  }, [activeFieldStates]);

  // Missed signals (computed live if not yet stored or filtered against dismissed/already-coded)
  const activeMissedSignals = useMemo<MissedSignalSuggestion[]>(() => {
    if (!activeRecord?.adkotmDecode || !activeTranscript) return [];
    const dismissed = activeRecord.adkotmDecode.dismissedSignalIds || [];
    const stored = activeRecord.adkotmDecode.missedSignals;
    const liveDeterministic = scanMissedSignals(activeTranscript, activeFieldStates, dismissed);

    if (!stored || stored.length === 0) return liveDeterministic;

    const merged = [...liveDeterministic];
    for (const s of stored) {
      if (dismissed.includes(s.id)) continue;
      const existing = activeFieldStates[s.suggestedFieldKey];
      if (existing && existing.status !== 'REJECTED' && existing.code) continue;
      if (!merged.some((m) => m.id === s.id)) {
        merged.push(s);
      }
    }
    return merged;
  }, [activeRecord, activeTranscript, activeFieldStates]);

  const transcriptSegments = useMemo(
    () => buildTranscriptHighlightSegments(activeTranscript, activeFieldStates),
    [activeTranscript, activeFieldStates]
  );

  // Reset ephemeral UI states when switching record
  useEffect(() => {
    setEditingFieldKey(null);
    setHoveredFieldKey(null);
    setSelectionPopover(null);
    setShowNullFields(false);
    setFocusedFieldKey(populatedParams[0]?.param.key || null);
  }, [activeRecord?.id]);

  // Hover-sync: scroll matching evidence_quote span into view in Center Pane
  useEffect(() => {
    if (!hoveredFieldKey || !transcriptContainerRef.current) return;
    const target =
      (transcriptContainerRef.current.querySelector(
        `[data-quote-fields~="${hoveredFieldKey}"]`
      ) as HTMLElement | null) ||
      (transcriptContainerRef.current.querySelector(
        `[data-quote-field="${hoveredFieldKey}"]`
      ) as HTMLElement | null);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [hoveredFieldKey]);

  // Keep keyboard-focused parameter card visible in Right Pane
  const scrollFocusedParamIntoView = useCallback((key: string) => {
    requestAnimationFrame(() => {
      const row = codingSheetRef.current?.querySelector(
        `[data-param-row="${key}"]`
      ) as HTMLElement | null;
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  // Commit updated fieldStates back onto record
  const commitFieldStates = useCallback(
    (
      nextFieldStates: Record<string, ADKOTMFieldItem>,
      options?: {
        nextReviewStatus?: 'unprocessed' | 'needs_review' | 'human_verified';
        dismissedSignalId?: string;
      }
    ) => {
      if (!activeRecord) return;
      const baseDecode: ADKOTMDecode = activeRecord.adkotmDecode || syncFlatDecodeFromFieldStates(nextFieldStates);
      const dismissedSignalIds = options?.dismissedSignalId
        ? Array.from(new Set([...(baseDecode.dismissedSignalIds || []), options.dismissedSignalId]))
        : baseDecode.dismissedSignalIds || [];

      const updatedMissed = scanMissedSignals(activeTranscript, nextFieldStates, dismissedSignalIds);
      const syncedDecode = syncFlatDecodeFromFieldStates(nextFieldStates, {
        ...baseDecode,
        missedSignals: updatedMissed,
        dismissedSignalIds,
      });

      const nextReviewStatus =
        options?.nextReviewStatus ??
        (activeRecord.reviewStatus === 'human_verified' ? 'human_verified' : 'needs_review');

      onUpdateRecord({
        ...activeRecord,
        decodeStatus: 'decoded',
        reviewStatus: nextReviewStatus,
        verifiedAt: nextReviewStatus === 'human_verified' ? new Date().toISOString() : activeRecord.verifiedAt,
        adkotmDecode: syncedDecode,
      });
    },
    [activeRecord, activeTranscript, onUpdateRecord]
  );

  const handleAcceptField = useCallback(
    (fieldKey: string) => {
      if (!activeRecord?.adkotmDecode) return;
      const current = activeFieldStates[fieldKey];
      if (!current || !current.code) return;
      const nextStates: Record<string, ADKOTMFieldItem> = {
        ...activeFieldStates,
        [fieldKey]: {
          ...current,
          confidence: 'HIGH',
          status: current.status === 'MANUAL' ? 'MANUAL' : 'ACCEPTED',
        },
      };
      commitFieldStates(nextStates);
    },
    [activeRecord, activeFieldStates, commitFieldStates]
  );

  const handleRejectField = useCallback(
    (fieldKey: string) => {
      if (!activeRecord?.adkotmDecode) return;
      const current = activeFieldStates[fieldKey];
      const nextStates: Record<string, ADKOTMFieldItem> = {
        ...activeFieldStates,
        [fieldKey]: {
          code: null,
          evidence_quote: null,
          confidence: 'NULL',
          status: 'REJECTED',
          reasoning: current?.reasoning || null,
        },
      };
      commitFieldStates(nextStates);
      if (editingFieldKey === fieldKey) setEditingFieldKey(null);
    },
    [activeRecord, activeFieldStates, commitFieldStates, editingFieldKey]
  );

  const handleStartInlineEdit = useCallback(
    (fieldKey: string) => {
      const current = activeFieldStates[fieldKey];
      setEditingFieldKey(fieldKey);
      setEditingValue(current?.code || '');
    },
    [activeFieldStates]
  );

  const handleSaveInlineEdit = useCallback(
    (fieldKey: string) => {
      if (!activeRecord) return;
      const trimmed = editingValue.trim();
      if (!trimmed) {
        handleRejectField(fieldKey);
        return;
      }
      const prev = activeFieldStates[fieldKey];
      const nextStates: Record<string, ADKOTMFieldItem> = {
        ...activeFieldStates,
        [fieldKey]: {
          code: trimmed,
          evidence_quote: prev?.evidence_quote || null,
          confidence: 'HIGH',
          status: 'MANUAL',
          reasoning: prev?.reasoning || 'Edited by researcher',
          source: prev?.source || 'manual',
        },
      };
      commitFieldStates(nextStates);
      setEditingFieldKey(null);
    },
    [activeRecord, editingValue, activeFieldStates, commitFieldStates, handleRejectField]
  );

  const handleApplyMissedSignal = (signal: MissedSignalSuggestion) => {
    const nextStates: Record<string, ADKOTMFieldItem> = {
      ...activeFieldStates,
      [signal.suggestedFieldKey]: {
        code: signal.suggestedCode,
        evidence_quote: signal.sentence,
        confidence: 'HIGH',
        status: 'ACCEPTED',
        reasoning: signal.reason,
        source: 'transcript',
      },
    };
    commitFieldStates(nextStates, { dismissedSignalId: signal.id });
    setFocusedFieldKey(signal.suggestedFieldKey);
  };

  const handleDismissMissedSignal = (signalId: string) => {
    commitFieldStates(activeFieldStates, { dismissedSignalId: signalId });
  };

  const handleScanMissedSignals = async () => {
    if (!activeRecord || !activeTranscript) return;
    setIsScanningSignals(true);
    try {
      const res = await safePostJson<{ success: boolean; missedSignals: MissedSignalSuggestion[] }>(
        '/api/copilot/missed-signals',
        {
          transcript: activeTranscript,
          fieldStates: activeFieldStates,
          dismissedIds: activeRecord.adkotmDecode?.dismissedSignalIds || [],
        }
      );
      if (res.success && Array.isArray(res.missedSignals) && activeRecord.adkotmDecode) {
        onUpdateRecord({
          ...activeRecord,
          adkotmDecode: {
            ...activeRecord.adkotmDecode,
            missedSignals: res.missedSignals,
          },
        });
      }
    } catch (err) {
      console.warn('Missed signal scan failed, using local scanner:', err);
    } finally {
      setIsScanningSignals(false);
    }
  };

  const handleVerifyAndNext = () => {
    if (!activeRecord) return;
    const nextStates: Record<string, ADKOTMFieldItem> = { ...activeFieldStates };
    for (const [key, item] of Object.entries(nextStates)) {
      if (item && item.code && item.status === 'STAGED') {
        nextStates[key] = {
          ...item,
          confidence: 'HIGH',
          status: 'ACCEPTED',
        };
      }
    }

    commitFieldStates(nextStates, { nextReviewStatus: 'human_verified' });

    // Advance to the next interview needing review
    const nextCandidate = needsReviewList.find((n) => n.record.id !== activeRecord.id);
    if (nextCandidate) {
      onSelectRecord(nextCandidate.record.id);
    }
  };

  // Click-to-Code Selection handler on Center Pane
  const handleTranscriptMouseUp = () => {
    if (!activeRecord || !transcriptContainerRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
    if (selectedText.length < 2) return;

    const range = selection.getRangeAt(0);
    if (!transcriptContainerRef.current.contains(range.commonAncestorContainer)) return;

    const rect = range.getBoundingClientRect();
    const containerRect = transcriptContainerRef.current.getBoundingClientRect();

    const top = Math.max(8, rect.bottom - containerRect.top + transcriptContainerRef.current.scrollTop + 8);
    const left = Math.min(
      Math.max(12, rect.left - containerRect.left),
      Math.max(12, containerRect.width - 310)
    );

    setSelectionPopover({
      quote: selectedText,
      top,
      left,
      chosenDimension: null,
      chosenFieldKey: 'productsPurchased',
      manualCode: selectedText.length <= 42 ? selectedText : '',
    });
  };

  const handleChoosePopoverDimension = (dim: ADKOTMDimensionKey) => {
    if (!selectionPopover) return;
    const dimParams = ADKOTM_PARAMETER_CATALOG.filter((p) => p.dimension === dim);
    const defaultParam = dimParams.find((p) => p.defaultForPopover) || dimParams[0];
    setSelectionPopover({
      ...selectionPopover,
      chosenDimension: dim,
      chosenFieldKey: defaultParam?.key || 'productsPurchased',
    });
  };

  const handleCommitPopoverCode = () => {
    if (!selectionPopover || !activeRecord) return;
    const codeText = selectionPopover.manualCode.trim() || selectionPopover.quote.slice(0, 60);
    const fieldKey = selectionPopover.chosenFieldKey;

    const baseStates = activeRecord.adkotmDecode
      ? activeFieldStates
      : ensureFieldStates(undefined, 'MANUAL');

    const nextStates: Record<string, ADKOTMFieldItem> = {
      ...baseStates,
      [fieldKey]: {
        code: codeText,
        evidence_quote: selectionPopover.quote,
        confidence: 'HIGH',
        status: 'MANUAL',
        reasoning: 'Coded from transcript highlight selection',
        source: 'manual',
      },
    };

    commitFieldStates(nextStates);
    setSelectionPopover(null);
    setFocusedFieldKey(fieldKey);
    window.getSelection()?.removeAllRanges();
  };

  // Keyboard shortcuts for Right Pane Coding Sheet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape' && selectionPopover) {
        e.preventDefault();
        setSelectionPopover(null);
        return;
      }

      if (!activeRecord?.adkotmDecode || populatedParams.length === 0) return;
      const keys = populatedParams.map((p) => p.param.key);
      const currentIdx = focusedFieldKey ? keys.indexOf(focusedFieldKey) : -1;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIdx = currentIdx < keys.length - 1 ? currentIdx + 1 : 0;
        const nextKey = keys[nextIdx];
        setFocusedFieldKey(nextKey);
        setHoveredFieldKey(nextKey);
        scrollFocusedParamIntoView(nextKey);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : keys.length - 1;
        const prevKey = keys[prevIdx];
        setFocusedFieldKey(prevKey);
        setHoveredFieldKey(prevKey);
        scrollFocusedParamIntoView(prevKey);
      } else if (e.key === 'Enter' && focusedFieldKey && keys.includes(focusedFieldKey)) {
        e.preventDefault();
        handleAcceptField(focusedFieldKey);
      } else if ((e.key === 'e' || e.key === 'E') && focusedFieldKey && keys.includes(focusedFieldKey)) {
        e.preventDefault();
        handleStartInlineEdit(focusedFieldKey);
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && focusedFieldKey && keys.includes(focusedFieldKey)) {
        e.preventDefault();
        handleRejectField(focusedFieldKey);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeRecord,
    populatedParams,
    focusedFieldKey,
    selectionPopover,
    scrollFocusedParamIntoView,
    handleAcceptField,
    handleRejectField,
    handleStartInlineEdit,
  ]);

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-2xs space-y-3">
        <FileText className="w-8 h-8 text-stone-300 mx-auto" />
        <div>
          <h3 className="text-sm font-bold text-stone-800">No interview transcripts ready to review</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
            Import recordings in Step 1 or clean transcripts in Step 2, or manually add a decoded entry to start ADKOTM review.
          </p>
        </div>
        {onOpenAddDecode && (
          <button
            type="button"
            onClick={onOpenAddDecode}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> Add Decode
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-stretch min-h-[540px]">
      {/* 1. Slim Left Triage Column (~235px) */}
      <div className="w-full lg:w-[235px] shrink-0 flex flex-col gap-2">
        {/* Desktop alignment spacer matching right outer toolbar */}
        <div className="hidden lg:block lg:min-h-9" aria-hidden="true" />

        <aside
          aria-label="Interview review queue"
          className="bg-white rounded-2xl border border-stone-200 shadow-2xs flex flex-col overflow-hidden lg:h-[calc(100vh-230px)] lg:min-h-[540px] lg:max-h-[700px]"
        >
        <div className="px-3.5 py-3 border-b border-stone-200 bg-stone-50/70 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
            Triage Queue
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-stone-500">
            {verifiedList.length}/{records.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 max-h-[320px] lg:max-h-none">
          {/* Section 1: Needs Review */}
          <div className="p-2">
            <button
              type="button"
              onClick={() => setNeedsReviewExpanded((v) => !v)}
              aria-expanded={needsReviewExpanded}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                {needsReviewExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                )}
                Needs Review
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums bg-amber-100 text-amber-800">
                {needsReviewList.length}
              </span>
            </button>

            {needsReviewExpanded && (
              <div className="mt-1 space-y-1">
                {needsReviewList.length === 0 ? (
                  <p className="px-2 py-2 text-[11px] text-stone-400 italic">
                    All interviews verified
                  </p>
                ) : (
                  needsReviewList.map(({ record, progress }) => {
                    const isSelected = record.id === activeRecord?.id;
                    const isDecoding = decodingId === record.id;
                    return (
                      <button
                        key={record.id}
                        type="button"
                        onClick={() => onSelectRecord(record.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200'
                            : 'bg-white border-transparent hover:bg-stone-50 hover:border-stone-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-semibold text-stone-900 truncate">
                            {stripRecordingExtension(record.fileName)}
                          </span>
                          {isDecoding && (
                            <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1.5 mt-1">
                          <span className="text-[10px] text-stone-400 truncate">
                            {record.folderName || record.sessionDate || 'Session'}
                          </span>
                          {progress.status === 'unprocessed' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-500 whitespace-nowrap shrink-0">
                              Unprocessed
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums bg-amber-100 text-amber-800 whitespace-nowrap shrink-0">
                              {progress.flagCount > 0
                                ? `${progress.flagCount} flag${progress.flagCount > 1 ? 's' : ''}`
                                : `${progress.stagedCount} draft`}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Section 2: Verified */}
          <div className="p-2">
            <button
              type="button"
              onClick={() => setVerifiedExpanded((v) => !v)}
              aria-expanded={verifiedExpanded}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                {verifiedExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                )}
                Verified
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums bg-emerald-100 text-emerald-800">
                {verifiedList.length}
              </span>
            </button>

            {verifiedExpanded && (
              <div className="mt-1 space-y-1">
                {verifiedList.length === 0 ? (
                  <p className="px-2 py-2 text-[11px] text-stone-400 italic">
                    Verify drafts to unlock analytics
                  </p>
                ) : (
                  verifiedList.map(({ record }) => {
                    const isSelected = record.id === activeRecord?.id;
                    return (
                      <button
                        key={record.id}
                        type="button"
                        onClick={() => onSelectRecord(record.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                            : 'bg-white border-transparent hover:bg-stone-50 hover:border-stone-200'
                        }`}
                      >
                        <div className="text-xs font-semibold text-stone-900 truncate">
                          {stripRecordingExtension(record.fileName)}
                        </div>
                        <div className="flex items-center justify-between gap-1.5 mt-1">
                          <span className="text-[10px] text-stone-400 truncate">
                            {record.folderName || record.sessionDate || 'Session'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0">
                            ✓ Verified
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
        </aside>
      </div>

      {/* Split-Screen 2-Pane Workspace (50% Center Transcript / 50% Right Coding Sheet) */}
      {activeRecord && (
        <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 2. Center Column (50%): Interactive Cleaned Transcript */}
          <div className="flex flex-col gap-2 min-w-0">
            {/* Desktop alignment spacer matching left/right outer toolbars */}
            <div className="hidden lg:block lg:min-h-9" aria-hidden="true" />
            <section
              aria-label="Cleaned transcript inspector"
              className="bg-white rounded-2xl border border-stone-200 shadow-2xs flex flex-col overflow-hidden h-[580px] lg:h-[calc(100vh-230px)] lg:min-h-[540px] lg:max-h-[700px]"
            >
            <div className="px-4 py-3 border-b border-stone-200 bg-stone-50/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-stone-900 truncate">
                  {stripRecordingExtension(activeRecord.fileName)}
                </h3>
                <p className="text-[11px] text-stone-500">
                  Highlight any uncoded phrase to tag it directly into ADKOTM
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['O', 'A', 'K', 'D', 'T'] as ADKOTMDimensionKey[]).map((dim) => {
                  const style = ADKOTM_DIMENSION_STYLES[dim];
                  return (
                    <span
                      key={dim}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-600 px-1.5 py-0.5 rounded bg-white border border-stone-200"
                    >
                      <span className={`w-2 h-2 rounded-full ${style.dotClass}`} />
                      {style.name}
                    </span>
                  );
                })}
              </div>
            </div>

            <div
              ref={transcriptContainerRef}
              onMouseDown={() => {
                if (selectionPopover) {
                  setSelectionPopover(null);
                }
              }}
              onMouseUp={handleTranscriptMouseUp}
              className="relative flex-1 overflow-y-auto p-5 text-[13.5px] leading-relaxed text-stone-800 whitespace-pre-wrap select-text"
            >
              {!activeTranscript ? (
                <div className="py-12 text-center text-xs text-stone-400">
                  No transcript text available for this record yet.
                </div>
              ) : (
                transcriptSegments.map((seg, idx) => {
                  if (!seg.fieldKey || !seg.dimension) {
                    return <span key={idx}>{seg.text}</span>;
                  }
                  const dimStyle = ADKOTM_DIMENSION_STYLES[seg.dimension];
                  const segKeys = seg.fieldKeys && seg.fieldKeys.length > 0 ? seg.fieldKeys : [seg.fieldKey];
                  const isHovered = Boolean(hoveredFieldKey && segKeys.includes(hoveredFieldKey));
                  const isFocused = Boolean(focusedFieldKey && segKeys.includes(focusedFieldKey));
                  return (
                    <mark
                      key={`${seg.fieldKey}-${idx}`}
                      data-quote-field={seg.fieldKey}
                      data-quote-fields={segKeys.join(' ')}
                      onClick={() => {
                        setFocusedFieldKey(seg.fieldKey || null);
                        setHoveredFieldKey(seg.fieldKey || null);
                      }}
                      title={`${seg.label || seg.fieldKey} (${dimStyle.name})`}
                      className={`rounded px-1 py-0.5 cursor-pointer transition-all duration-200 ${
                        isHovered
                          ? `${dimStyle.activeHighlightClass} shadow-xs animate-pulse`
                          : isFocused
                          ? dimStyle.activeHighlightClass
                          : dimStyle.highlightClass
                      }`}
                    >
                      {seg.text}
                    </mark>
                  );
                })
              )}

              {/* Floating Click-to-Code Popover */}
              {selectionPopover && (
                <div
                  style={{ top: selectionPopover.top, left: selectionPopover.left }}
                  className="absolute z-30 w-[300px] bg-white rounded-xl border border-stone-300 shadow-xl p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] text-stone-500 italic line-clamp-2">
                      "{selectionPopover.quote}"
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectionPopover(null)}
                      aria-label="Close tag selection popover"
                      className="text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!selectionPopover.chosenDimension ? (
                    <div className="grid grid-cols-1 gap-1">
                      {POPOVER_DIMENSIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handleChoosePopoverDimension(opt.key)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${opt.buttonClass}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1 border-t border-stone-100">
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                          Target Parameter
                        </label>
                        <select
                          value={selectionPopover.chosenFieldKey}
                          onChange={(e) =>
                            setSelectionPopover({
                              ...selectionPopover,
                              chosenFieldKey: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-stone-300 bg-white"
                        >
                          {ADKOTM_PARAMETER_CATALOG.filter(
                            (p) => p.dimension === selectionPopover.chosenDimension
                          ).map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                          Analytical Code
                        </label>
                        <input
                          type="text"
                          autoFocus
                          value={selectionPopover.manualCode}
                          onChange={(e) =>
                            setSelectionPopover({
                              ...selectionPopover,
                              manualCode: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCommitPopoverCode();
                            } else if (e.key === 'Escape') {
                              setSelectionPopover(null);
                            }
                          }}
                          placeholder="Concise analytical label..."
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectionPopover({ ...selectionPopover, chosenDimension: null })
                          }
                          className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 cursor-pointer"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleCommitPopoverCode}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Save Code
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
          </div>

          {/* 3. Right Column (50%): Normalize Tags, Add Decode & AI Draft All toolbar above ADKOTM Copilot Coding Sheet */}
          <div className="flex flex-col gap-2 min-w-0">
            {(onOpenNormalizeTags || onOpenAddDecode || onDecodeAll) && (
              <div className="flex flex-wrap items-center justify-end gap-2 lg:min-h-9">
                {onOpenNormalizeTags && (
                  <button
                    type="button"
                    onClick={onOpenNormalizeTags}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 shadow-2xs cursor-pointer transition-all whitespace-nowrap shrink-0"
                    title="Standardize fragmented Product [PP] labels across records while keeping Brands [PP1]"
                  >
                    <Tags className="w-3.5 h-3.5 text-amber-600" />
                    <span>Normalize Tags</span>
                    {normalizationProposalsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 tabular-nums">
                        {normalizationProposalsCount}
                      </span>
                    )}
                  </button>
                )}

                {onOpenAddDecode && (
                  <button
                    type="button"
                    onClick={onOpenAddDecode}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 shadow-2xs cursor-pointer transition-all whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-600" /> Add Decode
                  </button>
                )}

                {onDecodeAll && (
                  <button
                    type="button"
                    disabled={isBatchDecoding || records.length === 0}
                    onClick={onDecodeAll}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white shadow-xs cursor-pointer transition-all whitespace-nowrap shrink-0"
                  >
                    {isBatchDecoding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Auto-Tagging...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Auto-Tag All ({records.length})
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            <section
              aria-label="ADKOTM Copilot Coding Sheet"
              className="bg-white rounded-2xl border border-stone-200 shadow-2xs flex flex-col overflow-hidden h-[580px] lg:h-[calc(100vh-230px)] lg:min-h-[540px] lg:max-h-[700px]"
            >
              {/* Coding Sheet Header */}
              <div className="px-4 py-3 border-b border-stone-200 bg-stone-50/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-stone-900 whitespace-nowrap">
                    Copilot Coding Sheet
                  </span>
                  {activeProgress?.status === 'human_verified' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> Human Verified
                    </span>
                  ) : activeProgress?.status === 'needs_review' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
                      Copilot Draft • {activeProgress.populatedCount} coded
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600 whitespace-nowrap shrink-0">
                      Unprocessed
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isScanningSignals || !activeTranscript}
                    onClick={handleScanMissedSignals}
                    title="Scan cleaned transcript for uncoded behavioral, brand, or health cues"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {isScanningSignals ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Radar className="w-3 h-3 text-amber-600" />
                    )}
                    Scan Gaps
                  </button>
                </div>
              </div>

            {/* Coding Sheet Body */}
            <div ref={codingSheetRef} className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {!activeRecord.adkotmDecode ? (
                <div className="py-16 text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-amber-500 mx-auto opacity-80" />
                  <div>
                    <h4 className="text-sm font-bold text-stone-800">
                      Ready for Copilot Draft
                    </h4>
                    <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                      Gemini will stage ADKOTM parameters with verbatim evidence quotes for your verification. Unstated parameters stay strictly null.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={decodingId === activeRecord.id || !activeTranscript}
                    onClick={() => onDecodeSingle(activeRecord)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white shadow-xs cursor-pointer"
                  >
                    {decodingId === activeRecord.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Drafting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" /> Run Copilot Draft
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <>
                  {/* Populated Parameter Rows */}
                  {populatedParams.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-stone-200 text-center text-xs text-stone-500">
                      All extracted parameters were rejected or unstated. Highlight text in the transcript or expand unstated fields below to add codes manually.
                    </div>
                  ) : (
                    populatedParams.map(({ param, item }) => {
                      const dimStyle = ADKOTM_DIMENSION_STYLES[param.dimension];
                      const isReviewNeeded =
                        item.confidence === 'REVIEW_NEEDED' && item.status === 'STAGED';
                      const isAccepted = item.status === 'ACCEPTED' || item.status === 'MANUAL';
                      const isFocused = focusedFieldKey === param.key;
                      const isEditingThis = editingFieldKey === param.key;

                      return (
                        <div
                          key={param.key}
                          data-param-row={param.key}
                          onMouseEnter={() => setHoveredFieldKey(param.key)}
                          onMouseLeave={() => setHoveredFieldKey(null)}
                          onClick={() => setFocusedFieldKey(param.key)}
                          className={`rounded-xl border p-3 transition-all ${
                            isReviewNeeded
                              ? 'border-l-4 border-l-amber-400 border-stone-200 bg-amber-50/35'
                              : isAccepted
                              ? 'border-stone-200 bg-emerald-50/20'
                              : 'border-stone-200 bg-white'
                          } ${isFocused ? 'ring-2 ring-amber-400/60' : 'hover:border-stone-300'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${dimStyle.badgeClass}`}
                              >
                                {param.dimension}
                              </span>
                              <span className="text-xs font-bold text-stone-800 truncate">
                                {param.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isReviewNeeded ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Review
                                </span>
                              ) : item.status === 'MANUAL' ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  Manual
                                </span>
                              ) : item.status === 'ACCEPTED' ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Accepted
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-600">
                                  Copilot Draft
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Analytical Code (click-to-edit inline) */}
                          <div className="mt-2">
                            {isEditingThis ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveInlineEdit(param.key);
                                    } else if (e.key === 'Escape') {
                                      setEditingFieldKey(null);
                                    }
                                  }}
                                  aria-label={`Edit ${param.label} code`}
                                  className="flex-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-400 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveInlineEdit(param.key)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartInlineEdit(param.key);
                                }}
                                title="Click to edit analytical code inline"
                                className="w-full text-left group flex items-center justify-between gap-2 rounded-lg px-2 py-1 -mx-2 hover:bg-stone-100/80 cursor-text"
                              >
                                <span className="text-[13px] font-semibold text-stone-900 break-words">
                                  {item.code}
                                </span>
                                <Edit3 className="w-3 h-3 text-stone-300 group-hover:text-stone-500 shrink-0" />
                              </button>
                            )}
                          </div>

                          {/* 1-line muted evidence_quote preview */}
                          {item.evidence_quote && (
                            <p
                              className="mt-1 text-[11px] text-stone-500 italic truncate"
                              title={item.evidence_quote}
                            >
                              "{item.evidence_quote}"
                            </p>
                          )}

                          {/* Equal-weight Accept / Reject Buttons */}
                          <div className="mt-2.5 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptField(param.key);
                              }}
                              aria-label={`Accept ${param.label}`}
                              className={`inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                                isAccepted
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              {isAccepted ? 'Accepted' : 'Accept'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRejectField(param.key);
                              }}
                              aria-label={`Reject ${param.label}`}
                              className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold border bg-white hover:bg-rose-50 text-rose-700 border-stone-200 hover:border-rose-200 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Clickable Inline Missed-Signal Suggestions */}
                  {activeMissedSignals.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          Missed Signals Detected ({activeMissedSignals.length})
                        </span>
                      </div>
                      {activeMissedSignals.map((sig) => {
                        const targetParam = ADKOTM_PARAM_MAP.get(sig.suggestedFieldKey);
                        const dimStyle = ADKOTM_DIMENSION_STYLES[sig.suggestedDimension];
                        return (
                          <div
                            key={sig.id}
                            className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${dimStyle.badgeClass}`}
                                >
                                  {sig.suggestedDimension}
                                </span>
                                <span className="text-xs font-bold text-stone-800 truncate">
                                  {targetParam?.label || sig.suggestedFieldKey}
                                </span>
                              </div>
                              <span className="text-[10px] font-semibold text-amber-800 shrink-0">
                                Uncoded cue
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-stone-900">
                              Suggested code: {sig.suggestedCode}
                            </p>
                            <p className="text-[11px] text-stone-600 italic line-clamp-2">
                              "{sig.sentence}"
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleApplyMissedSignal(sig)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> Apply Code
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDismissMissedSignal(sig.id)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-stone-600 hover:bg-stone-200/70 cursor-pointer"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Subtle Toggle for Unstated (null) Fields */}
                  {nullParams.length > 0 && (
                    <div className="pt-2 border-t border-stone-100">
                      <button
                        type="button"
                        onClick={() => setShowNullFields((v) => !v)}
                        className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {showNullFields
                          ? `Hide ${nullParams.length} unstated (null) fields`
                          : `Show ${nullParams.length} unstated (null) fields`}
                      </button>

                      {showNullFields && (
                        <div className="mt-2 space-y-1.5">
                          {nullParams.map(({ param }) => {
                            const dimStyle = ADKOTM_DIMENSION_STYLES[param.dimension];
                            const isEditingThis = editingFieldKey === param.key;
                            return (
                              <div
                                key={param.key}
                                className="rounded-lg border border-stone-200/80 bg-stone-50/50 px-3 py-2 flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${dimStyle.badgeClass}`}
                                  >
                                    {param.dimension}
                                  </span>
                                  <span className="text-xs font-medium text-stone-600 truncate">
                                    {param.label}
                                  </span>
                                </div>

                                {isEditingThis ? (
                                  <div className="flex items-center gap-1.5 flex-1 max-w-[240px]">
                                    <input
                                      type="text"
                                      autoFocus
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleSaveInlineEdit(param.key);
                                        } else if (e.key === 'Escape') {
                                          setEditingFieldKey(null);
                                        }
                                      }}
                                      placeholder={param.placeholder || 'Enter code...'}
                                      className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-amber-400 bg-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveInlineEdit(param.key)}
                                      className="px-2 py-1 rounded text-[11px] font-bold bg-amber-600 text-white cursor-pointer"
                                    >
                                      Add
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartInlineEdit(param.key)}
                                    className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 px-2 py-0.5 rounded hover:bg-amber-50 cursor-pointer shrink-0"
                                  >
                                    + Add
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sticky Bottom Bar */}
            <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3 shrink-0">
              {activeRecord.adkotmDecode && (
                <button
                  type="button"
                  disabled={decodingId === activeRecord.id || !activeTranscript}
                  onClick={() => onDecodeSingle(activeRecord)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {decodingId === activeRecord.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Drafting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Re-run Copilot
                    </>
                  )}
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                {activeProgress?.status === 'human_verified' &&
                needsReviewList.length === 0 &&
                onOpenAnalytics ? (
                  <button
                    type="button"
                    onClick={onOpenAnalytics}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>All Verified • View Analytics</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!activeRecord.adkotmDecode}
                    onClick={handleVerifyAndNext}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white shadow-xs cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>
                      {activeProgress?.status === 'human_verified'
                        ? 'Save & Next Interview'
                        : 'Verify & Next Interview'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
