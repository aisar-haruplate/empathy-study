import type { TranscriptCleaningOptions, TranscriptCleaningStats } from '../types';

export const DEFAULT_CLEANING_OPTIONS: TranscriptCleaningOptions = {
  removeInterviewer: true,
  removeFillers: true,
  removePhatic: true,
  removeNoise: true,
  translateToEnglish: true,
};

export interface CleanTranscriptResult {
  cleanedText: string;
  preservedPronounsCount: number;
  stats: TranscriptCleaningStats;
}

// Expanded Southeast Asian Malay / colloquial phrase dictionary while keeping product brand names intact
const TRANSLATION_MAP: Record<string, string> = {
  // Multi-word Malay & colloquial nutrition/interview phrases (longest matched first)
  'kesihatan sistem dalam': 'internal digestive system health',
  'sistem penghadaman dalaman': 'internal digestive system health',
  'sistem dalaman': 'internal digestive system',
  'tiap-tiap hari': 'every day',
  'setiap hari': 'every day',
  'tiap hari': 'every day',
  'setiap minggu': 'every week',
  'setiap pagi': 'every morning',
  'setiap malam': 'every night',
  'pasar malam': 'night market',
  'pasar pagi': 'morning market',
  'kedai runcit': 'grocery store',
  'kembung perut': 'bloating',
  'sakit perut': 'stomach ache',
  'cirit-birit': 'diarrhea',
  'cirit birit': 'diarrhea',
  'buang air besar': 'bowel movement',
  'kesihatan usus': 'gut health',
  'minuman kultur': 'cultured drink',
  'susu kambing': 'goat milk',
  'air suam': 'warm water',
  'air panas': 'warm water',
  'air kosong': 'plain water',
  'air masak': 'boiled water',
  'anak saya': 'my child',
  'adik, anak': 'my child',
  'anak-anak': 'children',
  'suami saya': 'my husband',
  'isteri saya': 'my wife',
  'mak saya': 'my mother',
  'ayah saya': 'my father',
  'sudah besar': 'already grown up',
  'dah besar': 'already grown up',
  'tiada produk lain': 'no other products',
  'tiada yang lain': 'no other products',
  'produk yang lain': 'other products',
  'produk lain': 'other products',
  'yang lain': 'other',
  'tidak ada': 'do not have',
  'tak adalah': 'do not have',
  'tak ada': 'do not have',
  'tak suka': 'do not like',
  'tidak suka': 'do not like',
  'tak makan': 'do not eat',
  'tidak makan': 'do not eat',
  'tak minum': 'do not drink',
  'tidak minum': 'do not drink',
  'tak beli': 'do not buy',
  'tidak beli': 'do not buy',
  'tak tahu': 'do not know',
  'tidak tahu': 'do not know',
  'kurang manis': 'less sweet',
  'tanpa gula': 'sugar free',
  'kadang-kadang': 'sometimes',
  'kadangkala': 'sometimes',
  'dia suka': 'he likes',
  'liang cha': 'herbal tea',

  // Single-word food, health, shopping & daily life Malay/colloquial terms
  'sayur-sayuran': 'vegetables',
  'sayuran': 'vegetables',
  'sayur': 'vegetables',
  'buah-buahan': 'fruits',
  'buah': 'fruits',
  'penghadaman': 'digestion',
  'sembelit': 'constipation',
  'kesihatan': 'health',
  'sistem': 'system',
  'probiotik': 'probiotic',
  'produk': 'products',
  'susu': 'milk',
  'nasi': 'rice',
  'ikan': 'fish',
  'ayam': 'chicken',
  'daging': 'meat',
  'telur': 'eggs',
  'roti': 'bread',
  'kacang': 'beans',
  'bubur': 'porridge',
  'ubat': 'medicine',
  'bayam': 'spinach',
  'pisang': 'banana',
  'betik': 'papaya',
  'mangga': 'mango',
  'epal': 'apple',
  'oren': 'orange',
  'pedas': 'spicy food',
  'makan': 'eat',
  'minum': 'drink',
  'masak': 'cook',
  'beli': 'buy',
  'sedap': 'delicious',
  'tapau': 'takeaway',
  'kedai': 'shop',
  'pasaraya': 'supermarket',
  'pasar': 'market',
  'rumah': 'home',
  'sekolah': 'school',
  'pagi': 'morning',
  'petang': 'afternoon',
  'malam': 'night',
  'minggu': 'week',
  'bulan': 'month',
  'tahun': 'year',
  'saya': 'i',
  'dia': 'he',
  'kami': 'we',
  'kita': 'we',
  'mereka': 'they',
  'dan': 'and',
  'anak': 'child',
  'adik': 'child',
  'budak': 'kid',
  'suami': 'husband',
  'isteri': 'wife',
  'ialah': 'is',
  'adalah': 'is',
  'tak': 'no',
  'tidak': 'not',
  'tiada': 'no',
  'bukan': 'not',
  'nak': 'want',
  'mahu': 'want',
  'boleh': 'can',
  'kena': 'must',
  'perlu': 'need',
  'suka': 'like',
  'hanya': 'only',
  'sahaja': 'only',
  'saja': 'only',
  'memang': 'indeed',
  'besar': 'grown up',
  'sudah': 'already',
  'dah': 'already',
  'lain': 'other',
  'selalu': 'always',
  'jarang': 'rarely',
  'kadang': 'sometimes',
  'biasa': 'usually',
  'dekat': 'at',
  'untuk': 'for',
  'bagi': 'for',
  'dengan': 'with',
  'sebab': 'because',
  'kerana': 'because',
  'tapi': 'but',
  'tetapi': 'but',
  'kalau': 'if',
  'lepas': 'after',
  'sebelum': 'before',
  'mahal': 'expensive',
  'murah': 'cheap',
  'bagus': 'good',
  'sihat': 'healthy',
  'teh': 'tea',
  'kopi': 'coffee',
  'doufu': 'tofu',
  'toufu': 'tofu',
  'tauhu': 'tofu',
  'liangcha': 'herbal tea',
  'bao': 'steamed bun',
  'congee': 'porridge',
};

const INTERVIEWER_LABEL_PATTERN =
  '(?:interviewer|researcher|moderator|host|facilitator|staff|int|q|i)';
const INTERVIEWEE_LABEL_PATTERN =
  '(?:parent|participant|speaker|respondent|subject|guardian|interviewee|mother|father|mum|mom|dad|elderly|child|a)';
const ANY_SPEAKER_LABEL_PATTERN = `(?:${INTERVIEWER_LABEL_PATTERN}|${INTERVIEWEE_LABEL_PATTERN})`;

const BARE_INTERVIEWER_LABEL_PATTERN =
  '(?:interviewer|researcher|moderator|host|facilitator|staff|int)';
