import test from 'node:test';
import assert from 'node:assert/strict';
import type { InterviewRecord } from '../types';
import {
  buildVerifiedAnalyticsCsv,
  buildVerifiedAnalyticsDocHtml,
  buildVerifiedAnalyticsPdfHtml,
} from './exportUtils';

const VERIFIED_RECORDS: InterviewRecord[] = [
  {
    id: 'rec-1',
    fileName: 'AEON Mall Shah Alam 01.m4a',
    fileType: 'audio',
    mimeType: 'audio/mp4',
    source: 'local_upload',
    uploadedAt: 1700000000000,
    folderName: '10/26',
    status: 'completed',
    reviewStatus: 'human_verified',
    transcript: 'i buy vitagen and yakult every week at aeon mall shah alam',
    cleanedTranscript: 'i buy vitagen and yakult every week at aeon mall shah alam',
    adkotmDecode: {
      activities: {
        dailyRoutine: 'Morning breakfast with kids',
        shoppingBehaviour: 'Weekly supermarket run',
        foodConsumptionBehaviour: null,
        foodPreparation: null,
        eatingContext: null,
      },
      demographic: {
        gender: 'Female',
        age: '34',
        residentialLocation: 'Shah Alam',
        residentialDistrict: 'Shah Alam',
        educationLevel: 'Degree',
        householdComposition: '2 kids',
        familyRole: 'Mum',
      },
      knowledge: {
        awarenessOnGutHealth: 'Knows probiotics support digestion',
        awarenessLevel: 'Aware',
        understandingSummary: 'Links cultured milk to gut health',
      },
      objects: {
        productsPurchased: 'Cultured Milk & Probiotics',
        supplementProducts: null,
        foodProducts: ['Vitagen', 'Yakult'],
        actionsToSolve: null,
        productCategory: 'Cultured Milk & Probiotics',
        brandPreferences: 'Vitagen, Yakult',
        productPreference: 'Less sugar',
      },
      time: {
        purchaseFrequency: 'Weekly',
        consumptionFrequency: 'Daily',
        purchaseTiming: 'Weekend',
        purchaseOccasion: null,
        consumptionTiming: 'After dinner',
      },
      metadata: {
        interviewTime: '11:00 AM',
        interviewLocation: 'AEON Mall Shah Alam',
      },
      postAnalysisCodes: {
        FR: 'Mum',
        RL: 'Shah Alam',
        AW: 'Aware',
        PP: 'Cultured Milk & Probiotics',
        PP1: 'Vitagen, Yakult',
        IL: 'AEON Mall Shah Alam',
      },
      evidenceQuotes: [
        {
          code: 'PP1',
          field: 'brandPreferences',
          quote: 'i buy vitagen and yakult every week',
        },
      ],
    },
  },
];

test('buildVerifiedAnalyticsCsv includes all ADKOTM Breakdown, Theme Insights, Venue, and Coding rows', () => {
  const csv = buildVerifiedAnalyticsCsv(VERIFIED_RECORDS);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /ADKOTM Dimension Breakdown/);
  assert.match(csv, /Theme Insights/);
  assert.match(csv, /Fieldwork Venue Summary/);
  assert.match(csv, /Per-Recording ADKOTM Breakdown/);
  assert.match(csv, /AEON Mall Shah Alam/);
  assert.match(csv, /Vitagen/);
});

test('buildVerifiedAnalyticsDocHtml and PdfHtml embed inline SVG charts and all 6 dimensions without DOM scraping', () => {
  const docHtml = buildVerifiedAnalyticsDocHtml(VERIFIED_RECORDS);
  const pdfHtml = buildVerifiedAnalyticsPdfHtml(VERIFIED_RECORDS);

  for (const html of [docHtml, pdfHtml]) {
    assert.match(html, /<svg /);
    assert.match(html, /1\. ADKOTM Dimension Breakdown/);
    assert.match(html, /Objects \[O\]/);
    assert.match(html, /Activities \[A\]/);
    assert.match(html, /Knowledge \[K\]/);
    assert.match(html, /Demographics \[D\]/);
    assert.match(html, /Timing \[T\]/);
    assert.match(html, /Metadata \[M\]/);
    assert.match(html, /Consolidated Summary Table/);
    assert.match(html, /break-inside:\s*avoid/);
    assert.match(html, /AEON Mall Shah Alam/);
  }
  assert.match(pdfHtml, /Print \/ Save as PDF/);
});
