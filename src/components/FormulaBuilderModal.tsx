import React, { useState, useEffect } from 'react';
import { X, Check, Sparkles, Plus, Trash2, HelpCircle, Layers, Sliders } from 'lucide-react';
import { CrossAnalysisFormula } from '../types';

interface FormulaBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  formulaToEdit?: CrossAnalysisFormula | null;
  onSaveFormula: (formula: CrossAnalysisFormula) => void;
}

const TEMPLATES: Omit<CrossAnalysisFormula, 'id'>[] = [
  {
    name: 'Spending Power Analysis',
    code: 'D + O + T + M',
    analysisCodes: 'RL + PP + IL',
    dimensions: ['D', 'O', 'T', 'M'],
    description: 'Empirical cross-analysis linking Residential Location (RL), Products (PP), Brands (PP1), and Venue (IL) to determine consumer purchasing power.',
    outputTiers: ['High', 'Medium-High', 'Medium', 'Low'],
    evaluationRules: 'Evaluate neighborhood affluence (RL), product & brand premium selection (PP/PP1), and interview venue tier (IL).',
    isCustom: false,
  },
  {
    name: 'Gut Health Proactiveness Index',
    code: 'K + O + A',
    analysisCodes: 'AW + PP + Routine',
    dimensions: ['K', 'O', 'A'],
    description: 'Evaluates respondent proactiveness toward digestive health by linking Gut Knowledge (AW), Probiotic Purchases (PP), and Daily Dietary Habits (A).',
    outputTiers: ['Proactive Leader', 'Moderate Aware', 'Reactive / Low Awareness'],
    evaluationRules: 'Classify as Proactive if aware of probiotics/immunity and routines daily intake; Moderate if aware but irregular; Reactive if purchases only when ill.',
    isCustom: true,
  },
  {
    name: 'Brand Loyalty vs Price Sensitivity',
    code: 'O + T + M',
    analysisCodes: 'PP1 + Frequency + IL',
    dimensions: ['O', 'T', 'M'],
    description: 'Evaluates brand loyalty versus bulk discount sensitivity by cross-referencing brand preference (PP1), purchase timing (T), and shopping venue (IL).',
    outputTiers: ['Brand Loyal', 'Value-Conscious / Hybrid', 'Price Sensitive Deal-Seeker'],
    evaluationRules: 'Classify as Brand Loyal if strictly seeks designated brand (e.g. Yakult/Karihome); Price Sensitive if shopping venue is wholesale hypermarket without specific brand commitment.',
    isCustom: true,
  },
  {
    name: 'Caregiver Nutritional Burden',
    code: 'D + A + O',
    analysisCodes: 'FR + FoodPrep + PP',
    dimensions: ['D', 'A', 'O'],
    description: 'Assesses household nutritional preparation burden across family role (FR: Mums vs Elderly), food prep time (A), and children/elderly specialty products (PP).',
    outputTiers: ['High Caregiver Burden', 'Shared Responsibility', 'Independent Consumer'],
    evaluationRules: 'Classify as High if Mum or Dad actively managing dietary preparation for children or elderly family dependents.',
    isCustom: true,
  },
];

