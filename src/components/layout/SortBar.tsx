import React from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import { SortMode } from '../../types';

interface SortBarProps {
  totalCount: number;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  searchFilter: string;
  onSearchChange: (val: string) => void;
  typeFilter: 'all' | 'audio' | 'text';
  onTypeFilterChange: (val: 'all' | 'audio' | 'text') => void;
  groupByFolder?: boolean;
  onToggleGroupByFolder?: () => void;
}

export const SortBar: React.FC<SortBarProps> = ({
  totalCount,
  sortMode,
  onSortChange,
  searchFilter,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  groupByFolder = true,
  onToggleGroupByFolder,
}) => {
  return (
    <div className="bg-[#F2F5F3] rounded-3xl p-4 mb-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
      {/* Title & Count Badge */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <h3 className="font-heading text-2xl font-medium text-[#1C1B1F] tracking-[-0.01em]">
          Interview Transcripts
        </h3>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#FDF3C7] text-[#3B2E00] tabular-nums">
          {totalCount} {totalCount === 1 ? 'record' : 'records'}
        </span>

        {onToggleGroupByFolder && (
          <button
            type="button"
            onClick={onToggleGroupByFolder}
            className={`min-h-[44px] sm:ml-1 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] cursor-pointer whitespace-nowrap active:scale-95 ${
              groupByFolder
                ? 'bg-[#DCE8F7] text-[#132B47]'
                : 'bg-[#E7ECE9] text-[#444846] hover:bg-[#528BCA]/10 hover:text-[#1C1B1F]'
            }`}
          >
            {groupByFolder ? '✓ Grouped by Date Folder' : 'Flat List View'}
          </button>
        )}
      </div>

      {/* Search & Sort Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Material 3 Filled Search Field */}
        <div className="relative w-full sm:w-auto min-w-0 sm:min-w-[230px] flex-1 sm:flex-initial">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444846] pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search transcripts or files..."
            className="md3-field min-h-[44px] w-full pl-10 pr-3.5 py-2 text-sm placeholder-[#727975]"
          />
        </div>

        {/* Material You Tonal Type Filter */}
        <div className="flex items-center rounded-full bg-[#E7ECE9] p-1 text-sm">
          <button
            type="button"
            onClick={() => onTypeFilterChange('all')}
            className={`min-h-[36px] px-3.5 py-1 rounded-full text-sm font-medium transition-all cursor-pointer active:scale-95 ${
              typeFilter === 'all'
                ? 'bg-[#528BCA] text-white shadow-2xs'
                : 'text-[#444846] hover:text-[#1C1B1F] hover:bg-[#528BCA]/10'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onTypeFilterChange('audio')}
            className={`min-h-[36px] px-3.5 py-1 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              typeFilter === 'audio'
                ? 'bg-[#528BCA] text-white shadow-2xs'
                : 'text-[#444846] hover:text-[#1C1B1F] hover:bg-[#528BCA]/10'
            }`}
          >
            MP3 / Audio
          </button>
          <button
            type="button"
            onClick={() => onTypeFilterChange('text')}
            className={`min-h-[36px] px-3.5 py-1 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              typeFilter === 'text'
                ? 'bg-[#528BCA] text-white shadow-2xs'
                : 'text-[#444846] hover:text-[#1C1B1F] hover:bg-[#528BCA]/10'
            }`}
          >
            Text Docs
          </button>
        </div>

        {/* Sort Dropdown / Selector */}
        <div className="min-h-[44px] flex items-center gap-1.5 bg-[#E7ECE9] rounded-full px-4 py-2">
          <span className="text-xs font-medium text-[#444846] uppercase tracking-wider flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#528BCA]" />
            Sort:
          </span>

          <select
            value={sortMode}
            onChange={(e) => onSortChange(e.target.value as SortMode)}
            className="text-sm font-medium text-[#1C1B1F] bg-transparent border-none focus:outline-none cursor-pointer pr-1"
          >
            <option value="date_desc">Interview Date (Latest First)</option>
            <option value="date_asc">Interview Date (Oldest First)</option>
            <option value="upload_desc">Upload Time (Latest at Front)</option>
            <option value="upload_asc">Upload Time (Oldest First)</option>
            <option value="name_asc">File Name (A → Z)</option>
            <option value="name_desc">File Name (Z → A)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