const BARE_INTERVIEWEE_LABEL_PATTERN =
  '(?:parent|participant|speaker|respondent|subject|guardian|interviewee|mother|father|mum|mom|dad|elderly|child)';
const BARE_ANY_SPEAKER_LABEL_PATTERN = `(?:${BARE_INTERVIEWER_LABEL_PATTERN}|${BARE_INTERVIEWEE_LABEL_PATTERN})`;

const PRONOUN_REGEX =
  /\b(he|she|him|her|his|hers|they|them|their|theirs|i|me|my|mine|we|us|our|ours|you|your|yours|it|its)\b/gi;

// Unambiguous non-English scripts (CJK, Tamil, Arabic) and Malay/Indonesian/Manglish markers
// Brand names (Yakult, Vitagen, Nutrilite, Bio Gaia, Sunglo, Emmi, Fernleaf, Karihome, etc.) are intentionally excluded
const NON_LATIN_SCRIPT_REGEX = /[\u3400-\u9FFF\uF900-\uFAFF\u0B80-\u0BFF\u0600-\u06FF]/;
const UNTRANSLATED_MALAY_MARKER_REGEX =
  /\b(?:saya|aku|tidak|bukan|belum|akan|sudah|sedang|tengah|untuk|dengan|kerana|sebab|kalau|yang|mereka|kami|kita|awak|kamu|anak|adik|makan|minum|masak|beli|kedai|pasar|rumah|perut|usus|sembelit|kesihatan|sistem|sayur|buah|susu|nasi|ikan|ayam|daging|telur|roti|boleh|memang|hanya|sahaja|saja|macam|dekat|kepada|daripada|tapi|tetapi|selalu|jarang|kadang|pagi|malam|petang|hari|minggu|bulan|tahun|kenapa|berapa|siapa|bila|bagus|mahal|murah|sedap|pedas|tapau|tauhu|kacang|bubur|betik|pisang|bayam|ubat|ialah|adalah|ada|lain|besar|terima|kasih|maaf|mah|lor|lah|leh|hor|kan|je|pun|tak|nak|dah|dok|kat|gi|pi|tu|ni|dia|ini|itu|apa|mana|sini|situ|sana|juga|lagi|sangat|banyak|sikit|kurang|lebih|kena|perlu|mahu|hendak|ingin|tahu|rasa|nampak|dengar|cakap|tanya|jawab|balik|keluar|masuk|ambil|bagi|hantar|tengok|kerja|sekolah)\b/i;

/**
 * Returns true if text still contains CJK/non-Latin scripts or untranslated Malay/colloquial phrases
 * requiring the fast AI translation fallback.
 */
