import type { ADKOTMDimensionKey, InterviewRecord } from '../types';
import { AdkotmAnalyticsEngine, ADKOTM_DIMENSION_ORDER } from '../domain/adkotm';
import { stripRecordingExtension } from './adkotmCopilot';
import type { TraceableGroup } from './decodeAnalytics';

const MD3_CHART_PALETTE = [
  '#528BCA', // Cornflower Blue
  '#4FA896', // Mint Green
  '#F7D147', // Sunburst Yellow
  '#96D6C7', // Soft Mint
  '#E5B822', // Deep Sunburst
  '#7CA9DB', // Soft Cornflower
];

const DIMENSION_META: Record<
  ADKOTMDimensionKey,
  { name: string; fullTitle: string; color: string }
> = {
  A: { name: 'A · Activities', fullTitle: 'Activities [A] — Routines & Habits', color: '#4FA896' },
  D: { name: 'D · Demographics', fullTitle: 'Demographics [D] — Roles & Residence [RL]', color: '#528BCA' },
  K: { name: 'K · Knowledge', fullTitle: 'Knowledge [K] — Gut Health Awareness', color: '#E5B822' },
  O: { name: 'O · Objects', fullTitle: 'Objects [O] — Products [PP] & Brands [PP1]', color: '#96D6C7' },
  T: { name: 'T · Timing', fullTitle: 'Timing [T] — Cadence & Occasions', color: '#528BCA' },
  M: { name: 'M · Metadata', fullTitle: 'Metadata [M] — Field Venues [IL]', color: '#F7D147' },
};

const REPORT_DIM_ORDER: readonly ADKOTMDimensionKey[] = ['O', 'A', 'K', 'D', 'T', 'M'];

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSourceRecordingsText(group: TraceableGroup, itemKey: string): string {
  const item = group.items.find((i) => i.key === itemKey);
  if (!item || !item.contributors || item.contributors.length === 0) return '';
  const names = Array.from(
    new Set(item.contributors.map((c) => stripRecordingExtension(c.fileName)))
  );
  return names.join('; ');
}

function renderInlineSvgHorizontalBars(
  items: Array<{ label: string; count: number; pctLabel: string; color: string }>,
  title: string
): string {
  if (items.length === 0) {
    return `<p style="font-size:10.5pt;color:#57534E;margin:4pt 0 8pt;">No stated values for ${escapeHtml(title)}.</p>`;
  }

  const maxCount = Math.max(...items.map((i) => i.count), 1);
  const labelColWidth = 185;
  const barAreaWidth = 270;
  const valueColWidth = 85;
  const svgWidth = labelColWidth + barAreaWidth + valueColWidth;
  const rowHeight = 24;
  const svgHeight = items.length * rowHeight + 8;

  const rowsSvg = items
    .map((item, idx) => {
      const y = idx * rowHeight + 4;
      const barWidth = Math.max(6, Math.round((item.count / maxCount) * barAreaWidth));
      const cleanLabel =
        item.label.length > 28 ? `${item.label.slice(0, 27)}…` : item.label;
      return `
        <g transform="translate(0, ${y})">
          <text x="${labelColWidth - 8}" y="14" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="10" fill="#1C1B1F">${escapeHtml(cleanLabel)}</text>
          <rect x="${labelColWidth}" y="3" width="${barAreaWidth}" height="14" rx="4" fill="#E7ECE9" />
          <rect x="${labelColWidth}" y="3" width="${barWidth}" height="14" rx="4" fill="${item.color}" />
          <text x="${labelColWidth + barWidth + 6}" y="14" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="600" fill="#1C1B1F">${item.count} (${escapeHtml(item.pctLabel)})</text>
        </g>`;
    })
    .join('');

  return `
    <div style="margin:6pt 0 10pt;padding:8pt;background:#FDFCF8;border:1px solid #D5DDD8;border-radius:6pt;break-inside:avoid;page-break-inside:avoid;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" style="max-width:${svgWidth}px;height:auto;display:block;">
        ${rowsSvg}
      </svg>
    </div>`;
}

