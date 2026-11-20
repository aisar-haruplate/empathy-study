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
import type { InterviewRecord, ADKOTMDecode, InterviewReviewStatus } from '../types';
import { DecodeCrudModal } from './DecodeCrudModal';
import { KlangValleyMap } from './KlangValleyMap';
import { AdkotmDistributionView } from './AdkotmDistributionView';
import { DecodeAnalyticsView } from './DecodeAnalyticsView';
import { Step3ReviewWorkspace } from './Step3ReviewWorkspace';
import { NormalizeTagsModal } from './NormalizeTagsModal';
import { exportDecodesToCSV, exportDecodesToDoc, openPrintablePDFReport } from '../lib/exportUtils';
import { loadCustomCodingRules } from '../lib/adkotmUtils';
import { isAnalysisEligibleRecord } from '../lib/recordEligibility';
import {
  computeReviewProgress,
  isHumanVerifiedRecord,
  proposeTaxonomyNormalizations,
  stripRecordingExtension,
} from '../lib/adkotmCopilot';

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
    return verifiedRecords.filter((r) => {
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
  }, [verifiedRecords, tableSearch]);

  const renderValue = (val: any) => {
    if (val === null || val === undefined) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-stone-100 text-stone-400 border border-stone-200">
          null
        </span>
      );
    }
    const strVal = Array.isArray(val) ? val.join(', ') : String(val);
    const lower = strVal.trim().toLowerCase();
    if (!strVal || lower === 'null' || lower === 'unstated') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-stone-100 text-stone-500 border border-stone-200">
          null
        </span>
      );
    }
    return (
      <span className="text-xs font-semibold text-stone-800 break-words leading-relaxed">
        {strVal}
      </span>
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
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-stone-50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <PieIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-stone-900">
                  Step 3: Decode Themes
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                  {verifiedRecords.length} of {eligibleRecords.length} Human Verified
                </span>
                {pendingReviewCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                    {pendingReviewCount} Needs Review
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 mt-1 max-w-2xl">
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
          className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-rose-900 shadow-2xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="truncate sm:whitespace-normal">{decodeError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDecodeError(null)}
            aria-label="Dismiss decode error"
            className="p-1 rounded-lg text-rose-500 hover:text-rose-800 hover:bg-rose-100 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Step 3 Completion Signal */}
      {eligibleRecords.length > 0 && verifiedRecords.length === eligibleRecords.length && !isBatchDecoding && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                <span>Step 3 Complete</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  All {verifiedRecords.length} Interviews Human Verified
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Every interview has been verified and synced into Analytics &amp; Step 4 Cross-Analysis.
              </p>
            </div>
          </div>

          {onProceedToNext && (
            <button
              type="button"
              onClick={onProceedToNext}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer transition-all shrink-0"
            >
              <span>Proceed to Step 4: Cross-Analysis</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Centered Mode Switcher Below Step 3 Completion / Header: Review Workspace vs Analytics & Summary */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Step 3 workspace mode"
          className="inline-flex items-center bg-white border border-stone-200 rounded-xl p-1 shadow-2xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'review'}
            onClick={() => setWorkspaceMode('review')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
              workspaceMode === 'review'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <LayoutPanelLeft className="w-3.5 h-3.5" />
            Review Workspace
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'analytics'}
            onClick={() => setWorkspaceMode('analytics')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
              workspaceMode === 'analytics'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
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
              <div className="flex items-center gap-2 text-xs text-amber-900 bg-amber-50/90 border border-amber-200/90 rounded-xl px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Showing <strong className="tabular-nums">{verifiedRecords.length}</strong> of{' '}
                  <strong className="tabular-nums">{eligibleRecords.length}</strong> Human Verified interviews.
                </span>
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('review')}
                  className="font-bold text-amber-800 hover:underline cursor-pointer whitespace-nowrap ml-1"
                >
                  Open Review Workspace →
                </button>
              </div>
            ) : (
              <div className="text-xs font-medium text-stone-500">
                Synthesizing <span className="font-semibold text-stone-700 tabular-nums">{verifiedRecords.length}</span> Human Verified interview{verifiedRecords.length === 1 ? '' : 's'}
              </div>
            )}

            {/* Export Verified Dataset */}
            <div className="flex items-center bg-white border border-stone-200 rounded-xl p-1 shadow-2xs shrink-0 self-start sm:self-auto ml-auto">
              <span className="text-[11px] font-bold text-stone-500 px-2 flex items-center gap-1 whitespace-nowrap">
                <Download className="w-3.5 h-3.5" /> Export Verified:
              </span>
              <button
                type="button"
                disabled={verifiedRecords.length === 0}
                onClick={() => exportDecodesToCSV(verifiedRecords)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-stone-100 text-stone-700 disabled:opacity-40 cursor-pointer transition-colors"
              >
                CSV
              </button>
              <button
                type="button"
                disabled={verifiedRecords.length === 0}
                onClick={() => exportDecodesToDoc(verifiedRecords)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-stone-100 text-blue-700 disabled:opacity-40 cursor-pointer transition-colors"
              >
                Word (.doc)
              </button>
              <button
                type="button"
                disabled={verifiedRecords.length === 0}
                onClick={() => openPrintablePDFReport(verifiedRecords)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-stone-100 text-rose-700 disabled:opacity-40 cursor-pointer transition-colors"
              >
                PDF
              </button>
            </div>
          </div>

          {/* Unified Synthesis Card Shell with Flush Attached 4-Tab Stacked Header */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
            {/* Attached Stacked Tab Bar (zero gap to card body below) */}
            <div
              role="tablist"
              aria-label="Synthesis and analytics views"
              className="bg-white border-b border-stone-200 rounded-t-2xl flex items-stretch overflow-x-auto no-scrollbar"
            >
              {(
                [
                  { id: 'distribution', label: 'ADKOTM Breakdown', icon: BarChart3 },
                  { id: 'analytics', label: 'Theme Insights', icon: Sparkles },
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
                    className={`group flex flex-col items-center justify-center gap-1 px-4 sm:px-6 py-3 min-w-[130px] flex-1 sm:flex-none whitespace-nowrap border-b-[2.5px] transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-orange-50/70 text-stone-900 font-bold border-[#EA580C]'
                        : 'bg-white text-stone-500 font-medium border-transparent hover:text-stone-900 hover:bg-stone-50/80'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-[#EA580C]' : 'text-stone-400 group-hover:text-stone-600'
                      }`}
                    />
                    <span className="text-xs leading-none">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Unified Card Body */}
            <div role="tabpanel" aria-label={`Active synthesis view: ${analyticsTab}`}>
              {verifiedRecords.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Info className="w-8 h-8 text-amber-500 mx-auto" />
                  <h3 className="text-sm font-bold text-stone-900">
                    No Human Verified interviews yet
                  </h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    Copilot drafts remain staged until you verify them in the Review Workspace. Verify at least one interview to populate charts, summary tables, and maps.
                  </p>
                  <button
                    type="button"
                    onClick={() => setWorkspaceMode('review')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                  >
                    <LayoutPanelLeft className="w-3.5 h-3.5" /> Go to Review Workspace
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
                      <div className="p-5 sm:p-6 border-b border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-stone-900">
                              Verified Summary Table (Post-Analysis Codes)
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums">
                              {verifiedRecords.length} Human Verified
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 mt-0.5">
                            FR (Family Role), RL (Residential Location), AW (Gut Awareness), PP (Products), PP1 (Brands), IL (Venue).
                          </p>
                        </div>

                        <div className="relative min-w-[220px]">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                          <input
                            type="text"
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                            placeholder="Filter by name, place, brand..."
                            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="overflow-x-auto w-full">
                        <table className="w-full text-xs text-left min-w-[700px]">
                          <thead className="bg-stone-50 text-stone-700 uppercase font-semibold text-[10px] border-b border-stone-200">
                            <tr>
                              <th className="py-3 px-4">Participant</th>
                              <th className="py-3 px-4">FR</th>
                              <th className="py-3 px-4">RL</th>
                              <th className="py-3 px-4">AW</th>
                              <th className="py-3 px-4">PP</th>
                              <th className="py-3 px-4">PP1</th>
                              <th className="py-3 px-4">IL</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                      <tbody className="divide-y divide-stone-200">
                        {filteredTableRecords.map((r) => {
                          const dec = r.adkotmDecode;
                          return (
                            <tr key={r.id} className="hover:bg-stone-50/70 transition-colors">
                              <td className="py-3 px-4 max-w-[200px]">
                                <div className="font-semibold text-stone-900 truncate" title={r.fileName}>
                                  {stripRecordingExtension(r.fileName)}
                                </div>
                                <div className="text-[10px] text-stone-400 mt-0.5">
                                  {r.folderName || r.sessionDate || 'Session'}
                                </div>
                              </td>
                              <td className="py-3 px-4">{renderValue(dec?.postAnalysisCodes?.FR)}</td>
                              <td className="py-3 px-4">{renderValue(dec?.postAnalysisCodes?.RL)}</td>
                              <td className="py-3 px-4">{renderValue(dec?.postAnalysisCodes?.AW)}</td>
                              <td className="py-3 px-4">{renderValue(dec?.postAnalysisCodes?.PP)}</td>
                              <td className="py-3 px-4">{renderValue(dec?.postAnalysisCodes?.PP1)}</td>
                              <td className="py-3 px-4">{renderValue(dec?.postAnalysisCodes?.IL)}</td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedRecordId(r.id);
                                      setWorkspaceMode('review');
                                    }}
                                    className="text-[11px] font-semibold text-amber-700 hover:underline cursor-pointer px-1.5 py-0.5"
                                  >
                                    Inspect
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCrudRecordToEdit(r);
                                      setIsCrudModalOpen(true);
                                    }}
                                    className="text-[11px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Edit3 className="w-3 h-3 text-stone-400" />
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
                                      className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
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
