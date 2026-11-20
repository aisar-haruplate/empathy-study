import type {
  ADKOTMDecode,
  ADKOTMDimensionKey,
  ADKOTMSectionKey,
  CustomTaxonomyCategory,
  InterviewRecord,
} from '../types';
import {
  classifyBrandToCategory,
  classifyMacroCategory,
  KNOWN_BRANDS,
  MACRO_CATEGORIES,
  normalizeQualitativeToken,
} from './taxonomyCategories';
import { ADKOTM_FIELD_CATALOG } from './adkotmUtils';

export type DecodeDimensionKey =
  | 'overview'
  | 'object'
  | 'brand_matrix'
  | 'activity'
  | 'knowledge'
  | 'demographic'
  | 'metadata'
  | 'time'
  | 'empathy';

export const formatDecodeDimensionLabel = (dimension: string): string => {
  const key = dimension?.toLowerCase?.() ?? '';

  switch (key) {
    case 'overview':
      return 'Overview matrix';
    case 'object':
      return 'Within Object (O)';
    case 'brand_matrix':
      return 'Brand-to-Product Matrix';
    case 'activity':
      return 'Within Activity (A)';
    case 'knowledge':
      return 'Within Knowledge (K)';
    case 'demographic':
      return 'Demographic (D) • Residence RL';
    case 'metadata':
      return 'Metadata (M) • Field Venue IL';
    case 'time':
      return 'Time (T)';
    case 'empathy':
      return 'Empathy Studies';
    default:
      return dimension || 'Decode view';
  }
};

export const getViewExportLabel = (view: string): string => {
  const key = view?.toLowerCase?.() ?? '';

  switch (key) {
    case 'overview':
      return 'Overview matrix';
    case 'object':
      return 'Within Object (O)';
    case 'brand_matrix':
      return 'Brand-to-Product Matrix';
    case 'activity':
      return 'Within Activity (A)';
    case 'knowledge':
      return 'Within Knowledge (K)';
    case 'demographic':
      return 'Demographic (D) • Residence RL';
    case 'metadata':
      return 'Metadata (M) • Field Venue IL';
    case 'time':
      return 'Time (T)';
    case 'empathy':
      return 'Empathy Studies';
    default:
      return 'Decode export';
  }
};

// ============================================================================
// Bento Grid Analytics Types
// ============================================================================

export type CrossFilterType =
  | 'dimension'
  | 'macro'
  | 'brand'
  | 'brand_product'
  | 'activity'
  | 'awareness'
  | 'understanding_theme'
  | 'role'
  | 'residence'
  | 'timing_bucket'
  | 'venue'
  | 'solution'
  | 'product_group';

export interface CrossFilterCriteria {
  id: string;
  dimension: ADKOTMDimensionKey | 'EMPATHY';
  filterType: CrossFilterType;
  value: string;
  secondaryValue?: string;
  label: string;
}

export interface CoverageMetric {
  statedCount: number;
  unstatedCount: number;
  totalRecords: number;
  statedPct: number;
}

export interface ExecutiveDimensionStat {
  dimension: ADKOTMDimensionKey;
  section: ADKOTMSectionKey;
  label: string;
  shortLabel: string;
  color: string;
  statedSignals: number;
  unstatedFields: number;
  totalPossibleSignals: number;
  completenessPct: number;
  signalSharePct: number;
  recordsWithSignal: number;
}

export interface RankedBentoItem {
  key: string;
  label: string;
  count: number;
  pctOfStated: number;
  color: string;
  recordIds: string[];
  subLabel?: string;
  fieldKey?: string;
}

export interface BrandMatrixRow {
  brand: string;
  normalizedBrand: string;
  primaryCategory: string;
  productType: string;
  totalMentions: number;
  countsByProductType: Record<string, number>;
  recordIdsByProductType: Record<string, string[]>;
  allRecordIds: string[];
}

export interface BrandCooccurrenceData {
  productColumns: { id: string; label: string; color: string }[];
  rows: BrandMatrixRow[];
  coverage: CoverageMetric;
}

export interface ObjectsBentoData {
  macroItems: RankedBentoItem[];
  macroCoverage: CoverageMetric;
  brandItems: RankedBentoItem[];
  brandCoverage: CoverageMetric;
  brandMatrix: BrandCooccurrenceData;
}

export interface ActivitiesBentoData {
  items: RankedBentoItem[];
  subFieldCounts: { field: string; label: string; count: number }[];
  coverage: CoverageMetric;
}

export interface KnowledgeBentoData {
  awareCount: number;
  notAwareCount: number;
  unstatedCount: number;
  totalRecords: number;
  awarePctOfStated: number;
  awarePctOfTotal: number;
  notAwarePctOfTotal: number;
  unstatedPctOfTotal: number;
  themes: RankedBentoItem[];
  coverage: CoverageMetric;
}

export interface DemographicsBentoData {
  roleItems: RankedBentoItem[];
  roleCoverage: CoverageMetric;
  residenceItems: RankedBentoItem[];
  residenceCoverage: CoverageMetric;
  householdTags: RankedBentoItem[];
}

export interface TimingBentoData {
  buckets: RankedBentoItem[];
  coverage: CoverageMetric;
}

export interface MetadataVenueItem {
  venue: string;
  interviewCount: number;
  avgSignals: number;
  totalSignals: number;
  pctOfStated: number;
  recordIds: string[];
}

export interface MetadataBentoData {
  venues: MetadataVenueItem[];
  coverage: CoverageMetric;
  overallAvgSignals: number;
}

export interface EmpathyCohortComparison {
  cohort: string;
  roleKey: string;
  total: number;
  aware: number;
  notAware: number;
  unstated: number;
  awarenessRate: number;
}

export interface EmpathySummaryData {
  cohorts: EmpathyCohortComparison[];
  supplementsCount: number;
  foodProductsCount: number;
  supplementsPct: number;
  foodsPct: number;
  topSolutions: RankedBentoItem[];
  coverage: CoverageMetric;
}

export interface EvidenceQuoteItem {
  id: string;
  recordId: string;
  fileName: string;
  folderName: string;
  dimension: ADKOTMDimensionKey | 'M';
  fieldKey: string;
  fieldLabel: string;
  code: string;
  quote: string;
  source: string;
}

export interface UnifiedObjectItem extends TraceableBreakdownItem {
  objectKind: 'brand' | 'food';
}

export interface ActivityCooccurrenceHabit {
  key: string;
  label: string;
  shortLabel: string;
  fieldKey: string;
  fieldLabel: string;
  count: number;
  item: TraceableBreakdownItem;
}

export interface ActivityCooccurrenceCell {
  rowIndex: number;
  colIndex: number;
  count: number;
  pctOfTotal: number;
  traceItem: TraceableBreakdownItem;
}

export interface ActivityCooccurrenceMatrix {
  habits: ActivityCooccurrenceHabit[];
  cells: ActivityCooccurrenceCell[][];
  totalRecords: number;
  maxCooccurrence: number;
}

export interface ExecutiveCoverageRow {
  dimension: ADKOTMDimensionKey;
  label: string;
  statedCount: number;
  unstatedCount: number;
  totalRecords: number;
  statedPct: number;
  unstatedPct: number;
  totalSignals: number;
  color: string;
}

// ============================================================================
// Safe Value Helpers (strict null exclusion)
// ============================================================================

const NULL_TOKENS = new Set([
  '',
  'null',
  'unstated',
  'none',
  'n/a',
  'na',
  'not mentioned',
  'not stated',
  'unknown',
  'nil',
  '-',
]);

export const isSubstantiveValue = (val: unknown): boolean => {
  if (val === null || val === undefined) return false;
  if (Array.isArray(val)) {
    return val.some((item) => isSubstantiveValue(item));
  }
  if (typeof val === 'object') {
    return Object.values(val as Record<string, unknown>).some((v) => isSubstantiveValue(v));
  }
  const str = String(val).trim().toLowerCase();
  return !NULL_TOKENS.has(str);
};

export const toCleanString = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const t = val.trim();
    return NULL_TOKENS.has(t.toLowerCase()) ? '' : t;
  }
  if (Array.isArray(val)) {
    return val
      .map((item) => toCleanString(item))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof val === 'object') {
    return Object.values(val as Record<string, unknown>)
      .map((item) => toCleanString(item))
      .filter(Boolean)
      .join(', ');
  }
  const t = String(val).trim();
  return NULL_TOKENS.has(t.toLowerCase()) ? '' : t;
};

export const toCleanArray = (val: unknown): string[] => {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) {
    return val.map((item) => toCleanString(item)).filter(Boolean);
  }
  if (typeof val === 'string') {
    return val
      .split(/[,;\n]+/)
      .map((item) => toCleanString(item))
      .filter(Boolean);
  }
  if (typeof val === 'object') {
    return Object.values(val as Record<string, unknown>)
      .map((item) => toCleanString(item))
      .filter(Boolean);
  }
  const single = toCleanString(val);
  return single ? [single] : [];
};

const makeCoverage = (statedCount: number, totalRecords: number): CoverageMetric => {
  const safeTotal = Math.max(0, totalRecords);
  const safeStated = Math.min(safeTotal, Math.max(0, statedCount));
  const unstatedCount = Math.max(0, safeTotal - safeStated);
  const statedPct = safeTotal > 0 ? Math.round((safeStated / safeTotal) * 100) : 0;
  return {
    statedCount: safeStated,
    unstatedCount,
    totalRecords: safeTotal,
    statedPct,
  };
};

// ============================================================================
// Normalization Helpers per ADKOTM Dimension
// ============================================================================

const normalizeFamilyRole = (decode?: ADKOTMDecode): string => {
  const raw = toCleanString(decode?.demographic?.familyRole || decode?.postAnalysisCodes?.FR).toLowerCase();
  if (!raw) return '';
  if (raw.includes('mum') || raw.includes('mother') || raw.includes('mom')) return 'Mum';
  if (raw.includes('dad') || raw.includes('father')) return 'Dad';
  if (raw.includes('elderly') || raw.includes('grand') || raw.includes('senior')) return 'Elderly';
  if (raw.includes('caregiver') || raw.includes('guardian')) return 'Caregiver';
  return raw.replace(/\b\w/g, (ch) => ch.toUpperCase());
};

const resolveAwarenessLevel = (decode?: ADKOTMDecode): 'Aware' | 'Not Aware' | null => {
  if (!decode) return null;
  if (decode.knowledge?.awarenessLevel === 'Aware') return 'Aware';
  if (decode.knowledge?.awarenessLevel === 'Not Aware') return 'Not Aware';
  const raw = toCleanString(
    decode.knowledge?.awarenessOnGutHealth || decode.postAnalysisCodes?.AW || decode.knowledge?.understandingSummary
  ).toLowerCase();
  if (!raw) return null;
  if (
    raw.includes('not aware') ||
    raw.includes('unaware') ||
    raw.includes('never heard') ||
    raw.includes("don't know") ||
    raw.includes('no awareness') ||
    raw.includes('low literacy')
  ) {
    return 'Not Aware';
  }
  if (
    raw.includes('aware') ||
    raw.includes('probiotic') ||
    raw.includes('good bacteria') ||
    raw.includes('gut') ||
    raw.includes('digestion') ||
    raw.includes('regular') ||
    raw.includes('immune')
  ) {
    return 'Aware';
  }
  return null;
};

