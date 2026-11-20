import type {
  ADKOTMConfidence,
  ADKOTMDecode,
  ADKOTMFieldConfidence,
  ADKOTMFieldEvidence,
  ADKOTMSectionKey,
  CopilotFieldSuggestion,
  PostAnalysisCodeKey,
  ReDecodeDiffEntry,
} from '../types';
import { ensureFieldStates } from './adkotmCopilot';

export interface ADKOTMFieldMeta {
  section: ADKOTMSectionKey;
  field: string;
  label: string;
  postAnalysisCode?: PostAnalysisCodeKey;
}

export const ADKOTM_FIELD_CATALOG: ADKOTMFieldMeta[] = [
  { section: 'activities', field: 'dailyRoutine', label: 'Daily routine' },
  { section: 'activities', field: 'shoppingBehaviour', label: 'Shopping behaviour' },
  { section: 'activities', field: 'foodConsumptionBehaviour', label: 'Food consumption behaviour' },
  { section: 'activities', field: 'foodPreparation', label: 'Food preparation' },
  { section: 'activities', field: 'eatingContext', label: 'Eating context' },

  { section: 'demographic', field: 'gender', label: 'Gender' },
  { section: 'demographic', field: 'age', label: 'Age' },
  { section: 'demographic', field: 'residentialLocation', label: 'Residential Location [RL]', postAnalysisCode: 'RL' },
  { section: 'demographic', field: 'residentialDistrict', label: 'Residential District' },
  { section: 'demographic', field: 'educationLevel', label: 'Education Level' },
  { section: 'demographic', field: 'householdComposition', label: 'Household Composition' },
  { section: 'demographic', field: 'familyRole', label: 'Family Role [FR]', postAnalysisCode: 'FR' },

  { section: 'knowledge', field: 'awarenessOnGutHealth', label: 'Gut Health Awareness [AW]', postAnalysisCode: 'AW' },
  { section: 'knowledge', field: 'awarenessLevel', label: 'Awareness Level' },
  { section: 'knowledge', field: 'understandingSummary', label: 'Understanding Summary' },

  { section: 'objects', field: 'productsPurchased', label: 'Products Purchased [PP]', postAnalysisCode: 'PP' },
  { section: 'objects', field: 'supplementProducts', label: 'Supplement Products' },
  { section: 'objects', field: 'foodProducts', label: 'Food Products' },
  { section: 'objects', field: 'actionsToSolve', label: 'Actions to Solve' },
  { section: 'objects', field: 'productCategory', label: 'Product Category' },
  { section: 'objects', field: 'brandPreferences', label: 'Brand Preferences [PP1]', postAnalysisCode: 'PP1' },
  { section: 'objects', field: 'productPreference', label: 'Product Preference' },

  { section: 'time', field: 'purchaseFrequency', label: 'Purchase Frequency' },
  { section: 'time', field: 'consumptionFrequency', label: 'Consumption Frequency' },
  { section: 'time', field: 'purchaseTiming', label: 'Purchase Timing' },
  { section: 'time', field: 'purchaseOccasion', label: 'Purchase Occasion' },
  { section: 'time', field: 'consumptionTiming', label: 'Consumption Timing' },

  { section: 'metadata', field: 'interviewTime', label: 'Interview Time' },
  { section: 'metadata', field: 'interviewLocation', label: 'Interview Location [IL]', postAnalysisCode: 'IL' },
];

export const findFieldMeta = (field: string): ADKOTMFieldMeta | undefined =>
  ADKOTM_FIELD_CATALOG.find((item) => item.field === field);

