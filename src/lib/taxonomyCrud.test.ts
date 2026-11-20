import test from 'node:test';
import assert from 'node:assert/strict';
import type { CustomTaxonomyCategory, InterviewRecord } from '../types';
import {
  assignCustomCategoryToRecords,
  buildCustomFieldKey,
  buildTaxonomyRegistry,
  deleteCodeOrCategoryAcrossRecords,
  mergeCodesAcrossRecords,
  renameCodeOrCategoryAcrossRecords,
} from './taxonomyCrud';

const makeRecord = (
  id: string,
  fileName: string,
  brand: string | null,
  brandQuote: string | null,
  rl: string | null = 'Shah Alam'
): InterviewRecord => ({
  id,
  fileName,
  fileType: 'audio',
  mimeType: 'audio/mp4',
  source: 'local_upload',
  uploadedAt: 1700000000000,
  status: 'completed',
  reviewStatus: 'human_verified',
  decodeStatus: 'decoded',
  adkotmDecode: {
    activities: {
      dailyRoutine: null,
      shoppingBehaviour: null,
      foodConsumptionBehaviour: null,
      foodPreparation: null,
      eatingContext: null,
    },
    demographic: {
      gender: 'Female',
      age: '34',
      residentialLocation: rl,
      residentialDistrict: rl,
      educationLevel: null,
      householdComposition: null,
      familyRole: 'Mum',
    },
    knowledge: {
      awarenessOnGutHealth: 'Aware',
      awarenessLevel: 'Aware',
      understandingSummary: 'Probiotics aid digestion',
    },
    objects: {
      productsPurchased: 'Probiotic cultured milk',
      supplementProducts: null,
      foodProducts: brand ? [brand] : [],
      actionsToSolve: [],
      productCategory: 'probiotics',
      brandPreferences: brand,
      productPreference: null,
    },
    time: {
      purchaseFrequency: 'Weekly',
      consumptionFrequency: 'Daily',
      purchaseTiming: null,
      purchaseOccasion: null,
      consumptionTiming: null,
    },
    metadata: {
      interviewTime: '10/29',
      interviewLocation: 'AEON Mall Shah Alam',
    },
    postAnalysisCodes: {
      FR: 'Mum',
      RL: rl,
      AW: 'Aware',
      PP: 'Probiotic cultured milk',
      PP1: brand,
      IL: 'AEON Mall Shah Alam',
    },
    evidenceQuotes: [],
    fieldStates: {
      brandPreferences: {
        code: brand,
        evidence_quote: brandQuote,
        confidence: brand ? 'HIGH' : 'NULL',
        status: 'ACCEPTED',
      },
      residentialLocation: {
        code: rl,
        evidence_quote: rl ? `We live in ${rl}.` : null,
        confidence: rl ? 'HIGH' : 'NULL',
        status: 'ACCEPTED',
      },
    },
  },
});

test('buildCustomFieldKey generates safe snake_case identifiers', () => {
  assert.equal(buildCustomFieldKey('Health Triggers'), 'custom_health_triggers');
  assert.equal(buildCustomFieldKey('Price Sensitivity / Promo!'), 'custom_price_sensitivity_promo');
});

