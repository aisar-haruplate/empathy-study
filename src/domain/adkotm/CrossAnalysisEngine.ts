import type {
  ADKOTMDimensionKey,
  CrossAnalysisFormula,
  GenericCrossAnalysisEvaluation,
  InterviewRecord,
  InterviewSession,
  SpendingPowerAnalysis,
} from '../../types';

export interface DimensionScoreDetail {
  dimension: ADKOTMDimensionKey;
  earned: number;
  weight: number;
  stated: boolean;
  summary: string | null;
}

export interface VerbatimEvidenceItem {
  dimension: ADKOTMDimensionKey;
  subLabel: string;
  quote: string;
}

export interface CrossAnalysisComputedRow {
  record: InterviewRecord;
  evaluation: GenericCrossAnalysisEvaluation;
  signals: {
    FR: string | null;
    RL: string | null;
    AW: string | null;
    PP: string | null;
    PP1: string | null;
    IL: string | null;
    A_summary: string | null;
    T_summary: string | null;
    age: string | null;
    gender: string | null;
    education: string | null;
  };
  dimensionDetails: DimensionScoreDetail[];
  statedDimensionCount: number;
  missingDimensions: ADKOTMDimensionKey[];
  totalScore: number;
  maxScore: number;
  breakdownText: string;
  tier: string | null;
  verbatimEvidence: VerbatimEvidenceItem[];
}

export interface CrossAnalysisSlicerState {
  tier: string; // 'ALL' | '__NULL__' | specific tier
  FR: string; // 'ALL' | '__NULL__' | specific value
  IL: string;
  AW: string;
  PP: string;
  hideNulls: boolean;
  search: string;
}

export interface BarDistributionDatum {
  label: string;
  valueKey: string; // exact filter key ('__NULL__' for null bucket)
  count: number;
  validPct: number; // % of stated (0 if isNull)
  totalPct: number; // % of total active rows
  isNull: boolean;
  color?: string;
}

export interface BarDistributionResult {
  items: BarDistributionDatum[];
  statedCount: number;
  nullCount: number;
  totalCount: number;
}

export const NULL_SENTINEL = '__NULL__';
export const NULL_TIER_LABEL = 'Null / Insufficient Signals';

export const DEFAULT_CROSS_ANALYSIS_FORMULAS: CrossAnalysisFormula[] = [
  {
    id: 'spending_power',
    name: 'Spending Power Analysis',
    code: 'D + O + T + M',
    analysisCodes: 'RL + PP + PP1 + IL',
    dimensions: ['D', 'O', 'T', 'M'],
    description:
      'Empirical cross-analysis linking Residential Location (RL), Products (PP), Brands (PP1), Purchase Cadence (T), and Venue (IL) to determine consumer purchasing power without guessing.',
    outputTiers: ['High', 'Medium-High', 'Medium', 'Low'],
    weights: { D: 25, O: 30, T: 15, M: 30 },
    tierThresholds: [78, 60, 42, 0],
    evaluationRules:
      'Score neighborhood/role signals (D), product & brand premium tier (O), purchase cadence (T), and interview venue tier (M). Records with fewer than 2 stated dimensions classify as Null / Insufficient Signals.',
    isCustom: false,
  },
  {
    id: 'gut_health_proactiveness',
    name: 'Gut Health Proactiveness Index',
    code: 'K + O + A',
    analysisCodes: 'AW + PP + Routine',
    dimensions: ['K', 'O', 'A'],
    description:
      'Evaluates consumer proactiveness toward digestive health by linking Gut Knowledge (AW), Probiotic Purchases (PP), and Daily Dietary Habits (A).',
    outputTiers: ['Proactive Leader', 'Moderate Aware', 'Reactive / Low Awareness'],
    weights: { K: 40, O: 35, A: 25 },
    tierThresholds: [72, 46, 0],
    evaluationRules:
      'Classify as Proactive Leader if aware of probiotics/immunity and maintains regular intake; Moderate Aware if aware with partial habits; Reactive if low awareness or ad-hoc.',
    isCustom: false,
  },
  {
    id: 'brand_loyalty',
    name: 'Brand Loyalty vs Price Sensitivity',
    code: 'O + T + M',
    analysisCodes: 'PP1 + Timing + IL',
    dimensions: ['O', 'T', 'M'],
    description:
      'Evaluates brand loyalty versus bulk discount sensitivity by cross-referencing brand preference (PP1), purchase timing (T), and shopping venue (IL).',
    outputTiers: ['Brand Loyal', 'Value-Conscious / Hybrid', 'Price Sensitive Deal-Seeker'],
    weights: { O: 45, T: 25, M: 30 },
    tierThresholds: [72, 46, 0],
    evaluationRules:
      'Classify as Brand Loyal if strictly seeks named brands (PP1) with consistent cadence; Value-Conscious if mixed; Price Sensitive if hypermarket-driven without brand commitment.',
    isCustom: false,
  },
];

