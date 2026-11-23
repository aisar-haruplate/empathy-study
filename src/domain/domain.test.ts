import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TranscriptCleaner,
  CodedSpan,
  CodingSheetModel,
  AdkotmTaxonomy,
  AdkotmAnalyticsEngine,
  CrossAnalysisEngine,
  DEFAULT_CROSS_ANALYSIS_FORMULAS,
  NULL_SENTINEL,
} from './index';
import { validateDiscoveredFiles } from '../services/fileIngestionService';
import type { ADKOTMDecode, InterviewRecord } from '../types';

test('TranscriptCleaner runs all 6 deterministic stages and returns empty cleanly for blank input', () => {
  const cleaner = new TranscriptCleaner();
  assert.equal(cleaner.getStages().length, 6);

  const empty = cleaner.clean('   ');
  assert.equal(empty.cleanedText, '');
  assert.equal(empty.stageSnapshots.length, 0);

  const raw = `[00:12] Interviewer: Do you buy Vitagen or Yakult?
[00:15] Participant: Uh, aiyo, I buy Vitagen at Lotus Cheras every week. Thank you!`;
  const result = cleaner.clean(raw);
  assert.equal(result.stageSnapshots.length, 6);
  assert.match(result.cleanedText, /vitagen/i);
  assert.doesNotMatch(result.cleanedText, /do you buy/i);
});

test('CodedSpan enforces invariants and supports word-boundary snapping and overlap detection', () => {
  const transcript = 'i buy vitagen and yakult every week at lotus cheras';
  const span = new CodedSpan({
    start: 6,
    end: 24,
    dimension: 'O',
    fieldKey: 'brandPreferences',
    transcript,
  });

  assert.equal(span.quote, 'vitagen and yakult');
  assert.equal(span.length, 18);

  const snapped = span.snapToWordBoundaries(transcript);
  assert.equal(snapped.quote, 'vitagen and yakult');

  const overlapping = new CodedSpan({
    start: 18,
    end: 30,
    dimension: 'O',
    fieldKey: 'productsPurchased',
    transcript,
  });
  assert.equal(span.overlaps(overlapping), true);

  assert.throws(() => {
    new CodedSpan({
      start: 10,
      end: 10,
      dimension: 'O',
      fieldKey: 'brandPreferences',
      transcript,
    });
  }, RangeError);
});

test('CodingSheetModel manages accept, reject, edit, and span cropping while syncing flat codes', () => {
  const transcript = 'i buy vitagen and yakult every week for my daughter';
  const baseDecode: ADKOTMDecode = {
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
      householdComposition: null,
      familyRole: 'Mum',
      educationLevel: null,
    },
    knowledge: {
      awarenessOnGutHealth: null,
      awarenessLevel: null,
      understandingSummary: null,
    },
    objects: {
      productsPurchased: 'Cultured Milk',
      supplementProducts: null,
      foodProducts: null,
      actionsToSolve: null,
      productCategory: 'Cultured Milk',
      brandPreferences: 'Vitagen, Yakult',
      productPreference: null,
    },
    time: {
      purchaseFrequency: 'Weekly',
      consumptionFrequency: null,
      purchaseTiming: null,
      purchaseOccasion: null,
      consumptionTiming: null,
    },
    metadata: {
      interviewTime: null,
      interviewLocation: 'Lotus Cheras',
    },
    postAnalysisCodes: {
      FR: 'Mum',
      RL: null,
      AW: null,
      PP: 'Cultured Milk',
      PP1: 'Vitagen, Yakult',
      IL: 'Lotus Cheras',
    },
    evidenceQuotes: [],
    fieldStates: {
      brandPreferences: {
        code: 'Vitagen, Yakult',
        evidence_quote: 'buy vitagen and yakult',
        confidence: 'HIGH',
        status: 'STAGED',
      },
    },
  };

  const model = new CodingSheetModel(baseDecode, transcript);
  model.acceptField('brandPreferences');
  assert.equal(model.getField('brandPreferences')?.status, 'ACCEPTED');

  const span = model.resolveSpan('brandPreferences');
  assert.ok(span);
  assert.equal(span?.quote, 'buy vitagen and yakult');

  model.rejectField('brandPreferences');
  assert.equal(model.toDecode().postAnalysisCodes.PP1, null);
});

