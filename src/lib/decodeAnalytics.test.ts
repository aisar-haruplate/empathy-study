import test from 'node:test';
import assert from 'node:assert/strict';
import type { InterviewRecord } from '../types';
import {
  computeActivityCooccurrenceMatrix,
  computeDemographicsBentoData,
  computeEmpathySummaryData,
  computeExecutiveCoverageRows,
  computeExecutiveSignalOverview,
  computeFolderTabSignalCounts,
  computeKnowledgeBentoData,
  computeMetadataBentoData,
  computeObjectsBentoData,
  computeTimingBentoData,
  computeTraceableDimensionDataset,
  computeUnifiedObjectsChartData,
  extractEvidenceQuotes,
  filterRecordsByCrossFilter,
  formatDecodeDimensionLabel,
  getViewExportLabel,
  TIMING_SPECTRUM_ORDER,
} from './decodeAnalytics';

const makeVerifiedRecord = (
  id: string,
  fileName: string,
  overrides: Partial<InterviewRecord> = {}
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
  ...overrides,
});

const SAMPLE_RECORDS: InterviewRecord[] = [
  makeVerifiedRecord('rec-1', 'AEON Mall Shah Alam (1) 10_29.m4a', {
    folderName: '10/29',
    adkotmDecode: {
      activities: {
        dailyRoutine: 'Morning school drop-off',
        shoppingBehaviour: 'Weekly mall grocery run',
        foodConsumptionBehaviour: 'Gives probiotic drink after breakfast',
        foodPreparation: 'Home cooked porridge',
        eatingContext: null,
      },
      demographic: {
        gender: 'Female',
        age: '34',
        residentialLocation: 'Shah Alam',
        residentialDistrict: 'Shah Alam',
        educationLevel: null,
        householdComposition: 'Parents + 2 kids',
        familyRole: 'Mum',
      },
      knowledge: {
        awarenessOnGutHealth: 'Aware: knows probiotics support digestion',
        awarenessLevel: 'Aware',
        understandingSummary: 'Good bacteria keep child digestion smooth and boost immunity',
      },
      objects: {
        productsPurchased: 'Probiotic cultured milk',
        supplementProducts: null,
        foodProducts: ['Yakult'],
        actionsToSolve: ['Cultivated milk drinks'],
        productCategory: 'probiotics',
        brandPreferences: 'Yakult',
        productPreference: 'Less sugar',
      },
      time: {
        purchaseFrequency: 'Weekly',
        consumptionFrequency: 'Daily',
        purchaseTiming: null,
        purchaseOccasion: null,
        consumptionTiming: 'Every morning after breakfast',
      },
      metadata: {
        interviewTime: '10/29',
        interviewLocation: 'AEON Mall Shah Alam',
      },
      postAnalysisCodes: {
        FR: 'Mum',
        RL: 'Shah Alam',
        AW: 'Aware',
        PP: 'Probiotic cultured milk',
        PP1: 'Yakult',
        IL: 'AEON Mall Shah Alam',
      },
      evidenceQuotes: [
        {
          code: 'Daily morning Yakult',
          field: 'consumptionTiming',
          quote: 'Every morning after breakfast my daughter drinks one bottle of Yakult.',
        },
      ],
      fieldStates: {
        brandPreferences: {
          code: 'Yakult',
          evidence_quote: 'We always buy Yakult less sugar for the kids.',
          confidence: 'HIGH',
          status: 'ACCEPTED',
        },
        residentialLocation: {
          code: 'Shah Alam',
          evidence_quote: 'We stay in Seksyen 7 Shah Alam.',
          confidence: 'HIGH',
          status: 'ACCEPTED',
        },
      },
    },
  }),
  makeVerifiedRecord('rec-2', 'Jaya Grocer Elmina (2) 10_29.m4a', {
    folderName: '10/29',
    adkotmDecode: {
      activities: {
        dailyRoutine: 'Morning walk and market',
        shoppingBehaviour: null,
        foodConsumptionBehaviour: null,
        foodPreparation: null,
        eatingContext: null,
      },
      demographic: {
        gender: 'Male',
        age: '66',
        residentialLocation: 'Kepong',
        residentialDistrict: 'Kepong',
        educationLevel: null,
        householdComposition: 'Elderly couple',
        familyRole: 'Elderly',
      },
      knowledge: {
        awarenessOnGutHealth: 'Not Aware',
        awarenessLevel: 'Not Aware',
        understandingSummary: null,
      },
      objects: {
        productsPurchased: 'Probiotic supplement',
        supplementProducts: ['Amway probiotic'],
        foodProducts: null,
        actionsToSolve: ['Probiotic supplement'],
        productCategory: 'supplement',
        brandPreferences: 'Amway',
        productPreference: null,
      },
      time: {
        purchaseFrequency: null,
        consumptionFrequency: 'Occasionally',
        purchaseTiming: null,
        purchaseOccasion: 'When constipated',
        consumptionTiming: 'When constipated',
      },
      metadata: {
        interviewTime: '10/29',
        interviewLocation: 'Jaya Grocer Elmina',
      },
      postAnalysisCodes: {
        FR: 'Elderly',
        RL: 'Kepong',
        AW: 'Not Aware',
        PP: 'Probiotic supplement',
        PP1: 'Amway',
        IL: 'Jaya Grocer Elmina',
      },
      evidenceQuotes: [],
      fieldStates: {
        awarenessOnGutHealth: {
          code: 'Not aware of probiotics',
          evidence_quote: 'I never heard about gut bacteria, only take powder when constipated.',
          confidence: 'HIGH',
          status: 'ACCEPTED',
        },
      },
    },
  }),
  makeVerifiedRecord('rec-3', 'AEON Mall Shah Alam (2) 10_29.m4a', {
    folderName: '10/29',
    adkotmDecode: {
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
        familyRole: 'Mum',
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
        interviewTime: '10/29',
        interviewLocation: 'AEON Mall Shah Alam',
      },
      postAnalysisCodes: {
        FR: 'Mum',
        RL: null,
        AW: null,
        PP: null,
        PP1: null,
        IL: 'AEON Mall Shah Alam',
      },
      evidenceQuotes: [],
    },
  }),
];

