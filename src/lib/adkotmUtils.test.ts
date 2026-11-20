import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFieldUpdateToDecode,
  computeDecodeDiffs,
  createEmptyDecode,
  findUncoveredSentences,
  parseInterviewLocationFromFileName,
  verifyQuoteInTranscript,
} from './adkotmUtils.ts';

test('parseInterviewLocationFromFileName extracts clean venue and rejects generic names', () => {
  assert.equal(parseInterviewLocationFromFileName('AEON Mall Shah Alam 10/29.m4a'), 'AEON Mall Shah Alam');
  assert.equal(parseInterviewLocationFromFileName('Jaya Grocer Elmina_Part 1.mp3'), 'Jaya Grocer Elmina');
  assert.equal(parseInterviewLocationFromFileName('Lotus Cheras 29 Oct 2026.wav'), 'Lotus Cheras');
  assert.equal(parseInterviewLocationFromFileName('Recording 1.m4a'), null);
  assert.equal(parseInterviewLocationFromFileName('Interview Notes.txt'), null);
});

test('verifyQuoteInTranscript enforces substring grounding case-insensitively and tolerates punctuation', () => {
  const cleaned =
    'ten. i buy yakult every week at aeon mall because she likes yogurt and has constipation.';

  assert.equal(verifyQuoteInTranscript('i buy yakult every week at aeon mall', cleaned), true);
  assert.equal(verifyQuoteInTranscript('I buy Yakult every week at AEON Mall!', cleaned), true);
  assert.equal(verifyQuoteInTranscript('she eats broccoli and fish oil daily', cleaned), false);
  assert.equal(verifyQuoteInTranscript('', cleaned), false);
});

test('applyFieldUpdateToDecode updates target field, postAnalysisCodes, fieldDetails, and evidenceQuotes', () => {
  const base = createEmptyDecode();
  const updated = applyFieldUpdateToDecode(base, {
    section: 'objects',
    field: 'brandPreferences',
    postAnalysisCode: 'PP1',
    value: 'Vitagen, Yakult',
    evidence_quote: 'i buy yakult and vitagen every week',
    confidence: 'HIGH',
    reasoning: 'Explicitly mentioned both probiotic brands',
  });

  assert.equal(updated.objects.brandPreferences, 'Vitagen, Yakult');
  assert.equal(updated.postAnalysisCodes.PP1, 'Vitagen, Yakult');
  assert.equal(updated.fieldDetails?.brandPreferences?.confidence, 'HIGH');
  assert.equal(updated.fieldStates?.brandPreferences?.code, 'Vitagen, Yakult');
  assert.equal(updated.fieldStates?.brandPreferences?.status, 'MANUAL');
  assert.equal(updated.fieldStates?.brandPreferences?.evidence_quote, 'i buy yakult and vitagen every week');
  assert.equal(updated.evidenceQuotes.length, 1);
  assert.equal(updated.evidenceQuotes[0].code, 'PP1');
});

test('findUncoveredSentences detects sentences absent from evidenceQuotes and fieldDetails', () => {
  const base = applyFieldUpdateToDecode(createEmptyDecode(), {
    section: 'objects',
    field: 'brandPreferences',
    postAnalysisCode: 'PP1',
    value: 'Yakult',
    evidence_quote: 'i buy yakult every week',
    confidence: 'HIGH',
    reasoning: 'Brand stated',
  });

  const transcript = 'i buy yakult every week. she is a swimmer and has constipation.';
  const uncovered = findUncoveredSentences(transcript, base);
  assert.deepEqual(uncovered, ['she is a swimmer and has constipation.']);
});

test('computeDecodeDiffs returns only changed fields across old and new decode', () => {
  const oldDec = applyFieldUpdateToDecode(createEmptyDecode(), {
    section: 'demographic',
    field: 'familyRole',
    postAnalysisCode: 'FR',
    value: null,
    confidence: 'NULL',
  });
  const newDec = applyFieldUpdateToDecode(oldDec, {
    section: 'demographic',
    field: 'familyRole',
    postAnalysisCode: 'FR',
    value: 'Mum',
    evidence_quote: 'as a mother i cook for my kid',
    confidence: 'HIGH',
    reasoning: 'Matched custom FR rule',
  });

  const diffs = computeDecodeDiffs('rec_1', 'Test.m4a', oldDec, newDec);
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].field, 'familyRole');
  assert.equal(diffs[0].oldValue, null);
  assert.equal(diffs[0].newValue, 'Mum');
});
