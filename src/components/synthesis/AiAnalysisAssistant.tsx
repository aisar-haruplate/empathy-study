import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Plus,
  Bot,
  Check,
  RotateCcw,
  History,
  Lightbulb,
  Layers,
  Search,
  SlidersHorizontal,
  Quote,
  Trash2,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import {
  InterviewRecord,
  CrossAnalysisFormula,
  AiChatMessage,
  CopilotTab,
  CopilotFieldSuggestion,
  TaxonomyMergeProposal,
  UncodedSignal,
  ReDecodeDiffEntry,
  ADKOTMDecode,
} from '../../types';
import { AnalysisChart } from '../charts/AnalysisCharts';
import {
  applyFieldUpdateToDecode,
  createEmptyDecode,
  loadCustomCodingRules,
  mergeAcceptSuggestion,
  saveCustomCodingRules,
} from '../../lib/adkotmUtils';
import { isAnalysisEligibleRecord } from '../../lib/recordEligibility';

interface AiAnalysisAssistantProps {
  records: InterviewRecord[];
  isOpen: boolean;
  onClose: () => void;
  initialTab?: CopilotTab;
  initialRecordId?: string | null;
  onUpdateRecord?: (updated: InterviewRecord) => void;
  onBatchUpdateRecords?: (updated: InterviewRecord[]) => void;
  onAddFormula?: (formula: CrossAnalysisFormula) => void;
  onRevertFormula?: (formulaId: string) => void;
  onOpenVersionHistory?: () => void;
  versionHistoryCount?: number;
  safePostJson: <T = any>(url: string, payload: any) => Promise<T>;
}

const QUICK_PROMPTS = [
  'Show pie chart of gut health awareness for mums vs elderly',
  'Create a bar chart of supplements vs food products bought',
  'What do participants do to solve digestive and constipation problems?',
  'Show histogram of participant age distribution',
  'Add a new formula for Health Consciousness (AW + PP + Routine)',
  'Compare spending power across Kepong vs Ampang',
];

const PRESET_CODING_RULES = [
  'Always extract Malaysian probiotic/supplement brands into PP1',
  "Infer Family Role [FR] as 'Mum' if speaker refers to 'my kid/child' as a mother",
  'Capture child extracurricular or lifestyle context (e.g., swimmer, picky eater) in dailyRoutine or eatingContext',
];

const confidenceBadgeStyle = (confidence?: string): string => {
  if (confidence === 'HIGH' || confidence === 'HIGH (Filename Metadata)') {
    return 'bg-[#F2FBF8] text-[#1E4D42] border-[#96D6C7]';
  }
  if (confidence === 'MEDIUM') {
    return 'bg-[#FEFBEB] text-[#6B5306] border-[#F7D147]';
  }
  if (confidence === 'UNVERIFIED') {
    return 'bg-[#FDF4F3] text-[#7A3A36] border-[#D97A75]/45';
  }
  return 'bg-[#F7F5F0] text-[#57534E] border-[#EAE6DF]';
};

