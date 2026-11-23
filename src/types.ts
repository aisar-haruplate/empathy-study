export type FileSource = 'google_drive' | 'local_upload' | 'pasted_text';

export type TranscriptionStatus = 'pending' | 'transcribing' | 'completed' | 'error';

export type ActiveModule =
  | 'module1_transcript'
  | 'module2_clean'
  | 'module3_decode'
  | 'module4_cross';

export interface ADKOTMActivities {
  dailyRoutine: string | null;
  shoppingBehaviour: string | null;
  foodConsumptionBehaviour: string | null;
  foodPreparation: string | null;
  eatingContext: string | null;
}

export interface ADKOTMDemographic {
  gender: string | null;
  age: string | null; // e.g. "32", "25-34", "68 (Elderly)", or null
  residentialLocation: string | null; // RL
  residentialDistrict: string | null; // e.g. "Kepong", "Ampang", "Petaling Jaya"
  educationLevel: string | null; // e.g. "Secondary / SPM", "Diploma", "Bachelor's Degree", "Master's", or null
  householdComposition: string | null;
  familyRole: string | null; // FR: Mums, Dads, Elderly
}

export interface ADKOTMKnowledge {
  awarenessOnGutHealth: string | null; // AW: Awareness & understanding on gut health
  awarenessLevel: 'Aware' | 'Not Aware' | null; // Structured binary awareness for segmentation
  understandingSummary: string | null; // Detailed qualitative understanding of gut health
}

export interface ADKOTMObjects {
  productsPurchased: string | null; // PP: Categories to solve gut health/digestive problem
  supplementProducts: string[] | null; // e.g. ["Probiotics powder", "Multivitamin gummies", "Enzymes"]
  foodProducts: string[] | null; // e.g. ["Yakult", "Vitagen", "Fernleaf milk", "Yogurt", "Oats"]
  actionsToSolve: string[] | null; // What do they do to solve gut health/digestive problem
  productCategory: string | null;
  brandPreferences: string | null; // PP1: Brands / sub-categories
  productPreference: string | null;
}

export interface ADKOTMTime {
  purchaseFrequency: string | null;
  consumptionFrequency: string | null;
  purchaseTiming: string | null;
  purchaseOccasion: string | null;
  consumptionTiming: string | null;
}

export interface ADKOTMMetadata {
  interviewTime: string | null;
  interviewLocation: string | null; // IL: Interview location
}

export type ADKOTMDimensionKey = 'A' | 'D' | 'K' | 'O' | 'T' | 'M';

export type ADKOTMSectionKey =
  | 'activities'
  | 'demographic'
  | 'knowledge'
  | 'objects'
  | 'time'
  | 'metadata';

export type PostAnalysisCodeKey = 'FR' | 'RL' | 'AW' | 'PP' | 'PP1' | 'IL';

export type ADKOTMFieldConfidence = 'HIGH' | 'REVIEW_NEEDED' | 'NULL';

export type ADKOTMConfidence =
  | 'HIGH'
  | 'MEDIUM'
  | 'REVIEW_NEEDED'
  | 'UNVERIFIED'
  | 'NULL'
  | 'HIGH (Filename Metadata)';

export type ADKOTMFieldStatus = 'STAGED' | 'ACCEPTED' | 'REJECTED' | 'MANUAL';

export type InterviewReviewStatus = 'unprocessed' | 'needs_review' | 'human_verified';

export interface ADKOTMFieldEvidence {
  code: string | null;
  evidence_quote: string | null;
  confidence: ADKOTMConfidence;
  reasoning?: string | null;
}

export interface ADKOTMFieldItem {
  code: string | null;
  evidence_quote: string | null;
  confidence: ADKOTMFieldConfidence;
  status: ADKOTMFieldStatus;
  reasoning?: string | null;
  source?: 'transcript' | 'filename_metadata' | 'session_metadata' | 'manual';
}

export type CopilotTab = 'chat' | 'suggestions' | 'normalize' | 'gaps' | 'rules';

export interface CopilotFieldSuggestion {
  id: string;
  targetSection: ADKOTMSectionKey;
  targetField: string;
  targetLabel: string;
  postAnalysisCode?: PostAnalysisCodeKey;
  suggestedCode: string;
  evidence_quote: string | null;
  confidence: ADKOTMConfidence;
  reasoning?: string | null;
  source?: string;
}

export interface UncodedSignal {
  id: string;
  sentence: string;
  suggestedSection: ADKOTMSectionKey;
  suggestedField: string;
  suggestedLabel: string;
  postAnalysisCode?: PostAnalysisCodeKey;
  suggestedCode: string;
  reasoning?: string;
}

