import React, { useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  FolderKanban,
  GitMerge,
  LayoutGrid,
  MapPin,
  Package,
  Plus,
  Users,
  X,
} from 'lucide-react';
import type {
  ADKOTMDimensionKey,
  CustomTaxonomyCategory,
  InterviewRecord,
} from '../../types';
import { isAnalysisEligibleRecord } from '../../lib/recordEligibility';
import {
  computeActivityCooccurrenceMatrix,
  computeFolderTabSignalCounts,
  computeTraceableDimensionDataset,
  TraceableBreakdownItem,
  TraceableDimensionDataset,
} from '../../lib/decodeAnalytics';
import {
  assignCustomCategoryToRecords,
  deleteCodeOrCategoryAcrossRecords,
  loadCustomTaxonomy,
  mergeCodesAcrossRecords,
  renameCodeOrCategoryAcrossRecords,
  saveCustomTaxonomy,
} from '../../lib/taxonomyCrud';
import { exportDecodesToCSV } from '../../lib/exportUtils';
import { OverviewBentoTab } from '../bento/OverviewBentoTab';
import { DimensionBreakdownSection } from '../bento/DimensionBreakdownSection';
import { TraceabilityDrawer } from '../bento/TraceabilityDrawer';
import { ManageCategoriesModal } from '../bento/ManageCategoriesModal';

export type AnalyticsFolderTabId = 'overview' | ADKOTMDimensionKey;

interface DecodeAnalyticsViewProps {
  records: InterviewRecord[];
  allRecords?: InterviewRecord[];
  onOpenCard?: (recordId: string) => void;
  onOpenMap?: () => void;
  onBatchUpdateRecords?: (updated: InterviewRecord[]) => void;
  embedded?: boolean;
}

interface ActiveOverviewFilter {
  filterKey: string;
  dimension: ADKOTMDimensionKey;
  label: string;
  recordIds: string[];
}

const FOLDER_TABS: {
  id: AnalyticsFolderTabId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  activeAccentClass: string;
  activeBarColor: string;
  badgeActiveClass: string;
}[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Overview',
    icon: LayoutGrid,
    activeAccentClass: 'text-[#528BCA]',
    activeBarColor: '#528BCA',
    badgeActiveClass: 'bg-[#DCE8F7] text-[#132B47] border-[#528BCA]/40',
  },
  {
    id: 'O',
    label: 'O • Objects',
    shortLabel: 'O • Objects',
    icon: Package,
    activeAccentClass: 'text-[#B8920A]',
    activeBarColor: '#E5B822',
    badgeActiveClass: 'bg-[#FDF3C7] text-[#3B2E00] border-[#F7D147]',
  },
  {
    id: 'A',
    label: 'A • Activities',
    shortLabel: 'A • Activities',
    icon: Activity,
    activeAccentClass: 'text-[#4FA896]',
    activeBarColor: '#4FA896',
    badgeActiveClass: 'bg-[#DDF3ED] text-[#133830] border-[#96D6C7]',
  },
  {
    id: 'K',
    label: 'K • Knowledge',
    shortLabel: 'K • Knowledge',
    icon: BookOpen,
    activeAccentClass: 'text-[#528BCA]',
    activeBarColor: '#528BCA',
    badgeActiveClass: 'bg-[#DCE8F7] text-[#132B47] border-[#528BCA]/45',
  },
  {
    id: 'D',
    label: 'D • Demographics',
    shortLabel: 'D • Demographics',
    icon: Users,
    activeAccentClass: 'text-[#6E8FDB]',
    activeBarColor: '#6E8FDB',
    badgeActiveClass: 'bg-[#F3F5FD] text-[#33418A] border-[#6E8FDB]/50',
  },
  {
    id: 'T',
    label: 'T • Timing',
    shortLabel: 'T • Timing',
    icon: Clock,
    activeAccentClass: 'text-[#D97A75]',
    activeBarColor: '#D97A75',
    badgeActiveClass: 'bg-[#FBEAE9] text-[#7A3A36] border-[#D97A75]/45',
  },
  {
    id: 'M',
    label: 'M • Metadata',
    shortLabel: 'M • Metadata',
    icon: MapPin,
    activeAccentClass: 'text-[#4FA896]',
    activeBarColor: '#4FA896',
    badgeActiveClass: 'bg-[#DDF3ED] text-[#133830] border-[#8EC3B5]',
  },
];