export const AiAnalysisAssistant: React.FC<AiAnalysisAssistantProps> = ({
  records,
  isOpen,
  onClose,
  initialTab = 'chat',
  initialRecordId = null,
  onUpdateRecord,
  onBatchUpdateRecords,
  onAddFormula,
  onRevertFormula,
  onOpenVersionHistory,
  versionHistoryCount = 0,
  safePostJson,
}) => {
  const [activeTab, setActiveTab] = useState<CopilotTab>(initialTab);
  const eligibleRecords = useMemo(() => records.filter(isAnalysisEligibleRecord), [records]);
  const decodedRecords = useMemo(
    () => eligibleRecords.filter((r) => Boolean(r.adkotmDecode)),
    [eligibleRecords]
  );

  const [selectedRecordId, setSelectedRecordId] = useState<string>(
    initialRecordId || eligibleRecords[0]?.id || ''
  );

  // Sync tab & record when opened with shortcut context
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab || 'chat');
    if (initialRecordId) {
      setSelectedRecordId(initialRecordId);
    } else if (!eligibleRecords.some((r) => r.id === selectedRecordId)) {
      setSelectedRecordId(eligibleRecords[0]?.id || '');
    }
  }, [isOpen, initialTab, initialRecordId, eligibleRecords, selectedRecordId]);

  const activeRecord = useMemo(
    () => eligibleRecords.find((r) => r.id === selectedRecordId) || eligibleRecords[0] || null,
    [eligibleRecords, selectedRecordId]
  );

  const totalPendingSuggestions = useMemo(
    () =>
      eligibleRecords.reduce(
        (sum, r) => sum + (r.adkotmDecode?.copilotSuggestions?.length || 0),
        0
      ),
    [eligibleRecords]
  );

  // ---------------- TAB 1: CHAT STATE ----------------
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: "Hello! I am your Nutrition Empathy Study Copilot. Ask questions, generate charts/formulas in Chat, or use the Suggestions, Normalize, Gap Scan, and Rules & Diff tabs to audit your Step 3 ADKOTM decodes.",
    },
  ]);
  const [addedFormulaIds, setAddedFormulaIds] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

  // ---------------- TAB 2: SUGGESTIONS STATE ----------------
  const [isScanningSuggestions, setIsScanningSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  // ---------------- TAB 3: NORMALIZE TAXONOMY STATE ----------------
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [normalizeProposals, setNormalizeProposals] = useState<TaxonomyMergeProposal[]>([]);
  const [selectedProposalIds, setSelectedProposalIds] = useState<Record<string, boolean>>({});
  const [normalizeStatusMsg, setNormalizeStatusMsg] = useState<string | null>(null);

  // ---------------- TAB 4: GAP SCANNER STATE ----------------
  const [isScanningGaps, setIsScanningGaps] = useState(false);
  const [gapSignalsByRecord, setGapSignalsByRecord] = useState<Record<string, UncodedSignal[]>>({});
  const [uncoveredCountByRecord, setUncoveredCountByRecord] = useState<Record<string, number>>({});
  const [gapStatusMsg, setGapStatusMsg] = useState<string | null>(null);

  // ---------------- TAB 5: CUSTOM RULES & DIFF STATE ----------------
  const [customRules, setCustomRules] = useState<string[]>(() => loadCustomCodingRules());
  const [newRuleText, setNewRuleText] = useState('');
  const [redecodeScope, setRedecodeScope] = useState<'selected' | 'all'>('selected');
  const [isRedecodingRules, setIsRedecodingRules] = useState(false);
  const [ruleDiffs, setRuleDiffs] = useState<ReDecodeDiffEntry[]>([]);
  const [candidateDecodesByRecord, setCandidateDecodesByRecord] = useState<
    Record<string, ADKOTMDecode>
  >({});
  const [selectedDiffIds, setSelectedDiffIds] = useState<Record<string, boolean>>({});
  const [rulesStatusMsg, setRulesStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    saveCustomCodingRules(customRules);
  }, [customRules]);

  const commitBatchUpdates = (updatedList: InterviewRecord[]) => {
    if (updatedList.length === 0) return;
    if (onBatchUpdateRecords) {
      onBatchUpdateRecords(updatedList);
    } else if (onUpdateRecord) {
      updatedList.forEach((rec) => onUpdateRecord(rec));
    }
  };

  // ---------------- CHAT HANDLERS ----------------
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isChatLoading) return;

    const userMsg: AiChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsChatLoading(true);

    try {
      const res = await safePostJson<{
        success: boolean;
        reply: string;
        chartSpec?: any;
        suggestedFormula?: CrossAnalysisFormula;
      }>('/api/ai-assistant/chat', {
        message: text,
        records,
      });

      if (res && res.reply) {
        const assistantMsg: AiChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: res.reply,
          chartSpec: res.chartSpec,
          suggestedFormula: res.suggestedFormula,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      const errMsg: AiChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `Sorry, I encountered an issue analyzing the study data: ${err.message || 'Please check your connection and try again.'}`,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleApplyFormula = (formula: CrossAnalysisFormula) => {
    if (onAddFormula) {
      onAddFormula(formula);
      setAddedFormulaIds((prev) => ({ ...prev, [formula.id]: true }));
    }
  };

  // ---------------- SUGGESTION HANDLERS ----------------
  const activeSuggestions: CopilotFieldSuggestion[] =
    activeRecord?.adkotmDecode?.copilotSuggestions || [];

  const handleScanSuggestions = async () => {
    if (!activeRecord) return;
    setIsScanningSuggestions(true);
    setSuggestionError(null);
    try {
      const res = await safePostJson<{
        success: boolean;
        suggestions: CopilotFieldSuggestion[];
      }>('/api/copilot/suggest', {
        record: activeRecord,
        customRules,
      });

      const mergedSuggestions = Array.isArray(res?.suggestions) ? res.suggestions : [];
      const baseDecode = activeRecord.adkotmDecode || createEmptyDecode();
      onUpdateRecord?.({
        ...activeRecord,
        decodeStatus: activeRecord.adkotmDecode ? 'decoded' : activeRecord.decodeStatus,
        adkotmDecode: {
          ...baseDecode,
          copilotSuggestions: mergedSuggestions,
        },
      });
    } catch (err: any) {
      setSuggestionError(err?.message || 'Failed to inspect transcript for implicit clues.');
    } finally {
      setIsScanningSuggestions(false);
    }
  };

  const handleAcceptSuggestion = (suggestion: CopilotFieldSuggestion) => {
    if (!activeRecord || !onUpdateRecord) return;
    const updatedDecode = mergeAcceptSuggestion(activeRecord.adkotmDecode, suggestion);
    onUpdateRecord({
      ...activeRecord,
      decodeStatus: 'decoded',
      adkotmDecode: updatedDecode,
    });
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    if (!activeRecord || !onUpdateRecord || !activeRecord.adkotmDecode) return;
    const nextSuggestions = (activeRecord.adkotmDecode.copilotSuggestions || []).filter(
      (s) => s.id !== suggestionId
    );
    onUpdateRecord({
      ...activeRecord,
      adkotmDecode: {
        ...activeRecord.adkotmDecode,
        copilotSuggestions: nextSuggestions,
      },
    });
  };

  const handleAcceptAllVerifiedSuggestions = () => {
    if (!activeRecord || !onUpdateRecord || activeSuggestions.length === 0) return;
    const grounded = activeSuggestions.filter((s) => Boolean(s.evidence_quote?.trim()));
    if (grounded.length === 0) return;
    let nextDecode = activeRecord.adkotmDecode;
    for (const s of grounded) {
      nextDecode = mergeAcceptSuggestion(nextDecode, s);
    }
    onUpdateRecord({
      ...activeRecord,
      decodeStatus: 'decoded',
      adkotmDecode: nextDecode,
    });
  };

  // ---------------- NORMALIZE HANDLERS ----------------
  const handleRunNormalize = async () => {
    setIsNormalizing(true);
    setNormalizeStatusMsg(null);
    try {
      const res = await safePostJson<{
        success: boolean;
        proposals: TaxonomyMergeProposal[];
      }>('/api/copilot/normalize', {
        records: decodedRecords,
      });
      const proposals = Array.isArray(res?.proposals) ? res.proposals : [];
      setNormalizeProposals(proposals);
      const initialSelected: Record<string, boolean> = {};
      proposals.forEach((p) => {
        initialSelected[p.id] = true;
      });
      setSelectedProposalIds(initialSelected);
      if (proposals.length === 0) {
        setNormalizeStatusMsg('All PP and PP1 labels across decoded records are already aligned.');
      }
    } catch (err: any) {
      setNormalizeStatusMsg(`Error: ${err?.message || 'Failed to analyze taxonomy.'}`);
    } finally {
      setIsNormalizing(false);
    }
  };

  const handleApplySelectedNormalizations = () => {
    const selected = normalizeProposals.filter((p) => selectedProposalIds[p.id]);
    if (selected.length === 0) return;

    const updatedRecords: InterviewRecord[] = [];
    for (const proposal of selected) {
      const rec = eligibleRecords.find((r) => r.id === proposal.recordId);
      if (!rec || !rec.adkotmDecode) continue;

      let nextDecode = applyFieldUpdateToDecode(rec.adkotmDecode, {
        section: 'objects',
        field: 'productsPurchased',
        postAnalysisCode: 'PP',
        value: proposal.afterPP ?? null,
        evidence_quote: rec.adkotmDecode.fieldDetails?.productsPurchased?.evidence_quote || null,
        confidence: rec.adkotmDecode.fieldDetails?.productsPurchased?.confidence || 'HIGH',
        reasoning: `Normalized via AI Copilot: ${proposal.reason}`,
      });

      nextDecode = applyFieldUpdateToDecode(nextDecode, {
        section: 'objects',
        field: 'brandPreferences',
        postAnalysisCode: 'PP1',
        value: proposal.afterPP1 ?? null,
        evidence_quote: rec.adkotmDecode.fieldDetails?.brandPreferences?.evidence_quote || null,
        confidence: rec.adkotmDecode.fieldDetails?.brandPreferences?.confidence || 'HIGH',
        reasoning: `Normalized via AI Copilot: ${proposal.reason}`,
      });

      updatedRecords.push({
        ...rec,
        adkotmDecode: nextDecode,
      });
    }

    commitBatchUpdates(updatedRecords);
    setNormalizeProposals((prev) => prev.filter((p) => !selectedProposalIds[p.id]));
    setSelectedProposalIds({});
    setNormalizeStatusMsg(`Applied standardized PP/PP1 merges to ${updatedRecords.length} record(s).`);
  };

  // ---------------- GAP SCAN HANDLERS ----------------
  const activeGapSignals = activeRecord ? gapSignalsByRecord[activeRecord.id] || [] : [];

  const handleRunGapScan = async () => {
    if (!activeRecord) return;
    setIsScanningGaps(true);
    setGapStatusMsg(null);
    try {
      const res = await safePostJson<{
        success: boolean;
        signals: UncodedSignal[];
        uncoveredCount: number;
      }>('/api/copilot/scan-gaps', {
        record: activeRecord,
      });

      const signals = Array.isArray(res?.signals) ? res.signals : [];
      setGapSignalsByRecord((prev) => ({ ...prev, [activeRecord.id]: signals }));
      setUncoveredCountByRecord((prev) => ({
        ...prev,
        [activeRecord.id]: res?.uncoveredCount ?? 0,
      }));
      if (signals.length === 0) {
        setGapStatusMsg('No missed substantive signals found in uncovered sentences.');
      }
    } catch (err: any) {
      setGapStatusMsg(`Error: ${err?.message || 'Failed to scan for missed signals.'}`);
    } finally {
      setIsScanningGaps(false);
    }
  };

  const handleApplyGapSignal = (signal: UncodedSignal) => {
    if (!activeRecord || !onUpdateRecord) return;
    const nextDecode = applyFieldUpdateToDecode(activeRecord.adkotmDecode, {
      section: signal.suggestedSection,
      field: signal.suggestedField,
      postAnalysisCode: signal.postAnalysisCode,
      value: signal.suggestedCode,
      evidence_quote: signal.sentence,
      confidence: 'MEDIUM',
      reasoning: `Applied from Gap Scanner: ${signal.reasoning}`,
    });
    onUpdateRecord({
      ...activeRecord,
      decodeStatus: 'decoded',
      adkotmDecode: nextDecode,
    });
    setGapSignalsByRecord((prev) => ({
      ...prev,
      [activeRecord.id]: (prev[activeRecord.id] || []).filter((s) => s.id !== signal.id),
    }));
  };

  const handleDismissGapSignal = (signalId: string) => {
    if (!activeRecord) return;
    setGapSignalsByRecord((prev) => ({
      ...prev,
      [activeRecord.id]: (prev[activeRecord.id] || []).filter((s) => s.id !== signalId),
    }));
  };

  // ---------------- CUSTOM RULES & DIFF HANDLERS ----------------
  const handleAddRule = (ruleText?: string) => {
    const trimmed = (ruleText ?? newRuleText).trim();
    if (!trimmed) return;
    if (!customRules.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      setCustomRules((prev) => [...prev, trimmed]);
    }
    if (!ruleText) setNewRuleText('');
  };

  const handleRemoveRule = (index: number) => {
    setCustomRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRunRedecodeWithRules = async () => {
    const targetRecords =
      redecodeScope === 'selected'
        ? activeRecord
          ? [activeRecord]
          : []
        : eligibleRecords.filter((r) => Boolean(r.cleanedTranscript || r.transcript));

    if (targetRecords.length === 0) return;

    setIsRedecodingRules(true);
    setRulesStatusMsg(null);
    try {
      const res = await safePostJson<{
        success: boolean;
        diffs: ReDecodeDiffEntry[];
        decodedByRecordId: Record<string, ADKOTMDecode>;
      }>('/api/copilot/redecode-rules', {
        records: targetRecords,
        customRules,
      });

      const diffs = Array.isArray(res?.diffs) ? res.diffs : [];
      setRuleDiffs(diffs);
      setCandidateDecodesByRecord(res?.decodedByRecordId || {});
      const initialChecks: Record<string, boolean> = {};
      diffs.forEach((d) => {
        initialChecks[d.id] = true;
      });
      setSelectedDiffIds(initialChecks);

      if (diffs.length === 0) {
        setRulesStatusMsg('Re-decode completed — all existing fields already match the new rules.');
      }
    } catch (err: any) {
      setRulesStatusMsg(`Error: ${err?.message || 'Failed to re-decode with rules.'}`);
    } finally {
      setIsRedecodingRules(false);
    }
  };

  const handleApplySelectedDiffs = () => {
    const selected = ruleDiffs.filter((d) => selectedDiffIds[d.id]);
    if (selected.length === 0) return;

    const diffsByRecord = new Map<string, ReDecodeDiffEntry[]>();
    selected.forEach((d) => {
      const list = diffsByRecord.get(d.recordId) || [];
      list.push(d);
      diffsByRecord.set(d.recordId, list);
    });

    const updatedRecords: InterviewRecord[] = [];
    for (const [recId, recDiffs] of diffsByRecord.entries()) {
      const rec = eligibleRecords.find((r) => r.id === recId);
      if (!rec) continue;
      let nextDecode = rec.adkotmDecode;
      for (const diff of recDiffs) {
        nextDecode = applyFieldUpdateToDecode(nextDecode, {
          section: diff.section,
          field: diff.field,
          postAnalysisCode: diff.postAnalysisCode,
          value: diff.newValue,
          evidence_quote: diff.evidence_quote,
          confidence: diff.confidence,
          reasoning: diff.reasoning,
        });
      }
      const candidate = candidateDecodesByRecord[recId];
      if (candidate?.copilotSuggestions && nextDecode) {
        nextDecode = {
          ...nextDecode,
          copilotSuggestions: candidate.copilotSuggestions,
        };
      }
      updatedRecords.push({
        ...rec,
        decodeStatus: 'decoded',
        adkotmDecode: nextDecode,
      });
    }

    commitBatchUpdates(updatedRecords);
    setRuleDiffs([]);
    setSelectedDiffIds({});
    setCandidateDecodesByRecord({});
    setRulesStatusMsg(
      `Applied ${selected.length} field update(s) across ${updatedRecords.length} record(s).`
    );
  };

  if (!isOpen) return null;

  const selectedNormalizeCount = normalizeProposals.filter((p) => selectedProposalIds[p.id]).length;
  const selectedDiffCount = ruleDiffs.filter((d) => selectedDiffIds[d.id]).length;
  const groundedSuggestionCount = activeSuggestions.filter((s) =>
    Boolean(s.evidence_quote?.trim())
  ).length;

  return (
    <>
      <div
        className="fixed inset-0 bg-[#1B2420]/35 z-40 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] lg:w-[620px] max-w-full bg-[#FDFCF8] shadow-studio rounded-l-3xl border-l border-[#D5DDD8] flex flex-col animate-in slide-in-from-right duration-200 overflow-hidden">
        {/* Light Tonal MD3 Header */}
        <div className="px-5 py-4 bg-[#F2F5F3] text-[#1C1B1F] flex items-center justify-between shrink-0 border-b border-[#E2E6E4]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#DCE8F7] border border-[#528BCA]/35 flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles className="w-5 h-5 text-[#528BCA]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading font-bold text-base sm:text-lg leading-tight tracking-[-0.02em] text-[#1C1B1F] truncate">
                Empathy Study AI Copilot
              </h3>
              <p className="text-xs text-[#4F5E57] truncate mt-0.5">
                Gemini 3.1 Flash Lite · Evidence-Linked QA &amp; Analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenVersionHistory && (
              <button
                type="button"
                onClick={onOpenVersionHistory}
                className="px-3 py-1.5 font-heading text-xs font-semibold rounded-full bg-[#DDF3ED] hover:bg-[#96D6C7]/55 text-[#133830] transition-all flex items-center gap-1.5 border border-[#96D6C7] cursor-pointer whitespace-nowrap shrink-0"
                title="View and revert AI changes"
              >
                <History className="w-3.5 h-3.5 text-[#133830]" />
                <span>History</span>
                {versionHistoryCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-[#FDF3C7] text-[#3B2E00] font-bold tabular-nums">
                    {versionHistoryCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Copilot"
              className="p-2 rounded-full text-[#4F5E57] hover:text-[#1C1B1F] hover:bg-[#E7ECE9] transition-colors cursor-pointer"
              title="Close Copilot"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 5-Tab Workbench Navigation */}
        <div className="px-4 py-2.5 bg-[#FDFCF8] border-b border-[#E2E6E4] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-heading text-xs font-semibold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'chat'
                ? 'bg-[#528BCA] text-white shadow-2xs'
                : 'text-[#4F5E57] hover:text-[#1C1B1F] hover:bg-[#F2F5F3]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('suggestions')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-heading text-xs font-semibold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'suggestions'
                ? 'bg-[#528BCA] text-white shadow-2xs'
                : 'text-[#4F5E57] hover:text-[#1C1B1F] hover:bg-[#F2F5F3]'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Suggestions</span>
            {totalPendingSuggestions > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold tabular-nums ${
                  activeTab === 'suggestions'
                    ? 'bg-white/25 text-white'
                    : 'bg-[#DDF3ED] text-[#133830] border border-[#96D6C7]'
                }`}
              >
                {totalPendingSuggestions}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('normalize')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-heading text-xs font-semibold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'normalize'
                ? 'bg-[#528BCA] text-white shadow-2xs'
                : 'text-[#4F5E57] hover:text-[#1C1B1F] hover:bg-[#F2F5F3]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Normalize</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gaps')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-heading text-xs font-semibold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'gaps'
                ? 'bg-[#528BCA] text-white shadow-2xs'
                : 'text-[#4F5E57] hover:text-[#1C1B1F] hover:bg-[#F2F5F3]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Gap Scan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-heading text-xs font-semibold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'rules'
                ? 'bg-[#528BCA] text-white shadow-2xs'
                : 'text-[#4F5E57] hover:text-[#1C1B1F] hover:bg-[#F2F5F3]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Rules &amp; Diff</span>
          </button>
        </div>

        {/* ================= TAB 1: CHAT ================= */}
        {activeTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FDFCF8]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-xs text-[#4F5E57]">
                    {msg.sender === 'user' ? (
                      <>
                        <span>You</span>
                        <span>·</span>
                        <span className="tabular-nums">{msg.timestamp}</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5 text-[#4FA896]" />
                        <span className="font-semibold text-[#1C1B1F]">Empathy Copilot</span>
                        <span>·</span>
                        <span className="tabular-nums">{msg.timestamp}</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`max-w-[92%] rounded-2xl p-4 shadow-2xs ${
                      msg.sender === 'user'
                        ? 'bg-[#528BCA] text-white rounded-br-xs text-[15px] leading-relaxed'
                        : 'bg-[#FFFFFF] text-[#1C1B1F] border border-[#E2E6E4] rounded-bl-xs'
                    }`}
                  >
                    <div
                      className={`whitespace-pre-wrap leading-relaxed ${
                        msg.sender === 'user'
                          ? 'text-[15px]'
                          : 'transcript-surface text-[15px] text-[#1C1B1F]'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {msg.chartSpec && msg.chartSpec.data && msg.chartSpec.data.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#E2E6E4] bg-[#F2F5F3]/70 rounded-2xl p-3 text-[#1C1B1F]">
                        <AnalysisChart
                          title={msg.chartSpec.title}
                          description={msg.chartSpec.description}
                          type={msg.chartSpec.type === 'pie' ? 'pie' : 'bar'}
                          data={msg.chartSpec.data}
                        />
                      </div>
                    )}

                    {msg.suggestedFormula && (
                      <div className="mt-3 bg-[#FDF3C7]/60 rounded-2xl p-3.5 border border-[#F7D147] text-[#1C1B1F] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-heading font-bold text-[#1C1B1F] text-sm flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-[#E5B822]" />
                            Suggested Formula: {msg.suggestedFormula.name}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FFFFFF] text-[#735907] border border-[#F7D147]">
                            {msg.suggestedFormula.code}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-[#4F5E57]">
                          {msg.suggestedFormula.description}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-[#4F5E57] font-semibold">Tiers:</span>
                          {msg.suggestedFormula.outputTiers.map((t, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-0.5 rounded-full text-xs bg-[#FFFFFF] border border-[#D5DDD8] text-[#1C1B1F]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>

                        {addedFormulaIds[msg.suggestedFormula.id] ? (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 py-1.5 px-3 rounded-full font-bold text-xs bg-[#DDF3ED] text-[#133830] border border-[#96D6C7] flex items-center justify-center gap-1.5">
                              <Check className="w-3.5 h-3.5" />
                              <span>Added to Step 4</span>
                            </div>
                            {onRevertFormula && (
                              <button
                                type="button"
                                onClick={() => {
                                  onRevertFormula(msg.suggestedFormula!.id);
                                  setAddedFormulaIds((prev) => ({
                                    ...prev,
                                    [msg.suggestedFormula!.id]: false,
                                  }));
                                }}
                                className="py-1.5 px-3.5 rounded-full font-bold text-xs bg-[#FDF4F3] hover:bg-[#FBD9D9] text-[#B93838] border border-[#D97A75]/55 flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0"
                                title="Revert and remove this formula"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Revert</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApplyFormula(msg.suggestedFormula!)}
                            className="w-full mt-2 py-2 px-4 rounded-full font-heading font-semibold text-xs flex items-center justify-center gap-1.5 transition-all bg-[#528BCA] hover:bg-[#3F78B5] text-white cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add this Formula to Step 4</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isChatLoading && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#DDF3ED] border border-[#96D6C7] text-[#133830] flex items-center justify-center text-xs font-bold shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-[#FFFFFF] border border-[#E2E6E4] rounded-2xl rounded-bl-xs p-3.5 text-sm leading-relaxed text-[#4F5E57] flex items-center gap-2 shadow-2xs">
                    <Loader2 className="w-4 h-4 animate-spin text-[#528BCA]" />
                    <span>Analyzing transcripts and compiling qualitative metrics...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Horizontal Scrollable Quick-Prompt Chips */}
            <div className="px-3.5 py-2.5 bg-[#F2F5F3] border-t border-[#E2E6E4] overflow-x-auto no-scrollbar flex items-center gap-2 shrink-0">
              {QUICK_PROMPTS.map((prompt, i) => {
                const iconColor =
                  i % 3 === 0 ? '#528BCA' : i % 3 === 1 ? '#4FA896' : '#E5B822';
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    disabled={isChatLoading}
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#FFFFFF] text-[#1C1B1F] border border-[#D5DDD8] hover:border-[#528BCA] hover:text-[#234B78] hover:bg-[#DCE8F7]/45 whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor }} />
                    <span>{prompt}</span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Composer */}
            <div className="p-3.5 bg-[#FDFCF8] border-t border-[#E2E6E4] flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                placeholder="Ask AI to create a chart, map, or new analytics formula..."
                className="flex-1 bg-[#FFFFFF] border border-[#D5DDD8] rounded-full px-4 py-2.5 text-sm text-[#1C1B1F] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 focus:border-[#528BCA] transition-all placeholder:text-[#727975]"
                disabled={isChatLoading}
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isChatLoading}
                aria-label="Send message"
                className="p-2.5 rounded-full bg-[#528BCA] hover:bg-[#3F78B5] disabled:opacity-40 text-white font-semibold transition-all shadow-2xs cursor-pointer shrink-0"
              >
                {isChatLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </>
        )}

        {/* ================= TAB 2: EVIDENCE-LINKED SUGGESTIONS ================= */}
        {activeTab === 'suggestions' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FDFCF8]">
            <div className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DF] p-4 space-y-3 shadow-2xs">
              <div>
                <h4 className="font-heading text-base font-bold text-[#292524]">
                  Evidence-Linked Copilot Suggestions (Null &amp; Implicit Clues)
                </h4>
                <p className="text-base leading-[1.65] text-[#57534E] mt-1">
                  Inspects cleaned transcripts for subtle clues left <span className="font-mono">null</span> and reviews ungrounded candidates before updating Step 3 charts.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={activeRecord?.id || ''}
                  onChange={(e) => setSelectedRecordId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-base font-medium text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                >
                  {eligibleRecords.length === 0 && <option value="">No interview records</option>}
                  {eligibleRecords.map((r) => {
                    const count = r.adkotmDecode?.copilotSuggestions?.length || 0;
                    return (
                      <option key={r.id} value={r.id}>
                        {r.fileName} {count > 0 ? `(${count} pending)` : ''}
                      </option>
                    );
                  })}
                </select>

                <button
                  type="button"
                  disabled={!activeRecord || isScanningSuggestions}
                  onClick={handleScanSuggestions}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full font-heading text-xs font-semibold bg-[#528BCA] hover:bg-[#3F78B5] disabled:opacity-50 text-white cursor-pointer whitespace-nowrap shrink-0 transition-colors shadow-2xs"
                >
                  {isScanningSuggestions ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Scan Null &amp; Implicit Clues</span>
                    </>
                  )}
                </button>
              </div>

              {groundedSuggestionCount > 1 && (
                <div className="flex items-center justify-between pt-2.5 border-t border-[#EAE6DF]">
                  <span className="text-[13px] text-[#57534E] tabular-nums">
                    {groundedSuggestionCount} grounded suggestion(s) ready
                  </span>
                  <button
                    type="button"
                    onClick={handleAcceptAllVerifiedSuggestions}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-bold bg-[#2B7A67] hover:bg-[#1E4D42] text-white cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept All Verified</span>
                  </button>
                </div>
              )}
            </div>

            {suggestionError && (
              <div className="p-3.5 rounded-2xl bg-[#FDF4F3] border border-[#D97A75]/45 text-base leading-[1.65] text-[#7A3A36] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#D97A75]" />
                <span>{suggestionError}</span>
              </div>
            )}

            {activeSuggestions.length === 0 ? (
              <div className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DF] p-8 text-center space-y-2">
                <div className="w-11 h-11 rounded-2xl bg-[#FEFBEB] border border-[#F7D147]/60 text-[#6B5306] flex items-center justify-center mx-auto">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <p className="font-heading text-lg font-bold text-[#292524]">
                  No queued suggestions for {activeRecord?.fileName || 'this participant'}
                </p>
                <p className="text-base leading-[1.65] text-[#57534E]">
                  All clues reviewed — scan anytime for hidden signals.
                </p>
                <p className="text-base leading-[1.65] text-[#78716C] max-w-sm mx-auto">
                  Click &quot;Scan Null &amp; Implicit Clues&quot; to inspect uncovered behavioral signals in the cleaned transcript.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeSuggestions.map((sug) => (
                  <div
                    key={sug.id}
                    className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DF] p-4 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-heading text-base font-bold text-[#292524]">{sug.targetLabel}</span>
                        {sug.postAnalysisCode && (
                          <span className="px-2.5 py-0.5 rounded-full text-[13px] font-mono font-bold bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147]/60">
                            {sug.postAnalysisCode}
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[13px] font-bold border ${confidenceBadgeStyle(
                          sug.confidence
                        )}`}
                      >
                        {sug.confidence} ·{' '}
                        {sug.source === 'ungrounded_fallback' ? 'Unverified Quote' : 'Implicit Clue'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#FEFBEB]/70 border border-[#F7D147]/50">
                      <div className="text-[13px] font-semibold text-[#6B5306]">
                        Suggested Code
                      </div>
                      <div className="text-base leading-[1.65] font-bold text-[#292524] mt-0.5">
                        {sug.suggestedCode}
                      </div>
                    </div>

                    {sug.evidence_quote ? (
                      <div className="p-3 rounded-xl bg-[#F7F5F0] border border-[#EAE6DF] text-base leading-[1.65] text-[#57534E] flex items-start gap-2">
                        <Quote className="w-4 h-4 text-[#528BCA] shrink-0 mt-1" />
                        <span className="italic">&ldquo;{sug.evidence_quote}&rdquo;</span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-[#FDF4F3] border border-[#D97A75]/45 text-base leading-[1.65] text-[#7A3A36]">
                        No verbatim substring matched in cleaned transcript — kept null until confirmed by researcher.
                      </div>
                    )}

                    {sug.reasoning && (
                      <p className="text-base leading-[1.65] text-[#57534E]">{sug.reasoning}</p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDismissSuggestion(sug.id)}
                        className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-[#57534E] hover:bg-[#F7F5F0] border border-[#EAE6DF] cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAcceptSuggestion(sug)}
                        className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-[13px] font-bold bg-[#2B7A67] hover:bg-[#1E4D42] text-white cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept Suggestion</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: CROSS-INTERVIEW NORMALIZATION ================= */}
        {activeTab === 'normalize' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FDFCF8]">
            <div className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DF] p-4 space-y-3 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-heading text-base font-bold text-[#292524]">
                    Cross-Interview Taxonomy Normalization (PP &amp; PP1)
                  </h4>
                  <p className="text-base leading-[1.65] text-[#57534E] mt-1">
                    Audits <span className="font-mono font-semibold">PP</span> and{' '}
                    <span className="font-mono font-semibold">PP1</span> across all{' '}
                    <span className="tabular-nums font-semibold text-[#292524]">{decodedRecords.length}</span>{' '}
                    decoded records to standardize macro-categories while keeping brand detail intact.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isNormalizing || decodedRecords.length === 0}
                onClick={handleRunNormalize}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full font-heading text-xs font-semibold bg-[#528BCA] hover:bg-[#3F78B5] disabled:opacity-50 text-white cursor-pointer transition-colors shadow-2xs"
              >
                {isNormalizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Auditing PP &amp; PP1 Across {decodedRecords.length} Records...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    <span>Analyze PP &amp; PP1 Across All Records</span>
                  </>
                )}
              </button>
            </div>

            {normalizeStatusMsg && (
              <div className="p-3.5 rounded-2xl bg-[#F2FBF8] border border-[#96D6C7] text-base leading-[1.65] text-[#1E4D42] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2B7A67] shrink-0" />
                <span>{normalizeStatusMsg}</span>
              </div>
            )}

            {normalizeProposals.length > 0 && (
              <div className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DF] overflow-hidden shadow-2xs">
                <div className="px-4 py-2.5 bg-[#F7F5F0] border-b border-[#EAE6DF] flex items-center justify-between gap-2">
                  <span className="font-heading text-base font-bold text-[#292524] tabular-nums">
                    Proposed Merges ({normalizeProposals.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allChecked = selectedNormalizeCount === normalizeProposals.length;
                        const next: Record<string, boolean> = {};
                        normalizeProposals.forEach((p) => {
                          next[p.id] = !allChecked;
                        });
                        setSelectedProposalIds(next);
                      }}
                      className="text-[13px] font-semibold text-[#57534E] hover:text-[#292524] cursor-pointer"
                    >
                      {selectedNormalizeCount === normalizeProposals.length ? 'Clear All' : 'Select All'}
                    </button>
                    <button
                      type="button"
                      disabled={selectedNormalizeCount === 0}
                      onClick={handleApplySelectedNormalizations}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-bold bg-[#2B7A67] hover:bg-[#1E4D42] disabled:opacity-50 text-white cursor-pointer whitespace-nowrap shrink-0 tabular-nums transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply Selected ({selectedNormalizeCount})</span>
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-[#EAE6DF]">
                  {normalizeProposals.map((p) => (
                    <label
                      key={p.id}
                      className="block p-4 hover:bg-[#F7F5F0]/60 cursor-pointer space-y-2 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedProposalIds[p.id])}
                          onChange={(e) =>
                            setSelectedProposalIds((prev) => ({
                              ...prev,
                              [p.id]: e.target.checked,
                            }))
                          }
                          className="rounded border-[#D6D0C6] accent-[#292524] focus:ring-[#528BCA]"
                        />
                        <span className="font-heading text-base font-bold text-[#292524] truncate">
                          {p.fileName}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 pl-6 text-[13px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-[#6B5306] px-2.5 py-0.5 rounded-full bg-[#FEFBEB] border border-[#F7D147]">
                            PP
                          </span>
                          <span className="text-[#78716C] line-through">
                            {p.beforePP || 'null'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#78716C]" />
                          <span className="font-semibold text-[#1E4D42] bg-[#F2FBF8] px-2.5 py-0.5 rounded-full border border-[#96D6C7]">
                            {p.afterPP || 'null'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-[#234B78] px-2.5 py-0.5 rounded-full bg-[#F2F7FC] border border-[#528BCA]/40">
                            PP1
                          </span>
                          <span className="text-[#78716C]">
                            {p.beforePP1 || 'null'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#78716C]" />
                          <span className="font-semibold text-[#234B78] bg-[#F2F7FC] px-2.5 py-0.5 rounded-full border border-[#528BCA]/40">
                            {p.afterPP1 || 'null'}
                          </span>
                        </div>

                        <p className="text-base leading-[1.65] text-[#57534E]">{p.reason}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: MISS-DETECTION GAP SCANNER ================= */}
        {activeTab === 'gaps' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FDFCF8]">
            <div className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DF] p-4 space-y-3 shadow-2xs">
              <div>
                <h4 className="font-heading text-base font-bold text-[#292524]">
                  Miss-Detection Gap Scanner (Uncoded Signals)
                </h4>
                <p className="text-base leading-[1.65] text-[#57534E] mt-1">
                  Compares cleaned transcript sentences against existing evidence quotes to catch unmapped health triggers, activities, or local brands.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={activeRecord?.id || ''}
                  onChange={(e) => setSelectedRecordId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-base font-medium text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                >
                  {eligibleRecords.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fileName}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={!activeRecord || isScanningGaps}
                  onClick={handleRunGapScan}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full font-heading text-sm font-bold bg-[#528BCA] hover:bg-[#3F78B5] disabled:opacity-50 text-white cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                >
                  {isScanningGaps ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Scan for Missed Signals</span>
                    </>
                  )}
                </button>
              </div>

              {activeRecord && uncoveredCountByRecord[activeRecord.id] !== undefined && (
                <div className="text-[13px] text-[#57534E] pt-2 border-t border-[#EAE6DF] tabular-nums">
                  Uncovered transcript sentences audited: {uncoveredCountByRecord[activeRecord.id]}
                </div>
              )}
            </div>

            {gapStatusMsg && (
              <div className="p-3.5 rounded-2xl bg-[#F7F5F0] border border-[#EAE6DF] text-base leading-[1.65] text-[#57534E]">
                {gapStatusMsg}
              </div>
            )}

            {activeGapSignals.length === 0 ? (
              <div className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DF] p-8 text-center space-y-2">
                <div className="w-11 h-11 rounded-2xl bg-[#F2F7FC] border border-[#528BCA]/30 text-[#234B78] flex items-center justify-center mx-auto">
                  <Search className="w-5 h-5" />
                </div>
                <p className="font-heading text-lg font-bold text-[#292524]">
                  No uncoded signals flagged for {activeRecord?.fileName || 'this transcript'}
                </p>
                <p className="text-base leading-[1.65] text-[#57534E]">
                  Ready to scan uncovered sentences anytime.
                </p>
                <p className="text-base leading-[1.65] text-[#78716C] max-w-sm mx-auto">
                  Run &quot;Scan for Missed Signals&quot; to inspect sentences not currently linked to any ADKOTM parameter.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeGapSignals.map((sig) => (
                  <div
                    key={sig.id}
                    className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DF] p-4 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[13px] font-bold bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147]">
                        Uncoded Signal
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-heading text-base font-bold text-[#292524]">{sig.suggestedLabel}</span>
                        {sig.postAnalysisCode && (
                          <span className="px-2.5 py-0.5 rounded-full text-[13px] font-mono font-bold bg-[#F7F5F0] text-[#57534E] border border-[#EAE6DF]">
                            {sig.postAnalysisCode}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F7F5F0] border border-[#EAE6DF] text-base leading-[1.65] text-[#57534E] flex items-start gap-2">
                      <Quote className="w-4 h-4 text-[#528BCA] shrink-0 mt-1" />
                      <span className="italic">&ldquo;{sig.sentence}&rdquo;</span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F2FBF8] border border-[#96D6C7]">
                      <div className="text-[13px] font-semibold text-[#1E4D42]">
                        Suggested Code
                      </div>
                      <div className="text-base leading-[1.65] font-bold text-[#292524] mt-0.5">
                        {sig.suggestedCode}
                      </div>
                    </div>

                    <p className="text-base leading-[1.65] text-[#57534E]">{sig.reasoning}</p>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDismissGapSignal(sig.id)}
                        className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-[#57534E] hover:bg-[#F7F5F0] border border-[#EAE6DF] cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyGapSignal(sig)}
                        className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-[13px] font-bold bg-[#2B7A67] hover:bg-[#1E4D42] text-white cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Apply Mapping</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: CUSTOM CODING RULES & BATCH DIFF ================= */}
        {activeTab === 'rules' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FDFCF8]">
            <div className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DF] p-4 space-y-3 shadow-2xs">
              <div>
                <h4 className="font-heading text-base font-bold text-[#292524]">
                  Study-Specific Coding Rules &amp; Batch Diff Re-Decode
                </h4>
                <p className="text-base leading-[1.65] text-[#57534E] mt-1">
                  Define custom rules enforced during Step 3 decoding and preview field-level diffs before updating records.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddRule();
                  }}
                  placeholder="e.g. Always extract Malaysian probiotic brands into PP1"
                  className="flex-1 px-3.5 py-2 rounded-full border border-[#EAE6DF] bg-[#FFFFFF] text-base text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                />
                <button
                  type="button"
                  disabled={!newRuleText.trim()}
                  onClick={() => handleAddRule()}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-full font-heading text-[13px] font-bold bg-[#292524] hover:bg-[#3F3A38] disabled:opacity-40 text-white cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Rule</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="text-[13px] font-semibold text-[#78716C]">
                  Quick Study Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_CODING_RULES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddRule(preset)}
                      className="text-left px-3 py-1 rounded-full text-[13px] bg-[#F7F5F0] hover:bg-[#F2F7FC] text-[#57534E] hover:text-[#234B78] border border-[#EAE6DF] hover:border-[#528BCA]/40 cursor-pointer transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {customRules.length > 0 && (
                <div className="space-y-1.5 pt-2.5 border-t border-[#EAE6DF]">
                  <span className="text-[13px] font-semibold text-[#78716C] tabular-nums">
                    Active Study Rules ({customRules.length})
                  </span>
                  <div className="space-y-1.5">
                    {customRules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-2 p-3 rounded-xl bg-[#FEFBEB]/80 border border-[#F7D147]/50 text-base leading-[1.65] text-[#292524]"
                      >
                        <span>
                          <span className="font-mono font-bold text-[#6B5306] mr-1.5 tabular-nums">
                            {idx + 1}.
                          </span>
                          {rule}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRule(idx)}
                          className="p-1 text-[#78716C] hover:text-[#D97A75] cursor-pointer shrink-0 transition-colors"
                          title="Remove rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2.5 border-t border-[#EAE6DF] space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="inline-flex rounded-full border border-[#EAE6DF] p-0.5 bg-[#F7F5F0] text-[13px]">
                    <button
                      type="button"
                      onClick={() => setRedecodeScope('selected')}
                      className={`px-3 py-1 rounded-full font-semibold cursor-pointer whitespace-nowrap transition-all ${
                        redecodeScope === 'selected'
                          ? 'bg-[#292524] text-white shadow-2xs'
                          : 'text-[#57534E]'
                      }`}
                    >
                      Selected Record
                    </button>
                    <button
                      type="button"
                      onClick={() => setRedecodeScope('all')}
                      className={`px-3 py-1 rounded-full font-semibold cursor-pointer whitespace-nowrap tabular-nums transition-all ${
                        redecodeScope === 'all'
                          ? 'bg-[#292524] text-white shadow-2xs'
                          : 'text-[#57534E]'
                      }`}
                    >
                      All Eligible ({eligibleRecords.length})
                    </button>
                  </div>

                  {redecodeScope === 'selected' && activeRecord && (
                    <select
                      value={activeRecord.id}
                      onChange={(e) => setSelectedRecordId(e.target.value)}
                      className="max-w-[220px] px-3 py-1.5 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[13px] font-medium text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                    >
                      {eligibleRecords.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.fileName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isRedecodingRules || eligibleRecords.length === 0}
                  onClick={handleRunRedecodeWithRules}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full font-heading text-sm font-bold bg-[#528BCA] hover:bg-[#3F78B5] disabled:opacity-50 text-white cursor-pointer transition-colors"
                >
                  {isRedecodingRules ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Field Diff Preview...</span>
                    </>
                  ) : (
                    <>
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Re-Decode with Rules (Preview Diff)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {rulesStatusMsg && (
              <div className="p-3.5 rounded-2xl bg-[#F2FBF8] border border-[#96D6C7] text-base leading-[1.65] text-[#1E4D42] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2B7A67] shrink-0" />
                <span>{rulesStatusMsg}</span>
              </div>
            )}

            {ruleDiffs.length > 0 && (
              <div className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DF] overflow-hidden shadow-2xs">
                <div className="px-4 py-2.5 bg-[#F7F5F0] border-b border-[#EAE6DF] flex items-center justify-between gap-2">
                  <span className="font-heading text-base font-bold text-[#292524] tabular-nums">
                    Field Diff Preview ({ruleDiffs.length} change{ruleDiffs.length === 1 ? '' : 's'})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allChecked = selectedDiffCount === ruleDiffs.length;
                        const next: Record<string, boolean> = {};
                        ruleDiffs.forEach((d) => {
                          next[d.id] = !allChecked;
                        });
                        setSelectedDiffIds(next);
                      }}
                      className="text-[13px] font-semibold text-[#57534E] hover:text-[#292524] cursor-pointer"
                    >
                      {selectedDiffCount === ruleDiffs.length ? 'Clear All' : 'Select All'}
                    </button>
                    <button
                      type="button"
                      disabled={selectedDiffCount === 0}
                      onClick={handleApplySelectedDiffs}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-bold bg-[#2B7A67] hover:bg-[#1E4D42] disabled:opacity-50 text-white cursor-pointer whitespace-nowrap shrink-0 tabular-nums transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply Selected Diffs ({selectedDiffCount})</span>
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-[#EAE6DF]">
                  {ruleDiffs.map((diff) => (
                    <label
                      key={diff.id}
                      className="block p-4 hover:bg-[#F7F5F0]/60 cursor-pointer space-y-2 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedDiffIds[diff.id])}
                            onChange={(e) =>
                              setSelectedDiffIds((prev) => ({
                                ...prev,
                                [diff.id]: e.target.checked,
                              }))
                            }
                            className="rounded border-[#D6D0C6] accent-[#292524] focus:ring-[#528BCA]"
                          />
                          <span className="font-heading text-base font-bold text-[#292524] truncate">
                            {diff.fileName}
                          </span>
                          <span className="text-[13px] font-semibold text-[#57534E] shrink-0">
                            · {diff.label}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[13px] font-bold border shrink-0 ${confidenceBadgeStyle(
                            diff.confidence
                          )}`}
                        >
                          {diff.confidence}
                        </span>
                      </div>

                      <div className="pl-6 flex items-center gap-1.5 flex-wrap text-[13px]">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F7F5F0] text-[#78716C] font-mono">
                          {diff.oldValue ?? 'null'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#78716C]" />
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F2FBF8] text-[#1E4D42] border border-[#96D6C7] font-semibold">
                          {diff.newValue ?? 'null'}
                        </span>
                      </div>

                      {diff.evidence_quote && (
                        <p className="pl-6 text-base leading-[1.65] text-[#57534E] italic">
                          &ldquo;{diff.evidence_quote}&rdquo;
                        </p>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
