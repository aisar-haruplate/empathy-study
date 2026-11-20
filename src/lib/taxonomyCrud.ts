import type {
  ADKOTMDecode,
  ADKOTMDimensionKey,
  ADKOTMFieldItem,
  CustomTaxonomyCategory,
  InterviewRecord,
} from '../types';
import {
  ADKOTM_PARAMETER_CATALOG,
  ensureFieldStates,
  stripRecordingExtension,
  syncFlatDecodeFromFieldStates,
} from './adkotmCopilot';

export const CUSTOM_TAXONOMY_STORAGE_KEY = 'empathy_custom_taxonomy_v1';

export const DIMENSION_FIELD_GROUPS: Record<
  ADKOTMDimensionKey,
  { fieldKey: string; label: string; isArray?: boolean }[]
> = {
  O: [
    { fieldKey: 'productsPurchased', label: 'Products Purchased [PP]', isArray: true },
    { fieldKey: 'brandPreferences', label: 'Brand Preferences [PP1]', isArray: true },
    { fieldKey: 'foodProducts', label: 'Food & Dairy Products', isArray: true },
    { fieldKey: 'supplementProducts', label: 'Supplement Products', isArray: true },
    { fieldKey: 'actionsToSolve', label: 'Actions to Solve Gut Issues', isArray: true },
    { fieldKey: 'productCategory', label: 'Product Category' },
    { fieldKey: 'productPreference', label: 'Format Preference' },
  ],
  A: [
    { fieldKey: 'dailyRoutine', label: 'Daily Routine' },
    { fieldKey: 'shoppingBehaviour', label: 'Shopping Behaviour' },
    { fieldKey: 'foodConsumptionBehaviour', label: 'Food Consumption Behaviour' },
    { fieldKey: 'foodPreparation', label: 'Food Preparation' },
    { fieldKey: 'eatingContext', label: 'Eating Context' },
  ],
  K: [
    { fieldKey: 'awarenessLevel', label: 'Awareness Level' },
    { fieldKey: 'awarenessOnGutHealth', label: 'Gut Health Awareness [AW]' },
    { fieldKey: 'understandingSummary', label: 'Understanding Summary' },
  ],
  D: [
    { fieldKey: 'familyRole', label: 'Family Role [FR]' },
    { fieldKey: 'residentialLocation', label: 'Residential Location [RL]' },
    { fieldKey: 'householdComposition', label: 'Household Composition' },
    { fieldKey: 'age', label: 'Age' },
    { fieldKey: 'gender', label: 'Gender' },
  ],
  T: [
    { fieldKey: 'consumptionTiming', label: 'Consumption Timing' },
    { fieldKey: 'consumptionFrequency', label: 'Consumption Frequency' },
    { fieldKey: 'purchaseFrequency', label: 'Purchase Frequency' },
    { fieldKey: 'purchaseTiming', label: 'Purchase Timing' },
    { fieldKey: 'purchaseOccasion', label: 'Purchase Occasion' },
  ],
  M: [
    { fieldKey: 'interviewLocation', label: 'Interview Location [IL]' },
    { fieldKey: 'interviewTime', label: 'Interview Time' },
  ],
};

export function loadCustomTaxonomy(): CustomTaxonomyCategory[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_TAXONOMY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomTaxonomy(categories: CustomTaxonomyCategory[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(CUSTOM_TAXONOMY_STORAGE_KEY, JSON.stringify(categories));
  } catch (err) {
    console.warn('Could not persist custom taxonomy:', err);
  }
}

export function buildCustomFieldKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `custom_${slug || 'tag'}`;
}

export interface TaxonomyUsageEntry {
  id: string;
  label: string;
  dimension: ADKOTMDimensionKey;
  fieldKey: string;
  fieldLabel: string;
  isCustom: boolean;
  customCategoryId?: string;
  usageCount: number;
  recordIds: string[];
  fileNames: string[];
  sampleQuote: string | null;
}

const NULL_STRINGS = new Set(['', 'null', 'unstated', 'none', 'n/a', 'na', 'not mentioned', 'not stated', '-']);