export const DecodeAnalyticsView: React.FC<DecodeAnalyticsViewProps> = ({
  records,
  allRecords,
  onOpenCard,
  onOpenMap,
  onBatchUpdateRecords,
  embedded = false,
}) => {
  const [activeTab, setActiveTab] = useState<AnalyticsFolderTabId>('overview');
  const [customCategories, setCustomCategories] = useState<CustomTaxonomyCategory[]>(() =>
    loadCustomTaxonomy()
  );
  const [traceItem, setTraceItem] = useState<TraceableBreakdownItem | null>(null);
  const [activeOverviewFilter, setActiveOverviewFilter] =
    useState<ActiveOverviewFilter | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [manageInitialTab, setManageInitialTab] = useState<'inspect' | 'create' | 'merge'>(
    'inspect'
  );
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Single Source of Truth for analytics visuals: Human-Verified records passed in `records`
  const verifiedDecodedRecords = useMemo(
    () => records.filter((r) => isAnalysisEligibleRecord(r) && Boolean(r.adkotmDecode)),
    [records]
  );

  // Scope for CRUD taxonomy mutations: all decoded records (verified + staged drafts)
  const allDecodedRecords = useMemo(
    () =>
      (allRecords || records).filter(
        (r) => isAnalysisEligibleRecord(r) && Boolean(r.adkotmDecode)
      ),
    [allRecords, records]
  );

  const scopedVerifiedRecords = useMemo(() => {
    if (!activeOverviewFilter) return verifiedDecodedRecords;
    const allowed = new Set(activeOverviewFilter.recordIds);
    return verifiedDecodedRecords.filter((r) => allowed.has(r.id));
  }, [verifiedDecodedRecords, activeOverviewFilter]);

  const datasetsByDim = useMemo<Record<ADKOTMDimensionKey, TraceableDimensionDataset>>(
    () => ({
      O: computeTraceableDimensionDataset(scopedVerifiedRecords, 'O', customCategories),
      A: computeTraceableDimensionDataset(scopedVerifiedRecords, 'A', customCategories),
      K: computeTraceableDimensionDataset(scopedVerifiedRecords, 'K', customCategories),
      D: computeTraceableDimensionDataset(scopedVerifiedRecords, 'D', customCategories),
      T: computeTraceableDimensionDataset(scopedVerifiedRecords, 'T', customCategories),
      M: computeTraceableDimensionDataset(scopedVerifiedRecords, 'M', customCategories),
    }),
    [scopedVerifiedRecords, customCategories]
  );

  const activityCooccurrence = useMemo(
    () => computeActivityCooccurrenceMatrix(scopedVerifiedRecords, 7),
    [scopedVerifiedRecords]
  );

  const tabCounts = useMemo(
    () => computeFolderTabSignalCounts(scopedVerifiedRecords, customCategories),
    [scopedVerifiedRecords, customCategories]
  );

  const getItemFilterKey = (item: TraceableBreakdownItem) =>
    `${item.dimension}::${item.fieldKey}::${item.key}`;

  const handleToggleOverviewFilter = (item: TraceableBreakdownItem) => {
    const key = getItemFilterKey(item);
    if (activeOverviewFilter?.filterKey === key) {
      setActiveOverviewFilter(null);
      return;
    }
    const uniqueIds = Array.from(new Set(item.contributors.map((c) => c.recordId)));
    if (uniqueIds.length === 0) return;
    setActiveOverviewFilter({
      filterKey: key,
      dimension: item.dimension,
      label: item.label,
      recordIds: uniqueIds,
    });
  };

  const showNotice = (msg: string) => {
    setActionNotice(msg);
  };

  const handleCreateCategory = (params: {
    category: CustomTaxonomyCategory;
    assignRecordIds: string[];
    assignValue: string;
  }) => {
    const nextCategories = [...customCategories, params.category];
    setCustomCategories(nextCategories);
    saveCustomTaxonomy(nextCategories);

    if (params.assignRecordIds.length > 0 && onBatchUpdateRecords) {
      const { updatedRecords, affectedCount } = assignCustomCategoryToRecords(
        allDecodedRecords,
        {
          category: params.category,
          recordIds: params.assignRecordIds,
          value: params.assignValue,
        }
      );
      if (affectedCount > 0) {
        onBatchUpdateRecords(updatedRecords);
        showNotice(
          `Added "${params.category.name}" under [${params.category.dimension}] and updated ${affectedCount} interview${affectedCount === 1 ? '' : 's'}.`
        );
        return;
      }
    }

    showNotice(
      `Added category "${params.category.name}" under [${params.category.dimension}].`
    );
  };

  const handleRenameCode = (params: {
    dimension: ADKOTMDimensionKey;
    fieldKey?: string;
    oldLabel: string;
    newLabel: string;
    customCategoryId?: string;
  }) => {
    const cleanNew = params.newLabel.trim();
    if (!cleanNew) return;

    if (params.customCategoryId) {
      const nextCategories = customCategories.map((c) =>
        c.id === params.customCategoryId ? { ...c, name: cleanNew } : c
      );
      setCustomCategories(nextCategories);
      saveCustomTaxonomy(nextCategories);
    }

    let affected = 0;
    if (onBatchUpdateRecords) {
      const res = renameCodeOrCategoryAcrossRecords(allDecodedRecords, {
        dimension: params.dimension,
        fieldKey: params.fieldKey,
        oldLabel: params.oldLabel,
        newLabel: cleanNew,
      });
      affected = res.affectedCount;
      if (affected > 0) {
        onBatchUpdateRecords(res.updatedRecords);
      }
    }

    showNotice(
      `Renamed "${params.oldLabel}" to "${cleanNew}" across ${affected} interview${affected === 1 ? '' : 's'} (verbatim quotes preserved).`
    );
  };

  const handleMergeCodes = (params: {
    dimension: ADKOTMDimensionKey;
    fieldKey?: string;
    sourceLabels: string[];
    targetLabel: string;
  }) => {
    if (!onBatchUpdateRecords) return;
    const { updatedRecords, affectedCount } = mergeCodesAcrossRecords(
      allDecodedRecords,
      params
    );
    if (affectedCount > 0) {
      onBatchUpdateRecords(updatedRecords);
    }
    showNotice(
      `Merged ${params.sourceLabels.length} labels into "${params.targetLabel}" across ${affectedCount} interview${affectedCount === 1 ? '' : 's'} (verbatim quotes preserved).`
    );
  };

  const handleDeleteCode = (params: {
    dimension: ADKOTMDimensionKey;
    fieldKey?: string;
    targetLabel?: string;
    mode: 'null' | 'reassign';
    reassignToLabel?: string;
    customCategoryId?: string;
    removeCustomParameterKey?: string;
  }) => {
    if (params.customCategoryId) {
      const nextCategories = customCategories.filter(
        (c) => c.id !== params.customCategoryId
      );
      setCustomCategories(nextCategories);
      saveCustomTaxonomy(nextCategories);
    }

    let affected = 0;
    if (onBatchUpdateRecords) {
      const res = deleteCodeOrCategoryAcrossRecords(allDecodedRecords, {
        dimension: params.dimension,
        fieldKey: params.fieldKey,
        targetLabel: params.targetLabel,
        mode: params.mode,
        reassignToLabel: params.reassignToLabel,
        removeCustomParameterKey: params.removeCustomParameterKey,
      });
      affected = res.affectedCount;
      if (affected > 0) {
        onBatchUpdateRecords(res.updatedRecords);
      }
    }

    if (params.mode === 'reassign' && params.reassignToLabel) {
      showNotice(
        `Reassigned "${params.targetLabel}" to "${params.reassignToLabel}" across ${affected} interview${affected === 1 ? '' : 's'}.`
      );
    } else {
      showNotice(
        `Removed "${params.targetLabel}" (${affected} interview${affected === 1 ? '' : 's'} set back to null).`
      );
    }
  };

  const openManageModal = (tab: 'inspect' | 'create' | 'merge') => {
    setManageInitialTab(tab);
    setIsManageModalOpen(true);
  };

  return (
    <div className={embedded ? 'p-5 sm:p-6 space-y-4' : 'space-y-4'}>
      {/* Top Toolbar */}
      <div
        className={
          embedded
            ? 'pb-4 border-b border-[#EAE6DF] flex flex-col sm:flex-row sm:items-center justify-between gap-3'
            : 'bg-white rounded-3xl border border-[#EAE6DF] shadow-studio px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3'
        }
      >
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-heading text-lg sm:text-xl font-bold text-[#292524] tracking-[-0.02em]">Theme Insights</h3>
            <span className="text-[#EAE6DF]">·</span>
            <span className="text-[13px] font-mono font-semibold text-[#57534E] tabular-nums">
              {verifiedDecodedRecords.length} Human-Verified interview
              {verifiedDecodedRecords.length === 1 ? '' : 's'}
            </span>
            {customCategories.length > 0 && (
              <span className="px-3 py-0.5 rounded-full bg-[#FEFBEB] border border-[#F7D147] text-[13px] font-semibold text-[#6B5306] tabular-nums">
                {customCategories.length} custom taxonomy rule
                {customCategories.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="text-base leading-[1.65] text-[#57534E] mt-1">
            100% live-computed from verified decodes. Click any chart bar, segment, or table count to audit source transcripts and verbatim quotes.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => openManageModal('merge')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#EAE6DF] bg-white hover:bg-[#F7F5F0] text-[#292524] text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <GitMerge className="w-4 h-4 text-[#528BCA]" />
            <span>Merge Codes</span>
          </button>

          <button
            type="button"
            onClick={() => exportDecodesToCSV(verifiedDecodedRecords)}
            disabled={verifiedDecodedRecords.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#EAE6DF] bg-white hover:bg-[#F7F5F0] disabled:opacity-40 text-[#292524] text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-[#57534E]" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => openManageModal('inspect')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#528BCA] hover:bg-[#3F78B5] text-white text-[13px] font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Manage Categories</span>
          </button>
        </div>
      </div>

      {/* Transient Action Feedback Banner */}
      {actionNotice && (
        <div className="bg-[#F2FBF8] border border-[#96D6C7] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-base leading-[1.65] text-[#1E4D42] font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#1E4D42] shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-[13px] font-semibold text-[#1E4D42] hover:underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Cross-Filter Banner */}
      {activeOverviewFilter && (
        <div className="bg-[#EEF4FB] border border-[#528BCA]/40 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-base text-[#1C1B1F] flex-wrap">
            <Filter className="w-4 h-4 text-[#528BCA] shrink-0" />
            <span className="font-semibold">Cross-Filtered by [{activeOverviewFilter.dimension}]:</span>
            <span className="px-3 py-0.5 rounded-full bg-white border border-[#D5DDD8] font-bold text-[13px] text-[#1C1B1F]">
              {activeOverviewFilter.label}
            </span>
            <span className="font-mono text-[13px] text-[#234B78] tabular-nums">
              Showing {scopedVerifiedRecords.length} of {verifiedDecodedRecords.length} verified interviews
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveOverviewFilter(null)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-[#528BCA]/40 hover:bg-[#DCE8F7] text-[13px] font-semibold text-[#234B78] cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Filter</span>
          </button>
        </div>
      )}

      {/* Flush Top Sub-Tab Strip + Connected Panel Body */}
      <div className="rounded-3xl border border-[#D5DDD8] bg-[#FDFCF8] shadow-sm overflow-hidden">
        <div
          role="tablist"
          aria-label="ADKOTM Decode Analytics Dimensions"
          className="flex w-full items-stretch bg-[#F2F5F3] border-b border-[#D5DDD8] overflow-x-auto no-scrollbar divide-x divide-[#D5DDD8]/70"
        >
          {FOLDER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id] ?? 0;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative flex-auto shrink-0 min-h-[46px] inline-flex items-center justify-center gap-1.5 px-2 xl:px-3 py-2.5 text-[11.5px] xl:text-[12px] whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#FDFCF8] text-[#1C1B1F] font-semibold'
                    : 'bg-[#F2F5F3] text-[#444846] font-medium hover:text-[#1C1B1F] hover:bg-[#DCE8F7]/40'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: tab.activeBarColor }}
                    className="absolute inset-x-0 bottom-0 h-[3px]"
                  />
                )}
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? tab.activeAccentClass : 'text-[#727975] group-hover:text-[#1C1B1F]'
                  }`}
                />
                <span className="font-heading uppercase tracking-[0.02em]">
                  {tab.label}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-full border text-[11px] font-mono font-semibold tabular-nums leading-none shrink-0 ${
                    isActive
                      ? tab.badgeActiveClass
                      : 'bg-[#E7ECE9] text-[#444846] border-transparent'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Connected Main Panel Body */}
        <div
          role="tabpanel"
          aria-label={`Analytics content for ${activeTab}`}
          className="bg-[#FDFCF8] p-5"
        >
          {activeTab === 'overview' ? (
            <OverviewBentoTab
              datasetsByDim={datasetsByDim}
              totalRecords={scopedVerifiedRecords.length}
              onSelectTab={(dim) => setActiveTab(dim)}
              onTraceItem={(item) => setTraceItem(item)}
              onOpenMap={onOpenMap}
              activeFilterKey={activeOverviewFilter?.filterKey || null}
            />
          ) : (
            <div className="space-y-4">
              {/* Dimension quick context bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EAE6DF]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading text-base font-bold text-[#292524]">
                    {FOLDER_TABS.find((t) => t.id === activeTab)?.label || activeTab}
                  </span>
                  <span className="text-[13px] text-[#78716C]">·</span>
                  <span className="text-[13px] font-mono text-[#57534E] tabular-nums">
                    {datasetsByDim[activeTab].totalSignals} coded signals across{' '}
                    {datasetsByDim[activeTab].groups.length} parameter group
                    {datasetsByDim[activeTab].groups.length === 1 ? '' : 's'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openManageModal('create')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#EAE6DF] bg-[#F7F5F0] hover:bg-[#EAE6DF]/60 text-[#292524] text-[13px] font-semibold cursor-pointer self-start sm:self-auto whitespace-nowrap"
                >
                  <FolderKanban className="w-4 h-4 text-[#528BCA]" />
                  <span>+ Add {activeTab} Category / Parameter</span>
                </button>
              </div>

              <DimensionBreakdownSection
                dataset={datasetsByDim[activeTab]}
                activityCooccurrence={activeTab === 'A' ? activityCooccurrence : undefined}
                onTraceItem={(item) => setTraceItem(item)}
                onRenameCode={handleRenameCode}
                onDeleteCode={handleDeleteCode}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right-Side Traceability Audit Drawer */}
      <TraceabilityDrawer
        item={traceItem}
        onClose={() => setTraceItem(null)}
        onOpenCard={onOpenCard}
        isFilterActive={Boolean(
          traceItem && activeOverviewFilter?.filterKey === getItemFilterKey(traceItem)
        )}
        onToggleOverviewFilter={handleToggleOverviewFilter}
      />

      {/* Dedicated Manage Categories CRUD Modal */}
      {isManageModalOpen && (
        <ManageCategoriesModal
          isOpen={isManageModalOpen}
          allDecodedRecords={allDecodedRecords}
          customCategories={customCategories}
          initialTab={manageInitialTab}
          initialDimension={activeTab === 'overview' ? 'ALL' : activeTab}
          onClose={() => setIsManageModalOpen(false)}
          onCreateCategory={handleCreateCategory}
          onRenameCode={handleRenameCode}
          onMergeCodes={handleMergeCodes}
          onDeleteCode={handleDeleteCode}
        />
      )}
    </div>
  );
};
