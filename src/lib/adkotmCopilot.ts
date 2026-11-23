import type {
  ADKOTMDecode,
  ADKOTMDimensionKey,
  ADKOTMFieldConfidence,
  ADKOTMFieldItem,
  ADKOTMFieldStatus,
  InterviewRecord,
  InterviewReviewStatus,
  MissedSignalSuggestion,
  TaxonomyMergeProposal,
} from '../types';
import { isAnalysisEligibleRecord } from './recordEligibility';

export interface ADKOTMParameterDef {
  key: string;
  label: string;
  shortCode?: string;
  dimension: ADKOTMDimensionKey;
  dimensionLabel: string;
  isArray?: boolean;
  defaultForPopover?: boolean;
  placeholder?: string;
}

export const ADKOTM_DIMENSION_STYLES: Record<
  ADKOTMDimensionKey,
  {
    key: ADKOTMDimensionKey;
    name: string;
    badgeClass: string;
    highlightClass: string;
    activeHighlightClass: string;
    borderAccentClass: string;
    dotClass: string;
  }
> = {
  O: {
    key: 'O',
    name: 'Object',
    badgeClass: 'bg-[#FEFBEB] text-[#6B5306] border-[#F7D147]',
    highlightClass: 'bg-[#FEFBEB] text-[#292524] border-b-2 border-[#F7D147]',
    activeHighlightClass: 'bg-[#FEF4C7] text-[#292524] ring-2 ring-[#F7D147] border-b-2 border-[#D4AD1F]',
    borderAccentClass: 'border-[#F7D147]',
    dotClass: 'bg-[#F7D147]',
  },
  A: {
    key: 'A',
    name: 'Activity',
    badgeClass: 'bg-[#F2FBF8] text-[#1E4D42] border-[#96D6C7]',
    highlightClass: 'bg-[#F2FBF8] text-[#292524] border-b-2 border-[#96D6C7]',
    activeHighlightClass: 'bg-[#DDF5EE] text-[#1E4D42] ring-2 ring-[#96D6C7] border-b-2 border-[#5AB8A3]',
    borderAccentClass: 'border-[#96D6C7]',
    dotClass: 'bg-[#96D6C7]',
  },
  K: {
    key: 'K',
    name: 'Knowledge',
    badgeClass: 'bg-[#F2F7FC] text-[#234B78] border-[#528BCA]/50',
    highlightClass: 'bg-[#F2F7FC] text-[#292524] border-b-2 border-[#528BCA]/75',
    activeHighlightClass: 'bg-[#E1EEF9] text-[#234B78] ring-2 ring-[#528BCA] border-b-2 border-[#528BCA]',
    borderAccentClass: 'border-[#528BCA]/60',
    dotClass: 'bg-[#528BCA]',
  },
  D: {
    key: 'D',
    name: 'Demographic',
    badgeClass: 'bg-[#F3F5FD] text-[#33418A] border-[#7C8CE0]/55',
    highlightClass: 'bg-[#F3F5FD] text-[#292524] border-b-2 border-[#7C8CE0]/80',
    activeHighlightClass: 'bg-[#E4E8FA] text-[#33418A] ring-2 ring-[#7C8CE0] border-b-2 border-[#7C8CE0]',
    borderAccentClass: 'border-[#7C8CE0]/60',
    dotClass: 'bg-[#7C8CE0]',
  },
  T: {
    key: 'T',
    name: 'Timing',
    badgeClass: 'bg-[#FBEAE9] text-[#7A3A36] border-[#D97A75]/55',
    highlightClass: 'bg-[#FBEAE9] text-[#292524] border-b-2 border-[#D97A75]/85',
    activeHighlightClass: 'bg-[#F5D6D4] text-[#7A3A36] ring-2 ring-[#D97A75] border-b-2 border-[#D97A75]',
    borderAccentClass: 'border-[#D97A75]/60',
    dotClass: 'bg-[#D97A75]',
  },
  M: {
    key: 'M',
    name: 'Metadata',
    badgeClass: 'bg-[#FDF4F3] text-[#7A3A36] border-[#F6BEBA]',
    highlightClass: 'bg-[#FDF4F3] text-[#292524] border-b-2 border-[#F6BEBA]',
    activeHighlightClass: 'bg-[#FAE5E3] text-[#7A3A36] ring-2 ring-[#F6BEBA] border-b-2 border-[#E39A94]',
    borderAccentClass: 'border-[#F6BEBA]',
    dotClass: 'bg-[#F6BEBA]',
  },
};

