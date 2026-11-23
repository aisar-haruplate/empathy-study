import type { ADKOTMDimensionKey } from '../../types';
import {
  nudgeSpanBoundary,
  snapCropBoundaryToWord,
} from '../../lib/adkotmCopilot';

export interface CodedSpanParams {
  start: number;
  end: number;
  dimension: ADKOTMDimensionKey;
  fieldKey: string;
  transcript: string;
}

/**
 * Immutable domain value object representing a grounded character span
 * inside an interview transcript, enforcing offset invariants and safe cropping.
 */
export class CodedSpan {
  readonly start: number;
  readonly end: number;
  readonly dimension: ADKOTMDimensionKey;
  readonly fieldKey: string;
  readonly quote: string;

  constructor(params: CodedSpanParams) {
    const maxLen = params.transcript.length;
    const clampedStart = Math.max(0, Math.min(Math.floor(params.start), maxLen));
    const clampedEnd = Math.max(clampedStart, Math.min(Math.floor(params.end), maxLen));

    if (clampedEnd <= clampedStart) {
      throw new RangeError(
        `Invalid CodedSpan range [${params.start}, ${params.end}] for transcript of length ${maxLen}.`
      );
    }

    this.start = clampedStart;
    this.end = clampedEnd;
    this.dimension = params.dimension;
    this.fieldKey = params.fieldKey;
    this.quote = params.transcript.slice(clampedStart, clampedEnd).trim();
  }

  get length(): number {
    return this.end - this.start;
  }

  /**
   * Snap both span boundaries cleanly to word boundaries.
   */
  snapToWordBoundaries(transcript: string): CodedSpan {
    const snappedStart = snapCropBoundaryToWord(
      transcript,
      this.start,
      'start',
      this.start,
      this.end
    );
    const snappedEnd = snapCropBoundaryToWord(
      transcript,
      this.end,
      'end',
      snappedStart,
      this.end
    );
    if (snappedEnd <= snappedStart) return this;
    return new CodedSpan({
      start: snappedStart,
      end: snappedEnd,
      dimension: this.dimension,
      fieldKey: this.fieldKey,
      transcript,
    });
  }

  /**
   * Nudge either the start or end boundary by a word delta (-1 or +1).
   */
  nudge(transcript: string, side: 'start' | 'end', direction: -1 | 1): CodedSpan {
    const nudged = nudgeSpanBoundary(transcript, this.start, this.end, side, direction);
    if (nudged.end <= nudged.start) return this;
    return new CodedSpan({
      start: nudged.start,
      end: nudged.end,
      dimension: this.dimension,
      fieldKey: this.fieldKey,
      transcript,
    });
  }

  overlaps(other: CodedSpan): boolean {
    return this.start < other.end && other.start < this.end;
  }
}