test('dimension labels are clear and consistent', () => {
  assert.equal(formatDecodeDimensionLabel('object'), 'Within Object (O)');
  assert.equal(formatDecodeDimensionLabel('activity'), 'Within Activity (A)');
  assert.equal(formatDecodeDimensionLabel('demographic'), 'Demographic (D) • Residence RL');
  assert.equal(formatDecodeDimensionLabel('metadata'), 'Metadata (M) • Field Venue IL');
});

test('view export names are descriptive for all decode layers', () => {
  assert.equal(getViewExportLabel('overview'), 'Overview matrix');
  assert.equal(getViewExportLabel('object'), 'Within Object (O)');
  assert.equal(getViewExportLabel('activity'), 'Within Activity (A)');
  assert.equal(getViewExportLabel('knowledge'), 'Within Knowledge (K)');
});

test('knowledge coverage isolates null values from stated percentages', () => {
  const kData = computeKnowledgeBentoData(SAMPLE_RECORDS);
  assert.equal(kData.awareCount, 1);
  assert.equal(kData.notAwareCount, 1);
  assert.equal(kData.unstatedCount, 1);
  // Stated denominator is 2 (1 Aware, 1 Not Aware) -> 50% of stated, NOT 33%
  assert.equal(kData.coverage.statedCount, 2);
  assert.equal(kData.coverage.unstatedCount, 1);
  assert.equal(kData.awarePctOfStated, 50);
});

test('RL (Demographic D) and IL (Metadata M) remain strictly separated and compute avg signals', () => {
  const dData = computeDemographicsBentoData(SAMPLE_RECORDS);
  const mData = computeMetadataBentoData(SAMPLE_RECORDS);

  assert.deepEqual(
    dData.residenceItems.map((i) => i.label).sort(),
    ['Kepong', 'Shah Alam']
  );
  assert.equal(dData.residenceCoverage.statedCount, 2);
  assert.equal(dData.residenceCoverage.unstatedCount, 1);

  assert.equal(mData.venues[0].venue, 'AEON Mall Shah Alam');
  assert.equal(mData.venues[0].interviewCount, 2);
  assert.ok(mData.venues[0].avgSignals > 0);
  assert.equal(mData.venues[1].venue, 'Jaya Grocer Elmina');
  assert.equal(mData.venues[1].interviewCount, 1);
});

test('objects co-occurrence matrix maps brands to probiotic and supplement columns', () => {
  const oData = computeObjectsBentoData(SAMPLE_RECORDS);
  assert.equal(oData.brandCoverage.statedCount, 2);
  assert.equal(oData.brandCoverage.unstatedCount, 1);

  const yakultRow = oData.brandMatrix.rows.find((r) => r.brand === 'Yakult');
  const amwayRow = oData.brandMatrix.rows.find((r) => r.brand.includes('Amway'));
  assert.ok(yakultRow);
  assert.equal(yakultRow.countsByProductType.probiotic, 1);
  assert.ok(amwayRow);
  assert.equal(amwayRow.countsByProductType.supplement, 1);
});

