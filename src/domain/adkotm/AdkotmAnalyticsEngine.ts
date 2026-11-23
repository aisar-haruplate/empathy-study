import type { ADKOTMDimensionKey, InterviewRecord } from '../../types';
import { isAnalysisEligibleRecord } from '../../lib/recordEligibility';
import {
  computeExecutiveCoverageRows,
  computeTraceableDimensionDataset,
  type ExecutiveCoverageRow,
  type TraceableDimensionDataset,
} from '../../lib/decodeAnalytics';
import { ADKOTM_DIMENSION_ORDER } from './AdkotmTaxonomy';

export interface InterviewCoverageMetric {
  readonly stated: number;
  readonly total: number;
  readonly ratioText: string;
  readonly percent: number;
}

export interface ConsolidatedAnalyticsSnapshot {
  readonly eligibleRecordCount: number;
  readonly totalSignals: number;
  readonly byDimension: Record<ADKOTMDimensionKey, TraceableDimensionDataset>;
  readonly coverageRows: ExecutiveCoverageRow[];
  readonly dimensionCoverage: Record<ADKOTMDimensionKey, InterviewCoverageMetric>;
}

/**
 * Domain analytics engine encapsulating eligible-record filtering,
 * consolidated signal totals, and per-dimension interview coverage (e.g., X/10).
 */
export class AdkotmAnalyticsEngine {
  private readonly eligibleRecords: readonly InterviewRecord[];

  constructor(records: readonly InterviewRecord[]) {
    this.eligibleRecords = records.filter(isAnalysisEligibleRecord);
  }

  getEligibleRecords(): readonly InterviewRecord[] {
    return this.eligibleRecords;
  }

  computeDimensionDataset(dimension: ADKOTMDimensionKey): TraceableDimensionDataset {
    return computeTraceableDimensionDataset([...this.eligibleRecords], dimension);
  }

  computeSnapshot(): ConsolidatedAnalyticsSnapshot {
    const recordsArray = [...this.eligibleRecords];
    const total = recordsArray.length;

    const byDimension = {} as Record<ADKOTMDimensionKey, TraceableDimensionDataset>;
    const dimensionCoverage = {} as Record<ADKOTMDimensionKey, InterviewCoverageMetric>;
    let totalSignals = 0;

    for (const dim of ADKOTM_DIMENSION_ORDER) {
      const dataset = computeTraceableDimensionDataset(recordsArray, dim);
      byDimension[dim] = dataset;
      totalSignals += dataset.totalSignals;
    }

    const coverageRows = computeExecutiveCoverageRows(byDimension, total);
    for (const dim of ADKOTM_DIMENSION_ORDER) {
      const row = coverageRows.find((r) => r.dimension === dim);
      const stated = row?.statedCount ?? 0;
      const percent = total > 0 ? Math.round((stated / total) * 100) : 0;
      dimensionCoverage[dim] = {
        stated,
        total,
        ratioText: `${stated}/${total}`,
        percent,
      };
    }

    return {
      eligibleRecordCount: total,
      totalSignals,
      byDimension,
      coverageRows,
      dimensionCoverage,
    };
  }
}
