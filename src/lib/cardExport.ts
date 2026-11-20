import { exportChartAsPng } from './chartExport';

export interface CardCsvRow {
  label: string;
  count: number | string;
  percentage?: number | string;
  notes?: string;
}

const escapeCsvCell = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const safeFileSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'bento_card';

export function exportCardDataAsCsv(
  title: string,
  rows: CardCsvRow[],
  coverage?: { statedCount: number; unstatedCount: number; totalRecords: number }
): void {
  const headers = ['Metric / Category', 'Count', 'Share (% of Stated)', 'Context / Notes'];
  const csvRows = rows.map((row) =>
    [row.label, row.count, row.percentage ?? '', row.notes ?? ''].map(escapeCsvCell).join(',')
  );

  if (coverage) {
    csvRows.push('');
    csvRows.push(
      ['Coverage Summary', `${coverage.statedCount} Stated`, `${coverage.unstatedCount} Unstated`, `Total Verified: ${coverage.totalRecords}`]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileSlug(title)}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportBentoCardAsPng(options: {
  containerEl: HTMLElement | null;
  title: string;
  code?: string;
  subtitle?: string;
  fallbackData?: { label: string; count: number; color: string }[];
  fallbackTotal?: number;
}): Promise<void> {
  const { containerEl, title, code, subtitle, fallbackData = [], fallbackTotal = 0 } = options;

  const svgEl = containerEl?.querySelector('svg.recharts-surface') as SVGSVGElement | null;

  if (!svgEl) {
    if (fallbackData.length > 0) {
      await exportChartAsPng({
        title,
        code,
        subtitle,
        chartType: 'bar',
        data: fallbackData,
        total: fallbackTotal || fallbackData.reduce((s, d) => s + d.count, 0),
      });
    }
    return;
  }

  try {
    const rect = svgEl.getBoundingClientRect();
    const chartW = Math.max(Math.round(rect.width), 480);
    const chartH = Math.max(Math.round(rect.height), 220);

    const cloned = svgEl.cloneNode(true) as SVGSVGElement;
    cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    cloned.setAttribute('width', String(chartW));
    cloned.setAttribute('height', String(chartH));

    const svgData = new XMLSerializer().serializeToString(cloned);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const padX = 24;
        const headerH = 68;
        const footerH = 30;
        const canvasW = chartW + padX * 2;
        const canvasH = chartH + headerH + footerH;

        const canvas = document.createElement('canvas');
        canvas.width = canvasW * scale;
        canvas.height = canvasH * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(svgUrl);
          resolve();
          return;
        }

        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Header bar
        ctx.fillStyle = '#fafaf9';
        ctx.fillRect(0, 0, canvasW, headerH);
        ctx.strokeStyle = '#e7e5e4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, headerH);
        ctx.lineTo(canvasW, headerH);
        ctx.stroke();

        ctx.fillStyle = '#1c1917';
        ctx.font = 'bold 14px Inter, system-ui, sans-serif';
        ctx.fillText(code ? `[${code}] ${title}` : title, padX, 28);

        if (subtitle) {
          ctx.fillStyle = '#78716c';
          ctx.font = '11px Inter, system-ui, sans-serif';
          ctx.fillText(subtitle, padX, 48);
        }

        ctx.drawImage(img, padX, headerH + 8, chartW, chartH);

        ctx.fillStyle = '#a8a29e';
        ctx.font = '10px monospace';
        ctx.fillText(`Empathy Study Hub • ${new Date().toISOString().split('T')[0]}`, padX, canvasH - 10);

        URL.revokeObjectURL(svgUrl);
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve();
            return;
          }
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `${safeFileSlug(title)}_chart.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(pngUrl);
          resolve();
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        resolve();
      };
      img.src = svgUrl;
    });
  } catch (err) {
    console.warn('PNG chart snapshot failed, using vector fallback:', err);
    if (fallbackData.length > 0) {
      await exportChartAsPng({
        title,
        code,
        subtitle,
        chartType: 'bar',
        data: fallbackData,
        total: fallbackTotal || fallbackData.reduce((s, d) => s + d.count, 0),
      });
    }
  }
}
