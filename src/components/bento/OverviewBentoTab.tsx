import React from 'react';
import type { ADKOTMDimensionKey } from '../../types';
import type {
  TraceableBreakdownItem,
  TraceableDimensionDataset,
} from '../../lib/decodeAnalytics';
import { AdkotmCategoryChartsGrid } from '../charts/AdkotmCategoryCharts';

interface OverviewBentoTabProps {
  datasetsByDim: Record<ADKOTMDimensionKey, TraceableDimensionDataset>;
  totalRecords: number;
  onSelectTab: (tab: ADKOTMDimensionKey) => void;
  onTraceItem: (item: TraceableBreakdownItem) => void;
  onOpenMap?: () => void;
  activeFilterKey?: string | null;
}

/**
 * Step 3 (Theme Insights → OVERVIEW) renders the reusable 6-card ADKOTM Category Charts Grid
 * immediately below the flush top sub-tab bar. Clicking any bar or segment opens verbatim
 * traceability; clicking Explore drills directly into that category sub-tab.
 */
export const OverviewBentoTab: React.FC<OverviewBentoTabProps> = ({
  datasetsByDim,
  totalRecords,
  onSelectTab,
  onTraceItem,
  onOpenMap,
  activeFilterKey,
}) => {
  return (
    <div className="space-y-4">
      <AdkotmCategoryChartsGrid
        datasetsByDim={datasetsByDim}
        totalRecords={totalRecords}
        onSelectTab={onSelectTab}
        onSelectItem={onTraceItem}
        onOpenMap={onOpenMap}
        activeFilterKey={activeFilterKey}
      />
    </div>
  );
};
