import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Table as TableIcon,
  PieChart as PieIcon,
  Info,
  MapPin,
  BarChart3,
  Edit3,
  Download,
  Trash2,
  ArrowRight,
  Search,
  LayoutPanelLeft,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { InterviewRecord, ADKOTMDecode, InterviewReviewStatus } from '../../types';
import { DecodeCrudModal } from '../review/DecodeCrudModal';
import { KlangValleyMap } from './KlangValleyMap';
import { AdkotmDistributionView } from './AdkotmDistributionView';
import { DecodeAnalyticsView } from './DecodeAnalyticsView';
import { Step3ReviewWorkspace } from '../review/Step3ReviewWorkspace';
import { NormalizeTagsModal } from '../review/NormalizeTagsModal';
import { exportDecodesToCSV, exportDecodesToDoc, openPrintablePDFReport } from '../../lib/exportUtils';
import { loadCustomCodingRules } from '../../lib/adkotmUtils';
import { isAnalysisEligibleRecord } from '../../lib/recordEligibility';
import {
  computeReviewProgress,
  isHumanVerifiedRecord,
  proposeTaxonomyNormalizations,
  stripRecordingExtension,
} from '../../lib/adkotmCopilot';

const ThemeInsightsIcon: React.FC<{ className?: string }> = ({ className = 'w-[18px] h-[18px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    {/* Radiating light rays */}
    <path d="M12 1.75v1.75" />
    <path d="M4.75 4.75l1.25 1.25" />
    <path d="M19.25 4.75l-1.25 1.25" />
    <path d="M2.25 11.5h1.75" />
    <path d="M20 11.5h1.75" />
    {/* Lightbulb outline & base */}
    <path d="M8.75 17.25c-.55-.85-2.5-2.3-2.5-5.75a5.75 5.75 0 1 1 11.5 0c0 3.45-1.95 4.9-2.5 5.75" />
    <path d="M9.5 19.75h5" />
    <path d="M10.25 22h3.5" />
    {/* Magnifying glass ring & handle inside bulb */}
    <circle cx="11.5" cy="11.25" r="2.75" />
    <path d="M13.5 13.25l1.75 1.75" />
    {/* Person silhouette centered inside magnifying glass */}
    <circle cx="11.5" cy="10.45" r="0.8" />
    <path d="M10.1 12.65a1.55 1.55 0 0 1 2.8 0" />
  </svg>
);

interface Module3DecodeAnalysisProps {
  records: InterviewRecord[];
  onUpdateRecord: (updated: InterviewRecord) => void;
  onBatchUpdateRecords?: (records: InterviewRecord[]) => void;
  onAddRecord?: (newRecord: InterviewRecord) => void;
  onDeleteRecord?: (id: string) => void;
  safePostJson: <T = any>(url: string, payload: any) => Promise<T>;
  onProceedToNext?: () => void;
  onOpenAiAssistant?: () => void;
}

export const Module3DecodeAnalysis: React.FC<Module3DecodeAnalysisProps> = ({
  records,
  onUpdateRecord,
  onBatchUpdateRecords,
  onAddRecord,
  onDeleteRecord,
  safePostJson,
  onProceedToNext,
}) => {
  // Primary Step 3 mode switch: Review Workspace (default) vs Analytics & Summary
  const [workspaceMode, setWorkspaceMode] = useState<'review' | 'analytics'>('review');
  const [analyticsTab, setAnalyticsTab] = useState<'distribution' | 'analytics' | 'table' | 'map'>('distribution');

  const [decodingId, setDecodingId] = useState<string | null>(null);
  const [isBatchDecoding, setIsBatchDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');
  const [tableSort, setTableSort] = useState<{
    column: 'participant' | 'FR' | 'AW' | 'PP';
    dir: 'asc' | 'desc';
  } | null>(null);

  const toggleTableSort = (column: 'participant' | 'FR' | 'AW' | 'PP') => {
    setTableSort((prev) => {
      if (!prev || prev.column !== column) return { column, dir: 'asc' };
      if (prev.dir === 'asc') return { column, dir: 'desc' };
      return null;
    });
  };

  // Modals
  const [isCrudModalOpen, setIsCrudModalOpen] = useState(false);
  const [crudRecordToEdit, setCrudRecordToEdit] = useState<InterviewRecord | null>(null);
  const [isNormalizeModalOpen, setIsNormalizeModalOpen] = useState(false);

  // Study participants (excluding metadata-only docs)
  const eligibleRecords = useMemo(
    () => records.filter(isAnalysisEligibleRecord),
    [records]
  );

  // Strictly Human Verified records feed Analytics, Summary Tables, Exports, and Step 4
  const verifiedRecords = useMemo(
    () => eligibleRecords.filter(isHumanVerifiedRecord),
    [eligibleRecords]
  );

  const pendingReviewCount = useMemo(
    () =>
      eligibleRecords.filter((r) => computeReviewProgress(r).status === 'needs_review').length,
    [eligibleRecords]
  );

  const normalizationProposalsCount = useMemo(
    () => proposeTaxonomyNormalizations(eligibleRecords).length,
    [eligibleRecords]
  );

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(
    eligibleRecords[0]?.id || null
  );

  useEffect(() => {
    if (eligibleRecords.length === 0) {
      if (selectedRecordId !== null) setSelectedRecordId(null);
      return;
    }
    if (!selectedRecordId || !eligibleRecords.some((r) => r.id === selectedRecordId)) {
      setSelectedRecordId(eligibleRecords[0].id);
    }
  }, [eligibleRecords, selectedRecordId]);

  const filteredTableRecords = useMemo(() => {
    const filtered = verifiedRecords.filter((r) => {
      if (!tableSearch.trim()) return true;
      const term = tableSearch.toLowerCase();
      const nameMatch = r.fileName.toLowerCase().includes(term);
      const folderMatch = r.folderName ? r.folderName.toLowerCase().includes(term) : false;
      const codes = r.adkotmDecode?.postAnalysisCodes;
      const codeMatch = Boolean(
        (codes?.FR && String(codes.FR).toLowerCase().includes(term)) ||
        (codes?.RL && String(codes.RL).toLowerCase().includes(term)) ||
        (codes?.AW && String(codes.AW).toLowerCase().includes(term)) ||
        (codes?.PP && String(codes.PP).toLowerCase().includes(term)) ||
        (codes?.PP1 && String(codes.PP1).toLowerCase().includes(term)) ||
        (codes?.IL && String(codes.IL).toLowerCase().includes(term))
      );
      return nameMatch || folderMatch || codeMatch;
    });

    if (!tableSort) return filtered;
    const getSortVal = (r: InterviewRecord): string => {
      if (tableSort.column === 'participant') {
        return stripRecordingExtension(r.fileName).toLowerCase();
      }
      const raw = r.adkotmDecode?.postAnalysisCodes?.[tableSort.column];
      const str = raw ? String(raw).trim() : '';
      return !str || str.toLowerCase() === 'null' || str.toLowerCase() === 'unstated'
        ? ''
        : str.toLowerCase();
    };

    return [...filtered].sort((a, b) => {
      const av = getSortVal(a);
      const bv = getSortVal(b);
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return tableSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [verifiedRecords, tableSearch, tableSort]);

  const renderValue = (val: any) => {
    if (val === null || val === undefined) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-mono bg-[#F7F5F0] text-[#78716C] border border-[#EAE6DF]">
          null
        </span>
      );
    }
    const strVal = Array.isArray(val) ? val.join(', ') : String(val);
    const lower = strVal.trim().toLowerCase();
    if (!strVal || lower === 'null' || lower === 'unstated') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-mono bg-[#F7F5F0] text-[#78716C] border border-[#EAE6DF]">
          null
        </span>
      );
    }
    const isActiveFilter = tableSearch.trim().toLowerCase() === lower;
    return (
      <button
        type="button"
        onClick={() => setTableSearch(isActiveFilter ? '' : strVal.trim())}
        title={isActiveFilter ? 'Click to clear filter' : `Filter table by "${strVal.trim()}"`}
        className={`text-left text-[15px] font-normal break-words leading-relaxed rounded-lg px-1.5 py-0.5 -mx-1.5 transition-colors cursor-pointer ${
          isActiveFilter
            ? 'bg-[#DCE8F7] text-[#132B47]'
            : 'text-[#292524] hover:text-[#528BCA] hover:bg-[#DCE8F7]/45'
        }`}
      >
        {strVal}
      </button>
    );
  };

  // Stage an AI Draft (never locks directly as Human Verified)
  const handleDecodeSingle = async (record: InterviewRecord) => {
    const textToDecode = record.cleanedTranscript || record.transcript;
    if (!textToDecode) return;

    setDecodingId(record.id);
    setDecodeError(null);
    try {
      const customRules = loadCustomCodingRules();
      const res = await safePostJson<{
        success: boolean;
        fileName: string;
        decode: ADKOTMDecode;
        reviewStatus?: InterviewReviewStatus;
        decodedAt: string;
      }>('/api/decode/adkotm', {
        transcript: textToDecode,
        fileName: record.fileName,
        metadataHint: {
          location: record.sessionLocation,
          date: record.sessionDate,
        },
        customRules,
      });

      if (res.success && res.decode) {
        const updated: InterviewRecord = {
          ...record,
          decodeStatus: 'decoded',
          reviewStatus: 'needs_review',
          adkotmDecode: {
            ...res.decode,
            decodedAt: res.decodedAt,
          },
        };
        onUpdateRecord(updated);
        setSelectedRecordId(record.id);
      }
    } catch (err: any) {
      console.error(`Failed to decode ${record.fileName}:`, err);
      setDecodeError(
        `AI Decode failed for "${stripRecordingExtension(record.fileName)}": ${err?.message || 'Unexpected server error.'}`
      );
    } finally {
      setDecodingId(null);
    }
  };

  // Batch stage AI Drafts across eligible records
  const handleDecodeAll = async () => {
    if (eligibleRecords.length === 0) return;
    setIsBatchDecoding(true);
    setDecodeError(null);
    const customRules = loadCustomCodingRules();
    const failures: string[] = [];

    try {
      const updatedList: InterviewRecord[] = [];
      for (const record of eligibleRecords) {
        const textToDecode = record.cleanedTranscript || record.transcript;
        if (!textToDecode) continue;

        setDecodingId(record.id);
        try {
          const res = await safePostJson<{
            success: boolean;
            fileName: string;
            decode: ADKOTMDecode;
            decodedAt: string;
          }>('/api/decode/adkotm', {
            transcript: textToDecode,
            fileName: record.fileName,
            metadataHint: {
              location: record.sessionLocation,
              date: record.sessionDate,
            },
            customRules,
          });

          if (res.success && res.decode) {
            const updated: InterviewRecord = {
              ...record,
              decodeStatus: 'decoded',
              reviewStatus: 'needs_review',
              adkotmDecode: {
                ...res.decode,
                decodedAt: res.decodedAt,
              },
            };
            updatedList.push(updated);
            onUpdateRecord(updated);
          }
        } catch (err: any) {
          console.error(`Error batch decoding ${record.fileName}:`, err);
          failures.push(`${stripRecordingExtension(record.fileName)} (${err?.message || 'error'})`);
        }
      }

      if (onBatchUpdateRecords && updatedList.length > 0) {
        onBatchUpdateRecords(updatedList);
      }
      if (failures.length > 0) {
        setDecodeError(
          `AI Decode encountered errors on ${failures.length} interview(s): ${failures[0]}`
        );
      }
    } finally {
      setDecodingId(null);
      setIsBatchDecoding(false);
    }
  };

  const handleApplyNormalizedRecords = (updatedRecords: InterviewRecord[]) => {
    if (onBatchUpdateRecords) {
      onBatchUpdateRecords(updatedRecords);
    } else {
      updatedRecords.forEach((r) => onUpdateRecord(r));
    }
  };

  return (
    <div className="space-y-5">
      {/* Step 3 Top Header & Mode Switch */}
      <div className="bg-white border border-[#EAE6DF] rounded-3xl p-5 sm:p-6 shadow-studio">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-[#FEFBEB] border border-[#F7D147] text-[#6B5306] flex items-center justify-center shrink-0">
              <PieIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-[#292524] tracking-[-0.02em]">
                  Step 3: Decode Themes
                </h2>
                <span className="px-3 py-0.5 rounded-full text-[13px] font-bold tabular-nums bg-[#96D6C7] text-[#1E4D42] whitespace-nowrap">
                  {verifiedRecords.length} of {eligibleRecords.length} Human Verified
                </span>
                {pendingReviewCount > 0 && (
                  <span className="px-3 py-0.5 rounded-full text-[13px] font-semibold tabular-nums bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147] whitespace-nowrap">
                    {pendingReviewCount} Needs Review
                  </span>
                )}
              </div>
              <p className="text-base text-[#57534E] mt-1.5 max-w-2xl leading-relaxed">
                AI stages ADKOTM drafts with verbatim quotes for your review. Only Human Verified interviews feed into Analytics &amp; Step 4 Cross-Analysis.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dismissible AI Decode Error Banner */}
      {decodeError && (
        <div
          role="alert"
          className="bg-[#FDF4F3] border border-[#D97A75]/50 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-base text-[#7A3A36]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-[#D97A75] shrink-0" />
            <span className="truncate sm:whitespace-normal">{decodeError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDecodeError(null)}
            aria-label="Dismiss decode error"
            className="p-1.5 rounded-full text-[#7A3A36] hover:bg-[#F6BEBA]/50 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 3 Completion Signal */}
      {eligibleRecords.length > 0 && verifiedRecords.length === eligibleRecords.length && !isBatchDecoding && (
        <div className="bg-[#F2FBF8] border border-[#96D6C7] rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-studio">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#96D6C7] text-[#1E4D42] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-heading font-bold text-[#1E4D42] flex items-center gap-2 flex-wrap">
                <span>Step 3 Complete</span>
                <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full bg-[#96D6C7] text-[#1E4D42] tabular-nums">
                  All {verifiedRecords.length} Interviews Human Verified
                </span>
              </div>
              <p className="text-base text-[#1E4D42]/90 mt-1 leading-relaxed">
                Every interview has been verified and synced into Analytics &amp; Step 4 Cross-Analysis.
              </p>
            </div>
          </div>

          {onProceedToNext && (
            <button
              type="button"
              onClick={onProceedToNext}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white shadow-xs cursor-pointer transition-all shrink-0 whitespace-nowrap"
            >
              <span>Proceed to Step 4: Cross-Analysis</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Centered Mode Switcher Below Step 3 Completion / Header */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Step 3 workspace mode"
          className="inline-flex items-center bg-white/85 backdrop-blur-md border border-[#EAE6DF] rounded-full p-1 shadow-2xs gap-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'review'}
            onClick={() => setWorkspaceMode('review')}
            className={`font-heading inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] sm:text-sm font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap ${
              workspaceMode === 'review'
                ? 'bg-[#292524] text-white shadow-xs'
                : 'text-[#57534E] hover:text-[#292524] hover:bg-[#F7F5F0]'
            }`}
          >
            <LayoutPanelLeft className="w-4 h-4" />
            Review Workspace
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'analytics'}
            onClick={() => setWorkspaceMode('analytics')}
            className={`font-heading inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] sm:text-sm font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap ${
              workspaceMode === 'analytics'
                ? 'bg-[#292524] text-white shadow-xs'
                : 'text-[#57534E] hover:text-[#292524] hover:bg-[#F7F5F0]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics &amp; Summary
          </button>
        </div>
      </div>

      {/* VIEW 1: SPLIT-SCREEN HUMAN-IN-THE-LOOP REVIEW WORKSPACE */}
      {workspaceMode === 'review' && (
        <Step3ReviewWorkspace
          records={eligibleRecords}
          selectedRecordId={selectedRecordId}
          onSelectRecord={setSelectedRecordId}
          onUpdateRecord={onUpdateRecord}
          onDecodeSingle={handleDecodeSingle}
          onDecodeAll={handleDecodeAll}
          isBatchDecoding={isBatchDecoding}
          decodingId={decodingId}
          safePostJson={safePostJson}
          onOpenAnalytics={() => setWorkspaceMode('analytics')}
          onOpenNormalizeTags={() => setIsNormalizeModalOpen(true)}
          normalizationProposalsCount={normalizationProposalsCount}
          onOpenAddDecode={() => {
            setCrudRecordToEdit(null);
            setIsCrudModalOpen(true);
          }}
        />
      )}

      {/* VIEW 2: ANALYTICS & SUMMARY (STRICTLY HUMAN VERIFIED RECORDS) */}
      {workspaceMode === 'analytics' && (
        <div className="space-y-3">
          {/* Slim Action Bar Above Unified Synthesis Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-0.5">
            {verifiedRecords.length < eligibleRecords.length ? (
              <div className="flex items-center gap-2 text-sm text-[#6B5306] bg-[#FEFBEB] border border-[#F7D147] rounded-full px-4 py-1.5">
                <AlertTriangle className="w-4 h-4 text-[#6B5306] shrink-0" />
                <span>
                  Showing <strong className="tabular-nums">{verifiedRecords.length}</strong> of{' '}
                  <strong className="tabular-nums">{eligibleRecords.length}</strong> Human Verified interviews.
                </span>
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('review')}
                  className="font-bold text-[#528BCA] hover:underline cursor-pointer whitespace-nowrap ml-1"
                >
                  Open Review Workspace →
                </button>
              </div>
            ) : (
              <div className="text-base font-medium text-[#57534E]">
                Synthesizing <span className="font-semibold text-[#292524] tabular-nums">{verifiedRecords.length}</span> Human Verified interview{verifiedRecords.length === 1 ? '' : 's'}
              </div>
            )}

            {/* Export Verified Dataset */}
            <div className="flex items-center bg-white border border-[#EAE6DF] rounded-full p-1 shadow-2xs shrink-0 self-start sm:self-auto ml-auto">
              <span className="text-[13px] font-semibold text-[#78716C] px-2.5 flex items-center gap-1.5 whitespace-nowrap">
                <Download className="w-3.5 h-3.5" /> Export Verified:
              </span>
              <button
                type="button"
                disabled={verifiedRecords.length === 0}
                onClick={() => exportDecodesToCSV(verifiedRecords)}
                className="px-3 py-1 text-[13px] sm:text-sm font-semibold rounded-full hover:bg-[#F7F5F0] text-[#292524] disabled:opacity-40 cursor-pointer transition-colors"
              >
                CSV
              </button>
              <button
                type="button"
                disabled={verifiedRecords.length === 0}
                onClick={() => exportDecodesToDoc(verifiedRecords)}
                className="px-3 py-1 text-[13px] sm:text-sm font-semibold rounded-full hover:bg-[#F2F7FC] text-[#528BCA] disabled:opacity-40 cursor-pointer transition-colors"
              >
                Word (.doc)
              </button>
              <button
                type="button"
                disabled={verifiedRecords.length === 0}
                onClick={() => openPrintablePDFReport(verifiedRecords)}
                className="px-3 py-1 text-[13px] sm:text-sm font-semibold rounded-full hover:bg-[#FDF3C7] text-[#735907] disabled:opacity-40 cursor-pointer transition-colors"
              >
                PDF
              </button>
            </div>
          </div>

          {/* Unified Synthesis Card Shell with Flush Attached 4-Tab Stacked Header */}
          <div className="bg-white rounded-3xl border border-[#EAE6DF] shadow-studio overflow-hidden">
            {/* Attached Stacked Tab Bar (zero gap to card body below) */}
            <div
              role="tablist"
              aria-label="Synthesis and analytics views"
              className="bg-[#F7F5F0] border-b border-[#EAE6DF] rounded-t-3xl flex items-stretch overflow-x-auto no-scrollbar"
            >
              {(
                [
                  { id: 'distribution', label: 'ADKOTM Breakdown', icon: BarChart3 },
                  { id: 'analytics', label: 'Theme Insights', icon: ThemeInsightsIcon },
                  { id: 'table', label: 'Summary Table', icon: TableIcon },
                  { id: 'map', label: 'Fieldwork Map', icon: MapPin },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const isActive = analyticsTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setAnalyticsTab(tab.id)}
                    className={`group flex flex-col items-center justify-center gap-1.5 px-5 sm:px-7 py-3.5 min-w-[140px] flex-1 sm:flex-none whitespace-nowrap border-b-[3px] transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#292524] font-bold border-[#D97A75]'
                        : 'bg-transparent text-[#57534E] font-medium border-transparent hover:text-[#292524] hover:bg-white/60'
                    }`}
                  >
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                        isActive ? 'text-[#528BCA]' : 'text-[#727975] group-hover:text-[#1C1B1F]'
                      }`}
                    />
                    <span className="font-heading text-[13px] sm:text-sm leading-none">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Unified Card Body */}
            <div role="tabpanel" aria-label={`Active synthesis view: ${analyticsTab}`}>
              {verifiedRecords.length === 0 ? (
                <div className="p-12 text-center space-y-4">
                  <Info className="w-8 h-8 text-[#528BCA] mx-auto" />
                  <h3 className="text-xl font-bold text-[#292524] tracking-[-0.02em]">
                    No Human Verified interviews yet
                  </h3>
                  <p className="text-lg text-[#57534E] max-w-lg mx-auto leading-relaxed">
                    Verify at least one interview draft to unlock charts, tables &amp; maps. Copilot drafts remain staged until you verify them in the Review Workspace.
                  </p>
                  <button
                    type="button"
                    onClick={() => setWorkspaceMode('review')}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white cursor-pointer transition-colors shadow-xs"
                  >
                    <LayoutPanelLeft className="w-4 h-4" /> Go to Review Workspace
                  </button>
                </div>
              ) : (
                <>
                  {analyticsTab === 'distribution' && (
                    <AdkotmDistributionView
                      embedded
                      records={verifiedRecords}
                      onProceedToAnalytics={() => setAnalyticsTab('analytics')}
                      onSelectRecord={(recId) => {
                        setSelectedRecordId(recId);
                        setWorkspaceMode('review');
                      }}
                    />
                  )}

                  {analyticsTab === 'analytics' && (
                    <DecodeAnalyticsView
                      embedded
                      records={verifiedRecords}
                      allRecords={eligibleRecords}
                      onOpenMap={() => setAnalyticsTab('map')}
                      onBatchUpdateRecords={handleApplyNormalizedRecords}
                      onOpenCard={(recId) => {
                        setSelectedRecordId(recId);
                        setWorkspaceMode('review');
                      }}
                    />
                  )}

                  {analyticsTab === 'map' && <KlangValleyMap embedded records={verifiedRecords} />}

                  {analyticsTab === 'table' && (
                    <div>
                      <div className="p-5 sm:p-6 border-b border-[#EAE6DF] flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg sm:text-xl font-bold text-[#292524] tracking-[-0.02em]">
                              Verified Summary Table (Post-Analysis Codes)
                            </h3>
                            <span className="px-3 py-0.5 rounded-full text-[13px] font-bold bg-[#96D6C7] text-[#1E4D42] tabular-nums">
                              {verifiedRecords.length} Human Verified
                            </span>
                          </div>
                          <p className="text-base text-[#57534E] mt-1 leading-relaxed">
                            FR (Family Role), RL (Residential Location), AW (Gut Awareness), PP (Products), PP1 (Brands), IL (Venue).
                          </p>
                        </div>

                        <div className="flex items-center gap-2 min-w-[260px]">
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
                            <input
                              type="text"
                              value={tableSearch}
                              onChange={(e) => setTableSearch(e.target.value)}
                              placeholder="Filter by name, place, brand..."
                              className="w-full pl-9 pr-8 py-2 text-[15px] rounded-full border border-[#EAE6DF] bg-[#F7F5F0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 focus:border-[#528BCA] text-[#292524]"
                            />
                            {tableSearch && (
                              <button
                                type="button"
                                onClick={() => setTableSearch('')}
                                aria-label="Clear table filter"
                                title="Clear filter"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#78716C] hover:text-[#292524] px-1 cursor-pointer"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto w-full">
                        <table className="w-full text-base text-left min-w-[740px] tabular-nums">
                          <thead className="bg-[#F7F5F0] text-[#57534E] uppercase font-semibold text-[13px] border-b border-[#EAE6DF]">
                            <tr>
                              <th className="py-3.5 px-4">
                                <button
                                  type="button"
                                  onClick={() => toggleTableSort('participant')}
                                  className="inline-flex items-center gap-1 uppercase hover:text-[#1C1B1F] cursor-pointer"
                                >
                                  <span>Participant</span>
                                  <span className="text-[11px] text-[#528BCA]">
                                    {tableSort?.column === 'participant'
                                      ? tableSort.dir === 'asc'
                                        ? '↑'
                                        : '↓'
                                      : '↕'}
                                  </span>
                                </button>
                              </th>
                              <th className="py-3.5 px-3">
                                <button
                                  type="button"
                                  onClick={() => toggleTableSort('FR')}
                                  className="inline-flex items-center gap-1 uppercase hover:text-[#1C1B1F] cursor-pointer"
                                >
                                  <span>FR</span>
                                  <span className="text-[11px] text-[#528BCA]">
                                    {tableSort?.column === 'FR'
                                      ? tableSort.dir === 'asc'
                                        ? '↑'
                                        : '↓'
                                      : '↕'}
                                  </span>
                                </button>
                              </th>
                              <th className="py-3.5 px-3">RL</th>
                              <th className="py-3.5 px-3">
                                <button
                                  type="button"
                                  onClick={() => toggleTableSort('AW')}
                                  className="inline-flex items-center gap-1 uppercase hover:text-[#1C1B1F] cursor-pointer"
                                >
                                  <span>AW</span>
                                  <span className="text-[11px] text-[#528BCA]">
                                    {tableSort?.column === 'AW'
                                      ? tableSort.dir === 'asc'
                                        ? '↑'
                                        : '↓'
                                      : '↕'}
                                  </span>
                                </button>
                              </th>
                              <th className="py-3.5 px-3">
                                <button
                                  type="button"
                                  onClick={() => toggleTableSort('PP')}
                                  className="inline-flex items-center gap-1 uppercase hover:text-[#1C1B1F] cursor-pointer"
                                >
                                  <span>PP</span>
                                  <span className="text-[11px] text-[#528BCA]">
                                    {tableSort?.column === 'PP'
                                      ? tableSort.dir === 'asc'
                                        ? '↑'
                                        : '↓'
                                      : '↕'}
                                  </span>
                                </button>
                              </th>
                              <th className="py-3.5 px-3">PP1</th>
                              <th className="py-3.5 px-3">IL</th>
                              <th className="py-3.5 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                      <tbody className="divide-y divide-[#E2E6E4]">
                        {filteredTableRecords.map((r) => {
                          const dec = r.adkotmDecode;
                          return (
                            <tr key={r.id} className="hover:bg-[#F2F5F3]/65 transition-colors align-top">
                              <td className="py-3.5 px-4 min-w-[230px] max-w-[290px]">
                                <div className="font-semibold text-[#1C1B1F] break-words leading-snug" title={r.fileName}>
                                  {stripRecordingExtension(r.fileName)}
                                </div>
                                <div className="font-normal text-xs text-[#78716C] mt-0.5">
                                  {r.folderName || r.sessionDate || 'Session'}
                                </div>
                              </td>
                              <td className="py-3.5 px-3">{renderValue(dec?.postAnalysisCodes?.FR)}</td>
                              <td className="py-3.5 px-3">{renderValue(dec?.postAnalysisCodes?.RL)}</td>
                              <td className="py-3.5 px-3">{renderValue(dec?.postAnalysisCodes?.AW)}</td>
                              <td className="py-3.5 px-3">{renderValue(dec?.postAnalysisCodes?.PP)}</td>
                              <td className="py-3.5 px-3">{renderValue(dec?.postAnalysisCodes?.PP1)}</td>
                              <td className="py-3.5 px-3">{renderValue(dec?.postAnalysisCodes?.IL)}</td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedRecordId(r.id);
                                      setWorkspaceMode('review');
                                    }}
                                    className="text-[13px] font-semibold text-[#528BCA] hover:underline cursor-pointer px-2 py-1"
                                  >
                                    Inspect
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCrudRecordToEdit(r);
                                      setIsCrudModalOpen(true);
                                    }}
                                    className="text-[13px] font-semibold text-[#292524] bg-[#F7F5F0] hover:bg-[#EAE6DF]/70 px-3 py-1 rounded-full cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-[#78716C]" />
                                    Edit
                                  </button>
                                  {onDeleteRecord && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (confirm(`Delete decode record for "${r.fileName}"?`)) {
                                          onDeleteRecord(r.id);
                                        }
                                      }}
                                      aria-label={`Delete ${r.fileName}`}
                                      className="text-[#78716C] hover:text-[#7A3A36] p-1.5 rounded-full hover:bg-[#FDF4F3] cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Normalize Cross-Interview Tags Modal */}
      <NormalizeTagsModal
        isOpen={isNormalizeModalOpen}
        onClose={() => setIsNormalizeModalOpen(false)}
        records={eligibleRecords}
        onApplyNormalizedRecords={handleApplyNormalizedRecords}
      />

      {/* Full Qualitative Decode CRUD Modal */}
      <DecodeCrudModal
        isOpen={isCrudModalOpen}
        onClose={() => setIsCrudModalOpen(false)}
        recordToEdit={crudRecordToEdit}
        onSaveRecord={(savedRecord) => {
          if (crudRecordToEdit) {
            onUpdateRecord(savedRecord);
          } else if (onAddRecord) {
            onAddRecord(savedRecord);
          } else {
            onUpdateRecord(savedRecord);
          }
        }}
        onDeleteRecord={onDeleteRecord}
      />
    </div>
  );
};