export const ADKOTM_PARAMETER_CATALOG: ADKOTMParameterDef[] = [
  // O - Objects
  {
    key: 'productsPurchased',
    label: 'Products Purchased [PP]',
    shortCode: 'PP',
    dimension: 'O',
    dimensionLabel: 'Objects',
    defaultForPopover: true,
    placeholder: 'e.g. Probiotic Drinks, Yogurt Products',
  },
  {
    key: 'brandPreferences',
    label: 'Brand Preferences [PP1]',
    shortCode: 'PP1',
    dimension: 'O',
    dimensionLabel: 'Objects',
    placeholder: 'e.g. Vitagen, Yakult, Bio Gaia',
  },
  {
    key: 'productCategory',
    label: 'Product Category',
    dimension: 'O',
    dimensionLabel: 'Objects',
    placeholder: 'probiotic | yogurt | supplement | fruits & vegetables | dairy & milks',
  },
  {
    key: 'foodProducts',
    label: 'Food & Dairy Products',
    dimension: 'O',
    dimensionLabel: 'Objects',
    isArray: true,
    placeholder: 'e.g. Yakult, Greek yogurt, Papaya',
  },
  {
    key: 'supplementProducts',
    label: 'Supplement Products',
    dimension: 'O',
    dimensionLabel: 'Objects',
    isArray: true,
    placeholder: 'e.g. Bio Gaia drops, Epicode fish oil',
  },
  {
    key: 'actionsToSolve',
    label: 'Actions to Solve Gut Issues',
    dimension: 'O',
    dimensionLabel: 'Objects',
    isArray: true,
    placeholder: 'e.g. Daily probiotic drink, High-fiber fruit intake',
  },
  {
    key: 'productPreference',
    label: 'Format / Attribute Preference',
    dimension: 'O',
    dimensionLabel: 'Objects',
    placeholder: 'e.g. Low sugar, liquid drops, small bottle',
  },

  // A - Activities
  {
    key: 'dailyRoutine',
    label: 'Daily Routine',
    dimension: 'A',
    dimensionLabel: 'Activities',
    defaultForPopover: true,
    placeholder: 'e.g. Morning childcare & swimming routine',
  },
  {
    key: 'shoppingBehaviour',
    label: 'Shopping Behaviour',
    dimension: 'A',
    dimensionLabel: 'Activities',
    placeholder: 'e.g. Weekly grocery replenishment at NSK',
  },
  {
    key: 'foodConsumptionBehaviour',
    label: 'Food Consumption Behaviour',
    dimension: 'A',
    dimensionLabel: 'Activities',
    placeholder: 'e.g. Selective eater; prefers yogurt and fruits',
  },
  {
    key: 'foodPreparation',
    label: 'Food Preparation',
    dimension: 'A',
    dimensionLabel: 'Activities',
    placeholder: 'e.g. Home-cooked family meals',
  },
  {
    key: 'eatingContext',
    label: 'Eating Context',
    dimension: 'A',
    dimensionLabel: 'Activities',
    placeholder: 'e.g. Family dinner at home',
  },

  // K - Knowledge
  {
    key: 'awarenessOnGutHealth',
    label: 'Gut Health Awareness [AW]',
    shortCode: 'AW',
    dimension: 'K',
    dimensionLabel: 'Knowledge',
    defaultForPopover: true,
    placeholder: 'e.g. Links probiotics to digestion & constipation relief',
  },
  {
    key: 'awarenessLevel',
    label: 'Awareness Level',
    dimension: 'K',
    dimensionLabel: 'Knowledge',
    placeholder: 'Aware | Not Aware',
  },
  {
    key: 'understandingSummary',
    label: 'Understanding Summary',
    dimension: 'K',
    dimensionLabel: 'Knowledge',
    placeholder: 'Concise qualitative synthesis of gut understanding',
  },

  // D - Demographics
  {
    key: 'familyRole',
    label: 'Family Role [FR]',
    shortCode: 'FR',
    dimension: 'D',
    dimensionLabel: 'Demographics',
    defaultForPopover: true,
    placeholder: 'Mum | Dad | Elderly',
  },
  {
    key: 'residentialLocation',
    label: 'Residential Location [RL]',
    shortCode: 'RL',
    dimension: 'D',
    dimensionLabel: 'Demographics',
    placeholder: 'e.g. Kepong, Shah Alam, Ampang',
  },
  {
    key: 'age',
    label: 'Age / Bracket',
    dimension: 'D',
    dimensionLabel: 'Demographics',
    placeholder: 'e.g. 30-39',
  },
  {
    key: 'gender',
    label: 'Gender',
    dimension: 'D',
    dimensionLabel: 'Demographics',
    placeholder: 'Female | Male',
  },
  {
    key: 'householdComposition',
    label: 'Household Composition',
    dimension: 'D',
    dimensionLabel: 'Demographics',
    placeholder: 'e.g. Parents with 2 young children',
  },
  {
    key: 'educationLevel',
    label: 'Education Level',
    dimension: 'D',
    dimensionLabel: 'Demographics',
    placeholder: "e.g. Bachelor's Degree, Diploma",
  },

  // T - Timing
  {
    key: 'consumptionTiming',
    label: 'Consumption Timing',
    dimension: 'T',
    dimensionLabel: 'Timing',
    defaultForPopover: true,
    placeholder: 'e.g. Every morning after breakfast',
  },
  {
    key: 'consumptionFrequency',
    label: 'Consumption Frequency',
    dimension: 'T',
    dimensionLabel: 'Timing',
    placeholder: 'e.g. Daily, 3 times a week',
  },
  {
    key: 'purchaseFrequency',
    label: 'Purchase Frequency',
    dimension: 'T',
    dimensionLabel: 'Timing',
    placeholder: 'e.g. Weekly, Monthly',
  },
  {
    key: 'purchaseTiming',
    label: 'Purchase Timing',
    dimension: 'T',
    dimensionLabel: 'Timing',
    placeholder: 'e.g. Weekends',
  },
  {
    key: 'purchaseOccasion',
    label: 'Purchase Occasion',
    dimension: 'T',
    dimensionLabel: 'Timing',
    placeholder: 'e.g. Regular grocery run, Child constipation',
  },

  // M - Metadata
  {
    key: 'interviewLocation',
    label: 'Interview Location [IL]',
    shortCode: 'IL',
    dimension: 'M',
    dimensionLabel: 'Metadata',
    placeholder: 'e.g. AEON Mall Shah Alam',
  },
  {
    key: 'interviewTime',
    label: 'Interview Time / Date',
    dimension: 'M',
    dimensionLabel: 'Metadata',
    placeholder: 'e.g. 10/29 afternoon',
  },
];

export const ADKOTM_PARAM_MAP = new Map<string, ADKOTMParameterDef>(
  ADKOTM_PARAMETER_CATALOG.map((p) => [p.key, p])
);

export function stripRecordingExtension(fileName: string): string {
  return String(fileName || '')
    .replace(/\.(m4a|mp3|wav|ogg|aac|flac|webm|txt|docx?|pdf|json)$/i, '')
    .trim();
}

/**
 * Extracts interview venue from recording filenames like:
 * - "AEON Mall Shah Alam 10/29.m4a" -> "AEON Mall Shah Alam"
 * - "Brem Mall Kepong NSK 10-26 (2).m4a" -> "Brem Mall Kepong NSK"
 * - "Jaya Grocer Elmina 291026 Part 1.m4a" -> "Jaya Grocer Elmina"
 * Returns null for generic filenames like "Recording 1.m4a" or "Interview 3.txt".
 */