function cleanVal(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) {
    const joined = val
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .join(', ');
    return cleanVal(joined);
  }
  const str = String(val).trim();
  if (!str) return null;
  const lower = str.toLowerCase();
  if (
    lower === 'null' ||
    lower === 'n/a' ||
    lower === 'na' ||
    lower === 'none' ||
    lower === 'unstated' ||
    lower === 'null (unstated)' ||
    lower === 'not mentioned' ||
    lower === 'unknown' ||
    lower === '-'
  ) {
    return null;
  }
  return str;
}

/**
 * Normalize raw weights for the active formula's dimensions so they sum cleanly to 100.
 */
export function normalizeFormulaWeights(
  formula: CrossAnalysisFormula
): Record<ADKOTMDimensionKey, number> {
  const dims = formula.dimensions.length > 0 ? formula.dimensions : (['D', 'O', 'T', 'M'] as ADKOTMDimensionKey[]);
  const raw: Partial<Record<ADKOTMDimensionKey, number>> = {};
  let sum = 0;

  for (const d of dims) {
    const w = formula.weights?.[d];
    const validW = typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 100 / dims.length;
    raw[d] = validW;
    sum += validW;
  }

  const normalized: Record<ADKOTMDimensionKey, number> = {
    A: 0,
    D: 0,
    K: 0,
    O: 0,
    T: 0,
    M: 0,
  };

  let allocated = 0;
  dims.forEach((d, idx) => {
    if (idx === dims.length - 1) {
      normalized[d] = Math.max(0, 100 - allocated);
    } else {
      const share = sum > 0 ? Math.round(((raw[d] || 0) / sum) * 100) : Math.floor(100 / dims.length);
      normalized[d] = share;
      allocated += share;
    }
  });

  return normalized;
}

/**
 * Resolve descending thresholds (0-100) matching formula.outputTiers.
 */
export function resolveTierThresholds(formula: CrossAnalysisFormula): number[] {
  const count = formula.outputTiers.length;
  if (
    Array.isArray(formula.tierThresholds) &&
    formula.tierThresholds.length === count &&
    formula.tierThresholds.every((n) => typeof n === 'number' && Number.isFinite(n))
  ) {
    return formula.tierThresholds;
  }
  if (count === 4) return [78, 60, 42, 0];
  if (count === 3) return [72, 46, 0];
  if (count === 2) return [55, 0];
  if (count <= 1) return [0];
  // Evenly spaced cutoffs from ~80 down to 0
  return formula.outputTiers.map((_, idx) => {
    if (idx === count - 1) return 0;
    return Math.round(80 - (idx * 65) / (count - 1));
  });
}

function scoreDemographic(signals: {
  FR: string | null;
  RL: string | null;
  age: string | null;
  gender: string | null;
  education: string | null;
}): { strength: number | null; summary: string | null } {
  const parts = [signals.FR, signals.RL].filter(Boolean) as string[];
  const extras = [signals.age, signals.gender, signals.education].filter(Boolean) as string[];
  if (parts.length === 0 && extras.length === 0) {
    return { strength: null, summary: null };
  }

  const rlLower = (signals.RL || '').toLowerCase();
  const frLower = (signals.FR || '').toLowerCase();
  let strength = 0.5;

  if (signals.RL) {
    if (
      /mont kiara|bangsar|damansara|ttdi|publika|elmina|desa park|hartamas|subang|bukit jelutong|london|kensington|chelsea|petaling jaya|pj/i.test(
        rlLower
      )
    ) {
      strength = 0.95;
    } else if (/shah alam|cheras|kepong|puchong|ampang|klang|kajang|setapak|wangsa/i.test(rlLower)) {
      strength = 0.72;
    } else {
      strength = 0.7;
    }
    if (signals.FR) {
      strength = Math.min(1, strength + 0.05);
    }
  } else if (signals.FR) {
    // Role stated without residential location
    if (/mum|mother|dad|father|parent/i.test(frLower)) {
      strength = 0.58;
    } else if (/elderly|senior|retiree/i.test(frLower)) {
      strength = 0.52;
    } else {
      strength = 0.5;
    }
  } else {
    strength = 0.4;
  }

  const summary = parts.length > 0 ? parts.join(' · ') : extras.join(' · ');
  return { strength, summary };
}

