import React from 'react';
import { User } from 'firebase/auth';
import {
  Sparkles,
  CheckCircle2,
  FileText,
  PieChart,
  GitCompare,
  History,
} from 'lucide-react';
import { ActiveModule } from '../types';

export interface HeaderProps {
  user?: User | null;
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
  isConnectingGoogle?: boolean;
  onConnectGoogle?: () => void;
  onLogout?: () => void;
  onOpenDriveModal?: () => void;
  onOpenUniversalUpload?: () => void;
  onOpenAiAssistant?: () => void;
  // Step counts & completions
  recordCount: number;
  completedTranscriptCount: number;
  cleanedCount: number;
  cleanableTotal: number;
  decodedCount: number;
  decodableTotal: number;
  evaluatedCount: number;
  // Version Control
  onOpenVersionHistory: () => void;
  activeVersionCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  onSelectModule,
  recordCount,
  completedTranscriptCount,
  cleanedCount,
  cleanableTotal,
  decodedCount,
  decodableTotal,
  evaluatedCount,
  onOpenVersionHistory,
  activeVersionCount,
  onOpenAiAssistant,
}) => {
  // Step completion logic
  const isStep1Done = recordCount > 0 && completedTranscriptCount >= recordCount;
  const isStep2Done = cleanableTotal > 0 && cleanedCount >= cleanableTotal;
  const isStep3Done = decodableTotal > 0 && decodedCount >= decodableTotal;
  const isStep4Done = evaluatedCount > 0 || (recordCount > 0 && decodedCount > 0);

  const steps = [
    {
      id: 'module1_transcript' as ActiveModule,
      shortNumber: '1',
      shortLabel: 'Transcribe',
      fullLabel: '1. Transcribe',
      icon: <FileText className="w-3.5 h-3.5" />,
      isDone: isStep1Done,
      progressText: recordCount > 0 ? `${completedTranscriptCount}/${recordCount}` : undefined,
    },
    {
      id: 'module2_clean' as ActiveModule,
      shortNumber: '2',
      shortLabel: 'Clean',
      fullLabel: '2. Clean Text',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      isDone: isStep2Done,
      progressText: cleanableTotal > 0 ? `${cleanedCount}/${cleanableTotal}` : undefined,
    },
    {
      id: 'module3_decode' as ActiveModule,
      shortNumber: '3',
      shortLabel: 'Decode',
      fullLabel: '3. Decode Themes',
      icon: <PieChart className="w-3.5 h-3.5" />,
      isDone: isStep3Done,
      progressText: decodableTotal > 0 ? `${decodedCount}/${decodableTotal}` : undefined,
    },
    {
      id: 'module4_cross' as ActiveModule,
      shortNumber: '4',
      shortLabel: 'Cross',
      fullLabel: '4. Cross-Analysis',
      icon: <GitCompare className="w-3.5 h-3.5" />,
      isDone: isStep4Done,
      progressText: isStep4Done ? 'Ready' : undefined,
    },
  ];

  return (
    <header className="border-b border-stone-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-30 shadow-2xs w-full max-w-full overflow-hidden">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 w-full">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white shadow-xs ring-1 ring-amber-200 shrink-0">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h1 className="text-xs sm:text-sm md:text-base font-bold text-stone-900 tracking-tight leading-none truncate">
                  <span className="sm:hidden">Empathy Hub</span>
                  <span className="hidden sm:inline">Empathy Study Hub</span>
                </h1>
                <span className="hidden xl:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  ADKOTM
                </span>
              </div>
            </div>
          </div>

          {/* Center: Responsive 4-Step Pipeline Navigation */}
          <nav
            aria-label="Workflow Steps"
            className="flex items-center bg-stone-100/90 p-0.5 sm:p-1 rounded-xl border border-stone-200/80 shadow-inner gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar shrink min-w-0"
          >
            {steps.map((step) => {
              const isActive = activeModule === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onSelectModule(step.id)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-white text-amber-950 font-bold shadow-xs border border-amber-300 ring-1 ring-amber-400/20'
                      : step.isDone
                      ? 'text-stone-700 hover:text-stone-900 hover:bg-white/60'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-white/40'
                  }`}
                  title={`${step.fullLabel}${step.isDone ? ' (Completed)' : ''}`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold ${
                      step.isDone
                        ? 'bg-emerald-600 text-white'
                        : isActive
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {step.isDone ? <CheckCircle2 className="w-3 h-3" /> : step.shortNumber}
                  </span>

                  {/* Adaptive Text Label for Mobile vs Tablet vs Desktop */}
                  <span className="text-[11px] sm:text-xs">
                    {/* Ultra-compact on mobile: show label if active, else number is enough */}
                    <span className="sm:hidden">{isActive ? step.shortLabel : ''}</span>
                    {/* Tablet compact */}
                    <span className="hidden sm:inline lg:hidden">{step.shortNumber}. {step.shortLabel}</span>
                    {/* Full desktop */}
                    <span className="hidden lg:inline">{step.fullLabel}</span>
                  </span>

                  {step.isDone ? (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 shrink-0">
                      ✓
                    </span>
                  ) : step.progressText ? (
                    <span className="text-[10px] font-medium px-1 py-0.2 rounded bg-stone-200/80 text-stone-600 shrink-0 hidden md:inline-block">
                      {step.progressText}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Right: Actions (Version History & AI Assistant) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Version Control & Revert Button */}
            <button
              type="button"
              onClick={onOpenVersionHistory}
              title="Audit and revert any changes or charts created by the AI Assistant"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 text-xs font-bold rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 shadow-2xs cursor-pointer transition-all active:scale-95"
            >
              <History className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden md:inline">History</span>
              {activeVersionCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {activeVersionCount}
                </span>
              )}
            </button>

            {/* AI Assistant Button (Top Right) */}
            {onOpenAiAssistant && (
              <button
                type="button"
                onClick={onOpenAiAssistant}
                title="AI Analytics Copilot - Ask questions, create charts & formulas"
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-xs cursor-pointer transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-100" />
                <span className="text-xs font-bold">AI</span>
                <span className="hidden lg:inline font-normal text-amber-100">Copilot</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
