/**
 * High-Resolution Chart Export Utility
 * Exports SVG Pie/Donut and Bar Charts directly to PNG, SVG vector, or Clipboard.
 */

export interface ExportChartOptions {
  title: string;
  code?: string;
  subtitle?: string;
  chartType: 'pie' | 'bar';
  data: { label: string; count: number; color: string }[];
  total: number;
}

/**
 * Exports a chart as a high-resolution PNG image
 */
export async function exportChartAsPng(options: ExportChartOptions): Promise<void> {
  const blob = await renderChartToBlob(options);
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = options.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  a.download = `${safeName}_${options.chartType}_chart.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies high-resolution chart PNG directly to user's clipboard
 */
export async function copyChartToClipboard(options: ExportChartOptions): Promise<boolean> {
  try {
    const blob = await renderChartToBlob(options);
    if (!blob) return false;
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch (err) {
    console.warn('Clipboard write error:', err);
    return false;
  }
}

/**
 * Downloads the chart as a vector SVG file
 */
export function exportChartAsSvg(options: ExportChartOptions): void {
  const svgString = buildExportableSvg(options);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = options.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  a.download = `${safeName}_${options.chartType}_vector.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Builds standalone SVG string with full typography, chart graphics, and legend
 */
export function buildExportableSvg(options: ExportChartOptions): string {
  const { title, code, subtitle, chartType, data, total } = options;
  const width = 640;
  const legendRows = Math.min(data.length, 12);
  const height = 360 + legendRows * 24;

  let chartGraphics = '';

  if (chartType === 'pie') {
    const cx = 170;
    const cy = 200;
    const rOuter = 85;
    const rInner = 48;

    if (data.length === 1) {
      chartGraphics = `
        <circle cx="${cx}" cy="${cy}" r="${(rOuter + rInner) / 2}" fill="none" stroke="${data[0].color}" stroke-width="${rOuter - rInner}" />
        <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="20" font-weight="bold" fill="#1c1917" font-family="sans-serif">${data[0].count}</text>
        <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="11" font-weight="600" fill="#78716c" font-family="sans-serif">100%</text>
      `;
    } else {
      let accum = 0;
      const paths = data.map((d) => {
        const rawAngle = total > 0 ? (d.count / total) * 360 : 0;
        const angle = Math.min(rawAngle, 359.99);
        const startAngle = accum;
        const endAngle = accum + angle;
        accum += rawAngle;

        const startRad = ((startAngle - 90) * Math.PI) / 180;
        const endRad = ((endAngle - 90) * Math.PI) / 180;

        const x1 = cx + rOuter * Math.cos(startRad);
        const y1 = cy + rOuter * Math.sin(startRad);
        const x2 = cx + rOuter * Math.cos(endRad);
        const y2 = cy + rOuter * Math.sin(endRad);

        const x3 = cx + rInner * Math.cos(endRad);
        const y3 = cy + rInner * Math.sin(endRad);
        const x4 = cx + rInner * Math.cos(startRad);
        const y4 = cy + rInner * Math.sin(startRad);

        const largeArc = angle > 180 ? 1 : 0;
        const p = `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;

        return `<path d="${p}" fill="${d.color}" stroke="#ffffff" stroke-width="2" />`;
      });

      chartGraphics = `
        ${paths.join('\n')}
        <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="#ffffff" />
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="22" font-weight="bold" fill="#1c1917" font-family="monospace">${total}</text>
        <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="10" font-weight="bold" fill="#78716c" font-family="sans-serif" letter-spacing="1">SIGNALS</text>
      `;
    }
  } else {
    // Bar chart graphics
    const maxVal = Math.max(...data.map((d) => d.count), 1);
    const startY = 120;
    const barHeight = 22;
    const gap = 8;
    const maxBarW = 200;

    const bars = data.slice(0, 8).map((d, i) => {
      const y = startY + i * (barHeight + gap);
      const w = Math.max(Math.round((d.count / maxVal) * maxBarW), 6);
      return `
        <rect x="70" y="${y}" width="${w}" height="${barHeight}" rx="5" fill="${d.color}" />
        <text x="${70 + w + 8}" y="${y + 15}" font-size="11" font-weight="bold" fill="#1c1917" font-family="monospace">${d.count}</text>
      `;
    });

    chartGraphics = bars.join('\n');
  }

  // Legend Items
  const legendX = 330;
  let legendY = 130;
  const legendItems = data.slice(0, 12).map((d) => {
    const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
    const item = `
      <circle cx="${legendX + 6}" cy="${legendY + 6}" r="5" fill="${d.color}" />
      <text x="${legendX + 18}" y="${legendY + 10}" font-size="12" font-weight="600" fill="#292524" font-family="sans-serif">${escapeXml(d.label)}</text>
      <text x="${width - 40}" y="${legendY + 10}" text-anchor="end" font-size="12" font-weight="bold" fill="#1c1917" font-family="monospace">${d.count} <tspan fill="#a8a29e" font-weight="normal">(${pct}%)</tspan></text>
    `;
    legendY += 24;
    return item;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#fafaf9" rx="16" />
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="#ffffff" rx="15" stroke="#e7e5e4" stroke-width="1.5" />
  
  <!-- Header Banner -->
  <rect x="24" y="24" width="${width - 48}" height="70" rx="10" fill="#f5f5f4" />
  <text x="40" y="48" font-size="10" font-weight="bold" fill="#d97706" font-family="sans-serif" letter-spacing="1">EMPATHY RESEARCH HUB • QUALITATIVE DECODE</text>
  ${code ? `<rect x="40" y="58" width="36" height="18" rx="4" fill="#fef3c7" stroke="#fde68a" /><text x="58" y="71" text-anchor="middle" font-size="10" font-weight="bold" fill="#92400e" font-family="monospace">${code}</text>` : ''}
  <text x="${code ? 86 : 40}" y="72" font-size="15" font-weight="bold" fill="#1c1917" font-family="sans-serif">${escapeXml(title)}</text>
  ${subtitle ? `<text x="40" y="86" font-size="11" fill="#78716c" font-family="sans-serif">${escapeXml(subtitle)}</text>` : ''}
  <text x="${width - 40}" y="65" text-anchor="end" font-size="11" font-weight="bold" fill="#78716c" font-family="monospace">Total Analyzed: ${total}</text>

  <!-- Chart Visualization -->
  ${chartGraphics}

  <!-- Legend -->
  <text x="${legendX}" y="116" font-size="10" font-weight="bold" fill="#a8a29e" font-family="sans-serif" letter-spacing="1">BREAKDOWN &amp; COVERAGE</text>
  ${legendItems.join('\n')}

  <!-- Footer -->
  <line x1="24" y1="${height - 35}" x2="${width - 24}" y2="${height - 35}" stroke="#f5f5f4" stroke-width="1" />
  <text x="24" y="${height - 18}" font-size="10" fill="#a8a29e" font-family="sans-serif">Generated by Empathy Study Hub</text>
  <text x="${width - 24}" y="${height - 18}" text-anchor="end" font-size="10" font-family="monospace" fill="#a8a29e">${new Date().toISOString().split('T')[0]}</text>
</svg>`;
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Renders SVG to Canvas at 2x pixel ratio and returns PNG blob
 */
async function renderChartToBlob(options: ExportChartOptions): Promise<Blob | null> {
  const svgString = buildExportableSvg(options);
  const blobSvg = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blobSvg);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = 2; // High-res retina
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
