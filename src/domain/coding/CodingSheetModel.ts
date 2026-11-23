import type {
  ADKOTMDecode,
  ADKOTMDimensionKey,
  ADKOTMFieldItem,
  ADKOTMFieldStatus,
} from '../../types';
import {
  ADKOTM_PARAMETER_CATALOG,
  buildUpdatedFieldItemFromEdit,
  ensureFieldStates,
  resolveFieldSpanOffsets,
  syncFlatDecodeFromFieldStates,
} from '../../lib/adkotmCopilot';
import { CodedSpan } from './CodedSpan';

export interface CodingFieldSummary {
  totalFields: number;
  acceptedCount: number;
  stagedCount: number;
  manualCount: number;
  rejectedCount: number;
  emptyCount: number;
}

/**
 * Domain aggregate encapsulating a transcript's ADKOTM coding sheet:
 * field states, span cropping/editing validation, accept/reject transitions,
 * and synchronization back to flat `ADKOTMDecode` fields.
 */
export class CodingSheetModel {
  private decode: ADKOTMDecode;
  private fieldStates: Record<string, ADKOTMFieldItem>;
  private readonly transcript: string;

  constructor(decode: ADKOTMDecode, transcript: string) {
    this.transcript = transcript || '';
    this.fieldStates = ensureFieldStates(decode);
    this.decode = syncFlatDecodeFromFieldStates(this.fieldStates, decode);
  }

  getField(fieldKey: string): ADKOTMFieldItem | undefined {
    return this.fieldStates[fieldKey];
  }

  getAllFields(): Record<string, ADKOTMFieldItem> {
    return { ...this.fieldStates };
  }

  resolveSpan(fieldKey: string): CodedSpan | null {
    if (!this.transcript) return null;

    const offsets = resolveFieldSpanOffsets(this.transcript, this.fieldStates, fieldKey);
    if (!offsets || offsets.end <= offsets.start) return null;

    const paramMeta = ADKOTM_PARAMETER_CATALOG.find((p) => p.key === fieldKey);
    const dimension: ADKOTMDimensionKey = paramMeta?.dimension || 'O';

    return new CodedSpan({
      start: offsets.start,
      end: offsets.end,
      dimension,
      fieldKey,
      transcript: this.transcript,
    });
  }

  acceptField(fieldKey: string): this {
    return this.setFieldStatus(fieldKey, 'ACCEPTED');
  }

  rejectField(fieldKey: string): this {
    return this.setFieldStatus(fieldKey, 'REJECTED');
  }

  editField(
    fieldKey: string,
    updates: {
      code: string | null;
      evidence_quote?: string | null;
      reasoning?: string | null;
      status?: ADKOTMFieldStatus;
    }
  ): this {
    const existing = this.fieldStates[fieldKey];
    const nextItem = buildUpdatedFieldItemFromEdit(existing, {
      code: updates.code ?? '',
      evidence_quote: updates.evidence_quote ?? existing?.evidence_quote ?? null,
      reasoning: updates.reasoning ?? existing?.reasoning ?? null,
    });

    if (updates.status) {
      nextItem.status = updates.status;
    }

    this.fieldStates = {
      ...this.fieldStates,
      [fieldKey]: nextItem,
    };
    this.decode = syncFlatDecodeFromFieldStates(this.fieldStates, this.decode);
    return this;
  }

  cropFieldSpan(fieldKey: string, span: CodedSpan): this {
    const existing = this.fieldStates[fieldKey];
    if (!existing) return this;

    return this.editField(fieldKey, {
      code: existing.code,
      evidence_quote: span.quote,
    });
  }

  getSummary(): CodingFieldSummary {
    const values = Object.values(this.fieldStates);
    let acceptedCount = 0;
    let stagedCount = 0;
    let manualCount = 0;
    let rejectedCount = 0;
    let emptyCount = 0;

    for (const item of values) {
      if (!item || !item.code) {
        emptyCount++;
        continue;
      }
      if (item.status === 'ACCEPTED') acceptedCount++;
      else if (item.status === 'STAGED') stagedCount++;
      else if (item.status === 'MANUAL') manualCount++;
      else if (item.status === 'REJECTED') rejectedCount++;
    }

    return {
      totalFields: values.length,
      acceptedCount,
      stagedCount,
      manualCount,
      rejectedCount,
      emptyCount,
    };
  }

  toDecode(): ADKOTMDecode {
    return this.decode;
  }

  private setFieldStatus(fieldKey: string, status: ADKOTMFieldStatus): this {
    const existing = this.fieldStates[fieldKey];
    if (!existing) return this;

    this.fieldStates = {
      ...this.fieldStates,
      [fieldKey]: {
        ...existing,
        status,
      },
    };
    this.decode = syncFlatDecodeFromFieldStates(this.fieldStates, this.decode);
    return this;
  }
}
