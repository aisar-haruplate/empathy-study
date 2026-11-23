import {
  canonicalizeInterviewText,
  removeStuttersAndNormalize,
  stripQuestionSentences,
  stripSpeakerHeaders,
} from '../../lib/textCleaning';
import { CleaningContext, CleaningRule } from './CleaningRule';

export const DEFAULT_PRESERVED_ENTITIES: readonly string[] = [
  'Vitagen',
  'Yakult',
  'Danone',
  'Lotus Cheras',
  'AEON Mall',
  'Jaya Grocer',
  'Brem Mall',
  'Publika',
  'Bio Gaia',
  'Karihome',
  'Fernleaf',
  'Nutrilite',
];

/**
 * Stage 1: Canonicalize / translate non-English phrases to English while
 * preserving brands, venues, and proper names (e.g. Vitagen, Yakult, Danone, Lotus Cheras).
 */
export class EnglishTranslationStage extends CleaningRule {
  readonly stageNumber = 1;
  readonly id = 'english_translation';
  readonly name = 'English Translation & Entity Preservation';

  apply(text: string): string {
    return canonicalizeInterviewText(text);
  }
}

/**
 * Stage 2: Strip timestamps (e.g. [00:12], 00:12:34), noise/non-verbal tags
 * ([laughter], *indecipherable*), and consecutive duplicate lines.
 */
export class TimestampNoiseStage extends CleaningRule {
  readonly stageNumber = 2;
  readonly id = 'timestamp_noise';
  readonly name = 'Strip Timestamps, Noise Tags & Duplicate Lines';

  apply(text: string): string {
    const withoutTimestampsAndNoise = text
      .replace(/\[\s*\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*\]/g, ' ')
      .replace(/\(\s*\d{1,2}:\d{2}(?::\d{2})?\s*\)/g, ' ')
      .replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*[-–—]?\s*/gm, '')
      .replace(/\[(?:laughter|laughs|cough|sigh|inaudible|crosstalk|music|pause|silence|applause|background noise|笑声|咳嗽|听不清)\]/gi, ' ')
      .replace(/\*(?:indecipherable|inaudible|laughs|laughter|cough|sigh|crosstalk)\*/gi, ' ');

    const lines = withoutTimestampsAndNoise.split(/\r?\n/);
    const deduped: string[] = [];
    let prevNormalized = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const norm = trimmed.toLowerCase().replace(/\s+/g, ' ');
      if (norm === prevNormalized) continue;
      prevNormalized = norm;
      deduped.push(trimmed);
    }
    return deduped.join('\n');
  }
}

/**
 * Stage 3: Strip speaker headers (Participant:, Interviewer:, Speaker 1:)
 * and remove interviewer turns.
 */
export class SpeakerHeaderStage extends CleaningRule {
  readonly stageNumber = 3;
  readonly id = 'speaker_headers';
  readonly name = 'Strip Speaker Headers & Interviewer Turns';

  apply(text: string, context: CleaningContext): string {
    const lines = text.split(/\r?\n/);
    const kept: string[] = [];
    const interviewerRe =
      /^\s*(?:interviewer|moderator|researcher|facilitator|host|q|question)\s*(?:\d+)?\s*[:\-–—]/i;

    for (const line of lines) {
      if (context.options.removeInterviewer && interviewerRe.test(line)) {
        continue;
      }
      kept.push(stripSpeakerHeaders(line));
    }
    return kept.filter(Boolean).join('\n');
  }
}

/**
 * Stage 4: Remove standalone and inline question sentences ending with '?'.
 */
export class QuestionRemovalStage extends CleaningRule {
  readonly stageNumber = 4;
  readonly id = 'question_removal';
  readonly name = 'Remove Question Sentences';

  apply(text: string): string {
    return stripQuestionSentences(text);
  }
}

/**
 * Stage 5: Remove speech fillers (uh, um, aiyo, huh, hah, eh) and repeated stutters.
 */
export class FillerRemovalStage extends CleaningRule {
  readonly stageNumber = 5;
  readonly id = 'filler_removal';
  readonly name = 'Remove Speech Fillers & Stutters';

  isEnabled(context: CleaningContext): boolean {
    return context.options.removeFillers;
  }

  apply(text: string): string {
    const withoutFillers = text.replace(
      /\b(?:uh+|um+|erm+|hmm+|ah+|aiyo+|aiyah+|huh|hah+|ha+|eh+|lah|lor|leh|meh)\b[,\s]*/gi,
      ' '
    );
    return removeStuttersAndNormalize(withoutFillers);
  }
}

/**
 * Stage 6: Strip phatic expressions (thank you, hi miss, bye bye, leading 'so')
 * and apply strict lowercasing with normalized whitespace.
 */
export class PhaticLowercaseStage extends CleaningRule {
  readonly stageNumber = 6;
  readonly id = 'phatic_lowercase';
  readonly name = 'Strip Phatics & Strict Lowercasing';

  apply(text: string, context: CleaningContext): string {
    let result = text;
    if (context.options.removePhatic) {
      result = result
        .replace(/\b(?:thank you(?: so much| very much)?|thanks(?: a lot)?|you'?re welcome|hi miss|hello miss|excuse me|bye bye|goodbye)\b[!.,\s]*/gi, ' ')
        .replace(/(?:^|[.!?]\s+)so[,\s]+/gi, (match) => (match.startsWith('.') ? '. ' : ''));
    }

    return result
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,!?;:])/g, '$1')
      .trim()
      .toLowerCase();
  }
}
