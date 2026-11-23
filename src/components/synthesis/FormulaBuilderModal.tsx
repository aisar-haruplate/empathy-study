import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Sliders } from 'lucide-react';
import type { ADKOTMDimensionKey, CrossAnalysisFormula } from '../../types';
import {
  DEFAULT_CROSS_ANALYSIS_FORMULAS,
  normalizeFormulaWeights,
  resolveTierThresholds,
} from '../../domain/adkotm';

interface FormulaBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  formulaToEdit?: CrossAnalysisFormula | null;
  onSaveFormula: (formula: CrossAnalysisFormula) => void;
}

const TEMPLATES: Omit<CrossAnalysisFormula, 'id'>[] = [
  ...DEFAULT_CROSS_ANALYSIS_FORMULAS.map(({ id: _id, ...rest }) => rest),
  {
    name: 'Caregiver Nutritional Burden',
    code: 'D + A + O',
    analysisCodes: 'FR + FoodPrep + PP',
    dimensions: ['D', 'A', 'O'],
    description:
      'Assesses household nutritional preparation burden across family role (FR: Mums vs Elderly), food prep routines (A), and specialty products (PP).',
    outputTiers: ['High Caregiver Burden', 'Shared Responsibility', 'Independent Consumer'],
    weights: { D: 35, A: 35, O: 30 },
    tierThresholds: [72, 46, 0],
    evaluationRules:
      'Classify as High if Mum/Parent actively manages dietary preparation and specialty purchases; Shared if moderate; Independent if self-only.',
    isCustom: true,
  },
];

const AVAILABLE_DIMENSIONS: { id: ADKOTMDimensionKey; label: string; desc: string }[] = [
  { id: 'A', label: 'Activities', desc: 'Daily routine, shopping behaviour, food prep' },
  { id: 'D', label: 'Demographics', desc: 'FR (Family role), RL (Residential location)' },
  { id: 'K', label: 'Knowledge', desc: 'AW (Awareness & understanding on gut health)' },
  { id: 'O', label: 'Objects', desc: 'PP (Products purchased), PP1 (Brand preferences)' },
  { id: 'T', label: 'Time', desc: 'Purchase frequency, consumption timing, occasions' },
  { id: 'M', label: 'Metadata', desc: 'IL (Interview venue/location), session timing' },
];