test('AdkotmTaxonomy and AdkotmAnalyticsEngine compute coverage ratios and themes cleanly', () => {
  const taxonomy = new AdkotmTaxonomy();
  assert.equal(taxonomy.getAllDimensions().length, 6);
  assert.equal(taxonomy.getDimensionTheme('O').accentHex, '#F6BEBA');

  const records: InterviewRecord[] = [
    {
      id: 'rec-1',
      fileName: 'Lotus Cheras 1.m4a',
      fileType: 'audio',
      mimeType: 'audio/mp4',
      source: 'local_upload',
      uploadedAt: Date.now(),
      status: 'completed',
      transcript: 'i buy vitagen every week',
      adkotmDecode: {
        activities: {
          dailyRoutine: null,
          shoppingBehaviour: 'Weekly supermarket run',
          foodConsumptionBehaviour: null,
          foodPreparation: null,
          eatingContext: null,
        },
        demographic: {
          gender: 'Female',
          age: '35',
          residentialLocation: 'Cheras',
          residentialDistrict: 'Cheras',
          householdComposition: null,
          familyRole: 'Mum',
          educationLevel: null,
        },
        knowledge: {
          awarenessOnGutHealth: 'Knows probiotics help digestion',
          awarenessLevel: 'Aware',
          understandingSummary: null,
        },
        objects: {
          productsPurchased: 'Probiotic drinks',
          supplementProducts: null,
          foodProducts: ['Vitagen'],
          actionsToSolve: null,
          productCategory: 'Probiotic drinks',
          brandPreferences: 'Vitagen',
          productPreference: null,
        },
        time: {
          purchaseFrequency: 'Weekly',
          consumptionFrequency: null,
          purchaseTiming: null,
          purchaseOccasion: null,
          consumptionTiming: null,
        },
        metadata: {
          interviewTime: null,
          interviewLocation: 'Lotus Cheras',
        },
        postAnalysisCodes: {
          FR: 'Mum',
          RL: 'Cheras',
          AW: 'Aware',
          PP: 'Probiotic drinks',
          PP1: 'Vitagen',
          IL: 'Lotus Cheras',
        },
        evidenceQuotes: [],
      },
    },
  ];

  const engine = new AdkotmAnalyticsEngine(records);
  const snapshot = engine.computeSnapshot();
  assert.equal(snapshot.eligibleRecordCount, 1);
  assert.equal(snapshot.dimensionCoverage.O.ratioText, '1/1');
  assert.ok(snapshot.totalSignals > 0);
});

test('fileIngestionService filters hidden/empty/unsupported files and extracts folder metadata', () => {
  const validAudio = new File(['abc'], 'interview1.mp3', { type: 'audio/mpeg' });
  const emptyTxt = new File([''], 'empty.txt', { type: 'text/plain' });
  const hidden = new File(['x'], '.DS_Store', { type: '' });
  const unsupported = new File(['img'], 'photo.png', { type: 'image/png' });

  const validation = validateDiscoveredFiles([
    { file: validAudio, relativePath: 'Session 10-26/Sub/interview1.mp3' },
    { file: emptyTxt, relativePath: 'Session 10-26/empty.txt' },
    { file: hidden, relativePath: 'Session 10-26/.DS_Store' },
    { file: unsupported, relativePath: 'Session 10-26/photo.png' },
  ]);

  assert.equal(validation.validItems.length, 1);
  assert.equal(validation.validItems[0].folderName, 'Sub');
  assert.equal(validation.validItems[0].folderPath, 'Session 10-26 / Sub');
  assert.equal(validation.skippedEmpty, 1);
  assert.equal(validation.skippedUnsupported, 1);
  assert.deepEqual(validation.folderRootNames, ['Session 10-26']);
});

