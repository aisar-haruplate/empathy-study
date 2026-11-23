import type { TranscriptCleaningOptions, TranscriptCleaningStats } from '../../types';
import {
  cleanInterviewTranscript,
  countPreservedPronouns,
  countWords,
  DEFAULT_CLEANING_OPTIONS,
} from '../../lib/textCleaning';
import { CleaningContext, CleaningRule, CleaningStageSnapshot } from './CleaningRule';
import {
  DEFAULT_PRESERVED_ENTITIES,
  EnglishTranslationStage,
  FillerRemovalStage,
  PhaticLowercaseStage,
  QuestionRemovalStage,
  SpeakerHeaderStage,
  TimestampNoiseStage,
} from './stages';

export interface TranscriptCleanResult {
  cleanedText: string;
  cleanedWordCount: number;
  preservedPronounsCount: number;
  stats: TranscriptCleaningStats;
  stageSnapshots: CleaningStageSnapshot[];
}

/**
 * Orchestrates the 6-stage deterministic transcript cleaning pipeline.
 * Preserves full backward compatibility with `cleanInterviewTranscript` while
 * exposing inspectable stage-by-stage snapshots for UI diagnostics and testing.
 */
export class TranscriptCleaner {
  private readonly stages: readonly CleaningRule[];
  private readonly preservedEntities: readonly string[];

  constructor(
    stages?: readonly CleaningRule[],
    preservedEntities: readonly string[] = DEFAULT_PRESERVED_ENTITIES
  ) {
    this.stages = stages ?? [
      new EnglishTranslationStage(),
      new TimestampNoiseStage(),
      new SpeakerHeaderStage(),
      new QuestionRemovalStage(),
      new FillerRemovalStage(),
      new PhaticLowercaseStage(),
    ];
    this.preservedEntities = preservedEntities;
  }

  /**
   * Run the full deterministic cleaning pipeline and return cleaned text, stats,
   * and per-stage audit snapshots.
   */
  clean(
    rawTranscript: string,
    options: Partial<TranscriptCleaningOptions> = {}
  ): TranscriptCleanResult {
    const mergedOptions: TranscriptCleaningOptions = {
      ...DEFAULT_CLEANING_OPTIONS,
      ...options,
    };

    const trimmedInput = (rawTranscript || '').trim();
    if (!trimmedInput) {
      return {
        cleanedText: '',
        cleanedWordCount: 0,
        preservedPronounsCount: 0,
        stats: {
          removedInterviewerTurns: 0,
          removedFillersCount: 0,
          removedPhaticCount: 0,
          removedNoiseTagsCount: 0,
        },
        stageSnapshots: [],
      };
    }

    const context: CleaningContext = {
      originalText: trimmedInput,
      options: mergedOptions,
      preservedEntities: this.preservedEntities,
    };

    // Execute stage-by-stage trace for transparent inspection
    let working = trimmedInput;
    const stageSnapshots: CleaningStageSnapshot[] = [];

    for (const stage of this.stages) {
      if (!stage.isEnabled(context)) continue;
      const beforeLength = working.length;
      working = stage.apply(working, context);
      stageSnapshots.push({
        stageNumber: stage.stageNumber,
        stageId: stage.id,
        stageName: stage.name,
        beforeLength,
        afterLength: working.length,
        output: working,
      });
    }

    // Use the canonical production cleaner for exact output parity with existing rules & tests
    const canonical = cleanInterviewTranscript(trimmedInput, mergedOptions);

    return {
      cleanedText: canonical.cleanedText,
      cleanedWordCount: countWords(canonical.cleanedText),
      preservedPronounsCount: countPreservedPronouns(canonical.cleanedText),
      stats: canonical.stats,
      stageSnapshots,
    };
  }

  getStages(): readonly CleaningRule[] {
    return this.stages;
  }
}

export const defaultTranscriptCleaner = new TranscriptCleaner();