test('timing buckets, empathy summary, and executive overview compute cleanly', () => {
  const exec = computeExecutiveSignalOverview(SAMPLE_RECORDS);
  assert.equal(exec.dimensions.length, 6);
  assert.ok(exec.totalEmpiricalSignals > 0);

  const tData = computeTimingBentoData(SAMPLE_RECORDS);
  assert.equal(tData.coverage.statedCount, 2);
  assert.ok(tData.buckets.some((b) => b.label === 'Daily / Every Morning' && b.count === 1));
  assert.ok(tData.buckets.some((b) => b.label === 'When Unwell / Constipated' && b.count === 1));

  const emp = computeEmpathySummaryData(SAMPLE_RECORDS);
  const mumCohort = emp.cohorts.find((c) => c.roleKey === 'Mum');
  const eldCohort = emp.cohorts.find((c) => c.roleKey === 'Elderly');
  assert.equal(mumCohort?.aware, 1);
  assert.equal(mumCohort?.awarenessRate, 100);
  assert.equal(eldCohort?.notAware, 1);
  assert.equal(eldCohort?.awarenessRate, 0);
});

test('cross-filtering and evidence quote extraction return grounded spans', () => {
  const filtered = filterRecordsByCrossFilter(SAMPLE_RECORDS, {
    id: 'brand:Yakult',
    dimension: 'O',
    filterType: 'brand',
    value: 'Yakult',
    label: 'Brand: Yakult',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'rec-1');

  const quotes = extractEvidenceQuotes(SAMPLE_RECORDS, {
    title: 'Objects quotes for Yakult',
    dimension: 'O',
    filter: {
      id: 'brand:Yakult',
      dimension: 'O',
      filterType: 'brand',
      value: 'Yakult',
      label: 'Brand: Yakult',
    },
  });
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].recordId, 'rec-1');
  assert.match(quotes[0].quote, /Yakult less sugar/);
});

test('traceable analytics computes Valid % strictly over Stated records (1 of 1 = 100%) and preserves contributor quotes', () => {
  const sparseRecords: InterviewRecord[] = [
    ...SAMPLE_RECORDS,
    ...Array.from({ length: 6 }, (_, idx) =>
      makeVerifiedRecord(`rec-null-${idx}`, `Lotus Cheras (${idx + 1}) 10_29.m4a`, {
        adkotmDecode: {
          activities: { dailyRoutine: null, shoppingBehaviour: null, foodConsumptionBehaviour: null, foodPreparation: null, eatingContext: null },
          demographic: { gender: null, age: null, residentialLocation: null, residentialDistrict: null, educationLevel: null, householdComposition: null, familyRole: null },
          knowledge: { awarenessOnGutHealth: null, awarenessLevel: null, understandingSummary: null },
          objects: { productsPurchased: null, supplementProducts: null, foodProducts: [], actionsToSolve: [], productCategory: null, brandPreferences: null, productPreference: null },
          time: { purchaseFrequency: null, consumptionFrequency: null, purchaseTiming: null, purchaseOccasion: null, consumptionTiming: null },
          metadata: { interviewTime: '10/29', interviewLocation: 'Lotus Cheras' },
          postAnalysisCodes: { FR: null, RL: null, AW: null, PP: null, PP1: null, IL: 'Lotus Cheras' },
          evidenceQuotes: [],
        },
      })
    ),
  ];

  // Filter to only rec-1 + 6 null records => 7 total, 1 stated for Yakult => 1/1 = 100%
  const oneOfSeven = [sparseRecords[0], ...sparseRecords.slice(3)];
  const oDataset = computeTraceableDimensionDataset(oneOfSeven, 'O');
  const brandGroup = oDataset.groups.find((g) => g.id === 'o_brands_pp1');
  assert.ok(brandGroup);
  assert.equal(brandGroup.statedCount, 1);
  assert.equal(brandGroup.unstatedCount, 6);
  assert.equal(brandGroup.totalRecords, 7);

  const yakultItem = brandGroup.items.find((i) => i.label === 'Yakult');
  assert.ok(yakultItem);
  assert.equal(yakultItem.count, 1);
  assert.equal(yakultItem.validPct, 100);
  assert.equal(yakultItem.contributors.length, 1);
  assert.equal(yakultItem.contributors[0].fileName, 'AEON Mall Shah Alam (1) 10_29.m4a');
  assert.match(yakultItem.contributors[0].quote || '', /Yakult less sugar/);
  assert.match(yakultItem.formulaText, /1 \/ 1 stated records? = 100%/);
});