test('CrossAnalysisEngine scores transparently, avoids Medium-High collapse on sparse records, and keeps individual venues', () => {
  const baseDecode = (overrides: Partial<ADKOTMDecode>): ADKOTMDecode => ({
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
    ...overrides,
  });

  const highRecord: InterviewRecord = {
    id: 'r-high',
    fileName: 'Jaya Grocer Elmina Lakeside Mall (1)',
    fileType: 'audio',
    mimeType: 'audio/mp4',
    source: 'local_upload',
    uploadedAt: 1,
    status: 'completed',
    sessionLocation: 'AEON Mall Shah Alam, Jaya Grocer Elmina Lakeside Mall',
    adkotmDecode: baseDecode({
      demographic: {
        gender: 'Female',
        age: '34',
        residentialLocation: 'Elmina',
        residentialDistrict: 'Elmina',
        educationLevel: null,
        householdComposition: null,
        familyRole: 'Mum',
      },
      objects: {
        productsPurchased: 'Probiotic yogurt and supplements',
        supplementProducts: null,
        foodProducts: ['Yakult'],
        actionsToSolve: null,
        productCategory: 'Yogurt',
        brandPreferences: 'Yakult',
        productPreference: null,
      },
      time: {
        purchaseFrequency: 'Weekly',
        consumptionFrequency: 'Daily',
        purchaseTiming: null,
        purchaseOccasion: null,
        consumptionTiming: 'Every morning',
      },
      metadata: {
        interviewTime: null,
        interviewLocation: 'Jaya Grocer Elmina Lakeside Mall',
      },
      postAnalysisCodes: {
        FR: 'Mum',
        RL: 'Elmina',
        AW: 'Aware',
        PP: 'Yogurt Products',
        PP1: 'Yakult',
        IL: 'Jaya Grocer Elmina Lakeside Mall',
      },
      evidenceQuotes: [
        { code: 'PP1', field: 'objects.brandPreferences', quote: 'I buy Yakult every week at Jaya Grocer.' },
      ],
    }),
  };

  const sparseRecord: InterviewRecord = {
    id: 'r-sparse',
    fileName: 'Lotus Cheras (1)',
    fileType: 'audio',
    mimeType: 'audio/mp4',
    source: 'local_upload',
    uploadedAt: 2,
    status: 'completed',
    sessionLocation: 'AEON Mall Shah Alam, Lotus Cheras',
    adkotmDecode: baseDecode({
      metadata: {
        interviewTime: null,
        interviewLocation: 'Lotus Cheras',
      },
      postAnalysisCodes: {
        FR: null,
        RL: null,
        AW: null,
        PP: null,
        PP1: null,
        IL: 'Lotus Cheras',
      },
    }),
  };

  const engine = new CrossAnalysisEngine([]);
  const spendingFormula = DEFAULT_CROSS_ANALYSIS_FORMULAS[0];
  const rows = engine.evaluateAll([highRecord, sparseRecord], spendingFormula);

  const highRow = rows.find((r) => r.record.id === 'r-high')!;
  const sparseRow = rows.find((r) => r.record.id === 'r-sparse')!;

  // High-signal record scores High with exact individual venue and verbatim quote
  assert.equal(highRow.tier, 'High');
  assert.ok(highRow.totalScore >= 78);
  assert.equal(highRow.signals.IL, 'Jaya Grocer Elmina Lakeside Mall');
  assert.equal(highRow.verbatimEvidence.length, 1);
  assert.match(highRow.breakdownText, /D: \d+\/25 \+ O: \d+\/30 \+ T: \d+\/15 \+ M: \d+\/30/);

  // Sparse record with only 1 stated dimension classifies as null (no Medium-High collapse)
  assert.equal(sparseRow.tier, null);
  assert.equal(sparseRow.signals.IL, 'Lotus Cheras');
  assert.equal(sparseRow.statedDimensionCount, 1);

  // Slicer filtering & valid % distribution exclude nulls properly
  const tierDist = engine.computeDistribution(rows, (r) => r.tier, {
    orderedKeys: spendingFormula.outputTiers,
  });
  assert.equal(tierDist.statedCount, 1);
  assert.equal(tierDist.nullCount, 1);
  const highBar = tierDist.items.find((i) => i.valueKey === 'High')!;
  assert.equal(highBar.validPct, 100);

  const onlyNull = engine.filterRows(rows, {
    tier: NULL_SENTINEL,
    FR: 'ALL',
    IL: 'ALL',
    AW: 'ALL',
    PP: 'ALL',
    hideNulls: false,
    search: '',
  });
  assert.equal(onlyNull.length, 1);
  assert.equal(onlyNull[0].record.id, 'r-sparse');
});
