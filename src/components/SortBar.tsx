import React from 'react';
import {
  ArrowUpDown,
  Clock,
  ArrowDownAZ,
  ArrowUpZA,
  Search,
  Filter,
} from 'lucide-react';
import { SortMode } from '../types';

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
    <div className="bg-white rounded-xl border border-stone-200 p-3 mb-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
      {/* Title & Count Badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-stone-900">
          Interview Transcripts
        </h3>
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
          {totalCount} {totalCount === 1 ? 'record' : 'records'}
        </span>

        {onToggleGroupByFolder && (
          <button
            type="button"
            onClick={onToggleGroupByFolder}
            className={`sm:ml-2 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              groupByFolder
                ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                : 'bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900'
            }`}
          >
            {groupByFolder ? '✓ Grouped by Date Folder' : 'Flat List View'}
          </button>
        )}
      </div>

      {/* Search & Sort Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative w-full sm:w-auto min-w-0 sm:min-w-[200px] flex-1 sm:flex-initial">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search transcripts or files..."
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onTypeFilterChange('all')}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onTypeFilterChange('audio')}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              typeFilter === 'audio'
                ? 'bg-white text-amber-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            MP3 / Audio
          </button>
          <button
            type="button"
            onClick={() => onTypeFilterChange('text')}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              typeFilter === 'text'
                ? 'bg-white text-blue-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Text Docs
          </button>
        </div>

        {/* Sort Dropdown / Selector */}
        <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3 text-stone-400" />
            Sort:
          </span>

          <select
            value={sortMode}
            onChange={(e) => onSortChange(e.target.value as SortMode)}
            className="text-xs font-semibold text-stone-800 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
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