const isCleanToken = (val?: string | null): val is string => {
  if (!val) return false;
  return !NULL_STRINGS.has(val.trim().toLowerCase());
};

const splitTokens = (raw: string | null | undefined, isMulti: boolean): string[] => {
  if (!isCleanToken(raw)) return [];
  if (!isMulti) return [raw.trim()];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => isCleanToken(s));
};

const isMultiValueField = (fieldKey: string): boolean =>
  fieldKey === 'productsPurchased' ||
  fieldKey === 'brandPreferences' ||
  fieldKey === 'foodProducts' ||
  fieldKey === 'supplementProducts' ||
  fieldKey === 'actionsToSolve';

const readFieldRaw = (decode: ADKOTMDecode, fieldKey: string): string | null => {
  const stateVal = decode.fieldStates?.[fieldKey];
  if (stateVal && stateVal.status !== 'REJECTED' && isCleanToken(stateVal.code)) {
    return stateVal.code.trim();
  }
  if (decode.customFields && isCleanToken(decode.customFields[fieldKey])) {
    return decode.customFields[fieldKey]!.trim();
  }
  switch (fieldKey) {
    case 'productsPurchased':
      return decode.postAnalysisCodes?.PP || decode.objects?.productsPurchased || null;
    case 'brandPreferences':
      return decode.postAnalysisCodes?.PP1 || decode.objects?.brandPreferences || null;
    case 'foodProducts':
      return decode.objects?.foodProducts?.join(', ') || null;
    case 'supplementProducts':
      return decode.objects?.supplementProducts?.join(', ') || null;
    case 'actionsToSolve':
      return decode.objects?.actionsToSolve?.join(', ') || null;
    case 'productCategory':
      return decode.objects?.productCategory || null;
    case 'productPreference':
      return decode.objects?.productPreference || null;
    case 'dailyRoutine':
      return decode.activities?.dailyRoutine || null;
    case 'shoppingBehaviour':
      return decode.activities?.shoppingBehaviour || null;
    case 'foodConsumptionBehaviour':
      return decode.activities?.foodConsumptionBehaviour || null;
    case 'foodPreparation':
      return decode.activities?.foodPreparation || null;
    case 'eatingContext':
      return decode.activities?.eatingContext || null;
    case 'awarenessLevel':
      return decode.knowledge?.awarenessLevel || null;
    case 'awarenessOnGutHealth':
      return decode.postAnalysisCodes?.AW || decode.knowledge?.awarenessOnGutHealth || null;
    case 'understandingSummary':
      return decode.knowledge?.understandingSummary || null;
    case 'familyRole':
      return decode.postAnalysisCodes?.FR || decode.demographic?.familyRole || null;
    case 'residentialLocation':
      return decode.postAnalysisCodes?.RL || decode.demographic?.residentialLocation || null;
    case 'householdComposition':
      return decode.demographic?.householdComposition || null;
    case 'age':
      return decode.demographic?.age || null;
    case 'gender':
      return decode.demographic?.gender || null;
    case 'consumptionTiming':
      return decode.time?.consumptionTiming || null;
    case 'consumptionFrequency':
      return decode.time?.consumptionFrequency || null;
    case 'purchaseFrequency':
      return decode.time?.purchaseFrequency || null;
    case 'purchaseTiming':
      return decode.time?.purchaseTiming || null;
    case 'purchaseOccasion':
      return decode.time?.purchaseOccasion || null;
    case 'interviewLocation':
      return decode.postAnalysisCodes?.IL || decode.metadata?.interviewLocation || null;
    case 'interviewTime':
      return decode.metadata?.interviewTime || null;
    default:
      return null;
  }
};

