import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Trash2,
  Plus,
  Sparkles,
  FileText,
  DollarSign,
  Tag,
  MapPin,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { InterviewRecord, ADKOTMDecode, SpendingPowerAnalysis } from '../types';
import { ensureFieldStates } from '../lib/adkotmCopilot';

interface DecodeCrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordToEdit?: InterviewRecord | null;
  onSaveRecord: (record: InterviewRecord) => void;
  onDeleteRecord?: (id: string) => void;
  existingFolders?: string[];
}

export const DecodeCrudModal: React.FC<DecodeCrudModalProps> = ({
  isOpen,
  onClose,
  recordToEdit,
  onSaveRecord,
  onDeleteRecord,
  existingFolders = ['10/26', 'General Recordings'],
}) => {
  const isEditing = !!recordToEdit;

  // Basic Info
  const [fileName, setFileName] = useState('');
  const [folderName, setFolderName] = useState('10/26');
  const [sessionLocation, setSessionLocation] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [cleanedTranscriptText, setCleanedTranscriptText] = useState('');

  // Demographic Divided Dimensions
  const [codeFR, setCodeFR] = useState('Mum');
  const [codeRL, setCodeRL] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Female');
  const [educationLevel, setEducationLevel] = useState('');

  // Codes AW, PP, PP1, IL
  const [codeAW, setCodeAW] = useState('');
  const [codePP, setCodePP] = useState('');
  const [codePP1, setCodePP1] = useState('');
  const [codeIL, setCodeIL] = useState('');

  // Spending Power Cross-Analysis
  const [spendingTier, setSpendingTier] = useState<'High' | 'Medium-High' | 'Medium' | 'Low' | 'null'>('Medium');
  const [spendingJustification, setSpendingJustification] = useState('');

  // Deep ADKOTM dimensions (optional expand)
  const [showDeepDimensions, setShowDeepDimensions] = useState(false);
  const [dailyRoutine, setDailyRoutine] = useState('');
  const [shoppingBehaviour, setShoppingBehaviour] = useState('');
  const [foodConsumption, setFoodConsumption] = useState('');
  const [foodPrep, setFoodPrep] = useState('');
  const [eatingContext, setEatingContext] = useState('');
  const [householdComposition, setHouseholdComposition] = useState('');
  const [purchaseFrequency, setPurchaseFrequency] = useState('');
  const [consumptionFrequency, setConsumptionFrequency] = useState('');
  const [purchaseOccasion, setPurchaseOccasion] = useState('');

  // Evidence Quotes
  const [quotes, setQuotes] = useState<{ code: string; quote: string }[]>([]);
  const [newQuoteCode, setNewQuoteCode] = useState('FR');
  const [newQuoteText, setNewQuoteText] = useState('');

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (recordToEdit) {
      setFileName(recordToEdit.fileName || '');
      setFolderName(recordToEdit.folderName || '10/26');
      setSessionLocation(recordToEdit.sessionLocation || '');
      setTranscriptText(recordToEdit.transcript || '');
      setCleanedTranscriptText(recordToEdit.cleanedTranscript || '');

      const d = recordToEdit.adkotmDecode;
      const p = d?.postAnalysisCodes;
      const sp = recordToEdit.spendingPower;

      setCodeFR(p?.FR || d?.demographic?.familyRole || 'Mum');
      setCodeRL(p?.RL || d?.demographic?.residentialLocation || '');
      setAge(d?.demographic?.age || '');
      setGender(d?.demographic?.gender || 'Female');
      setEducationLevel(d?.demographic?.educationLevel || '');
      setCodeAW(p?.AW || d?.knowledge?.awarenessOnGutHealth || '');
      setCodePP(p?.PP || d?.objects?.productsPurchased || '');
      setCodePP1(p?.PP1 || d?.objects?.brandPreferences || '');
      setCodeIL(p?.IL || recordToEdit.sessionLocation || '');

      setSpendingTier(sp?.spendingPowerTier || 'null');
      setSpendingJustification(sp?.justification || '');

      setDailyRoutine(d?.activities?.dailyRoutine || '');
      setShoppingBehaviour(d?.activities?.shoppingBehaviour || '');
      setFoodConsumption(d?.activities?.foodConsumptionBehaviour || '');
      setFoodPrep(d?.activities?.foodPreparation || '');
      setEatingContext(d?.activities?.eatingContext || '');
      setHouseholdComposition(d?.demographic?.householdComposition || '');
      setPurchaseFrequency(d?.time?.purchaseFrequency || '');
      setConsumptionFrequency(d?.time?.consumptionFrequency || '');
      setPurchaseOccasion(d?.time?.purchaseOccasion || '');

      setQuotes(d?.evidenceQuotes ? d.evidenceQuotes.map((q) => ({ code: q.code, quote: q.quote })) : []);
    } else {
      // New record defaults
      setFileName(`Interview Respondent ${Date.now().toString().slice(-4)}`);
      setFolderName(existingFolders[0] || '10/26');
      setSessionLocation('Brem Mall Kepong, Publika');
      setTranscriptText('');
      setCleanedTranscriptText('');
      setCodeFR('Mum');
      setCodeRL('Kepong');
      setAge('32');
      setGender('Female');
      setEducationLevel("Bachelor's Degree");
      setCodeAW('Probiotics awareness for digestion');
      setCodePP('Probiotic drinks, yogurt');
      setCodePP1('Yakult');
      setCodeIL('Brem Mall Kepong NSK');
      setSpendingTier('Medium');
      setSpendingJustification('Kepong resident; regular consumer of probiotic drinks at NSK hypermarket.');
      setQuotes([]);
    }
    setConfirmDelete(false);
  }, [recordToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddQuote = () => {
    if (!newQuoteText.trim()) return;
    setQuotes((prev) => [...prev, { code: newQuoteCode, quote: newQuoteText.trim() }]);
    setNewQuoteText('');
  };

  const handleRemoveQuote = (idx: number) => {
    setQuotes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalFR = codeFR.trim() || null;
    const finalRL = codeRL.trim() || null;
    const finalAW = codeAW.trim() || null;
    const finalPP = codePP.trim() || null;
    const finalPP1 = codePP1.trim() || null;
    const finalIL = codeIL.trim() || sessionLocation.trim() || null;
    const finalTier = spendingTier === 'null' ? null : spendingTier;

    const decodeObj: ADKOTMDecode = {
      activities: {
        dailyRoutine: dailyRoutine.trim() || null,
        shoppingBehaviour: shoppingBehaviour.trim() || null,
        foodConsumptionBehaviour: foodConsumption.trim() || null,
        foodPreparation: foodPrep.trim() || null,
        eatingContext: eatingContext.trim() || null,
      },
      demographic: {
        gender: gender.trim() || null,
        age: age.trim() || null,
        residentialLocation: finalRL,
        residentialDistrict: finalRL,
        educationLevel: educationLevel.trim() || null,
        householdComposition: householdComposition.trim() || null,
        familyRole: finalFR,
      },
      knowledge: {
        awarenessOnGutHealth: finalAW,
        awarenessLevel: recordToEdit?.adkotmDecode?.knowledge?.awarenessLevel || (finalAW ? 'Aware' : null),
        understandingSummary: recordToEdit?.adkotmDecode?.knowledge?.understandingSummary || finalAW,
      },
      objects: {
        productsPurchased: finalPP,
        supplementProducts: recordToEdit?.adkotmDecode?.objects?.supplementProducts || null,
        foodProducts: recordToEdit?.adkotmDecode?.objects?.foodProducts || null,
        actionsToSolve: recordToEdit?.adkotmDecode?.objects?.actionsToSolve || null,
        productCategory: finalPP,
        brandPreferences: finalPP1,
        productPreference: finalPP1,
      },
      time: {
        purchaseFrequency: purchaseFrequency.trim() || null,
        consumptionFrequency: consumptionFrequency.trim() || null,
        purchaseTiming: null,
        purchaseOccasion: purchaseOccasion.trim() || null,
        consumptionTiming: null,
      },
      metadata: {
        interviewTime: null,
        interviewLocation: finalIL,
      },
      postAnalysisCodes: {
        FR: finalFR,
        RL: finalRL,
        AW: finalAW,
        PP: finalPP,
        PP1: finalPP1,
        IL: finalIL,
      },
      evidenceQuotes: quotes.map((q) => ({
        code: q.code,
        field: q.code,
        quote: q.quote,
      })),
      decodedAt: new Date().toISOString(),
    };
    decodeObj.fieldStates = ensureFieldStates(decodeObj, 'MANUAL');

    const spendingObj: SpendingPowerAnalysis = {
      recordId: recordToEdit?.id || 'manual_' + Date.now(),
      fileName: fileName.trim(),
      spendingPowerTier: finalTier,
      components: {
        D_demographic: finalFR ? `Family Role: ${finalFR}` : null,
        O_objects: finalPP1 ? `Brand: ${finalPP1}` : null,
        T_time: purchaseFrequency ? `Frequency: ${purchaseFrequency}` : null,
        M_metadata: finalIL ? `Venue: ${finalIL}` : null,
        RL_residentialLocation: finalRL,
        PP_productsPurchased: finalPP,
        PP1_brandPreferences: finalPP1,
        IL_interviewLocation: finalIL,
      },
      justification: spendingJustification.trim() || (finalTier ? `${finalTier} tier cross-analysis` : null),
    };

    const wordCount = transcriptText.trim() ? transcriptText.trim().split(/\s+/).length : 0;

    const newRecord: InterviewRecord = {
      id: recordToEdit?.id || 'record_manual_' + Date.now(),
      fileName: fileName.trim(),
      fileType: 'text',
      mimeType: 'text/plain',
      source: recordToEdit?.source || 'pasted_text',
      uploadedAt: recordToEdit?.uploadedAt || Date.now(),
      status: 'completed',
      transcript: transcriptText.trim() || undefined,
      cleanedTranscript: cleanedTranscriptText.trim() || transcriptText.trim() || undefined,
      wordCount,
      folderName: folderName.trim() || 'General Recordings',
      sessionDate: folderName.trim() || 'General Recordings',
      sessionLocation: finalIL || sessionLocation.trim() || undefined,
      decodeStatus: 'decoded',
      reviewStatus: 'human_verified',
      verifiedAt: new Date().toISOString(),
      adkotmDecode: decodeObj,
      spendingPower: spendingObj,
    };

    onSaveRecord(newRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-3xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-stone-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {isEditing ? 'EDIT' : 'NEW'}
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                {isEditing ? `Edit Decode: ${recordToEdit?.fileName}` : 'Create New Interview Decode'}
              </h3>
              <p className="text-xs text-stone-500">
                Full CRUD control: modify ADKOTM codes, spending power tier, and respondent verbatim.
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
          {/* Section 1: Basic Identifiers */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              1. Respondent & Session Hierarchy
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Participant / File Name *
                </label>
                <input
                  type="text"
                  required
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g. Brem Mall Kepong NSK 10/26.m4a or Participant 04"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Session Folder (Date)
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g. 10/26"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Demographic & Post-Analysis Codes */}
          <div className="space-y-4 pt-2 border-t border-stone-100">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  2. Demographic Sub-dimensions [Code D] (Divided)
                </span>
                <span className="text-[10px] text-stone-400">Divided into distinct empirical fields</span>
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Family role, residential location, age, gender, and education are strictly separated.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs bg-amber-50/40 p-3.5 rounded-2xl border border-amber-200/60">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  FR: Family Role (Demographic)
                </label>
                <select
                  value={codeFR}
                  onChange={(e) => setCodeFR(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="Mum">Mum</option>
                  <option value="Dad">Dad</option>
                  <option value="Elderly">Elderly</option>
                  <option value="Young Adult">Young Adult</option>
                  <option value="Single">Single</option>
                  <option value="">null (unstated)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  RL: Residential Location (Demographic)
                </label>
                <input
                  type="text"
                  value={codeRL}
                  onChange={(e) => setCodeRL(e.target.value)}
                  placeholder="e.g. Kepong, Ampang, Petaling Jaya"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Age (Demographic)
                </label>
                <input
                  type="text"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 32, 25-34, 68"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Gender (Pronoun Preserved)
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="Female">Female (she/her/Mum)</option>
                  <option value="Male">Male (he/him/Dad)</option>
                  <option value="">null (unstated)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Education Level (Demographic)
                </label>
                <input
                  type="text"
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  placeholder="e.g. Secondary / SPM, Diploma, Bachelor's Degree"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div className="pt-2">
              <span className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                Behavioral, Knowledge & Venue Codes (AW, PP, PP1, IL)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    AW: Gut Health Awareness (Code K)
                  </label>
                  <input
                    type="text"
                    value={codeAW}
                    onChange={(e) => setCodeAW(e.target.value)}
                    placeholder="e.g. Probiotics & gut immunity"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    PP: Products Category (Code O)
                  </label>
                  <input
                    type="text"
                    value={codePP}
                    onChange={(e) => setCodePP(e.target.value)}
                    placeholder="e.g. goat milk formula, yogurt"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    PP1: Brand Preferences (Code O)
                  </label>
                  <input
                    type="text"
                    value={codePP1}
                    onChange={(e) => setCodePP1(e.target.value)}
                    placeholder="e.g. Yakult, Vitagen, Karihome"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    IL: Interview Location (Code M)
                  </label>
                  <input
                    type="text"
                    value={codeIL}
                    onChange={(e) => setCodeIL(e.target.value)}
                    placeholder="e.g. Brem Mall Kepong NSK"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Spending Power Cross-Analysis */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <span className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              3. Cross-Analysis: Spending Power (D + O + T + M)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Spending Power Tier
                </label>
                <select
                  value={spendingTier}
                  onChange={(e) => setSpendingTier(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="High">High Tier</option>
                  <option value="Medium-High">Medium-High Tier</option>
                  <option value="Medium">Medium Tier</option>
                  <option value="Low">Low Tier</option>
                  <option value="null">null (Insufficient signals)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Qualitative Justification / Field Rationale
                </label>
                <input
                  type="text"
                  value={spendingJustification}
                  onChange={(e) => setSpendingJustification(e.target.value)}
                  placeholder="e.g. Resident in Kepong, buys Yakult regular, bulk hypermarket shopping at NSK"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Evidence Quotes */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <span className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              4. Evidence Quotes from Verbatim
            </span>

            <div className="flex gap-2">
              <select
                value={newQuoteCode}
                onChange={(e) => setNewQuoteCode(e.target.value)}
                className="w-24 px-2 py-1.5 text-xs rounded-xl border border-stone-300 bg-white shrink-0"
              >
                <option value="FR">FR (Role)</option>
                <option value="RL">RL (Res)</option>
                <option value="AW">AW (Gut)</option>
                <option value="PP">PP (Prod)</option>
                <option value="PP1">PP1 (Brand)</option>
                <option value="IL">IL (Venue)</option>
              </select>
              <input
                type="text"
                value={newQuoteText}
                onChange={(e) => setNewQuoteText(e.target.value)}
                placeholder="Paste verbatim quote here..."
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-300"
              />
              <button
                type="button"
                onClick={handleAddQuote}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {quotes.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {quotes.map((q, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-stone-50 border border-stone-200"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800">
                        {q.code}
                      </span>
                      <span className="italic text-stone-700 truncate">"{q.quote}"</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuote(idx)}
                      className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Deep ADKOTM Dimensions (Collapsible) */}
          <div className="pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setShowDeepDimensions(!showDeepDimensions)}
              className="flex items-center justify-between w-full py-1 text-xs font-bold text-stone-700 hover:text-stone-900 cursor-pointer"
            >
              <span>5. Advanced ADKOTM Taxonomy Details (A, D, O, T)</span>
              {showDeepDimensions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showDeepDimensions && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-stone-600 mb-0.5">
                    A: Daily Routine
                  </label>
                  <input
                    type="text"
                    value={dailyRoutine}
                    onChange={(e) => setDailyRoutine(e.target.value)}
                    placeholder="e.g. Working mum morning prep"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-600 mb-0.5">
                    A: Shopping Behaviour
                  </label>
                  <input
                    type="text"
                    value={shoppingBehaviour}
                    onChange={(e) => setShoppingBehaviour(e.target.value)}
                    placeholder="e.g. Weekend grocery trip with children"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-600 mb-0.5">
                    T: Purchase Frequency
                  </label>
                  <input
                    type="text"
                    value={purchaseFrequency}
                    onChange={(e) => setPurchaseFrequency(e.target.value)}
                    placeholder="e.g. Weekly or Bi-weekly"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-600 mb-0.5">
                    T: Consumption Frequency
                  </label>
                  <input
                    type="text"
                    value={consumptionFrequency}
                    onChange={(e) => setConsumptionFrequency(e.target.value)}
                    placeholder="e.g. Once daily after meals"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 6: Verbatim Transcript Text */}
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <span className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-stone-500" />
              6. Verbatim / Field Notes
            </span>
            <textarea
              rows={3}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Paste raw recording verbatim or researcher notes..."
              className="w-full p-2.5 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
            <div>
              {isEditing && onDeleteRecord && (
                confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-600 font-bold">Confirm delete?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteRecord(recordToEdit.id);
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Record
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {isEditing ? 'Save Changes' : 'Create Record'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
