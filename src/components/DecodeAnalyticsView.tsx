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
} from '../types';
import { isAnalysisEligibleRecord } from '../lib/recordEligibility';
import {
  computeActivityCooccurrenceMatrix,
  computeFolderTabSignalCounts,
  computeTraceableDimensionDataset,
  TraceableBreakdownItem,
  TraceableDimensionDataset,
} from '../lib/decodeAnalytics';
import {
  assignCustomCategoryToRecords,
  deleteCodeOrCategoryAcrossRecords,
  loadCustomTaxonomy,
  mergeCodesAcrossRecords,
  renameCodeOrCategoryAcrossRecords,
  saveCustomTaxonomy,
} from '../lib/taxonomyCrud';
import { exportDecodesToCSV } from '../lib/exportUtils';
import { OverviewBentoTab } from './bento/OverviewBentoTab';
import { DimensionBreakdownSection } from './bento/DimensionBreakdownSection';
import { TraceabilityDrawer } from './bento/TraceabilityDrawer';
import { ManageCategoriesModal } from './bento/ManageCategoriesModal';

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
  badgeActiveClass: string;
}[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Overview',
    icon: LayoutGrid,
    activeAccentClass: 'text-amber-600',
    badgeActiveClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    id: 'O',
    label: 'O • Objects',
    shortLabel: 'O • Objects',
    icon: Package,
    activeAccentClass: 'text-orange-600',
    badgeActiveClass: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  {
    id: 'A',
    label: 'A • Activities',
    shortLabel: 'A • Activities',
    icon: Activity,
    activeAccentClass: 'text-emerald-600',
    badgeActiveClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    id: 'K',
    label: 'K • Knowledge',
    shortLabel: 'K • Knowledge',
    icon: BookOpen,
    activeAccentClass: 'text-indigo-600',
    badgeActiveClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  {
    id: 'D',
    label: 'D • Demographics',
    shortLabel: 'D • Demographics',
    icon: Users,
    activeAccentClass: 'text-sky-600',
    badgeActiveClass: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  {
    id: 'T',
    label: 'T • Timing',
    shortLabel: 'T • Timing',
    icon: Clock,
    activeAccentClass: 'text-rose-600',
    badgeActiveClass: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    id: 'M',
    label: 'M • Metadata',
    shortLabel: 'M • Metadata',
    icon: MapPin,
    activeAccentClass: 'text-slate-700',
    badgeActiveClass: 'bg-slate-200 text-slate-800 border-slate-300',
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
            ? 'pb-3.5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3'
            : 'bg-white rounded-2xl border border-stone-200 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3'
        }
      >
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-stone-900">Theme Insights</h3>
            <span className="text-stone-300">·</span>
            <span className="text-xs font-mono font-semibold text-stone-600 tabular-nums">
              {verifiedDecodedRecords.length} Human-Verified interview
              {verifiedDecodedRecords.length === 1 ? '' : 's'}
            </span>
            {customCategories.length > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-800 tabular-nums">
                {customCategories.length} custom taxonomy rule
                {customCategories.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            100% live-computed from verified decodes. Click any chart bar, segment, or table count to audit source transcripts and verbatim quotes.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => openManageModal('merge')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <GitMerge className="w-3.5 h-3.5 text-stone-500" />
            <span>Merge Codes</span>
          </button>

          <button
            type="button"
            onClick={() => exportDecodesToCSV(verifiedDecodedRecords)}
            disabled={verifiedDecodedRecords.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 text-stone-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => openManageModal('inspect')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manage Categories</span>
          </button>
        </div>
      </div>

      {/* Transient Action Feedback Banner */}
      {actionNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-emerald-900 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Cross-Filter Banner */}
      {activeOverviewFilter && (
        <div className="bg-orange-50/80 border border-orange-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-orange-950 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
            <span className="font-semibold">Cross-Filtered by [{activeOverviewFilter.dimension}]:</span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-orange-200 font-bold text-stone-900">
              {activeOverviewFilter.label}
            </span>
            <span className="font-mono text-[11px] text-orange-900/80 tabular-nums">
              Showing {scopedVerifiedRecords.length} of {verifiedDecodedRecords.length} verified interviews
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveOverviewFilter(null)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-orange-200 hover:bg-orange-100 text-[11px] font-bold text-orange-900 cursor-pointer shrink-0"
          >
            <X className="w-3 h-3" />
            <span>Clear Filter</span>
          </button>
        </div>
      )}

      {/* Connected Folder-Style Tab Navigation + Seamlessly Attached Panel */}
      <div>
        <div className="relative bg-[#F4F3EF] border-t border-l border-r border-stone-200 rounded-t-2xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-stone-200 z-0"
          />
          <div
            role="tablist"
            aria-label="ADKOTM Decode Analytics Dimensions"
            className="relative z-10 px-2 pt-2 flex items-end overflow-x-auto overflow-y-hidden no-scrollbar"
          >
            {FOLDER_TABS.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const count = tabCounts[tab.id] ?? 0;
              const nextTabActive = FOLDER_TABS[idx + 1]?.id === activeTab;
              const showDivider = !isActive && !nextTabActive && idx < FOLDER_TABS.length - 1;

              return (
                <React.Fragment key={tab.id}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group relative inline-flex items-center gap-1.5 px-2.5 lg:px-3 text-[11px] xl:text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer rounded-t-xl overflow-hidden ${
                      isActive
                        ? 'bg-white text-stone-900 font-bold border-t border-l border-r border-stone-200 pt-2.5 pb-2.5'
                        : 'text-stone-600 font-medium hover:text-stone-900 hover:bg-white/60 py-2 mb-px'
                    }`}
                  >
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 top-0 h-[2.5px] bg-[#EA580C]"
                      />
                    )}
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? tab.activeAccentClass : 'text-stone-400 group-hover:text-stone-600'
                      }`}
                    />
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md border text-[10px] font-mono font-bold tabular-nums leading-none ${
                        isActive
                          ? tab.badgeActiveClass
                          : 'bg-stone-200/75 text-stone-600 border-stone-200/90'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                  {showDivider && (
                    <div
                      aria-hidden="true"
                      className="w-px h-4 bg-stone-300/80 self-center mx-0.5 mb-px shrink-0"
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Flush Connected Main Panel Body */}
        <div
          role="tabpanel"
          aria-label={`Analytics content for ${activeTab}`}
          className="bg-white border-b border-l border-r border-stone-200 rounded-b-2xl p-4 sm:p-5"
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-stone-900">
                    {FOLDER_TABS.find((t) => t.id === activeTab)?.label || activeTab}
                  </span>
                  <span className="text-xs text-stone-400">·</span>
                  <span className="text-xs font-mono text-stone-600 tabular-nums">
                    {datasetsByDim[activeTab].totalSignals} coded signals across{' '}
                    {datasetsByDim[activeTab].groups.length} parameter group
                    {datasetsByDim[activeTab].groups.length === 1 ? '' : 's'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openManageModal('create')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-[11px] font-semibold cursor-pointer self-start sm:self-auto"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-amber-600" />
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