function scoreObjects(signals: {
  PP: string | null;
  PP1: string | null;
}): { strength: number | null; summary: string | null } {
  if (!signals.PP && !signals.PP1) {
    return { strength: null, summary: null };
  }
  const combined = `${signals.PP || ''} ${signals.PP1 || ''}`.toLowerCase();
  let strength = 0.55;

  const hasPremiumBrand =
    /karihome|yakult|vitagen|farm fresh|chobani|activia|sunglo|kefir|organic|probiotic supplement|blackmores|biogrow|gnc|holland/i.test(
      combined
    );
  const hasMultiItems =
    (signals.PP?.split(/,|;|and|\//i).filter((s) => s.trim()).length || 0) >= 2 ||
    (signals.PP1?.split(/,|;|and|\//i).filter((s) => s.trim()).length || 0) >= 2;

  if (signals.PP && signals.PP1) {
    strength = hasPremiumBrand ? 0.92 : 0.78;
    if (hasMultiItems) strength = Math.min(1, strength + 0.08);
  } else if (signals.PP1) {
    strength = hasPremiumBrand ? 0.82 : 0.68;
  } else {
    strength = hasMultiItems ? 0.72 : 0.58;
  }

  const summary = [signals.PP, signals.PP1 ? `Brand: ${signals.PP1}` : null]
    .filter(Boolean)
    .join(' · ');
  return { strength, summary };
}

function scoreKnowledge(
  aw: string | null,
  understanding: string | null
): { strength: number | null; summary: string | null } {
  if (!aw && !understanding) {
    return { strength: null, summary: null };
  }
  const awLower = (aw || '').toLowerCase();
  let strength = 0.55;

  if (/not aware|unaware|no awareness|low|none/i.test(awLower)) {
    strength = 0.25;
  } else if (/aware|high|proactive|yes|strong/i.test(awLower)) {
    strength = understanding ? 0.96 : 0.82;
  } else if (understanding) {
    strength = 0.65;
  }

  const summary = [aw, understanding].filter(Boolean).join(' · ');
  return { strength, summary };
}

function scoreActivities(
  aSummary: string | null,
  codedActivityCount: number
): { strength: number | null; summary: string | null } {
  if (!aSummary && codedActivityCount === 0) {
    return { strength: null, summary: null };
  }
  const lower = (aSummary || '').toLowerCase();
  let strength = 0.55;

  if (/daily|every day|every morning|regular|routine|weekly|cook|prepare/i.test(lower)) {
    strength = 0.88;
  } else if (codedActivityCount >= 2 || (aSummary && aSummary.length > 45)) {
    strength = 0.74;
  }

  return {
    strength,
    summary: aSummary || `${codedActivityCount} coded activity span(s)`,
  };
}

function scoreTime(
  tSummary: string | null,
  codedTimeCount: number
): { strength: number | null; summary: string | null } {
  if (!tSummary && codedTimeCount === 0) {
    return { strength: null, summary: null };
  }
  const lower = (tSummary || '').toLowerCase();
  let strength = 0.55;

  if (/daily|every day|morning|night|weekly|every week|regular/i.test(lower)) {
    strength = 0.88;
  } else if (/monthly|occasion|weekend|sometimes|promo|sale/i.test(lower)) {
    strength = 0.62;
  } else if (codedTimeCount >= 2) {
    strength = 0.72;
  }

  return {
    strength,
    summary: tSummary || `${codedTimeCount} coded timing span(s)`,
  };
}

function scoreMetadataVenue(il: string | null): { strength: number | null; summary: string | null } {
  if (!il) {
    return { strength: null, summary: null };
  }
  const lower = il.toLowerCase();
  let strength = 0.6;

  if (
    /jaya grocer|village grocer|publika|elmina|b\.i\.g\.|ben's|mercato|isetan|cold storage|qra|whole foods|waitrose/i.test(
      lower
    )
  ) {
    strength = 0.95;
  } else if (/aeon|sunway|mid valley|1 utama|one utama|pavilion|paradigm|ioi|shah alam/i.test(lower)) {
    strength = 0.74;
  } else if (/lotus|tesco|nsk|mydin|giant|econsave|speedmart|brem mall|pasar|hypermarket/i.test(lower)) {
    strength = 0.45;
  }

  return { strength, summary: il };
}

function inferDimensionFromCodeOrField(codeOrField: string): ADKOTMDimensionKey {
  const s = codeOrField.toUpperCase();
  if (s.startsWith('A') && !s.startsWith('AW')) return 'A';
  if (s.startsWith('D') || s === 'FR' || s === 'RL' || s.includes('DEMOGRAPHIC')) return 'D';
  if (s.startsWith('K') || s === 'AW' || s.includes('KNOWLEDGE')) return 'K';
  if (s.startsWith('O') || s === 'PP' || s === 'PP1' || s.includes('OBJECT')) return 'O';
  if (s.startsWith('T') || s.includes('TIME')) return 'T';
  if (s.startsWith('M') || s === 'IL' || s.includes('METADATA')) return 'M';
  return 'O';
}

function extractVerbatimEvidence(record: InterviewRecord): VerbatimEvidenceItem[] {
  const items: VerbatimEvidenceItem[] = [];
  const seen = new Set<string>();

  const pushUnique = (dimension: ADKOTMDimensionKey, subLabel: string, quote: string | null | undefined) => {
    const cleaned = cleanVal(quote);
    if (!cleaned) return;
    const key = `${dimension}|${cleaned.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ dimension, subLabel, quote: cleaned });
  };

  // 1. Human-verified fieldStates evidence_quote from Step 3
  const fieldStates = record.adkotmDecode?.fieldStates;
  if (fieldStates) {
    for (const [fieldPath, state] of Object.entries(fieldStates)) {
      if (!state || state.status === 'REJECTED') continue;
      if (state.evidence_quote) {
        const dim = inferDimensionFromCodeOrField(fieldPath);
        const label = fieldPath.includes('.') ? fieldPath.split('.')[1] : fieldPath;
        pushUnique(dim, label, state.evidence_quote);
      }
    }
  }

  // 2. Coded evidenceQuotes from adkotmDecode
  const evidenceQuotes = record.adkotmDecode?.evidenceQuotes || [];
  for (const h of evidenceQuotes) {
    const dim = inferDimensionFromCodeOrField(h.code || h.field);
    pushUnique(dim, h.code || h.field || dim, h.quote);
  }

  // 3. Fallback: key coded statements stored inside decode sections
  const d = record.adkotmDecode;
  if (items.length === 0 && d) {
    if (d.activities?.dailyRoutine) pushUnique('A', 'Daily Routine', d.activities.dailyRoutine);
    if (d.demographic?.familyRole || d.demographic?.residentialLocation) {
      pushUnique(
        'D',
        'Demographic',
        [d.demographic.familyRole, d.demographic.residentialLocation].filter(Boolean).join(' — ')
      );
    }
    if (d.knowledge?.understandingSummary || d.knowledge?.awarenessOnGutHealth) {
      pushUnique('K', 'Gut Knowledge', d.knowledge.understandingSummary || d.knowledge.awarenessOnGutHealth);
    }
    if (d.objects?.productsPurchased || d.objects?.brandPreferences) {
      pushUnique(
        'O',
        'Products & Brands',
        [d.objects.productsPurchased, d.objects.brandPreferences].filter(Boolean).join(' — ')
      );
    }
    if (d.time?.purchaseFrequency || d.time?.consumptionTiming) {
      pushUnique(
        'T',
        'Time & Cadence',
        [d.time.purchaseFrequency, d.time.consumptionTiming].filter(Boolean).join(' — ')
      );
    }
    if (d.metadata?.interviewLocation) pushUnique('M', 'Venue', d.metadata.interviewLocation);
  }

  return items;
}

/**
 * Deterministic, traceable Cross-Analysis scoring & distribution engine.
 * Pulls exact verified values from Step 3 without silent fallbacks or venue concatenation.
 */
export class CrossAnalysisEngine {
  private readonly sessionsByFolder: Map<string, InterviewSession>;

  constructor(sessions: readonly InterviewSession[] = []) {
    this.sessionsByFolder = new Map(sessions.map((s) => [s.folderName, s]));
  }

  /**
   * Extract exact per-record signals from Step 3 verified adkotmDecode.
   * Resolves individual venue (IL) from the record's own decode — never concatenating multiple venues.
   */
  extractSignals(record: InterviewRecord): CrossAnalysisComputedRow['signals'] {
    const d = record.adkotmDecode;
    const matchedSession = record.folderName ? this.sessionsByFolder.get(record.folderName) : undefined;

    const FR = cleanVal(d?.postAnalysisCodes?.FR) || cleanVal(d?.demographic?.familyRole);
    const RL =
      cleanVal(d?.postAnalysisCodes?.RL) ||
      cleanVal(d?.demographic?.residentialLocation) ||
      cleanVal(d?.demographic?.residentialDistrict);
    const AW =
      cleanVal(d?.postAnalysisCodes?.AW) ||
      cleanVal(d?.knowledge?.awarenessLevel) ||
      cleanVal(d?.knowledge?.awarenessOnGutHealth);
    const PP = cleanVal(d?.postAnalysisCodes?.PP) || cleanVal(d?.objects?.productsPurchased);
    const PP1 = cleanVal(d?.postAnalysisCodes?.PP1) || cleanVal(d?.objects?.brandPreferences);

    // Individual venue only — avoid concatenated multi-venue strings (e.g. "Venue A, Venue B")
    const rawSessionLoc = cleanVal(record.sessionLocation) || cleanVal(matchedSession?.sessionLocation);
    const singleSessionLoc = rawSessionLoc && !rawSessionLoc.includes(',') ? rawSessionLoc : null;
    const IL =
      cleanVal(d?.postAnalysisCodes?.IL) ||
      cleanVal(d?.metadata?.interviewLocation) ||
      singleSessionLoc;

    const aParts = [
      cleanVal(d?.activities?.dailyRoutine),
      cleanVal(d?.activities?.shoppingBehaviour),
      cleanVal(d?.activities?.foodPreparation),
      cleanVal(d?.activities?.eatingContext),
    ].filter(Boolean) as string[];
    const A_summary = aParts.length > 0 ? aParts.join('; ') : null;

    const tParts = [
      cleanVal(d?.time?.purchaseFrequency),
      cleanVal(d?.time?.consumptionTiming),
      cleanVal(d?.time?.purchaseOccasion),
    ].filter(Boolean) as string[];
    const T_summary = tParts.length > 0 ? tParts.join('; ') : null;

    return {
      FR,
      RL,
      AW,
      PP,
      PP1,
      IL,
      A_summary,
      T_summary,
      age: cleanVal(d?.demographic?.age),
      gender: cleanVal(d?.demographic?.gender),
      education: cleanVal(d?.demographic?.educationLevel),
    };
  }

  evaluateRecord(record: InterviewRecord, formula: CrossAnalysisFormula): CrossAnalysisComputedRow {
    const signals = this.extractSignals(record);
    const weights = normalizeFormulaWeights(formula);
    const thresholds = resolveTierThresholds(formula);
    const evidenceItems = extractVerbatimEvidence(record);

    const codedACount = evidenceItems.filter((s) => s.dimension === 'A').length;
    const codedTCount = evidenceItems.filter((s) => s.dimension === 'T').length;
    const understanding =
      cleanVal(record.adkotmDecode?.knowledge?.understandingSummary) ||
      cleanVal(record.adkotmDecode?.knowledge?.awarenessOnGutHealth);

    const dimensionDetails: DimensionScoreDetail[] = [];
    const dimensionScoresMap: NonNullable<GenericCrossAnalysisEvaluation['dimensionScores']> = {};
    let totalScore = 0;
    let statedDimensionCount = 0;
    const missingDimensions: ADKOTMDimensionKey[] = [];

    for (const dim of formula.dimensions) {
      const weight = weights[dim] || 0;
      let scored: { strength: number | null; summary: string | null };

      switch (dim) {
        case 'D':
          scored = scoreDemographic(signals);
          break;
        case 'O':
          scored = scoreObjects(signals);
          break;
        case 'K':
          scored = scoreKnowledge(signals.AW, understanding);
          break;
        case 'A':
          scored = scoreActivities(signals.A_summary, codedACount);
          break;
        case 'T':
          scored = scoreTime(signals.T_summary, codedTCount);
          break;
        case 'M':
          scored = scoreMetadataVenue(signals.IL);
          break;
      }

      const stated = scored.strength !== null;
      const earned = stated ? Math.round((scored.strength as number) * weight) : 0;

      if (stated) {
        statedDimensionCount += 1;
        totalScore += earned;
      } else {
        missingDimensions.push(dim);
      }

      const detail: DimensionScoreDetail = {
        dimension: dim,
        earned,
        weight,
        stated,
        summary: scored.summary,
      };
      dimensionDetails.push(detail);
      dimensionScoresMap[dim] = {
        earned,
        weight,
        stated,
        summary: scored.summary,
      };
    }

    const maxScore = dimensionDetails.reduce((acc, d) => acc + d.weight, 0) || 100;
    const minRequired = formula.dimensions.length >= 3 ? 2 : 1;

    let computedTier: string | null = null;
    if (statedDimensionCount >= minRequired && totalScore > 0) {
      const tiers = formula.outputTiers.length > 0 ? formula.outputTiers : ['High', 'Medium-High', 'Medium', 'Low'];
      computedTier = tiers[tiers.length - 1];
      for (let i = 0; i < tiers.length; i++) {
        if (totalScore >= (thresholds[i] ?? 0)) {
          computedTier = tiers[i];
          break;
        }
      }
    }

    const mathTerms = dimensionDetails
      .map((d) => (d.stated ? `${d.dimension}: ${d.earned}/${d.weight}` : `${d.dimension}: 0/${d.weight} (null)`))
      .join(' + ');

    const breakdownText =
      computedTier === null
        ? `${mathTerms} = ${totalScore}/${maxScore} → ${NULL_TIER_LABEL} (${statedDimensionCount}/${formula.dimensions.length} formula dimensions stated; missing ${missingDimensions.join(', ')})`
        : `${mathTerms} = ${totalScore}/${maxScore} → ${computedTier}`;

    // Respect explicit human manual override if stored on the record for this formula
    const existingSaved = record.crossAnalysisEvaluations?.[formula.id];
    const isManualOverride = Boolean(existingSaved?.isManualOverride);
    const finalTier = isManualOverride ? existingSaved?.tier ?? null : computedTier;
    const finalJustification = isManualOverride
      ? existingSaved?.justification || breakdownText
      : breakdownText;

    const evaluation: GenericCrossAnalysisEvaluation = {
      recordId: record.id,
      fileName: record.fileName,
      formulaId: formula.id,
      tier: finalTier,
      components: {
        FR: signals.FR,
        RL: signals.RL,
        AW: signals.AW,
        PP: signals.PP,
        PP1: signals.PP1,
        IL: signals.IL,
        A_activities: signals.A_summary,
        T_time: signals.T_summary,
      },
      justification: finalJustification,
      evaluatedAt: existingSaved?.evaluatedAt || new Date().toISOString(),
      score: totalScore,
      maxScore,
      dimensionScores: dimensionScoresMap,
      breakdownText,
      isManualOverride,
    };

    return {
      record,
      evaluation,
      signals,
      dimensionDetails,
      statedDimensionCount,
      missingDimensions,
      totalScore,
      maxScore,
      breakdownText,
      tier: finalTier,
      verbatimEvidence: extractVerbatimEvidence(record),
    };
  }

  evaluateAll(
    records: readonly InterviewRecord[],
    formula: CrossAnalysisFormula
  ): CrossAnalysisComputedRow[] {
    return records.map((r) => this.evaluateRecord(r, formula));
  }

  /**
   * Build a SpendingPowerAnalysis object for export synchronization when the active formula is spending_power.
   */
  toSpendingPowerAnalysis(row: CrossAnalysisComputedRow): SpendingPowerAnalysis {
    const spTier =
      row.tier === 'High' || row.tier === 'Medium-High' || row.tier === 'Medium' || row.tier === 'Low'
        ? row.tier
        : null;

    return {
      recordId: row.record.id,
      fileName: row.record.fileName,
      spendingPowerTier: spTier,
      components: {
        D_demographic: row.signals.FR,
        O_objects: row.signals.PP,
        T_time: row.signals.T_summary,
        M_metadata: row.signals.IL,
        RL_residentialLocation: row.signals.RL,
        PP_productsPurchased: row.signals.PP,
        PP1_brandPreferences: row.signals.PP1,
        IL_interviewLocation: row.signals.IL,
      },
      justification: row.evaluation.justification,
    };
  }

  /**
   * Filter computed rows against the active slicer bar state.
   */
  filterRows(
    rows: readonly CrossAnalysisComputedRow[],
    slicers: CrossAnalysisSlicerState
  ): CrossAnalysisComputedRow[] {
    const q = slicers.search.trim().toLowerCase();
    return rows.filter((row) => {
      if (slicers.hideNulls && row.tier === null) return false;

      if (slicers.tier !== 'ALL') {
        if (slicers.tier === NULL_SENTINEL) {
          if (row.tier !== null) return false;
        } else if (row.tier !== slicers.tier) {
          return false;
        }
      }

      if (slicers.FR !== 'ALL') {
        if (slicers.FR === NULL_SENTINEL) {
          if (row.signals.FR !== null) return false;
        } else if (row.signals.FR !== slicers.FR) {
          return false;
        }
      }

      if (slicers.IL !== 'ALL') {
        if (slicers.IL === NULL_SENTINEL) {
          if (row.signals.IL !== null) return false;
        } else if (row.signals.IL !== slicers.IL) {
          return false;
        }
      }

      if (slicers.AW !== 'ALL') {
        if (slicers.AW === NULL_SENTINEL) {
          if (row.signals.AW !== null) return false;
        } else if (row.signals.AW !== slicers.AW) {
          return false;
        }
      }

      if (slicers.PP !== 'ALL') {
        if (slicers.PP === NULL_SENTINEL) {
          if (row.signals.PP !== null) return false;
        } else if (row.signals.PP !== slicers.PP) {
          return false;
        }
      }

      if (q) {
        const haystack = [
          row.record.fileName,
          row.tier || NULL_TIER_LABEL,
          row.signals.FR,
          row.signals.RL,
          row.signals.AW,
          row.signals.PP,
          row.signals.PP1,
          row.signals.IL,
          row.breakdownText,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }

  /**
   * Compute full-label horizontal bar distribution with valid % (excluding nulls) and stated denominator.
   */
  computeDistribution(
    rows: readonly CrossAnalysisComputedRow[],
    extractor: (row: CrossAnalysisComputedRow) => string | null,
    options?: {
      hideNulls?: boolean;
      nullLabel?: string;
      orderedKeys?: string[];
      colorMap?: Record<string, string>;
    }
  ): BarDistributionResult {
    const counts = new Map<string, number>();
    let nullCount = 0;

    for (const row of rows) {
      const val = extractor(row);
      if (val === null) {
        nullCount += 1;
      } else {
        counts.set(val, (counts.get(val) || 0) + 1);
      }
    }

    const totalCount = rows.length;
    const statedCount = totalCount - nullCount;
    const items: BarDistributionDatum[] = [];

    if (options?.orderedKeys && options.orderedKeys.length > 0) {
      for (const key of options.orderedKeys) {
        const count = counts.get(key) || 0;
        items.push({
          label: key,
          valueKey: key,
          count,
          validPct: statedCount > 0 ? Math.round((count / statedCount) * 1000) / 10 : 0,
          totalPct: totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0,
          isNull: false,
          color: options.colorMap?.[key],
        });
      }
      // Include any extra non-ordered keys if present
      for (const [key, count] of counts.entries()) {
        if (!options.orderedKeys.includes(key)) {
          items.push({
            label: key,
            valueKey: key,
            count,
            validPct: statedCount > 0 ? Math.round((count / statedCount) * 1000) / 10 : 0,
            totalPct: totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0,
            isNull: false,
            color: options.colorMap?.[key],
          });
        }
      }
    } else {
      const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      for (const [key, count] of sorted) {
        items.push({
          label: key,
          valueKey: key,
          count,
          validPct: statedCount > 0 ? Math.round((count / statedCount) * 1000) / 10 : 0,
          totalPct: totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0,
          isNull: false,
          color: options?.colorMap?.[key],
        });
      }
    }

    if (nullCount > 0 && !options?.hideNulls) {
      items.push({
        label: options?.nullLabel || 'Unstated (null)',
        valueKey: NULL_SENTINEL,
        count: nullCount,
        validPct: 0,
        totalPct: totalCount > 0 ? Math.round((nullCount / totalCount) * 1000) / 10 : 0,
        isNull: true,
        color: '#C9D2CE',
      });
    }

    return {
      items,
      statedCount,
      nullCount,
      totalCount,
    };
  }
}
