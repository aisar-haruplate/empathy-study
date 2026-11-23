import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CodedSpan, CodingSheetModel } from '../../domain/coding';
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
  Scissors,
  Trash2,
  ChevronLeft,
  Crosshair,
} from 'lucide-react';
import type {
  ADKOTMDecode,
  ADKOTMDimensionKey,
  ADKOTMFieldConfidence,
  ADKOTMFieldItem,
  ADKOTMFieldStatus,
  InterviewRecord,
  MissedSignalSuggestion,
} from '../../types';
import {
  ADKOTM_DIMENSION_STYLES,
  ADKOTM_PARAMETER_CATALOG,
  ADKOTM_PARAM_MAP,
  buildTranscriptCroppingSegments,
  buildTranscriptHighlightSegments,
  buildUpdatedFieldItemFromEdit,
  computeReviewProgress,
  ensureFieldStates,
  nudgeSpanBoundary,
  resolveFieldSpanOffsets,
  scanMissedSignals,
  snapCropBoundaryToWord,
  stripRecordingExtension,
  syncFlatDecodeFromFieldStates,
  verifyEvidenceQuote,
  type CroppingTranscriptSegment,
} from '../../lib/adkotmCopilot';

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
  { key: 'O', label: '+ Tag as Object', buttonClass: 'hover:bg-[#FEFBEB] text-[#6B5306] border-[#F7D147]' },
  { key: 'A', label: '+ Tag as Activity', buttonClass: 'hover:bg-[#F2FBF8] text-[#1E4D42] border-[#96D6C7]' },
  { key: 'K', label: '+ Tag as Knowledge', buttonClass: 'hover:bg-[#F2F7FC] text-[#234B78] border-[#528BCA]/45' },
  { key: 'D', label: '+ Tag as Demographic', buttonClass: 'hover:bg-[#F3F5FD] text-[#33418A] border-[#7C8CE0]/50' },
  { key: 'T', label: '+ Tag as Timing', buttonClass: 'hover:bg-[#FBEAE9] text-[#7A3A36] border-[#D97A75]/45' },
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
  const [editingQuoteValue, setEditingQuoteValue] = useState('');
  const [showNullFields, setShowNullFields] = useState(false);
  const [isScanningSignals, setIsScanningSignals] = useState(false);

  // Click-to-code floating selection popover (for uncoded text)
  const [selectionPopover, setSelectionPopover] = useState<{
    quote: string;
    top: number;
    left: number;
    chosenDimension: ADKOTMDimensionKey | null;
    chosenFieldKey: string;
    manualCode: string;
  } | null>(null);

  // Existing-highlight popover (parameter switcher, change category, span cropping, inline quote edit, delete)
  const [highlightPopover, setHighlightPopover] = useState<{
    fieldKeys: string[];
    activeFieldKey: string;
    subMode: 'actions' | 'crop' | 'edit_quote' | 'change_category';
    top: number;
    left: number;
    cropStart: number | null;
    cropEnd: number | null;
    quoteDraft: string;
    selectedCategoryDim?: ADKOTMDimensionKey;
    categoryCodeDraft?: string;
    originalQuoteBeforeCrop: string | null;
    originalStatusBeforeCrop?: ADKOTMFieldStatus;
    originalConfidenceBeforeCrop?: ADKOTMFieldConfidence;
    originalSourceBeforeCrop?: ADKOTMFieldItem['source'];
  } | null>(null);

  const [draggingEdge, setDraggingEdge] = useState<'start' | 'end' | null>(null);
  const [directEdgeDrag, setDirectEdgeDrag] = useState<{
    fieldKey: string;
    dimension: ADKOTMDimensionKey;
    label: string;
    edge: 'start' | 'end';
    start: number;
    end: number;
    initialStart: number;
    initialEnd: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const directEdgeDragRef = useRef<typeof directEdgeDrag>(null);
  directEdgeDragRef.current = directEdgeDrag;
  const suppressNextHighlightClickRef = useRef<number>(0);
  const [hoveredEdgeZone, setHoveredEdgeZone] = useState<{
    segKey: string;
    edge: 'start' | 'end';
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

  const renderedTranscriptSegments = useMemo<CroppingTranscriptSegment[]>(() => {
    if (directEdgeDrag) {
      return buildTranscriptCroppingSegments(
        activeTranscript,
        activeFieldStates,
        directEdgeDrag.fieldKey,
        directEdgeDrag.start,
        directEdgeDrag.end
      );
    }
    if (
      highlightPopover?.subMode === 'crop' &&
      highlightPopover.cropStart !== null &&
      highlightPopover.cropEnd !== null
    ) {
      return buildTranscriptCroppingSegments(
        activeTranscript,
        activeFieldStates,
        highlightPopover.activeFieldKey,
        highlightPopover.cropStart,
        highlightPopover.cropEnd
      );
    }
    return transcriptSegments;
  }, [directEdgeDrag, highlightPopover, activeTranscript, activeFieldStates, transcriptSegments]);

  // Reset ephemeral UI states when switching record
  useEffect(() => {
    setEditingFieldKey(null);
    setEditingValue('');
    setEditingQuoteValue('');
    setHoveredFieldKey(null);
    setSelectionPopover(null);
    setHighlightPopover(null);
    setDraggingEdge(null);
    setDirectEdgeDrag(null);
    setHoveredEdgeZone(null);
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
      setEditingQuoteValue(current?.evidence_quote || '');
    },
    [activeFieldStates]
  );

  const handleSaveInlineEdit = useCallback(
    (fieldKey: string, overrideQuote?: string | null) => {
      if (!activeRecord) return;
      const trimmed = editingValue.trim();
      if (!trimmed) {
        handleRejectField(fieldKey);
        return;
      }
      const prev = activeFieldStates[fieldKey];
      const nextQuoteRaw =
        overrideQuote !== undefined
          ? overrideQuote
          : prev && prev.code
          ? editingQuoteValue
          : prev?.evidence_quote || null;

      // Ground to exact transcript slice if edited quote matches a substring
      const grounded =
        nextQuoteRaw && activeTranscript
          ? verifyEvidenceQuote(activeTranscript, nextQuoteRaw)
          : null;
      const finalQuote = grounded
        ? grounded.matchedText
        : nextQuoteRaw && nextQuoteRaw.trim()
        ? nextQuoteRaw.trim()
        : null;

      const updatedItem = buildUpdatedFieldItemFromEdit(prev, {
        code: trimmed,
        evidence_quote: finalQuote,
      });

      const nextStates: Record<string, ADKOTMFieldItem> = {
        ...activeFieldStates,
        [fieldKey]: updatedItem,
      };
      commitFieldStates(nextStates);
      setEditingFieldKey(null);
    },
    [
      activeRecord,
      activeTranscript,
      editingValue,
      editingQuoteValue,
      activeFieldStates,
      commitFieldStates,
      handleRejectField,
    ]
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

  // Compute anchored popover coordinates inside the scrollable transcript container
  const computePopoverAnchor = useCallback((rect: DOMRect, popoverHeight = 220) => {
    const container = transcriptContainerRef.current;
    if (!container) return { top: 12, left: 12 };
    const containerRect = container.getBoundingClientRect();
    const spaceBelow = containerRect.bottom - rect.bottom;
    const spaceAbove = rect.top - containerRect.top;
    const top =
      spaceBelow < popoverHeight && spaceAbove > popoverHeight
        ? Math.max(8, rect.top - containerRect.top + container.scrollTop - popoverHeight - 8)
        : Math.max(8, rect.bottom - containerRect.top + container.scrollTop + 8);
    const left = Math.min(
      Math.max(12, rect.left - containerRect.left),
      Math.max(12, containerRect.width - 332)
    );
    return { top, left };
  }, []);

  // Resolve exact character offsets in activeTranscript from a DOM node + local offset
  const resolveOffsetFromDomNode = useCallback((node: Node, localOffset: number): number | null => {
    const container = transcriptContainerRef.current;
    if (!container) return null;

    if (node.nodeType === Node.TEXT_NODE) {
      const el = node.parentElement?.closest('[data-seg-start]') as HTMLElement | null;
      if (!el || !container.contains(el)) return null;
      const segStart = Number(el.dataset.segStart);
      const segEnd = Number(el.dataset.segEnd);
      if (!Number.isFinite(segStart) || !Number.isFinite(segEnd)) return null;
      return Math.max(segStart, Math.min(segEnd, segStart + localOffset));
    }

    const elem = node as HTMLElement;
    if (!container.contains(elem)) return null;

    const segEl = elem.closest('[data-seg-start]') as HTMLElement | null;
    if (segEl && container.contains(segEl)) {
      const segStart = Number(segEl.dataset.segStart);
      const segEnd = Number(segEl.dataset.segEnd);
      if (!Number.isFinite(segStart) || !Number.isFinite(segEnd)) return null;
      return localOffset <= 0 ? segStart : segEnd;
    }

    // Fallback when selection boundary lands on a wrapper container (e.g. crop span or transcript div)
    const childCount = elem.childNodes.length;
    if (childCount > 0) {
      const clampedIdx = Math.max(0, Math.min(childCount - 1, localOffset >= childCount ? childCount - 1 : localOffset));
      const candidateNode = elem.childNodes[clampedIdx] as HTMLElement | undefined;
      const targetSeg =
        candidateNode?.nodeType === Node.ELEMENT_NODE
          ? (candidateNode.matches?.('[data-seg-start]')
              ? candidateNode
              : (candidateNode.querySelector?.('[data-seg-start]') as HTMLElement | null))
          : null;
      if (targetSeg) {
        const segStart = Number(targetSeg.dataset.segStart);
        const segEnd = Number(targetSeg.dataset.segEnd);
        if (Number.isFinite(segStart) && Number.isFinite(segEnd)) {
          return localOffset >= childCount ? segEnd : segStart;
        }
      }
    }

    return null;
  }, []);

  const getTranscriptOffsetFromPoint = useCallback(
    (clientX: number, clientY: number): number | null => {
      const docAny = document as any;
      if (typeof docAny.caretPositionFromPoint === 'function') {
        const pos = docAny.caretPositionFromPoint(clientX, clientY);
        if (pos?.offsetNode) {
          return resolveOffsetFromDomNode(pos.offsetNode, pos.offset);
        }
      }
      if (typeof docAny.caretRangeFromPoint === 'function') {
        const range = docAny.caretRangeFromPoint(clientX, clientY) as Range | null;
        if (range?.startContainer) {
          return resolveOffsetFromDomNode(range.startContainer, range.startOffset);
        }
      }
      return null;
    },
    [resolveOffsetFromDomNode]
  );

  // Immediately sync a cropped span quote onto activeFieldStates -> Copilot Coding Sheet
  const syncLiveCroppedQuote = useCallback(
    (fieldKey: string, nextQuote: string | null) => {
      const prev = activeFieldStates[fieldKey];
      if (!prev || !prev.code) return;
      const updatedItem = buildUpdatedFieldItemFromEdit(prev, {
        code: prev.code,
        evidence_quote: nextQuote,
        source: 'transcript',
      });
      commitFieldStates({
        ...activeFieldStates,
        [fieldKey]: updatedItem,
      });
    },
    [activeFieldStates, commitFieldStates]
  );

  // Open floating popover when clicking an existing highlighted mark
  const handleHighlightClick = useCallback(
    (e: React.MouseEvent<HTMLElement>, seg: CroppingTranscriptSegment) => {
      e.stopPropagation();
      if (Date.now() < suppressNextHighlightClickRef.current) {
        return;
      }
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length >= 2) {
        return;
      }
      if (!seg.fieldKey) return;

      const fieldKeys = seg.fieldKeys && seg.fieldKeys.length > 0 ? seg.fieldKeys : [seg.fieldKey];
      const activeKey =
        highlightPopover && fieldKeys.includes(highlightPopover.activeFieldKey)
          ? highlightPopover.activeFieldKey
          : fieldKeys[0];
      const offsets = resolveFieldSpanOffsets(activeTranscript, activeFieldStates, activeKey);
      const { top, left } = computePopoverAnchor(e.currentTarget.getBoundingClientRect(), 210);
      const activeItem = activeFieldStates[activeKey];

      setSelectionPopover(null);
      setFocusedFieldKey(activeKey);
      setHoveredFieldKey(activeKey);
      setHighlightPopover({
        fieldKeys,
        activeFieldKey: activeKey,
        subMode: 'actions',
        top,
        left,
        cropStart: offsets?.start ?? seg.start,
        cropEnd: offsets?.end ?? seg.end,
        quoteDraft: activeItem?.evidence_quote || seg.text,
        originalQuoteBeforeCrop: activeItem?.evidence_quote ?? null,
        originalStatusBeforeCrop: activeItem?.status,
        originalConfidenceBeforeCrop: activeItem?.confidence,
        originalSourceBeforeCrop: activeItem?.source,
      });
    },
    [activeTranscript, activeFieldStates, computePopoverAnchor, highlightPopover]
  );

  const handleSwitchPopoverParameter = useCallback(
    (nextFieldKey: string) => {
      if (!highlightPopover) return;
      const nextItem = activeFieldStates[nextFieldKey];
      const offsets = resolveFieldSpanOffsets(activeTranscript, activeFieldStates, nextFieldKey);
      setFocusedFieldKey(nextFieldKey);
      setHoveredFieldKey(nextFieldKey);
      setHighlightPopover({
        ...highlightPopover,
        activeFieldKey: nextFieldKey,
        subMode: 'actions',
        cropStart: offsets?.start ?? null,
        cropEnd: offsets?.end ?? null,
        quoteDraft: nextItem?.evidence_quote || '',
        originalQuoteBeforeCrop: nextItem?.evidence_quote ?? null,
        originalStatusBeforeCrop: nextItem?.status,
        originalConfidenceBeforeCrop: nextItem?.confidence,
        originalSourceBeforeCrop: nextItem?.source,
      });
    },
    [highlightPopover, activeFieldStates, activeTranscript]
  );

  const handleEnterCropMode = useCallback(() => {
    if (!highlightPopover) return;
    const activeKey = highlightPopover.activeFieldKey;
    const item = activeFieldStates[activeKey];
    const offsets = resolveFieldSpanOffsets(activeTranscript, activeFieldStates, activeKey);
    setHighlightPopover({
      ...highlightPopover,
      subMode: 'crop',
      cropStart: offsets?.start ?? highlightPopover.cropStart,
      cropEnd: offsets?.end ?? highlightPopover.cropEnd,
      originalQuoteBeforeCrop: item?.evidence_quote ?? null,
      originalStatusBeforeCrop: item?.status,
      originalConfidenceBeforeCrop: item?.confidence,
      originalSourceBeforeCrop: item?.source,
    });
  }, [highlightPopover, activeFieldStates, activeTranscript]);

  const handleCancelCropMode = useCallback(() => {
    if (!highlightPopover) return;
    const activeKey = highlightPopover.activeFieldKey;
    const prev = activeFieldStates[activeKey];
    if (prev && prev.code && highlightPopover.originalQuoteBeforeCrop !== prev.evidence_quote) {
      commitFieldStates({
        ...activeFieldStates,
        [activeKey]: {
          ...prev,
          evidence_quote: highlightPopover.originalQuoteBeforeCrop,
          status: highlightPopover.originalStatusBeforeCrop || prev.status,
          confidence: highlightPopover.originalConfidenceBeforeCrop || prev.confidence,
          source: highlightPopover.originalSourceBeforeCrop || prev.source,
        },
      });
    }
    setDraggingEdge(null);
    setHighlightPopover(null);
  }, [highlightPopover, activeFieldStates, commitFieldStates]);

  const handleNudgeCropBoundary = useCallback(
    (edge: 'start' | 'end', deltaWords: -1 | 1) => {
      if (
        !highlightPopover ||
        highlightPopover.cropStart === null ||
        highlightPopover.cropEnd === null
      ) {
        return;
      }
      const nudged = nudgeSpanBoundary(
        activeTranscript,
        highlightPopover.cropStart,
        highlightPopover.cropEnd,
        edge,
        deltaWords
      );
      setHighlightPopover({
        ...highlightPopover,
        cropStart: nudged.start,
        cropEnd: nudged.end,
        quoteDraft: nudged.text,
      });
      syncLiveCroppedQuote(highlightPopover.activeFieldKey, nudged.text);
    },
    [highlightPopover, activeTranscript, syncLiveCroppedQuote]
  );

  const handleSavePopoverQuoteEdit = useCallback(() => {
    if (!highlightPopover) return;
    const activeKey = highlightPopover.activeFieldKey;
    const prev = activeFieldStates[activeKey];
    if (!prev || !prev.code) return;

    const grounded =
      highlightPopover.quoteDraft.trim() && activeTranscript
        ? verifyEvidenceQuote(activeTranscript, highlightPopover.quoteDraft)
        : null;
    const finalQuote = grounded
      ? grounded.matchedText
      : highlightPopover.quoteDraft.trim() || null;

    const updated = buildUpdatedFieldItemFromEdit(prev, {
      code: prev.code,
      evidence_quote: finalQuote,
    });

    commitFieldStates({
      ...activeFieldStates,
      [activeKey]: updated,
    });
    setHighlightPopover(null);
  }, [highlightPopover, activeFieldStates, activeTranscript, commitFieldStates]);

  const handleReassignHighlightCategory = useCallback(
    (fromFieldKey: string, toFieldKey: string, overrideCode?: string) => {
      if (!activeRecord) return;
      const sourceItem = activeFieldStates[fromFieldKey];
      if (!sourceItem) return;

      const finalCode = (overrideCode ?? sourceItem.code ?? '').trim() || sourceItem.code || '';
      const evidenceQuote = sourceItem.evidence_quote ?? null;
      if (!finalCode) return;

      if (activeRecord.adkotmDecode) {
        const sheet = new CodingSheetModel(activeRecord.adkotmDecode, activeTranscript);
        if (toFieldKey !== fromFieldKey) {
          sheet.rejectField(fromFieldKey);
        }
        sheet.editField(toFieldKey, {
          code: finalCode,
          evidence_quote: evidenceQuote,
          status: sourceItem.status === 'ACCEPTED' ? 'ACCEPTED' : 'MANUAL',
        });
        commitFieldStates(sheet.getAllFields());
      } else {
        const nextStates: Record<string, ADKOTMFieldItem> = { ...activeFieldStates };
        if (toFieldKey !== fromFieldKey) {
          nextStates[fromFieldKey] = {
            ...sourceItem,
            status: 'REJECTED',
          };
        }
        nextStates[toFieldKey] = buildUpdatedFieldItemFromEdit(nextStates[toFieldKey], {
          code: finalCode,
          evidence_quote: evidenceQuote,
        });
        commitFieldStates(nextStates);
      }

      setFocusedFieldKey(toFieldKey);
      setHighlightPopover(null);
    },
    [activeRecord, activeFieldStates, activeTranscript, commitFieldStates]
  );

  // Launch crop mode in the Center Transcript Pane directly from a Right Pane card
  const handleOpenCropFromCard = useCallback(
    (fieldKey: string) => {
      if (!activeRecord) return;
      const prev = activeFieldStates[fieldKey];
      let effectiveStates = activeFieldStates;

      // Save any pending code or quote edit from the card before jumping to crop mode
      if (editingFieldKey === fieldKey && prev) {
        const nextCode = editingValue.trim() || prev.code || '';
        const groundedQuote =
          editingQuoteValue.trim() && activeTranscript
            ? verifyEvidenceQuote(activeTranscript, editingQuoteValue)
            : null;
        const nextQuote = groundedQuote
          ? groundedQuote.matchedText
          : editingQuoteValue.trim() || null;

        if (nextCode && (nextCode !== prev.code || nextQuote !== (prev.evidence_quote ?? null))) {
          const nextItem = buildUpdatedFieldItemFromEdit(prev, {
            code: nextCode,
            evidence_quote: nextQuote,
          });
          effectiveStates = {
            ...activeFieldStates,
            [fieldKey]: nextItem,
          };
          commitFieldStates(effectiveStates);
        }
      }

      setEditingFieldKey(null);
      setSelectionPopover(null);
      setFocusedFieldKey(fieldKey);
      setHoveredFieldKey(fieldKey);

      const currentItem = effectiveStates[fieldKey];
      const offsets = resolveFieldSpanOffsets(activeTranscript, effectiveStates, fieldKey);

      requestAnimationFrame(() => {
        const container = transcriptContainerRef.current;
        if (!container) return;

        const targetMark =
          (container.querySelector(`[data-quote-fields~="${fieldKey}"]`) as HTMLElement | null) ||
          (container.querySelector(`[data-quote-field="${fieldKey}"]`) as HTMLElement | null);

        if (targetMark) {
          targetMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        requestAnimationFrame(() => {
          const updatedMark =
            (container.querySelector(`[data-quote-fields~="${fieldKey}"]`) as HTMLElement | null) ||
            (container.querySelector(`[data-quote-field="${fieldKey}"]`) as HTMLElement | null);
          const anchor = updatedMark
            ? computePopoverAnchor(updatedMark.getBoundingClientRect(), 220)
            : { top: container.scrollTop + 16, left: 16 };

          setHighlightPopover({
            fieldKeys: [fieldKey],
            activeFieldKey: fieldKey,
            subMode: 'crop',
            top: anchor.top,
            left: anchor.left,
            cropStart: offsets?.start ?? null,
            cropEnd: offsets?.end ?? null,
            quoteDraft: currentItem?.evidence_quote || '',
            originalQuoteBeforeCrop: currentItem?.evidence_quote ?? null,
            originalStatusBeforeCrop: currentItem?.status,
            originalConfidenceBeforeCrop: currentItem?.confidence,
            originalSourceBeforeCrop: currentItem?.source,
          });
        });
      });
    },
    [
      activeRecord,
      editingFieldKey,
      editingValue,
      editingQuoteValue,
      activeFieldStates,
      activeTranscript,
      commitFieldStates,
      computePopoverAnchor,
    ]
  );

  // Pointer drag tracking for start/end boundary handles
  useEffect(() => {
    if (!draggingEdge || !highlightPopover || highlightPopover.subMode !== 'crop') return;

    const handlePointerMove = (e: PointerEvent) => {
      if (highlightPopover.cropStart === null || highlightPopover.cropEnd === null) return;
      const rawOffset = getTranscriptOffsetFromPoint(e.clientX, e.clientY);
      if (rawOffset === null) return;

      const snapped = snapCropBoundaryToWord(
        activeTranscript,
        rawOffset,
        draggingEdge,
        highlightPopover.cropStart,
        highlightPopover.cropEnd
      );

      const nextStart = draggingEdge === 'start' ? snapped : highlightPopover.cropStart;
      const nextEnd = draggingEdge === 'end' ? snapped : highlightPopover.cropEnd;
      if (nextStart >= nextEnd) return;
      if (nextStart === highlightPopover.cropStart && nextEnd === highlightPopover.cropEnd) return;

      const nextQuote = activeTranscript.slice(nextStart, nextEnd);
      setHighlightPopover((prev) =>
        prev
          ? {
              ...prev,
              cropStart: nextStart,
              cropEnd: nextEnd,
              quoteDraft: nextQuote,
            }
          : null
      );
      syncLiveCroppedQuote(highlightPopover.activeFieldKey, nextQuote);
    };

    const handlePointerUp = () => {
      setDraggingEdge(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    draggingEdge,
    highlightPopover,
    activeTranscript,
    getTranscriptOffsetFromPoint,
    syncLiveCroppedQuote,
  ]);

  // Direct left-click edge-drag cropping on any highlighted span (without opening popover first)
  const startDirectEdgeDrag = useCallback(
    (
      e: React.PointerEvent<HTMLElement>,
      seg: CroppingTranscriptSegment,
      edge: 'start' | 'end'
    ) => {
      if (e.button !== 0) return; // left-click only
      if (!seg.fieldKey || !seg.dimension || !activeTranscript) return;

      e.preventDefault();
      e.stopPropagation();

      const fieldKeys = seg.fieldKeys && seg.fieldKeys.length > 0 ? seg.fieldKeys : [seg.fieldKey];
      const targetFieldKey = fieldKeys[0];
      const offsets = resolveFieldSpanOffsets(activeTranscript, activeFieldStates, targetFieldKey);
      const start = offsets ? offsets.start : seg.start;
      const end = offsets ? offsets.end : seg.end;
      if (end <= start) return;

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Fallback to window pointer listeners
      }

      setSelectionPopover(null);
      setHighlightPopover(null);
      setHoveredEdgeZone(null);
      setFocusedFieldKey(targetFieldKey);

      setDirectEdgeDrag({
        fieldKey: targetFieldKey,
        dimension: seg.dimension,
        label: seg.label || ADKOTM_PARAM_MAP.get(targetFieldKey)?.label || targetFieldKey,
        edge,
        start,
        end,
        initialStart: start,
        initialEnd: end,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    },
    [activeTranscript, activeFieldStates]
  );

  useEffect(() => {
    if (!directEdgeDrag) return;

    const handlePointerMove = (e: PointerEvent) => {
      const cur = directEdgeDragRef.current;
      if (!cur || !activeTranscript) return;

      const rawOffset = getTranscriptOffsetFromPoint(e.clientX, e.clientY);
      if (rawOffset === null) return;

      const clampedRaw = Math.max(0, Math.min(activeTranscript.length, rawOffset));
      const snapped = snapCropBoundaryToWord(
        activeTranscript,
        clampedRaw,
        cur.edge,
        cur.start,
        cur.end
      );

      const nextStart = cur.edge === 'start' ? Math.max(0, Math.min(snapped, cur.end - 1)) : cur.start;
      const nextEnd = cur.edge === 'end' ? Math.min(activeTranscript.length, Math.max(snapped, cur.start + 1)) : cur.end;

      if (nextEnd <= nextStart) return;
      const candidateQuote = activeTranscript.slice(nextStart, nextEnd).trim();
      if (candidateQuote.length < 1) return;

      if (nextStart === cur.start && nextEnd === cur.end) {
        setDirectEdgeDrag((prev) =>
          prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null
        );
        return;
      }

      setDirectEdgeDrag((prev) =>
        prev
          ? {
              ...prev,
              start: nextStart,
              end: nextEnd,
              clientX: e.clientX,
              clientY: e.clientY,
            }
          : null
      );
    };

    const handlePointerUp = () => {
      const finalDrag = directEdgeDragRef.current;
      setDirectEdgeDrag(null);
      // Suppress accidental click/popover toggles right after dragging
      suppressNextHighlightClickRef.current = Date.now() + 250;

      if (!finalDrag || !activeRecord || !activeTranscript) return;
      if (finalDrag.start === finalDrag.initialStart && finalDrag.end === finalDrag.initialEnd) {
        return;
      }

      try {
        const validatedSpan = new CodedSpan({
          start: finalDrag.start,
          end: finalDrag.end,
          dimension: finalDrag.dimension,
          fieldKey: finalDrag.fieldKey,
          transcript: activeTranscript,
        });

        if (!validatedSpan.quote) return;

        if (activeRecord.adkotmDecode) {
          const sheet = new CodingSheetModel(activeRecord.adkotmDecode, activeTranscript);
          sheet.cropFieldSpan(finalDrag.fieldKey, validatedSpan);
          commitFieldStates(sheet.getAllFields());
        } else {
          syncLiveCroppedQuote(finalDrag.fieldKey, validatedSpan.quote);
        }
      } catch (err) {
        console.warn('[Step3ReviewWorkspace] Skipped invalid edge-drag span:', err);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [
    Boolean(directEdgeDrag),
    activeRecord,
    activeTranscript,
    getTranscriptOffsetFromPoint,
    commitFieldStates,
    syncLiveCroppedQuote,
  ]);

  // Click-to-Code & Crop Re-selection handler on Center Pane
  const handleTranscriptMouseUp = () => {
    if (draggingEdge || directEdgeDrag || Date.now() < suppressNextHighlightClickRef.current) return;
    if (!activeRecord || !transcriptContainerRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const rawSelectionStr = selection.toString();
    if (rawSelectionStr.trim().length < 2) return;

    const range = selection.getRangeAt(0);
    if (!transcriptContainerRef.current.contains(range.commonAncestorContainer)) return;

    // Resolve exact verbatim slice offsets in activeTranscript
    let selStart = resolveOffsetFromDomNode(range.startContainer, range.startOffset);
    let selEnd = resolveOffsetFromDomNode(range.endContainer, range.endOffset);
    if (selStart !== null && selEnd !== null) {
      if (selStart > selEnd) [selStart, selEnd] = [selEnd, selStart];
      while (selStart < selEnd && /\s/.test(activeTranscript[selStart])) selStart++;
      while (selEnd > selStart && /\s/.test(activeTranscript[selEnd - 1])) selEnd--;
    } else {
      const fallback = verifyEvidenceQuote(activeTranscript, rawSelectionStr);
      if (fallback) {
        selStart = fallback.start;
        selEnd = fallback.end;
      }
    }

    const exactQuote =
      selStart !== null && selEnd !== null && selEnd > selStart
        ? activeTranscript.slice(selStart, selEnd)
        : rawSelectionStr.replace(/\s+/g, ' ').trim();

    if (exactQuote.length < 2) return;

    const { top, left } = computePopoverAnchor(range.getBoundingClientRect(), 220);

    // If researcher is in Crop / Re-select mode, update the candidate span immediately!
    if (highlightPopover?.subMode === 'crop' && selStart !== null && selEnd !== null) {
      setHighlightPopover({
        ...highlightPopover,
        top,
        left,
        cropStart: selStart,
        cropEnd: selEnd,
        quoteDraft: exactQuote,
      });
      syncLiveCroppedQuote(highlightPopover.activeFieldKey, exactQuote);
      selection.removeAllRanges();
      return;
    }

    setHighlightPopover(null);
    setSelectionPopover({
      quote: exactQuote,
      top,
      left,
      chosenDimension: null,
      chosenFieldKey: 'productsPurchased',
      manualCode: exactQuote.length <= 42 ? exactQuote : '',
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
      if (e.key === 'Escape') {
        if (highlightPopover) {
          e.preventDefault();
          if (highlightPopover.subMode === 'crop') {
            handleCancelCropMode();
          } else {
            setHighlightPopover(null);
          }
          return;
        }
        if (selectionPopover) {
          e.preventDefault();
          setSelectionPopover(null);
          return;
        }
      }

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
    highlightPopover,
    handleCancelCropMode,
    scrollFocusedParamIntoView,
    handleAcceptField,
    handleRejectField,
    handleStartInlineEdit,
  ]);

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-[#EAE6DF] p-12 text-center shadow-studio space-y-4">
        <FileText className="w-9 h-9 text-[#78716C]/50 mx-auto" />
        <div>
          <h3 className="text-xl font-bold text-[#292524] tracking-[-0.02em]">No interview transcripts ready to review</h3>
          <p className="text-lg text-[#57534E] mt-2 leading-relaxed">
            Import recordings in Step 1 or clean transcripts in Step 2 to begin decoding.
          </p>
        </div>
        {onOpenAddDecode && (
          <button
            type="button"
            onClick={onOpenAddDecode}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add Decode
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-stretch min-h-[540px]">
      {/* 1. Slim Left Triage Column (~255px) */}
      <div className="w-full lg:w-[255px] shrink-0 flex flex-col gap-2">
        {/* Desktop alignment spacer matching right outer toolbar */}
        <div className="hidden lg:block lg:min-h-10" aria-hidden="true" />

        <aside
          aria-label="Interview review queue"
          className="bg-white rounded-3xl border border-[#EAE6DF] shadow-studio flex flex-col overflow-hidden lg:h-[calc(100vh-230px)] lg:min-h-[540px] lg:max-h-[700px]"
        >
        <div className="px-4 py-3 border-b border-[#EAE6DF] bg-[#F7F5F0] flex items-center justify-between">
          <span className="font-heading text-sm font-bold uppercase tracking-wider text-[#57534E]">
            Triage Queue
          </span>
          <span className="text-[13px] font-semibold tabular-nums text-[#78716C]">
            {verifiedList.length}/{records.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#EAE6DF] max-h-[320px] lg:max-h-none">
          {/* Section 1: Needs Review */}
          <div className="p-2.5">
            <button
              type="button"
              onClick={() => setNeedsReviewExpanded((v) => !v)}
              aria-expanded={needsReviewExpanded}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-full text-[13px] font-bold text-[#292524] hover:bg-[#F7F5F0] cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                {needsReviewExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#78716C]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#78716C]" />
                )}
                Needs Review
              </span>
              <span className="px-2 py-0.5 rounded-full text-[13px] font-bold tabular-nums bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147]">
                {needsReviewList.length}
              </span>
            </button>

            {needsReviewExpanded && (
              <div className="mt-1.5 space-y-1">
                {needsReviewList.length === 0 ? (
                  <p className="px-2 py-2 text-[15px] text-[#57534E] leading-relaxed">
                    All interviews verified!
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
                        className={`w-full text-left px-3 py-2.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-[#EEF4FB] border-[#528BCA] ring-1 ring-[#528BCA]/25 shadow-2xs'
                            : 'bg-white border-transparent hover:bg-[#F2F5F3]/70 hover:border-[#528BCA]/45'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-base font-semibold text-[#292524] truncate">
                            {stripRecordingExtension(record.fileName)}
                          </span>
                          {isDecoding && (
                            <Loader2 className="w-3.5 h-3.5 text-[#528BCA] animate-spin shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1.5 mt-1">
                          <span className="text-[13px] text-[#78716C] truncate">
                            {record.folderName || record.sessionDate || 'Session'}
                          </span>
                          {progress.status === 'unprocessed' ? (
                            <span className="px-2 py-0.5 rounded-full text-[13px] font-medium bg-[#F7F5F0] text-[#78716C] whitespace-nowrap shrink-0">
                              Unprocessed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[13px] font-bold tabular-nums bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147] whitespace-nowrap shrink-0">
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
          <div className="p-2.5">
            <button
              type="button"
              onClick={() => setVerifiedExpanded((v) => !v)}
              aria-expanded={verifiedExpanded}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-full text-[13px] font-bold text-[#292524] hover:bg-[#F7F5F0] cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                {verifiedExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#78716C]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#78716C]" />
                )}
                Verified
              </span>
              <span className="px-2 py-0.5 rounded-full text-[13px] font-bold tabular-nums bg-[#96D6C7] text-[#1E4D42]">
                {verifiedList.length}
              </span>
            </button>

            {verifiedExpanded && (
              <div className="mt-1.5 space-y-1">
                {verifiedList.length === 0 ? (
                  <p className="px-2 py-2 text-[15px] text-[#57534E] leading-relaxed">
                    Verify drafts to unlock analytics.
                  </p>
                ) : (
                  verifiedList.map(({ record }) => {
                    const isSelected = record.id === activeRecord?.id;
                    return (
                      <button
                        key={record.id}
                        type="button"
                        onClick={() => onSelectRecord(record.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-[#F2FBF8] border-[#96D6C7] shadow-2xs'
                            : 'bg-white border-transparent hover:bg-[#F7F5F0]/70 hover:border-[#EAE6DF]'
                        }`}
                      >
                        <div className="text-base font-semibold text-[#292524] truncate">
                          {stripRecordingExtension(record.fileName)}
                        </div>
                        <div className="flex items-center justify-between gap-1.5 mt-1">
                          <span className="text-[13px] text-[#78716C] truncate">
                            {record.folderName || record.sessionDate || 'Session'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[13px] font-bold bg-[#96D6C7] text-[#1E4D42] whitespace-nowrap shrink-0">
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
            <div className="hidden lg:block lg:min-h-10" aria-hidden="true" />
            <section
              aria-label="Cleaned transcript inspector"
              className="bg-[#FDFCF8] rounded-3xl shadow-sm flex flex-col overflow-hidden h-[580px] lg:h-[calc(100vh-230px)] lg:min-h-[540px] lg:max-h-[700px]"
            >
            <div className="px-4 py-3 border-b border-[#D5DDD8] bg-[#F2F5F3] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="min-w-0">
                <h3 className="font-heading text-lg font-medium text-[#1C1B1F] truncate">
                  {stripRecordingExtension(activeRecord.fileName)}
                </h3>
                <p className="text-sm text-[#444846] mt-0.5">
                  Highlight text to tag, or click any highlight to crop or edit
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['O', 'A', 'K', 'D', 'T'] as ADKOTMDimensionKey[]).map((dim) => {
                  const style = ADKOTM_DIMENSION_STYLES[dim];
                  return (
                    <span
                      key={dim}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#444846] px-2.5 py-0.5 rounded-full bg-[#FDFCF8]"
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
              onMouseDown={(e) => {
                const target = e.target as HTMLElement | null;
                if (target?.closest('[data-highlight-popover="true"]') || target?.closest('[data-crop-handle]')) {
                  return;
                }
                if (selectionPopover) {
                  setSelectionPopover(null);
                }
                if (highlightPopover && highlightPopover.subMode !== 'crop' && !target?.closest('mark[data-quote-field]')) {
                  setHighlightPopover(null);
                }
              }}
              onMouseUp={handleTranscriptMouseUp}
              className={`transcript-surface relative flex-1 overflow-y-auto p-5 whitespace-pre-wrap select-text ${
                draggingEdge || directEdgeDrag ? 'cursor-ew-resize select-none' : ''
              }`}
            >
              {!activeTranscript ? (
                <div className="py-14 px-4 text-center text-lg text-[#78716C] leading-relaxed">
                  No transcript text available for this record yet.
                </div>
              ) : (
                renderedTranscriptSegments.map((seg, idx) => {
                  if (!seg.fieldKey || !seg.dimension) {
                    return (
                      <span key={`plain-${seg.start}-${idx}`} data-seg-start={seg.start} data-seg-end={seg.end}>
                        {seg.text}
                      </span>
                    );
                  }
                  const dimStyle = ADKOTM_DIMENSION_STYLES[seg.dimension];
                  const segKeys = seg.fieldKeys && seg.fieldKeys.length > 0 ? seg.fieldKeys : [seg.fieldKey];
                  const isHovered = Boolean(hoveredFieldKey && segKeys.includes(hoveredFieldKey));
                  const isFocused = Boolean(focusedFieldKey && segKeys.includes(focusedFieldKey));

                  if (seg.isActiveCrop) {
                    return (
                      <span key={`crop-${seg.fieldKey}-${seg.start}-${idx}`} className="inline relative">
                        <button
                          type="button"
                          data-crop-handle="start"
                          aria-label="Drag start boundary handle"
                          title="Drag left or right to adjust start boundary"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDraggingEdge('start');
                          }}
                          className="inline-flex items-center justify-center w-4 h-5 -ml-0.5 mr-0.5 align-baseline rounded-l-md bg-[#528BCA] hover:bg-[#4178B6] text-white text-[13px] font-bold cursor-ew-resize select-none shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#528BCA]"
                        >
                          [
                        </button>
                        <mark
                          data-seg-start={seg.start}
                          data-seg-end={seg.end}
                          data-quote-field={seg.fieldKey}
                          data-quote-fields={segKeys.join(' ')}
                          title={`Cropping ${seg.label || seg.fieldKey}`}
                          className={`rounded-md px-1 py-0.5 ring-2 ring-[#528BCA] ${dimStyle.activeHighlightClass}`}
                        >
                          {seg.text}
                        </mark>
                        <button
                          type="button"
                          data-crop-handle="end"
                          aria-label="Drag end boundary handle"
                          title="Drag left or right to adjust end boundary"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDraggingEdge('end');
                          }}
                          className="inline-flex items-center justify-center w-4 h-5 ml-0.5 -mr-0.5 align-baseline rounded-r-md bg-[#528BCA] hover:bg-[#4178B6] text-white text-[13px] font-bold cursor-ew-resize select-none shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#528BCA]"
                        >
                          ]
                        </button>
                      </span>
                    );
                  }

                  const edgeBarColorClass =
                    seg.dimension === 'A'
                      ? 'bg-[#4FA896]'
                      : seg.dimension === 'D'
                      ? 'bg-[#528BCA]'
                      : seg.dimension === 'K'
                      ? 'bg-[#E5B822]'
                      : seg.dimension === 'O'
                      ? 'bg-[#D97A75]'
                      : seg.dimension === 'T'
                      ? 'bg-[#7C8CE0]'
                      : 'bg-[#727975]';
                  const segId = `${seg.fieldKey}-${seg.start}-${idx}`;
                  const isEdgeHovered = hoveredEdgeZone?.segKey === segId;

                  const detectMarkEdge = (e: React.PointerEvent<HTMLElement>): 'start' | 'end' | null => {
                    const rects = e.currentTarget.getClientRects();
                    if (rects.length === 0) return null;
                    const firstRect = rects[0];
                    const lastRect = rects[rects.length - 1];
                    const EDGE_PX = 9;
                    if (
                      e.clientY >= firstRect.top - 4 &&
                      e.clientY <= firstRect.bottom + 4 &&
                      Math.abs(e.clientX - firstRect.left) <= EDGE_PX
                    ) {
                      return 'start';
                    }
                    if (
                      e.clientY >= lastRect.top - 4 &&
                      e.clientY <= lastRect.bottom + 4 &&
                      Math.abs(e.clientX - lastRect.right) <= EDGE_PX
                    ) {
                      return 'end';
                    }
                    return null;
                  };

                  return (
                    <span key={segId} className="group/hl relative inline">
                      <span
                        role="slider"
                        tabIndex={-1}
                        data-crop-handle="start"
                        aria-label={`Drag start edge of ${seg.label || seg.fieldKey}`}
                        title="Drag left or right to crop start boundary"
                        onPointerDown={(e) => startDirectEdgeDrag(e, seg, 'start')}
                        className={`adkotm-edge-handle -mr-0.5 ${
                          isEdgeHovered && hoveredEdgeZone?.edge === 'start' ? 'adkotm-edge-handle--active' : ''
                        }`}
                      >
                        <span className={`w-[3px] h-full rounded-full ${edgeBarColorClass}`} />
                      </span>
                      <mark
                        data-seg-start={seg.start}
                        data-seg-end={seg.end}
                        data-quote-field={seg.fieldKey}
                        data-quote-fields={segKeys.join(' ')}
                        onPointerMove={(e) => {
                          if (directEdgeDrag || draggingEdge) return;
                          const edge = detectMarkEdge(e);
                          if (edge) {
                            setHoveredEdgeZone((prev) =>
                              prev?.segKey === segId && prev.edge === edge ? prev : { segKey: segId, edge }
                            );
                          } else if (hoveredEdgeZone?.segKey === segId) {
                            setHoveredEdgeZone(null);
                          }
                        }}
                        onPointerLeave={() => {
                          if (hoveredEdgeZone?.segKey === segId) {
                            setHoveredEdgeZone(null);
                          }
                        }}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          const edge = detectMarkEdge(e);
                          if (edge) {
                            startDirectEdgeDrag(e, seg, edge);
                          }
                        }}
                        onClick={(e) => handleHighlightClick(e, seg)}
                        title={`${seg.label || seg.fieldKey} (${dimStyle.name}) — click interior to edit, or drag edges to crop`}
                        className={`rounded-md px-1 py-0.5 transition-all duration-150 ${
                          isEdgeHovered ? 'cursor-ew-resize' : 'cursor-pointer'
                        } ${
                          isHovered
                            ? `${dimStyle.activeHighlightClass} shadow-xs`
                            : isFocused
                            ? dimStyle.activeHighlightClass
                            : dimStyle.highlightClass
                        }`}
                      >
                        {seg.text}
                      </mark>
                      <span
                        role="slider"
                        tabIndex={-1}
                        data-crop-handle="end"
                        aria-label={`Drag end edge of ${seg.label || seg.fieldKey}`}
                        title="Drag left or right to crop end boundary"
                        onPointerDown={(e) => startDirectEdgeDrag(e, seg, 'end')}
                        className={`adkotm-edge-handle -ml-0.5 ${
                          isEdgeHovered && hoveredEdgeZone?.edge === 'end' ? 'adkotm-edge-handle--active' : ''
                        }`}
                      >
                        <span className={`w-[3px] h-full rounded-full ${edgeBarColorClass}`} />
                      </span>
                    </span>
                  );
                })
              )}

              {/* Floating Highlight Inspect / Crop / Edit Quote Popover */}
              {highlightPopover && (() => {
                const activeKey = highlightPopover.activeFieldKey;
                const activeParam = ADKOTM_PARAM_MAP.get(activeKey);
                const activeItem = activeFieldStates[activeKey];
                const activeDimStyle = ADKOTM_DIMENSION_STYLES[activeParam?.dimension || 'O'];
                const candidateSpanText =
                  highlightPopover.cropStart !== null && highlightPopover.cropEnd !== null
                    ? activeTranscript.slice(highlightPopover.cropStart, highlightPopover.cropEnd)
                    : '';
                const draftMatch =
                  highlightPopover.quoteDraft.trim() && activeTranscript
                    ? verifyEvidenceQuote(activeTranscript, highlightPopover.quoteDraft)
                    : null;

                return (
                  <div
                    data-highlight-popover="true"
                    style={{ top: highlightPopover.top, left: highlightPopover.left }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute z-30 w-[336px] bg-[#FDFCF8] rounded-3xl border border-[#D5DDD8] shadow-lg p-4 space-y-2.5"
                  >
                    {/* Header: Parameter Switcher Tabs if multi-field, or clickable category header pill */}
                    <div className="flex items-start justify-between gap-2">
                      {highlightPopover.fieldKeys.length > 1 ? (
                        <div className="flex items-center gap-1 flex-wrap min-w-0">
                          {highlightPopover.fieldKeys.map((fk) => {
                            const p = ADKOTM_PARAM_MAP.get(fk);
                            const ds = ADKOTM_DIMENSION_STYLES[p?.dimension || 'O'];
                            const isSelectedTab = fk === activeKey;
                            return (
                              <button
                                key={fk}
                                type="button"
                                onClick={() => handleSwitchPopoverParameter(fk)}
                                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
                                  isSelectedTab
                                    ? `${ds.badgeClass} ring-1 ring-[#1C1B1F]/30`
                                    : 'bg-[#F2F5F3] text-[#444846] border-[#D5DDD8] hover:text-[#1C1B1F]'
                                }`}
                              >
                                {p?.dimension} · {p?.shortCode || p?.label || fk}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setHighlightPopover({
                              ...highlightPopover,
                              subMode:
                                highlightPopover.subMode === 'change_category'
                                  ? 'actions'
                                  : 'change_category',
                              selectedCategoryDim: activeParam?.dimension || 'O',
                              categoryCodeDraft: activeItem?.code || '',
                            })
                          }
                          title="Click to change ADKOTM category"
                          className="flex items-center gap-1.5 min-w-0 rounded-full pr-2 py-0.5 hover:bg-[#DCE8F7]/60 transition-colors cursor-pointer"
                        >
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${activeDimStyle.badgeClass}`}>
                            {activeParam?.dimension || 'O'}
                          </span>
                          <span className="font-heading text-base font-medium text-[#1C1B1F] truncate">
                            {activeParam?.label || activeKey}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          highlightPopover.subMode === 'crop'
                            ? handleCancelCropMode()
                            : setHighlightPopover(null)
                        }
                        aria-label="Close highlight popover"
                        className="text-[#444846] hover:text-[#1C1B1F] p-1 rounded-full hover:bg-[#E7ECE9] cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Sub-mode 1: Primary 3 Actions */}
                    {highlightPopover.subMode === 'actions' && (
                      <div className="space-y-2">
                        <div className="text-base font-medium text-[#1C1B1F] truncate">
                          {activeItem?.code || 'Unassigned'}
                        </div>
                        {activeItem?.evidence_quote && (
                          <p className="text-xs text-[#444846] italic line-clamp-2 leading-relaxed">
                            &ldquo;{activeItem.evidence_quote}&rdquo;
                          </p>
                        )}
                        <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-[#D5DDD8]">
                          <button
                            type="button"
                            onClick={() =>
                              setHighlightPopover({
                                ...highlightPopover,
                                subMode: 'change_category',
                                selectedCategoryDim: activeParam?.dimension || 'O',
                                categoryCodeDraft: activeItem?.code || '',
                              })
                            }
                            className="w-full min-h-[38px] inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#DCE8F7] hover:bg-[#528BCA]/25 text-xs font-medium text-[#132B47] cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <Tags className="w-3.5 h-3.5 text-[#528BCA] shrink-0" />
                            <span>Change Category</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setHighlightPopover({
                                ...highlightPopover,
                                subMode: 'edit_quote',
                                quoteDraft: activeItem?.evidence_quote || '',
                              })
                            }
                            className="w-full min-h-[38px] inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#F2F5F3] hover:bg-[#E7ECE9] text-xs font-medium text-[#1C1B1F] cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[#444846] shrink-0" />
                            <span>Edit Evidence Text</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleRejectField(activeKey);
                              setHighlightPopover(null);
                            }}
                            className="w-full min-h-[38px] inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#FBEAE9] hover:bg-[#D97A75]/25 text-xs font-medium text-[#7A3A36] cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#D97A75] shrink-0" />
                            <span>Unlink / Delete Tag</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Sub-mode 1b: Interactive ADKOTM Category Picker */}
                    {highlightPopover.subMode === 'change_category' && (() => {
                      const chosenDim: ADKOTMDimensionKey =
                        highlightPopover.selectedCategoryDim || activeParam?.dimension || 'O';
                      const dimParameters = ADKOTM_PARAMETER_CATALOG.filter(
                        (p) => p.dimension === chosenDim
                      );
                      const codeDraft = highlightPopover.categoryCodeDraft ?? activeItem?.code ?? '';

                      return (
                        <div className="space-y-2.5 pt-2 border-t border-[#D5DDD8]">
                          <div className="text-xs font-medium text-[#444846]">
                            Select ADKOTM Dimension &amp; Category
                          </div>

                          {/* Dimension Pills */}
                          <div className="flex flex-wrap gap-1">
                            {(['A', 'D', 'K', 'O', 'T', 'M'] as ADKOTMDimensionKey[]).map((dim) => {
                              const ds = ADKOTM_DIMENSION_STYLES[dim];
                              const isSelectedDim = dim === chosenDim;
                              return (
                                <button
                                  key={dim}
                                  type="button"
                                  onClick={() =>
                                    setHighlightPopover({
                                      ...highlightPopover,
                                      selectedCategoryDim: dim,
                                    })
                                  }
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                                    isSelectedDim
                                      ? 'bg-[#528BCA] text-white shadow-2xs'
                                      : 'bg-[#E7ECE9] text-[#444846] hover:bg-[#DCE8F7] hover:text-[#132B47]'
                                  }`}
                                >
                                  {dim} · {ds.name}
                                </button>
                              );
                            })}
                          </div>

                          {/* Optional Category / Theme Name Input */}
                          <div>
                            <label className="block text-[11px] font-medium text-[#444846] mb-1">
                              Category / Theme Value
                            </label>
                            <input
                              type="text"
                              value={codeDraft}
                              onChange={(e) =>
                                setHighlightPopover({
                                  ...highlightPopover,
                                  categoryCodeDraft: e.target.value,
                                })
                              }
                              placeholder="Keep existing or type category name..."
                              className="md3-field w-full px-3 py-1.5 text-sm"
                            />
                          </div>

                          {/* Subcategory / Parameter List for Chosen Dimension */}
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                            {dimParameters.map((param) => {
                              const isCurrentParam = param.key === activeKey;
                              const existingCode = activeFieldStates[param.key]?.code;
                              return (
                                <button
                                  key={param.key}
                                  type="button"
                                  onClick={() =>
                                    handleReassignHighlightCategory(
                                      activeKey,
                                      param.key,
                                      codeDraft.trim() || activeItem?.code || param.label
                                    )
                                  }
                                  className={`w-full text-left px-3 py-2 rounded-2xl text-xs transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                                    isCurrentParam
                                      ? 'bg-[#DCE8F7] text-[#132B47] font-semibold'
                                      : 'bg-[#F2F5F3] hover:bg-[#DDF3ED] text-[#1C1B1F]'
                                  }`}
                                >
                                  <span className="truncate font-medium">
                                    {param.shortCode ? `${param.shortCode} · ` : ''}
                                    {param.label}
                                  </span>
                                  {isCurrentParam ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#528BCA] text-white shrink-0">
                                      Current
                                    </span>
                                  ) : existingCode ? (
                                    <span className="text-[10px] text-[#444846] truncate max-w-[90px] shrink-0">
                                      {existingCode}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setHighlightPopover({
                                  ...highlightPopover,
                                  subMode: 'actions',
                                })
                              }
                              className="px-3 py-1 rounded-full text-xs font-medium text-[#444846] hover:bg-[#E7ECE9] cursor-pointer"
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Sub-mode 2: Interactive Span Cropping */}
                    {highlightPopover.subMode === 'crop' && (
                      <div className="space-y-2.5 pt-1.5 border-t border-[#EAE6DF]">
                        <p className="text-[13px] text-[#57534E] leading-relaxed">
                          Drag the <strong className="text-[#528BCA]">[ ]</strong> boundary handles or highlight a new phrase in the transcript.
                        </p>

                        {candidateSpanText ? (
                          <>
                            <div className="rounded-xl bg-[#F7F5F0] border border-[#EAE6DF] px-2.5 py-2 text-[13px] text-[#292524] italic max-h-20 overflow-y-auto leading-relaxed">
                              "{candidateSpanText}"
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[13px] text-[#57534E]">
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-[#78716C]">Start:</span>
                                <button
                                  type="button"
                                  onClick={() => handleNudgeCropBoundary('start', -1)}
                                  className="px-2 py-0.5 rounded-full border border-[#EAE6DF] hover:bg-[#F7F5F0] font-semibold cursor-pointer"
                                  title="Expand start 1 word left"
                                >
                                  -1w
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleNudgeCropBoundary('start', 1)}
                                  className="px-2 py-0.5 rounded-full border border-[#EAE6DF] hover:bg-[#F7F5F0] font-semibold cursor-pointer"
                                  title="Shrink start 1 word right"
                                >
                                  +1w
                                </button>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-[#78716C]">End:</span>
                                <button
                                  type="button"
                                  onClick={() => handleNudgeCropBoundary('end', -1)}
                                  className="px-2 py-0.5 rounded-full border border-[#EAE6DF] hover:bg-[#F7F5F0] font-semibold cursor-pointer"
                                  title="Shrink end 1 word left"
                                >
                                  -1w
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleNudgeCropBoundary('end', 1)}
                                  className="px-2 py-0.5 rounded-full border border-[#EAE6DF] hover:bg-[#F7F5F0] font-semibold cursor-pointer"
                                  title="Expand end 1 word right"
                                >
                                  +1w
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="rounded-xl bg-[#FEFBEB] border border-[#F7D147] px-2.5 py-2 text-[13px] text-[#6B5306] leading-relaxed">
                            No highlighted span yet. Drag across any text in the transcript to attach a verbatim quote.
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleCancelCropMode}
                            className="px-3 py-1.5 rounded-full text-[13px] font-semibold text-[#57534E] hover:bg-[#F7F5F0] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDraggingEdge(null);
                              setHighlightPopover(null);
                            }}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white cursor-pointer whitespace-nowrap"
                          >
                            <Check className="w-3.5 h-3.5" /> Apply Span
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Sub-mode 3: Inline Edit Evidence Text */}
                    {highlightPopover.subMode === 'edit_quote' && (
                      <div className="space-y-2 pt-1.5 border-t border-[#EAE6DF]">
                        <label className="block text-[13px] font-bold uppercase text-[#78716C]">
                          Evidence Quote Text
                        </label>
                        <textarea
                          rows={3}
                          autoFocus
                          value={highlightPopover.quoteDraft}
                          onChange={(e) =>
                            setHighlightPopover({
                              ...highlightPopover,
                              quoteDraft: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              handleSavePopoverQuoteEdit();
                            }
                          }}
                          className="doc-editor w-full px-3 py-2 text-base leading-[1.65] rounded-xl border border-[#EAE6DF] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 focus:border-[#528BCA] text-[#292524]"
                          placeholder="Trim or clean the stored evidence quote..."
                        />
                        <p className="text-[13px] text-[#78716C] leading-relaxed">
                          {!highlightPopover.quoteDraft.trim()
                            ? 'Empty quote clears the transcript highlight.'
                            : draftMatch
                            ? 'Matches transcript span — highlight will update.'
                            : 'Custom quote — saved on card without transcript highlight.'}
                        </p>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              setHighlightPopover({
                                ...highlightPopover,
                                subMode: 'actions',
                              })
                            }
                            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#57534E] hover:text-[#292524] cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" /> Back
                          </button>
                          <button
                            type="button"
                            onClick={handleSavePopoverQuoteEdit}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white cursor-pointer whitespace-nowrap"
                          >
                            <Check className="w-3.5 h-3.5" /> Save Quote
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Floating Click-to-Code Popover (for uncoded text selection) */}
              {selectionPopover && (
                <div
                  style={{ top: selectionPopover.top, left: selectionPopover.left }}
                  className="absolute z-30 w-[310px] bg-white rounded-2xl border border-[#EAE6DF] shadow-studio p-3.5 space-y-2.5"
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] text-[#57534E] italic line-clamp-2 leading-relaxed">
                      "{selectionPopover.quote}"
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectionPopover(null)}
                      aria-label="Close tag selection popover"
                      className="text-[#78716C] hover:text-[#292524] p-0.5 cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!selectionPopover.chosenDimension ? (
                    <div className="grid grid-cols-1 gap-1.5">
                      {POPOVER_DIMENSIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handleChoosePopoverDimension(opt.key)}
                          className={`w-full text-left px-3 py-1.5 rounded-full border text-[13px] font-semibold cursor-pointer transition-colors ${opt.buttonClass}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1.5 border-t border-[#EAE6DF]">
                      <div>
                        <label className="block text-[13px] font-bold text-[#78716C] uppercase mb-1">
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
                          className="w-full px-2.5 py-1.5 text-[15px] rounded-xl border border-[#EAE6DF] bg-white text-[#292524]"
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
                        <label className="block text-[13px] font-bold text-[#78716C] uppercase mb-1">
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
                          className="w-full px-3 py-1.5 text-[15px] rounded-xl border border-[#EAE6DF] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 focus:border-[#528BCA]"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectionPopover({ ...selectionPopover, chosenDimension: null })
                          }
                          className="text-[13px] font-semibold text-[#57534E] hover:text-[#292524] cursor-pointer"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleCommitPopoverCode}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white cursor-pointer"
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
              <div className="flex flex-wrap items-center justify-end gap-2 lg:min-h-10">
                {onOpenNormalizeTags && (
                  <button
                    type="button"
                    onClick={onOpenNormalizeTags}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold bg-white hover:bg-[#F7F5F0] text-[#292524] border border-[#EAE6DF] shadow-2xs cursor-pointer transition-all whitespace-nowrap shrink-0"
                    title="Standardize fragmented Product [PP] labels across records while keeping Brands [PP1]"
                  >
                    <Tags className="w-3.5 h-3.5 text-[#528BCA]" />
                    <span>Normalize Tags</span>
                    {normalizationProposalsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[13px] font-bold bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147] tabular-nums">
                        {normalizationProposalsCount}
                      </span>
                    )}
                  </button>
                )}

                {onOpenAddDecode && (
                  <button
                    type="button"
                    onClick={onOpenAddDecode}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold bg-white hover:bg-[#F7F5F0] text-[#292524] border border-[#EAE6DF] shadow-2xs cursor-pointer transition-all whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#292524]" /> Add Decode
                  </button>
                )}

                {onDecodeAll && (
                  <button
                    type="button"
                    disabled={isBatchDecoding || records.length === 0}
                    onClick={onDecodeAll}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold bg-[#528BCA] hover:bg-[#3F78B5] disabled:opacity-50 text-white shadow-xs cursor-pointer transition-all whitespace-nowrap shrink-0"
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
              className="bg-white rounded-3xl border border-[#EAE6DF] shadow-studio flex flex-col overflow-hidden h-[580px] lg:h-[calc(100vh-230px)] lg:min-h-[540px] lg:max-h-[700px]"
            >
              {/* Coding Sheet Header */}
              <div className="px-4 py-3 border-b border-[#EAE6DF] bg-[#F7F5F0] flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-heading text-base sm:text-lg font-bold text-[#292524] whitespace-nowrap">
                    Copilot Coding Sheet
                  </span>
                  {activeProgress?.status === 'human_verified' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold bg-[#96D6C7] text-[#1E4D42] whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Human Verified
                    </span>
                  ) : activeProgress?.status === 'needs_review' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147] whitespace-nowrap shrink-0">
                      Copilot Draft • {activeProgress.populatedCount} coded
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[13px] font-semibold bg-white text-[#78716C] border border-[#EAE6DF] whitespace-nowrap shrink-0">
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
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[13px] font-semibold bg-white hover:bg-[#EEF4FB] text-[#292524] border border-[#EAE6DF] hover:border-[#528BCA]/45 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {isScanningSignals ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Radar className="w-3.5 h-3.5 text-[#528BCA]" />
                    )}
                    Scan Gaps
                  </button>
                </div>
              </div>

            {/* Coding Sheet Body */}
            <div ref={codingSheetRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {!activeRecord.adkotmDecode ? (
                <div className="py-16 px-4 text-center space-y-4">
                  <Sparkles className="w-8 h-8 text-[#D97A75] mx-auto opacity-90" />
                  <div>
                    <h4 className="text-xl font-bold text-[#292524]">
                      Ready for Copilot Draft
                    </h4>
                    <p className="text-lg text-[#57534E] mt-2 leading-relaxed">
                      Let AI stage ADKOTM parameters with verbatim evidence quotes.
                    </p>
                    <p className="text-base text-[#78716C] mt-1.5 max-w-md mx-auto leading-relaxed">
                      Unstated parameters remain strictly null until you verify or edit them.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={decodingId === activeRecord.id || !activeTranscript}
                    onClick={() => onDecodeSingle(activeRecord)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold bg-[#528BCA] hover:bg-[#3F78B5] disabled:opacity-50 text-white shadow-xs cursor-pointer"
                  >
                    {decodingId === activeRecord.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Drafting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Run Copilot Draft
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <>
                  {/* Populated Parameter Rows */}
                  {populatedParams.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-dashed border-[#EAE6DF] text-center text-base text-[#57534E] leading-relaxed">
                      All extracted parameters were rejected or unstated — highlight text in the transcript or expand unstated fields below.
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
                          className={`rounded-2xl border p-4 transition-all duration-200 ${
                            isReviewNeeded
                              ? 'border-[#F7D147] bg-[#FEFBEB]/65'
                              : isAccepted
                              ? 'border-[#96D6C7] bg-[#F2FBF8]/65'
                              : 'border-[#EAE6DF] bg-white'
                          } ${isFocused ? 'ring-2 ring-[#528BCA]/45' : 'hover:border-[#D6CFC5]'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[13px] font-bold border shrink-0 ${dimStyle.badgeClass}`}
                              >
                                {param.dimension}
                              </span>
                              <span className="font-heading text-sm font-bold text-[#292524] truncate">
                                {param.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isReviewNeeded ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147]">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Review
                                </span>
                              ) : item.status === 'MANUAL' ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[13px] font-semibold bg-[#F2F7FC] text-[#234B78] border border-[#528BCA]/40">
                                  Manual
                                </span>
                              ) : item.status === 'ACCEPTED' ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[13px] font-bold bg-[#96D6C7] text-[#1E4D42]">
                                  Accepted
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[13px] font-semibold bg-[#F7F5F0] text-[#78716C]">
                                  Copilot Draft
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Analytical Code & Evidence Quote (dual inline editor) */}
                          <div className="mt-2.5">
                            {isEditingThis ? (
                              <div
                                className="space-y-2.5 pt-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div>
                                  <label className="block text-[13px] font-bold uppercase text-[#78716C] mb-1">
                                    Normalized Code / Value
                                  </label>
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
                                    className="w-full px-3 py-2 text-base font-semibold rounded-xl border border-[#528BCA] bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 text-[#292524]"
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <label className="text-[13px] font-bold uppercase text-[#78716C]">
                                      Evidence Quote Span
                                    </label>
                                    {activeTranscript && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenCropFromCard(param.key)}
                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold text-[#234B78] bg-[#F2F7FC] hover:bg-[#E4EEF9] border border-[#528BCA]/40 cursor-pointer whitespace-nowrap shrink-0"
                                      >
                                        <Crosshair className="w-3.5 h-3.5" /> Crop in Transcript
                                      </button>
                                    )}
                                  </div>
                                  <textarea
                                    rows={2}
                                    value={editingQuoteValue}
                                    onChange={(e) => setEditingQuoteValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        handleSaveInlineEdit(param.key);
                                      } else if (e.key === 'Escape') {
                                        setEditingFieldKey(null);
                                      }
                                    }}
                                    aria-label={`Edit ${param.label} evidence quote`}
                                    placeholder="Paste or trim verbatim transcript quote..."
                                    className="doc-editor w-full px-3 py-2 text-base leading-[1.65] italic rounded-xl border border-[#EAE6DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 focus:border-[#528BCA] text-[#292524]"
                                  />
                                  {editingQuoteValue.trim() &&
                                    activeTranscript &&
                                    item.source !== 'filename_metadata' &&
                                    item.source !== 'session_metadata' &&
                                    !verifyEvidenceQuote(activeTranscript, editingQuoteValue) && (
                                      <p className="mt-1 text-[13px] text-[#78716C]">
                                        Custom quote · saved on card without transcript highlight
                                      </p>
                                    )}
                                </div>

                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingFieldKey(null)}
                                    className="px-3 py-1.5 rounded-full text-[13px] font-semibold text-[#57534E] hover:bg-[#F7F5F0] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInlineEdit(param.key)}
                                    className="px-4 py-1.5 rounded-full text-[13px] font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white cursor-pointer whitespace-nowrap"
                                  >
                                    Save Changes
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartInlineEdit(param.key);
                                }}
                                title="Click to edit normalized code and evidence quote"
                                className="w-full text-left group flex items-center justify-between gap-2 rounded-xl px-2 py-1 -mx-2 hover:bg-white/80 cursor-text"
                              >
                                <span className="text-base font-semibold text-[#292524] break-words leading-relaxed">
                                  {item.code}
                                </span>
                                <Edit3 className="w-4 h-4 text-[#78716C] group-hover:text-[#528BCA] shrink-0" />
                              </button>
                            )}
                          </div>

                          {/* 1-line muted evidence_quote preview */}
                          {!isEditingThis && item.evidence_quote && (
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <p
                                className="text-[15px] text-[#57534E] italic truncate leading-relaxed"
                                title={item.evidence_quote}
                              >
                                "{item.evidence_quote}"
                              </p>
                              {activeTranscript &&
                                item.source !== 'filename_metadata' &&
                                item.source !== 'session_metadata' &&
                                !verifyEvidenceQuote(activeTranscript, item.evidence_quote) && (
                                  <span className="text-[13px] text-[#78716C] whitespace-nowrap shrink-0">
                                    Custom quote
                                  </span>
                                )}
                            </div>
                          )}

                          {/* Equal-weight Accept / Reject Buttons */}
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptField(param.key);
                              }}
                              aria-label={`Accept ${param.label}`}
                              className={`inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-full text-[13px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                                isAccepted
                                  ? 'bg-[#96D6C7] text-[#1E4D42] border-[#96D6C7]'
                                  : 'bg-white hover:bg-[#F2FBF8] text-[#1E4D42] border-[#96D6C7]'
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
                              className="inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-full text-[13px] font-semibold border bg-white hover:bg-[#FDF4F3] text-[#7A3A36] border-[#EAE6DF] hover:border-[#D97A75]/45 transition-colors cursor-pointer whitespace-nowrap"
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
                    <div className="pt-2 space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="font-heading text-[13px] font-bold uppercase tracking-wider text-[#6B5306] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#6B5306]" />
                          Missed Signals Detected ({activeMissedSignals.length})
                        </span>
                      </div>
                      {activeMissedSignals.map((sig) => {
                        const targetParam = ADKOTM_PARAM_MAP.get(sig.suggestedFieldKey);
                        const dimStyle = ADKOTM_DIMENSION_STYLES[sig.suggestedDimension];
                        return (
                          <div
                            key={sig.id}
                            className="rounded-2xl border border-[#F7D147] bg-[#FEFBEB] p-4 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[13px] font-bold border shrink-0 ${dimStyle.badgeClass}`}
                                >
                                  {sig.suggestedDimension}
                                </span>
                                <span className="font-heading text-sm font-bold text-[#292524] truncate">
                                  {targetParam?.label || sig.suggestedFieldKey}
                                </span>
                              </div>
                              <span className="text-[13px] font-semibold text-[#6B5306] shrink-0">
                                Uncoded cue
                              </span>
                            </div>
                            <p className="text-base font-semibold text-[#292524] leading-relaxed">
                              Suggested code: {sig.suggestedCode}
                            </p>
                            <p className="text-[15px] text-[#57534E] italic line-clamp-2 leading-relaxed">
                              "{sig.sentence}"
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleApplyMissedSignal(sig)}
                                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-semibold bg-[#292524] hover:bg-[#3F3A38] text-white cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" /> Apply Code
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDismissMissedSignal(sig.id)}
                                className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-[#57534E] hover:bg-[#EAE6DF]/60 cursor-pointer"
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
                    <div className="pt-2 border-t border-[#EAE6DF]">
                      <button
                        type="button"
                        onClick={() => setShowNullFields((v) => !v)}
                        className="w-full py-2 px-3 rounded-full text-[13px] font-semibold text-[#78716C] hover:text-[#292524] hover:bg-[#F7F5F0] flex items-center justify-center gap-1.5 cursor-pointer"
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
                                className="rounded-xl border border-[#EAE6DF] bg-[#F7F5F0]/60 px-3 py-2 flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[13px] font-bold border shrink-0 ${dimStyle.badgeClass}`}
                                  >
                                    {param.dimension}
                                  </span>
                                  <span className="text-sm font-medium text-[#57534E] truncate">
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
                                      className="flex-1 min-w-0 px-2.5 py-1 text-[13px] rounded-full border border-[#528BCA] bg-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveInlineEdit(param.key)}
                                      className="px-3 py-1 rounded-full text-[13px] font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white cursor-pointer"
                                    >
                                      Add
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartInlineEdit(param.key)}
                                    className="text-[13px] font-semibold text-[#528BCA] hover:underline px-2 py-0.5 rounded-full hover:bg-[#F2F7FC] cursor-pointer shrink-0"
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
            <div className="px-4 py-3 border-t border-[#EAE6DF] bg-[#F7F5F0] flex items-center justify-between gap-3 shrink-0">
              {activeRecord.adkotmDecode && (
                <button
                  type="button"
                  disabled={decodingId === activeRecord.id || !activeTranscript}
                  onClick={() => onDecodeSingle(activeRecord)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold bg-white hover:bg-[#EEF4FB] text-[#292524] border border-[#EAE6DF] hover:border-[#528BCA]/45 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {decodingId === activeRecord.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Drafting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#D97A75]" />
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
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-[13px] sm:text-sm font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white shadow-xs cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>All Verified • View Analytics</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!activeRecord.adkotmDecode}
                    onClick={handleVerifyAndNext}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-[13px] sm:text-sm font-semibold bg-[#528BCA] hover:bg-[#3F78B5] disabled:opacity-40 text-white shadow-xs cursor-pointer whitespace-nowrap shrink-0"
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
