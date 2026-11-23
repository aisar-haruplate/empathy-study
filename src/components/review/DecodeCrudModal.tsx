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
import { InterviewRecord, ADKOTMDecode, SpendingPowerAnalysis } from '../../types';
import { ensureFieldStates } from '../../lib/adkotmCopilot';

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
    <div className="fixed inset-0 z-50 bg-[#292524]/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FFFFFF] rounded-3xl border border-[#EAE6DF] shadow-studio w-full max-w-3xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAE6DF] bg-[#F7F5F0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#292524] text-white flex items-center justify-center font-heading font-bold text-[13px] tracking-wide shadow-2xs shrink-0">
              {isEditing ? 'EDIT' : 'NEW'}
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-[#292524] tracking-[-0.02em]">
                {isEditing ? `Edit Decode: ${recordToEdit?.fileName}` : 'Create New Interview Decode'}
              </h3>
              <p className="text-base leading-[1.65] text-[#57534E]">
                Full CRUD control: modify ADKOTM codes, spending power tier, and respondent verbatim.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close decode modal"
            className="p-2 rounded-full text-[#78716C] hover:text-[#292524] hover:bg-[#EAE6DF]/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Section 1: Basic Identifiers */}
          <div className="space-y-3">
            <span className="font-heading text-base font-bold text-[#292524] tracking-[-0.01em] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#528BCA]" />
              1. Respondent &amp; Session Hierarchy
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-base">
              <div className="sm:col-span-2">
                <label className="block text-[13px] font-semibold text-[#57534E] mb-1">
                  Participant / File Name *
                </label>
                <input
                  type="text"
                  required
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g. Brem Mall Kepong NSK 10/26.m4a or Participant 04"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA] text-base"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#57534E] mb-1">
                  Session Folder (Date)
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g. 10/26"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA] text-base"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Demographic & Post-Analysis Codes */}
          <div className="space-y-4 pt-3 border-t border-[#EAE6DF]">
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-heading text-base font-bold text-[#292524] tracking-[-0.01em] flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#F3F5FD] text-[#33418A] border border-[#7C8CE0]/40 text-[13px] font-bold">
                    D
                  </span>
                  2. Demographic Sub-dimensions (Divided)
                </span>
                <span className="text-[13px] text-[#78716C]">Divided into distinct empirical fields</span>
              </div>
              <p className="text-base leading-[1.65] text-[#57534E] mt-1">
                Family role, residential location, age, gender, and education are strictly separated.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-base bg-[#F3F5FD]/60 p-4 rounded-2xl border border-[#7C8CE0]/30">
              <div>
                <label className="block text-[13px] font-semibold text-[#33418A] mb-1">
                  FR: Family Role (Demographic)
                </label>
                <select
                  value={codeFR}
                  onChange={(e) => setCodeFR(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
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
                <label className="block text-[13px] font-semibold text-[#33418A] mb-1">
                  RL: Residential Location (Demographic)
                </label>
                <input
                  type="text"
                  value={codeRL}
                  onChange={(e) => setCodeRL(e.target.value)}
                  placeholder="e.g. Kepong, Ampang, Petaling Jaya"
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#33418A] mb-1">
                  Age (Demographic)
                </label>
                <input
                  type="text"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 32, 25-34, 68"
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#33418A] mb-1">
                  Gender (Pronoun Preserved)
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                >
                  <option value="Female">Female (she/her/Mum)</option>
                  <option value="Male">Male (he/him/Dad)</option>
                  <option value="">null (unstated)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[13px] font-semibold text-[#33418A] mb-1">
                  Education Level (Demographic)
                </label>
                <input
                  type="text"
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  placeholder="e.g. Secondary / SPM, Diploma, Bachelor's Degree"
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                />
              </div>
            </div>

            <div className="pt-2">
              <span className="font-heading text-base font-bold text-[#292524] tracking-[-0.01em] flex items-center gap-1.5 mb-2.5">
                <Tag className="w-4 h-4 text-[#528BCA]" />
                Knowledge, Objects &amp; Venue Codes (AW, PP, PP1, IL)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-base">
                <div className="p-2.5 rounded-2xl bg-[#F2F7FC] border border-[#528BCA]/25">
                  <label className="block text-[13px] font-semibold text-[#234B78] mb-1">
                    AW: Gut Health [K]
                  </label>
                  <input
                    type="text"
                    value={codeAW}
                    onChange={(e) => setCodeAW(e.target.value)}
                    placeholder="e.g. Probiotics & gut immunity"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                  />
                </div>

                <div className="p-2.5 rounded-2xl bg-[#FEFBEB] border border-[#F7D147]/40">
                  <label className="block text-[13px] font-semibold text-[#6B5306] mb-1">
                    PP: Products [O]
                  </label>
                  <input
                    type="text"
                    value={codePP}
                    onChange={(e) => setCodePP(e.target.value)}
                    placeholder="e.g. goat milk formula, yogurt"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                  />
                </div>

                <div className="p-2.5 rounded-2xl bg-[#FEFBEB] border border-[#F7D147]/40">
                  <label className="block text-[13px] font-semibold text-[#6B5306] mb-1">
                    PP1: Brands [O]
                  </label>
                  <input
                    type="text"
                    value={codePP1}
                    onChange={(e) => setCodePP1(e.target.value)}
                    placeholder="e.g. Yakult, Vitagen, Karihome"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                  />
                </div>

                <div className="p-2.5 rounded-2xl bg-[#EEF4FB] border border-[#528BCA]/35">
                  <label className="block text-[13px] font-semibold text-[#7A3A36] mb-1">
                    IL: Venue [M]
                  </label>
                  <input
                    type="text"
                    value={codeIL}
                    onChange={(e) => setCodeIL(e.target.value)}
                    placeholder="e.g. Brem Mall Kepong NSK"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Spending Power Cross-Analysis */}
          <div className="space-y-3 pt-3 border-t border-[#EAE6DF]">
            <span className="font-heading text-base font-bold text-[#292524] tracking-[-0.01em] flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-[#2B7A67]" />
              3. Cross-Analysis: Spending Power (D + O + T + M)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-base">
              <div>
                <label className="block text-[13px] font-semibold text-[#57534E] mb-1">
                  Spending Power Tier
                </label>
                <select
                  value={spendingTier}
                  onChange={(e) => setSpendingTier(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] font-medium focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                >
                  <option value="High">High Tier</option>
                  <option value="Medium-High">Medium-High Tier</option>
                  <option value="Medium">Medium Tier</option>
                  <option value="Low">Low Tier</option>
                  <option value="null">null (Insufficient signals)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[13px] font-semibold text-[#57534E] mb-1">
                  Qualitative Justification / Field Rationale
                </label>
                <input
                  type="text"
                  value={spendingJustification}
                  onChange={(e) => setSpendingJustification(e.target.value)}
                  placeholder="e.g. Resident in Kepong, buys Yakult regular, bulk hypermarket shopping at NSK"
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Evidence Quotes */}
          <div className="space-y-3 pt-3 border-t border-[#EAE6DF]">
            <span className="font-heading text-base font-bold text-[#292524] tracking-[-0.01em] flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-[#528BCA]" />
              4. Evidence Quotes from Verbatim
            </span>

            <div className="flex gap-2">
              <select
                value={newQuoteCode}
                onChange={(e) => setNewQuoteCode(e.target.value)}
                className="w-36 px-2.5 py-2 text-base rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] shrink-0 focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
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
                className="flex-1 px-3 py-2 text-base rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
              />
              <button
                type="button"
                onClick={handleAddQuote}
                aria-label="Add evidence quote"
                className="px-3.5 py-2 bg-[#F7F5F0] hover:bg-[#EAE6DF] text-[#292524] border border-[#EAE6DF] rounded-full text-sm font-bold cursor-pointer shrink-0 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {quotes.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {quotes.map((q, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-base leading-[1.65] p-2.5 rounded-2xl bg-[#F7F5F0]/70 border border-[#EAE6DF]"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[13px] font-mono font-bold bg-[#F2F7FC] text-[#234B78] border border-[#528BCA]/30 shrink-0">
                        {q.code}
                      </span>
                      <span className="italic text-[#57534E] truncate">"{q.quote}"</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuote(idx)}
                      aria-label="Remove quote"
                      className="text-[#78716C] hover:text-[#D97A75] p-1 cursor-pointer transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Deep ADKOTM Dimensions (Collapsible) */}
          <div className="pt-3 border-t border-[#EAE6DF]">
            <button
              type="button"
              onClick={() => setShowDeepDimensions(!showDeepDimensions)}
              className="flex items-center justify-between w-full py-1 font-heading text-base font-bold text-[#57534E] hover:text-[#292524] cursor-pointer transition-colors"
            >
              <span>5. Advanced ADKOTM Taxonomy Details (A, D, O, T)</span>
              {showDeepDimensions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showDeepDimensions && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 p-3.5 bg-[#F7F5F0]/80 rounded-2xl border border-[#EAE6DF] text-base">
                <div>
                  <label className="block text-[13px] font-semibold text-[#1E4D42] mb-1">
                    A: Daily Routine
                  </label>
                  <input
                    type="text"
                    value={dailyRoutine}
                    onChange={(e) => setDailyRoutine(e.target.value)}
                    placeholder="e.g. Working mum morning prep"
                    className="w-full px-3 py-1.5 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#1E4D42] mb-1">
                    A: Shopping Behaviour
                  </label>
                  <input
                    type="text"
                    value={shoppingBehaviour}
                    onChange={(e) => setShoppingBehaviour(e.target.value)}
                    placeholder="e.g. Weekend grocery trip with children"
                    className="w-full px-3 py-1.5 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#7A3A36] mb-1">
                    T: Purchase Frequency
                  </label>
                  <input
                    type="text"
                    value={purchaseFrequency}
                    onChange={(e) => setPurchaseFrequency(e.target.value)}
                    placeholder="e.g. Weekly or Bi-weekly"
                    className="w-full px-3 py-1.5 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#7A3A36] mb-1">
                    T: Consumption Frequency
                  </label>
                  <input
                    type="text"
                    value={consumptionFrequency}
                    onChange={(e) => setConsumptionFrequency(e.target.value)}
                    placeholder="e.g. Once daily after meals"
                    className="w-full px-3 py-1.5 rounded-xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 6: Verbatim Transcript Text */}
          <div className="space-y-2 pt-3 border-t border-[#EAE6DF]">
            <span className="font-heading text-base font-bold text-[#292524] tracking-[-0.01em] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#78716C]" />
              6. Verbatim / Field Notes
            </span>
            <textarea
              rows={3}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Paste raw recording verbatim or researcher notes..."
              className="w-full p-3 text-base leading-[1.65] rounded-2xl border border-[#EAE6DF] bg-[#FFFFFF] text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#528BCA]/20 focus:border-[#528BCA]"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#EAE6DF] flex items-center justify-between gap-2 flex-wrap">
            <div>
              {isEditing && onDeleteRecord && (
                confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#7A3A36] font-bold">Confirm delete?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteRecord(recordToEdit.id);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 text-[13px] font-bold bg-[#D97A75] hover:bg-[#C66661] text-white rounded-full cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3.5 py-1.5 text-[13px] text-[#57534E] hover:bg-[#F7F5F0] rounded-full cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 text-[13px] text-[#7A3A36] hover:bg-[#FDF4F3] px-3.5 py-1.5 rounded-full font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
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
                className="px-4 py-2 text-[13px] font-semibold text-[#57534E] hover:bg-[#F7F5F0] rounded-full cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 font-heading text-sm font-bold bg-[#528BCA] hover:bg-[#3F78B5] text-white rounded-full shadow-2xs cursor-pointer whitespace-nowrap shrink-0 transition-colors"
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