export function buildTaxonomyRegistry(
  records: InterviewRecord[],
  customCategories: CustomTaxonomyCategory[] = []
): TaxonomyUsageEntry[] {
  const decodedRecords = records.filter((r) => Boolean(r.adkotmDecode));
  const map = new Map<string, TaxonomyUsageEntry>();

  const register = (params: {
    label: string;
    dimension: ADKOTMDimensionKey;
    fieldKey: string;
    fieldLabel: string;
    recordId?: string;
    fileName?: string;
    quote?: string | null;
    isCustom?: boolean;
    customCategoryId?: string;
  }) => {
    const key = `${params.dimension}::${params.fieldKey}::${params.label.toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        label: params.label,
        dimension: params.dimension,
        fieldKey: params.fieldKey,
        fieldLabel: params.fieldLabel,
        isCustom: Boolean(params.isCustom),
        customCategoryId: params.customCategoryId,
        usageCount: 0,
        recordIds: [],
        fileNames: [],
        sampleQuote: params.quote || null,
      });
    }
    const entry = map.get(key)!;
    if (params.isCustom) {
      entry.isCustom = true;
      if (params.customCategoryId) entry.customCategoryId = params.customCategoryId;
    }
    if (params.recordId && !entry.recordIds.includes(params.recordId)) {
      entry.recordIds.push(params.recordId);
      entry.usageCount = entry.recordIds.length;
      if (params.fileName) entry.fileNames.push(stripRecordingExtension(params.fileName));
    }
    if (!entry.sampleQuote && params.quote) {
      entry.sampleQuote = params.quote;
    }
  };

  // Seed custom categories so unused custom categories also inspect cleanly (Used in 0 interviews)
  customCategories.forEach((cat) => {
    register({
      label: cat.name,
      dimension: cat.dimension,
      fieldKey: cat.fieldKey,
      fieldLabel: cat.kind === 'parameter' ? `${cat.name}${cat.shortCode ? ` [${cat.shortCode}]` : ''}` : cat.fieldKey,
      isCustom: true,
      customCategoryId: cat.id,
    });
  });

  decodedRecords.forEach((record) => {
    const d = record.adkotmDecode;
    if (!d) return;

    (['O', 'A', 'K', 'D', 'T', 'M'] as ADKOTMDimensionKey[]).forEach((dim) => {
      DIMENSION_FIELD_GROUPS[dim].forEach((fg) => {
        const raw = readFieldRaw(d, fg.fieldKey);
        const tokens = splitTokens(raw, isMultiValueField(fg.fieldKey));
        const quote = d.fieldStates?.[fg.fieldKey]?.evidence_quote || null;

        tokens.forEach((tok) => {
          const matchedCustom = customCategories.find(
            (c) =>
              c.dimension === dim &&
              c.fieldKey === fg.fieldKey &&
              c.name.toLowerCase() === tok.toLowerCase()
          );
          register({
            label: tok,
            dimension: dim,
            fieldKey: fg.fieldKey,
            fieldLabel: fg.label,
            recordId: record.id,
            fileName: record.fileName,
            quote,
            isCustom: Boolean(matchedCustom),
            customCategoryId: matchedCustom?.id,
          });
        });
      });

      // Also scan custom parameters belonging to this dimension
      customCategories
        .filter((c) => c.dimension === dim && c.kind === 'parameter')
        .forEach((cat) => {
          const raw = readFieldRaw(d, cat.fieldKey);
          const tokens = splitTokens(raw, false);
          const quote = d.fieldStates?.[cat.fieldKey]?.evidence_quote || null;
          tokens.forEach((tok) => {
            register({
              label: tok,
              dimension: dim,
              fieldKey: cat.fieldKey,
              fieldLabel: `${cat.name}${cat.shortCode ? ` [${cat.shortCode}]` : ''}`,
              recordId: record.id,
              fileName: record.fileName,
              quote,
              isCustom: true,
              customCategoryId: cat.id,
            });
          });
        });
    });
  });

  return Array.from(map.values()).sort(
    (a, b) => b.usageCount - a.usageCount || a.dimension.localeCompare(b.dimension) || a.label.localeCompare(b.label)
  );
}

// ============================================================================
// Pure CRUD Mutators across Decoded Records (Preserve Verbatim Quotes!)
// ============================================================================

function writeFieldStateValue(
  states: Record<string, ADKOTMFieldItem>,
  fieldKey: string,
  newValue: string | null,
  reasoning?: string
): void {
  const prev = states[fieldKey];
  if (newValue === null || !isCleanToken(newValue)) {
    states[fieldKey] = {
      code: null,
      evidence_quote: prev?.evidence_quote || null,
      confidence: 'NULL',
      status: prev?.status || 'MANUAL',
      reasoning: reasoning || 'Cleared during taxonomy edit',
      source: prev?.source || 'manual',
    };
  } else {
    states[fieldKey] = {
      code: newValue,
      evidence_quote: prev?.evidence_quote || null,
      confidence: prev?.confidence === 'NULL' || !prev?.confidence ? 'HIGH' : prev.confidence,
      status: prev?.status === 'REJECTED' ? 'MANUAL' : prev?.status || 'MANUAL',
      reasoning: reasoning || prev?.reasoning,
      source: prev?.source || 'manual',
    };
  }
}

export function assignCustomCategoryToRecords(
  records: InterviewRecord[],
  params: {
    category: CustomTaxonomyCategory;
    recordIds: string[];
    value?: string;
  }
): { updatedRecords: InterviewRecord[]; affectedCount: number } {
  const targetSet = new Set(params.recordIds);
  const assignedValue = (params.value || params.category.name).trim();
  if (!assignedValue || targetSet.size === 0) {
    return { updatedRecords: records, affectedCount: 0 };
  }

  let affectedCount = 0;
  const updatedRecords = records.map((record) => {
    if (!targetSet.has(record.id) || !record.adkotmDecode) return record;

    const defaultStatus = record.reviewStatus === 'human_verified' ? 'ACCEPTED' : 'MANUAL';
    const states = { ...ensureFieldStates(record.adkotmDecode, defaultStatus) };
    const customFields = { ...(record.adkotmDecode.customFields || {}) };

    if (params.category.kind === 'parameter') {
      customFields[params.category.fieldKey] = assignedValue;
      writeFieldStateValue(
        states,
        params.category.fieldKey,
        assignedValue,
        `Assigned custom parameter "${params.category.name}"`
      );
    } else {
      const fk = params.category.fieldKey;
      const existingRaw = readFieldRaw(record.adkotmDecode, fk);
      let nextVal = assignedValue;
      if (isMultiValueField(fk) && isCleanToken(existingRaw)) {
        const existingTokens = splitTokens(existingRaw, true);
        if (!existingTokens.some((t) => t.toLowerCase() === assignedValue.toLowerCase())) {
          nextVal = [...existingTokens, assignedValue].join(', ');
        } else {
          nextVal = existingTokens.join(', ');
        }
      }
      writeFieldStateValue(states, fk, nextVal, `Assigned category "${assignedValue}"`);
    }

    affectedCount += 1;
    const synced = syncFlatDecodeFromFieldStates(states, {
      ...record.adkotmDecode,
      customFields,
    });
    return {
      ...record,
      adkotmDecode: synced,
    };
  });

  return { updatedRecords, affectedCount };
}

export function renameCodeOrCategoryAcrossRecords(
  records: InterviewRecord[],
  params: {
    dimension: ADKOTMDimensionKey;
    fieldKey?: string;
    oldLabel: string;
    newLabel: string;
  }
): { updatedRecords: InterviewRecord[]; affectedCount: number } {
  const oldLower = params.oldLabel.trim().toLowerCase();
  const nextLabel = params.newLabel.trim();
  if (!oldLower || !nextLabel || oldLower === nextLabel.toLowerCase()) {
    return { updatedRecords: records, affectedCount: 0 };
  }

  let affectedCount = 0;
  const targetFieldKeys = params.fieldKey
    ? [params.fieldKey]
    : DIMENSION_FIELD_GROUPS[params.dimension].map((f) => f.fieldKey);

  const updatedRecords = records.map((record) => {
    const d = record.adkotmDecode;
    if (!d) return record;

    const defaultStatus = record.reviewStatus === 'human_verified' ? 'ACCEPTED' : 'STAGED';
    const states = { ...ensureFieldStates(d, defaultStatus) };
    const customFields = { ...(d.customFields || {}) };
    let changed = false;

    const candidateKeys = new Set([
      ...targetFieldKeys,
      ...(params.fieldKey ? [] : Object.keys(customFields)),
    ]);

    candidateKeys.forEach((fk) => {
      const currentVal = readFieldRaw(d, fk);
      if (!isCleanToken(currentVal)) return;

      const multi = isMultiValueField(fk);
      const tokens = splitTokens(currentVal, multi);
      let fieldChanged = false;
      const replaced = tokens.map((tok) => {
        if (tok.toLowerCase() === oldLower) {
          fieldChanged = true;
          return nextLabel;
        }
        return tok;
      });

      if (fieldChanged) {
        const deduped = Array.from(new Set(replaced.map((t) => t.trim()).filter(Boolean))).join(', ');
        writeFieldStateValue(states, fk, deduped, `Renamed "${params.oldLabel}" to "${nextLabel}"`);
        if (fk.startsWith('custom_') || fk in customFields) {
          customFields[fk] = deduped;
        }
        changed = true;
      }
    });

    if (!changed) return record;
    affectedCount += 1;
    const synced = syncFlatDecodeFromFieldStates(states, { ...d, customFields });
    return {
      ...record,
      adkotmDecode: synced,
    };
  });

  return { updatedRecords, affectedCount };
}

export function mergeCodesAcrossRecords(
  records: InterviewRecord[],
  params: {
    dimension: ADKOTMDimensionKey;
    fieldKey?: string;
    sourceLabels: string[];
    targetLabel: string;
  }
): { updatedRecords: InterviewRecord[]; affectedCount: number } {
  const sourceSet = new Set(params.sourceLabels.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const canonical = params.targetLabel.trim();
  if (sourceSet.size === 0 || !canonical) {
    return { updatedRecords: records, affectedCount: 0 };
  }

  let affectedCount = 0;
  const targetFieldKeys = params.fieldKey
    ? [params.fieldKey]
    : DIMENSION_FIELD_GROUPS[params.dimension].map((f) => f.fieldKey);

  const updatedRecords = records.map((record) => {
    const d = record.adkotmDecode;
    if (!d) return record;

    const defaultStatus = record.reviewStatus === 'human_verified' ? 'ACCEPTED' : 'STAGED';
    const states = { ...ensureFieldStates(d, defaultStatus) };
    const customFields = { ...(d.customFields || {}) };
    let changed = false;

    const candidateKeys = new Set([
      ...targetFieldKeys,
      ...(params.fieldKey ? [] : Object.keys(customFields)),
    ]);

    candidateKeys.forEach((fk) => {
      const currentVal = readFieldRaw(d, fk);
      if (!isCleanToken(currentVal)) return;

      const multi = isMultiValueField(fk);
      const tokens = splitTokens(currentVal, multi);
      let fieldChanged = false;
      const mergedTokens: string[] = [];
      const seenLower = new Set<string>();

      tokens.forEach((tok) => {
        const nextTok = sourceSet.has(tok.toLowerCase()) ? canonical : tok;
        if (nextTok !== tok) fieldChanged = true;
        const lower = nextTok.toLowerCase();
        if (!seenLower.has(lower)) {
          seenLower.add(lower);
          mergedTokens.push(nextTok);
        }
      });

      if (fieldChanged) {
        const nextString = mergedTokens.join(', ');
        writeFieldStateValue(states, fk, nextString, `Merged into canonical label "${canonical}"`);
        if (fk.startsWith('custom_') || fk in customFields) {
          customFields[fk] = nextString;
        }
        changed = true;
      }
    });

    if (!changed) return record;
    affectedCount += 1;
    const synced = syncFlatDecodeFromFieldStates(states, { ...d, customFields });
    return {
      ...record,
      adkotmDecode: synced,
    };
  });

  return { updatedRecords, affectedCount };
}

export function deleteCodeOrCategoryAcrossRecords(
  records: InterviewRecord[],
  params: {
    dimension: ADKOTMDimensionKey;
    fieldKey?: string;
    targetLabel?: string;
    mode: 'null' | 'reassign';
    reassignToLabel?: string;
    removeCustomParameterKey?: string;
  }
): { updatedRecords: InterviewRecord[]; affectedCount: number } {
  const targetLower = params.targetLabel?.trim().toLowerCase() || '';
  const reassignVal = params.reassignToLabel?.trim() || '';
  if (params.mode === 'reassign' && !reassignVal) {
    return { updatedRecords: records, affectedCount: 0 };
  }

  let affectedCount = 0;
  const targetFieldKeys = params.removeCustomParameterKey
    ? [params.removeCustomParameterKey]
    : params.fieldKey
    ? [params.fieldKey]
    : DIMENSION_FIELD_GROUPS[params.dimension].map((f) => f.fieldKey);

  const updatedRecords = records.map((record) => {
    const d = record.adkotmDecode;
    if (!d) return record;

    const defaultStatus = record.reviewStatus === 'human_verified' ? 'ACCEPTED' : 'STAGED';
    const states = { ...ensureFieldStates(d, defaultStatus) };
    const customFields = { ...(d.customFields || {}) };
    let changed = false;

    if (params.removeCustomParameterKey) {
      const pk = params.removeCustomParameterKey;
      const hasCustom = isCleanToken(customFields[pk]) || isCleanToken(states[pk]?.code);
      if (hasCustom) {
        if (params.mode === 'reassign') {
          customFields[pk] = reassignVal;
          writeFieldStateValue(states, pk, reassignVal, `Reassigned from removed parameter`);
        } else {
          delete customFields[pk];
          delete states[pk];
        }
        changed = true;
      }
    } else if (targetLower) {
      const candidateKeys = new Set([
        ...targetFieldKeys,
        ...(params.fieldKey ? [] : Object.keys(customFields)),
      ]);

      candidateKeys.forEach((fk) => {
        const currentVal = readFieldRaw(d, fk);
        if (!isCleanToken(currentVal)) return;

        const multi = isMultiValueField(fk);
        const tokens = splitTokens(currentVal, multi);
        const matches = tokens.some((t) => t.toLowerCase() === targetLower);
        if (!matches) return;

        let nextTokens: string[];
        if (params.mode === 'reassign') {
          const seen = new Set<string>();
          nextTokens = [];
          tokens.forEach((t) => {
            const val = t.toLowerCase() === targetLower ? reassignVal : t;
            if (!seen.has(val.toLowerCase())) {
              seen.add(val.toLowerCase());
              nextTokens.push(val);
            }
          });
        } else {
          nextTokens = tokens.filter((t) => t.toLowerCase() !== targetLower);
        }

        const nextStr = nextTokens.length > 0 ? nextTokens.join(', ') : null;
        writeFieldStateValue(
          states,
          fk,
          nextStr,
          params.mode === 'reassign'
            ? `Reassigned "${params.targetLabel}" to "${reassignVal}"`
            : `Removed "${params.targetLabel}" (set to null)`
        );
        if (fk.startsWith('custom_') || fk in customFields) {
          customFields[fk] = nextStr;
        }
        changed = true;
      });
    }

    if (!changed) return record;
    affectedCount += 1;
    const synced = syncFlatDecodeFromFieldStates(states, { ...d, customFields });
    return {
      ...record,
      adkotmDecode: synced,
    };
  });

  return { updatedRecords, affectedCount };
}

export function getFieldLabelForKey(
  fieldKey: string,
  customCategories: CustomTaxonomyCategory[] = []
): string {
  const custom = customCategories.find((c) => c.fieldKey === fieldKey);
  if (custom) {
    return custom.shortCode ? `${custom.name} [${custom.shortCode}]` : custom.name;
  }
  const param = ADKOTM_PARAMETER_CATALOG.find((p) => p.key === fieldKey);
  return param?.label || fieldKey;
}