export const needsEnglishTranslation = (text?: string): boolean => {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (NON_LATIN_SCRIPT_REGEX.test(trimmed)) return true;
  return UNTRANSLATED_MALAY_MARKER_REGEX.test(trimmed);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const countWords = (text?: string): number => {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

export const countPreservedPronouns = (text?: string): number => {
  if (!text || typeof text !== 'string') return 0;
  return (text.match(PRONOUN_REGEX) || []).length;
};

const applyTranslationRules = (value: string): string => {
  let updated = value;
  const entries = Object.entries(TRANSLATION_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [source, replacement] of entries) {
    const regex = new RegExp(`\\b${escapeRegExp(source)}\\b`, 'gi');
    updated = updated.replace(regex, replacement);
  }
  return updated;
};

/**
 * Strip timestamps, non-verbal annotations, bracketed/starred noise tags, and dash artifacts.
 */
export const stripNoiseAndArtifacts = (text: string): { text: string; count: number } => {
  if (!text) return { text: '', count: 0 };

  let count = 0;
  let out = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, ' ');

  const countAndReplace = (re: RegExp, replacement: string) => {
    const matches = out.match(re);
    if (matches) count += matches.length;
    out = out.replace(re, replacement);
  };

  // Timestamps like [00:00], [01:23:45], (00:15)
  countAndReplace(/[\[(]\s*\d{1,2}:\d{2}(?::\d{2})?\s*[\])]/g, ' ');

  // Starred non-verbal tags like *indecipherable*, *laughter*, *cough*
  countAndReplace(/\*[^*\n]{1,80}\*/g, ' ');

  // Bracketed non-verbal / noise tags like [笑声], [inaudible], [noise], [background noise], [laughter]
  // Exclude bracketed speaker labels so they aren't miscounted as noise tags
  countAndReplace(
    new RegExp(`\\[(?!\\s*${ANY_SPEAKER_LABEL_PATTERN}(?:\\s*#?\\d+)?\\s*:?\\s*\\])[^\\]\\n]{1,80}\\]`, 'gi'),
    ' '
  );

  // Parenthesized noise / non-verbal artifacts
  countAndReplace(
    /\(\s*(?:inaudible|indecipherable|unintelligible|noise|background\s+noise|ambient\s+noise|laughter|laughing|chuckle|chuckles|cough|coughing|sigh|music|silence|pause|crosstalk|static|chatter|笑声|[\d:]+)\s*\)/gi,
    ' '
  );

  // Double-dash / isolated dash artifacts (preserves hyphenated words like sugar-free)
  countAndReplace(/--+/g, ' ');
  countAndReplace(/(?:^|\s)-(?:\s|$)/g, ' ');

  return { text: out, count };
};

/**
 * Remove all speaker headers and role labels regardless of formatting:
 * e.g. Interviewer:, [Interviewer]:, Parent:, Participant:, [Speaker]:, **Parent:**, etc.
 */
export const stripSpeakerHeaders = (text: string): string => {
  if (!text) return '';

  let out = text;

  // Strip bracketed/parenthesized/markdown speaker labels with or without colon
  const bracketedSpeakerRe = new RegExp(
    `(?:\\[|\\(|\\*{1,3})\\s*${ANY_SPEAKER_LABEL_PATTERN}(?:\\s*#?\\d+)?\\s*:?\\s*(?:\\]|\\)|\\*{1,3})\\s*:?`,
    'gi'
  );
  out = out.replace(bracketedSpeakerRe, ' ');

  // Strip speaker labels followed by colon anywhere at line/clause/pipe boundaries
  const colonSpeakerRe = new RegExp(
    `(?:^|[\\n|]|(?<=\\s))${ANY_SPEAKER_LABEL_PATTERN}(?:\\s*#?\\d+)?\\s*:`,
    'gim'
  );
  out = out.replace(colonSpeakerRe, ' ');

  // Strip bare multi-letter speaker labels at line start (e.g., "interviewer how old..." or "participant yes")
  const bareLineStartRe = new RegExp(
    `^\\s*${BARE_ANY_SPEAKER_LABEL_PATTERN}(?:\\s*#?\\d+)?(?:\\s*[-–|]+\\s*|\\s+(?=[a-z0-9"']))`,
    'gim'
  );
  out = out.replace(bareLineStartRe, '');

  // Strip single-letter or multi-letter labels only when explicitly delimited with dash/pipe (e.g., "I - how old...")
  const delimitedSingleLabelRe = new RegExp(
    `^\\s*${ANY_SPEAKER_LABEL_PATTERN}(?:\\s*#?\\d+)?\\s*[-–|]+\\s*`,
    'gim'
  );
  out = out.replace(delimitedSingleLabelRe, '');

  // Strip standalone lines containing only a multi-letter speaker label
  const standaloneLabelLineRe = new RegExp(
    `^\\s*${BARE_ANY_SPEAKER_LABEL_PATTERN}(?:\\s*#?\\d+)?\\s*$`,
    'gim'
  );
  out = out.replace(standaloneLabelLineRe, '');

  return out;
};

/**
 * Remove verbal fillers while preserving meaning (including verb/preposition "like").
 */
export const removeFillersPreservingMeaning = (text: string): { text: string; count: number } => {
  if (!text) return { text: '', count: 0 };

  let count = 0;
  let out = text;

  const countAndReplace = (re: RegExp, replacement: string | ((m: string, ...args: any[]) => string)) => {
    const matches = out.match(re);
    if (matches) count += matches.length;
    out = out.replace(re, replacement as any);
  };

  // Multi-word fillers (preserve genuine questions/clauses like "do you know what...")
  countAndReplace(
    /(?<!\b(?:do|don't|did|didn't|would|could|should|can|will|if|what|who|as|let|we|all)\s)\byou\s+know\b(?!\s+(?:what|who|where|when|why|how|if|whether|that|about|which|any|anything|anyone|gut)\b)|\b(?:mm[\s-]*hmm?|uh[\s-]+huh)\b/gi,
    ' '
  );
  countAndReplace(
    /(?<!\b(?:what|which|all|any|some|this|that|another|different|same)\s)\b(?:sort\s+of|kind\s+of)\b/gi,
    ' '
  );

  // Unambiguous verbal hesitations and crutch words across English, Malay, Mandarin & Cantonese
  countAndReplace(
    /\b(?:uh+|um+|ah+|eh+|er+|erm+|hmm+|hm+|mhm+|mm+|huh+|ha+|hah+|aiyo+|aiya+|ayaya|oh|lah|lor|kan|leh|mah|hor|basically|actually|literally|honestly|obviously|essentially|seriously)\b/gi,
    ' '
  );

  // Clause-start hesitation "so," or standalone "so" (preserves connective "...yogurt, so i buy it sometimes")
  countAndReplace(/(?:^|[.!?]\s*)so,\s+/gi, (m: string) => {
    const punct = m.match(/^[.!?]/)?.[0];
    return punct ? `${punct} ` : '';
  });
  countAndReplace(/(?:^|[.!?]\s*)so(?=\s*(?:[.!?]+(?:\s|$)|$))/gi, (m: string) => {
    const punct = m.match(/^[.!?]/)?.[0];
    return punct ? `${punct} ` : '';
  });

  // Hesitation crutch "i think" (preserves genuine clauses like "i think he prefers vitagen")
  countAndReplace(/,\s*i\s+think(?=\s*(?:[,;.!?]|$))/gi, '');
  countAndReplace(
    /(?:^|[.!?]\s*)i\s+think(?=\s*(?:[,;.!?]|$))/gi,
    (m: string) => {
      const punct = m.match(/^[.!?]/)?.[0];
      return punct ? `${punct} ` : '';
    }
  );
  countAndReplace(/\bi\s+think(?:\s*,\s*|\s+)(?=(?:i|we|my|you)\b)/gi, ' ');

  // Context-aware filler "like" removal:
  // Preserve "like" as verb ("she likes to eat", "i like yogurt") or comparison ("snacks like papaya").
  countAndReplace(/,\s*like\s*,/gi, ', ');
  countAndReplace(
    /,\s*like\s+(?=(?:i|we|they|he|she|it|you|my|our|the|a|an|very|really|so|always|usually|every|sometimes)\b)/gi,
    ', '
  );
  countAndReplace(
    /(?:^|[.!?]\s+)like[\s,]+(?=(?:i|we|they|he|she|it|you|my|our|the|a|an|very|really|so|always|usually|every|sometimes|no|yes)\b)/gi,
    (m: string) => {
      const punct = m.match(/^[.!?]/)?.[0];
      return punct ? `${punct} ` : '';
    }
  );
  countAndReplace(
    /\b(so|and|then|but|because|cause)\s+like\b(?=\s+(?:i|we|they|he|she|it|you|my|our|the|very|really|always|usually|every)\b)/gi,
    '$1'
  );
  countAndReplace(
    /\b(it's|it\s+is|it\s+was|that's|that\s+was|i'm|she's|he's|they're)\s+like\b(?=\s+(?:very|really|so|too|always|never|super|quite|not)\b)/gi,
    '$1'
  );

  return { text: out, count };
};

/**
 * Remove phatic expressions (greetings, farewells, politeness, backchannel acknowledgments across languages).
 */
export const removePhaticExpressions = (text: string): { text: string; count: number } => {
  if (!text) return { text: '', count: 0 };

  let count = 0;
  let out = text;

  const countAndReplace = (re: RegExp, replacement: string | ((m: string, ...args: any[]) => string)) => {
    const matches = out.match(re);
    if (matches) count += matches.length;
    out = out.replace(re, replacement as any);
  };

  // Multi-word phatic expressions (longest first)
  const multiWordPhatic = [
    'terima kasih banyak',
    'thank you very much',
    'thank you so much',
    'thanks very much',
    'thanks a lot',
    'you are welcome',
    "you're welcome",
    'nice to meet you',
    'good to see you',
    'have a nice day',
    'have a good day',
    'sorry to disturb',
    'terima kasih',
    'sama-sama',
    'sama sama',
    'minta maaf',
    'hello miss',
    'hello sir',
    'hello madam',
    'no worries',
    'no problem',
    'thank you',
    'oh okay',
    'oh ok',
    'bye bye',
    'bye-bye',
    'good morning',
    'good afternoon',
    'good evening',
    'good night',
    'excuse me',
    'i understand',
    'i see',
  ];

  for (const phrase of multiWordPhatic) {
    const regex = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
    countAndReplace(regex, ' ');
  }

  // Single-word phatic greetings, farewells, politeness & backchannels (preserve substantive "is/was/feel okay")
  countAndReplace(/\b(?:alright|yeah|yep|yup|yah|ya|thanks|sorry|maaf|goodbye|bye|hello|hi|hey)\b/gi, ' ');
  countAndReplace(
    /(?<!\b(?:is|are|was|were|feel|feels|felt|seem|seems|doing|all|taste|tastes|looks?|still|quite|mostly)\s)\b(?:okay|ok)\b/gi,
    ' '
  );

  // Collapse orphaned commas left before punctuation/end before testing standalone "yes"
  out = out.replace(/,\s*(?=[.!?\n]|$)/g, '');

  // Standalone backchannel "yes" (preserves "yes, only one", "yes, dr. tan suggested...")
  countAndReplace(/(?:^|[.!?]\s*)yes(?=\s*(?:[.!?]+(?:\s|$)|$))/gi, (m: string) => {
    const punct = m.match(/^[.!?]/)?.[0];
    return punct ? `${punct} ` : ' ';
  });

  // Standalone "welcome" or "correct" used as phatic backchannels
  countAndReplace(/(?:^|[.!?,;]\s*)(?:welcome|correct)(?=\s*(?:[.!?,;]|$))/gi, ' ');

  return { text: out, count };
};

/**
 * Aggressively deduplicate repeated consecutive words, hyphenated/comma/period echoes
 * (e.g., "i, i choosing" -> "i choosing", "child. child." -> "child.", "gut, gut health." -> "gut health."),
 * and consecutive repeated short phrases, while leaving decimals (e.g., 2.2) untouched.
 */
export const deduplicateRepeatedText = (text: string): string => {
  if (!text) return '';

  let out = text;

  // 1. Repeated multi-word phrases across spaces or sentence punctuation (e.g., "he likes yogurt. he likes yogurt.")
  let prev = '';
  while (prev !== out) {
    prev = out;
    out = out.replace(
      /\b([a-z0-9']+(?:\s+[a-z0-9']+){1,6})\s*(?:[.,;!]+(?:\s+|$)|\s+)\1(?=[.,;!?\s]|$)/gi,
      '$1'
    );
  }

  // 2. Repeated single alphabetic words across punctuation, commas, or spaces ("boy. boy.", "gut, gut", "i, i")
  out = out.replace(/\b([a-z'][a-z0-9']{0,23})(?:[.,;:\s]+\1\b)+/gi, '$1');

  // 3. Repeated standalone numbers separated by whitespace or comma/period + space (never decimals like 2.2)
  out = out.replace(/\b(\d+)(?:(?:,\s*|\.\s+|\s+)\1\b)+/g, '$1');

  return out;
};