const AVAILABLE_DIMENSIONS: { id: 'A' | 'D' | 'K' | 'O' | 'T' | 'M'; label: string; desc: string }[] = [
  { id: 'A', label: 'Activities', desc: 'Daily routine, shopping behaviour, food prep, context' },
  { id: 'D', label: 'Demographic', desc: 'FR (Family role), RL (Residential location), household' },
  { id: 'K', label: 'Knowledge', desc: 'AW (Awareness & understanding on gut health)' },
  { id: 'O', label: 'Objects', desc: 'PP (Products purchased), PP1 (Brand preferences)' },
  { id: 'T', label: 'Time', desc: 'Purchase frequency, consumption timing, occasions' },
  { id: 'M', label: 'Meta-data', desc: 'IL (Interview location/venue), interview timing' },
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
  const [dimensions, setDimensions] = useState<('A' | 'D' | 'K' | 'O' | 'T' | 'M')[]>(['D', 'O', 'T', 'M']);
  const [tiersInput, setTiersInput] = useState('High, Medium-High, Medium, Low');
  const [evaluationRules, setEvaluationRules] = useState('');

  useEffect(() => {
    if (formulaToEdit) {
      setName(formulaToEdit.name);
      setCode(formulaToEdit.code);
      setAnalysisCodes(formulaToEdit.analysisCodes);
      setDescription(formulaToEdit.description);
      setDimensions(formulaToEdit.dimensions || ['D', 'O', 'T', 'M']);
      setTiersInput(formulaToEdit.outputTiers.join(', '));
      setEvaluationRules(formulaToEdit.evaluationRules || '');
    } else {
      setName('');
      setCode('K + O + A');
      setAnalysisCodes('AW + PP + Prep');
      setDescription('Custom cross-analysis linking qualitative dimensions to evaluate respondent behaviour.');
      setDimensions(['K', 'O', 'A']);
      setTiersInput('High, Medium, Low');
      setEvaluationRules('');
    }
  }, [formulaToEdit, isOpen]);

  if (!isOpen) return null;

  const handleApplyTemplate = (tmpl: Omit<CrossAnalysisFormula, 'id'>) => {
    setName(tmpl.name);
    setCode(tmpl.code);
    setAnalysisCodes(tmpl.analysisCodes);
    setDescription(tmpl.description);
    setDimensions(tmpl.dimensions);
    setTiersInput(tmpl.outputTiers.join(', '));
    setEvaluationRules(tmpl.evaluationRules || '');
  };

  const toggleDimension = (dim: 'A' | 'D' | 'K' | 'O' | 'T' | 'M') => {
    if (dimensions.includes(dim)) {
      if (dimensions.length === 1) return; // Keep at least one
      setDimensions(dimensions.filter((d) => d !== dim));
    } else {
      setDimensions([...dimensions, dim]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tiers = tiersInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const savedFormula: CrossAnalysisFormula = {
      id: formulaToEdit?.id || `formula_${Date.now()}`,
      name: name.trim(),
      code: code.trim() || dimensions.join(' + '),
      analysisCodes: analysisCodes.trim() || 'Custom Signals',
      dimensions,
      description: description.trim(),
      outputTiers: tiers.length > 0 ? tiers : ['High', 'Medium', 'Low'],
      evaluationRules: evaluationRules.trim() || undefined,
      isCustom: formulaToEdit ? formulaToEdit.isCustom : true,
    };

    onSaveFormula(savedFormula);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-stone-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                {isEditing ? `Edit Formula: ${formulaToEdit?.name}` : 'Add Cross-Analysis Formula'}
              </h3>
              <p className="text-xs text-stone-500">
                Define custom predictive formulas combining ADKOTM dimensions for future qualitative analytics.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Quick Templates */}
          {!isEditing && (
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-2">
                Quick Qualitative Research Templates
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-white hover:bg-indigo-50 border border-stone-200 hover:border-indigo-300 text-stone-700 hover:text-indigo-800 font-medium cursor-pointer transition-all shadow-2xs"
                  >
                    {tmpl.name} <span className="text-[10px] text-stone-400 font-mono">({tmpl.code})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Formula Name & Expression */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Analysis Model Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Gut Health Proactiveness"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Formula Expression (High-Level Codes) *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. K + O + A or D + O + T + M"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Analysis Codes & Dimensions Selector */}
          <div className="space-y-2 text-xs">
            <label className="block text-[11px] font-semibold text-stone-700">
              ADKOTM Dimensions Included in Formula *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AVAILABLE_DIMENSIONS.map((dim) => {
                const isSelected = dimensions.includes(dim.id);
                return (
                  <button
                    key={dim.id}
                    type="button"
                    onClick={() => toggleDimension(dim.id)}
                    className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-400/30'
                        : 'bg-white border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs font-mono text-stone-900">
                        [{dim.id}] {dim.label}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                    <p className="text-[10px] text-stone-500 mt-0.5 line-clamp-1">{dim.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Sub-Analysis Codes
              </label>
              <input
                type="text"
                value={analysisCodes}
                onChange={(e) => setAnalysisCodes(e.target.value)}
                placeholder="e.g. AW + PP + Prep or RL + PP + IL"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Output Tiers / Classes (Comma Separated) *
              </label>
              <input
                type="text"
                required
                value={tiersInput}
                onChange={(e) => setTiersInput(e.target.value)}
                placeholder="e.g. High, Medium-High, Medium, Low"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Description & Research Intent */}
          <div className="text-xs">
            <label className="block text-[11px] font-semibold text-stone-700 mb-1">
              Methodology & Analytical Objective
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this cross-analysis evaluates..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Qualitative Evaluation Rules / Guidelines */}
          <div className="text-xs">
            <label className="block text-[11px] font-semibold text-stone-700 mb-1">
              Qualitative Classification Criteria & Evaluation Rules
            </label>
            <textarea
              rows={3}
              value={evaluationRules}
              onChange={(e) => setEvaluationRules(e.target.value)}
              placeholder="Specify the criteria used to classify participants into the tiers based on verbatim evidence..."
              className="w-full p-2.5 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {isEditing ? 'Save Changes' : 'Create & Apply Formula'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