export const FormulaBuilderModal: React.FC<FormulaBuilderModalProps> = ({
  isOpen,
  onClose,
  formulaToEdit,
  onSaveFormula,
}) => {
  const isEditing = !!formulaToEdit;

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [analysisCodes, setAnalysisCodes] = useState('');
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState<ADKOTMDimensionKey[]>(['D', 'O', 'T', 'M']);
  const [rawWeights, setRawWeights] = useState<Partial<Record<ADKOTMDimensionKey, number>>>({
    D: 25,
    O: 30,
    T: 15,
    M: 30,
  });
  const [tiersInput, setTiersInput] = useState('High, Medium-High, Medium, Low');
  const [thresholds, setThresholds] = useState<number[]>([78, 60, 42, 0]);
  const [evaluationRules, setEvaluationRules] = useState('');

  const parsedTiers = useMemo(() => {
    const list = tiersInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    return list.length > 0 ? list : ['High', 'Medium', 'Low'];
  }, [tiersInput]);

  useEffect(() => {
    if (!isOpen) return;
    if (formulaToEdit) {
      setName(formulaToEdit.name);
      setCode(formulaToEdit.code);
      setAnalysisCodes(formulaToEdit.analysisCodes);
      setDescription(formulaToEdit.description);
      const dims = formulaToEdit.dimensions?.length ? formulaToEdit.dimensions : (['D', 'O', 'T', 'M'] as ADKOTMDimensionKey[]);
      setDimensions(dims);
      setRawWeights(normalizeFormulaWeights(formulaToEdit));
      setTiersInput(formulaToEdit.outputTiers.join(', '));
      setThresholds(resolveTierThresholds(formulaToEdit));
      setEvaluationRules(formulaToEdit.evaluationRules || '');
    } else {
      setName('');
      setCode('K + O + A');
      setAnalysisCodes('AW + PP + Routine');
      setDescription('Custom cross-analysis linking verified ADKOTM dimensions to score respondent behaviour.');
      setDimensions(['K', 'O', 'A']);
      setRawWeights({ K: 40, O: 35, A: 25 });
      setTiersInput('High, Medium, Low');
      setThresholds([72, 46, 0]);
      setEvaluationRules('');
    }
  }, [formulaToEdit, isOpen]);

  // Keep threshold array aligned whenever tier count changes
  useEffect(() => {
    setThresholds((prev) => {
      if (prev.length === parsedTiers.length) return prev;
      return resolveTierThresholds({
        id: 'draft',
        name: 'draft',
        code: '',
        analysisCodes: '',
        dimensions,
        description: '',
        outputTiers: parsedTiers,
      });
    });
  }, [parsedTiers.length, dimensions]);

  const normalizedWeights = useMemo(
    () =>
      normalizeFormulaWeights({
        id: 'draft',
        name: name || 'draft',
        code,
        analysisCodes,
        dimensions,
        description,
        outputTiers: parsedTiers,
        weights: rawWeights,
      }),
    [name, code, analysisCodes, dimensions, description, parsedTiers, rawWeights]
  );

  if (!isOpen) return null;

  const handleApplyTemplate = (tmpl: Omit<CrossAnalysisFormula, 'id'>) => {
    setName(tmpl.name);
    setCode(tmpl.code);
    setAnalysisCodes(tmpl.analysisCodes);
    setDescription(tmpl.description);
    setDimensions(tmpl.dimensions);
    const draft: CrossAnalysisFormula = { id: 'tmpl', ...tmpl };
    setRawWeights(normalizeFormulaWeights(draft));
    setTiersInput(tmpl.outputTiers.join(', '));
    setThresholds(resolveTierThresholds(draft));
    setEvaluationRules(tmpl.evaluationRules || '');
  };

  const toggleDimension = (dim: ADKOTMDimensionKey) => {
    let nextDims: ADKOTMDimensionKey[];
    if (dimensions.includes(dim)) {
      if (dimensions.length === 1) return;
      nextDims = dimensions.filter((d) => d !== dim);
    } else {
      nextDims = [...dimensions, dim];
      setRawWeights((prev) => ({
        ...prev,
        [dim]: prev[dim] && prev[dim]! > 0 ? prev[dim] : 25,
      }));
    }
    setDimensions(nextDims);
    setCode(nextDims.join(' + '));
  };

  const handleWeightChange = (dim: ADKOTMDimensionKey, val: number) => {
    const safe = Math.max(5, Math.min(100, Number.isFinite(val) ? val : 10));
    setRawWeights((prev) => ({ ...prev, [dim]: safe }));
  };

  const handleThresholdChange = (idx: number, val: number) => {
    const safe = Math.max(0, Math.min(100, Number.isFinite(val) ? val : 0));
    setThresholds((prev) => prev.map((t, i) => (i === idx ? safe : t)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const activeWeights: Partial<Record<ADKOTMDimensionKey, number>> = {};
    for (const d of dimensions) {
      activeWeights[d] = normalizedWeights[d];
    }

    const savedFormula: CrossAnalysisFormula = {
      id: formulaToEdit?.id || `formula_${Date.now()}`,
      name: name.trim(),
      code: code.trim() || dimensions.join(' + '),
      analysisCodes: analysisCodes.trim() || 'Custom Signals',
      dimensions,
      description: description.trim(),
      outputTiers: parsedTiers,
      weights: activeWeights,
      tierThresholds: thresholds.map((t, idx) => (idx === parsedTiers.length - 1 ? 0 : t)),
      evaluationRules: evaluationRules.trim() || undefined,
      isCustom: formulaToEdit ? formulaToEdit.isCustom : true,
    };

    onSaveFormula(savedFormula);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2B3440]/20 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#FDFCF8] rounded-3xl border border-[#D4DFD9] shadow-studio w-full max-w-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto flex-1">
          {/* Sticky Frosted Header */}
          <div className="sticky top-0 z-10 px-6 py-4 border-b border-[#E2E6E4] bg-[#FDFCF8]/90 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-[#528BCA] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                <Sliders className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-heading text-base font-bold text-[#1B2420] tracking-[-0.01em] truncate">
                  {isEditing ? `Configure Formula: ${formulaToEdit?.name}` : 'Add Cross-Analysis Formula'}
                </h3>
                <p className="text-xs text-[#4F5E57]">
                  Select ADKOTM inputs, point weights (normalized to 100 pts), and tier cutoffs.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close formula builder modal"
              className="p-2 rounded-full text-[#4F5E57] hover:text-[#1B2420] hover:bg-[#E7ECE9] cursor-pointer transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Quick Templates */}
          {!isEditing && (
            <div className="p-4 bg-[#F2F5F3] rounded-2xl border border-[#E0E7E3]">
              <span className="font-heading text-xs font-bold uppercase tracking-wider text-[#4F5E57] block mb-2.5">
                Research Templates
              </span>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="px-3 py-1.5 text-xs rounded-full bg-[#FDFCF8] hover:bg-[#DCE8F7] border border-[#D4DFD9] hover:border-[#528BCA]/50 text-[#1B2420] hover:text-[#234B78] font-medium cursor-pointer transition-all"
                  >
                    {tmpl.name} <span className="text-[#4F5E57] font-mono">({tmpl.code})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Formula Name & Expression */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4F5E57] mb-1">
                Formula Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Gut Health Proactiveness"
                className="w-full px-3.5 py-2 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-[#1B2420] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 focus:border-[#528BCA] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4F5E57] mb-1">
                Formula Expression *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. D + O + T + M"
                className="w-full px-3.5 py-2 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-[#1B2420] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 focus:border-[#528BCA]"
              />
            </div>
          </div>

          {/* Active ADKOTM Dimensions */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#4F5E57]">
              Active ADKOTM Dimensions *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AVAILABLE_DIMENSIONS.map((dim) => {
                const isSelected = dimensions.includes(dim.id);
                return (
                  <button
                    key={dim.id}
                    type="button"
                    onClick={() => toggleDimension(dim.id)}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#DCE8F7] text-[#1B2420] border-[#528BCA] shadow-2xs'
                        : 'bg-[#FDFCF8] border-[#D4DFD9] text-[#1B2420] hover:bg-[#F2F5F3]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-heading font-bold text-xs font-mono text-[#1B2420]">
                        [{dim.id}] {dim.label}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#528BCA] shrink-0" />}
                    </div>
                    <p className="text-[11px] mt-1 line-clamp-1 text-[#4F5E57]">{dim.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Component Weights (normalized to 100 pts) */}
          <div className="p-4 rounded-2xl bg-[#F2F5F3] border border-[#E0E7E3] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#4F5E57]">
                Dimension Point Weights
              </span>
              <span className="text-xs font-mono font-semibold text-[#234B78] bg-[#DCE8F7] px-2.5 py-0.5 rounded-full">
                Total: 100 pts
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dimensions.map((dim) => {
                const meta = AVAILABLE_DIMENSIONS.find((d) => d.id === dim);
                const raw = rawWeights[dim] ?? 25;
                const norm = normalizedWeights[dim] ?? 0;
                return (
                  <div
                    key={dim}
                    className="p-2.5 rounded-xl bg-[#FDFCF8] border border-[#D4DFD9] flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1B2420]">
                        <span className="font-mono text-[#528BCA] mr-1">[{dim}]</span>
                        {meta?.label}
                      </span>
                      <span className="font-mono font-bold text-[#1B2420]">{norm} pts</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={80}
                      step={5}
                      value={raw}
                      onChange={(e) => handleWeightChange(dim, Number(e.target.value))}
                      className="w-full accent-[#528BCA] cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-Analysis Codes & Output Tiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4F5E57] mb-1">
                Sub-Analysis Codes
              </label>
              <input
                type="text"
                value={analysisCodes}
                onChange={(e) => setAnalysisCodes(e.target.value)}
                placeholder="e.g. RL + PP + PP1 + IL"
                className="w-full px-3.5 py-2 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-[#1B2420] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 focus:border-[#528BCA]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4F5E57] mb-1">
                Output Tiers (Highest → Lowest, comma separated) *
              </label>
              <input
                type="text"
                required
                value={tiersInput}
                onChange={(e) => setTiersInput(e.target.value)}
                placeholder="High, Medium-High, Medium, Low"
                className="w-full px-3.5 py-2 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-[#1B2420] text-sm focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 focus:border-[#528BCA]"
              />
            </div>
          </div>

          {/* Tier Thresholds */}
          <div className="p-4 rounded-2xl bg-[#F2F5F3] border border-[#E0E7E3] space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4F5E57] block">
              Minimum Score Thresholds (0–100 Scale)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {parsedTiers.map((tier, idx) => {
                const isLowest = idx === parsedTiers.length - 1;
                const val = isLowest ? 0 : thresholds[idx] ?? 0;
                return (
                  <div
                    key={`${tier}-${idx}`}
                    className="p-2.5 rounded-xl bg-[#FDFCF8] border border-[#D4DFD9]"
                  >
                    <label className="block text-[11px] font-semibold text-[#4F5E57] truncate mb-1" title={tier}>
                      {tier}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#4F5E57] font-mono">≥</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        disabled={isLowest}
                        value={val}
                        onChange={(e) => handleThresholdChange(idx, Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg border border-[#D4DFD9] bg-[#FDFCF8] text-xs font-mono font-bold text-[#1B2420] disabled:bg-[#E7ECE9] disabled:text-[#4F5E57]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Description & Rules */}
          <div>
            <label className="block text-xs font-semibold text-[#4F5E57] mb-1">
              Analytical Objective
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this cross-analysis evaluates..."
              className="w-full px-3.5 py-2 rounded-xl border border-[#D4DFD9] bg-[#FDFCF8] text-[#1B2420] text-sm focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 focus:border-[#528BCA]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4F5E57] mb-1">
              Classification Rules &amp; Notes
            </label>
            <textarea
              rows={2}
              value={evaluationRules}
              onChange={(e) => setEvaluationRules(e.target.value)}
              placeholder="Specify how signals map to tiers..."
              className="w-full p-3 text-sm rounded-2xl border border-[#D4DFD9] bg-[#FDFCF8] text-[#1B2420] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/25 focus:border-[#528BCA]"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#E0E7E3] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm font-semibold text-[#4F5E57] hover:bg-[#E7ECE9] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-sm font-semibold bg-[#528BCA] hover:bg-[#3F78B5] text-white shadow-2xs cursor-pointer transition-colors"
            >
              {isEditing ? 'Save Changes' : 'Create Formula'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};