const normalizeForSubstringMatch = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, ' ')
    .replace(/[^a-z0-9'\u4e00-\u9fff\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Verifies that an extracted evidence_quote actually exists as a substring inside the transcript
 * (case-insensitive, punctuation/whitespace tolerant). Prevents hallucinated quotes from passing.
 */
export const verifyQuoteInTranscript = (
  quote: string | null | undefined,
  transcript: string | null | undefined
): boolean => {
  if (!quote || !transcript) return false;
  const rawQuote = quote.trim();
  const rawTranscript = transcript.trim();
  if (!rawQuote || !rawTranscript) return false;

  if (rawTranscript.toLowerCase().includes(rawQuote.toLowerCase())) {
    return true;
  }

  const normQuote = normalizeForSubstringMatch(rawQuote);
  const normTranscript = normalizeForSubstringMatch(rawTranscript);
  if (!normQuote || normQuote.length < 2) return false;
  return normTranscript.includes(normQuote);
};

/**
 * Extracts a clean interview venue name from a recording filename (e.g.
 * "AEON Mall Shah Alam 10/29.m4a" -> "AEON Mall Shah Alam",
 * "Jaya Grocer Elmina_Part 1.mp3" -> "Jaya Grocer Elmina").
 * Returns null if the filename contains only generic labels ("Recording 1.m4a", "Transcript.txt").
 */
export const parseInterviewLocationFromFileName = (fileName?: string | null): string | null => {
  if (!fileName || typeof fileName !== 'string') return null;

  let base = fileName.replace(/\.[^/.]+$/, '').trim();
  if (!base) return null;

  // Strip common dates, times, part tags, and trailing counters
  base = base
    .replace(/\b\d{4}[-_/]\d{1,2}[-_/]\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}[-_/]\d{1,2}(?:[-_/]\d{2,4})?\b/g, ' ')
    .replace(/\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*(?:\s+\d{2,4})?\b/gi, ' ')
    .replace(/[\[(]\s*(?:part\s*\d+|p\d+|\d+)\s*[\])]/gi, ' ')
    .replace(/(?:^|[\s_-])(?:part\s*\d+|p\d+|audio|recording|interview|transcript|cleaned|note|notes|participant\s*#?\d*|mum\s*#?\d*|dad\s*#?\d*|elderly\s*#?\d*)(?=$|[\s_-])/gi, ' ')
    .replace(/[_|]+/g, ' ')
    .replace(/\s*-\s*$/g, '')
    .replace(/^\s*-\s*/g, '')
    .replace(/\s+#?\d+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!base || base.length < 3) return null;
  if (/^\d+$/.test(base)) return null;
  if (/^(?:untitled|document|file|voice|memo|sample|test|session|direct notes)$/i.test(base)) {
    return null;
  }

  return base;
};

export const formatFlatFieldValue = (val: unknown): string | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return !trimmed || trimmed.toLowerCase() === 'null' ? null : trimmed;
  }
  if (Array.isArray(val)) {
    const items = val.map((v) => String(v || '').trim()).filter(Boolean);
    return items.length > 0 ? items.join(', ') : null;
  }
  if (typeof val === 'object') {
    const maybeCode = (val as any).code;
    if (maybeCode !== undefined) return formatFlatFieldValue(maybeCode);
  }
  return String(val);
};

export const createEmptyDecode = (): ADKOTMDecode => ({
  activities: {
    dailyRoutine: null,
    shoppingBehaviour: null,
    foodConsumptionBehaviour: null,
    foodPreparation: null,
    eatingContext: null,
  },
  demographic: {
    gender: null,
    age: null,
    residentialLocation: null,
    residentialDistrict: null,
    educationLevel: null,
    householdComposition: null,
    familyRole: null,
  },
  knowledge: {
    awarenessOnGutHealth: null,
    awarenessLevel: null,
    understandingSummary: null,
  },
  objects: {
    productsPurchased: null,
    supplementProducts: null,
    foodProducts: null,
    actionsToSolve: null,
    productCategory: null,
    brandPreferences: null,
    productPreference: null,
  },
  time: {
    purchaseFrequency: null,
    consumptionFrequency: null,
    purchaseTiming: null,
    purchaseOccasion: null,
    consumptionTiming: null,
  },
  metadata: {
    interviewTime: null,
    interviewLocation: null,
  },
  postAnalysisCodes: {
    FR: null,
    RL: null,
    AW: null,
    PP: null,
    PP1: null,
    IL: null,
  },
  evidenceQuotes: [],
  fieldDetails: {},
  copilotSuggestions: [],
});

const ARRAY_OBJECT_FIELDS = new Set(['supplementProducts', 'foodProducts', 'actionsToSolve']);

export const applyFieldUpdateToDecode = (
  existing: ADKOTMDecode | undefined,
  update: {
    section: ADKOTMSectionKey;
    field: string;
    postAnalysisCode?: PostAnalysisCodeKey;
    value: string | null;
    evidence_quote?: string | null;
    confidence?: ADKOTMConfidence;
    reasoning?: string | null;
    removeSuggestionId?: string;
  }
): ADKOTMDecode => {
  const base = existing
    ? {
        ...existing,
        activities: { ...existing.activities },
        demographic: { ...existing.demographic },
        knowledge: { ...existing.knowledge },
        objects: { ...existing.objects },
        time: { ...existing.time },
        metadata: { ...existing.metadata },
        postAnalysisCodes: { ...existing.postAnalysisCodes },
        evidenceQuotes: [...(existing.evidenceQuotes || [])],
        fieldDetails: { ...(existing.fieldDetails || {}) },
        copilotSuggestions: [...(existing.copilotSuggestions || [])],
      }
    : createEmptyDecode();

  const sanitizedVal =
    update.value && update.value.trim() && update.value.trim().toLowerCase() !== 'null'
      ? update.value.trim()
      : null;

  const meta = findFieldMeta(update.field);
  const sectionObj = base[update.section] as Record<string, any>;

  if (update.section === 'objects' && ARRAY_OBJECT_FIELDS.has(update.field)) {
    sectionObj[update.field] = sanitizedVal
      ? sanitizedVal.split(',').map((s) => s.trim()).filter(Boolean)
      : null;
  } else {
    sectionObj[update.field] = sanitizedVal;
  }

  // Sync linked summary/postAnalysisCode fields
  const codeKey = update.postAnalysisCode || meta?.postAnalysisCode;
  if (codeKey) {
    base.postAnalysisCodes[codeKey] = sanitizedVal;
  }

  if (update.field === 'residentialLocation') {
    base.demographic.residentialDistrict = sanitizedVal || base.demographic.residentialDistrict;
  }
  if (update.field === 'awarenessOnGutHealth') {
    base.knowledge.understandingSummary = sanitizedVal || base.knowledge.understandingSummary;
    if (sanitizedVal && !base.knowledge.awarenessLevel) {
      base.knowledge.awarenessLevel = 'Aware';
    }
  }

  const confidence: ADKOTMConfidence = sanitizedVal
    ? update.confidence || 'HIGH'
    : 'NULL';

  const evidenceObj: ADKOTMFieldEvidence = {
    code: sanitizedVal,
    evidence_quote: update.evidence_quote?.trim() || null,
    confidence,
    reasoning: update.reasoning?.trim() || null,
  };
  base.fieldDetails![update.field] = evidenceObj;

  // Keep Step 3 Review Workspace `fieldStates` in sync with Copilot edits
  const nextStates = ensureFieldStates(base, 'STAGED');
  const structuredConfidence: ADKOTMFieldConfidence = !sanitizedVal
    ? 'NULL'
    : confidence === 'REVIEW_NEEDED' || confidence === 'MEDIUM' || confidence === 'UNVERIFIED'
    ? 'REVIEW_NEEDED'
    : 'HIGH';

  nextStates[update.field] = {
    code: sanitizedVal,
    evidence_quote: evidenceObj.evidence_quote,
    confidence: structuredConfidence,
    status: sanitizedVal ? 'MANUAL' : 'REJECTED',
    reasoning: evidenceObj.reasoning,
    source: 'manual',
  };

  if (update.field === 'awarenessOnGutHealth' && sanitizedVal && base.knowledge.awarenessLevel) {
    nextStates.awarenessLevel = {
      code: base.knowledge.awarenessLevel,
      evidence_quote: evidenceObj.evidence_quote,
      confidence: structuredConfidence,
      status: 'MANUAL',
      reasoning: nextStates.awarenessLevel?.reasoning || evidenceObj.reasoning,
      source: 'manual',
    };
  }
  base.fieldStates = nextStates;

  if (sanitizedVal && evidenceObj.evidence_quote) {
    const codeLabel = codeKey || update.section.toUpperCase().slice(0, 1);
    const filteredQuotes = base.evidenceQuotes.filter((q) => q.field !== update.field);
    filteredQuotes.push({
      code: codeLabel,
      field: update.field,
      quote: evidenceObj.evidence_quote,
    });
    base.evidenceQuotes = filteredQuotes;
  } else if (!sanitizedVal) {
    base.evidenceQuotes = base.evidenceQuotes.filter((q) => q.field !== update.field);
  }

  if (update.removeSuggestionId && base.copilotSuggestions) {
    base.copilotSuggestions = base.copilotSuggestions.filter(
      (s) => s.id !== update.removeSuggestionId
    );
  }

  base.decodedAt = new Date().toISOString();
  return base;
};

export const extractAllEvidenceQuotes = (decode?: ADKOTMDecode): string[] => {
  if (!decode) return [];
  const quotes = new Set<string>();
  if (Array.isArray(decode.evidenceQuotes)) {
    decode.evidenceQuotes.forEach((eq) => {
      if (eq?.quote && eq.quote.trim()) quotes.add(eq.quote.trim());
    });
  }
  if (decode.fieldDetails) {
    Object.values(decode.fieldDetails).forEach((detail) => {
      if (detail?.evidence_quote && detail.evidence_quote.trim()) {
        quotes.add(detail.evidence_quote.trim());
      }
    });
  }
  return Array.from(quotes);
};

export const splitTranscriptSentences = (transcript?: string | null): string[] => {
  if (!transcript || typeof transcript !== 'string') return [];
  return transcript
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => {
      const words = s.split(/\s+/).filter(Boolean);
      return words.length >= 2;
    });
};

/**
 * Finds sentences in the cleaned transcript that are not covered by any extracted evidence_quote.
 */
export const findUncoveredSentences = (
  transcript: string | null | undefined,
  decode?: ADKOTMDecode
): string[] => {
  const sentences = splitTranscriptSentences(transcript);
  if (sentences.length === 0) return [];
  const quotes = extractAllEvidenceQuotes(decode).map(normalizeForSubstringMatch).filter(Boolean);

  if (quotes.length === 0) return sentences;

  return sentences.filter((sentence) => {
    const normSentence = normalizeForSubstringMatch(sentence);
    if (!normSentence) return false;
    return !quotes.some(
      (q) =>
        q.includes(normSentence) ||
        normSentence.includes(q)
    );
  });
};

/**
 * Computes field-level diffs between an existing decode and a candidate re-decode.
 */
export const computeDecodeDiffs = (
  recordId: string,
  fileName: string,
  oldDecode: ADKOTMDecode | undefined,
  newDecode: ADKOTMDecode
): ReDecodeDiffEntry[] => {
  const diffs: ReDecodeDiffEntry[] = [];

  for (const meta of ADKOTM_FIELD_CATALOG) {
    const oldSection = oldDecode?.[meta.section] as Record<string, any> | undefined;
    const newSection = newDecode[meta.section] as Record<string, any>;

    const oldVal = formatFlatFieldValue(oldSection?.[meta.field]);
    const newVal = formatFlatFieldValue(newSection?.[meta.field]);

    if ((oldVal || null) === (newVal || null)) continue;

    const detail = newDecode.fieldDetails?.[meta.field];
    diffs.push({
      id: `${recordId}:${meta.field}`,
      recordId,
      fileName,
      section: meta.section,
      field: meta.field,
      label: meta.label,
      ...(meta.postAnalysisCode ? { postAnalysisCode: meta.postAnalysisCode } : {}),
      oldValue: oldVal,
      newValue: newVal,
      evidence_quote: detail?.evidence_quote || null,
      confidence: detail?.confidence || (newVal ? 'HIGH' : 'NULL'),
      reasoning: detail?.reasoning || null,
    });
  }

  return diffs;
};

export const mergeAcceptSuggestion = (
  decode: ADKOTMDecode | undefined,
  suggestion: CopilotFieldSuggestion
): ADKOTMDecode => {
  return applyFieldUpdateToDecode(decode, {
    section: suggestion.targetSection,
    field: suggestion.targetField,
    postAnalysisCode: suggestion.postAnalysisCode,
    value: suggestion.suggestedCode,
    evidence_quote: suggestion.evidence_quote,
    confidence: suggestion.confidence === 'UNVERIFIED' ? 'MEDIUM' : suggestion.confidence,
    reasoning: suggestion.reasoning,
    removeSuggestionId: suggestion.id,
  });
};

export const CUSTOM_CODING_RULES_STORAGE_KEY = 'adkotm_custom_coding_rules';

export const loadCustomCodingRules = (): string[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CODING_RULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
      : [];
  } catch {
    return [];
  }
};

export const saveCustomCodingRules = (rules: string[]): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const clean = rules.map((r) => r.trim()).filter(Boolean);
    window.localStorage.setItem(CUSTOM_CODING_RULES_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // ignore storage quota errors
  }
};