function renderInlineSvgDonut2D(
  slices: Array<{ label: string; count: number; pctLabel: string; color: string }>,
  statedCount: number
): string {
  const nonZero = slices.filter((s) => s.count > 0);
  const total = nonZero.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return '';

  const cx = 64;
  const cy = 64;
  const outerR = 56;
  const innerR = 38;
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;

  let currentDeg = 0;
  const paths =
    nonZero.length === 1
      ? `<circle cx="${cx}" cy="${cy}" r="${(outerR + innerR) / 2}" fill="none" stroke="${nonZero[0].color}" stroke-width="${outerR - innerR}" />`
      : nonZero
          .map((s) => {
            const sweep = (s.count / total) * 360;
            const start = currentDeg;
            const end = currentDeg + sweep;
            currentDeg = end;
            const largeArc = sweep > 180 ? 1 : 0;
            const x1 = cx + outerR * Math.cos(toRad(start));
            const y1 = cy + outerR * Math.sin(toRad(start));
            const x2 = cx + outerR * Math.cos(toRad(end));
            const y2 = cy + outerR * Math.sin(toRad(end));
            const x3 = cx + innerR * Math.cos(toRad(end));
            const y3 = cy + innerR * Math.sin(toRad(end));
            const x4 = cx + innerR * Math.cos(toRad(start));
            const y4 = cy + innerR * Math.sin(toRad(start));
            const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
            return `<path d="${d}" fill="${s.color}" stroke="#FDFCF8" stroke-width="2" />`;
          })
          .join('');

  const legend = slices
    .map(
      (s) => `
      <div style="display:flex;align-items:center;gap:6pt;font-size:9.5pt;margin-bottom:3pt;color:#1C1B1F;">
        <span style="display:inline-block;width:8pt;height:8pt;border-radius:999px;background:${s.color};flex-shrink:0;"></span>
        <span>${escapeHtml(s.label)}:</span>
        <strong>${s.count} (${escapeHtml(s.pctLabel)})</strong>
      </div>`
    )
    .join('');

  return `
    <div style="display:flex;align-items:center;gap:16pt;margin:6pt 0 10pt;padding:10pt 12pt;background:#FDFCF8;border:1px solid #D5DDD8;border-radius:6pt;break-inside:avoid;page-break-inside:avoid;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="112" height="112" style="flex-shrink:0;">
        ${paths}
        <text x="${cx}" y="${cy - 1}" text-anchor="middle" font-family="Roboto, Arial, sans-serif" font-size="18" font-weight="700" fill="#1C1B1F">${statedCount}</text>
        <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="Roboto, Arial, sans-serif" font-size="7.5" font-weight="700" fill="#4F5E57" letter-spacing="0.8">STATED</text>
      </svg>
      <div style="flex:1;">${legend}</div>
    </div>`;
}

function renderInlineSvgStacked100Bar(
  segments: Array<{ label: string; count: number; validPct: number; totalPct: number; isNull: boolean; color: string }>,
  coverageLabel: string
): string {
  const nonZero = segments.filter((s) => s.count > 0);
  const total = nonZero.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return '';

  const barWidth = 520;
  const barHeight = 22;
  let xOffset = 0;

  const rects = nonZero
    .map((s) => {
      const segW = Math.max(8, (s.count / total) * barWidth);
      const rect = `<rect x="${xOffset.toFixed(1)}" y="0" width="${segW.toFixed(1)}" height="${barHeight}" fill="${s.color}" />`;
      xOffset += segW;
      return rect;
    })
    .join('');

  const legend = segments
    .map(
      (s) => `
      <span style="display:inline-flex;align-items:center;gap:4pt;font-size:9.5pt;margin-right:10pt;color:#1C1B1F;">
        <span style="display:inline-block;width:8pt;height:8pt;border-radius:999px;background:${s.color};"></span>
        <span>${escapeHtml(s.label)}:</span>
        <strong>${s.count} (${s.isNull ? `${s.totalPct}% of N` : `${s.validPct}% stated · ${s.totalPct}% N`})</strong>
      </span>`
    )
    .join('');

  return `
    <div style="margin:6pt 0 10pt;padding:8pt 10pt;background:#FDFCF8;border:1px solid #D5DDD8;border-radius:6pt;break-inside:avoid;page-break-inside:avoid;">
      <div style="font-size:9pt;color:#4F5E57;margin-bottom:4pt;font-weight:600;">100% Proportional Distribution · ${escapeHtml(coverageLabel)} stated</div>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${barWidth} ${barHeight}" width="100%" style="max-width:${barWidth}px;height:auto;display:block;border-radius:4px;overflow:hidden;">
        <rect x="0" y="0" width="${barWidth}" height="${barHeight}" fill="#E2E6E4" />
        ${rects}
      </svg>
      <div style="margin-top:6pt;line-height:1.5;">${legend}</div>
    </div>`;
}