const classifyUnderstandingTheme = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes('immune') || lower.includes('sick') || lower.includes('defense') || lower.includes('illness')) {
    return 'Immune defense & illness prevention';
  }
  if (lower.includes('bacteria') || lower.includes('probiotic') || lower.includes('microbiome') || lower.includes('culture')) {
    return 'Good bacteria & microbiome balance';
  }
  if (lower.includes('constipat') || lower.includes('bloat') || lower.includes('poop') || lower.includes('bowel') || lower.includes('stool')) {
    return 'Bowel regularity & constipation relief';
  }
  if (lower.includes('skin') || lower.includes('eczema') || lower.includes('allergy')) {
    return 'Skin health & tolerance';
  }
  if (lower.includes('nutrient') || lower.includes('absorb') || lower.includes('appetite') || lower.includes('grow')) {
    return 'Nutrient absorption & child growth';
  }
  return 'General digestive wellbeing';
};

export const TIMING_BUCKETS = [
  { id: 'daily_morning', label: 'Daily / Every Morning', color: '#be123c' },
  { id: 'weekly', label: 'Weekly', color: '#e11d48' },
  { id: 'occasionally', label: 'Occasionally / As Needed', color: '#f43f5e' },
  { id: 'when_unwell', label: 'When Unwell / Constipated', color: '#fb7185' },
  { id: 'monthly_restock', label: 'Monthly / Periodic Restock', color: '#fda4af' },
] as const;

export const TIMING_SPECTRUM_ORDER: string[] = TIMING_BUCKETS.map((b) => b.label);

export const sortTimingItemsByCadence = <T extends { key: string; label: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    if (a.key === '__null__') return 1;
    if (b.key === '__null__') return -1;
    const idxA = TIMING_SPECTRUM_ORDER.indexOf(a.label);
    const idxB = TIMING_SPECTRUM_ORDER.indexOf(b.label);
    const rankA = idxA === -1 ? 999 : idxA;
    const rankB = idxB === -1 ? 999 : idxB;
    if (rankA !== rankB) return rankA - rankB;
    return a.label.localeCompare(b.label);
  });
};

export const classifyTimingBucket = (rawText: string): string => {
  const lower = rawText.toLowerCase();
  if (
    lower.includes('daily') ||
    lower.includes('every day') ||
    lower.includes('everyday') ||
    lower.includes('morning') ||
    lower.includes('every night') ||
    lower.includes('before bed') ||
    lower.includes('per day')
  ) {
    return 'Daily / Every Morning';
  }
  if (lower.includes('unwell') || lower.includes('constipat') || lower.includes('sick') || lower.includes('bloat') || lower.includes('symptom') || lower.includes('diarrhea')) {
    return 'When Unwell / Constipated';
  }
  if (lower.includes('week') || lower.includes('weekend') || lower.includes('twice a week') || lower.includes('3 times')) {
    return 'Weekly';
  }
  if (lower.includes('month') || lower.includes('restock') || lower.includes('biweekly')) {
    return 'Monthly / Periodic Restock';
  }
  return 'Occasionally / As Needed';
};

const getRecordVenue = (record: InterviewRecord): string => {
  const d = record.adkotmDecode;
  return toCleanString(d?.metadata?.interviewLocation || d?.postAnalysisCodes?.IL || record.sessionLocation);
};

const getRecordResidence = (record: InterviewRecord): string => {
  const d = record.adkotmDecode;
  return toCleanString(d?.demographic?.residentialLocation || d?.demographic?.residentialDistrict || d?.postAnalysisCodes?.RL);
};

const getRecordBrands = (decode?: ADKOTMDecode): string[] => {
  if (!decode) return [];
  const rawBrands = [
    ...toCleanArray(decode.objects?.brandPreferences || decode.postAnalysisCodes?.PP1),
  ];
  const combinedText = [
    ...toCleanArray(decode.objects?.productsPurchased || decode.postAnalysisCodes?.PP),
    ...toCleanArray(decode.objects?.foodProducts),
    ...toCleanArray(decode.objects?.supplementProducts),
  ];

  const found = new Set<string>();
  rawBrands.forEach((b) => {
    const norm = normalizeQualitativeToken(b);
    if (!norm) return;
    const known = KNOWN_BRANDS.find((kb) => norm.includes(kb.normalizedBrand));
    found.add(known ? known.brand : b.trim());
  });

  // Also detect well-known brands mentioned inside PP/food/supplement tokens if PP1 missed them
  combinedText.forEach((token) => {
    const norm = normalizeQualitativeToken(token);
    if (!norm) return;
    const known = KNOWN_BRANDS.find((kb) => norm.includes(kb.normalizedBrand));
    if (known) found.add(known.brand);
  });

  return Array.from(found);
};

const getRecordMacroIds = (decode?: ADKOTMDecode): string[] => {
  if (!decode) return [];
  const tokens = [
    ...toCleanArray(decode.objects?.productsPurchased || decode.postAnalysisCodes?.PP),
    ...toCleanArray(decode.objects?.productCategory),
    ...toCleanArray(decode.objects?.foodProducts),
    ...toCleanArray(decode.objects?.supplementProducts),
    ...toCleanArray(decode.objects?.brandPreferences || decode.postAnalysisCodes?.PP1),
  ];
  const ids = new Set<string>();
  tokens.forEach((t) => {
    const { macroId } = classifyMacroCategory(t);
    if (macroId) ids.add(macroId);
  });
  return Array.from(ids);
};

const getRecordProductTypeForItem = (token: string): string => {
  const norm = normalizeQualitativeToken(token);
  const brandMeta = classifyBrandToCategory(token);
  if (brandMeta.categoryName && brandMeta.categoryName !== 'unclassified') {
    return brandMeta.categoryName;
  }
  if (/yogurt|yoghurt/.test(norm)) return 'yogurt';
  if (/supplement|fish oil|vitamin|enzyme|omega|capsule|tablet|powder|sachet/.test(norm)) return 'supplement';
  if (/probiotic|good bacteria|lactobacillus|cultured milk|kefir/.test(norm)) return 'probiotic';
  if (/fruit|vegetable|papaya|banana|oat|rice|milk|food/.test(norm)) return 'food & fiber';
  return 'other';
};

const countRecordSignals = (record: InterviewRecord): number => {
  const d = record.adkotmDecode;
  if (!d) return 0;
  let total = 0;

  const sections: [ADKOTMSectionKey, Record<string, unknown> | undefined][] = [
    ['activities', d.activities as unknown as Record<string, unknown>],
    ['demographic', d.demographic as unknown as Record<string, unknown>],
    ['knowledge', d.knowledge as unknown as Record<string, unknown>],
    ['objects', d.objects as unknown as Record<string, unknown>],
    ['time', d.time as unknown as Record<string, unknown>],
    ['metadata', d.metadata as unknown as Record<string, unknown>],
  ];

  sections.forEach(([, obj]) => {
    if (!obj) return;
    Object.values(obj).forEach((val) => {
      if (isSubstantiveValue(val)) total += 1;
    });
  });

  return total;
};

// ============================================================================
// Cross-Filtering Engine
// ============================================================================

export const matchesCrossFilter = (
  record: InterviewRecord,
  filter: CrossFilterCriteria | null | undefined
): boolean => {
  if (!filter) return true;
  const d = record.adkotmDecode;
  if (!d) return false;

  switch (filter.filterType) {
    case 'dimension':
      return true;

    case 'macro': {
      const macroIds = getRecordMacroIds(d);
      return macroIds.includes(filter.value);
    }

    case 'brand': {
      const brands = getRecordBrands(d).map((b) => b.toLowerCase());
      return brands.includes(filter.value.toLowerCase());
    }

    case 'brand_product': {
      const brands = getRecordBrands(d).map((b) => b.toLowerCase());
      if (!brands.includes(filter.value.toLowerCase())) return false;
      if (!filter.secondaryValue) return true;
      const tokens = [
        ...toCleanArray(d.objects?.productsPurchased || d.postAnalysisCodes?.PP),
        ...toCleanArray(d.objects?.foodProducts),
        ...toCleanArray(d.objects?.supplementProducts),
        ...toCleanArray(d.objects?.brandPreferences || d.postAnalysisCodes?.PP1),
      ];
      return tokens.some(
        (t) =>
          normalizeQualitativeToken(t).includes(filter.value.toLowerCase().split('/')[0].trim()) &&
          getRecordProductTypeForItem(t) === filter.secondaryValue
      ) || classifyBrandToCategory(filter.value).categoryName === filter.secondaryValue;
    }

    case 'activity': {
      const fields = [
        d.activities?.dailyRoutine,
        d.activities?.shoppingBehaviour,
        d.activities?.foodConsumptionBehaviour,
        d.activities?.foodPreparation,
        d.activities?.eatingContext,
      ];
      return fields.some((f) => toCleanString(f).toLowerCase() === filter.value.toLowerCase());
    }

    case 'awareness': {
      const level = resolveAwarenessLevel(d);
      if (filter.value === 'Unstated') return level === null;
      return level === filter.value;
    }

    case 'understanding_theme': {
      const text = toCleanString(d.knowledge?.understandingSummary || d.knowledge?.awarenessOnGutHealth || d.postAnalysisCodes?.AW);
      if (!text) return false;
      return classifyUnderstandingTheme(text) === filter.value;
    }

    case 'role': {
      const role = normalizeFamilyRole(d);
      if (filter.value === 'Unstated') return !role;
      return role.toLowerCase() === filter.value.toLowerCase();
    }

    case 'residence': {
      const rl = getRecordResidence(record);
      return rl.toLowerCase() === filter.value.toLowerCase();
    }

    case 'timing_bucket': {
      const vals = [
        d.time?.consumptionTiming,
        d.time?.consumptionFrequency,
        d.time?.purchaseFrequency,
        d.time?.purchaseTiming,
        d.time?.purchaseOccasion,
      ]
        .map((v) => toCleanString(v))
        .filter(Boolean);
      return vals.some((v) => classifyTimingBucket(v) === filter.value);
    }

    case 'venue': {
      const venue = getRecordVenue(record);
      return venue.toLowerCase() === filter.value.toLowerCase();
    }

    case 'solution': {
      const solLower = filter.value.toLowerCase();
      const rawText = [
        ...toCleanArray(d.objects?.actionsToSolve),
        ...toCleanArray(d.objects?.productsPurchased || d.postAnalysisCodes?.PP),
        ...toCleanArray(d.objects?.foodProducts),
        ...toCleanArray(d.objects?.supplementProducts),
        toCleanString(d.knowledge?.awarenessOnGutHealth),
      ]
        .join(' ')
        .toLowerCase();

      if (solLower.includes('cultured milk')) {
        return rawText.includes('yakult') || rawText.includes('vitagen') || rawText.includes('cultured');
      }
      if (solLower.includes('fiber') || solLower.includes('fruit')) {
        return rawText.includes('fruit') || rawText.includes('papaya') || rawText.includes('banana') || rawText.includes('water') || rawText.includes('fiber') || rawText.includes('vegetable');
      }
      if (solLower.includes('probiotic powder') || solLower.includes('supplement')) {
        return rawText.includes('supplement') || rawText.includes('powder') || rawText.includes('enzyme') || rawText.includes('sachet') || rawText.includes('biogaia') || rawText.includes('bio gaia');
      }
      if (solLower.includes('medical') || solLower.includes('doctor')) {
        return rawText.includes('doctor') || rawText.includes('clinic') || rawText.includes('pediatrician') || rawText.includes('gp');
      }
      if (solLower.includes('formula') || solLower.includes('milk')) {
        return rawText.includes('formula') || rawText.includes('karihome') || rawText.includes('milk');
      }
      return rawText.includes(solLower);
    }

    case 'product_group': {
      const supps = toCleanArray(d.objects?.supplementProducts);
      const foods = toCleanArray(d.objects?.foodProducts);
      if (filter.value === 'supplements') return supps.length > 0;
      if (filter.value === 'foods') return foods.length > 0;
      return true;
    }

    default:
      return true;
  }
};