test('buildTaxonomyRegistry aggregates usage counts across records and custom categories', () => {
  const records = [
    makeRecord('r1', 'AEON (1).m4a', 'Yakult', 'Kids drink Yakult daily.'),
    makeRecord('r2', 'AEON (2).m4a', 'Yakult Ace, Vitagen', 'Sometimes Yakult Ace or Vitagen.'),
  ];
  const customCats: CustomTaxonomyCategory[] = [
    {
      id: 'c1',
      name: 'Gut Supplements',
      dimension: 'O',
      fieldKey: 'productsPurchased',
      kind: 'category',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const registry = buildTaxonomyRegistry(records, customCats);
  const yakultEntry = registry.find(
    (e) => e.fieldKey === 'brandPreferences' && e.label === 'Yakult'
  );
  assert.ok(yakultEntry);
  assert.equal(yakultEntry.usageCount, 1);

  const customUnused = registry.find((e) => e.customCategoryId === 'c1');
  assert.ok(customUnused);
  assert.equal(customUnused.usageCount, 0);
});

test('renameCodeOrCategoryAcrossRecords renames labels cleanly and preserves verbatim evidence_quote', () => {
  const records = [
    makeRecord('r1', 'AEON (1).m4a', 'Yakult Ace', 'My son prefers Yakult Ace less sugar.'),
    makeRecord('r2', 'AEON (2).m4a', 'Vitagen', 'Always buy Vitagen.'),
  ];

  const { updatedRecords, affectedCount } = renameCodeOrCategoryAcrossRecords(records, {
    dimension: 'O',
    fieldKey: 'brandPreferences',
    oldLabel: 'Yakult Ace',
    newLabel: 'Yakult',
  });

  assert.equal(affectedCount, 1);
  assert.equal(updatedRecords[0].adkotmDecode?.objects.brandPreferences, 'Yakult');
  assert.equal(updatedRecords[0].adkotmDecode?.postAnalysisCodes.PP1, 'Yakult');
  // Original verbatim quote MUST remain untouched
  assert.equal(
    updatedRecords[0].adkotmDecode?.fieldStates?.brandPreferences?.evidence_quote,
    'My son prefers Yakult Ace less sugar.'
  );
  assert.equal(updatedRecords[1].adkotmDecode?.objects.brandPreferences, 'Vitagen');
});

test('mergeCodesAcrossRecords consolidates multiple synonymous labels and deduplicates within a record', () => {
  const records = [
    makeRecord('r1', 'AEON (1).m4a', 'Yakult, Yakult Less Sugar', 'Buys Yakult and Yakult Less Sugar.'),
    makeRecord('r2', 'AEON (2).m4a', 'Yakult Ace', 'Prefers Yakult Ace.'),
  ];

  const { updatedRecords, affectedCount } = mergeCodesAcrossRecords(records, {
    dimension: 'O',
    fieldKey: 'brandPreferences',
    sourceLabels: ['Yakult Less Sugar', 'Yakult Ace'],
    targetLabel: 'Yakult',
  });

  assert.equal(affectedCount, 2);
  assert.equal(updatedRecords[0].adkotmDecode?.objects.brandPreferences, 'Yakult');
  assert.equal(updatedRecords[1].adkotmDecode?.objects.brandPreferences, 'Yakult');
  assert.equal(
    updatedRecords[1].adkotmDecode?.fieldStates?.brandPreferences?.evidence_quote,
    'Prefers Yakult Ace.'
  );
});

test('deleteCodeOrCategoryAcrossRecords supports both nullifying and reassigning', () => {
  const records = [
    makeRecord('r1', 'AEON (1).m4a', 'Calpis', 'Tried Calpis once.', 'Kepong'),
    makeRecord('r2', 'AEON (2).m4a', 'Vitagen, Calpis', 'Vitagen and Calpis.', 'Shah Alam'),
  ];

  const reassigned = deleteCodeOrCategoryAcrossRecords(records, {
    dimension: 'O',
    fieldKey: 'brandPreferences',
    targetLabel: 'Calpis',
    mode: 'reassign',
    reassignToLabel: 'Cultured Milk',
  });
  assert.equal(reassigned.affectedCount, 2);
  assert.equal(reassigned.updatedRecords[0].adkotmDecode?.objects.brandPreferences, 'Cultured Milk');
  assert.equal(reassigned.updatedRecords[1].adkotmDecode?.objects.brandPreferences, 'Vitagen, Cultured Milk');

  const nullified = deleteCodeOrCategoryAcrossRecords(records, {
    dimension: 'D',
    fieldKey: 'residentialLocation',
    targetLabel: 'Kepong',
    mode: 'null',
  });
  assert.equal(nullified.affectedCount, 1);
  assert.equal(nullified.updatedRecords[0].adkotmDecode?.demographic.residentialLocation, null);
  assert.equal(nullified.updatedRecords[0].adkotmDecode?.demographic.residentialDistrict, null);
  assert.equal(nullified.updatedRecords[0].adkotmDecode?.postAnalysisCodes.RL, null);
});

test('assignCustomCategoryToRecords attaches custom parameter and category values cleanly', () => {
  const records = [makeRecord('r1', 'AEON (1).m4a', 'Yakult', 'Kids drink Yakult.')];
  const customParam: CustomTaxonomyCategory = {
    id: 'cat_ht',
    name: 'Health Triggers',
    shortCode: 'HT',
    dimension: 'K',
    fieldKey: 'custom_health_triggers',
    kind: 'parameter',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const res = assignCustomCategoryToRecords(records, {
    category: customParam,
    recordIds: ['r1'],
    value: 'Post-antibiotic recovery',
  });

  assert.equal(res.affectedCount, 1);
  assert.equal(
    res.updatedRecords[0].adkotmDecode?.customFields?.custom_health_triggers,
    'Post-antibiotic recovery'
  );
  assert.equal(
    res.updatedRecords[0].adkotmDecode?.fieldStates?.custom_health_triggers?.code,
    'Post-antibiotic recovery'
  );
});