export interface ReDecodeDiffEntry {
  id: string;
  recordId: string;
  fileName: string;
  section: ADKOTMSectionKey;
  field: string;
  label: string;
  postAnalysisCode?: PostAnalysisCodeKey;
  oldValue: string | null;
  newValue: string | null;
  evidence_quote: string | null;
  confidence: ADKOTMConfidence;
  reasoning: string | null;
}

export interface MissedSignalSuggestion {
  id: string;
  sentence: string;
  suggestedFieldKey: string;
  suggestedDimension: ADKOTMDimensionKey;
  suggestedCode: string;
  reason: string;
  matchedKeyword?: string;
}

export interface TaxonomyMergeProposal {
  id: string;
  field: 'PP' | 'PP1';
  originalValues: string[];
  normalizedValue: string;
  preservedBrands: Record<string, string>; // recordId -> preserved PP1 brand string
  affectedRecordIds: string[];
  affectedFileNames: string[];
  reason: string;
  recordId?: string;
  fileName?: string;
  beforePP?: string | null;
  afterPP?: string | null;
  beforePP1?: string | null;
  afterPP1?: string | null;
}

export interface CustomTaxonomyCategory {
  id: string;
  name: string;
  shortCode?: string;
  dimension: ADKOTMDimensionKey;
  fieldKey: string;
  kind: 'category' | 'parameter';
  createdAt: string;
}

export interface ADKOTMDecode {
  activities: ADKOTMActivities;
  demographic: ADKOTMDemographic;
  knowledge: ADKOTMKnowledge;
  objects: ADKOTMObjects;
  time: ADKOTMTime;
  metadata: ADKOTMMetadata;
  // Specific post-analysis codes from user framework
  postAnalysisCodes: {
    FR: string | null; // Family Role (Mums, Dads, Elderly)
    RL: string | null; // Residential Location
    AW: string | null; // Awareness & Understanding on gut health
    PP: string | null; // Products purchased categories (gut health/digestive)
    PP1: string | null; // Products purchased brand analysis
    IL: string | null; // Interview location
  };
  evidenceQuotes: {
    code: string;
    field: string;
    quote: string;
  }[];
  // Structured Human-in-the-Loop Copilot state per ADKOTM parameter key
  fieldStates?: Record<string, ADKOTMFieldItem>;
  fieldDetails?: Record<string, ADKOTMFieldEvidence>;
  customFields?: Record<string, string | null>;
  copilotSuggestions?: CopilotFieldSuggestion[];
  missedSignals?: MissedSignalSuggestion[];
  dismissedSignalIds?: string[];
  decodedAt?: string;
}

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  chartSpec?: {
    type: 'pie' | 'bar' | 'histogram' | 'line' | 'map';
    title: string;
    description?: string;
    data: { label: string; value: number; secondaryValue?: number; color?: string; category?: string }[];
    xAxisLabel?: string;
    yAxisLabel?: string;
  };
  suggestedFormula?: CrossAnalysisFormula;
}

export interface SpendingPowerAnalysis {
  recordId: string;
  fileName: string;
  spendingPowerTier: 'High' | 'Medium-High' | 'Medium' | 'Low' | null;
  components: {
    D_demographic: string | null;
    O_objects: string | null;
    T_time: string | null;
    M_metadata: string | null;
    RL_residentialLocation: string | null;
    PP_productsPurchased: string | null;
    PP1_brandPreferences: string | null;
    IL_interviewLocation: string | null;
  };
  justification: string | null;
}

export interface CrossAnalysisFormula {
  id: string;
  name: string;
  code: string; // e.g. "D + O + T + M" or "K + O + A"
  analysisCodes: string; // e.g. "RL + PP + IL" or "AW + PP + Prep"
  dimensions: ('A' | 'D' | 'K' | 'O' | 'T' | 'M')[];
  description: string;
  outputTiers: string[]; // e.g. ["High", "Medium-High", "Medium", "Low"]
  evaluationRules?: string;
  isCustom?: boolean;
  weights?: Partial<Record<'A' | 'D' | 'K' | 'O' | 'T' | 'M', number>>;
  tierThresholds?: number[]; // Descending cutoffs matching outputTiers (0-100 scale)
}

export interface GenericCrossAnalysisEvaluation {
  recordId: string;
  fileName: string;
  formulaId: string;
  tier: string | null;
  components: Record<string, string | null>;
  justification: string | null;
  evaluatedAt?: string;
  score?: number;
  maxScore?: number;
  dimensionScores?: Partial<Record<'A' | 'D' | 'K' | 'O' | 'T' | 'M', { earned: number; weight: number; stated: boolean; summary: string | null }>>;
  breakdownText?: string;
  isManualOverride?: boolean;
}