function renderProportionalStrip(
  rows: Array<{ dim: ADKOTMDimensionKey; pct: number; signals: number; color: string }>
): string {
  const segments = rows
    .filter((r) => r.pct > 0)
    .map(
      (r) =>
        `<td style="width:${Math.max(r.pct, 3)}%;background:${r.color};height:10pt;padding:0;border:none;" title="${r.dim}: ${r.pct}% (${r.signals})"></td>`
    )
    .join('');
  if (!segments) return '';
  return `<table style="width:100%;border-collapse:collapse;margin:6pt 0 10pt;table-layout:fixed;"><tr>${segments}</tr></table>`;
}

function buildAnalyticsReportData(records: InterviewRecord[]) {
  const engine = new AdkotmAnalyticsEngine(records);
  const eligible = [...engine.getEligibleRecords()];
  const snapshot = engine.computeSnapshot();

  const perRecordingCounts = eligible.map((rec) => {
    const recSnap = new AdkotmAnalyticsEngine([rec]).computeSnapshot();
    const counts = Object.fromEntries(
      ADKOTM_DIMENSION_ORDER.map((d) => [d, recSnap.byDimension[d].totalSignals])
    ) as Record<ADKOTMDimensionKey, number>;
    return {
      record: rec,
      counts,
      totalSignals: recSnap.totalSignals,
    };
  });

  const dimensionRows = ADKOTM_DIMENSION_ORDER.map((dim) => {
    const ds = snapshot.byDimension[dim];
    const cov = snapshot.dimensionCoverage[dim];
    const sharePct =
      snapshot.totalSignals > 0
        ? Math.round((ds.totalSignals / snapshot.totalSignals) * 1000) / 10
        : 0;
    return {
      dim,
      name: DIMENSION_META[dim].name,
      color: DIMENSION_META[dim].color,
      signals: ds.totalSignals,
      sharePct,
      stated: cov.stated,
      total: cov.total,
      coverageRatio: cov.ratioText,
      coveragePct: cov.percent,
    };
  });

  return {
    eligible,
    snapshot,
    perRecordingCounts,
    dimensionRows,
  };
}

export interface VerifiedExportOptions {
  dimensions?: readonly ADKOTMDimensionKey[];
}

/**
 * Pure builder for multi-section Verified Analytics & Coding CSV (data-first via AdkotmAnalyticsEngine).
 */
