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
  { id: 'O', label: 'O • Objects', badgeClass: 'bg-orange-50 text-orange-800 border-orange-200' },
  { id: 'A', label: 'A • Activities', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { id: 'K', label: 'K • Knowledge', badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  { id: 'D', label: 'D • Demographics', badgeClass: 'bg-sky-50 text-sky-800 border-sky-200' },
  { id: 'T', label: 'T • Timing', badgeClass: 'bg-rose-50 text-rose-800 border-rose-200' },
  { id: 'M', label: 'M • Metadata', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' },
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Manage Categories and Taxonomy Codes"
    >
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/70 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Manage Categories &amp; ADKOTM Taxonomy
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Create, inspect usage, rename, merge synonymous labels, or safely remove categories across all {allDecodedRecords.length} decoded interview records while preserving verbatim quotes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-500 hover:text-stone-900 cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inner Mode Tabs */}
        <div className="px-6 pt-3 border-b border-stone-200 bg-white flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setModalTab('inspect')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              modalTab === 'inspect'
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Taxonomy &amp; Usage Inspector ({registry.length})
          </button>

          <button
            type="button"
            onClick={() => setModalTab('create')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              modalTab === 'create'
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Category / Tag
          </button>

          <button
            type="button"
            onClick={() => setModalTab('merge')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              modalTab === 'merge'
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                      dimFilter === 'ALL'
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    All ({registry.length})
                  </button>
                  {DIM_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDimFilter(opt.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                        dimFilter === opt.id
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="relative sm:w-60">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter categories or fields..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Safe Delete Confirmation Banner */}
              {deletingEntry && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-950">
                        Remove &ldquo;{deletingEntry.label}&rdquo; ({deletingEntry.dimension} · {deletingEntry.fieldLabel})
                      </h4>
                      <p className="text-xs text-rose-800 mt-0.5">
                        This code is currently used in <strong className="font-mono">{deletingEntry.usageCount}</strong> decoded interview{deletingEntry.usageCount === 1 ? '' : 's'}. Choose how to handle affected records:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-6">
                    <label className="flex items-start gap-2 rounded-lg border border-rose-200 bg-white p-2.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === 'null'}
                        onChange={() => setDeleteMode('null')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-semibold text-stone-900">Set affected fields to null</div>
                        <div className="text-[11px] text-stone-500">Marks this field as unstated while keeping quotes</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 rounded-lg border border-rose-200 bg-white p-2.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === 'reassign'}
                        onChange={() => setDeleteMode('reassign')}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-stone-900">Reassign to another category</div>
                        {deleteMode === 'reassign' && (
                          <div className="mt-1.5">
                            <input
                              type="text"
                              list="reassign-category-options"
                              value={reassignTarget}
                              onChange={(e) => setReassignTarget(e.target.value)}
                              placeholder="Type or select replacement..."
                              className="w-full px-2 py-1 text-xs rounded border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                      className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleteMode === 'reassign' && !reassignTarget.trim()}
                      onClick={handleConfirmDelete}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
                    >
                      Confirm Removal
                    </button>
                  </div>
                </div>
              )}

              {/* Registry Table */}
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-[11px] font-semibold text-stone-500">
                    <tr>
                      <th className="py-2.5 px-3.5">Category / Code</th>
                      <th className="py-2.5 px-3">ADKOTM Dimension</th>
                      <th className="py-2.5 px-3">Field Parameter</th>
                      <th className="py-2.5 px-3 text-right">Usage</th>
                      <th className="py-2.5 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredRegistry.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-stone-500">
                          No categories or codes matched your filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRegistry.map((entry) => {
                        const isEditing = editingEntryId === entry.id;
                        const dimBadge =
                          DIM_OPTIONS.find((d) => d.id === entry.dimension)?.badgeClass || '';
                        return (
                          <tr key={entry.id} className="hover:bg-stone-50/70">
                            <td className="py-2.5 px-3.5 font-semibold text-stone-900">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={renameDraft}
                                    onChange={(e) => setRenameDraft(e.target.value)}
                                    className="px-2 py-1 text-xs rounded border border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500 w-48"
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
                                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                                    title="Save rename"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntryId(null)}
                                    className="p-1 rounded border border-stone-200 bg-white text-stone-500 hover:text-stone-800 cursor-pointer"
                                    title="Cancel rename"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span>{entry.label}</span>
                                  {entry.isCustom && (
                                    <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                      Custom
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${dimBadge}`}
                              >
                                {entry.dimension}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-stone-600">{entry.fieldLabel}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-700 font-semibold">
                              Used in {entry.usageCount}
                            </td>
                            <td className="py-2.5 px-3.5 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEntryId(entry.id);
                                    setRenameDraft(entry.label);
                                  }}
                                  className="p-1.5 rounded-lg text-stone-500 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                                  title="Rename across all decoded interviews"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeletingEntry(entry);
                                    setDeleteMode('null');
                                    setReassignTarget('');
                                  }}
                                  className="p-1.5 rounded-lg text-stone-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                  title="Safely remove or reassign"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Parent ADKOTM Dimension
                  </label>
                  <select
                    value={newDimension}
                    onChange={(e) =>
                      handleDimensionForCreateChange(e.target.value as ADKOTMDimensionKey)
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {DIM_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Definition Kind
                  </label>
                  <select
                    value={newKind}
                    onChange={(e) => setNewKind(e.target.value as 'category' | 'parameter')}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="category">Category / Code inside Existing Field</option>
                    <option value="parameter">New Custom Parameter (e.g. Health Triggers [HT])</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 mb-1">
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Short Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={newShortCode}
                    onChange={(e) => setNewShortCode(e.target.value)}
                    placeholder="e.g. HT"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              {newKind === 'category' ? (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Target ADKOTM Field
                  </label>
                  <select
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Initial Tag Value for Selected Interviews
                  </label>
                  <input
                    type="text"
                    value={newAssignValue}
                    onChange={(e) => setNewAssignValue(e.target.value)}
                    placeholder="Optional default code value (defaults to parameter name)"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Optional Immediate Assignment to Decoded Records */}
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-800">
                    Tag Decoded Interviews Now (Optional)
                  </span>
                  <span className="font-mono text-[11px] text-stone-500 tabular-nums">
                    {selectedAssignRecordIds.length} selected
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {allDecodedRecords.map((rec) => {
                    const checked = selectedAssignRecordIds.includes(rec.id);
                    return (
                      <label
                        key={rec.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                          checked
                            ? 'bg-amber-50 border-amber-300 text-amber-950 font-semibold'
                            : 'bg-white border-stone-200 text-stone-700'
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
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
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
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Dimension Scope
                  </label>
                  <select
                    value={mergeDimension}
                    onChange={(e) => {
                      setMergeDimension(e.target.value as ADKOTMDimensionKey);
                      setMergeFieldKey('ALL');
                      setMergeSelectedLabels([]);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {DIM_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Field Parameter Filter
                  </label>
                  <select
                    value={mergeFieldKey}
                    onChange={(e) => {
                      setMergeFieldKey(e.target.value);
                      setMergeSelectedLabels([]);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-800">
                    1. Select 2 or more fragmented codes to consolidate
                  </span>
                  <span className="font-mono text-[11px] text-stone-500 tabular-nums">
                    {mergeSelectedLabels.length} selected
                  </span>
                </div>

                {mergeCandidates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">
                    No coded items found in this dimension filter.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl border border-stone-200 bg-stone-50/60">
                    {mergeCandidates.map((cand) => {
                      const checked = mergeSelectedLabels.includes(cand.label);
                      return (
                        <label
                          key={cand.id}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer ${
                            checked
                              ? 'bg-amber-50 border-amber-300 text-amber-950 font-semibold'
                              : 'bg-white border-stone-200 text-stone-700'
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
                          <span className="font-mono text-[11px] text-stone-500 tabular-nums shrink-0">
                            {cand.usageCount} int
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  2. Canonical Target Label (Original verbatim quotes will be preserved)
                </label>
                <input
                  type="text"
                  required
                  value={mergeTargetLabel}
                  onChange={(e) => setMergeTargetLabel(e.target.value)}
                  placeholder="e.g. Probiotic Drinks"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mergeSelectedLabels.length < 2 || !mergeTargetLabel.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer disabled:opacity-40"
                >
                  <GitMerge className="w-3.5 h-3.5" />
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
