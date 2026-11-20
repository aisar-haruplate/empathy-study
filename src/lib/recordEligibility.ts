import type { InterviewRecord } from '../types';

export const containsInterviewContent = (text?: string): boolean => {
  if (!text?.trim()) return false;

  const hasParticipantProfile = /\bparticipant\s+(?:profile|#?\d+)\b/i.test(text);
  const hasSpeakerTurn = /(?:^|\n)\s*(?:\*{1,3}\s*)?(?:interviewer|parent|guardian|participant|child|respondent|subject)\s*\*{0,3}\s*:/im.test(text);
  const hasInterviewRecord = /\binterview\s+record\b/i.test(text);

  return hasParticipantProfile || hasSpeakerTurn || hasInterviewRecord;
};

export const splitSessionMetadataFromNotes = (text: string): { metadataText: string; interviewText: string } => {
  const interviewStart = /^\s*(?=#{1,6}\s*participant\s+profile\b|(?:\*{1,3}\s*)?(?:interviewer|parent|guardian|participant|child|respondent|subject)\s*\*{0,3}\s*:|#{1,6}\s*interview\s+record\b)/im.exec(text);
  if (!interviewStart || interviewStart.index === undefined) {
    return { metadataText: text.trim(), interviewText: '' };
  }

  return {
    metadataText: text.slice(0, interviewStart.index).trim(),
    interviewText: text.slice(interviewStart.index).trim(),
  };
};

export const parseSessionMetadata = (text: string): { date: string; location: string } => {
  const date = text.match(/^\s*\*{0,3}\s*(?:interview\s+)?date\s*:\s*\*{0,3}\s*([^\n\r*]+)/im)?.[1]?.trim() || '';
  const location = text.match(/^\s*\*{0,3}\s*(?:interview\s+)?location\s*:\s*\*{0,3}\s*([^\n\r*]+)/im)?.[1]?.trim() || '';
  return { date, location };
};

export const isMetadataDocumentCandidate = (fileName: string, text?: string): boolean => {
  if (!text?.trim()) return false;

  const nameSuggestsMetadata = /meta[\s_-]*data|metadata/i.test(fileName);
  const { metadataText, interviewText } = splitSessionMetadataFromNotes(text);
  const hasDate = /(?:interview\s+)?date\s*:/i.test(metadataText);
  const hasLocation = /(?:interview\s+)?location\s*:/i.test(metadataText);
  const hasSessionHeader = /study\s+title|document\s+reference|target\s+group/i.test(metadataText);

  return nameSuggestsMetadata || (hasDate && hasLocation) || (Boolean(interviewText) && hasDate && hasSessionHeader);
};

export const isAnalysisEligibleRecord = (
  record: Pick<InterviewRecord, 'isMetaDataDoc' | 'transcript'>
): boolean => !record.isMetaDataDoc || containsInterviewContent(record.transcript);