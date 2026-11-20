import test from 'node:test';
import assert from 'node:assert/strict';
import type { InterviewRecord } from '../types';
import {
  extractLocationFromFilename,
  stripRecordingExtension,
  verifyEvidenceQuote,
  enforceStrictGrounding,
  syncFlatDecodeFromFieldStates,
  computeReviewProgress,
  isHumanVerifiedRecord,
  buildTranscriptHighlightSegments,
  scanMissedSignals,
  proposeTaxonomyNormalizations,
  applyTaxonomyNormalizations,
} from './adkotmCopilot';

test('stripRecordingExtension strips media and text extensions cleanly', () => {
  assert.equal(stripRecordingExtension('AEON Mall Shah Alam 10/29.m4a'), 'AEON Mall Shah Alam 10/29');
  assert.equal(stripRecordingExtension('Interview 1.mp3'), 'Interview 1');
  assert.equal(stripRecordingExtension('Notes.txt'), 'Notes');
});

test('extractLocationFromFilename parses mall/venue names and ignores generic names', () => {
  assert.equal(extractLocationFromFilename('AEON Mall Shah Alam 10/29.m4a'), 'AEON Mall Shah Alam');
  assert.equal(extractLocationFromFilename('Brem Mall Kepong NSK 10-26 (2).m4a'), 'Brem Mall Kepong NSK');
  assert.equal(extractLocationFromFilename('Jaya Grocer Elmina 291026 Part 1.m4a'), 'Jaya Grocer Elmina');
  assert.equal(extractLocationFromFilename('Recording 1.m4a'), null);
  assert.equal(extractLocationFromFilename('Interview 4.txt'), null);
});

test('verifyEvidenceQuote matches exact and whitespace/smart-quote normalized substrings', () => {
  const transcript = 'Every morning I give my kids Yakult after breakfast. We stay in Kepong.';
  const exact = verifyEvidenceQuote(transcript, 'give my kids Yakult after breakfast');
  assert.ok(exact);
  assert.equal(exact.matchedText, 'give my kids Yakult after breakfast');

  const norm = verifyEvidenceQuote(transcript, 'we stay in kepong');
  assert.ok(norm);
  assert.equal(norm.matchedText, 'We stay in Kepong');

  const missing = verifyEvidenceQuote(transcript, 'drinks goat milk every night');
  assert.equal(missing, null);
});

test('enforceStrictGrounding nulls ungrounded fields and falls back IL from filename', () => {
  const transcript = 'I always buy Yakult at the supermarket because my daughter likes it.';
  const grounded = enforceStrictGrounding(
    {
      productsPurchased: {
        code: 'Probiotic Drinks',
        evidence_quote: 'buy Yakult at the supermarket',
        confidence: 'HIGH',
      },
      residentialLocation: {
        code: 'Subang Jaya',
        evidence_quote: 'I live in Subang Jaya', // fabricated quote not in transcript!
        confidence: 'HIGH',
      },
      dailyRoutine: {
        code: 'Morning gym routine',
        evidence_quote: null, // missing quote!
        confidence: 'REVIEW_NEEDED',
      },
    },
    transcript,
    'AEON Mall Shah Alam 10/29.m4a'
  );

  assert.equal(grounded.productsPurchased.code, 'Probiotic Drinks');
  assert.equal(grounded.productsPurchased.status, 'STAGED');
  assert.equal(grounded.productsPurchased.confidence, 'HIGH');

  assert.equal(grounded.residentialLocation.code, null);
  assert.equal(grounded.residentialLocation.confidence, 'NULL');

  assert.equal(grounded.dailyRoutine.code, null);
  assert.equal(grounded.dailyRoutine.confidence, 'NULL');

  assert.equal(grounded.interviewLocation.code, 'AEON Mall Shah Alam');
  assert.equal(grounded.interviewLocation.confidence, 'HIGH');
  assert.equal(grounded.interviewLocation.source, 'filename_metadata');
});

test('syncFlatDecodeFromFieldStates keeps REJECTED fields out of flat postAnalysisCodes', () => {
  const synced = syncFlatDecodeFromFieldStates({
    productsPurchased: {
      code: 'Probiotic Drinks',
      evidence_quote: 'buy Yakult',
      confidence: 'HIGH',
      status: 'ACCEPTED',
    },
    residentialLocation: {
      code: 'Kepong',
      evidence_quote: 'stay in Kepong',
      confidence: 'REVIEW_NEEDED',
      status: 'REJECTED',
    },
  });

  assert.equal(synced.postAnalysisCodes.PP, 'Probiotic Drinks');
  assert.equal(synced.objects.productsPurchased, 'Probiotic Drinks');
  assert.equal(synced.postAnalysisCodes.RL, null);
  assert.equal(synced.demographic.residentialLocation, null);
  assert.equal(synced.evidenceQuotes.length, 1);
  assert.equal(synced.evidenceQuotes[0].quote, 'buy Yakult');
});

