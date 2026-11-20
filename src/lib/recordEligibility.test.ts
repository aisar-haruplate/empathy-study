import test from 'node:test';
import assert from 'node:assert/strict';
import {
  containsInterviewContent,
  isAnalysisEligibleRecord,
  isMetadataDocumentCandidate,
  parseSessionMetadata,
  splitSessionMetadataFromNotes,
} from './recordEligibility.ts';

test('includes metadata-named notes that contain participant profiles and interview turns', () => {
  const notes = `
### Participant Profile 1
**Participant:** Parent (Mother)
**Location:** Seri Kembangan
**Interview Record:**
**Interviewer:** What products do you use?
**Parent:** I buy probiotics in sachet form.
`;

  assert.equal(containsInterviewContent(notes), true);
  assert.equal(isAnalysisEligibleRecord({ isMetaDataDoc: true, transcript: notes }), true);
});

test('continues excluding metadata-only documents', () => {
  const metadata = 'Interview date: 1 Nov 2026\nInterview location: The Campus Ampang';

  assert.equal(containsInterviewContent(metadata), false);
  assert.equal(isMetadataDocumentCandidate('Notes.txt', metadata), true);
  assert.equal(isAnalysisEligibleRecord({ isMetaDataDoc: true, transcript: metadata }), false);
});

test('splits session header from interview content and parses session-wide fields', () => {
  const notes = `**Study Title:** Family Eating Habits
**Session / Document Reference:** Campus Ampang
**Date:** November 1, 2026
**Interview Location:** The Campus Ampang
**Target Group:** Mothers of young children
---
### Participant Profile 1
**Location:** Seri Kembangan
**Interview Record:**
**Interviewer:** What products do you buy?
**Parent:** I buy probiotic sachets.`;
  const split = splitSessionMetadataFromNotes(notes);

  assert.equal(isMetadataDocumentCandidate('Notes.txt', notes), true);
  assert.match(split.metadataText, /Target Group/);
  assert.match(split.interviewText, /Participant Profile 1/);
  assert.deepEqual(parseSessionMetadata(split.metadataText), {
    date: 'November 1, 2026',
    location: 'The Campus Ampang',
  });
  assert.doesNotMatch(split.metadataText, /Seri Kembangan/);
});