import type { TranscriptCleaningOptions } from '../../types';

export interface CleaningContext {
  readonly originalText: string;
  readonly options: TranscriptCleaningOptions;
  readonly preservedEntities: readonly string[];
}

export interface CleaningStageSnapshot {
  readonly stageNumber: number;
  readonly stageId: string;
  readonly stageName: string;
  readonly beforeLength: number;
  readonly afterLength: number;
  readonly output: string;
}

/**
 * Contract for a single deterministic transcript cleaning rule/stage.
 */
export abstract class CleaningRule {
  abstract readonly stageNumber: number;
  abstract readonly id: string;
  abstract readonly name: string;

  /**
   * Whether this stage should run for the given cleaning options.
   */
  isEnabled(_context: CleaningContext): boolean {
    return true;
  }

  /**
   * Pure transformation applied to the transcript string.
   */
  abstract apply(text: string, context: CleaningContext): string;
}
