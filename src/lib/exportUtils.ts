import { InterviewRecord } from '../types';
import { isAnalysisEligibleRecord } from './recordEligibility';

/**
 * Escapes text for RFC 4180 CSV standard
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export full qualitative dataset to CSV with UTF-8 BOM for Microsoft Excel / Sheets compatibility
 */
export function exportDecodesToCSV(records: InterviewRecord[]) {
  const eligible = records.filter(isAnalysisEligibleRecord);
  if (eligible.length === 0) {
    alert('No records available to export.');
    return;
  }

  const headers = [
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

  const rows = eligible.map((r) => {
    const d = r.adkotmDecode;
    const p = d?.postAnalysisCodes;
    const sp = r.spendingPower;

    const quotesText = d?.evidenceQuotes
      ? d.evidenceQuotes.map((q) => `[${q.code}] "${q.quote}"`).join(' | ')
      : '';

    return [
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
    ].map(escapeCsvCell).join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `empathy_study_qualitative_decodes_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export qualitative findings into a Microsoft Word compatible (.doc) formatted document
 */
export function exportDecodesToDoc(records: InterviewRecord[]) {
  const eligible = records.filter(isAnalysisEligibleRecord);
  if (eligible.length === 0) {
    alert('No records available to export.');
    return;
  }

  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Calculate high level counts
  const total = eligible.length;
  const decoded = eligible.filter((r) => r.adkotmDecode).length;

  const countBy = (fn: (r: InterviewRecord) => string | null | undefined) => {
    const map = new Map<string, number>();
    eligible.forEach((r) => {
      const val = fn(r);
      const key = val && val.trim() ? val.trim() : 'null (unstated)';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  };

  const frDist = countBy((r) => r.adkotmDecode?.postAnalysisCodes?.FR);
  const rlDist = countBy((r) => r.adkotmDecode?.postAnalysisCodes?.RL);
  const awDist = countBy((r) => r.adkotmDecode?.postAnalysisCodes?.AW);
  const ppDist = countBy((r) => r.adkotmDecode?.postAnalysisCodes?.PP);
  const pp1Dist = countBy((r) => r.adkotmDecode?.postAnalysisCodes?.PP1);
  const spDist = countBy((r) => r.spendingPower?.spendingPowerTier);

  const renderTableRows = (dist: [string, number][]) => {
    return dist
      .map(
        ([name, count]) => `
      <tr>
        <td style="padding: 6px 10px; border: 1px solid #d1d5db; font-size: 11pt;">${name}</td>
        <td style="padding: 6px 10px; border: 1px solid #d1d5db; text-align: center; font-size: 11pt; font-weight: bold;">${count}</td>
        <td style="padding: 6px 10px; border: 1px solid #d1d5db; text-align: center; font-size: 11pt;">${Math.round((count / total) * 100)}%</td>
      </tr>
    `
      )
      .join('');
  };

  const respondentSections = eligible
    .map((r, idx) => {
      const d = r.adkotmDecode;
      const p = d?.postAnalysisCodes;
      const sp = r.spendingPower;

      return `
      <div style="page-break-inside: avoid; margin-top: 24px; padding: 16px; border: 1px solid #e5e7eb; background-color: #fafafa; border-radius: 6px;">
        <h3 style="margin: 0 0 6px 0; font-size: 13pt; color: #1e3a8a;">
          #${idx + 1}: ${r.fileName}
        </h3>
        <p style="margin: 0 0 12px 0; font-size: 10pt; color: #4b5563;">
          Session Folder: <b>${r.folderName || 'Root'}</b> | Location: <b>${p?.IL || r.sessionLocation || 'null'}</b>
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; background-color: #ffffff;">
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 6px; border: 1px solid #d1d5db; font-size: 10pt; text-align: left;">Code</th>
            <th style="padding: 6px; border: 1px solid #d1d5db; font-size: 10pt; text-align: left;">Dimension</th>
            <th style="padding: 6px; border: 1px solid #d1d5db; font-size: 10pt; text-align: left;">Empirical Extracted Value</th>
          </tr>
          <tr>
            <td style="padding: 6px; border: 1px solid #d1d5db; font-weight: bold;">FR</td>
            <td style="padding: 6px; border: 1px solid #d1d5db;">Family Role (D)</td>
            <td style="padding: 6px; border: 1px solid #d1d5db;">${p?.FR || 'null'}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border: 1px solid #d1d5db; font-weight: bold;">RL</td>
            <td style="padding: 6px; border: 1px solid #d1d5db;">Residential Location (D)</td>
            <td style="padding: 6px; border: 1px solid #d1d5db;">${p?.RL || 'null'}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border: 1px solid #d1d5db; font-weight: bold;">AW</td>
            <td style="padding: 6px; border: 1px solid #d1d5db;">Gut Health Awareness (K)</td>
            <td style="padding: 6px; border: 1px solid #d1d5db;">${p?.AW || 'null'}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border: 1px solid #d1d5db; font-weight: bold;">PP</td>
            <td style="padding: 6px; border: 1px solid #d1d5db;">Products Purchased Category (O)</td>
            <td style="padding: 6px; border: 1px solid #d1d5db;">${p?.PP || 'null'}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border: 1px solid #d1d5db; font-weight: bold;">PP1</td>
            <td style="padding: 6px; border: 1px solid #d1d5db;">Brand Preferences (O)</td>
            <td style="padding: 6px; border: 1px solid #d1d5db;">${p?.PP1 || 'null'}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border: 1px solid #d1d5db; font-weight: bold;">IL</td>
            <td style="padding: 6px; border: 1px solid #d1d5db;">Interview Location (M)</td>
            <td style="padding: 6px; border: 1px solid #d1d5db;">${p?.IL || 'null'}</td>
          </tr>
          <tr style="background-color: #fef3c7;">
            <td style="padding: 6px; border: 1px solid #d1d5db; font-weight: bold;">Spending</td>
            <td style="padding: 6px; border: 1px solid #d1d5db; font-weight: bold;">Spending Power Tier (D+O+T+M)</td>
            <td style="padding: 6px; border: 1px solid #d1d5db; font-weight: bold; color: #92400e;">
              ${sp?.spendingPowerTier || 'null'} ${sp?.justification ? `— ${sp.justification}` : ''}
            </td>
          </tr>
        </table>

        ${
          d?.evidenceQuotes && d.evidenceQuotes.length > 0
            ? `
          <div style="margin-top: 8px;">
            <b style="font-size: 10pt; color: #374151;">Evidence Quotes from Verbatim:</b>
            <ul style="margin: 4px 0 0 16px; padding: 0; font-size: 9.5pt; color: #4b5563;">
              ${d.evidenceQuotes.map((q) => `<li><b>[${q.code}]</b> "${q.quote}"</li>`).join('')}
            </ul>
          </div>
        `
            : ''
        }
      </div>
    `;
    })
    .join('');

  const docHtml = `
    <!DOCTYPE html>
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Empathy Study Hub - Qualitative Decode & Analysis Report</title>
      <style>
        body {
          font-family: Calibri, 'Segoe UI', Arial, sans-serif;
          color: #111827;
          line-height: 1.5;
          margin: 24px;
        }
        h1 { color: #1e3a8a; font-size: 20pt; margin-bottom: 4px; }
        h2 { color: #1f2937; font-size: 15pt; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; margin-top: 24px; }
        table { border-collapse: collapse; width: 100%; margin-top: 8px; margin-bottom: 16px; }
        th { background-color: #f3f4f6; padding: 8px 10px; border: 1px solid #d1d5db; font-size: 11pt; text-align: left; }
      </style>
    </head>
    <body>
      <h1>Empathy Study Hub: Qualitative Decode & Cross-Analysis Report</h1>
      <p style="color: #6b7280; font-size: 11pt; margin-top: 0;">
        Generated: ${dateStr} | Total Records: <b>${total}</b> | Decoded: <b>${decoded}</b>
      </p>

      <h2>1. Executive Summary & Methodology</h2>
      <p style="font-size: 11pt;">
        This qualitative study evaluates interview recordings across the 6-dimension <b>ADKOTM framework</b>:
        <b>A (Activities)</b>, <b>D (Demographic)</b>, <b>K (Knowledge)</b>, <b>O (Objects)</b>, <b>T (Time)</b>, and <b>M (Metadata)</b>.
        Cross-analysis applies the formula <b>Spending Power = D + O + T + M (RL + PP + IL)</b>.
        Values strictly adhere to empirical verbatim utterances; unmentioned variables remain strictly <code>null</code>.
      </p>

      <h2>2. Distribution Summaries (Frequency & Proportions)</h2>
      
      <div style="display: table; width: 100%;">
        <div style="display: table-row;">
          <div style="display: table-cell; width: 48%; vertical-align: top; padding-right: 16px;">
            <h3 style="font-size: 12pt; color: #374151;">Family Role (FR) - Code D</h3>
            <table>
              <tr><th>Role</th><th>Count</th><th>%</th></tr>
              ${renderTableRows(frDist)}
            </table>

            <h3 style="font-size: 12pt; color: #374151;">Gut Health Awareness (AW) - Code K</h3>
            <table>
              <tr><th>Awareness Signal</th><th>Count</th><th>%</th></tr>
              ${renderTableRows(awDist)}
            </table>

            <h3 style="font-size: 12pt; color: #374151;">Spending Power Tiers</h3>
            <table>
              <tr><th>Tier</th><th>Count</th><th>%</th></tr>
              ${renderTableRows(spDist)}
            </table>
          </div>

          <div style="display: table-cell; width: 48%; vertical-align: top;">
            <h3 style="font-size: 12pt; color: #374151;">Residential Location (RL) - Code D</h3>
            <table>
              <tr><th>Location</th><th>Count</th><th>%</th></tr>
              ${renderTableRows(rlDist)}
            </table>

            <h3 style="font-size: 12pt; color: #374151;">Products Purchased (PP) - Code O</h3>
            <table>
              <tr><th>Category</th><th>Count</th><th>%</th></tr>
              ${renderTableRows(ppDist)}
            </table>

            <h3 style="font-size: 12pt; color: #374151;">Brand Preferences (PP1) - Code O</h3>
            <table>
              <tr><th>Brand</th><th>Count</th><th>%</th></tr>
              ${renderTableRows(pp1Dist)}
            </table>
          </div>
        </div>
      </div>

      <h2>3. Individual Qualitative Decode Dossiers</h2>
      ${respondentSections}

      <div style="margin-top: 36px; padding-top: 12px; border-top: 1px solid #d1d5db; font-size: 9pt; color: #9ca3af; text-align: center;">
        Empathy Study Hub • Automated & Self-Entry Qualitative Research Engine
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + docHtml], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `empathy_study_qualitative_report_${new Date().toISOString().split('T')[0]}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Open high-resolution printable report window for native PDF export (Print to PDF)
 */
export function openPrintablePDFReport(records: InterviewRecord[]) {
  const eligible = records.filter(isAnalysisEligibleRecord);
  if (eligible.length === 0) {
    alert('No records available to export.');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up was blocked. Please allow pop-ups to open the PDF report view.');
    return;
  }

  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const total = eligible.length;
  const decoded = eligible.filter((r) => r.adkotmDecode).length;

  const countBy = (fn: (r: InterviewRecord) => string | null | undefined) => {
    const map = new Map<string, number>();
    eligible.forEach((r) => {
      const val = fn(r);
      const key = val && val.trim() ? val.trim() : 'null (unstated)';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  };

  const frDist = countBy((r) => r.adkotmDecode?.postAnalysisCodes?.FR);
  const rlDist = countBy((r) => r.adkotmDecode?.postAnalysisCodes?.RL);
  const awDist = countBy((r) => r.adkotmDecode?.postAnalysisCodes?.AW);
  const ppDist = countBy((r) => r.adkotmDecode?.postAnalysisCodes?.PP);
  const pp1Dist = countBy((r) => r.adkotmDecode?.postAnalysisCodes?.PP1);
  const spDist = countBy((r) => r.spendingPower?.spendingPowerTier);

  const renderSvgDonut = (items: [string, number][], title: string): string => {
    const cx = 70;
    const cy = 70;
    const r = 45;
    const strokeWidth = 20;
    const circumference = 2 * Math.PI * r;
    const colors = ['#f59e0b', '#10b981', '#6366f1', '#0ea5e9', '#ec4899', '#8b5cf6', '#14b8a6'];

    let accumulatedPct = 0;
    const slices = items.slice(0, 7).map(([label, count], i) => {
      const isUnstated = label.toLowerCase().includes('null') || label.toLowerCase().includes('unstated');
      const color = isUnstated ? '#94a3b8' : colors[i % colors.length];
      const pct = total > 0 ? count / total : 0;
      const dash = `${pct * circumference} ${circumference}`;
      const offset = -accumulatedPct * circumference;
      accumulatedPct += pct;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${dash}" stroke-dashoffset="${offset}" />`;
    }).join('');

    const legend = items.slice(0, 5).map(([label, count], i) => {
      const isUnstated = label.toLowerCase().includes('null') || label.toLowerCase().includes('unstated');
      const color = isUnstated ? '#94a3b8' : colors[i % colors.length];
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return `
        <div style="display:flex;align-items:center;gap:6px;font-size:8.5pt;margin-bottom:3px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};"></span>
          <span style="color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px;">${label}</span>
          <span style="font-weight:600;margin-left:auto;color:#111827;font-size:8pt;">${count} (${pct}%)</span>
        </div>
      `;
    }).join('');

    return `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:12px;">
        <div style="font-size:9.5pt;font-weight:bold;color:#111827;margin-bottom:6px;">${title}</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <svg width="140" height="140" viewBox="0 0 140 140" style="transform:rotate(-90deg);flex-shrink:0;">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f3f4f6" stroke-width="${strokeWidth}" />
            ${slices}
          </svg>
          <div style="flex:1;min-width:0;">
            ${legend}
          </div>
        </div>
      </div>
    `;
  };

  const renderSvgHorizontalBars = (items: [string, number][], title: string): string => {
    const max = Math.max(...items.map(([_, c]) => c), 1);
    const colors = ['#f59e0b', '#10b981', '#6366f1', '#0ea5e9', '#ec4899', '#8b5cf6'];

    const bars = items.slice(0, 5).map(([label, count], i) => {
      const isUnstated = label.toLowerCase().includes('null') || label.toLowerCase().includes('unstated');
      const color = isUnstated ? '#94a3b8' : colors[i % colors.length];
      const widthPct = Math.round((count / max) * 100);
      const totalPct = total > 0 ? Math.round((count / total) * 100) : 0;
      return `
        <div style="margin-bottom:5px;">
          <div style="display:flex;justify-content:space-between;font-size:8pt;margin-bottom:2px;color:#374151;">
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;">${label}</span>
            <span style="font-weight:bold;color:#111827;">${count} (${totalPct}%)</span>
          </div>
          <div style="height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${widthPct}%;background:${color};border-radius:3px;"></div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:12px;">
        <div style="font-size:9.5pt;font-weight:bold;color:#111827;margin-bottom:6px;">${title}</div>
        ${bars}
      </div>
    `;
  };

  const renderTableRows = (dist: [string, number][]) => {
    return dist
      .map(
        ([name, count]) => `
      <tr>
        <td style="padding: 6px 10px; border: 1px solid #e5e7eb; font-size: 10pt;">${name}</td>
        <td style="padding: 6px 10px; border: 1px solid #e5e7eb; text-align: center; font-size: 10pt; font-weight: 600;">${count}</td>
        <td style="padding: 6px 10px; border: 1px solid #e5e7eb; text-align: center; font-size: 10pt; color: #6b7280;">${Math.round((count / total) * 100)}%</td>
      </tr>
    `
      )
      .join('');
  };

  const recordsHtml = eligible
    .map(
      (r, i) => `
    <div style="page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 14px; background: #fafafa;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
        <h4 style="margin: 0; font-size: 11pt; color: #1e3a8a;">#${i + 1}: ${r.fileName}</h4>
        <span style="font-size: 9pt; color: #6b7280;">Folder: <b>${r.folderName || 'Root'}</b></span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; background: #fff; margin-bottom: 8px;">
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb; font-weight: 600; width: 18%;">FR (Family Role)</td>
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb; width: 32%;">${r.adkotmDecode?.postAnalysisCodes?.FR || 'null'}</td>
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb; font-weight: 600; width: 18%;">RL (Residential)</td>
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb; width: 32%;">${r.adkotmDecode?.postAnalysisCodes?.RL || 'null'}</td>
        </tr>
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb; font-weight: 600;">AW (Gut Awareness)</td>
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb;">${r.adkotmDecode?.postAnalysisCodes?.AW || 'null'}</td>
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb; font-weight: 600;">IL (Venue)</td>
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb;">${r.adkotmDecode?.postAnalysisCodes?.IL || r.sessionLocation || 'null'}</td>
        </tr>
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb; font-weight: 600;">PP (Product Category)</td>
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb;">${r.adkotmDecode?.postAnalysisCodes?.PP || 'null'}</td>
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb; font-weight: 600;">PP1 (Brands)</td>
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb;">${r.adkotmDecode?.postAnalysisCodes?.PP1 || 'null'}</td>
        </tr>
        <tr style="background: #fef3c7;">
          <td style="padding: 5px 8px; border: 1px solid #e5e7eb; font-weight: 700; color: #92400e;">Spending Power</td>
          <td colspan="3" style="padding: 5px 8px; border: 1px solid #e5e7eb; font-weight: 600; color: #92400e;">
            ${r.spendingPower?.spendingPowerTier || 'null'} ${r.spendingPower?.justification ? `— ${r.spendingPower.justification}` : ''}
          </td>
        </tr>
      </table>
    </div>
  `
    )
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Empathy Qualitative Research Report - ${dateStr}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1f2937;
          margin: 20px auto;
          max-width: 900px;
          line-height: 1.4;
        }
        .header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .print-btn {
          background-color: #2563eb;
          color: white;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
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
      <div class="header-bar no-print">
        <div>
          <h2 style="margin: 0; font-size: 18px; color: #111827;">Empathy Study Hub: Qualitative Research Dossier</h2>
          <p style="margin: 2px 0 0; font-size: 12px; color: #6b7280;">Ready to save or print as PDF</p>
        </div>
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
      </div>

      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 22px; color: #1e3a8a; margin: 0 0 4px;">Qualitative Decode & Cross-Analysis Research Report</h1>
        <p style="font-size: 12px; color: #6b7280; margin: 0;">
          Date: ${dateStr} | Total Participants / Records: <b>${total}</b> | Decoded: <b>${decoded}</b>
        </p>
      </div>

      <h3 style="font-size: 14px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; color: #374151;">
        1. Visual Chart Distributions & Category Breakdown
      </h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
        <div>
          ${renderSvgDonut(frDist, 'Family Role (FR) - Code D')}
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
            <tr style="background:#f9fafb;"><th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:left;">Role</th><th style="padding:4px 8px;border:1px solid #e5e7eb;">Count</th><th style="padding:4px 8px;border:1px solid #e5e7eb;">%</th></tr>
            ${renderTableRows(frDist)}
          </table>

          ${renderSvgHorizontalBars(rlDist, 'Participant Residential Location (RL) - Code D')}
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
            <tr style="background:#f9fafb;"><th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:left;">Location</th><th style="padding:4px 8px;border:1px solid #e5e7eb;">Count</th><th style="padding:4px 8px;border:1px solid #e5e7eb;">%</th></tr>
            ${renderTableRows(rlDist)}
          </table>

          ${renderSvgDonut(spDist, 'Spending Power Tiers (D+O+T+M formula)')}
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
            <tr style="background:#f9fafb;"><th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:left;">Tier</th><th style="padding:4px 8px;border:1px solid #e5e7eb;">Count</th><th style="padding:4px 8px;border:1px solid #e5e7eb;">%</th></tr>
            ${renderTableRows(spDist)}
          </table>
        </div>

        <div>
          ${renderSvgDonut(awDist, 'Gut Health Awareness (AW) - Code K')}
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
            <tr style="background:#f9fafb;"><th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:left;">Awareness</th><th style="padding:4px 8px;border:1px solid #e5e7eb;">Count</th><th style="padding:4px 8px;border:1px solid #e5e7eb;">%</th></tr>
            ${renderTableRows(awDist)}
          </table>

          ${renderSvgHorizontalBars(ppDist, 'Product Categories (PP) - Code O')}
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
            <tr style="background:#f9fafb;"><th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:left;">Category</th><th style="padding:4px 8px;border:1px solid #e5e7eb;">Count</th><th style="padding:4px 8px;border:1px solid #e5e7eb;">%</th></tr>
            ${renderTableRows(ppDist)}
          </table>

          ${renderSvgHorizontalBars(pp1Dist, 'Brand Preferences (PP1) - Code O')}
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
            <tr style="background:#f9fafb;"><th style="padding:4px 8px;border:1px solid #e5e7eb;text-align:left;">Brand</th><th style="padding:4px 8px;border:1px solid #e5e7eb;">Count</th><th style="padding:4px 8px;border:1px solid #e5e7eb;">%</th></tr>
            ${renderTableRows(pp1Dist)}
          </table>
        </div>
      </div>

      <h3 style="font-size: 14px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; color: #374151; margin-top: 24px;">
        2. Respondent Qualitative Decode Dossiers
      </h3>
      ${recordsHtml}

      <script>
        // Optional auto-print after load
        // window.onload = () => window.print();
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
