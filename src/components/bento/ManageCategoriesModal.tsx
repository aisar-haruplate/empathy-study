import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Edit3,
  GitMerge,
  Layers,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ADKOTMDimensionKey,
  CustomTaxonomyCategory,
  InterviewRecord,
} from '../../types';
import {
  buildCustomFieldKey,
  buildTaxonomyRegistry,
  DIMENSION_FIELD_GROUPS,
  TaxonomyUsageEntry,
} from '../../lib/taxonomyCrud';
import { stripRecordingExtension } from '../../lib/adkotmCopilot';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  allDecodedRecords: InterviewRecord[];
  customCategories: CustomTaxonomyCategory[];
  initialTab?: 'inspect' | 'create' | 'merge';
  initialDimension?: ADKOTMDimensionKey | 'ALL';
  onClose: () => void;
  onCreateCategory: (params: {
    category: CustomTaxonomyCategory;
    assignRecordIds: string[];
    assignValue: string;
  }) => void;
  onRenameCode: (params: {
    dimension: ADKOTMDimensionKey;
    fieldKey?: string;
    oldLabel: string;
    newLabel: string;
    customCategoryId?: string;
  }) => void;
  onMergeCodes: (params: {
    dimension: ADKOTMDimensionKey;
    fieldKey?: string;
    sourceLabels: string[];
    targetLabel: string;
  }) => void;
  onDeleteCode: (params: {
    dimension: ADKOTMDimensionKey;
    fieldKey?: string;
    targetLabel?: string;
    mode: 'null' | 'reassign';
    reassignToLabel?: string;
    customCategoryId?: string;
    removeCustomParameterKey?: string;
  }) => void;
}

