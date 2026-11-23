import React, { useState } from 'react';
import {
  PieChart as PieIcon,
  BarChart3,
  HelpCircle,
  Download,
  Copy,
  Check,
  FileDown,
  Image as ImageIcon,
} from 'lucide-react';
import { exportChartAsPng, exportChartAsSvg, copyChartToClipboard } from '../../lib/chartExport';

export interface ChartDataItem {
  label: string;
  count?: number;
  value?: number;
  color?: string;
  secondaryValue?: number;
  category?: string;
}

export interface NormalizedChartItem {
  label: string;
  count: number;
  color?: string;
  secondaryValue?: number;
  category?: string;
}

interface AnalysisChartProps {
  title: string;
  subtitle?: string;
  description?: string;
  code?: string; // e.g. "FR", "RL", "AW", "PP", "PP1", "IL"
  dimension?: string; // e.g. "D", "K", "O", "T", "M"
  data: ChartDataItem[];
  totalRecords?: number;
  defaultChartType?: 'pie' | 'bar';
  type?: 'pie' | 'bar' | 'histogram' | 'line' | string;
}

const PALETTE = [
  '#F7D147', // Sunburst Yellow
  '#528BCA', // Cornflower Blue
  '#96D6C7', // Mint Teal
  '#D97A75', // Warm Rose
  '#7C8CE0', // Periwinkle Blue
  '#F6BEBA', // Soft Blush
  '#2B7A67', // Mint Teal Deep
  '#E39A94', // Soft Blush Deep
  '#D4AD1F', // Sunburst Ochre
  '#3A71B0', // Cornflower Deep
];

