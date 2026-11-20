import React from 'react';
import { ActiveModule } from '../types';
import {
  FileText,
  Sparkles,
  PieChart,
  GitCompare,
  CheckCircle2,
} from 'lucide-react';

interface PipelineNavProps {
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
  recordCount: number;
  completedTranscriptCount: number;
  cleanedCount: number;
  cleanableTotal?: number;
  decodedCount?: number;
  decodableTotal?: number;
  evaluatedCount?: number;
}

export const PipelineNav: React.FC<PipelineNavProps> = ({
  activeModule,
  onSelectModule,
  recordCount,
  completedTranscriptCount,
  cleanedCount,
  cleanableTotal,
  decodedCount = 0,
  decodableTotal,
  evaluatedCount = 0,
}) => {
  const effectiveCleanable = cleanableTotal ?? recordCount;
  const effectiveDecodable = decodableTotal ?? recordCount;

  const isStep1Done = recordCount > 0 && completedTranscriptCount >= recordCount;
  const isStep2Done = effectiveCleanable > 0 && cleanedCount >= effectiveCleanable;
  const isStep3Done = effectiveDecodable > 0 && decodedCount >= effectiveDecodable;
  const isStep4Done = evaluatedCount > 0 || (recordCount > 0 && decodedCount > 0);

  const steps = [
    {
      id: 'module1_transcript' as ActiveModule,
      title: '1. Transcribe',
      icon: <FileText className="w-4 h-4" />,
      isDone: isStep1Done,
      progressText: recordCount > 0 ? `${completedTranscriptCount}/${recordCount}` : undefined,
    },
    {
      id: 'module2_clean' as ActiveModule,
      title: '2. Clean Text',
      icon: <Sparkles className="w-4 h-4" />,
      isDone: isStep2Done,
      progressText: effectiveCleanable > 0 ? `${cleanedCount}/${effectiveCleanable}` : undefined,
    },
    {
      id: 'module3_decode' as ActiveModule,
      title: '3. Decode Themes',
      icon: <PieChart className="w-4 h-4" />,
      isDone: isStep3Done,
      progressText: effectiveDecodable > 0 ? `${decodedCount}/${effectiveDecodable}` : undefined,
    },
    {
      id: 'module4_cross' as ActiveModule,
      title: '4. Cross-Analysis',
      icon: <GitCompare className="w-4 h-4" />,
      isDone: isStep4Done,
      progressText: isStep4Done ? 'Ready' : undefined,
    },
  ];

  return (
    <div className="bg-white border-b border-stone-200/90 shadow-2xs sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2.5 py-2">
          {steps.map((step) => {
            const isActive = activeModule === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onSelectModule(step.id)}
                className={`flex items-center gap-2 p-2 sm:px-3 sm:py-2 rounded-xl border text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-950 shadow-2xs ring-1 ring-amber-500/20'
                    : step.isDone
                    ? 'bg-emerald-50/50 border-emerald-200 text-stone-800 hover:bg-emerald-50'
                    : 'bg-stone-50/70 border-stone-200/80 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    step.isDone
                      ? 'bg-emerald-600 text-white'
                      : isActive
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {step.isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.icon}
                </div>
                <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                  <span className="text-xs font-bold truncate">{step.title}</span>
                  {step.isDone ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                      ✓ Done
                    </span>
                  ) : step.progressText ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700 shrink-0">
                      {step.progressText}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