export const filterRecordsByCrossFilter = (
  records: InterviewRecord[],
  filter: CrossFilterCriteria | null | undefined
): InterviewRecord[] => {
  const decoded = records.filter((r) => Boolean(r.adkotmDecode));
  if (!filter) return decoded;
  return decoded.filter((r) => matchesCrossFilter(r, filter));
};

// ============================================================================
// 1. Executive Signal Overview (Row 1 — 12 Cols)
// ============================================================================

const DIMENSION_META: Record<
  ADKOTMDimensionKey,
  { section: ADKOTMSectionKey; label: string; shortLabel: string; color: string; fieldKeys: string[] }
> = {
  O: {
    section: 'objects',
    label: 'Objects [O] • Products & Brands',
    shortLabel: 'O • Objects',
    color: '#ea580c',
    fieldKeys: ['productsPurchased', 'brandPreferences', 'foodProducts', 'supplementProducts', 'actionsToSolve', 'productPreference'],
  },
  A: {
    section: 'activities',
    label: 'Activities [A] • Routines & Habits',
    shortLabel: 'A • Activities',
    color: '#059669',
    fieldKeys: ['dailyRoutine', 'shoppingBehaviour', 'foodConsumptionBehaviour', 'foodPreparation', 'eatingContext'],
  },
  K: {
    section: 'knowledge',
    label: 'Knowledge [K] • Gut Awareness',
    shortLabel: 'K • Knowledge',
    color: '#4f46e5',
    fieldKeys: ['awarenessOnGutHealth', 'awarenessLevel', 'understandingSummary'],
  },
  D: {
    section: 'demographic',
    label: 'Demographics [D] • Roles & RL',
    shortLabel: 'D • Demographics',
    color: '#0284c7',
    fieldKeys: ['familyRole', 'residentialLocation', 'householdComposition', 'age', 'gender', 'educationLevel'],
  },
  T: {
    section: 'time',
    label: 'Timing [T] • Frequency & Occasions',
    shortLabel: 'T • Timing',
    color: '#e11d48',
    fieldKeys: ['consumptionTiming', 'consumptionFrequency', 'purchaseFrequency', 'purchaseTiming', 'purchaseOccasion'],
  },
  M: {
    section: 'metadata',
    label: 'Metadata [M] • Field Venues IL',
    shortLabel: 'M • Metadata',
    color: '#475569',
    fieldKeys: ['interviewLocation', 'interviewTime'],
  },
};

export const computeExecutiveSignalOverview = (
  records: InterviewRecord[]
): { dimensions: ExecutiveDimensionStat[]; totalEmpiricalSignals: number; avgCompletenessPct: number } => {
  const decoded = records.filter((r) => Boolean(r.adkotmDecode));
  const order: ADKOTMDimensionKey[] = ['O', 'A', 'K', 'D', 'T', 'M'];

  const rawStats = order.map((dim) => {
    const meta = DIMENSION_META[dim];
    let statedSignals = 0;
    let recordsWithSignal = 0;
    const totalPossibleSignals = Math.max(1, decoded.length * meta.fieldKeys.length);

    decoded.forEach((r) => {
      const sectionObj = r.adkotmDecode?.[meta.section] as unknown as Record<string, unknown> | undefined;
      let hasAnyInRecord = false;
      meta.fieldKeys.forEach((fk) => {
        let val = sectionObj?.[fk];
        if (!isSubstantiveValue(val) && fk === 'interviewLocation') {
          val = r.adkotmDecode?.postAnalysisCodes?.IL || r.sessionLocation;
        }
        if (!isSubstantiveValue(val) && fk === 'interviewTime') {
          val = r.sessionDate || r.folderName;
        }
        if (!isSubstantiveValue(val) && fk === 'familyRole') {
          val = r.adkotmDecode?.postAnalysisCodes?.FR;
        }
        if (!isSubstantiveValue(val) && fk === 'residentialLocation') {
          val = r.adkotmDecode?.postAnalysisCodes?.RL;
        }
        if (!isSubstantiveValue(val) && fk === 'productsPurchased') {
          val = r.adkotmDecode?.postAnalysisCodes?.PP;
        }
        if (!isSubstantiveValue(val) && fk === 'brandPreferences') {
          val = r.adkotmDecode?.postAnalysisCodes?.PP1;
        }
        if (!isSubstantiveValue(val) && fk === 'awarenessOnGutHealth') {
          val = r.adkotmDecode?.postAnalysisCodes?.AW;
        }

        if (isSubstantiveValue(val)) {
          statedSignals += 1;
          hasAnyInRecord = true;
        }
      });
      if (hasAnyInRecord) recordsWithSignal += 1;
    });

    const unstatedFields = Math.max(0, totalPossibleSignals - statedSignals);
    const completenessPct = decoded.length > 0 ? Math.round((statedSignals / totalPossibleSignals) * 100) : 0;

    return {
      dimension: dim,
      section: meta.section,
      label: meta.label,
      shortLabel: meta.shortLabel,
      color: meta.color,
      statedSignals,
      unstatedFields,
      totalPossibleSignals: decoded.length > 0 ? totalPossibleSignals : 0,
      completenessPct,
      recordsWithSignal,
    };
  });

  const totalEmpiricalSignals = rawStats.reduce((sum, item) => sum + item.statedSignals, 0);
  const dimensions: ExecutiveDimensionStat[] = rawStats.map((item) => ({
    ...item,
    signalSharePct: totalEmpiricalSignals > 0 ? Math.round((item.statedSignals / totalEmpiricalSignals) * 100) : 0,
  }));

  const avgCompletenessPct =
    dimensions.length > 0
      ? Math.round(dimensions.reduce((sum, d) => sum + d.completenessPct, 0) / dimensions.length)
      : 0;

  return {
    dimensions,
    totalEmpiricalSignals,
    avgCompletenessPct,
  };
};

// ============================================================================
// 2. Objects [O] & Brands (Row 2 — 6 Cols)
// ============================================================================

const BRAND_PALETTE = ['#ea580c', '#f59e0b', '#d97706', '#fb923c', '#b45309', '#c2410c', '#0ea5e9', '#10b981'];