const DIM_OPTIONS: { id: ADKOTMDimensionKey; label: string; badgeClass: string }[] = [
  { id: 'O', label: 'O • Objects', badgeClass: 'bg-[#FEFBEB] text-[#6B5306] border-[#F7D147]' },
  { id: 'A', label: 'A • Activities', badgeClass: 'bg-[#F2FBF8] text-[#1E4D42] border-[#96D6C7]' },
  { id: 'K', label: 'K • Knowledge', badgeClass: 'bg-[#F2F7FC] text-[#234B78] border-[#528BCA]/45' },
  { id: 'D', label: 'D • Demographics', badgeClass: 'bg-[#F3F5FD] text-[#33418A] border-[#7C8CE0]/50' },
  { id: 'T', label: 'T • Timing', badgeClass: 'bg-[#FBEAE9] text-[#7A3A36] border-[#D97A75]/45' },
  { id: 'M', label: 'M • Metadata', badgeClass: 'bg-[#FDF4F3] text-[#7A3A36] border-[#F6BEBA]' },
];

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  isOpen,
  allDecodedRecords,
  customCategories,
  initialTab = 'inspect',
  initialDimension = 'ALL',
  onClose,
  onCreateCategory,
  onRenameCode,
  onMergeCodes,
  onDeleteCode,
}) => {
  const [modalTab, setModalTab] = useState<'inspect' | 'create' | 'merge'>(initialTab);
  const [dimFilter, setDimFilter] = useState<ADKOTMDimensionKey | 'ALL'>(initialDimension);
  const [searchQuery, setSearchQuery] = useState('');

  // Inline Rename state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Safe Delete state
  const [deletingEntry, setDeletingEntry] = useState<TaxonomyUsageEntry | null>(null);
  const [deleteMode, setDeleteMode] = useState<'null' | 'reassign'>('null');
  const [reassignTarget, setReassignTarget] = useState('');

  // Create (+ Add Category / Tag) state
  const [newName, setNewName] = useState('');
  const [newShortCode, setNewShortCode] = useState('');
  const [newDimension, setNewDimension] = useState<ADKOTMDimensionKey>('O');
  const [newKind, setNewKind] = useState<'category' | 'parameter'>('category');
  const [newFieldKey, setNewFieldKey] = useState('productsPurchased');
  const [newAssignValue, setNewAssignValue] = useState('');
  const [selectedAssignRecordIds, setSelectedAssignRecordIds] = useState<string[]>([]);

  // Merge state
  const [mergeDimension, setMergeDimension] = useState<ADKOTMDimensionKey>('O');
  const [mergeFieldKey, setMergeFieldKey] = useState<string>('ALL');
  const [mergeSelectedLabels, setMergeSelectedLabels] = useState<string[]>([]);
  const [mergeTargetLabel, setMergeTargetLabel] = useState('');

  const registry = useMemo(
    () => buildTaxonomyRegistry(allDecodedRecords, customCategories),
    [allDecodedRecords, customCategories]
  );

  const filteredRegistry = useMemo(() => {
    return registry.filter((entry) => {
      if (dimFilter !== 'ALL' && entry.dimension !== dimFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          entry.label.toLowerCase().includes(q) ||
          entry.fieldLabel.toLowerCase().includes(q) ||
          entry.dimension.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [registry, dimFilter, searchQuery]);

  const mergeCandidates = useMemo(() => {
    return registry.filter((entry) => {
      if (entry.dimension !== mergeDimension) return false;
      if (mergeFieldKey !== 'ALL' && entry.fieldKey !== mergeFieldKey) return false;
      return entry.usageCount > 0;
    });
  }, [registry, mergeDimension, mergeFieldKey]);

  const reassignSuggestions = useMemo(() => {
    if (!deletingEntry) return [];
    return registry
      .filter(
        (e) =>
          e.dimension === deletingEntry.dimension &&
          e.label.toLowerCase() !== deletingEntry.label.toLowerCase()
      )
      .map((e) => e.label);
  }, [registry, deletingEntry]);

  if (!isOpen) return null;

  const handleDimensionForCreateChange = (dim: ADKOTMDimensionKey) => {
    setNewDimension(dim);
    const firstField = DIMENSION_FIELD_GROUPS[dim][0]?.fieldKey || 'productsPurchased';
    setNewFieldKey(firstField);
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) return;

    const fieldKey =
      newKind === 'parameter' ? buildCustomFieldKey(cleanName) : newFieldKey;

    const category: CustomTaxonomyCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      shortCode: newShortCode.trim() || undefined,
      dimension: newDimension,
      fieldKey,
      kind: newKind,
      createdAt: new Date().toISOString(),
    };

    onCreateCategory({
      category,
      assignRecordIds: selectedAssignRecordIds,
      assignValue: newKind === 'parameter' ? newAssignValue.trim() || cleanName : cleanName,
    });

    setNewName('');
    setNewShortCode('');
    setNewAssignValue('');
    setSelectedAssignRecordIds([]);
    setModalTab('inspect');
    setDimFilter(newDimension);
  };

  const handleConfirmDelete = () => {
    if (!deletingEntry) return;
    const matchedCustomParam = customCategories.find(
      (c) => c.id === deletingEntry.customCategoryId && c.kind === 'parameter'
    );

    onDeleteCode({
      dimension: deletingEntry.dimension,
      fieldKey: deletingEntry.fieldKey,
      targetLabel: deletingEntry.label,
      mode: deleteMode,
      reassignToLabel: deleteMode === 'reassign' ? reassignTarget.trim() : undefined,
      customCategoryId: deletingEntry.customCategoryId,
      removeCustomParameterKey: matchedCustomParam?.fieldKey,
    });
    setDeletingEntry(null);
    setReassignTarget('');
    setDeleteMode('null');
  };

  const handleSubmitMerge = (e: React.FormEvent) => {
    e.preventDefault();
    const canonical = mergeTargetLabel.trim();
    if (mergeSelectedLabels.length < 2 || !canonical) return;

    onMergeCodes({
      dimension: mergeDimension,
      fieldKey: mergeFieldKey === 'ALL' ? undefined : mergeFieldKey,
      sourceLabels: mergeSelectedLabels,
      targetLabel: canonical,
    });

    setMergeSelectedLabels([]);
    setMergeTargetLabel('');
    setModalTab('inspect');
    setDimFilter(mergeDimension);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#292524]/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Manage Categories and Taxonomy Codes"
    >
      <div className="bg-white rounded-3xl border border-[#EAE6DF] shadow-studio w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#EAE6DF] bg-[#F7F5F0] flex items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-[#292524] tracking-[-0.02em]">
              Manage Categories &amp; ADKOTM Taxonomy
            </h2>
            <p className="text-base leading-[1.65] text-[#57534E] mt-1">
              Create, inspect usage, rename, merge synonymous labels, or safely remove categories across all {allDecodedRecords.length} decoded interview records while preserving verbatim quotes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full border border-[#EAE6DF] bg-white hover:bg-[#FDFCF8] text-[#78716C] hover:text-[#292524] cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inner Mode Tabs */}
        <div className="px-6 pt-3 border-b border-[#EAE6DF] bg-white flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setModalTab('inspect')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-heading font-bold border-b-[3px] transition-colors cursor-pointer whitespace-nowrap ${
              modalTab === 'inspect'
                ? 'border-[#D97A75] text-[#292524]'
                : 'border-transparent text-[#78716C] hover:text-[#292524]'
            }`}
          >
            <Layers className="w-4 h-4" />
            Taxonomy &amp; Usage Inspector ({registry.length})
          </button>

          <button
            type="button"
            onClick={() => setModalTab('create')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-heading font-bold border-b-[3px] transition-colors cursor-pointer whitespace-nowrap ${
              modalTab === 'create'
                ? 'border-[#D97A75] text-[#292524]'
                : 'border-transparent text-[#78716C] hover:text-[#292524]'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Category / Tag
          </button>

          <button
            type="button"
            onClick={() => setModalTab('merge')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-heading font-bold border-b-[3px] transition-colors cursor-pointer whitespace-nowrap ${
              modalTab === 'merge'
                ? 'border-[#D97A75] text-[#292524]'
                : 'border-transparent text-[#78716C] hover:text-[#292524]'
            }`}
          >
            <GitMerge className="w-4 h-4" />
            Merge Synonymous Codes
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: TAXONOMY & USAGE INSPECTOR */}
          {modalTab === 'inspect' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDimFilter('ALL')}
                    className={`px-3 py-1.5 rounded-full text-[13px] font-semibold border cursor-pointer transition-colors ${
                      dimFilter === 'ALL'
                        ? 'bg-[#292524] text-white border-[#292524]'
                        : 'bg-white text-[#57534E] border-[#EAE6DF] hover:bg-[#F7F5F0]'
                    }`}
                  >
                    All ({registry.length})
                  </button>
                  {DIM_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDimFilter(opt.id)}
                      className={`px-3 py-1.5 rounded-full text-[13px] font-semibold border cursor-pointer transition-colors ${
                        dimFilter === opt.id
                          ? 'bg-[#292524] text-white border-[#292524]'
                          : 'bg-white text-[#57534E] border-[#EAE6DF] hover:bg-[#F7F5F0]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="relative sm:w-64">
                  <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter categories or fields..."
                    className="w-full pl-9 pr-3.5 py-2 text-sm rounded-full border border-[#EAE6DF] bg-[#F7F5F0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25"
                  />
                </div>
              </div>

              {/* Safe Delete Confirmation Banner */}
              {deletingEntry && (
                <div className="rounded-2xl border border-[#D97A75]/45 bg-[#FDF4F3] p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-[#D97A75] shrink-0 mt-1" />
                    <div>
                      <h4 className="font-heading text-base font-bold text-[#7A3A36]">
                        Remove &ldquo;{deletingEntry.label}&rdquo; ({deletingEntry.dimension} · {deletingEntry.fieldLabel})
                      </h4>
                      <p className="text-base leading-[1.65] text-[#7A3A36] mt-0.5">
                        This code is currently used in <strong className="font-mono">{deletingEntry.usageCount}</strong> decoded interview{deletingEntry.usageCount === 1 ? '' : 's'}. Choose how to handle affected records:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-6">
                    <label className="flex items-start gap-2 rounded-xl border border-[#D97A75]/35 bg-white p-3 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === 'null'}
                        onChange={() => setDeleteMode('null')}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-semibold text-[#292524]">Set affected fields to null</div>
                        <div className="text-[13px] text-[#78716C]">Marks this field as unstated while keeping quotes</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 rounded-xl border border-[#D97A75]/35 bg-white p-3 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === 'reassign'}
                        onChange={() => setDeleteMode('reassign')}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[#292524]">Reassign to another category</div>
                        {deleteMode === 'reassign' && (
                          <div className="mt-2">
                            <input
                              type="text"
                              list="reassign-category-options"
                              value={reassignTarget}
                              onChange={(e) => setReassignTarget(e.target.value)}
                              placeholder="Type or select replacement..."
                              className="w-full px-3 py-1.5 text-sm rounded-lg border border-[#EAE6DF] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25"
                            />
                            <datalist id="reassign-category-options">
                              {reassignSuggestions.map((label) => (
                                <option key={label} value={label} />
                              ))}
                            </datalist>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDeletingEntry(null)}
                      className="px-4 py-1.5 rounded-full border border-[#EAE6DF] bg-white text-[13px] font-semibold text-[#57534E] hover:bg-[#F7F5F0] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleteMode === 'reassign' && !reassignTarget.trim()}
                      onClick={handleConfirmDelete}
                      className="px-4 py-1.5 rounded-full bg-[#D97A75] hover:bg-[#C66661] text-white text-[13px] font-semibold cursor-pointer disabled:opacity-40"
                    >
                      Confirm Removal
                    </button>
                  </div>
                </div>
              )}

              {/* Registry Table */}
              <div className="border border-[#EAE6DF] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-base">
                  <thead className="bg-[#F7F5F0] border-b border-[#EAE6DF] text-[13px] font-semibold text-[#57534E]">
                    <tr>
                      <th className="py-3 px-3.5">Category / Code</th>
                      <th className="py-3 px-3">ADKOTM Dimension</th>
                      <th className="py-3 px-3">Field Parameter</th>
                      <th className="py-3 px-3 text-right">Usage</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE6DF]">
                    {filteredRegistry.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-base text-[#78716C]">
                          No categories or codes matched your filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRegistry.map((entry) => {
                        const isEditing = editingEntryId === entry.id;
                        const dimBadge =
                          DIM_OPTIONS.find((d) => d.id === entry.dimension)?.badgeClass || '';
                        return (
                          <tr key={entry.id} className="hover:bg-[#FDFCF8]">
                            <td className="py-3 px-3.5 font-semibold text-[#292524]">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={renameDraft}
                                    onChange={(e) => setRenameDraft(e.target.value)}
                                    className="px-2.5 py-1 text-base rounded-lg border border-[#528BCA] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 w-52"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (renameDraft.trim()) {
                                        onRenameCode({
                                          dimension: entry.dimension,
                                          fieldKey: entry.fieldKey,
                                          oldLabel: entry.label,
                                          newLabel: renameDraft.trim(),
                                          customCategoryId: entry.customCategoryId,
                                        });
                                      }
                                      setEditingEntryId(null);
                                    }}
                                    className="p-1.5 rounded-full bg-[#96D6C7] text-[#1E4D42] hover:bg-[#7CC8B6] cursor-pointer"
                                    title="Save rename"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntryId(null)}
                                    className="p-1.5 rounded-full border border-[#EAE6DF] bg-white text-[#78716C] hover:text-[#292524] cursor-pointer"
                                    title="Cancel rename"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span>{entry.label}</span>
                                  {entry.isCustom && (
                                    <span className="text-[13px] font-medium text-[#6B5306] bg-[#FEFBEB] border border-[#F7D147] px-2.5 py-0.5 rounded-full">
                                      Custom
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[13px] font-mono font-bold ${dimBadge}`}
                              >
                                {entry.dimension}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-sm text-[#57534E]">{entry.fieldLabel}</td>
                            <td className="py-3 px-3 text-right font-mono text-[13px] tabular-nums text-[#292524] font-semibold">
                              Used in {entry.usageCount}
                            </td>
                            <td className="py-3 px-3.5 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEntryId(entry.id);
                                    setRenameDraft(entry.label);
                                  }}
                                  className="p-1.5 rounded-full text-[#78716C] hover:text-[#528BCA] hover:bg-[#F2F7FC] cursor-pointer"
                                  title="Rename across all decoded interviews"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeletingEntry(entry);
                                    setDeleteMode('null');
                                    setReassignTarget('');
                                  }}
                                  className="p-1.5 rounded-full text-[#78716C] hover:text-[#D97A75] hover:bg-[#FDF4F3] cursor-pointer"
                                  title="Safely remove or reassign"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CREATE (+ ADD CATEGORY / TAG) */}
          {modalTab === 'create' && (
            <form onSubmit={handleSubmitCreate} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-[#292524] mb-1.5">
                    Parent ADKOTM Dimension
                  </label>
                  <select
                    value={newDimension}
                    onChange={(e) =>
                      handleDimensionForCreateChange(e.target.value as ADKOTMDimensionKey)
                    }
                    className="w-full px-3.5 py-2 text-base rounded-xl border border-[#EAE6DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25"
                  >
                    {DIM_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#292524] mb-1.5">
                    Definition Kind
                  </label>
                  <select
                    value={newKind}
                    onChange={(e) => setNewKind(e.target.value as 'category' | 'parameter')}
                    className="w-full px-3.5 py-2 text-base rounded-xl border border-[#EAE6DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25"
                  >
                    <option value="category">Category / Code inside Existing Field</option>
                    <option value="parameter">New Custom Parameter (e.g. Health Triggers [HT])</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[13px] font-bold text-[#292524] mb-1.5">
                    {newKind === 'parameter' ? 'Custom Parameter Name' : 'New Category / Tag Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={
                      newKind === 'parameter'
                        ? 'e.g. Health Triggers'
                        : 'e.g. Probiotic Drinks'
                    }
                    className="w-full px-3.5 py-2 text-base rounded-xl border border-[#EAE6DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#292524] mb-1.5">
                    Short Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={newShortCode}
                    onChange={(e) => setNewShortCode(e.target.value)}
                    placeholder="e.g. HT"
                    className="w-full px-3.5 py-2 text-base rounded-xl border border-[#EAE6DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 font-mono"
                  />
                </div>
              </div>

              {newKind === 'category' ? (
                <div>
                  <label className="block text-[13px] font-bold text-[#292524] mb-1.5">
                    Target ADKOTM Field
                  </label>
                  <select
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    className="w-full px-3.5 py-2 text-base rounded-xl border border-[#EAE6DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25"
                  >
                    {DIMENSION_FIELD_GROUPS[newDimension].map((fg) => (
                      <option key={fg.fieldKey} value={fg.fieldKey}>
                        {fg.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[13px] font-bold text-[#292524] mb-1.5">
                    Initial Tag Value for Selected Interviews
                  </label>
                  <input
                    type="text"
                    value={newAssignValue}
                    onChange={(e) => setNewAssignValue(e.target.value)}
                    placeholder="Optional default code value (defaults to parameter name)"
                    className="w-full px-3.5 py-2 text-base rounded-xl border border-[#EAE6DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25"
                  />
                </div>
              )}

              {/* Optional Immediate Assignment to Decoded Records */}
              <div className="rounded-2xl border border-[#EAE6DF] bg-[#F7F5F0] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-bold text-[#292524]">
                    Tag Decoded Interviews Now (Optional)
                  </span>
                  <span className="font-mono text-[13px] text-[#78716C] tabular-nums">
                    {selectedAssignRecordIds.length} selected
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allDecodedRecords.map((rec) => {
                    const checked = selectedAssignRecordIds.includes(rec.id);
                    return (
                      <label
                        key={rec.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] cursor-pointer ${
                          checked
                            ? 'bg-[#FEFBEB] border-[#F7D147] text-[#6B5306] font-semibold'
                            : 'bg-white border-[#EAE6DF] text-[#57534E]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedAssignRecordIds((prev) =>
                              prev.includes(rec.id)
                                ? prev.filter((id) => id !== rec.id)
                                : [...prev, rec.id]
                            )
                          }
                        />
                        <span className="truncate">{stripRecordingExtension(rec.fileName)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-full border border-[#EAE6DF] text-[13px] font-semibold text-[#57534E] hover:bg-[#F7F5F0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#528BCA] hover:bg-[#3F78B5] text-white text-[13px] font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Save Category
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: MERGE SYNONYMOUS CODES */}
          {modalTab === 'merge' && (
            <form onSubmit={handleSubmitMerge} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-[#292524] mb-1.5">
                    Dimension Scope
                  </label>
                  <select
                    value={mergeDimension}
                    onChange={(e) => {
                      setMergeDimension(e.target.value as ADKOTMDimensionKey);
                      setMergeFieldKey('ALL');
                      setMergeSelectedLabels([]);
                    }}
                    className="w-full px-3.5 py-2 text-base rounded-xl border border-[#EAE6DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25"
                  >
                    {DIM_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#292524] mb-1.5">
                    Field Parameter Filter
                  </label>
                  <select
                    value={mergeFieldKey}
                    onChange={(e) => {
                      setMergeFieldKey(e.target.value);
                      setMergeSelectedLabels([]);
                    }}
                    className="w-full px-3.5 py-2 text-base rounded-xl border border-[#EAE6DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25"
                  >
                    <option value="ALL">All Fields in {mergeDimension}</option>
                    {DIMENSION_FIELD_GROUPS[mergeDimension].map((fg) => (
                      <option key={fg.fieldKey} value={fg.fieldKey}>
                        {fg.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-bold text-[#292524]">
                    1. Select 2 or more fragmented codes to consolidate
                  </span>
                  <span className="font-mono text-[13px] text-[#78716C] tabular-nums">
                    {mergeSelectedLabels.length} selected
                  </span>
                </div>

                {mergeCandidates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#EAE6DF] p-6 text-center text-base text-[#78716C]">
                    No coded items found in this dimension filter.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-2xl border border-[#EAE6DF] bg-[#F7F5F0]">
                    {mergeCandidates.map((cand) => {
                      const checked = mergeSelectedLabels.includes(cand.label);
                      return (
                        <label
                          key={cand.id}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-[13px] cursor-pointer ${
                            checked
                              ? 'bg-[#FEFBEB] border-[#F7D147] text-[#6B5306] font-semibold'
                              : 'bg-white border-[#EAE6DF] text-[#57534E]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setMergeSelectedLabels((prev) =>
                                  prev.includes(cand.label)
                                    ? prev.filter((l) => l !== cand.label)
                                    : [...prev, cand.label]
                                )
                              }
                            />
                            <span className="truncate">{cand.label}</span>
                          </div>
                          <span className="font-mono text-[13px] text-[#78716C] tabular-nums shrink-0">
                            {cand.usageCount} int
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#292524] mb-1.5">
                  2. Canonical Target Label (Original verbatim quotes will be preserved)
                </label>
                <input
                  type="text"
                  required
                  value={mergeTargetLabel}
                  onChange={(e) => setMergeTargetLabel(e.target.value)}
                  placeholder="e.g. Probiotic Drinks"
                  className="w-full px-3.5 py-2 text-base rounded-xl border border-[#EAE6DF] bg-white focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-full border border-[#EAE6DF] text-[13px] font-semibold text-[#57534E] hover:bg-[#F7F5F0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mergeSelectedLabels.length < 2 || !mergeTargetLabel.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#528BCA] hover:bg-[#3F78B5] text-white text-[13px] font-bold cursor-pointer disabled:opacity-40"
                >
                  <GitMerge className="w-4 h-4" />
                  Merge Selected Codes
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