export function buildVerifiedAnalyticsCsv(
  records: InterviewRecord[],
  options?: VerifiedExportOptions
): string {
  const { eligible, snapshot, perRecordingCounts, dimensionRows } =
    buildAnalyticsReportData(records);
  if (eligible.length === 0) return '';
  const activeDims =
    options?.dimensions && options.dimensions.length > 0 ? options.dimensions : REPORT_DIM_ORDER;

  const lines: string[] = [];

  // Section 1: All Analytics & Summary Charts (ADKOTM Breakdown + Theme Insights + Fieldwork Venues)
  lines.push(
    [
      'Section',
      'Dimension',
      'Parameter',
      'Category',
      'Count',
      'Percentage',
      'Stated Total',
      'Active Total',
      'Source Recordings',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  for (const row of dimensionRows) {
    lines.push(
      [
        'ADKOTM Dimension Breakdown',
        row.dim,
        'Dimension Share',
        row.name,
        row.signals,
        `${row.sharePct}%`,
        row.stated,
        row.total,
        `${row.coverageRatio} interviews`,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  for (const dim of activeDims) {
    const ds = snapshot.byDimension[dim];
    for (const group of ds.groups) {
      for (const item of group.items) {
        const pctStr =
          item.key === '__null__' ? `${item.totalPct}% of total` : `${item.validPct}% of stated`;
        lines.push(
          [
            dim === 'M' ? 'Fieldwork Venue Summary' : 'Theme Insights',
            dim,
            group.title,
            item.label,
            item.count,
            pctStr,
            group.statedCount,
            group.totalRecords,
            getSourceRecordingsText(group, item.key),
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }
    }
  }

  lines.push('');

  // Section 2: Per-Recording ADKOTM Signal Counts
  lines.push(
    ['Section', 'Recording', 'Folder', 'A', 'D', 'K', 'O', 'T', 'M', 'Total Signals']
      .map(escapeCsvCell)
      .join(',')
  );
  for (const row of perRecordingCounts) {
    lines.push(
      [
        'Per-Recording ADKOTM Breakdown',
        stripRecordingExtension(row.record.fileName),
        row.record.folderName || row.record.sessionDate || '',
        row.counts.A,
        row.counts.D,
        row.counts.K,
        row.counts.O,
        row.counts.T,
        row.counts.M,
        row.totalSignals,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  lines.push('');

  // Section 3: Full Verified Interview Coding Matrix
  const codingHeaders = [
    'Record ID',
    'Session Date / Folder',
    'File Name',
    'File Type',
    'Interview Location (IL)',
    'Family Role (FR)',
    'Residential Location (RL)',
    'Gut Health Awareness (AW)',
    'Products Purchased Category (PP)',
    'Brand Preferences (PP1)',
    'Spending Power Tier',
    'Spending Power Justification',
    'A: Daily Routine',
    'A: Shopping Behaviour',
    'A: Food Consumption Behaviour',
    'A: Food Preparation',
    'A: Eating Context',
    'D: Gender',
    'D: Household Composition',
    'K: Gut Health Awareness Details',
    'O: Products Purchased',
    'O: Product Preference',
    'T: Purchase Frequency',
    'T: Consumption Frequency',
    'T: Purchase Timing',
    'T: Purchase Occasion',
    'M: Interview Time',
    'M: Interview Location',
    'Evidence Quotes',
    'Cleaned Transcript',
    'Verbatim Transcript',
  ];
  lines.push(codingHeaders.map(escapeCsvCell).join(','));

  for (const r of eligible) {
    const d = r.adkotmDecode;
    const p = d?.postAnalysisCodes;
    const sp = r.spendingPower;
    const quotesText = d?.evidenceQuotes
      ? d.evidenceQuotes.map((q) => `[${q.code}] "${q.quote}"`).join(' | ')
      : '';

    lines.push(
      [
        r.id,
        r.folderName || r.sessionDate || '',
        r.fileName,
        r.fileType,
        p?.IL || r.sessionLocation || '',
        p?.FR || d?.demographic?.familyRole || '',
        p?.RL || d?.demographic?.residentialLocation || '',
        p?.AW || d?.knowledge?.awarenessOnGutHealth || '',
        p?.PP || d?.objects?.productsPurchased || '',
        p?.PP1 || d?.objects?.brandPreferences || '',
        sp?.spendingPowerTier || '',
        sp?.justification || '',
        d?.activities?.dailyRoutine || '',
        d?.activities?.shoppingBehaviour || '',
        d?.activities?.foodConsumptionBehaviour || '',
        d?.activities?.foodPreparation || '',
        d?.activities?.eatingContext || '',
        d?.demographic?.gender || '',
        d?.demographic?.householdComposition || '',
        d?.knowledge?.awarenessOnGutHealth || '',
        d?.objects?.productsPurchased || '',
        d?.objects?.productPreference || '',
        d?.time?.purchaseFrequency || '',
        d?.time?.consumptionFrequency || '',
        d?.time?.purchaseTiming || '',
        d?.time?.purchaseOccasion || '',
        d?.metadata?.interviewTime || '',
        d?.metadata?.interviewLocation || '',
        quotesText,
        r.cleanedTranscript || '',
        r.transcript || '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return '\uFEFF' + lines.join('\r\n');
}

function buildSharedReportBodyHtml(
  records: InterviewRecord[],
  dateStr: string,
  options?: VerifiedExportOptions
): string {
  const { eligible, snapshot, perRecordingCounts, dimensionRows } =
    buildAnalyticsReportData(records);
  const activeDims =
    options?.dimensions && options.dimensions.length > 0 ? options.dimensions : REPORT_DIM_ORDER;
  const total = eligible.length;
  const decoded = eligible.filter((r) => Boolean(r.adkotmDecode)).length;

  // 1. ADKOTM Breakdown Section
  const dimChartSvg = renderInlineSvgHorizontalBars(
    dimensionRows.map((r) => ({
      label: r.name,
      count: r.signals,
      pctLabel: `${r.sharePct}%`,
      color: r.color,
    })),
    'ADKOTM Dimension Breakdown'
  );

  const dimTableRows = dimensionRows
    .map(
      (r) => `
      <tr>
        <td><span style="display:inline-block;width:8pt;height:8pt;border-radius:999px;background:${r.color};margin-right:5pt;"></span><strong>${escapeHtml(r.name)}</strong></td>
        <td style="text-align:center;"><strong>${r.signals}</strong></td>
        <td style="text-align:center;">${r.sharePct}%</td>
        <td style="text-align:center;">${escapeHtml(r.coverageRatio)} (${r.coveragePct}%)</td>
      </tr>`
    )
    .join('');

  const perRecordingRows = perRecordingCounts
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(stripRecordingExtension(row.record.fileName))}</td>
        <td style="text-align:center;">${row.counts.A}</td>
        <td style="text-align:center;">${row.counts.D}</td>
        <td style="text-align:center;">${row.counts.K}</td>
        <td style="text-align:center;">${row.counts.O}</td>
        <td style="text-align:center;">${row.counts.T}</td>
        <td style="text-align:center;">${row.counts.M}</td>
        <td style="text-align:center;"><strong>${row.totalSignals}</strong></td>
      </tr>`
    )
    .join('');

  // 2. Theme Insights — Selected Dimensions & Parameter Groups
  const themeSectionsHtml = activeDims.map((dim) => {
    const ds = snapshot.byDimension[dim];
    const groupsHtml = ds.groups
      .map((group) => {
        const statedItems = group.items.filter((i) => i.key !== '__null__');

        let visualHtml = '';
        if (dim === 'D') {
          const sourceItems = group.items;
          const topSix = sourceItems.slice(0, 6);
          const overflow = sourceItems.slice(6);
          const donutColors = ['#528BCA', '#6E8FDB', '#F7D147', '#4FA896', '#D97A75'];
          const slices = topSix.map((item, idx) => ({
            label: item.label,
            count: item.count,
            pctLabel: item.key === '__null__' ? `${item.totalPct}% of N` : `${item.validPct}% stated`,
            color: item.key === '__null__' ? '#E2E6E4' : donutColors[idx % donutColors.length],
          }));
          if (overflow.length > 0) {
            const otherCount = overflow.reduce((s, i) => s + i.count, 0);
            const totalSum = sourceItems.reduce((s, i) => s + i.count, 0);
            const otherPct = totalSum > 0 ? Math.round((otherCount / totalSum) * 100) : 0;
            slices.push({
              label: `Other (${overflow.length})`,
              count: otherCount,
              pctLabel: `${otherPct}%`,
              color: '#C9D2CE',
            });
          }
          visualHtml = renderInlineSvgDonut2D(slices, group.statedCount);
        } else if (dim === 'O') {
          const isBrandGroup = group.id === 'o_brands_pp1' || group.fieldKey === 'brandPreferences';
          visualHtml = renderInlineSvgHorizontalBars(
            statedItems.slice(0, 12).map((item, idx) => ({
              label: item.label,
              count: item.count,
              pctLabel: `${item.validPct}% stated`,
              color: isBrandGroup
                ? idx === 0
                  ? '#E5B822'
                  : '#F7D147'
                : idx === 0
                ? '#4FA896'
                : '#96D6C7',
            })),
            group.title
          );
        } else if (group.chartKind === 'stacked_100' || dim === 'K' || dim === 'T') {
          const stackedSegments = group.items.map((item, idx) => {
            const isNull = item.key === '__null__';
            const color = isNull
              ? '#E2E6E4'
              : item.label === 'Aware'
              ? '#4FA896'
              : item.label === 'Not Aware'
              ? '#F7D147'
              : MD3_CHART_PALETTE[idx % MD3_CHART_PALETTE.length];
            return {
              label: item.label,
              count: item.count,
              validPct: item.validPct,
              totalPct: item.totalPct,
              isNull,
              color,
            };
          });
          visualHtml = renderInlineSvgStacked100Bar(
            stackedSegments,
            `${group.statedCount}/${group.totalRecords} (${group.validCoveragePct}%)`
          );
        } else {
          visualHtml = renderInlineSvgHorizontalBars(
            statedItems.slice(0, 12).map((item, idx) => ({
              label: item.label,
              count: item.count,
              pctLabel: `${item.validPct}%`,
              color: MD3_CHART_PALETTE[idx % MD3_CHART_PALETTE.length],
            })),
            group.title
          );
        }

        const tableRows = group.items
          .map(
            (item) => `
            <tr>
              <td>${escapeHtml(item.label)}</td>
              <td style="text-align:center;"><strong>${item.count}</strong></td>
              <td style="text-align:center;">${item.key === '__null__' ? `${item.totalPct}% of N` : `${item.validPct}%`}</td>
              <td>${escapeHtml(getSourceRecordingsText(group, item.key) || '—')}</td>
            </tr>`
          )
          .join('');

        return `
          <div class="report-block">
            <h3>${escapeHtml(group.title)}</h3>
            <p class="meta-line">
              Stated: <strong>${group.statedCount}</strong> · Unstated (null): ${group.unstatedCount} · Active Total: <strong>${group.totalRecords}</strong> (${group.validCoveragePct}% coverage)
            </p>
            ${visualHtml}
            <table>
              <thead>
                <tr>
                  <th style="width:36%;">Category</th>
                  <th style="width:12%;text-align:center;">Count</th>
                  <th style="width:16%;text-align:center;">% of Stated</th>
                  <th style="width:36%;">Source Recordings</th>
                </tr>
              </thead>
              <tbody>${tableRows || '<tr><td colspan="4" style="color:#57534E;">No coded values.</td></tr>'}</tbody>
            </table>
          </div>`;
      })
      .join('');

    return `
      <div class="dimension-section">
        <h2>${escapeHtml(DIMENSION_META[dim].fullTitle)}</h2>
        ${groupsHtml}
      </div>`;
  }).join('');

  // 3. Consolidated Summary Table (Cross-Interview Coding Matrix)
  const summaryMatrixRows = eligible
    .map((r, idx) => {
      const p = r.adkotmDecode?.postAnalysisCodes;
      const sp = r.spendingPower;
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><strong>${escapeHtml(stripRecordingExtension(r.fileName))}</strong></td>
          <td>${escapeHtml(p?.FR || 'null')}</td>
          <td>${escapeHtml(p?.RL || 'null')}</td>
          <td>${escapeHtml(p?.AW || 'null')}</td>
          <td>${escapeHtml(p?.PP || 'null')}</td>
          <td>${escapeHtml(p?.PP1 || 'null')}</td>
          <td>${escapeHtml(p?.IL || r.sessionLocation || 'null')}</td>
          <td>${escapeHtml(sp?.spendingPowerTier || 'null')}</td>
        </tr>`;
    })
    .join('');

  // 4. Respondent Dossiers with Evidence Quotes
  const dossiersHtml = eligible
    .map((r, idx) => {
      const d = r.adkotmDecode;
      const p = d?.postAnalysisCodes;
      const quotes = d?.evidenceQuotes || [];
      return `
        <div class="report-block dossier-card">
          <h3>#${idx + 1}: ${escapeHtml(stripRecordingExtension(r.fileName))}</h3>
          <p class="meta-line">
            Folder: <strong>${escapeHtml(r.folderName || 'Root')}</strong> · Venue [IL]: <strong>${escapeHtml(p?.IL || r.sessionLocation || 'null')}</strong>
          </p>
          ${
            quotes.length > 0
              ? `<ul style="margin:4pt 0 0 14pt;padding:0;font-size:10.5pt;color:#444846;">
                  ${quotes
                    .map(
                      (q) =>
                        `<li style="margin-bottom:2pt;"><strong>[${escapeHtml(q.code)}]</strong> &ldquo;${escapeHtml(q.quote)}&rdquo;</li>`
                    )
                    .join('')}
                </ul>`
              : '<p class="meta-line">No verbatim quotes attached.</p>'
          }
        </div>`;
    })
    .join('');

  return `
    <div class="report-header">
      <h1>Empathy Study Hub — Verified Analytics &amp; ADKOTM Report</h1>
      <p class="meta-line">
        Generated: ${escapeHtml(dateStr)} · Verified Interviews: <strong>${total}</strong> · Decoded: <strong>${decoded}</strong> · Total Signals: <strong>${snapshot.totalSignals}</strong>
      </p>
    </div>

    <div class="report-block">
      <h2>1. ADKOTM Dimension Breakdown (A · D · K · O · T · M)</h2>
      ${renderProportionalStrip(
        dimensionRows.map((r) => ({
          dim: r.dim,
          pct: r.sharePct,
          signals: r.signals,
          color: r.color,
        }))
      )}
      ${dimChartSvg}
      <table>
        <thead>
          <tr>
            <th>Dimension</th>
            <th style="text-align:center;">Signals</th>
            <th style="text-align:center;">Share %</th>
            <th style="text-align:center;">Interview Coverage</th>
          </tr>
        </thead>
        <tbody>${dimTableRows}</tbody>
      </table>
    </div>

    <div class="report-block">
      <h3>Per-Recording ADKOTM Signal Distribution</h3>
      <table>
        <thead>
          <tr>
            <th>Recording</th>
            <th style="text-align:center;">A</th>
            <th style="text-align:center;">D</th>
            <th style="text-align:center;">K</th>
            <th style="text-align:center;">O</th>
            <th style="text-align:center;">T</th>
            <th style="text-align:center;">M</th>
            <th style="text-align:center;">Total</th>
          </tr>
        </thead>
        <tbody>${perRecordingRows}</tbody>
      </table>
    </div>

    <h2>2. Theme Insights &amp; Fieldwork Venue Breakdowns (All 6 Dimensions)</h2>
    ${themeSectionsHtml}

    <div class="report-block">
      <h2>3. Consolidated Summary Table (Cross-Interview Coding Matrix)</h2>
      <table>
        <thead>
          <tr>
            <th style="text-align:center;">#</th>
            <th>Recording</th>
            <th>FR</th>
            <th>RL</th>
            <th>AW</th>
            <th>PP</th>
            <th>PP1</th>
            <th>IL (Venue)</th>
            <th>Spending</th>
          </tr>
        </thead>
        <tbody>${summaryMatrixRows}</tbody>
      </table>
    </div>

    <h2>4. Verified Respondent Evidence Dossiers</h2>
    ${dossiersHtml}
  `;
}

const SHARED_DOCUMENT_CSS = `
  @page { margin: 0.75in; }
  body {
    font-family: 'Inter', Calibri, 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1C1B1F;
    background-color: #FFFFFF;
    margin: 18pt auto;
    max-width: 820px;
  }
  h1 {
    font-family: 'Roboto', 'Inter', Arial, sans-serif;
    font-size: 13.75pt;
    line-height: 1.3;
    color: #1C1B1F;
    margin: 0 0 4pt 0;
    break-after: avoid;
    page-break-after: avoid;
  }
  h2 {
    font-family: 'Roboto', 'Inter', Arial, sans-serif;
    font-size: 13pt;
    line-height: 1.3;
    color: #1C1B1F;
    border-bottom: 1px solid #D5DDD8;
    padding-bottom: 3pt;
    margin: 14pt 0 6pt 0;
    break-after: avoid;
    page-break-after: avoid;
  }
  h3 {
    font-family: 'Roboto', 'Inter', Arial, sans-serif;
    font-size: 12.25pt;
    line-height: 1.35;
    color: #132B47;
    margin: 10pt 0 4pt 0;
    break-after: avoid;
    page-break-after: avoid;
  }
  p {
    font-size: 11pt;
    line-height: 1.5;
    margin: 0 0 6pt 0;
    orphans: 3;
    widows: 3;
  }
  .meta-line {
    font-size: 10pt;
    color: #444846;
    margin: 0 0 6pt 0;
  }
  .report-block {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 12pt;
  }
  .dossier-card {
    padding: 10pt;
    border: 1px solid #D5DDD8;
    background-color: #FDFCF8;
    border-radius: 6pt;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 4pt 0 10pt 0;
    font-size: 10.5pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  th {
    background-color: #F2F5F3;
    color: #1C1B1F;
    font-weight: 600;
    text-align: left;
    padding: 5pt 7pt;
    border: 1px solid #D5DDD8;
  }
  td {
    padding: 5pt 7pt;
    border: 1px solid #D5DDD8;
    vertical-align: top;
  }
  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
`;

/**
 * Pure builder for Microsoft Word (.doc) HTML export containing all data-first charts & tables.
 */
export function buildVerifiedAnalyticsDocHtml(
  records: InterviewRecord[],
  options?: VerifiedExportOptions
): string {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const body = buildSharedReportBodyHtml(records, dateStr, options);
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>Empathy Study Hub — Verified Analytics &amp; ADKOTM Report</title>
  <style>${SHARED_DOCUMENT_CSS}</style>
</head>
<body>
  ${body}
</body>
</html>`;
}

/**
 * Pure builder for printable PDF HTML report containing all data-first charts & tables.
 */
export function buildVerifiedAnalyticsPdfHtml(
  records: InterviewRecord[],
  options?: VerifiedExportOptions
): string {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const body = buildSharedReportBodyHtml(records, dateStr, options);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Empathy Study Hub — Printable Analytics &amp; ADKOTM Report (${escapeHtml(dateStr)})</title>
  <style>
    ${SHARED_DOCUMENT_CSS}
    .print-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #D5DDD8;
      padding-bottom: 10pt;
      margin-bottom: 14pt;
    }
    .print-btn {
      background-color: #528BCA;
      color: #FFFFFF;
      padding: 7pt 16pt;
      font-size: 10.5pt;
      font-weight: 600;
      border-radius: 999px;
      border: none;
      cursor: pointer;
    }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar no-print">
    <div>
      <strong style="font-size:12pt;color:#1C1B1F;">Empathy Study Hub — Verified Analytics Dossier</strong>
      <div class="meta-line" style="margin:2pt 0 0;">All ADKOTM Breakdown, Theme Insights, Summary Table &amp; Venue charts included</div>
    </div>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  ${body}
</body>
</html>`;
}

/**
 * Export full verified analytics charts + coding dataset to CSV with UTF-8 BOM.
 */
export function exportDecodesToCSV(
  records: InterviewRecord[],
  options?: VerifiedExportOptions
) {
  const csvContent = buildVerifiedAnalyticsCsv(records, options);
  if (!csvContent) {
    alert('No records available to export.');
    return;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `empathy_study_verified_analytics_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export full verified analytics charts + breakdown tables into a Microsoft Word (.doc) file.
 */
export function exportDecodesToDoc(
  records: InterviewRecord[],
  options?: VerifiedExportOptions
) {
  const eligible = new AdkotmAnalyticsEngine(records).getEligibleRecords();
  if (eligible.length === 0) {
    alert('No records available to export.');
    return;
  }

  const docHtml = buildVerifiedAnalyticsDocHtml([...eligible], options);
  const blob = new Blob(['\uFEFF', docHtml], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `empathy_study_verified_analytics_${new Date().toISOString().split('T')[0]}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Open a self-contained printable PDF report window containing all verified charts & tables.
 */
export function openPrintablePDFReport(
  records: InterviewRecord[],
  options?: VerifiedExportOptions
) {
  const eligible = new AdkotmAnalyticsEngine(records).getEligibleRecords();
  if (eligible.length === 0) {
    alert('No records available to export.');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup blocked! Please allow popups to view the printable PDF report.');
    return;
  }

  const html = buildVerifiedAnalyticsPdfHtml([...eligible], options);
  printWindow.document.write(html);
  printWindow.document.close();
}