export const computeObjectsBentoData = (records: InterviewRecord[]): ObjectsBentoData => {
  const decoded = records.filter((r) => Boolean(r.adkotmDecode));
  const totalRecords = decoded.length;

  const macroMap = new Map<string, { label: string; color: string; recordIds: Set<string> }>();
  MACRO_CATEGORIES.forEach((cat) => {
    macroMap.set(cat.id, { label: cat.name, color: cat.color, recordIds: new Set() });
  });

  const brandMap = new Map<string, { label: string; recordIds: Set<string> }>();
  let macroStatedRecords = 0;
  let brandStatedRecords = 0;

  // Brand-to-Product Co-occurrence Matrix
  const productColumns = [
    { id: 'probiotic', label: 'Probiotic', color: '#8b5cf6' },
    { id: 'yogurt', label: 'Yogurt', color: '#0ea5e9' },
    { id: 'supplement', label: 'Supplement', color: '#10b981' },
  ];

  const matrixMap = new Map<
    string,
    {
      brand: string;
      normalizedBrand: string;
      primaryCategory: string;
      productType: string;
      countsByProductType: Record<string, Set<string>>;
      allRecordIds: Set<string>;
    }
  >();

  decoded.forEach((r) => {
    const d = r.adkotmDecode;
    if (!d) return;

    const macroIds = getRecordMacroIds(d);
    if (macroIds.length > 0) {
      macroStatedRecords += 1;
      macroIds.forEach((id) => {
        macroMap.get(id)?.recordIds.add(r.id);
      });
    }

    const brands = getRecordBrands(d);
    if (brands.length > 0) {
      brandStatedRecords += 1;
      brands.forEach((brand) => {
        const key = brand.toLowerCase();
        if (!brandMap.has(key)) {
          brandMap.set(key, { label: brand, recordIds: new Set() });
        }
        brandMap.get(key)!.recordIds.add(r.id);

        const meta = classifyBrandToCategory(brand);
        const col = productColumns.some((c) => c.id === meta.categoryName)
          ? meta.categoryName
          : 'supplement';

        if (!matrixMap.has(key)) {
          matrixMap.set(key, {
            brand,
            normalizedBrand: key,
            primaryCategory: meta.categoryName !== 'unclassified' ? meta.categoryName : col,
            productType: meta.productType,
            countsByProductType: {
              probiotic: new Set(),
              yogurt: new Set(),
              supplement: new Set(),
            },
            allRecordIds: new Set(),
          });
        }
        const entry = matrixMap.get(key)!;
        entry.countsByProductType[col].add(r.id);
        entry.allRecordIds.add(r.id);
      });
    }
  });

  const macroItems: RankedBentoItem[] = Array.from(macroMap.entries())
    .map(([id, info]) => {
      const count = info.recordIds.size;
      return {
        key: id,
        label: info.label.replace(/\b\w/g, (c) => c.toUpperCase()),
        count,
        pctOfStated: macroStatedRecords > 0 ? Math.round((count / macroStatedRecords) * 100) : 0,
        color: info.color,
        recordIds: Array.from(info.recordIds),
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const brandItems: RankedBentoItem[] = Array.from(brandMap.entries())
    .map(([key, info], idx) => {
      const count = info.recordIds.size;
      return {
        key,
        label: info.label,
        count,
        pctOfStated: brandStatedRecords > 0 ? Math.round((count / brandStatedRecords) * 100) : 0,
        color: BRAND_PALETTE[idx % BRAND_PALETTE.length],
        recordIds: Array.from(info.recordIds),
        subLabel: classifyBrandToCategory(info.label).categoryName,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const matrixRows: BrandMatrixRow[] = Array.from(matrixMap.values())
    .map((entry) => ({
      brand: entry.brand,
      normalizedBrand: entry.normalizedBrand,
      primaryCategory: entry.primaryCategory,
      productType: entry.productType,
      totalMentions: entry.allRecordIds.size,
      countsByProductType: {
        probiotic: entry.countsByProductType.probiotic.size,
        yogurt: entry.countsByProductType.yogurt.size,
        supplement: entry.countsByProductType.supplement.size,
      },
      recordIdsByProductType: {
        probiotic: Array.from(entry.countsByProductType.probiotic),
        yogurt: Array.from(entry.countsByProductType.yogurt),
        supplement: Array.from(entry.countsByProductType.supplement),
      },
      allRecordIds: Array.from(entry.allRecordIds),
    }))
    .sort((a, b) => b.totalMentions - a.totalMentions || a.brand.localeCompare(b.brand));

  return {
    macroItems,
    macroCoverage: makeCoverage(macroStatedRecords, totalRecords),
    brandItems,
    brandCoverage: makeCoverage(brandStatedRecords, totalRecords),
    brandMatrix: {
      productColumns,
      rows: matrixRows,
      coverage: makeCoverage(brandStatedRecords, totalRecords),
    },
  };
};

// ============================================================================
// 3. Activities & Routines [A] (Row 2 — 6 Cols)
// ============================================================================

export const computeActivitiesBentoData = (records: InterviewRecord[]): ActivitiesBentoData => {
  const decoded = records.filter((r) => Boolean(r.adkotmDecode));
  const totalRecords = decoded.length;
  let statedRecords = 0;

  const activityFields: { key: keyof NonNullable<ADKOTMDecode['activities']>; label: string }[] = [
    { key: 'dailyRoutine', label: 'Daily Routine' },
    { key: 'shoppingBehaviour', label: 'Shopping Behaviour' },
    { key: 'foodConsumptionBehaviour', label: 'Food Consumption' },
    { key: 'foodPreparation', label: 'Food Preparation' },
  ];

  const subFieldMap: Record<string, number> = {
    dailyRoutine: 0,
    shoppingBehaviour: 0,
    foodConsumptionBehaviour: 0,
    foodPreparation: 0,
  };

  const tokenMap = new Map<string, { label: string; fieldKey: string; subLabel: string; recordIds: Set<string> }>();

  decoded.forEach((r) => {
    const acts = r.adkotmDecode?.activities;
    if (!acts) return;
    let hasStated = false;

    activityFields.forEach(({ key, label }) => {
      const val = toCleanString(acts[key]);
      if (!val) return;
      hasStated = true;
      subFieldMap[key] += 1;

      const normKey = val.toLowerCase();
      if (!tokenMap.has(normKey)) {
        tokenMap.set(normKey, { label: val, fieldKey: key, subLabel: label, recordIds: new Set() });
      }
      tokenMap.get(normKey)!.recordIds.add(r.id);
    });

    if (hasStated) statedRecords += 1;
  });

  const items: RankedBentoItem[] = Array.from(tokenMap.entries())
    .map(([key, info]) => ({
      key,
      label: info.label,
      count: info.recordIds.size,
      pctOfStated: statedRecords > 0 ? Math.round((info.recordIds.size / statedRecords) * 100) : 0,
      color: '#059669',
      recordIds: Array.from(info.recordIds),
      subLabel: info.subLabel,
      fieldKey: info.fieldKey,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    items,
    subFieldCounts: activityFields.map((f) => ({
      field: f.key,
      label: f.label,
      count: subFieldMap[f.key] || 0,
    })),
    coverage: makeCoverage(statedRecords, totalRecords),
  };
};

// ============================================================================
// 4. Knowledge & Gut Health Awareness [K] (Row 3 — 4 Cols)
// ============================================================================

export const computeKnowledgeBentoData = (records: InterviewRecord[]): KnowledgeBentoData => {
  const decoded = records.filter((r) => Boolean(r.adkotmDecode));
  const totalRecords = decoded.length;

  let awareCount = 0;
  let notAwareCount = 0;
  let unstatedCount = 0;
  const themeMap = new Map<string, Set<string>>();

  decoded.forEach((r) => {
    const d = r.adkotmDecode;
    const level = resolveAwarenessLevel(d);
    if (level === 'Aware') awareCount += 1;
    else if (level === 'Not Aware') notAwareCount += 1;
    else unstatedCount += 1;

    const text = toCleanString(
      d?.knowledge?.understandingSummary || d?.knowledge?.awarenessOnGutHealth || d?.postAnalysisCodes?.AW
    );
    if (text) {
      const theme = classifyUnderstandingTheme(text);
      if (!themeMap.has(theme)) themeMap.set(theme, new Set());
      themeMap.get(theme)!.add(r.id);
    }
  });

  const statedCount = awareCount + notAwareCount;
  const awarePctOfStated = statedCount > 0 ? Math.round((awareCount / statedCount) * 100) : 0;
  const awarePctOfTotal = totalRecords > 0 ? Math.round((awareCount / totalRecords) * 100) : 0;
  const notAwarePctOfTotal = totalRecords > 0 ? Math.round((notAwareCount / totalRecords) * 100) : 0;
  const unstatedPctOfTotal = totalRecords > 0 ? Math.max(0, 100 - awarePctOfTotal - notAwarePctOfTotal) : 0;

  const themes: RankedBentoItem[] = Array.from(themeMap.entries())
    .map(([label, ids]) => ({
      key: label,
      label,
      count: ids.size,
      pctOfStated: statedCount > 0 ? Math.round((ids.size / statedCount) * 100) : 0,
      color: '#4f46e5',
      recordIds: Array.from(ids),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    awareCount,
    notAwareCount,
    unstatedCount,
    totalRecords,
    awarePctOfStated,
    awarePctOfTotal,
    notAwarePctOfTotal,
    unstatedPctOfTotal,
    themes,
    coverage: makeCoverage(statedCount, totalRecords),
  };
};

// ============================================================================
// 5. Demographics [D] (Row 3 — 4 Cols)
// ============================================================================

const ROLE_COLORS: Record<string, string> = {
  Mum: '#0284c7',
  Dad: '#0369a1',
  Elderly: '#7c3aed',
  Caregiver: '#0d9488',
};

export const computeDemographicsBentoData = (records: InterviewRecord[]): DemographicsBentoData => {
  const decoded = records.filter((r) => Boolean(r.adkotmDecode));
  const totalRecords = decoded.length;

  const roleMap = new Map<string, Set<string>>();
  const rlMap = new Map<string, { label: string; recordIds: Set<string> }>();
  const hhMap = new Map<string, Set<string>>();
  let roleStated = 0;
  let rlStated = 0;

  decoded.forEach((r) => {
    const d = r.adkotmDecode;
    if (!d) return;

    const role = normalizeFamilyRole(d);
    if (role) {
      roleStated += 1;
      if (!roleMap.has(role)) roleMap.set(role, new Set());
      roleMap.get(role)!.add(r.id);
    }

    const rl = getRecordResidence(r);
    if (rl) {
      rlStated += 1;
      const key = rl.toLowerCase();
      if (!rlMap.has(key)) rlMap.set(key, { label: rl, recordIds: new Set() });
      rlMap.get(key)!.recordIds.add(r.id);
    }

    const hh = toCleanString(d.demographic?.householdComposition);
    if (hh) {
      if (!hhMap.has(hh)) hhMap.set(hh, new Set());
      hhMap.get(hh)!.add(r.id);
    }
  });

  const roleItems: RankedBentoItem[] = Array.from(roleMap.entries())
    .map(([label, ids]) => ({
      key: label,
      label,
      count: ids.size,
      pctOfStated: roleStated > 0 ? Math.round((ids.size / roleStated) * 100) : 0,
      color: ROLE_COLORS[label] || '#0ea5e9',
      recordIds: Array.from(ids),
    }))
    .sort((a, b) => b.count - a.count);

  const residenceItems: RankedBentoItem[] = Array.from(rlMap.entries())
    .map(([key, info]) => ({
      key,
      label: info.label,
      count: info.recordIds.size,
      pctOfStated: rlStated > 0 ? Math.round((info.recordIds.size / rlStated) * 100) : 0,
      color: '#0284c7',
      recordIds: Array.from(info.recordIds),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const householdTags: RankedBentoItem[] = Array.from(hhMap.entries())
    .map(([label, ids]) => ({
      key: label,
      label,
      count: ids.size,
      pctOfStated: decoded.length > 0 ? Math.round((ids.size / decoded.length) * 100) : 0,
      color: '#38bdf8',
      recordIds: Array.from(ids),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    roleItems,
    roleCoverage: makeCoverage(roleStated, totalRecords),
    residenceItems,
    residenceCoverage: makeCoverage(rlStated, totalRecords),
    householdTags,
  };
};

// ============================================================================
// 6. Timing & Frequency [T] (Row 3 — 4 Cols)
// ============================================================================

export const computeTimingBentoData = (records: InterviewRecord[]): TimingBentoData => {
  const decoded = records.filter((r) => Boolean(r.adkotmDecode));
  const totalRecords = decoded.length;
  let statedRecords = 0;

  const bucketRecords = new Map<string, Set<string>>();
  TIMING_BUCKETS.forEach((b) => bucketRecords.set(b.label, new Set()));

  decoded.forEach((r) => {
    const t = r.adkotmDecode?.time;
    if (!t) return;
    const rawValues = [
      t.consumptionTiming,
      t.consumptionFrequency,
      t.purchaseFrequency,
      t.purchaseTiming,
      t.purchaseOccasion,
    ]
      .map((v) => toCleanString(v))
      .filter(Boolean);

    if (rawValues.length > 0) {
      statedRecords += 1;
      rawValues.forEach((v) => {
        const bucketLabel = classifyTimingBucket(v);
        bucketRecords.get(bucketLabel)?.add(r.id);
      });
    }
  });

  const buckets: RankedBentoItem[] = TIMING_BUCKETS.map((b) => {
    const ids = bucketRecords.get(b.label) || new Set<string>();
    return {
      key: b.label,
      label: b.label,
      count: ids.size,
      pctOfStated: statedRecords > 0 ? Math.round((ids.size / statedRecords) * 100) : 0,
      color: b.color,
      recordIds: Array.from(ids),
    };
  })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    buckets,
    coverage: makeCoverage(statedRecords, totalRecords),
  };
};

// ============================================================================
// 7. Metadata & Field Venues [M] (Row 4 — 6 Cols)
// ============================================================================

export const computeMetadataBentoData = (records: InterviewRecord[]): MetadataBentoData => {
  const decoded = records.filter((r) => Boolean(r.adkotmDecode));
  const totalRecords = decoded.length;
  let statedRecords = 0;
  let totalAllSignals = 0;

  const venueMap = new Map<string, { label: string; recordIds: Set<string>; totalSignals: number }>();

  decoded.forEach((r) => {
    const sigCount = countRecordSignals(r);
    totalAllSignals += sigCount;

    const venue = getRecordVenue(r);
    if (venue) {
      statedRecords += 1;
      const key = venue.toLowerCase();
      if (!venueMap.has(key)) {
        venueMap.set(key, { label: venue, recordIds: new Set(), totalSignals: 0 });
      }
      const entry = venueMap.get(key)!;
      entry.recordIds.add(r.id);
      entry.totalSignals += sigCount;
    }
  });

  const venues: MetadataVenueItem[] = Array.from(venueMap.values())
    .map((entry) => {
      const interviewCount = entry.recordIds.size;
      const avgSignals = interviewCount > 0 ? Number((entry.totalSignals / interviewCount).toFixed(1)) : 0;
      return {
        venue: entry.label,
        interviewCount,
        avgSignals,
        totalSignals: entry.totalSignals,
        pctOfStated: statedRecords > 0 ? Math.round((interviewCount / statedRecords) * 100) : 0,
        recordIds: Array.from(entry.recordIds),
      };
    })
    .sort((a, b) => b.interviewCount - a.interviewCount || b.avgSignals - a.avgSignals);

  const overallAvgSignals = decoded.length > 0 ? Number((totalAllSignals / decoded.length).toFixed(1)) : 0;

  return {
    venues,
    coverage: makeCoverage(statedRecords, totalRecords),
    overallAvgSignals,
  };
};

// ============================================================================
// 8. Empathy Studies Summary (Row 4 — 6 Cols)
// ============================================================================

export const computeEmpathySummaryData = (records: InterviewRecord[]): EmpathySummaryData => {
  const decoded = records.filter((r) => Boolean(r.adkotmDecode));
  const totalRecords = decoded.length;

  let mumTotal = 0;
  let mumAware = 0;
  let mumNotAware = 0;
  let mumUnstated = 0;

  let eldTotal = 0;
  let eldAware = 0;
  let eldNotAware = 0;
  let eldUnstated = 0;

  let supplementsCount = 0;
  let foodProductsCount = 0;
  let statedEmpathyRecords = 0;

  const solutionMap = new Map<string, Set<string>>([
    ['Cultivated Milk Drinks', new Set()],
    ['Dietary Fiber & Fruit', new Set()],
    ['Probiotic Powders & Supplements', new Set()],
    ['Formula / Milk Switching', new Set()],
    ['Medical / GP Consultation', new Set()],
  ]);

  decoded.forEach((r) => {
    const d = r.adkotmDecode;
    if (!d) return;

    const role = normalizeFamilyRole(d);
    const awLevel = resolveAwarenessLevel(d);

    if (role === 'Mum') {
      mumTotal += 1;
      if (awLevel === 'Aware') mumAware += 1;
      else if (awLevel === 'Not Aware') mumNotAware += 1;
      else mumUnstated += 1;
    } else if (role === 'Elderly') {
      eldTotal += 1;
      if (awLevel === 'Aware') eldAware += 1;
      else if (awLevel === 'Not Aware') eldNotAware += 1;
      else eldUnstated += 1;
    }

    const supps = toCleanArray(d.objects?.supplementProducts);
    const foods = toCleanArray(d.objects?.foodProducts);
    supplementsCount += supps.length;
    foodProductsCount += foods.length;

    const rawText = [
      ...toCleanArray(d.objects?.actionsToSolve),
      ...toCleanArray(d.objects?.productsPurchased || d.postAnalysisCodes?.PP),
      ...foods,
      ...supps,
      toCleanString(d.knowledge?.awarenessOnGutHealth),
    ]
      .join(' ')
      .toLowerCase();

    let hadSolution = false;
    if (rawText.includes('yakult') || rawText.includes('vitagen') || rawText.includes('cultured')) {
      solutionMap.get('Cultivated Milk Drinks')!.add(r.id);
      hadSolution = true;
    }
    if (rawText.includes('fruit') || rawText.includes('papaya') || rawText.includes('banana') || rawText.includes('water') || rawText.includes('vegetable')) {
      solutionMap.get('Dietary Fiber & Fruit')!.add(r.id);
      hadSolution = true;
    }
    if (rawText.includes('supplement') || rawText.includes('powder') || rawText.includes('enzyme') || rawText.includes('biogaia') || rawText.includes('bio gaia')) {
      solutionMap.get('Probiotic Powders & Supplements')!.add(r.id);
      hadSolution = true;
    }
    if (rawText.includes('formula') || rawText.includes('karihome') || rawText.includes('milk')) {
      solutionMap.get('Formula / Milk Switching')!.add(r.id);
      hadSolution = true;
    }
    if (rawText.includes('doctor') || rawText.includes('clinic') || rawText.includes('pediatrician')) {
      solutionMap.get('Medical / GP Consultation')!.add(r.id);
      hadSolution = true;
    }

    if (awLevel !== null || supps.length > 0 || foods.length > 0 || hadSolution) {
      statedEmpathyRecords += 1;
    }
  });

  const mumStated = mumAware + mumNotAware;
  const eldStated = eldAware + eldNotAware;

  const totalProducts = supplementsCount + foodProductsCount;
  const supplementsPct = totalProducts > 0 ? Math.round((supplementsCount / totalProducts) * 100) : 0;
  const foodsPct = totalProducts > 0 ? Math.max(0, 100 - supplementsPct) : 0;

  const topSolutions: RankedBentoItem[] = Array.from(solutionMap.entries())
    .map(([label, ids]) => ({
      key: label,
      label,
      count: ids.size,
      pctOfStated: statedEmpathyRecords > 0 ? Math.round((ids.size / statedEmpathyRecords) * 100) : 0,
      color: '#7c3aed',
      recordIds: Array.from(ids),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    cohorts: [
      {
        cohort: 'Mummies',
        roleKey: 'Mum',
        total: mumTotal,
        aware: mumAware,
        notAware: mumNotAware,
        unstated: mumUnstated,
        awarenessRate: mumStated > 0 ? Math.round((mumAware / mumStated) * 100) : 0,
      },
      {
        cohort: 'Elderly',
        roleKey: 'Elderly',
        total: eldTotal,
        aware: eldAware,
        notAware: eldNotAware,
        unstated: eldUnstated,
        awarenessRate: eldStated > 0 ? Math.round((eldAware / eldStated) * 100) : 0,
      },
    ],
    supplementsCount,
    foodProductsCount,
    supplementsPct,
    foodsPct,
    topSolutions,
    coverage: makeCoverage(statedEmpathyRecords, totalRecords),
  };
};

// ============================================================================
// 9. Verbatim Quote Evidence Extractor (Slide-Over Drawer)
// ============================================================================

const SECTION_TO_DIM: Record<ADKOTMSectionKey, ADKOTMDimensionKey> = {
  activities: 'A',
  demographic: 'D',
  knowledge: 'K',
  objects: 'O',
  time: 'T',
  metadata: 'M',
};

export interface EvidenceQuery {
  title: string;
  subtitle?: string;
  dimension?: ADKOTMDimensionKey | 'ALL';
  filter?: CrossFilterCriteria | null;
  recordIds?: string[];
  fieldKeys?: string[];
  searchToken?: string;
}

export const extractEvidenceQuotes = (
  records: InterviewRecord[],
  query: EvidenceQuery
): EvidenceQuoteItem[] => {
  const candidateRecords = records.filter((r) => {
    if (!r.adkotmDecode) return false;
    if (query.recordIds && query.recordIds.length > 0 && !query.recordIds.includes(r.id)) {
      return false;
    }
    if (query.filter && !matchesCrossFilter(r, query.filter)) {
      return false;
    }
    return true;
  });

  const results: EvidenceQuoteItem[] = [];
  const seenKey = new Set<string>();

  const targetFieldSet = query.fieldKeys && query.fieldKeys.length > 0 ? new Set(query.fieldKeys) : null;
  const searchLower = query.searchToken?.trim().toLowerCase() || '';

  candidateRecords.forEach((record) => {
    const d = record.adkotmDecode;
    if (!d) return;

    // 1. Structured fieldStates from Human-Copilot review workspace
    if (d.fieldStates) {
      Object.entries(d.fieldStates).forEach(([fieldKey, item]) => {
        if (!item) return;
        const quote = toCleanString(item.evidence_quote);
        const code = toCleanString(item.code);
        if (!quote) return;

        const catalogMeta = ADKOTM_FIELD_CATALOG.find((m) => m.field === fieldKey);
        const dim: ADKOTMDimensionKey = catalogMeta ? SECTION_TO_DIM[catalogMeta.section] : 'O';
        const fieldLabel = catalogMeta?.label || fieldKey;

        if (query.dimension && query.dimension !== 'ALL' && dim !== query.dimension) return;
        if (targetFieldSet && !targetFieldSet.has(fieldKey)) return;
        if (
          searchLower &&
          !code.toLowerCase().includes(searchLower) &&
          !quote.toLowerCase().includes(searchLower)
        ) {
          // If query also has recordIds or filter, keep quotes inside matching dimension unless searchToken specifically mismatches non-matching field
          return;
        }

        const dedupeKey = `${record.id}::${fieldKey}::${quote.toLowerCase()}`;
        if (seenKey.has(dedupeKey)) return;
        seenKey.add(dedupeKey);

        results.push({
          id: dedupeKey,
          recordId: record.id,
          fileName: record.fileName,
          folderName: record.folderName || record.sessionDate || '',
          dimension: dim,
          fieldKey,
          fieldLabel,
          code: code || fieldLabel,
          quote,
          source: item.source || 'verified',
        });
      });
    }

    // 2. Fallback / supplemental evidenceQuotes array
    if (Array.isArray(d.evidenceQuotes)) {
      d.evidenceQuotes.forEach((eq, idx) => {
        const quote = toCleanString(eq.quote);
        const code = toCleanString(eq.code);
        if (!quote) return;

        const fieldKey = eq.field || 'evidence';
        const catalogMeta = ADKOTM_FIELD_CATALOG.find((m) => m.field === fieldKey);
        const dim: ADKOTMDimensionKey = catalogMeta
          ? SECTION_TO_DIM[catalogMeta.section]
          : query.dimension && query.dimension !== 'ALL'
          ? query.dimension
          : 'O';

        if (query.dimension && query.dimension !== 'ALL' && dim !== query.dimension) return;
        if (targetFieldSet && !targetFieldSet.has(fieldKey)) return;
        if (
          searchLower &&
          !code.toLowerCase().includes(searchLower) &&
          !quote.toLowerCase().includes(searchLower)
        ) {
          return;
        }

        const dedupeKey = `${record.id}::${fieldKey}::${quote.toLowerCase()}`;
        if (seenKey.has(dedupeKey)) return;
        seenKey.add(dedupeKey);

        results.push({
          id: `${dedupeKey}::${idx}`,
          recordId: record.id,
          fileName: record.fileName,
          folderName: record.folderName || record.sessionDate || '',
          dimension: dim,
          fieldKey,
          fieldLabel: catalogMeta?.label || eq.field || 'Verbatim Quote',
          code: code || 'Verified Quote',
          quote,
          source: 'transcript',
        });
      });
    }
  });

  // If searchToken was too strict and returned 0 while matching records exist, broaden within the target dimension
  if (results.length === 0 && searchLower) {
    return extractEvidenceQuotes(candidateRecords, {
      ...query,
      searchToken: undefined,
    });
  }

  return results;
};

// ============================================================================
// 10. Single-Source-of-Truth Traceable Dimension Engine (Folder Tabs + Audit)
// ============================================================================

export interface TraceableContributor {
  recordId: string;
  fileName: string;
  folderName: string;
  fieldKey: string;
  fieldLabel: string;
  code: string;
  quote: string | null;
}

export interface TraceableBreakdownItem {
  key: string;
  label: string;
  dimension: ADKOTMDimensionKey;
  fieldKey: string;
  fieldLabel: string;
  count: number;
  statedCount: number;
  unstatedCount: number;
  totalRecords: number;
  validPct: number;
  totalPct: number;
  formulaText: string;
  totalContextText: string;
  color: string;
  contributors: TraceableContributor[];
  isCustom?: boolean;
  customCategoryId?: string;
}

export interface TraceableGroup {
  id: string;
  title: string;
  subtitle: string;
  dimension: ADKOTMDimensionKey;
  fieldKey: string;
  chartKind: 'horizontal_bar' | 'stacked_100';
  statedCount: number;
  unstatedCount: number;
  totalRecords: number;
  validCoveragePct: number;
  items: TraceableBreakdownItem[];
  infoTooltipTitle?: string;
  infoTooltipBody?: string;
}

export interface TraceableDimensionDataset {
  dimension: ADKOTMDimensionKey;
  totalRecords: number;
  totalSignals: number;
  groups: TraceableGroup[];
}

const formatPct = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  const raw = (numerator / denominator) * 100;
  return Number.isInteger(raw) ? raw : Number(raw.toFixed(1));
};

const getRecordFieldQuote = (
  record: InterviewRecord,
  fieldKey: string,
  fallbackFieldKeys: string[] = []
): string | null => {
  const d = record.adkotmDecode;
  if (!d) return null;

  const keysToTry = [fieldKey, ...fallbackFieldKeys];
  for (const k of keysToTry) {
    const q = toCleanString(d.fieldStates?.[k]?.evidence_quote);
    if (q) return q;
  }

  if (Array.isArray(d.evidenceQuotes)) {
    for (const k of keysToTry) {
      const match = d.evidenceQuotes.find((eq) => eq.field === k && toCleanString(eq.quote));
      if (match) return toCleanString(match.quote);
    }
  }

  return null;
};

const buildGroupFromExtractor = (params: {
  id: string;
  title: string;
  subtitle: string;
  dimension: ADKOTMDimensionKey;
  fieldKey: string;
  fieldLabel: string;
  chartKind: 'horizontal_bar' | 'stacked_100';
  records: InterviewRecord[];
  accentPalette: string[];
  extractTokens: (r: InterviewRecord) => {
    label: string;
    fieldKey?: string;
    color?: string;
    fallbackQuotes?: string[];
  }[];
  customCategories?: CustomTaxonomyCategory[];
  includeNullSegmentInItems?: boolean;
  infoTooltipTitle?: string;
  infoTooltipBody?: string;
}): TraceableGroup => {
  const decoded = params.records.filter((r) => Boolean(r.adkotmDecode));
  const totalRecords = decoded.length;
  let statedCount = 0;

  const bucketMap = new Map<
    string,
    {
      label: string;
      fieldKey: string;
      color?: string;
      contributors: TraceableContributor[];
      seenRecordIds: Set<string>;
    }
  >();

  const nullContributors: TraceableContributor[] = [];

  decoded.forEach((record) => {
    const tokens = params.extractTokens(record).filter((t) => Boolean(toCleanString(t.label)));
    if (tokens.length === 0) {
      nullContributors.push({
        recordId: record.id,
        fileName: record.fileName,
        folderName: record.folderName || record.sessionDate || '',
        fieldKey: params.fieldKey,
        fieldLabel: params.fieldLabel,
        code: 'null (unstated)',
        quote: null,
      });
      return;
    }

    statedCount += 1;
    const seenInRecord = new Set<string>();

    tokens.forEach((tok) => {
      const cleanLabel = tok.label.trim();
      const normKey = cleanLabel.toLowerCase();
      if (seenInRecord.has(normKey)) return;
      seenInRecord.add(normKey);

      const fk = tok.fieldKey || params.fieldKey;
      if (!bucketMap.has(normKey)) {
        bucketMap.set(normKey, {
          label: cleanLabel,
          fieldKey: fk,
          color: tok.color,
          contributors: [],
          seenRecordIds: new Set(),
        });
      }
      const entry = bucketMap.get(normKey)!;
      if (!entry.seenRecordIds.has(record.id)) {
        entry.seenRecordIds.add(record.id);
        entry.contributors.push({
          recordId: record.id,
          fileName: record.fileName,
          folderName: record.folderName || record.sessionDate || '',
          fieldKey: fk,
          fieldLabel: params.fieldLabel,
          code: cleanLabel,
          quote: getRecordFieldQuote(record, fk, tok.fallbackQuotes || []),
        });
      }
    });
  });

  const unstatedCount = Math.max(0, totalRecords - statedCount);

  const items: TraceableBreakdownItem[] = Array.from(bucketMap.entries())
    .map(([key, info], idx) => {
      const count = info.contributors.length;
      const validPct = formatPct(count, statedCount);
      const totalPct = formatPct(count, totalRecords);
      const customMatch = params.customCategories?.find(
        (c) =>
          c.dimension === params.dimension &&
          (c.fieldKey === info.fieldKey || c.fieldKey === params.fieldKey) &&
          c.name.toLowerCase() === info.label.toLowerCase()
      );
      return {
        key,
        label: info.label,
        dimension: params.dimension,
        fieldKey: info.fieldKey,
        fieldLabel: params.fieldLabel,
        count,
        statedCount,
        unstatedCount,
        totalRecords,
        validPct,
        totalPct,
        formulaText: `Count: ${count} / ${statedCount} stated record${statedCount === 1 ? '' : 's'} = ${validPct}%`,
        totalContextText: `${count}/${totalRecords} total records · ${unstatedCount} unstated`,
        color: info.color || params.accentPalette[idx % params.accentPalette.length],
        contributors: info.contributors,
        isCustom: Boolean(customMatch),
        customCategoryId: customMatch?.id,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  if (params.includeNullSegmentInItems && unstatedCount > 0) {
    const nullPctOfTotal = formatPct(unstatedCount, totalRecords);
    items.push({
      key: '__null__',
      label: 'Unstated (Null)',
      dimension: params.dimension,
      fieldKey: params.fieldKey,
      fieldLabel: params.fieldLabel,
      count: unstatedCount,
      statedCount,
      unstatedCount,
      totalRecords,
      validPct: 0,
      totalPct: nullPctOfTotal,
      formulaText: `Unstated: ${unstatedCount} / ${totalRecords} total records = ${nullPctOfTotal}%`,
      totalContextText: `${unstatedCount}/${totalRecords} unstated (excluded from Valid %)`,
      color: '#e7e5e4',
      contributors: nullContributors,
    });
  }

  return {
    id: params.id,
    title: params.title,
    subtitle: params.subtitle,
    dimension: params.dimension,
    fieldKey: params.fieldKey,
    chartKind: params.chartKind,
    statedCount,
    unstatedCount,
    totalRecords,
    validCoveragePct: formatPct(statedCount, totalRecords),
    items,
    infoTooltipTitle: params.infoTooltipTitle,
    infoTooltipBody: params.infoTooltipBody,
  };
};

export const computeTraceableDimensionDataset = (
  records: InterviewRecord[],
  dimension: ADKOTMDimensionKey,
  customCategories: CustomTaxonomyCategory[] = []
): TraceableDimensionDataset => {
  const decoded = records.filter((r) => Boolean(r.adkotmDecode));
  const totalRecords = decoded.length;
  const groups: TraceableGroup[] = [];

  if (dimension === 'O') {
    groups.push(
      buildGroupFromExtractor({
        id: 'o_products_pp',
        title: 'Products Purchased [PP]',
        subtitle: 'Standardized product codes & macro categories extracted to solve gut issues',
        dimension: 'O',
        fieldKey: 'productsPurchased',
        fieldLabel: 'Products Purchased [PP]',
        chartKind: 'horizontal_bar',
        records: decoded,
        accentPalette: ['#ea580c', '#f97316', '#f59e0b', '#d97706', '#fb923c', '#b45309'],
        customCategories,
        extractTokens: (r) => {
          const raw = toCleanArray(r.adkotmDecode?.postAnalysisCodes?.PP || r.adkotmDecode?.objects?.productsPurchased);
          return raw.map((label) => ({
            label,
            fieldKey: 'productsPurchased',
            fallbackQuotes: ['foodProducts', 'supplementProducts', 'brandPreferences'],
          }));
        },
      })
    );

    groups.push(
      buildGroupFromExtractor({
        id: 'o_brands_pp1',
        title: 'Brand Preferences [PP1]',
        subtitle: 'Specific brands mentioned across interviews (click any bar or row to trace quotes)',
        dimension: 'O',
        fieldKey: 'brandPreferences',
        fieldLabel: 'Brand Preferences [PP1]',
        chartKind: 'horizontal_bar',
        records: decoded,
        accentPalette: ['#0284c7', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#e11d48'],
        customCategories,
        extractTokens: (r) => {
          const raw = toCleanArray(r.adkotmDecode?.postAnalysisCodes?.PP1 || r.adkotmDecode?.objects?.brandPreferences);
          return raw.map((label) => ({
            label,
            fieldKey: 'brandPreferences',
            fallbackQuotes: ['productsPurchased', 'foodProducts', 'supplementProducts'],
          }));
        },
      })
    );
  } else if (dimension === 'A') {
    groups.push(
      buildGroupFromExtractor({
        id: 'a_routines',
        title: 'Activities, Shopping & Consumption Routines [A]',
        subtitle: 'Daily routines, shopping habits, food consumption & preparation behaviors',
        dimension: 'A',
        fieldKey: 'dailyRoutine',
        fieldLabel: 'Activities [A]',
        chartKind: 'horizontal_bar',
        records: decoded,
        accentPalette: ['#059669', '#10b981', '#0d9488', '#14b8a6', '#34d399'],
        customCategories,
        extractTokens: (r) => {
          const acts = r.adkotmDecode?.activities;
          if (!acts) return [];
          const out: { label: string; fieldKey: string }[] = [];
          (
            [
              'dailyRoutine',
              'shoppingBehaviour',
              'foodConsumptionBehaviour',
              'foodPreparation',
              'eatingContext',
            ] as const
          ).forEach((fk) => {
            const val = toCleanString(acts[fk]);
            if (val) out.push({ label: val, fieldKey: fk });
          });
          return out;
        },
      })
    );
  } else if (dimension === 'K') {
    groups.push(
      buildGroupFromExtractor({
        id: 'k_awareness_aw',
        title: 'Gut Health Awareness [AW]',
        subtitle: '100% stacked comparison contrasting Aware vs. Not Aware vs. Unstated (Null)',
        dimension: 'K',
        fieldKey: 'awarenessLevel',
        fieldLabel: 'Awareness Level [AW]',
        chartKind: 'stacked_100',
        records: decoded,
        accentPalette: ['#10b981', '#f59e0b'],
        customCategories,
        includeNullSegmentInItems: true,
        extractTokens: (r) => {
          const level = resolveAwarenessLevel(r.adkotmDecode);
          if (!level) return [];
          return [
            {
              label: level,
              fieldKey: 'awarenessLevel',
              color: level === 'Aware' ? '#10b981' : '#f59e0b',
              fallbackQuotes: ['awarenessOnGutHealth', 'understandingSummary'],
            },
          ];
        },
      })
    );

    groups.push(
      buildGroupFromExtractor({
        id: 'k_themes',
        title: 'Qualitative Understanding Themes [K]',
        subtitle: 'Mental models and beliefs cited by participants with stated gut health knowledge',
        dimension: 'K',
        fieldKey: 'understandingSummary',
        fieldLabel: 'Understanding Summary',
        chartKind: 'horizontal_bar',
        records: decoded,
        accentPalette: ['#4f46e5', '#6366f1', '#818cf8', '#4338ca'],
        customCategories,
        extractTokens: (r) => {
          const text = toCleanString(
            r.adkotmDecode?.knowledge?.understandingSummary ||
              r.adkotmDecode?.knowledge?.awarenessOnGutHealth ||
              r.adkotmDecode?.postAnalysisCodes?.AW
          );
          if (!text) return [];
          return [
            {
              label: classifyUnderstandingTheme(text),
              fieldKey: 'understandingSummary',
              fallbackQuotes: ['awarenessOnGutHealth'],
            },
          ];
        },
      })
    );
  } else if (dimension === 'D') {
    groups.push(
      buildGroupFromExtractor({
        id: 'd_family_role_fr',
        title: 'Family Role [FR]',
        subtitle: '100% stacked participant role breakdown excluding Null from Valid %',
        dimension: 'D',
        fieldKey: 'familyRole',
        fieldLabel: 'Family Role [FR]',
        chartKind: 'stacked_100',
        records: decoded,
        accentPalette: ['#0284c7', '#0369a1', '#7c3aed', '#0d9488'],
        customCategories,
        includeNullSegmentInItems: true,
        extractTokens: (r) => {
          const role = normalizeFamilyRole(r.adkotmDecode);
          if (!role) return [];
          return [
            {
              label: role,
              fieldKey: 'familyRole',
              color: ROLE_COLORS[role] || '#0ea5e9',
            },
          ];
        },
      })
    );

    groups.push(
      buildGroupFromExtractor({
        id: 'd_residence_rl',
        title: 'Residential Location [RL]',
        subtitle: 'Participant home districts strictly separated from retail interview venues [IL]',
        dimension: 'D',
        fieldKey: 'residentialLocation',
        fieldLabel: 'Residential Location [RL]',
        chartKind: 'horizontal_bar',
        records: decoded,
        accentPalette: ['#0284c7', '#0ea5e9', '#38bdf8', '#0369a1'],
        customCategories,
        infoTooltipTitle: 'Separated Qualitative Architecture: RL vs IL',
        infoTooltipBody:
          'Residential Location [RL] inside Demographic [D] tracks participant home townships (e.g., Kepong, Shah Alam). Retail shopping malls where interviews occurred are strictly isolated inside Metadata [M] as Interview Location [IL].',
        extractTokens: (r) => {
          const rl = getRecordResidence(r);
          return rl ? [{ label: rl, fieldKey: 'residentialLocation' }] : [];
        },
      })
    );
  } else if (dimension === 'T') {
    const timingGroup = buildGroupFromExtractor({
      id: 't_cadence',
      title: 'Consumption Timing & Purchase Frequency [T]',
      subtitle: 'Ordered cadence spectrum from daily habit strength down to periodic/trigger use',
      dimension: 'T',
      fieldKey: 'consumptionTiming',
      fieldLabel: 'Timing & Frequency [T]',
      chartKind: 'horizontal_bar',
      records: decoded,
      accentPalette: ['#be123c', '#e11d48', '#f43f5e', '#fb7185', '#fda4af'],
      customCategories,
      extractTokens: (r) => {
        const t = r.adkotmDecode?.time;
        if (!t) return [];
        const rawVals = [
          { val: toCleanString(t.consumptionTiming), fk: 'consumptionTiming' },
          { val: toCleanString(t.consumptionFrequency), fk: 'consumptionFrequency' },
          { val: toCleanString(t.purchaseFrequency), fk: 'purchaseFrequency' },
          { val: toCleanString(t.purchaseTiming), fk: 'purchaseTiming' },
          { val: toCleanString(t.purchaseOccasion), fk: 'purchaseOccasion' },
        ].filter((x) => Boolean(x.val));

        return rawVals.map((x) => {
          const bucketLabel = classifyTimingBucket(x.val);
          const bucketMeta = TIMING_BUCKETS.find((b) => b.label === bucketLabel);
          return {
            label: bucketLabel,
            fieldKey: x.fk,
            color: bucketMeta?.color,
            fallbackQuotes: ['consumptionTiming', 'consumptionFrequency', 'purchaseFrequency'],
          };
        });
      },
    });
    timingGroup.items = sortTimingItemsByCadence(timingGroup.items);
    groups.push(timingGroup);
  } else if (dimension === 'M') {
    groups.push(
      buildGroupFromExtractor({
        id: 'm_venues_il',
        title: 'Interview Location [IL] • Field Venues',
        subtitle: 'External retail venues where interviews took place (strictly separate from RL)',
        dimension: 'M',
        fieldKey: 'interviewLocation',
        fieldLabel: 'Interview Location [IL]',
        chartKind: 'horizontal_bar',
        records: decoded,
        accentPalette: ['#334155', '#475569', '#64748b', '#0f172a'],
        customCategories,
        infoTooltipTitle: 'Separated Qualitative Architecture: IL vs RL',
        infoTooltipBody:
          'Interview Location [IL] inside Metadata [M] records the field retail site (e.g., AEON Mall Shah Alam, Jaya Grocer Elmina). Participant home districts remain strictly separated inside Demographic [D] as Residential Location [RL].',
        extractTokens: (r) => {
          const venue = getRecordVenue(r);
          return venue ? [{ label: venue, fieldKey: 'interviewLocation' }] : [];
        },
      })
    );
  }

  // Append dedicated groups for any user-created custom parameters under this dimension
  const customParams = customCategories.filter(
    (c) => c.dimension === dimension && c.kind === 'parameter'
  );
  customParams.forEach((param) => {
    groups.push(
      buildGroupFromExtractor({
        id: `custom_param_${param.id}`,
        title: `${param.name}${param.shortCode ? ` [${param.shortCode}]` : ''}`,
        subtitle: `Custom ${dimension} parameter persisted in taxonomy manager`,
        dimension,
        fieldKey: param.fieldKey,
        fieldLabel: param.shortCode ? `${param.name} [${param.shortCode}]` : param.name,
        chartKind: 'horizontal_bar',
        records: decoded,
        accentPalette: ['#d97706', '#f59e0b', '#b45309', '#78350f'],
        customCategories,
        extractTokens: (r) => {
          const customVal =
            toCleanString(r.adkotmDecode?.fieldStates?.[param.fieldKey]?.code) ||
            toCleanString(r.adkotmDecode?.customFields?.[param.fieldKey]);
          if (!customVal) return [];
          return customVal.split(/[,;\n]+/).map((tok) => ({
            label: tok.trim(),
            fieldKey: param.fieldKey,
          }));
        },
      })
    );
  });

  const totalSignals = groups.reduce(
    (sum, g) => sum + g.items.filter((i) => i.key !== '__null__').reduce((s, i) => s + i.count, 0),
    0
  );

  return {
    dimension,
    totalRecords,
    totalSignals,
    groups,
  };
};

export const computeFolderTabSignalCounts = (
  records: InterviewRecord[],
  customCategories: CustomTaxonomyCategory[] = []
): Record<'overview' | ADKOTMDimensionKey, number> => {
  const dims: ADKOTMDimensionKey[] = ['O', 'A', 'K', 'D', 'T', 'M'];
  const counts: Record<'overview' | ADKOTMDimensionKey, number> = {
    overview: 0,
    O: 0,
    A: 0,
    K: 0,
    D: 0,
    T: 0,
    M: 0,
  };

  dims.forEach((dim) => {
    const ds = computeTraceableDimensionDataset(records, dim, customCategories);
    counts[dim] = ds.totalSignals;
    counts.overview += ds.totalSignals;
  });

  return counts;
};

// ============================================================================
// 11. Purpose-Built Theme Insights Helpers (Executive, Unified O, Co-occurrence A)
// ============================================================================

export const computeExecutiveCoverageRows = (
  datasetsByDim: Record<ADKOTMDimensionKey, TraceableDimensionDataset>,
  totalRecords: number
): ExecutiveCoverageRow[] => {
  const order: ADKOTMDimensionKey[] = ['O', 'A', 'K', 'D', 'T', 'M'];
  return order.map((dim) => {
    const ds = datasetsByDim[dim];
    const statedIds = new Set<string>();
    ds.groups.forEach((group) => {
      group.items.forEach((item) => {
        if (item.key === '__null__') return;
        item.contributors.forEach((c) => statedIds.add(c.recordId));
      });
    });
    const statedCount = Math.min(totalRecords, statedIds.size);
    const unstatedCount = Math.max(0, totalRecords - statedCount);
    const statedPct = totalRecords > 0 ? Math.round((statedCount / totalRecords) * 100) : 0;
    const unstatedPct = totalRecords > 0 ? Math.max(0, 100 - statedPct) : 0;

    return {
      dimension: dim,
      label: DIMENSION_META[dim].label.split('•')[0].trim(),
      statedCount,
      unstatedCount,
      totalRecords,
      statedPct,
      unstatedPct,
      totalSignals: ds.totalSignals,
      color: DIMENSION_META[dim].color,
    };
  });
};

const isLikelyCommercialBrand = (label: string, fromBrandsGroup: boolean): boolean => {
  if (fromBrandsGroup) return true;
  const norm = normalizeQualitativeToken(label);
  if (!norm) return false;
  return KNOWN_BRANDS.some((kb) => norm.includes(kb.normalizedBrand));
};

export const computeUnifiedObjectsChartData = (
  objectsDataset: TraceableDimensionDataset
): { items: UnifiedObjectItem[]; statedCount: number; unstatedCount: number; totalRecords: number; validCoveragePct: number } => {
  const productsGroup = objectsDataset.groups.find((g) => g.id === 'o_products_pp');
  const brandsGroup = objectsDataset.groups.find((g) => g.id === 'o_brands_pp1');

  const merged = new Map<
    string,
    {
      label: string;
      objectKind: 'brand' | 'food';
      fieldKey: string;
      fieldLabel: string;
      contributorsMap: Map<string, TraceableContributor>;
    }
  >();

  const absorbGroup = (group: TraceableGroup | undefined, isBrandsGroup: boolean) => {
    if (!group) return;
    group.items.forEach((item) => {
      if (item.key === '__null__') return;
      const normKey = item.label.trim().toLowerCase();
      const kind: 'brand' | 'food' = isLikelyCommercialBrand(item.label, isBrandsGroup)
        ? 'brand'
        : 'food';

      if (!merged.has(normKey)) {
        merged.set(normKey, {
          label: item.label,
          objectKind: kind,
          fieldKey: item.fieldKey,
          fieldLabel: item.fieldLabel,
          contributorsMap: new Map(),
        });
      }
      const entry = merged.get(normKey)!;
      if (kind === 'brand') entry.objectKind = 'brand';
      item.contributors.forEach((c) => {
        if (!entry.contributorsMap.has(c.recordId)) {
          entry.contributorsMap.set(c.recordId, c);
        } else if (!entry.contributorsMap.get(c.recordId)!.quote && c.quote) {
          entry.contributorsMap.set(c.recordId, c);
        }
      });
    });
  };

  absorbGroup(productsGroup, false);
  absorbGroup(brandsGroup, true);

  const statedRecordIds = new Set<string>();
  merged.forEach((entry) => {
    entry.contributorsMap.forEach((_, recId) => statedRecordIds.add(recId));
  });

  const totalRecords = objectsDataset.totalRecords;
  const statedCount = Math.min(totalRecords, statedRecordIds.size);
  const unstatedCount = Math.max(0, totalRecords - statedCount);

  const items: UnifiedObjectItem[] = Array.from(merged.entries())
    .map(([key, entry]): UnifiedObjectItem => {
      const contributors = Array.from(entry.contributorsMap.values());
      const count = contributors.length;
      const validPct = formatPct(count, statedCount);
      const totalPct = formatPct(count, totalRecords);
      return {
        key,
        label: entry.label,
        dimension: 'O',
        fieldKey: entry.fieldKey,
        fieldLabel: entry.objectKind === 'brand' ? 'Commercial Brand [PP1]' : 'Generic Food / Product [PP]',
        count,
        statedCount,
        unstatedCount,
        totalRecords,
        validPct,
        totalPct,
        formulaText: `Count: ${count} / ${statedCount} stated record${statedCount === 1 ? '' : 's'} = ${validPct}%`,
        totalContextText: `${count}/${totalRecords} total records · ${unstatedCount} unstated`,
        color: entry.objectKind === 'brand' ? '#ea580c' : '#f59e0b',
        contributors,
        objectKind: entry.objectKind,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    items,
    statedCount,
    unstatedCount,
    totalRecords,
    validCoveragePct: formatPct(statedCount, totalRecords),
  };
};

const ACTIVITY_FIELD_META: { key: keyof NonNullable<ADKOTMDecode['activities']>; label: string }[] = [
  { key: 'dailyRoutine', label: 'Daily Routine' },
  { key: 'shoppingBehaviour', label: 'Shopping' },
  { key: 'foodConsumptionBehaviour', label: 'Consumption' },
  { key: 'foodPreparation', label: 'Preparation' },
  { key: 'eatingContext', label: 'Eating Context' },
];

export const computeActivityCooccurrenceMatrix = (
  records: InterviewRecord[],
  maxHabits = 7
): ActivityCooccurrenceMatrix => {
  const decoded = records.filter((r) => Boolean(r.adkotmDecode));
  const totalRecords = decoded.length;

  const habitMap = new Map<
    string,
    {
      label: string;
      fieldKey: string;
      fieldLabel: string;
      contributorsMap: Map<string, TraceableContributor>;
    }
  >();

  const recordHabitKeys = new Map<string, Set<string>>();

  decoded.forEach((record) => {
    const acts = record.adkotmDecode?.activities;
    if (!acts) return;
    const keysForRecord = new Set<string>();

    ACTIVITY_FIELD_META.forEach(({ key, label }) => {
      const val = toCleanString(acts[key]);
      if (!val) return;
      const normKey = val.toLowerCase();
      keysForRecord.add(normKey);

      if (!habitMap.has(normKey)) {
        habitMap.set(normKey, {
          label: val,
          fieldKey: key,
          fieldLabel: label,
          contributorsMap: new Map(),
        });
      }
      const entry = habitMap.get(normKey)!;
      if (!entry.contributorsMap.has(record.id)) {
        entry.contributorsMap.set(record.id, {
          recordId: record.id,
          fileName: record.fileName,
          folderName: record.folderName || record.sessionDate || '',
          fieldKey: key,
          fieldLabel: label,
          code: val,
          quote: getRecordFieldQuote(record, key, ['dailyRoutine', 'foodConsumptionBehaviour']),
        });
      }
    });

    if (keysForRecord.size > 0) {
      recordHabitKeys.set(record.id, keysForRecord);
    }
  });

  const statedRecordCount = recordHabitKeys.size;
  const unstatedCount = Math.max(0, totalRecords - statedRecordCount);

  const rankedEntries = Array.from(habitMap.entries())
    .sort((a, b) => b[1].contributorsMap.size - a[1].contributorsMap.size || a[1].label.localeCompare(b[1].label))
    .slice(0, maxHabits);

  const habits: ActivityCooccurrenceHabit[] = rankedEntries.map(([key, info]) => {
    const contributors = Array.from(info.contributorsMap.values());
    const count = contributors.length;
    const validPct = formatPct(count, statedRecordCount);
    const totalPct = formatPct(count, totalRecords);
    const shortLabel = info.label.length > 26 ? `${info.label.slice(0, 24)}…` : info.label;
    return {
      key,
      label: info.label,
      shortLabel,
      fieldKey: info.fieldKey,
      fieldLabel: info.fieldLabel,
      count,
      item: {
        key,
        label: info.label,
        dimension: 'A',
        fieldKey: info.fieldKey,
        fieldLabel: info.fieldLabel,
        count,
        statedCount: statedRecordCount,
        unstatedCount,
        totalRecords,
        validPct,
        totalPct,
        formulaText: `Count: ${count} / ${statedRecordCount} stated record${statedRecordCount === 1 ? '' : 's'} = ${validPct}%`,
        totalContextText: `${count}/${totalRecords} total records · ${unstatedCount} unstated`,
        color: '#059669',
        contributors,
      },
    };
  });

  let maxCooccurrence = 0;
  const cells: ActivityCooccurrenceCell[][] = habits.map((rowHabit, rowIndex) =>
    habits.map((colHabit, colIndex) => {
      const contributors: TraceableContributor[] = [];
      decoded.forEach((record) => {
        const keys = recordHabitKeys.get(record.id);
        if (!keys) return;
        if (keys.has(rowHabit.key) && keys.has(colHabit.key)) {
          const rowQuote = getRecordFieldQuote(record, rowHabit.fieldKey);
          const colQuote =
            rowIndex === colIndex ? null : getRecordFieldQuote(record, colHabit.fieldKey);
          const combinedQuote =
            rowQuote && colQuote && rowQuote !== colQuote
              ? `${rowQuote} / ${colQuote}`
              : rowQuote || colQuote;
          contributors.push({
            recordId: record.id,
            fileName: record.fileName,
            folderName: record.folderName || record.sessionDate || '',
            fieldKey: rowHabit.fieldKey,
            fieldLabel:
              rowIndex === colIndex
                ? rowHabit.fieldLabel
                : `${rowHabit.fieldLabel} + ${colHabit.fieldLabel}`,
            code:
              rowIndex === colIndex
                ? rowHabit.label
                : `${rowHabit.label} + ${colHabit.label}`,
            quote: combinedQuote,
          });
        }
      });

      const count = contributors.length;
      if (rowIndex !== colIndex && count > maxCooccurrence) {
        maxCooccurrence = count;
      }
      const pctOfTotal = formatPct(count, totalRecords);
      const validPct = formatPct(count, statedRecordCount);

      return {
        rowIndex,
        colIndex,
        count,
        pctOfTotal,
        traceItem: {
          key: `${rowHabit.key}__x__${colHabit.key}`,
          label:
            rowIndex === colIndex
              ? rowHabit.label
              : `${rowHabit.label} + ${colHabit.label}`,
          dimension: 'A',
          fieldKey: rowHabit.fieldKey,
          fieldLabel:
            rowIndex === colIndex
              ? `${rowHabit.fieldLabel} [A]`
              : 'Co-Occurring Routines [A]',
          count,
          statedCount: statedRecordCount,
          unstatedCount,
          totalRecords,
          validPct,
          totalPct: pctOfTotal,
          formulaText:
            rowIndex === colIndex
              ? `${count} / ${statedRecordCount} stated A records = ${validPct}%`
              : `Co-occurrence: ${count} / ${totalRecords} interviews (${pctOfTotal}%)`,
          totalContextText: `${count}/${totalRecords} interviews share both routines`,
          color: '#059669',
          contributors,
        },
      };
    })
  );

  return {
    habits,
    cells,
    totalRecords,
    maxCooccurrence,
  };
};


