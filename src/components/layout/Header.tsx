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
import { ActiveModule } from '../../types';

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
    <header className="border-b border-[#D5DDD8]/70 bg-[#FDFCF8]/90 backdrop-blur-md sticky top-0 z-30 w-full max-w-full">
      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 py-2.5">
        <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-2 xl:gap-3 w-full">
          {/* Left: 4-Pebble Brand Identity */}
          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#F2F5F3] border border-[#96D6C7] flex items-center justify-center shrink-0 shadow-2xs"
              aria-hidden="true"
            >
              <svg viewBox="0 0 40 40" className="w-8 h-8 sm:w-9 sm:h-9">
                <circle
                  cx="20"
                  cy="20"
                  r="17.5"
                  fill="none"
                  stroke="#F6BEBA"
                  strokeWidth="2"
                />
                {/* Top-left: Mint Teal pebble */}
                <path
                  d="M11 14.5c0-3.2 2.8-5.2 5.6-4.7 2.4.4 3.6 2.5 3.1 4.9-.5 2.4-2.8 4.1-5.2 3.8-2.3-.3-3.5-1.9-3.5-4z"
                  fill="#96D6C7"
                />
                {/* Top-right: Sunburst Yellow pebble */}
                <path
                  d="M21.2 13.5c.3-2.6 2.7-4.3 5.2-3.7 2.5.6 4.1 2.9 3.4 5.4-.6 2.2-2.9 3.4-5.2 3-2.2-.4-3.7-2.4-3.4-4.7z"
                  fill="#F7D147"
                />
                {/* Bottom-left: Cornflower Blue pebble */}
                <path
                  d="M10.4 24.4c.5-2.6 3.1-4.1 5.6-3.4 2.4.7 3.8 2.9 3.2 5.2-.6 2.4-3.1 3.7-5.6 3.1-2.3-.5-3.6-2.6-3.2-4.9z"
                  fill="#528BCA"
                />
                {/* Bottom-right: Coral Red pebble */}
                <path
                  d="M20.8 25.1c.2-2.7 2.6-4.4 5.2-3.9 2.5.5 4.2 2.7 3.7 5.2-.5 2.4-2.8 3.9-5.3 3.5-2.3-.4-3.8-2.4-3.6-4.8z"
                  fill="#ED5353"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-[#292524] tracking-[-0.02em] leading-none truncate">
                  <span className="sm:hidden">Empathy Study</span>
                  <span className="hidden sm:inline">Empathy Study</span>
                </h1>
                <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7F5F0] text-[#57534E] border border-[#EAE6DF]">
                  ADKOTM Studio
                </span>
              </div>
              <p className="hidden sm:block font-hand text-[17px] leading-none text-[#78716C] mt-0.5">
                family habits, decoded into better food
              </p>
            </div>
          </div>

          {/* Center: Material You Tonal 4-Step Pill Stepper */}
          <nav
            aria-label="Workflow Steps"
            className="order-3 xl:order-2 flex items-center bg-[#F2F5F3] p-1 rounded-full shadow-2xs gap-1 overflow-x-auto no-scrollbar max-w-full"
          >
            {steps.map((step) => {
              const isActive = activeModule === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onSelectModule(step.id)}
                  className={`min-h-[38px] flex items-center gap-1.5 px-2.5 lg:px-3 xl:px-3.5 py-1.5 rounded-full text-xs xl:text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] whitespace-nowrap cursor-pointer shrink-0 active:scale-95 ${
                    isActive
                      ? 'bg-[#528BCA] text-white shadow-sm'
                      : step.isDone
                      ? 'text-[#133830] hover:bg-[#DDF3ED]'
                      : 'text-[#444846] hover:text-[#1C1B1F] hover:bg-[#528BCA]/10'
                  }`}
                  title={`${step.fullLabel}${step.isDone ? ' (Completed)' : ''}`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] shrink-0 font-medium tabular-nums ${
                      step.isDone
                        ? isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-[#DDF3ED] text-[#133830]'
                        : isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[#E7ECE9] text-[#444846]'
                    }`}
                  >
                    {step.isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.shortNumber}
                  </span>

                  {/* Adaptive Text Label for Mobile vs Tablet vs Desktop */}
                  <span className="text-xs xl:text-sm tracking-[-0.01em] whitespace-nowrap">
                    <span className="sm:hidden">{isActive ? step.shortLabel : ''}</span>
                    <span className="hidden sm:inline lg:hidden">{step.shortNumber}. {step.shortLabel}</span>
                    <span className="hidden lg:inline">{step.fullLabel}</span>
                  </span>

                  {step.isDone ? (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#DDF3ED] text-[#133830]'
                      }`}
                    >
                      ✓
                    </span>
                  ) : step.progressText ? (
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full shrink-0 hidden md:inline-block tabular-nums ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#E7ECE9] text-[#444846]'
                      }`}
                    >
                      {step.progressText}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Right: Actions (Version History & AI Copilot) */}
          <div className="order-2 xl:order-3 flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenVersionHistory}
              title="Audit and revert any changes or charts created by the AI Assistant"
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 xl:px-3.5 py-1.5 text-xs xl:text-sm font-medium rounded-full bg-[#DDF3ED] hover:bg-[#96D6C7]/50 text-[#133830] shadow-2xs cursor-pointer transition-all duration-200 active:scale-95 whitespace-nowrap shrink-0"
            >
              <History className="w-4 h-4 text-[#133830] shrink-0" />
              <span className="hidden md:inline">History</span>
              {activeVersionCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-[#FDF3C7] text-[#3B2E00] tabular-nums">
                  {activeVersionCount}
                </span>
              )}
            </button>

            {onOpenAiAssistant && (
              <button
                type="button"
                onClick={onOpenAiAssistant}
                title="AI Analytics Copilot - Ask questions, create charts & formulas"
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 xl:px-4 py-1.5 text-xs xl:text-sm font-medium rounded-full bg-[#528BCA] hover:bg-[#528BCA]/90 hover:shadow-md text-white shadow-xs cursor-pointer transition-all duration-200 active:scale-95 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4 text-[#FDF3C7] shrink-0" />
                <span className="font-semibold">AI</span>
                <span className="hidden lg:inline font-medium text-white/95">Copilot</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
