import { InterviewRecord } from '../types';

export interface SplitCandidatePair {
  recordA: InterviewRecord;
  recordB: InterviewRecord;
  fileName: string;
  first3A: string[];
  first3B: string[];
  isExactDuplicate: boolean;
  isSplitRecording: boolean;
  reason: string;
}

export interface RecordAuditInfo {
  isDuplicate: boolean;
  duplicateType: 'exact_duplicate' | 'split_recording';
  partnerRecordId: string;
  partnerFileName: string;
  partnerUploadedAt: number;
  first3Current: string[];
  first3Partner: string[];
  reason: string;
}

export interface RecordingAuditResult {
  totalAudited: number;
  duplicateRecordIds: Set<string>;
  exactDuplicateRecordIds: Set<string>;
  splitRecordingPairs: SplitCandidatePair[];
  exactDuplicatePairs: SplitCandidatePair[];
  auditInfoByRecordId: Map<string, RecordAuditInfo>;
}

/**
 * Extracts the first N conversation lines or speaker dialogue turns from a transcript.
 */
export function extractFirstNConversations(transcript?: string, n = 3): string[] {
  if (!transcript || !transcript.trim()) return [];

  // Split by newlines, ignore empty lines and markdown headers/dividers
  const lines = transcript
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter((l) => {
      if (l.length === 0) return false;
      if (l.startsWith('---') || l.startsWith('===') || l.startsWith('###')) return false;
      if (l.toLowerCase().includes('interview metadata') || l.toLowerCase().includes('date folder')) return false;
      return true;
    });

  return lines.slice(0, n);
}

/**
 * Compares two sets of conversation turns to determine if they represent the exact same dialogue
 * or different conversation content.
 */
export function compareConversationTurns(turnsA: string[], turnsB: string[]): {
  isIdentical: boolean;
  isDifferent: boolean;
  similarityRatio: number;
} {
  // If both have 0 turns (e.g. neither has been transcribed yet)
  if (turnsA.length === 0 && turnsB.length === 0) {
    return { isIdentical: true, isDifferent: false, similarityRatio: 1.0 };
  }

  // If one has transcript and one doesn't
  if (turnsA.length === 0 || turnsB.length === 0) {
    return { isIdentical: true, isDifferent: false, similarityRatio: 1.0 };
  }

  // Normalize turns for comparison (remove punctuation, lower-case, collapse spaces)
  const normA = turnsA
    .map((t) =>
      t
        .toLowerCase()
        .replace(/speaker\s*\d+\s*:/g, '')
        .replace(/interviewer\s*:/g, '')
        .replace(/respondent\s*:/g, '')
        .replace(/[^\w\s]/g, '')
        .trim()
    )
    .filter(Boolean)
    .join(' ');

  const normB = turnsB
    .map((t) =>
      t
        .toLowerCase()
        .replace(/speaker\s*\d+\s*:/g, '')
        .replace(/interviewer\s*:/g, '')
        .replace(/respondent\s*:/g, '')
        .replace(/[^\w\s]/g, '')
        .trim()
    )
    .filter(Boolean)
    .join(' ');

  if (!normA || !normB) {
    return { isIdentical: true, isDifferent: false, similarityRatio: 1.0 };
  }

  if (normA === normB) {
    return { isIdentical: true, isDifferent: false, similarityRatio: 1.0 };
  }

  // Check prefix / substring match
  const checkLen = Math.min(normA.length, normB.length, 60);
  if (checkLen > 25) {
    const subA = normA.slice(0, checkLen);
    const subB = normB.slice(0, checkLen);
    if (subA === subB || normA.includes(subB) || normB.includes(subA)) {
      return { isIdentical: true, isDifferent: false, similarityRatio: 0.9 };
    }
  }

  // Different conversation turns!
  return { isIdentical: false, isDifferent: true, similarityRatio: 0.0 };
}

/**
 * Normalizes a recording filename for duplicate auditing (removes audio extensions, extra spaces, casing)
 */