export interface ADKOTMDistributionSummary {
  totalDecodedRecords: number;
  // Post-analysis code distributions (from real decoded records)
  familyRolesFR: { name: string; count: number }[];
  residentialLocationsRL: { name: string; count: number }[];
  gutHealthAwarenessAW: { name: string; count: number }[];
  productCategoriesPP: { name: string; count: number }[];
  brandsPP1: { name: string; count: number }[];
  interviewLocationsIL: { name: string; count: number }[];
  spendingPowerDistribution: { name: string; count: number; color: string }[];
}

export interface TranscriptCleaningOptions {
  removeInterviewer: boolean;
  removeFillers: boolean;
  removePhatic: boolean;
  removeNoise: boolean;
  translateToEnglish: boolean;
}

export interface TranscriptCleaningStats {
  removedInterviewerTurns: number;
  removedFillersCount: number;
  removedPhaticCount: number;
  removedNoiseTagsCount: number;
}

export interface CleanedTranscriptVariant {
  text: string;
  wordCount: number;
  removedWordsCount: number;
  preservedPronounsCount: number;
  stats?: TranscriptCleaningStats;
  cleanedAt?: string;
  translatedToEnglish?: boolean;
  translationError?: string;
  error?: string;
}

export interface InterviewRecord {
  id: string;
  fileName: string;
  fileType: 'audio' | 'text';
  mimeType: string;
  source: FileSource;
  uploadedAt: number; // timestamp in milliseconds
  fileSizeBytes?: number;
  audioUrl?: string; // object URL or data URL for playback
  status: TranscriptionStatus;
  transcript?: string;
  errorMessage?: string;
  driveFileId?: string;
  driveIconLink?: string;
  speakerCount?: number;
  wordCount?: number;

  // Folder & Session Hierarchy
  folderName?: string; // e.g. "10/26", "26 Oct 2026", "Recording"
  folderPath?: string; // e.g. "Shared with Me / Recording / 10/26"
  isMetaDataDoc?: boolean; // true only for metadata-only documents, not interview notes
  sessionMetadataText?: string; // Session-level header split from interview notes
  sessionDate?: string; // extracted or inferred date e.g. "26 Oct 2026"
  sessionLocation?: string; // e.g. "Brem Mall Kepong, Publika"

  // Module 2: Translated & Cleaned Data (synced to whichever result is selected)
  translatedTranscript?: string;
  translatedWordCount?: number;
  translatedAt?: string;
  cleanedTranscript?: string;
  cleanedWordCount?: number;
  removedWordsCount?: number;
  preservedPronounsCount?: number;
  cleaningStats?: TranscriptCleaningStats;
  cleaningStatus?: 'pending' | 'cleaned';
  quickCleanedResult?: CleanedTranscriptVariant;
  aiCleanedResult?: CleanedTranscriptVariant;
  activeCleanSource?: 'quick' | 'ai' | 'manual';

  // Module 3: ADKOTM Formal Qualitative Decode
  adkotmDecode?: ADKOTMDecode;
  decodeStatus?: 'pending' | 'decoded';
  reviewStatus?: InterviewReviewStatus;
  verifiedAt?: string;

  // Module 4: Spending Power & Cross-Analysis
  spendingPower?: SpendingPowerAnalysis;
  crossAnalysisEvaluations?: Record<string, GenericCrossAnalysisEvaluation>;
}

export interface InterviewSession {
  id: string;
  folderName: string; // e.g. "10/26"
  folderPath?: string;
  sessionDate: string; // "26 Oct 2026" or "10/26"
  sessionLocation?: string; // "Brem Mall Kepong, Publika"
  metaDataRecord?: InterviewRecord;
  metaDataContent?: string;
  records: InterviewRecord[];
  latestUploadTime: number;
  isDuplicate?: boolean;
  duplicateReason?: string;
  duplicateSessionIds?: string[];
  duplicateFileNames?: string[];
  duplicateCount?: number;
}

export type SortMode = 'date_desc' | 'date_asc' | 'upload_desc' | 'upload_asc' | 'name_asc' | 'name_desc';

export type DriveRootType = 'my_drive' | 'shared_drives' | 'shared_with_me';

export interface SharedDriveItem {
  id: string;
  name: string;
  colorRgb?: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
  isSharedDriveRoot?: boolean;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  iconLink?: string;
  thumbnailLink?: string;
  isFolder?: boolean;
  shortcutDetails?: {
    targetId?: string;
    targetMimeType?: string;
  };
  targetFolderName?: string;
  targetFolderPath?: string;
}

export interface AiVersionHistoryItem {
  id: string;
  timestamp: number;
  actionType: 'add_formula' | 'custom_chart' | 'edit_formula';
  title: string;
  description: string;
  targetId?: string;
  formulaId?: string;
  formula?: CrossAnalysisFormula;
  snapshot?: any;
  chartSpec?: any;
  reverted?: boolean;
  revertedAt?: number;
}