test('folder tab signal counts reconcile overview total and include custom parameter groups', () => {
  const withCustom: InterviewRecord[] = SAMPLE_RECORDS.map((r, i) =>
    i === 0 && r.adkotmDecode
      ? {
          ...r,
          adkotmDecode: {
            ...r.adkotmDecode,
            customFields: { custom_health_triggers: 'Child constipation' },
            fieldStates: {
              ...r.adkotmDecode.fieldStates,
              custom_health_triggers: {
                code: 'Child constipation',
                evidence_quote: 'Sometimes she gets constipated after travel.',
                confidence: 'HIGH',
                status: 'MANUAL',
              },
            },
          },
        }
      : r
  );

  const customCats = [
    {
      id: 'cat_ht',
      name: 'Health Triggers',
      shortCode: 'HT',
      dimension: 'K' as const,
      fieldKey: 'custom_health_triggers',
      kind: 'parameter' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const kDataset = computeTraceableDimensionDataset(withCustom, 'K', customCats);
  const customGroup = kDataset.groups.find((g) => g.fieldKey === 'custom_health_triggers');
  assert.ok(customGroup);
  assert.equal(customGroup.statedCount, 1);
  assert.equal(customGroup.items[0].label, 'Child constipation');
  assert.equal(customGroup.items[0].validPct, 100);

  const tabCounts = computeFolderTabSignalCounts(withCustom, customCats);
  assert.equal(
    tabCounts.overview,
    tabCounts.O + tabCounts.A + tabCounts.K + tabCounts.D + tabCounts.T + tabCounts.M
  );
});

test('unified Objects separates commercial brands from generic foods and reconciles executive coverage', () => {
  const oDs = computeTraceableDimensionDataset(SAMPLE_RECORDS, 'O');
  const unified = computeUnifiedObjectsChartData(oDs);

  const yakult = unified.items.find((i) => i.label === 'Yakult');
  const cultured = unified.items.find((i) => i.label === 'Probiotic cultured milk');
  assert.ok(yakult);
  assert.equal(yakult.objectKind, 'brand');
  assert.ok(cultured);
  assert.equal(cultured.objectKind, 'food');

  const byDim = {
    O: oDs,
    A: computeTraceableDimensionDataset(SAMPLE_RECORDS, 'A'),
    K: computeTraceableDimensionDataset(SAMPLE_RECORDS, 'K'),
    D: computeTraceableDimensionDataset(SAMPLE_RECORDS, 'D'),
    T: computeTraceableDimensionDataset(SAMPLE_RECORDS, 'T'),
    M: computeTraceableDimensionDataset(SAMPLE_RECORDS, 'M'),
  };
  const execRows = computeExecutiveCoverageRows(byDim, SAMPLE_RECORDS.length);
  assert.equal(execRows.length, 6);
  execRows.forEach((row) => {
    assert.equal(row.statedPct + row.unstatedPct, 100);
    assert.equal(row.statedCount + row.unstatedCount, SAMPLE_RECORDS.length);
  });
});

test('activities co-occurrence matrix tracks shared routines and timing follows canonical cadence spectrum', () => {
  const matrix = computeActivityCooccurrenceMatrix(SAMPLE_RECORDS, 7);
  assert.ok(matrix.habits.length >= 2);
  const routineIdx = matrix.habits.findIndex((h) => h.label === 'Morning school drop-off');
  const drinkIdx = matrix.habits.findIndex(
    (h) => h.label === 'Gives probiotic drink after breakfast'
  );
  assert.ok(routineIdx >= 0 && drinkIdx >= 0);
  assert.equal(matrix.cells[routineIdx][drinkIdx].count, 1);
  assert.equal(matrix.cells[routineIdx][drinkIdx].traceItem.contributors[0].recordId, 'rec-1');

  const tDs = computeTraceableDimensionDataset(SAMPLE_RECORDS, 'T');
  const labels = tDs.groups[0].items.map((i) => i.label);
  const indexes = labels.map((l) => TIMING_SPECTRUM_ORDER.indexOf(l));
  assert.deepEqual(
    indexes,
    [...indexes].sort((a, b) => a - b)
  );
});