export function normalizeRecordingName(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/\.(m4a|mp3|wav|ogg|aac|flac|wma|txt|docx?)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Performs a comprehensive audit across all interview records:
 * 1. Finds duplicate filenames (within the same session or cross-session).
 * 2. Compares the first 3 conversation turns of each pair.
 * 3. Identifies exact duplicates vs. split recordings of the same interview.
 */
export function performRecordingAudit(records: InterviewRecord[]): RecordingAuditResult {
  const audioAndDocRecords = records.filter((r) => !r.isMetaDataDoc);
  const nameMap = new Map<string, InterviewRecord[]>();

  audioAndDocRecords.forEach((r) => {
    const norm = normalizeRecordingName(r.fileName);
    const list = nameMap.get(norm) || [];
    list.push(r);
    nameMap.set(norm, list);
  });

  const duplicateRecordIds = new Set<string>();
  const exactDuplicateRecordIds = new Set<string>();
  const splitRecordingPairs: SplitCandidatePair[] = [];
  const exactDuplicatePairs: SplitCandidatePair[] = [];
  const auditInfoByRecordId = new Map<string, RecordAuditInfo>();

  nameMap.forEach((group) => {
    if (group.length > 1) {
      // Sort so earlier uploaded is recordA (Part 1 / original), later is recordB (Part 2 / copy)
      const sorted = [...group].sort((a, b) => a.uploadedAt - b.uploadedAt);

      for (let i = 0; i < sorted.length - 1; i++) {
        const recA = sorted[i];
        const recB = sorted[i + 1];

        const first3A = extractFirstNConversations(recA.transcript);
        const first3B = extractFirstNConversations(recB.transcript);
        const comparison = compareConversationTurns(first3A, first3B);

        duplicateRecordIds.add(recA.id);
        duplicateRecordIds.add(recB.id);

        if (comparison.isDifferent && first3A.length > 0 && first3B.length > 0) {
          // Different first 3 conversation turns -> Same interview split into 2 recordings!
          const pair: SplitCandidatePair = {
            recordA: recA,
            recordB: recB,
            fileName: recA.fileName,
            first3A,
            first3B,
            isExactDuplicate: false,
            isSplitRecording: true,
            reason:
              'Identical file name but different conversation content. Highly likely Part 1 and Part 2 of the same interview session.',
          };
          splitRecordingPairs.push(pair);

          auditInfoByRecordId.set(recA.id, {
            isDuplicate: true,
            duplicateType: 'split_recording',
            partnerRecordId: recB.id,
            partnerFileName: recB.fileName,
            partnerUploadedAt: recB.uploadedAt,
            first3Current: first3A,
            first3Partner: first3B,
            reason: `Split Recording: Shares name with "${recB.fileName}" but has different conversation content. Combine into 1 continuous recording or rename to Part 1 & Part 2.`,
          });

          auditInfoByRecordId.set(recB.id, {
            isDuplicate: true,
            duplicateType: 'split_recording',
            partnerRecordId: recA.id,
            partnerFileName: recA.fileName,
            partnerUploadedAt: recA.uploadedAt,
            first3Current: first3B,
            first3Partner: first3A,
            reason: `Split Recording: Shares name with "${recA.fileName}" but has different conversation content. Combine into 1 continuous recording or rename to Part 1 & Part 2.`,
          });
        } else {
          // Exact duplicate (same first 3 conversations or identical file copy)
          exactDuplicateRecordIds.add(recB.id); // Mark recB as redundant copy

          const pair: SplitCandidatePair = {
            recordA: recA,
            recordB: recB,
            fileName: recA.fileName,
            first3A,
            first3B,
            isExactDuplicate: true,
            isSplitRecording: false,
            reason: 'Identical file name and identical conversation. Redundant duplicate upload.',
          };
          exactDuplicatePairs.push(pair);

          auditInfoByRecordId.set(recB.id, {
            isDuplicate: true,
            duplicateType: 'exact_duplicate',
            partnerRecordId: recA.id,
            partnerFileName: recA.fileName,
            partnerUploadedAt: recA.uploadedAt,
            first3Current: first3B,
            first3Partner: first3A,
            reason: `Exact Duplicate Recording: Identical file and conversation to "${recA.fileName}". Redundant copy.`,
          });

          if (!auditInfoByRecordId.has(recA.id)) {
            auditInfoByRecordId.set(recA.id, {
              isDuplicate: true,
              duplicateType: 'exact_duplicate',
              partnerRecordId: recB.id,
              partnerFileName: recB.fileName,
              partnerUploadedAt: recB.uploadedAt,
              first3Current: first3A,
              first3Partner: first3B,
              reason: `Has duplicate redundant copy: "${recB.fileName}".`,
            });
          }
        }
      }
    }
  });

  return {
    totalAudited: audioAndDocRecords.length,
    duplicateRecordIds,
    exactDuplicateRecordIds,
    splitRecordingPairs,
    exactDuplicatePairs,
    auditInfoByRecordId,
  };
}