test('buildTranscriptHighlightSegments maps quotes to non-overlapping dimension spans', () => {
  const transcript = 'I stay in Kepong. Every morning my child drinks Yakult.';
  const segments = buildTranscriptHighlightSegments(transcript, {
    residentialLocation: {
      code: 'Kepong',
      evidence_quote: 'stay in Kepong',
      confidence: 'HIGH',
      status: 'ACCEPTED',
    },
    productsPurchased: {
      code: 'Probiotic Drinks',
      evidence_quote: 'drinks Yakult',
      confidence: 'HIGH',
      status: 'STAGED',
    },
  });

  const highlighted = segments.filter((s) => s.fieldKey);
  assert.equal(highlighted.length, 2);
  assert.equal(highlighted[0].dimension, 'D');
  assert.equal(highlighted[0].text, 'stay in Kepong');
  assert.equal(highlighted[1].dimension, 'O');
  assert.equal(highlighted[1].text, 'drinks Yakult');
});

test('buildTranscriptHighlightSegments attaches shared fieldKeys when two fields quote the same span', () => {
  const transcript = 'I always buy Vitagen and Yakult for my children.';
  const segments = buildTranscriptHighlightSegments(transcript, {
    productsPurchased: {
      code: 'Probiotic Drinks',
      evidence_quote: 'buy Vitagen and Yakult',
      confidence: 'HIGH',
      status: 'ACCEPTED',
    },
    brandPreferences: {
      code: 'Vitagen, Yakult',
      evidence_quote: 'buy Vitagen and Yakult',
      confidence: 'HIGH',
      status: 'STAGED',
    },
  });

  const highlighted = segments.filter((s) => s.fieldKey);
  assert.equal(highlighted.length, 1);
  assert.ok(highlighted[0].fieldKeys?.includes('productsPurchased'));
  assert.ok(highlighted[0].fieldKeys?.includes('brandPreferences'));
});

test('scanMissedSignals detects uncoded constipation, swimmer, and local brand cues', () => {
  const transcript =
    'I buy Yakult for my family. Lately my younger son has constipation and he is a competitive swimmer. We also tried Biogaya and Amway supplements.';
  const fieldStates = {
    brandPreferences: {
      code: 'Yakult',
      evidence_quote: 'I buy Yakult for my family.',
      confidence: 'HIGH' as const,
      status: 'ACCEPTED' as const,
    },
  };

  const signals = scanMissedSignals(transcript, fieldStates);
  const keywords = signals.map((s) => (s.matchedKeyword || '').toLowerCase());
  assert.ok(keywords.some((k) => k.includes('constipation')));
  assert.ok(keywords.some((k) => k.includes('swimmer')));
  assert.ok(keywords.some((k) => k.includes('biogaya')));
  assert.ok(keywords.some((k) => k.includes('amway')));
});

test('Human Verified gating excludes staged AI drafts and includes human_verified records', () => {
  const stagedRecord: InterviewRecord = {
    id: 'rec_1',
    fileName: 'Test 1.m4a',
    fileType: 'audio',
    mimeType: 'audio/mp4',
    source: 'local_upload',
    uploadedAt: 1,
    status: 'completed',
    transcript: 'I drink Yakult.',
    decodeStatus: 'decoded',
    reviewStatus: 'needs_review',
    adkotmDecode: syncFlatDecodeFromFieldStates({
      productsPurchased: {
        code: 'Probiotic Drinks',
        evidence_quote: 'drink Yakult',
        confidence: 'REVIEW_NEEDED',
        status: 'STAGED',
      },
    }),
  };

  assert.equal(computeReviewProgress(stagedRecord).status, 'needs_review');
  assert.equal(computeReviewProgress(stagedRecord).flagCount, 1);
  assert.equal(isHumanVerifiedRecord(stagedRecord), false);

  const verifiedRecord: InterviewRecord = {
    ...stagedRecord,
    reviewStatus: 'human_verified',
  };
  assert.equal(isHumanVerifiedRecord(verifiedRecord), true);
});

test('proposeTaxonomyNormalizations and applyTaxonomyNormalizations standardize PP while preserving PP1 brands', () => {
  const r1: InterviewRecord = {
    id: 'r1',
    fileName: 'AEON Mall 10/29.m4a',
    fileType: 'audio',
    mimeType: 'audio/mp4',
    source: 'local_upload',
    uploadedAt: 1,
    status: 'completed',
    transcript: 'We buy Vitagen and Yakult.',
    decodeStatus: 'decoded',
    reviewStatus: 'human_verified',
    adkotmDecode: syncFlatDecodeFromFieldStates({
      productsPurchased: {
        code: 'Vitagen and Yakult',
        evidence_quote: 'buy Vitagen and Yakult',
        confidence: 'HIGH',
        status: 'ACCEPTED',
      },
      brandPreferences: {
        code: 'Vitagen',
        evidence_quote: 'buy Vitagen and Yakult',
        confidence: 'HIGH',
        status: 'ACCEPTED',
      },
    }),
  };

  const proposals = proposeTaxonomyNormalizations([r1]);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].normalizedValue, 'Probiotic Drinks');
  assert.equal(proposals[0].preservedBrands['r1'], 'Vitagen, Yakult');

  const updated = applyTaxonomyNormalizations([r1], proposals, [proposals[0].id]);
  assert.equal(updated[0].adkotmDecode?.postAnalysisCodes.PP, 'Probiotic Drinks');
  assert.equal(updated[0].adkotmDecode?.postAnalysisCodes.PP1, 'Vitagen, Yakult');
});