const CANONICAL_PROPER_NAMES: Array<[RegExp, string]> = [
  [/\baeon\s+mall\b/gi, 'AEON Mall'],
  [/\bjaya\s+grocer\b/gi, 'Jaya Grocer'],
  [/\bbrem\s+mall\b/gi, 'Brem Mall'],
  [/\bfarmers\s+union\b/gi, 'Farmers Union'],
  [/\bbio\s+gaia\b/gi, 'Bio Gaia'],
  [/\bvitagen\b/gi, 'Vitagen'],
  [/\byakult\b/gi, 'Yakult'],
  [/\bbiogaya\b/gi, 'Biogaya'],
  [/\bbiogaia\b/gi, 'Biogaia'],
  [/\bamway\b/gi, 'Amway'],
  [/\bnutrilite\b/gi, 'Nutrilite'],
  [/\bpublika\b/gi, 'Publika'],
  [/\blotus's\b/gi, "Lotus's"],
  [/\blotus\b/gi, 'Lotus'],
  [/\bsunglo\b/gi, 'Sunglo'],
  [/\bemmi\b/gi, 'Emmi'],
  [/\bfernleaf\b/gi, 'Fernleaf'],
  [/\bkarihome\b/gi, 'Karihome'],
  [/\bchobani\b/gi, 'Chobani'],
  [/\bmarigold\b/gi, 'Marigold'],
  [/\bmilo\b/gi, 'Milo'],
  [/\bepicode\b/gi, 'Epicode'],
  [/\bblackmores\b/gi, 'Blackmores'],
  [/\bswisse\b/gi, 'Swisse'],
];

const NON_PROPER_MID_WORDS = new Set([
  'I', 'Yes', 'No', 'Not', 'Only', 'So', 'He', 'She', 'They', 'We', 'You', 'It',
  'Ok', 'Okay', 'Hi', 'Hello', 'Thanks', 'Thank', 'Sorry', 'Bye', 'Well', 'Right',
  'Um', 'Uh', 'Ah', 'Eh', 'Oh', 'Er', 'Erm', 'Hmm', 'Mm', 'Mhm', 'Huh', 'Ha', 'Lah', 'Lor', 'Kan',
]);

export const restorePreservedProperNames = (normalizedLowerText: string, originalText?: string): string => {
  if (!normalizedLowerText) return '';
  let out = normalizedLowerText;

  // Capture mid-sentence capitalized proper nouns from originalText before restoring known brands/stores
  const dynamicNames = new Set<string>();
  if (originalText) {
    const midSentenceCapRe = /(?<=[\w,;]\s+)([A-Z][a-zA-Z0-9&'-]{1,24}(?:\s+[A-Z][a-zA-Z0-9&'-]{1,24}){0,2})\b/g;
    let match: RegExpExecArray | null;
    while ((match = midSentenceCapRe.exec(originalText)) !== null) {
      const candidate = match[1].trim();
      const firstToken = candidate.split(/\s+/)[0];
      if (!NON_PROPER_MID_WORDS.has(firstToken) && !/^[A-Z]+$/.test(candidate)) {
        dynamicNames.add(candidate);
      }
    }
  }

  for (const name of Array.from(dynamicNames).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${escapeRegExp(name.toLowerCase())}\\b`, 'g');
    out = out.replace(re, name);
  }

  for (const [pattern, replacement] of CANONICAL_PROPER_NAMES) {
    out = out.replace(pattern, replacement as any);
  }

  return out;
};

/**
 * Collapse repeated consecutive stutters, lowercase, and flatten newlines/spaces to single-spaced text.
 */
export const removeStuttersAndNormalize = (text: string, preserveProperNames = false): string => {
  if (!text) return '';

  let out = text.toLowerCase();

  // Conversational false-start stutter: "no no i i know" -> "i know"
  out = out.replace(
    /(?:^|[.!?,]\s*)no\s+no[\s,]+(?=(?:i\s+(?:i\s+)?(?:know|mean|think|just|have|buy|eat|cook|give|always|usually))\b)/gi,
    (m) => {
      const punct = m.match(/^[.!?,]/)?.[0];
      return punct ? `${punct} ` : '';
    }
  );

  out = deduplicateRepeatedText(out);

  // Clean orphaned punctuation, flatten newlines, and collapse spaces to single-spaced text
  out = out
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s*([,;!?])\s*/g, '$1 ')
    .replace(/(?<!\d)\s*\.(?!\d)\s*/g, '. ')
    .replace(/(?<!\d)\s*:\s*(?!\d)/g, ': ')
    .replace(/,\s*(?=[.!?])/g, '')
    .replace(/([,;:.!?]\s*){2,}/g, (match) => {
      const first = match.trim()[0];
      return first ? `${first} ` : ' ';
    })
    .replace(/\b(e|i)\.\s*(g|e)\./gi, '$1.$2.')
    .replace(/\b(a|p)\.\s*(m)\./gi, '$1.$2.')
    .replace(/\b(u)\.\s*(s|k)\./gi, '$1.$2.')
    .replace(/^[\s,;:.!?]+/, '')
    .replace(/\s+([,;:.!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  out = out.replace(/\s*[,;:]\s*$/g, '').trim();

  const normalized = deduplicateRepeatedText(out).replace(/\s+/g, ' ').trim();
  return preserveProperNames ? restorePreservedProperNames(normalized, text) : normalized;
};

const NON_SPLITTING_ABBREVIATIONS = new Set([
  'dr',
  'mr',
  'mrs',
  'ms',
  'prof',
  'sr',
  'jr',
  'rev',
  'st',
  'vs',
  'etc',
  'approx',
  'fig',
  'dept',
  'est',
  'e.g',
  'i.e',
  'a.m',
  'p.m',
  'u.s',
  'u.k',
]);

const isUrlAt = (text: string, index: number): boolean => {
  let tokenStart = index;
  while (tokenStart > 0 && !/\s/.test(text[tokenStart - 1])) {
    tokenStart--;
  }
  const token = text.slice(tokenStart, index + 24).toLowerCase();
  return /^https?:\/\//.test(token) || /^www\./.test(token);
};

/**
 * Split transcript text into sentences while protecting decimals (e.g. 2.5),
 * ellipses (...), URLs, and common abbreviations (e.g. Dr., e.g., No. 5).
 */
export const splitSentencesSafely = (text: string): string[] => {
  if (!text || typeof text !== 'string') return [];

  const sentences: string[] = [];
  let start = 0;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '.' || ch === '!' || ch === '?' || ch === '。' || ch === '！' || ch === '？') {
      if (isUrlAt(text, i)) {
        i++;
        continue;
      }

      if (ch === '.') {
        const prev = i > 0 ? text[i - 1] : '';
        const next = i + 1 < text.length ? text[i + 1] : '';

        if (/\d/.test(prev) && /\d/.test(next)) {
          i++;
          continue;
        }

        if (prev === '.' || next === '.') {
          while (i < text.length && text[i] === '.') {
            i++;
          }
          continue;
        }

        const beforeSlice = text.slice(start, i);
        const abbrevMatch = beforeSlice.match(/(?:^|[\s(\["'“‘])([a-z]{1,8}(?:\.[a-z]{1,4})*)$/i);
        if (abbrevMatch) {
          const abbrev = abbrevMatch[1].toLowerCase();
          if (NON_SPLITTING_ABBREVIATIONS.has(abbrev)) {
            i++;
            continue;
          }
          if (abbrev === 'no' && /^\s*\d/.test(text.slice(i + 1))) {
            i++;
            continue;
          }
        }
      }

      let endIdx = i;
      while (endIdx + 1 < text.length && /[.!?。！？]/.test(text[endIdx + 1])) {
        endIdx++;
      }

      while (endIdx + 1 < text.length && /["')\]”’]/.test(text[endIdx + 1])) {
        endIdx++;
      }

      const nextAfterEnd = endIdx + 1 < text.length ? text[endIdx + 1] : '';
      const isEndOrSpace = !nextAfterEnd || /\s/.test(nextAfterEnd);
      const terminatorSlice = text.slice(i, endIdx + 1);
      const isTightBoundary =
        (/[?？。！？]/.test(terminatorSlice)) &&
        Boolean(nextAfterEnd) &&
        /[A-Za-z0-9\u00C0-\u024F\u3400-\u9FFF"'(“‘]/.test(nextAfterEnd);

      if (isEndOrSpace || isTightBoundary) {
        const segment = text.slice(start, endIdx + 1).trim();
        if (segment) {
          sentences.push(segment);
        }
        start = endIdx + 1;
        while (start < text.length && /\s/.test(text[start])) {
          start++;
        }
        i = start;
        continue;
      }

      i = endIdx + 1;
      continue;
    }

    i++;
  }

  const tail = text.slice(start).trim();
  if (tail) {
    sentences.push(tail);
  }

  return sentences;
};

export const isQuestionSentence = (sentence: string): boolean => {
  if (!sentence || typeof sentence !== 'string') return false;
  const cleaned = sentence
    .trim()
    .replace(/["')\]”’]+\s*$/g, '')
    .trim();
  if (!cleaned) return false;
  if (/[?？]$/.test(cleaned)) return true;

  // Unpunctuated clear interrogative syntax (Malay/English questions missing '?')
  const withoutTrailingPeriod = cleaned.replace(/[.!]+$/, '').trim();
  if (!withoutTrailingPeriod) return false;
  return (
    /^(?:adakah|apakah|berapakah|bagaimanakah|mengapakah|kenapakah|bilakah|siapakah|di\s+manakah)\b/i.test(
      withoutTrailingPeriod
    ) ||
    /\bberapa\s+(?:tahun|umur|kali|banyak|lama)\b/i.test(withoutTrailingPeriod) ||
    /\b(?:boy\s+or\s+girl|lelaki\s+atau\s+perempuan|ada\s+(?:tak|produk\s+yang\s+lain))\s*$/i.test(
      withoutTrailingPeriod
    ) ||
    /^(?:apa|mana|siapa|bila|kenapa)$/i.test(withoutTrailingPeriod) ||
    /^(?:do|does|did|are|is|was|were|have|has|had|can|could|will|would|should|may)\s+(?:you|your|he|she|they|it|there|anyone)\b/i.test(
      withoutTrailingPeriod
    ) ||
    /^(?:how\s+(?:old|often|many|much|long|do|does|did|are|is)|what\s+(?:brand|product|products|food|foods|drink|drinks|kind|type|do|does|did|are|is)|which\s+(?:brand|product|one|do|does|did)|why\s+(?:do|does|did|are|is)|where\s+(?:do|does|did|are))\b/i.test(
      withoutTrailingPeriod
    )
  );
};

const isLikelyUnlabelledInterviewerSentence = (sentence: string): boolean => {
  if (!sentence || typeof sentence !== 'string') return false;
  const cleaned = sentence.trim();
  if (!cleaned) return false;
  return (
    /\b(?:food|nutrition|research|market\s+research)\s*(?:company|team|agency)\b/i.test(cleaned) ||
    /\b(?:kami\s+buat|we\s+make|we\s+are\s+making|we\s+are\s+doing|we're\s+doing|we\s+are\s+researching|i\s+am\s+researching|researching)\b/i.test(
      cleaned
    ) ||
    /\b(?:adakah\s+anda\s+tahu|do\s+you\s+know\s+what\s+(?:is\s+)?gut\s+health|what\s+(?:is|itu)\s+gut\s+health)\b/i.test(
      cleaned
    ) ||
    /\bgut\s+health\s+(?:is\s+about|means|refers\s+to|study|survey|research)\b/i.test(cleaned)
  );
};

/**
 * Strip every interrogative sentence (?/？ or clear unpunctuated question phrasing)
 * and unlabelled interviewer study-introduction lines anywhere in text.
 */
export const stripQuestionSentences = (
  text: string,
  includeInterviewerIntros = true
): string => {
  if (!text || typeof text !== 'string') return '';
  const sentences = splitSentencesSafely(text);
  const kept = sentences.filter(
    (sentence) =>
      !isQuestionSentence(sentence) &&
      (!includeInterviewerIntros || !isLikelyUnlabelledInterviewerSentence(sentence))
  );
  return kept.join(' ').replace(/\s+/g, ' ').trim();
};

interface SpeakerTurn {
  role: 'interviewer' | 'interviewee' | 'unknown';
  text: string;
}

const isStandaloneQuestionLine = (line: string): boolean => {
  const withoutTags = stripNoiseAndArtifacts(line)
    .text.replace(/["')\]”’]+\s*$/g, '')
    .trim();
  if (!withoutTags) return false;
  return isQuestionSentence(withoutTags);
};

const parseSpeakerTurns = (rawText: string): SpeakerTurn[] => {
  const normalizedLines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\|\s*/g, '\n')
    .replace(
      new RegExp(
        `(?<!\\n)\\s+(?=(?:\\[|\\(|\\*{1,3})?${ANY_SPEAKER_LABEL_PATTERN}(?:\\s*#?\\d+)?(?:\\s*:)?(?:\\]|\\)|\\*{1,3})?\\s*:)`,
        'gi'
      ),
      '\n'
    );

  const lines = normalizedLines.split('\n');
  const turns: SpeakerTurn[] = [];

  const interviewerStartRe = new RegExp(
    `^\\s*(?:\\[|\\(|\\*{1,3})?${INTERVIEWER_LABEL_PATTERN}(?:\\s*#?\\d+)?(?:\\s*:)?(?:\\]|\\)|\\*{1,3})?(?:\\s*:|\\s+[-–])\\s*(.*)$`,
    'i'
  );
  const intervieweeStartRe = new RegExp(
    `^\\s*(?:\\[|\\(|\\*{1,3})?${INTERVIEWEE_LABEL_PATTERN}(?:\\s*#?\\d+)?(?:\\s*:)?(?:\\]|\\)|\\*{1,3})?(?:\\s*:|\\s+[-–])\\s*(.*)$`,
    'i'
  );

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Strip leading timestamp so "[00:05] Interviewer: ..." parses cleanly as a speaker turn
    const lineWithoutLeadingTimestamp = line
      .replace(/^[\[(]\s*\d{1,2}:\d{2}(?::\d{2})?\s*[\])]\s*/i, '')
      .trim();
    if (!lineWithoutLeadingTimestamp) continue;

    const intMatch = interviewerStartRe.exec(lineWithoutLeadingTimestamp);
    if (intMatch) {
      turns.push({ role: 'interviewer', text: line });
      continue;
    }

    const partMatch = intervieweeStartRe.exec(lineWithoutLeadingTimestamp);
    if (partMatch) {
      turns.push({ role: 'interviewee', text: line });
      continue;
    }

    const lineIsQuestion = isStandaloneQuestionLine(lineWithoutLeadingTimestamp);

    if (turns.length > 0) {
      const prev = turns[turns.length - 1];
      if (prev.role === 'interviewer') {
        prev.text = `${prev.text} ${line}`.trim();
      } else if (prev.role === 'interviewee') {
        if (lineIsQuestion) {
          turns.push({ role: 'unknown', text: line });
        } else {
          prev.text = `${prev.text} ${line}`.trim();
        }
      } else {
        // prev.role === 'unknown'
        if (lineIsQuestion || isStandaloneQuestionLine(prev.text)) {
          turns.push({ role: 'unknown', text: line });
        } else {
          prev.text = `${prev.text} ${line}`.trim();
        }
      }
    } else {
      turns.push({ role: 'unknown', text: line });
    }
  }

  return turns;
};

const applyTurnFilters = (
  text: string,
  options: TranscriptCleaningOptions,
  stripHeaders: boolean,
  mode: 'deterministic' | 'post_ai'
): {
  text: string;
  removedFillersCount: number;
  removedPhaticCount: number;
  removedNoiseTagsCount: number;
} => {
  let out = text;
  let removedNoiseTagsCount = 0;
  let removedPhaticCount = 0;
  let removedFillersCount = 0;

  if (stripHeaders) {
    out = stripSpeakerHeaders(out);
  }

  if (options.removeNoise) {
    const noiseRes = stripNoiseAndArtifacts(out);
    out = noiseRes.text;
    removedNoiseTagsCount += noiseRes.count;
  }

  // Quick Clean always strips every sentence ending with '?' or '？' before translation/filler passes
  if (mode === 'deterministic') {
    out = stripQuestionSentences(out);
    if (!out) {
      return {
        text: '',
        removedFillersCount,
        removedPhaticCount,
        removedNoiseTagsCount,
      };
    }
  }

  if (options.translateToEnglish !== false) {
    out = applyTranslationRules(out);
  } else {
    out = out.replace(/\btak\s+adalah\b/gi, 'tak ada');
  }

  if (options.removePhatic) {
    const phaticRes = removePhaticExpressions(out);
    out = phaticRes.text;
    removedPhaticCount += phaticRes.count;
  }

  if (options.removeFillers) {
    const fillerRes = removeFillersPreservingMeaning(out);
    out = fillerRes.text;
    removedFillersCount += fillerRes.count;
  }

  out = removeStuttersAndNormalize(out);

  if (mode === 'deterministic' && /[?？]/.test(out)) {
    out = stripQuestionSentences(out);
    out = removeStuttersAndNormalize(out);
  }

  return {
    text: out,
    removedFillersCount,
    removedPhaticCount,
    removedNoiseTagsCount,
  };
};

/**
 * Clean an interview transcript according to all 5 rules:
 * 1. Preserves core meaning & standard stopwords (negations, pronouns, prepositions, verbs).
 * 2. Strictly filters out all interviewer turns, standalone unlabelled question lines, and (in Quick Clean) any sentence ending in '?'.
 * 3. Removes fillers, phatic expressions, noise tags, timestamps, and stutters.
 * 4. Removes all speaker headers regardless of formatting.
 * 5. Converts to lowercase single-spaced text.
 */
export const cleanInterviewTranscript = (
  input: string,
  options?: Partial<TranscriptCleaningOptions>,
  mode: 'deterministic' | 'post_ai' = 'deterministic'
): CleanTranscriptResult => {
  if (!input || typeof input !== 'string') {
    return {
      cleanedText: '',
      preservedPronounsCount: 0,
      stats: {
        removedInterviewerTurns: 0,
        removedFillersCount: 0,
        removedPhaticCount: 0,
        removedNoiseTagsCount: 0,
      },
    };
  }

  const opts: TranscriptCleaningOptions = {
    ...DEFAULT_CLEANING_OPTIONS,
    ...(options || {}),
  };

  const stats: TranscriptCleaningStats = {
    removedInterviewerTurns: 0,
    removedFillersCount: 0,
    removedPhaticCount: 0,
    removedNoiseTagsCount: 0,
  };

  const turns = parseSpeakerTurns(input);
  const cleanedSegments: string[] = [];

  const isInterviewerUnlabelledTurn = (turn: SpeakerTurn) =>
    turn.role === 'interviewer' ||
    (turn.role === 'unknown' &&
      (isStandaloneQuestionLine(turn.text) || isLikelyUnlabelledInterviewerSentence(turn.text)));

  for (const turn of turns) {
    if (isInterviewerUnlabelledTurn(turn) && opts.removeInterviewer) {
      stats.removedInterviewerTurns += 1;
      if (opts.removeNoise) {
        stats.removedNoiseTagsCount += stripNoiseAndArtifacts(turn.text).count;
      }
      continue;
    }

    const filtered = applyTurnFilters(turn.text, opts, true, mode);
    stats.removedFillersCount += filtered.removedFillersCount;
    stats.removedPhaticCount += filtered.removedPhaticCount;
    stats.removedNoiseTagsCount += filtered.removedNoiseTagsCount;

    if (filtered.text) {
      cleanedSegments.push(filtered.text);
    }
  }

  const joined = cleanedSegments
    .reduce((acc, seg) => {
      if (!acc) return seg;
      return /[.!?。！？]$/.test(acc) ? `${acc} ${seg}` : `${acc}. ${seg}`;
    }, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Cross-turn deduplication so echoed fragments across speaker/line breaks ("child. child.", "boy. boy.") collapse
  const cleanedText = deduplicateRepeatedText(joined).replace(/\s+/g, ' ').trim();

  return {
    cleanedText,
    preservedPronounsCount: countPreservedPronouns(cleanedText),
    stats,
  };
};

const EXPLICIT_SPEAKER_HEADER_RE = new RegExp(
  `(?:\\[|\\(|\\*{1,3})\\s*${ANY_SPEAKER_LABEL_PATTERN}(?:\\s*#?\\d+)?\\s*:?\\s*(?:\\]|\\)|\\*{1,3})\\s*:?`,
  'gi'
);
const COLON_SPEAKER_HEADER_RE = new RegExp(
  `(?:^|[\\n|]|(?<=\\s))${ANY_SPEAKER_LABEL_PATTERN}(?:\\s*#?\\d+)?\\s*:`,
  'gim'
);

const NON_QUESTION_INTERVIEWER_PITCH_RE =
  /\b(?:(?:food|nutrition|research|market\s+research)\s*(?:company|team|agency)|(?:kami\s+buat|we\s+make|we\s+are\s+making|we\s+are\s+doing|we're\s+doing|we\s+are\s+researching|i\s+am\s+researching|researching)\s+(?:yang\s+|a\s+)?(?:gut\s+health|probiotic|nutrition|research|study|survey)|gut\s+health\s+(?:is\s+about|means|refers\s+to))\b/i;

/**
 * Post-AI sanitizer for the unified Clean Text pipeline:
 * - Enforces question-free interviewee output when removeInterviewer !== false
 * - Strips stray speaker headers, noise/timestamps, phatics (incl. "i understand"), and fillers/discourse crutches
 * - Preserves standard stopwords (not, no, only, sometimes, he, i, connective "so") and verb "likes"
 * - Restores/preserves proper-name casing for brands, stores, and personal names (Vitagen, Yakult, AEON Mall, etc.)
 * - Collapses echoed words/phrases and formats clean single-spaced lowercase prose
 */
export const sanitizeAiCleanedTranscript = (
  aiOutput: string,
  options?: Partial<TranscriptCleaningOptions>
): CleanTranscriptResult => {
  if (!aiOutput || typeof aiOutput !== 'string') {
    return {
      cleanedText: '',
      preservedPronounsCount: 0,
      stats: {
        removedInterviewerTurns: 0,
        removedFillersCount: 0,
        removedPhaticCount: 0,
        removedNoiseTagsCount: 0,
      },
    };
  }

  const opts: TranscriptCleaningOptions = {
    ...DEFAULT_CLEANING_OPTIONS,
    ...(options || {}),
  };

  let out = aiOutput.replace(EXPLICIT_SPEAKER_HEADER_RE, ' ').replace(COLON_SPEAKER_HEADER_RE, ' ');
  let removedNoiseTagsCount = 0;
  let removedPhaticCount = 0;
  let removedFillersCount = 0;
  let removedInterviewerTurns = 0;

  if (opts.removeNoise) {
    const noiseRes = stripNoiseAndArtifacts(out);
    out = noiseRes.text;
    removedNoiseTagsCount += noiseRes.count;
  }

  out = out.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (opts.removeInterviewer) {
    const sentences = splitSentencesSafely(out);
    const filtered: string[] = [];
    for (const s of sentences) {
      if (isQuestionSentence(s) || NON_QUESTION_INTERVIEWER_PITCH_RE.test(s)) {
        removedInterviewerTurns += 1;
        continue;
      }
      filtered.push(s);
    }
    out = filtered.join(' ');
  }

  if (opts.removePhatic) {
    const phaticMulti = [
      'terima kasih banyak',
      'thank you very much',
      'thank you so much',
      'thanks very much',
      'thanks a lot',
      'you are welcome',
      "you're welcome",
      'nice to meet you',
      'good to see you',
      'have a nice day',
      'have a good day',
      'sorry to disturb',
      'terima kasih',
      'sama-sama',
      'sama sama',
      'minta maaf',
      'hello miss',
      'hello sir',
      'hello madam',
      'no worries',
      'no problem',
      'i understand',
      'i see',
      'thank you',
      'oh okay',
      'oh ok',
      'bye bye',
      'bye-bye',
      'good morning',
      'good afternoon',
      'good evening',
      'good night',
      'excuse me',
    ];
    for (const phrase of phaticMulti) {
      const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
      const m = out.match(re);
      if (m) removedPhaticCount += m.length;
      out = out.replace(re, ' ');
    }
    const singlePhaticRe = /\b(?:alright|yeah|yep|yup|yah|ya|thanks|sorry|maaf|goodbye|bye|hello|hi|hey)\b/gi;
    const singleMatches = out.match(singlePhaticRe);
    if (singleMatches) removedPhaticCount += singleMatches.length;
    out = out.replace(singlePhaticRe, ' ');

    const standaloneOkRe =
      /(?<!\b(?:is|are|was|were|feel|feels|felt|seem|seems|doing|all|taste|tastes|looks?|still|quite|mostly)\s)\b(?:okay|ok)\b/gi;
    const okMatches = out.match(standaloneOkRe);
    if (okMatches) removedPhaticCount += okMatches.length;
    out = out.replace(standaloneOkRe, ' ');
  }

  if (opts.removeFillers) {
    const multiFillerRe =
      /(?<!\b(?:do|don't|did|didn't|would|could|should|can|will|if|what|who|as|let|we|all)\s)\byou\s+know\b(?!\s+(?:what|who|where|when|why|how|if|whether|that|about|which|any|anything|anyone|gut)\b)|\b(?:mm[\s-]*hmm?|uh[\s-]+huh)\b/gi;
    const mMulti = out.match(multiFillerRe);
    if (mMulti) removedFillersCount += mMulti.length;
    out = out.replace(multiFillerRe, ' ');

    const hesitationRe =
      /\b(?:uh+|um+|ah+|eh+|er+|erm+|hmm+|hm+|mhm+|mm+|huh+|ha+|hah+|aiyo+|aiya+|ayaya|oh|lah|lor|kan|leh|mah|hor|actually|basically|literally|honestly|obviously|essentially|seriously)\b/gi;
    const mHes = out.match(hesitationRe);
    if (mHes) removedFillersCount += mHes.length;
    out = out.replace(hesitationRe, ' ');

    // Attention starters & clause-initial discourse markers (preserve connective "so", substantive "now", "well", "right", "just", "really")
    const starterDiscourseRe =
      /(?:^|[.!?]\s*)(?:anyway|look|listen|well|right|now)(?:,\s+|\s+(?=(?:i|he|she|they|we|you|my|this|that|there|it)\b))/gi;
    out = out.replace(starterDiscourseRe, (m: string) => {
      const punct = m.match(/^[.!?]/)?.[0];
      return punct ? `${punct} ` : '';
    });

    // Filler adverb qualifiers preceded/followed by commas ("he, totally, eats yogurt" / "just, buy yogurt")
    const commaQualifierRe = /,\s*(?:totally|really|just)\s*,|(?:^|[.!?]\s*)(?:totally|really|just),\s+/gi;
    out = out.replace(commaQualifierRe, (m: string) => {
      const punct = m.match(/^[.!?]/)?.[0];
      if (punct) return `${punct} `;
      return m.startsWith(',') ? ', ' : '';
    });

    // Filler "like" (preserve verb "likes", "like yogurt", comparison "like papaya")
    out = out.replace(/,\s*like\s*,/gi, ', ');
    out = out.replace(
      /,\s*like\s+(?=(?:i|we|they|he|she|it|you|my|our|the|a|an|very|really|so|always|usually|every|sometimes)\b)/gi,
      ', '
    );
    out = out.replace(
      /(?:^|[.!?]\s+)like[\s,]+(?=(?:i|we|they|he|she|it|you|my|our|the|a|an|very|really|so|always|usually|every|sometimes|no|yes)\b)/gi,
      (m: string) => {
        const punct = m.match(/^[.!?]/)?.[0];
        return punct ? `${punct} ` : '';
      }
    );

    // Hesitation crutch "i think" only when stuttering into another first/second-person pronoun
    const crutchRe = /\bi\s+think(?:\s*,\s*|\s+)(?=(?:i|we|my|you)\b)/gi;
    const mCrutch = out.match(crutchRe);
    if (mCrutch) removedFillersCount += mCrutch.length;
    out = out.replace(crutchRe, ' ');
  }

  const cleanedText = removeStuttersAndNormalize(out, true);

  return {
    cleanedText,
    preservedPronounsCount: countPreservedPronouns(cleanedText),
    stats: {
      removedInterviewerTurns,
      removedFillersCount,
      removedPhaticCount,
      removedNoiseTagsCount,
    },
  };
};

/**
 * 100% deterministic offline Quick Clean utility.
 */
export const quickCleanLocal = (
  input: string,
  options?: Partial<TranscriptCleaningOptions>
): CleanTranscriptResult => {
  return cleanInterviewTranscript(input, options, 'deterministic');
};

/**
 * Unified Clean Text service caller invoking the server-side Gemini cleaning endpoint.
 */
export const cleanTranscriptWithPipeline = async (
  params: {
    rawText: string;
    fileName?: string;
    options?: Partial<TranscriptCleaningOptions>;
  },
  postJson: <T = any>(url: string, payload: any) => Promise<T>
): Promise<{
  cleanedText: string;
  rawWordCount: number;
  cleanedWordCount: number;
  removedWordsCount: number;
  preservedPronounsCount: number;
  cleaningStats?: TranscriptCleaningStats;
  cleanedAt?: string;
}> => {
  return postJson('/api/clean-data', {
    rawText: params.rawText,
    fileName: params.fileName || 'Transcript',
    options: params.options || DEFAULT_CLEANING_OPTIONS,
  });
};

export const translateTranscriptToEnglish = async (
  params: {
    rawText: string;
    fileName?: string;
  },
  postJson: <T = any>(url: string, payload: any) => Promise<T>
): Promise<{
  translatedText: string;
  wordCount: number;
  preservedPronounsCount: number;
  translatedAt?: string;
}> => {
  return postJson('/api/translate-english', {
    text: params.rawText,
    fileName: params.fileName || 'Transcript',
  });
};

export const aiCleanTranscript = cleanTranscriptWithPipeline;

/**
 * Backward-compatible helper returning the cleaned lowercase single-spaced string.
 */
export const canonicalizeInterviewText = (input: string): string => {
  return quickCleanLocal(input, DEFAULT_CLEANING_OPTIONS).cleanedText;
};