export function extractLocationFromFilename(fileName: string): string | null {
  let base = stripRecordingExtension(fileName);
  if (!base) return null;

  // Strip common trailing timestamps, dates, indices, part labels
  base = base
    .replace(/\b(?:20\d{2}[-_/]\d{1,2}[-_/]\d{1,2}|\d{1,2}[-_/]\d{1,2}(?:[-_/]\d{2,4})?)\b/g, ' ')
    .replace(/\b\d{6,8}\b/g, ' ')
    .replace(/\((?:part\s*)?\d+\)/gi, ' ')
    .replace(/\b(?:part|pt|p)\s*\d+\b/gi, ' ')
    .replace(/(?:^|\s)#?\d+\s*$/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!base || base.length < 3) return null;

  const genericPattern = /^(?:recording|audio|interview|participant|respondent|transcript|note|notes|voice|memo|file|session|track|untitled|whatsapp\s+audio)(?:\s*\d+)*$/i;
  if (genericPattern.test(base)) {
    return null;
  }

  return base;
}

export interface GroundedQuoteMatch {
  matchedText: string;
  start: number;
  end: number;
}

function normalizeForSpanMatch(text: string): {
  normalized: string;
  indexMap: number[];
} {
  let normalized = '';
  const indexMap: number[] = [];
  let lastWasSpace = false;

  for (let i = 0; i < text.length; i++) {
    let ch = text[i];
    if (ch === '\u2018' || ch === '\u2019') ch = "'";
    else if (ch === '\u201C' || ch === '\u201D') ch = '"';
    else if (/\s/.test(ch)) ch = ' ';

    if (ch === ' ') {
      if (normalized.length === 0 || lastWasSpace) continue;
      lastWasSpace = true;
    } else {
      lastWasSpace = false;
    }
    normalized += ch.toLowerCase();
    indexMap.push(i);
  }

  if (normalized.endsWith(' ')) {
    normalized = normalized.slice(0, -1);
    indexMap.pop();
  }

  return { normalized, indexMap };
}

/**
 * Verifies that an evidence_quote is a genuine substring in the cleaned transcript.
 * Supports minor whitespace / smart-quote / case normalization and returns the exact slice
 * from the original transcript along with character offsets.
 */
export function verifyEvidenceQuote(
  transcript: string,
  quote: string | null | undefined
): GroundedQuoteMatch | null {
  if (!transcript || !quote) return null;
  const cleanedQuote = String(quote).trim().replace(/^["']+|["']+$/g, '').trim();
  if (cleanedQuote.length < 2) return null;

  // 1. Direct exact match
  const exactIdx = transcript.indexOf(cleanedQuote);
  if (exactIdx !== -1) {
    return {
      matchedText: transcript.slice(exactIdx, exactIdx + cleanedQuote.length),
      start: exactIdx,
      end: exactIdx + cleanedQuote.length,
    };
  }

  // 2. Normalized whitespace + case-insensitive + smart-quote match
  const normT = normalizeForSpanMatch(transcript);
  const normQ = normalizeForSpanMatch(cleanedQuote).normalized;
  if (!normQ || normQ.length < 2) return null;

  const normIdx = normT.normalized.indexOf(normQ);
  if (normIdx === -1) return null;

  const startOrig = normT.indexMap[normIdx];
  const lastNormPos = normIdx + normQ.length - 1;
  const endOrig = (normT.indexMap[lastNormPos] ?? startOrig) + 1;

  return {
    matchedText: transcript.slice(startOrig, endOrig),
    start: startOrig,
    end: endOrig,
  };
}

function sanitizeCodeValue(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) {
    const joined = val.map((v) => String(v || '').trim()).filter(Boolean).join(', ');
    return joined || null;
  }
  const str = String(val).trim();
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'unstated' || str.toLowerCase() === 'none') {
    return null;
  }
  return str;
}

/**
 * Enforces strict quote grounding & filename metadata fallback across all ADKOTM parameters.
 * Any non-metadata field without a verified substring quote in the transcript is nulled out.
 */
export function enforceStrictGrounding(
  rawFields: Record<string, Partial<ADKOTMFieldItem> | undefined>,
  transcript: string,
  fileName: string,
  metadataHint?: { location?: string | null; date?: string | null }
): Record<string, ADKOTMFieldItem> {
  const result: Record<string, ADKOTMFieldItem> = {};

  for (const param of ADKOTM_PARAMETER_CATALOG) {
    const raw = rawFields[param.key];
    const code = sanitizeCodeValue(raw?.code);
    const quote = sanitizeCodeValue(raw?.evidence_quote);
    const reasoning = sanitizeCodeValue(raw?.reasoning);

    if (param.key === 'interviewLocation') {
      const grounded = verifyEvidenceQuote(transcript, quote);
      if (code && grounded) {
        result[param.key] = {
          code,
          evidence_quote: grounded.matchedText,
          confidence: raw?.confidence === 'REVIEW_NEEDED' ? 'REVIEW_NEEDED' : 'HIGH',
          status: 'STAGED',
          reasoning,
          source: 'transcript',
        };
      } else {
        const hintLoc = sanitizeCodeValue(metadataHint?.location);
        const filenameLoc = extractLocationFromFilename(fileName);
        const fallbackLoc = hintLoc || filenameLoc || (raw?.source === 'filename_metadata' || raw?.source === 'session_metadata' ? code : null);
        if (fallbackLoc) {
          result[param.key] = {
            code: fallbackLoc,
            evidence_quote: hintLoc
              ? `Session metadata: ${hintLoc}`
              : `Filename metadata: ${fileName}`,
            confidence: 'HIGH',
            status: 'STAGED',
            reasoning: hintLoc
              ? 'Auto-extracted from session metadata location.'
              : 'Auto-extracted venue from recording filename.',
            source: hintLoc ? 'session_metadata' : 'filename_metadata',
          };
        } else {
          result[param.key] = {
            code: null,
            evidence_quote: null,
            confidence: 'NULL',
            status: 'STAGED',
            reasoning: null,
          };
        }
      }
      continue;
    }

    if (param.key === 'interviewTime') {
      const grounded = verifyEvidenceQuote(transcript, quote);
      if (code && grounded) {
        result[param.key] = {
          code,
          evidence_quote: grounded.matchedText,
          confidence: raw?.confidence === 'REVIEW_NEEDED' ? 'REVIEW_NEEDED' : 'HIGH',
          status: 'STAGED',
          reasoning,
          source: 'transcript',
        };
      } else {
        const hintDate = sanitizeCodeValue(metadataHint?.date);
        if (hintDate) {
          result[param.key] = {
            code: hintDate,
            evidence_quote: `Session metadata date: ${hintDate}`,
            confidence: 'HIGH',
            status: 'STAGED',
            reasoning: 'Auto-extracted from session folder / metadata date.',
            source: 'session_metadata',
          };
        } else {
          result[param.key] = {
            code: null,
            evidence_quote: null,
            confidence: 'NULL',
            status: 'STAGED',
            reasoning: null,
          };
        }
      }
      continue;
    }

    // Strict quote grounding for all behavioral/demographic/knowledge/object/timing parameters
    if (!code) {
      result[param.key] = {
        code: null,
        evidence_quote: null,
        confidence: 'NULL',
        status: 'STAGED',
        reasoning: null,
      };
      continue;
    }

    const grounded = verifyEvidenceQuote(transcript, quote);
    if (!grounded) {
      // No direct textual support -> strictly null
      result[param.key] = {
        code: null,
        evidence_quote: null,
        confidence: 'NULL',
        status: 'STAGED',
        reasoning: null,
      };
      continue;
    }

    const confidence: ADKOTMFieldConfidence =
      raw?.confidence === 'REVIEW_NEEDED' ? 'REVIEW_NEEDED' : 'HIGH';

    result[param.key] = {
      code,
      evidence_quote: grounded.matchedText,
      confidence,
      status: 'STAGED',
      reasoning,
      source: 'transcript',
    };
  }

  return result;
}

function splitArrayCode(code: string | null): string[] | null {
  if (!code) return null;
  const items = code
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

function getEffectiveCode(item?: ADKOTMFieldItem): string | null {
  if (!item || item.status === 'REJECTED') return null;
  return sanitizeCodeValue(item.code);
}

/**
 * Synchronizes flat ADKOTMDecode properties (`activities`, `demographic`, `knowledge`, `objects`, `time`, `metadata`, `postAnalysisCodes`, `evidenceQuotes`)
 * from structured `fieldStates`, preserving backward compatibility with charts, maps, exports, and Step 4 formulas.
 */
export function syncFlatDecodeFromFieldStates(
  fieldStates: Record<string, ADKOTMFieldItem>,
  baseDecode?: Partial<ADKOTMDecode>
): ADKOTMDecode {
  const val = (key: string): string | null => getEffectiveCode(fieldStates[key]);

  const fr = val('familyRole');
  const rl = val('residentialLocation');
  const aw = val('awarenessOnGutHealth');
  const pp = val('productsPurchased');
  const pp1 = val('brandPreferences');
  const il = val('interviewLocation');

  const rawAwarenessLevel = val('awarenessLevel');
  const normalizedAwarenessLevel: 'Aware' | 'Not Aware' | null =
    rawAwarenessLevel === 'Aware' || rawAwarenessLevel === 'Not Aware'
      ? rawAwarenessLevel
      : aw
      ? /\b(not aware|unaware|never heard|don't know|do not know)\b/i.test(aw)
        ? 'Not Aware'
        : 'Aware'
      : null;

  const evidenceQuotes: ADKOTMDecode['evidenceQuotes'] = [];
  for (const param of ADKOTM_PARAMETER_CATALOG) {
    const item = fieldStates[param.key];
    if (!item || item.status === 'REJECTED') continue;
    const code = sanitizeCodeValue(item.code);
    const quote = sanitizeCodeValue(item.evidence_quote);
    if (code && quote) {
      evidenceQuotes.push({
        code: param.shortCode || param.dimension,
        field: param.key,
        quote,
      });
    }
  }

  return {
    activities: {
      dailyRoutine: val('dailyRoutine'),
      shoppingBehaviour: val('shoppingBehaviour'),
      foodConsumptionBehaviour: val('foodConsumptionBehaviour'),
      foodPreparation: val('foodPreparation'),
      eatingContext: val('eatingContext'),
    },
    demographic: {
      gender: val('gender'),
      age: val('age'),
      residentialLocation: rl,
      residentialDistrict: rl,
      educationLevel: val('educationLevel'),
      householdComposition: val('householdComposition'),
      familyRole: fr,
    },
    knowledge: {
      awarenessOnGutHealth: aw,
      awarenessLevel: normalizedAwarenessLevel,
      understandingSummary: val('understandingSummary') || aw,
    },
    objects: {
      productsPurchased: pp,
      supplementProducts: splitArrayCode(val('supplementProducts')),
      foodProducts: splitArrayCode(val('foodProducts')),
      actionsToSolve: splitArrayCode(val('actionsToSolve')),
      productCategory: val('productCategory'),
      brandPreferences: pp1,
      productPreference: val('productPreference'),
    },
    time: {
      purchaseFrequency: val('purchaseFrequency'),
      consumptionFrequency: val('consumptionFrequency'),
      purchaseTiming: val('purchaseTiming'),
      purchaseOccasion: val('purchaseOccasion'),
      consumptionTiming: val('consumptionTiming'),
    },
    metadata: {
      interviewTime: val('interviewTime'),
      interviewLocation: il,
    },
    postAnalysisCodes: {
      FR: fr,
      RL: rl,
      AW: aw,
      PP: pp,
      PP1: pp1,
      IL: il,
    },
    evidenceQuotes,
    fieldStates,
    customFields: baseDecode?.customFields,
    missedSignals: baseDecode?.missedSignals,
    dismissedSignalIds: baseDecode?.dismissedSignalIds,
    decodedAt: baseDecode?.decodedAt || new Date().toISOString(),
  };
}

function readFlatFieldValue(decode: ADKOTMDecode, key: string): string | null {
  switch (key) {
    case 'dailyRoutine': return sanitizeCodeValue(decode.activities?.dailyRoutine);
    case 'shoppingBehaviour': return sanitizeCodeValue(decode.activities?.shoppingBehaviour);
    case 'foodConsumptionBehaviour': return sanitizeCodeValue(decode.activities?.foodConsumptionBehaviour);
    case 'foodPreparation': return sanitizeCodeValue(decode.activities?.foodPreparation);
    case 'eatingContext': return sanitizeCodeValue(decode.activities?.eatingContext);
    case 'gender': return sanitizeCodeValue(decode.demographic?.gender);
    case 'age': return sanitizeCodeValue(decode.demographic?.age);
    case 'residentialLocation': return sanitizeCodeValue(decode.postAnalysisCodes?.RL ?? decode.demographic?.residentialLocation);
    case 'educationLevel': return sanitizeCodeValue(decode.demographic?.educationLevel);
    case 'householdComposition': return sanitizeCodeValue(decode.demographic?.householdComposition);
    case 'familyRole': return sanitizeCodeValue(decode.postAnalysisCodes?.FR ?? decode.demographic?.familyRole);
    case 'awarenessOnGutHealth': return sanitizeCodeValue(decode.postAnalysisCodes?.AW ?? decode.knowledge?.awarenessOnGutHealth);
    case 'awarenessLevel': return sanitizeCodeValue(decode.knowledge?.awarenessLevel);
    case 'understandingSummary': return sanitizeCodeValue(decode.knowledge?.understandingSummary);
    case 'productsPurchased': return sanitizeCodeValue(decode.postAnalysisCodes?.PP ?? decode.objects?.productsPurchased);
    case 'supplementProducts': return sanitizeCodeValue(decode.objects?.supplementProducts);
    case 'foodProducts': return sanitizeCodeValue(decode.objects?.foodProducts);
    case 'actionsToSolve': return sanitizeCodeValue(decode.objects?.actionsToSolve);
    case 'productCategory': return sanitizeCodeValue(decode.objects?.productCategory);
    case 'brandPreferences': return sanitizeCodeValue(decode.postAnalysisCodes?.PP1 ?? decode.objects?.brandPreferences);
    case 'productPreference': return sanitizeCodeValue(decode.objects?.productPreference);
    case 'purchaseFrequency': return sanitizeCodeValue(decode.time?.purchaseFrequency);
    case 'consumptionFrequency': return sanitizeCodeValue(decode.time?.consumptionFrequency);
    case 'purchaseTiming': return sanitizeCodeValue(decode.time?.purchaseTiming);
    case 'purchaseOccasion': return sanitizeCodeValue(decode.time?.purchaseOccasion);
    case 'consumptionTiming': return sanitizeCodeValue(decode.time?.consumptionTiming);
    case 'interviewTime': return sanitizeCodeValue(decode.metadata?.interviewTime);
    case 'interviewLocation': return sanitizeCodeValue(decode.postAnalysisCodes?.IL ?? decode.metadata?.interviewLocation);
    default: return null;
  }
}

/**
 * Ensures any ADKOTMDecode (including legacy or manually edited objects) exposes structured `fieldStates`.
 */
export function ensureFieldStates(
  decode: ADKOTMDecode | undefined,
  defaultStatus: ADKOTMFieldStatus = 'STAGED'
): Record<string, ADKOTMFieldItem> {
  const existing = decode?.fieldStates || {};
  const result: Record<string, ADKOTMFieldItem> = { ...existing };
  const quotesByField = new Map<string, string>();
  for (const eq of decode?.evidenceQuotes || []) {
    if (eq.field && eq.quote && !quotesByField.has(eq.field)) {
      quotesByField.set(eq.field, eq.quote);
    }
  }

  for (const param of ADKOTM_PARAMETER_CATALOG) {
    if (existing[param.key]) {
      result[param.key] = existing[param.key];
      continue;
    }
    const flatVal = decode ? readFlatFieldValue(decode, param.key) : null;
    const matchedQuote = quotesByField.get(param.key) || (param.shortCode ? quotesByField.get(param.shortCode) : undefined) || null;
    if (flatVal) {
      result[param.key] = {
        code: flatVal,
        evidence_quote: matchedQuote,
        confidence: matchedQuote || defaultStatus === 'MANUAL' ? 'HIGH' : 'REVIEW_NEEDED',
        status: defaultStatus,
      };
    } else {
      result[param.key] = {
        code: null,
        evidence_quote: null,
        confidence: 'NULL',
        status: defaultStatus,
      };
    }
  }

  return result;
}

export interface ReviewProgressSummary {
  status: InterviewReviewStatus;
  flagCount: number;
  stagedCount: number;
  acceptedCount: number;
  populatedCount: number;
}

export function computeReviewProgress(record: InterviewRecord): ReviewProgressSummary {
  if (!record.adkotmDecode) {
    return {
      status: 'unprocessed',
      flagCount: 0,
      stagedCount: 0,
      acceptedCount: 0,
      populatedCount: 0,
    };
  }

  const states = ensureFieldStates(record.adkotmDecode, record.reviewStatus === 'human_verified' ? 'ACCEPTED' : 'STAGED');
  let flagCount = 0;
  let stagedCount = 0;
  let acceptedCount = 0;
  let populatedCount = 0;

  for (const item of Object.values(states)) {
    const hasCode = Boolean(sanitizeCodeValue(item.code));
    if (!hasCode || item.status === 'REJECTED') continue;
    populatedCount++;
    if (item.status === 'STAGED') {
      stagedCount++;
    } else if (item.status === 'ACCEPTED' || item.status === 'MANUAL') {
      acceptedCount++;
    }
    if (item.confidence === 'REVIEW_NEEDED' && item.status === 'STAGED') {
      flagCount++;
    }
  }

  const activeMissedSignals = (record.adkotmDecode.missedSignals || []).filter(
    (s) => !(record.adkotmDecode?.dismissedSignalIds || []).includes(s.id)
  );
  flagCount += activeMissedSignals.length;

  let status: InterviewReviewStatus;
  if (record.reviewStatus === 'human_verified') {
    status = 'human_verified';
  } else if (record.reviewStatus === 'needs_review') {
    status = 'needs_review';
  } else if (stagedCount > 0 || flagCount > 0) {
    status = 'needs_review';
  } else if (record.decodeStatus === 'decoded') {
    // Legacy decoded records without fieldStates or already finalized
    status = record.adkotmDecode.fieldStates ? 'needs_review' : 'human_verified';
  } else {
    status = 'unprocessed';
  }

  // If reviewStatus is needs_review and there are staged items without explicit REVIEW_NEEDED flags,
  // expose total review items cleanly when appropriate while keeping flagCount accurate for amber warnings.
  return {
    status,
    flagCount,
    stagedCount,
    acceptedCount,
    populatedCount,
  };
}

/**
 * Only Human Verified, analysis-eligible records feed into Step 3 Analytics/Summary & Step 4 Cross-Analysis.
 */
export function isHumanVerifiedRecord(record: InterviewRecord): boolean {
  if (!isAnalysisEligibleRecord(record) || !record.adkotmDecode) return false;
  return computeReviewProgress(record).status === 'human_verified';
}

export interface TranscriptHighlightSegment {
  text: string;
  start: number;
  end: number;
  fieldKey?: string;
  fieldKeys?: string[];
  dimension?: ADKOTMDimensionKey;
  label?: string;
}

/**
 * Builds non-overlapping transcript segments with active evidence_quote highlights mapped to ADKOTM dimensions.
 * Tracks all fieldKeys whose quotes match or fall within each rendered span so hover-sync works for shared quotes.
 */
export function buildTranscriptHighlightSegments(
  transcript: string,
  fieldStates?: Record<string, ADKOTMFieldItem>
): TranscriptHighlightSegment[] {
  if (!transcript) return [];
  if (!fieldStates) {
    return [{ text: transcript, start: 0, end: transcript.length }];
  }

  interface SpanCandidate {
    start: number;
    end: number;
    fieldKey: string;
    fieldKeys: string[];
    dimension: ADKOTMDimensionKey;
    label: string;
    priority: number;
  }

  const candidates: SpanCandidate[] = [];
  for (const param of ADKOTM_PARAMETER_CATALOG) {
    const item = fieldStates[param.key];
    if (!item || item.status === 'REJECTED' || !sanitizeCodeValue(item.code)) continue;
    if (item.source === 'filename_metadata' || item.source === 'session_metadata') continue;
    const match = verifyEvidenceQuote(transcript, item.evidence_quote);
    if (match) {
      candidates.push({
        start: match.start,
        end: match.end,
        fieldKey: param.key,
        fieldKeys: [param.key],
        dimension: param.dimension,
        label: param.label,
        priority: item.status === 'ACCEPTED' || item.status === 'MANUAL' ? 2 : 1,
      });
    }
  }

  // Sort by start ascending, higher priority / longer spans first
  candidates.sort((a, b) => a.start - b.start || b.priority - a.priority || (b.end - b.start) - (a.end - a.start));

  const nonOverlapping: SpanCandidate[] = [];
  let cursor = 0;
  for (const cand of candidates) {
    if (cand.start >= cursor) {
      nonOverlapping.push(cand);
      cursor = cand.end;
    } else if (nonOverlapping.length > 0) {
      const prev = nonOverlapping[nonOverlapping.length - 1];
      if (cand.start < prev.end && !prev.fieldKeys.includes(cand.fieldKey)) {
        prev.fieldKeys.push(cand.fieldKey);
      }
    }
  }

  const segments: TranscriptHighlightSegment[] = [];
  let pos = 0;
  for (const span of nonOverlapping) {
    if (span.start > pos) {
      segments.push({
        text: transcript.slice(pos, span.start),
        start: pos,
        end: span.start,
      });
    }
    segments.push({
      text: transcript.slice(span.start, span.end),
      start: span.start,
      end: span.end,
      fieldKey: span.fieldKey,
      fieldKeys: span.fieldKeys,
      dimension: span.dimension,
      label: span.label,
    });
    pos = span.end;
  }

  if (pos < transcript.length) {
    segments.push({
      text: transcript.slice(pos),
      start: pos,
      end: transcript.length,
    });
  }

  return segments;
}

export interface CroppingTranscriptSegment extends TranscriptHighlightSegment {
  isActiveCrop?: boolean;
}

interface WordTokenSpan {
  start: number;
  end: number;
}

function extractWordTokens(transcript: string): WordTokenSpan[] {
  const tokens: WordTokenSpan[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(transcript)) !== null) {
    tokens.push({ start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

/**
 * Resolves exact character offsets [start, end] for a field's evidence_quote in the transcript.
 */
export function resolveFieldSpanOffsets(
  transcript: string,
  fieldStates: Record<string, ADKOTMFieldItem> | undefined,
  fieldKey: string
): GroundedQuoteMatch | null {
  if (!transcript || !fieldStates) return null;
  const item = fieldStates[fieldKey];
  if (!item || item.status === 'REJECTED' || !sanitizeCodeValue(item.code)) return null;
  if (item.source === 'filename_metadata' || item.source === 'session_metadata') return null;
  return verifyEvidenceQuote(transcript, item.evidence_quote);
}

/**
 * Snaps a raw character offset to a clean word boundary when dragging start/end crop handles,
 * guaranteeing a non-empty valid [start, end] span.
 */
export function snapCropBoundaryToWord(
  transcript: string,
  rawOffset: number,
  edge: 'start' | 'end',
  currentStart: number,
  currentEnd: number
): number {
  const tokens = extractWordTokens(transcript);
  if (tokens.length === 0) {
    return Math.max(0, Math.min(transcript.length, rawOffset));
  }

  const clamped = Math.max(0, Math.min(transcript.length, rawOffset));

  if (edge === 'start') {
    const candidateToken =
      tokens.find((t) => t.end > clamped && t.start < currentEnd) ||
      [...tokens].reverse().find((t) => t.start < currentEnd) ||
      tokens[0];
    return Math.min(candidateToken.start, Math.max(0, currentEnd - 1));
  }

  const validTokens = tokens.filter((t) => t.end > currentStart);
  if (validTokens.length === 0) return Math.min(transcript.length, Math.max(currentStart + 1, clamped));

  const candidateToken =
    [...validTokens].reverse().find((t) => t.start < clamped) || validTokens[0];
  return Math.max(candidateToken.end, Math.min(transcript.length, currentStart + 1));
}

/**
 * Nudges the start or end boundary of a cropped span by 1 word left (-1) or right (+1).
 */
export function nudgeSpanBoundary(
  transcript: string,
  start: number,
  end: number,
  edge: 'start' | 'end',
  deltaWords: -1 | 1
): { start: number; end: number; text: string } {
  const tokens = extractWordTokens(transcript);
  if (tokens.length === 0) {
    return { start, end, text: transcript.slice(start, end) };
  }

  if (edge === 'start') {
    let idx = tokens.findIndex((t) => t.end > start);
    if (idx === -1) idx = tokens.length - 1;
    const nextIdx = Math.max(0, Math.min(tokens.length - 1, idx + deltaWords));
    const candidateStart = tokens[nextIdx].start;
    const finalStart = candidateStart < end ? candidateStart : start;
    return {
      start: finalStart,
      end,
      text: transcript.slice(finalStart, end),
    };
  }

  let idx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].start < end) {
      idx = i;
      break;
    }
  }
  if (idx === -1) idx = 0;
  const nextIdx = Math.max(0, Math.min(tokens.length - 1, idx + deltaWords));
  const candidateEnd = tokens[nextIdx].end;
  const finalEnd = candidateEnd > start ? candidateEnd : end;
  return {
    start,
    end: finalEnd,
    text: transcript.slice(start, finalEnd),
  };
}

/**
 * Builds transcript segments with an active cropping candidate span overlaid cleanly
 * on top of other non-active coded highlights, preserving exact contiguous offsets.
 */
export function buildTranscriptCroppingSegments(
  transcript: string,
  fieldStates: Record<string, ADKOTMFieldItem> | undefined,
  activeCropFieldKey: string,
  cropStart: number,
  cropEnd: number
): CroppingTranscriptSegment[] {
  if (!transcript) return [];
  const safeStart = Math.max(0, Math.min(cropStart, transcript.length));
  const safeEnd = Math.max(safeStart, Math.min(cropEnd, transcript.length));

  const otherStates: Record<string, ADKOTMFieldItem> = {};
  if (fieldStates) {
    for (const [k, v] of Object.entries(fieldStates)) {
      if (k !== activeCropFieldKey) {
        otherStates[k] = v;
      }
    }
  }

  const baseSegments = buildTranscriptHighlightSegments(transcript, otherStates);
  const param = ADKOTM_PARAM_MAP.get(activeCropFieldKey);
  const result: CroppingTranscriptSegment[] = [];
  let insertedCrop = false;

  for (const seg of baseSegments) {
    if (seg.end <= safeStart || seg.start >= safeEnd) {
      if (!insertedCrop && seg.start >= safeEnd) {
        result.push({
          text: transcript.slice(safeStart, safeEnd),
          start: safeStart,
          end: safeEnd,
          isActiveCrop: true,
          fieldKey: activeCropFieldKey,
          fieldKeys: [activeCropFieldKey],
          dimension: param?.dimension || 'O',
          label: param?.label || activeCropFieldKey,
        });
        insertedCrop = true;
      }
      result.push(seg);
      continue;
    }

    if (seg.start < safeStart) {
      result.push({
        ...seg,
        text: transcript.slice(seg.start, safeStart),
        end: safeStart,
      });
    }

    if (!insertedCrop) {
      result.push({
        text: transcript.slice(safeStart, safeEnd),
        start: safeStart,
        end: safeEnd,
        isActiveCrop: true,
        fieldKey: activeCropFieldKey,
        fieldKeys: [activeCropFieldKey],
        dimension: param?.dimension || 'O',
        label: param?.label || activeCropFieldKey,
      });
      insertedCrop = true;
    }

    if (seg.end > safeEnd) {
      result.push({
        ...seg,
        text: transcript.slice(safeEnd, seg.end),
        start: safeEnd,
      });
    }
  }

  if (!insertedCrop) {
    result.push({
      text: transcript.slice(safeStart, safeEnd),
      start: safeStart,
      end: safeEnd,
      isActiveCrop: true,
      fieldKey: activeCropFieldKey,
      fieldKeys: [activeCropFieldKey],
      dimension: param?.dimension || 'O',
      label: param?.label || activeCropFieldKey,
    });
  }

  return result;
}

/**
 * Updates an ADKOTMFieldItem after span cropping or inline quote/code editing,
 * preserving existing Accepted/Manual status and promoting Staged drafts.
 */
export function buildUpdatedFieldItemFromEdit(
  prev: ADKOTMFieldItem | undefined,
  updates: {
    code: string;
    evidence_quote: string | null;
    reasoning?: string | null;
    source?: ADKOTMFieldItem['source'];
  }
): ADKOTMFieldItem {
  const nextStatus: ADKOTMFieldStatus =
    prev?.status === 'ACCEPTED'
      ? 'ACCEPTED'
      : prev?.status === 'MANUAL'
      ? 'MANUAL'
      : 'MANUAL';

  return {
    code: updates.code.trim(),
    evidence_quote: updates.evidence_quote && updates.evidence_quote.trim() ? updates.evidence_quote.trim() : null,
    confidence: 'HIGH',
    status: nextStatus,
    reasoning: updates.reasoning ?? prev?.reasoning ?? 'Edited by researcher',
    source: updates.source ?? (prev?.source && prev.source !== 'filename_metadata' && prev.source !== 'session_metadata' ? prev.source : 'manual'),
  };
}

interface SignalRule {
  pattern: RegExp;
  fieldKey: string;
  dimension: ADKOTMDimensionKey;
  buildCode: (match: RegExpMatchArray, sentence: string) => string;
  reason: string;
}

const MISSED_SIGNAL_RULES: SignalRule[] = [
  {
    pattern: /\b(constipation|sembelit|bloating|stomach\s*ache|tummy\s*pain|diarrhea|cirit|digestion\s*issue|irregular\s*bowel)\b/i,
    fieldKey: 'awarenessOnGutHealth',
    dimension: 'K',
    buildCode: (m) => `Digestive trigger noted (${m[1].toLowerCase()})`,
    reason: 'Health / digestive trigger mentioned in uncoded sentence',
  },
  {
    pattern: /\b(biogaia|bio\s*gaia|biogaya|bio\s*gaya|yakult|vitagen|amway|nutrilite|epicode|episodo|fernleaf|karihome|chobani|emmi|sunglo|farmers\s*union|blackmores|swisse)\b/i,
    fieldKey: 'brandPreferences',
    dimension: 'O',
    buildCode: (m) => m[1].replace(/\s+/g, ' ').trim(),
    reason: 'Specific nutrition or probiotic brand detected in uncoded text',
  },
  {
    pattern: /\b(swimmer|swimming|soccer|football|badminton|sport|exercise|gym|jogging|playgroup|tuition)\b/i,
    fieldKey: 'dailyRoutine',
    dimension: 'A',
    buildCode: (m) => `Active lifestyle / routine (${m[1].toLowerCase()})`,
    reason: 'Participant or child routine/activity detected',
  },
  {
    pattern: /\b(picky\s*eater|fussy\s*eater|won't\s*eat\s*vegetables|refuses?\s*veggies|prefers?\s*(?:yogurt|fruit|sweet))\b/i,
    fieldKey: 'foodConsumptionBehaviour',
    dimension: 'A',
    buildCode: (m) => `Selective eating cue (${m[1].toLowerCase()})`,
    reason: 'Dietary consumption habit detected in uncoded sentence',
  },
  {
    pattern: /\b(?:live|stay|staying|living|reside)\s+(?:in|at|near)\s+([A-Za-z][A-Za-z\s]{2,24})/i,
    fieldKey: 'residentialLocation',
    dimension: 'D',
    buildCode: (m) => m[1].trim().replace(/[.,!?]+$/, ''),
    reason: 'Possible residential neighborhood cue detected',
  },
  {
    pattern: /\b(every\s+morning|every\s+day|daily|twice\s+a\s+week|every\s+week|once\s+a\s+month|before\s+bed|after\s+breakfast)\b/i,
    fieldKey: 'consumptionTiming',
    dimension: 'T',
    buildCode: (m) => m[1].trim(),
    reason: 'Consumption/purchase timing frequency detected',
  },
];

/**
 * Compares substantive sentences in the cleaned transcript against active `evidence_quote` spans
 * and returns clickable suggestions for uncoded behavioral, health, brand, or location cues.
 */
export function scanMissedSignals(
  transcript: string,
  fieldStates: Record<string, ADKOTMFieldItem> = {},
  dismissedIds: string[] = []
): MissedSignalSuggestion[] {
  if (!transcript || !transcript.trim()) return [];

  const dismissedSet = new Set(dismissedIds);
  const coveredSpans: { start: number; end: number }[] = [];

  for (const item of Object.values(fieldStates)) {
    if (!item || item.status === 'REJECTED' || !sanitizeCodeValue(item.code)) continue;
    const match = verifyEvidenceQuote(transcript, item.evidence_quote);
    if (match) {
      coveredSpans.push({ start: match.start, end: match.end });
    }
  }

  // Split transcript into sentences / lines
  const rawSentences = transcript
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);

  const suggestions: MissedSignalSuggestion[] = [];
  const seenKeys = new Set<string>();

  for (const sentence of rawSentences) {
    const sentenceMatch = verifyEvidenceQuote(transcript, sentence);
    if (!sentenceMatch) continue;

    // Check if majority of this sentence is already covered by an existing evidence_quote
    const isCovered = coveredSpans.some(
      (span) =>
        (sentenceMatch.start >= span.start && sentenceMatch.start < span.end) ||
        (span.start >= sentenceMatch.start && span.start < sentenceMatch.end &&
          (Math.min(span.end, sentenceMatch.end) - Math.max(span.start, sentenceMatch.start)) /
            Math.max(1, sentenceMatch.end - sentenceMatch.start) >
            0.45)
    );
    if (isCovered) continue;

    for (const rule of MISSED_SIGNAL_RULES) {
      const globalRegex = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`);
      for (const m of sentence.matchAll(globalRegex)) {
        if (!m[1]) continue;

        // Skip if this target field already has a non-null accepted/manual code matching the keyword
        const existingField = fieldStates[rule.fieldKey];
        const existingCode = getEffectiveCode(existingField);
        if (existingCode && existingCode.toLowerCase().includes(m[1].toLowerCase())) {
          continue;
        }

        const id = `sig_${rule.fieldKey}_${m[1].toLowerCase().replace(/[^a-z0-9]/g, '')}_${sentenceMatch.start}`;
        if (dismissedSet.has(id) || seenKeys.has(id)) continue;
        seenKeys.add(id);

        suggestions.push({
          id,
          sentence,
          suggestedFieldKey: rule.fieldKey,
          suggestedDimension: rule.dimension,
          suggestedCode: rule.buildCode(m, sentence),
          reason: rule.reason,
          matchedKeyword: m[1],
        });
      }
    }
  }

  return suggestions;
}

interface MacroRule {
  id: string;
  normalizedPP: string;
  matchPP: RegExp;
  brandExtractors: { pattern: RegExp; brand: string }[];
  reason: string;
}

const TAXONOMY_MACRO_RULES: MacroRule[] = [
  {
    id: 'norm_probiotic_drinks',
    normalizedPP: 'Probiotic Drinks',
    matchPP: /\b(vitagen|yakult|probiotic|probiotics|cultured\s*milk|lactobacillus|bio\s*gaia|biogaia)\b/i,
    brandExtractors: [
      { pattern: /\bvitagen\b/i, brand: 'Vitagen' },
      { pattern: /\byakult\b/i, brand: 'Yakult' },
      { pattern: /\b(?:bio\s*gaia|biogaia)\b/i, brand: 'Bio Gaia' },
    ],
    reason: 'Standardizes fragmented probiotic/brand labels under macro-category "Probiotic Drinks" while preserving brands in PP1.',
  },
  {
    id: 'norm_yogurt_products',
    normalizedPP: 'Yogurt Products',
    matchPP: /\b(yogurt|yoghurt|greek\s*yogurt|chobani|emmi|sunglo|farmers\s*union|marigold)\b/i,
    brandExtractors: [
      { pattern: /\bchobani\b/i, brand: 'Chobani' },
      { pattern: /\bemmi\b/i, brand: 'Emmi' },
      { pattern: /\bsunglo\b/i, brand: 'Sunglo' },
      { pattern: /\bfarmers\s*union\b/i, brand: 'Farmers Union' },
      { pattern: /\bmarigold\b/i, brand: 'Marigold' },
    ],
    reason: 'Standardizes yogurt/brand entries under "Yogurt Products" while keeping specific yogurt brands in PP1.',
  },
  {
    id: 'norm_dietary_supplements',
    normalizedPP: 'Dietary Supplements',
    matchPP: /\b(supplement|supplements|amway|nutrilite|epicode|episodo|fish\s*oil|multivitamin|vitamin\s*c|enzyme|blackmores|swisse)\b/i,
    brandExtractors: [
      { pattern: /\bamway\b/i, brand: 'Amway' },
      { pattern: /\bnutrilite\b/i, brand: 'Nutrilite' },
      { pattern: /\b(?:epicode|episodo)\b/i, brand: 'Epicode' },
      { pattern: /\bblackmores\b/i, brand: 'Blackmores' },
      { pattern: /\bswisse\b/i, brand: 'Swisse' },
    ],
    reason: 'Standardizes supplement and brand labels under "Dietary Supplements" while preserving brands in PP1.',
  },
  {
    id: 'norm_fruits_vegetables',
    normalizedPP: 'Fruits & Vegetables',
    matchPP: /\b(sayur|vegetable|vegetables|veggies|fruit|fruits|papaya|banana|apple|carrot|spinach|broccoli)\b/i,
    brandExtractors: [],
    reason: 'Standardizes produce items under macro-category "Fruits & Vegetables".',
  },
];

/**
 * Scans across decoded records to propose cross-interview standardization for Products Purchased [PP]
 * without losing brand granularity in Brand Preferences [PP1].
 */
export function proposeTaxonomyNormalizations(records: InterviewRecord[]): TaxonomyMergeProposal[] {
  const proposals: TaxonomyMergeProposal[] = [];

  for (const rule of TAXONOMY_MACRO_RULES) {
    const affectedIds: string[] = [];
    const affectedNames: string[] = [];
    const originalSet = new Set<string>();
    const preservedBrands: Record<string, string> = {};

    for (const r of records) {
      if (!isAnalysisEligibleRecord(r) || !r.adkotmDecode) continue;
      const pp = sanitizeCodeValue(r.adkotmDecode.postAnalysisCodes?.PP || r.adkotmDecode.objects?.productsPurchased);
      if (!pp) continue;

      if (rule.matchPP.test(pp) && pp !== rule.normalizedPP) {
        affectedIds.push(r.id);
        affectedNames.push(stripRecordingExtension(r.fileName));
        originalSet.add(pp);

        // Preserve any brand names found in PP alongside existing PP1
        const existingPP1 = sanitizeCodeValue(r.adkotmDecode.postAnalysisCodes?.PP1 || r.adkotmDecode.objects?.brandPreferences);
        const brandTokens = new Set<string>(
          existingPP1
            ? existingPP1.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
            : []
        );
        for (const be of rule.brandExtractors) {
          if (be.pattern.test(pp)) {
            brandTokens.add(be.brand);
          }
        }
        if (brandTokens.size > 0) {
          preservedBrands[r.id] = Array.from(brandTokens).join(', ');
        }
      }
    }

    if (affectedIds.length > 0) {
      proposals.push({
        id: rule.id,
        field: 'PP',
        originalValues: Array.from(originalSet),
        normalizedValue: rule.normalizedPP,
        preservedBrands,
        affectedRecordIds: affectedIds,
        affectedFileNames: affectedNames,
        reason: rule.reason,
      });
    }
  }

  return proposals;
}

/**
 * Applies selected taxonomy normalization proposals cleanly to records,
 * updating `fieldStates` and syncing flat `postAnalysisCodes.PP` / `PP1` + `objects`.
 */
export function applyTaxonomyNormalizations(
  records: InterviewRecord[],
  proposals: TaxonomyMergeProposal[],
  selectedProposalIds: string[]
): InterviewRecord[] {
  const activeProposals = proposals.filter((p) => selectedProposalIds.includes(p.id));
  if (activeProposals.length === 0) return records;

  return records.map((record) => {
    const matching = activeProposals.filter((p) => p.affectedRecordIds.includes(record.id));
    if (matching.length === 0 || !record.adkotmDecode) return record;

    const states = { ...ensureFieldStates(record.adkotmDecode, record.reviewStatus === 'human_verified' ? 'ACCEPTED' : 'STAGED') };

    for (const prop of matching) {
      const prevPP = states.productsPurchased;
      states.productsPurchased = {
        code: prop.normalizedValue,
        evidence_quote: prevPP?.evidence_quote || null,
        confidence: prevPP?.confidence === 'NULL' ? 'HIGH' : (prevPP?.confidence || 'HIGH'),
        status: prevPP?.status === 'STAGED' ? 'ACCEPTED' : (prevPP?.status || 'MANUAL'),
        reasoning: `Normalized to "${prop.normalizedValue}"`,
        source: prevPP?.source || 'manual',
      };

      const preservedBrand = prop.preservedBrands[record.id];
      if (preservedBrand) {
        const prevPP1 = states.brandPreferences;
        states.brandPreferences = {
          code: preservedBrand,
          evidence_quote: prevPP1?.evidence_quote || prevPP?.evidence_quote || null,
          confidence: 'HIGH',
          status: prevPP1?.status === 'STAGED' ? 'ACCEPTED' : (prevPP1?.status || 'MANUAL'),
          reasoning: 'Brand granularity preserved during PP normalization',
          source: prevPP1?.source || prevPP?.source || 'manual',
        };
      }
    }

    const syncedDecode = syncFlatDecodeFromFieldStates(states, record.adkotmDecode);
    return {
      ...record,
      adkotmDecode: syncedDecode,
    };
  });
}