export const AnalysisChart: React.FC<AnalysisChartProps> = ({
  title,
  subtitle,
  description,
  code,
  dimension,
  data,
  totalRecords,
  defaultChartType = 'pie',
  type,
}) => {
  const initialType: 'pie' | 'bar' =
    type === 'bar' || defaultChartType === 'bar' ? 'bar' : 'pie';
  const [chartType, setChartType] = useState<'pie' | 'bar'>(initialType);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPng = async () => {
    setIsExporting(true);
    await exportChartAsPng({
      title,
      code,
      subtitle: subtitle || description,
      chartType,
      data: coloredData,
      total: totalCount,
    });
    setIsExporting(false);
    setIsExportMenuOpen(false);
  };

  const handleExportSvg = () => {
    exportChartAsSvg({
      title,
      code,
      subtitle: subtitle || description,
      chartType,
      data: coloredData,
      total: totalCount,
    });
    setIsExportMenuOpen(false);
  };

  const handleCopyClipboard = async () => {
    const ok = await copyChartToClipboard({
      title,
      code,
      subtitle: subtitle || description,
      chartType,
      data: coloredData,
      total: totalCount,
    });
    if (ok) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
    setIsExportMenuOpen(false);
  };

  // Normalize count or value
  const validData: NormalizedChartItem[] = (Array.isArray(data) ? data : [])
    .filter((d) => d && typeof d === 'object')
    .map((d) => ({
      label: String(d.label ?? ''),
      count: Number(d.count !== undefined ? d.count : d.value !== undefined ? d.value : 0) || 0,
      color: d.color,
      secondaryValue: d.secondaryValue,
      category: d.category,
    }))
    .filter((d) => d.count > 0);
  const totalCount = validData.reduce((acc, curr) => acc + curr.count, 0);

  const isUnstatedOrNull = (label: string): boolean => {
    const l = String(label || '').trim().toLowerCase();
    return (
      l === '' ||
      l === 'null' ||
      l === 'unstated' ||
      l === 'unknown' ||
      l === 'none' ||
      l === 'not specified' ||
      l === 'n/a' ||
      l === 'na' ||
      l.includes('unstated') ||
      l.includes('null') ||
      l.includes('not mentioned') ||
      l.includes('not specified')
    );
  };

  // Assign colors: All Unstated / Null strictly use consistent warm grey (#D6D0C6)
  let paletteIdx = 0;
  const coloredData: (NormalizedChartItem & { color: string })[] = validData.map((item) => {
    if (isUnstatedOrNull(item.label)) {
      return {
        ...item,
        color: '#D6D0C6',
      };
    }
    const color = item.color || PALETTE[paletteIdx % PALETTE.length];
    paletteIdx++;
    return {
      ...item,
      color,
    };
  });

  return (
    <div className="bg-white rounded-3xl border border-[#EAE6DF] p-5 shadow-studio hover:-translate-y-0.5 transition-all flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {code && (
                <span className="px-2.5 py-0.5 rounded-full text-[13px] font-mono font-bold bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147]/60">
                  {code}
                </span>
              )}
              <h3 className="font-heading text-base sm:text-lg font-bold text-[#292524] tracking-[-0.02em] truncate">{title}</h3>
            </div>
            {(subtitle || description) && (
              <p className="text-[13px] sm:text-sm leading-[1.65] text-[#57534E] mt-1 line-clamp-1">{subtitle || description}</p>
            )}
          </div>

          {/* Actions: Toggle Pie/Bar + Export Chart */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Pie / Bar */}
            <div className="flex items-center bg-[#F7F5F0] p-0.5 rounded-full border border-[#EAE6DF]">
              <button
                type="button"
                onClick={() => setChartType('pie')}
                title="View as Pie / Donut Chart"
                className={`p-1.5 rounded-full text-[13px] transition-all cursor-pointer ${
                  chartType === 'pie'
                    ? 'bg-[#292524] text-white font-semibold'
                    : 'text-[#78716C] hover:text-[#292524]'
                }`}
              >
                <PieIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                title="View as Bar Chart"
                className={`p-1.5 rounded-full text-[13px] transition-all cursor-pointer ${
                  chartType === 'bar'
                    ? 'bg-[#292524] text-white font-semibold'
                    : 'text-[#78716C] hover:text-[#292524]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Export Chart Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                title="Export this Chart as PNG, SVG, or copy to clipboard"
                className="px-3 py-1.5 rounded-full border border-[#EAE6DF] bg-[#F7F5F0] hover:bg-[#EAE6DF]/60 text-[#292524] cursor-pointer transition-all flex items-center gap-1.5 text-[13px] font-semibold"
              >
                <Download className="w-3.5 h-3.5 text-[#57534E]" />
                <span className="hidden sm:inline">Export</span>
              </button>

              {isExportMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsExportMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl shadow-studio border border-[#EAE6DF] p-1.5 z-30 space-y-1">
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={handleExportPng}
                      className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-semibold hover:bg-[#FEFBEB] text-[#292524] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <ImageIcon className="w-4 h-4 text-[#D4AD1F]" />
                      <span>{isExporting ? 'Exporting...' : 'Export PNG Image'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportSvg}
                      className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-semibold hover:bg-[#F2F7FC] text-[#292524] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <FileDown className="w-4 h-4 text-[#528BCA]" />
                      <span>Export Vector (SVG)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyClipboard}
                      className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-semibold hover:bg-[#F2FBF8] text-[#292524] flex items-center gap-2 cursor-pointer transition-colors border-t border-[#EAE6DF] pt-2"
                    >
                      {copyFeedback ? (
                        <>
                          <Check className="w-4 h-4 text-[#2B7A67]" />
                          <span className="text-[#1E4D42] font-bold">Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-[#2B7A67]" />
                          <span>Copy Image</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[13px] text-[#78716C] mt-2.5 pb-2 border-b border-[#EAE6DF]">
          <span>Total analyzed: <strong className="text-[#292524] font-mono tabular-nums">{totalCount}</strong></span>
          {totalRecords && totalRecords > totalCount && (
            <span className="italic">{totalRecords - totalCount} unstated (null)</span>
          )}
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="my-4 min-h-[220px] flex items-center justify-center">
        {coloredData.length === 0 ? (
          <div className="text-center py-8">
            <HelpCircle className="w-8 h-8 text-[#D6D0C6] mx-auto mb-2" />
            <p className="text-base leading-[1.65] text-[#78716C]">No empirical data decoded yet (null)</p>
          </div>
        ) : chartType === 'pie' ? (
          <DonutSvgChart
            data={coloredData}
            total={totalCount}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
          />
        ) : (
          <BarSvgChart
            data={coloredData}
            total={totalCount}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
          />
        )}
      </div>

      {/* Interactive Legend / Breakdown List */}
      <div className="space-y-1.5 pt-3 border-t border-[#EAE6DF] max-h-40 overflow-y-auto pr-1">
        {coloredData.map((item, idx) => {
          const isHovered = hoveredIndex === idx;
          const percent = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
          return (
            <div
              key={item.label}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`flex items-center justify-between text-[13px] sm:text-sm px-2.5 py-1 rounded-xl transition-colors cursor-pointer ${
                isHovered ? 'bg-[#F7F5F0] font-medium' : 'hover:bg-[#FDFCF8]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[#57534E] truncate flex-1 pr-2" title={item.label}>
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono tabular-nums text-[#292524] font-bold">{item.count}</span>
                <span className="text-[13px] text-[#78716C] font-mono tabular-nums w-10 text-right">
                  {percent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Pure SVG Donut Chart with Hover States
const DonutSvgChart: React.FC<{
  data: (NormalizedChartItem & { color: string })[];
  total: number;
  hoveredIndex: number | null;
  onHover: (idx: number | null) => void;
}> = ({ data, total, hoveredIndex, onHover }) => {
  const size = 190;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 82;
  const rInner = 48;

  // Single slice edge case (100%)
  if (data.length === 1) {
    const single = data[0];
    return (
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx}
            cy={cy}
            r={(rOuter + rInner) / 2}
            fill="none"
            stroke={single.color}
            strokeWidth={rOuter - rInner}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-lg font-bold font-mono tabular-nums text-[#292524]">{single.count}</span>
          <span className="text-[13px] text-[#78716C] uppercase font-bold tabular-nums">100%</span>
        </div>
      </div>
    );
  }

  // Calculate slice angles
  let accumulatedAngle = 0;
  const slices = data.map((d, idx) => {
    const countNum = Number(d.count) || 0;
    const rawAngle = total > 0 ? (countNum / total) * 360 : 0;
    const angle = Math.min(rawAngle, 359.99);
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle += rawAngle;

    // SVG arc coordinates
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

    const pathData = `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    return {
      pathData,
      color: d.color,
      label: String(d.label ?? ''),
      count: countNum,
      percent: total > 0 ? Math.round((countNum / total) * 100) : 0,
      index: idx,
    };
  });

  const activeSlice = hoveredIndex !== null ? slices[hoveredIndex] : null;

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transition-transform duration-300"
      >
        {slices.map((slice) => {
          const isHovered = hoveredIndex === slice.index;
          return (
            <path
              key={slice.index}
              d={slice.pathData}
              fill={slice.color}
              stroke="#ffffff"
              strokeWidth={1.5}
              className="cursor-pointer transition-all duration-200"
              style={{
                opacity: hoveredIndex === null || isHovered ? 1 : 0.6,
                transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                transformOrigin: `${cx}px ${cy}px`,
              }}
              onMouseEnter={() => onHover(slice.index)}
              onMouseLeave={() => onHover(null)}
            />
          );
        })}
      </svg>

      {/* Center Readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
        {activeSlice ? (
          <>
            <span className="text-base font-bold font-mono tabular-nums text-[#292524] leading-tight">
              {activeSlice.count}
            </span>
            <span className="text-[13px] font-bold text-[#528BCA] font-mono tabular-nums">
              {activeSlice.percent}%
            </span>
            <span className="text-[13px] text-[#78716C] truncate max-w-[84px]">
              {activeSlice.label}
            </span>
          </>
        ) : (
          <>
            <span className="text-lg font-bold font-mono tabular-nums text-[#292524]">{total}</span>
            <span className="text-[13px] text-[#78716C] uppercase tracking-wider font-semibold">
              Total
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// Pure SVG / CSS Bar Chart
const BarSvgChart: React.FC<{
  data: (NormalizedChartItem & { color: string })[];
  total: number;
  hoveredIndex: number | null;
  onHover: (idx: number | null) => void;
}> = ({ data, total, hoveredIndex, onHover }) => {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="w-full space-y-3 py-1">
      {data.map((item, idx) => {
        const isHovered = hoveredIndex === idx;
        const widthPercent = (item.count / maxCount) * 100;
        const sharePercent = total > 0 ? Math.round((item.count / total) * 100) : 0;

        return (
          <div
            key={item.label}
            onMouseEnter={() => onHover(idx)}
            onMouseLeave={() => onHover(null)}
            className={`space-y-1 cursor-pointer transition-opacity ${
              hoveredIndex === null || isHovered ? 'opacity-100' : 'opacity-60'
            }`}
          >
            <div className="flex items-center justify-between text-[13px] sm:text-sm gap-2">
              <span className="font-medium text-[#292524] truncate flex-1 min-w-0" title={item.label}>
                {item.label}
              </span>
              <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
                <span className="font-bold text-[#292524]">{item.count}</span>
                <span className="text-[13px] text-[#78716C]">({sharePercent}%)</span>
              </div>
            </div>

            <div className="w-full h-3 bg-[#F7F5F0] rounded-full overflow-hidden p-0.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
