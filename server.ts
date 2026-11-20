import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  cleanInterviewTranscript,
  countPreservedPronouns,
  countWords,
  DEFAULT_CLEANING_OPTIONS,
  removeStuttersAndNormalize,
  sanitizeAiCleanedTranscript,
  stripQuestionSentences,
  stripSpeakerHeaders,
} from './src/lib/textCleaning';
import {
  ADKOTM_PARAMETER_CATALOG,
  enforceStrictGrounding,
  isHumanVerifiedRecord,
  proposeTaxonomyNormalizations,
  scanMissedSignals,
  stripRecordingExtension,
  syncFlatDecodeFromFieldStates,
  verifyEvidenceQuote,
} from './src/lib/adkotmCopilot';
import {
  computeDecodeDiffs,
  findFieldMeta,
  findUncoveredSentences,
} from './src/lib/adkotmUtils';

dotenv.config();

const app = express();
// Port 3000 required by AI Studio runtime (accept CLI argument or fallback)
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? parseInt(process.argv[portArgIndex + 1], 10) : null;
const PORT = cliPort || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]:', reason);
});

// Enable JSON body parser with 50MB limit for audio base64 uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Google GenAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    keyPrefix: process.env.GEMINI_API_KEY
      ? process.env.GEMINI_API_KEY.substring(0, 6) + '...' + process.env.GEMINI_API_KEY.slice(-4)
      : 'none',
    timestamp: new Date().toISOString(),
  });
});

// Track temporary 429 rate-limit cooldowns per model (e.g., gemini-3.5-transcribe Free Tier 3 RPM / 10k TPM cap)
const modelCooldownUntil: Record<string, number> = {};

function parseRetryDelayMs(err: any): number {
  const msg = String(err?.message || err || '');
  const retryMatch = msg.match(/Please retry in ([\d.]+)s/i) || msg.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (retryMatch) {
    const secs = parseFloat(retryMatch[1]);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.min(Math.ceil(secs * 1000) + 1000, 90000);
    }
  }
  return 45000;
}

/**
 * Transcribe audio using gemini-3.5-transcribe (primary) with gemini-4-hydrogen / gemini-3.1-flash-lite fallbacks
 */
app.post('/api/transcribe/audio', async (req: Request, res: Response) => {
  req.setTimeout(120000);
  res.setTimeout(120000);

  try {
    const { audioBase64, mimeType = 'audio/mp3', fileName = 'audio' } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Missing audioBase64 data in request' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel.',
      });
    }

    // Clean and normalize base64
    const cleanBase64 = (audioBase64.includes('base64,')
      ? audioBase64.split('base64,')[1]
      : audioBase64
    ).trim().replace(/\s+/g, '');

    const lowerName = (fileName || '').toLowerCase();
    let normalizedMime = 'audio/mp3';

    if (lowerName.endsWith('.m4a') || (mimeType && (mimeType.includes('m4a') || mimeType.includes('mp4')))) {
      normalizedMime = 'audio/mp4';
    } else if (lowerName.endsWith('.wav') || (mimeType && mimeType.includes('wav'))) {
      normalizedMime = 'audio/wav';
    } else if (lowerName.endsWith('.webm') || (mimeType && mimeType.includes('webm'))) {
      normalizedMime = 'audio/webm';
    } else if (lowerName.endsWith('.aac') || (mimeType && mimeType.includes('aac'))) {
      normalizedMime = 'audio/aac';
    } else if (lowerName.endsWith('.ogg') || (mimeType && mimeType.includes('ogg'))) {
      normalizedMime = 'audio/ogg';
    } else if (lowerName.endsWith('.flac') || (mimeType && mimeType.includes('flac'))) {
      normalizedMime = 'audio/flac';
    } else if (mimeType && mimeType.startsWith('audio/')) {
      normalizedMime = mimeType;
    }

    const approxKb = Math.round((cleanBase64.length * 0.75) / 1024);
    console.log(`[Audio Transcribe] Processing "${fileName}", mime: ${normalizedMime}, size: ${approxKb} KB`);

    const MULTILINGUAL_PROMPT = `Transcribe this interview audio recording verbatim.
The recording takes place in an everyday Southeast Asian setting (shopping mall, store, restaurant, or household in Malaysia/Singapore) where participants may code-switch between English, Bahasa Melayu, and Chinese (Mandarin/Cantonese/Hokkien).

Format rules:
- Retain exact words spoken in each language without translating or inventing unstated speech.
- Mark speaker turns clearly (e.g. Interviewer:, Participant:, Parent:, Subject:).
- Include approximate timestamps (e.g. [00:05], [00:25]) where audible.
- If the recording contains only silence or unintelligible background noise with no audible speech, output exactly: [No audible speech detected]`;

    const isEmptyTranscript = (text: string): boolean => !text || text.trim().length < 4;

    const isNoSpeechMarker = (text: string): boolean => {
      const lower = text.trim().toLowerCase();
      return (
        lower.includes('no audible speech detected') ||
        lower.includes('no speech detected') ||
        lower.startsWith('[no speech') ||
        lower.startsWith('(no speech')
      );
    };

    const audioPart = {
      inlineData: {
        mimeType: normalizedMime,
        data: cleanBase64,
      },
    };

    const attempts: { model: string; timeoutMs: number; config?: Record<string, any> }[] = [
      { model: 'gemini-3.5-transcribe', timeoutMs: 50000 },
      {
        model: 'gemini-4-hydrogen',
        timeoutMs: 45000,
        config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
      },
      {
        model: 'gemini-3.1-flash-lite',
        timeoutMs: 40000,
        config: { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
      },
    ];

    const now = Date.now();
    const activeAttempts = attempts.filter((a) => (modelCooldownUntil[a.model] || 0) <= now);
    const orderedAttempts = activeAttempts.length > 0 ? activeAttempts : attempts;

    let transcript = '';
    let noSpeechDetected = false;
    let lastError: any = null;
    let sawRateLimit = false;

    for (const attempt of orderedAttempts) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        console.log(`[Audio Transcribe] Attempting ${attempt.model} for ${fileName} (${normalizedMime})...`);
        const reqPromise = ai.models.generateContent({
          model: attempt.model,
          contents: {
            parts: [audioPart, { text: MULTILINGUAL_PROMPT }],
          },
          ...(attempt.config ? { config: attempt.config } : {}),
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${attempt.model} timed out after ${Math.round(attempt.timeoutMs / 1000)}s`)),
            attempt.timeoutMs
          );
        });

        const resObj: any = await Promise.race([reqPromise, timeoutPromise]);
        if (timer) clearTimeout(timer);

        const extracted = (
          resObj?.text ||
          resObj?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n') ||
          ''
        ).trim();

        if (isNoSpeechMarker(extracted)) {
          noSpeechDetected = true;
          transcript = '[No audible speech detected]';
          console.log(`[Audio Transcribe] ${attempt.model} reported no audible speech for ${fileName}`);
          break;
        }

        if (!isEmptyTranscript(extracted)) {
          transcript = extracted;
          console.log(`[Audio Transcribe] ${attempt.model} succeeded for ${fileName} (${transcript.length} chars)`);
          break;
        }

        lastError = new Error(`${attempt.model} returned an empty transcript`);
      } catch (err: any) {
        if (timer) clearTimeout(timer);
        lastError = err;
        const status = err?.status;
        const msg = String(err?.message || err || '');
        const isRateLimit = status === 429 || /RESOURCE_EXHAUSTED|quota|rate[- ]?limit/i.test(msg);

        if (isRateLimit) {
          sawRateLimit = true;
          const cooldownMs = parseRetryDelayMs(err);
          modelCooldownUntil[attempt.model] = Date.now() + cooldownMs;
          console.log(
            `[Audio Transcribe] ${attempt.model} reached rate limit for ${fileName}; routing to next model for ${Math.round(cooldownMs / 1000)}s`
          );
          continue;
        }

        console.log(`[Audio Transcribe] ${attempt.model} fallback for ${fileName}: ${msg.slice(0, 160)}`);
        // Do not retry other models on auth/invalid-key errors
        if (status === 400 || status === 401 || status === 403) {
          break;
        }
      }
    }

    if (!transcript && !noSpeechDetected) {
      const msg = lastError?.message || 'Failed to transcribe audio recording';
      const isTimeout = /timed out|timeout/i.test(msg);
      if (sawRateLimit && lastError?.status === 429) {
        return res.status(429).json({
          error:
            'Audio transcription hit the Free Tier rate limit across available models. Please wait ~30–60s and retry, or select a paid API key in Settings > Secrets for higher quota.',
        });
      }
      return res.status(lastError?.status || (isTimeout ? 504 : 502)).json({
        error: `${msg}. Please retry this recording.`,
      });
    }

    return res.json({
      success: true,
      transcript,
      fileName,
      mimeType: normalizedMime,
      transcribedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Audio Transcribe] Unexpected route error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to transcribe audio file',
      details: error.toString(),
    });
  }
});

// Sticky runtime flag: once gemini-2.5-flash returns 404 NOT_FOUND in this environment,
// route subsequent AI Clean calls straight to active low-latency Flash without extra 404 latency.
let preferFallbackFlashCleanModel = false;

/**
 * MODULE 2: Faithful Multilingual Translation & Conditional Q&A Cleaning via Gemini
 * Targets gemini-2.5-flash with automatic sticky fallback to active fast Flash (gemini-3.1-flash-lite).
 * Translates Malay, Mandarin, Cantonese, and Manglish faithfully while keeping original sentence structure,
 * drops redundant interviewer questions on self-contained answers (Case A), preserves essential
 * "question? answer." pairs when short answers lack context (Case B), and strips headers, chatter,
 * echoes, fillers, phatics, and noise.
 */
app.post('/api/clean-data', async (req: Request, res: Response) => {
  try {
    const { rawText, quickText, fileName = 'Transcript', options } = req.body;

    if ((!rawText || typeof rawText !== 'string') && (!quickText || typeof quickText !== 'string')) {
      return res.status(400).json({ error: 'Missing rawText or quickText to clean' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel.',
      });
    }

    const cleaningOptions = {
      ...DEFAULT_CLEANING_OPTIONS,
      ...(options && typeof options === 'object' ? options : {}),
    };

    const rawSource = typeof rawText === 'string' && rawText.trim() ? rawText.trim() : String(quickText || '').trim();
    const baseline = cleanInterviewTranscript(rawSource, cleaningOptions, 'deterministic');
    const rawWordCount = countWords(rawSource);

    if (!rawSource) {
      return res.json({
        success: true,
        fileName,
        cleanedText: '',
        rawWordCount,
        cleanedWordCount: 0,
        removedWordsCount: rawWordCount,
        preservedPronounsCount: 0,
        cleaningStats: baseline.stats,
        reductionPercent: rawWordCount > 0 ? 100 : 0,
        cleanedAt: new Date().toISOString(),
      });
    }

    const languageRule =
      cleaningOptions.translateToEnglish !== false
        ? `1. TRANSLATE ALL TO ENGLISH & PRESERVE BRAND / PROPER NAMES:
   - Translate all Malay, Mandarin, Cantonese, Tamil, or mixed code-switched (Manglish) speech into literal, natural English while keeping the participant's original sentence structure intact.
   - NEVER summarize, paraphrase away nuance, or combine separate answers together.
   - KEEP BRAND & PROPER NAMES ORIGINAL: Never translate or alter brand names, product names, store names, or personal names (e.g. Vitagen, Yakult, Biogaya, Bio Gaia, Amway, Nutrilite, AEON Mall, Jaya Grocer, Lotus, Publika, Brem Mall, Sunglo, Emmi, Fernleaf, Karihome, Chobani, Marigold, Milo). Keep their exact proper-name capitalization.`
        : `1. KEEP ORIGINAL LANGUAGES & PROPER NAMES INTACT:
   - Keep Malay, Mandarin, Cantonese, and Manglish words intact along with brand/store/person names without translating or summarizing.`;

    const speakerRule =
      cleaningOptions.removeInterviewer !== false
        ? `2. REMOVE ALL INTERVIEWER SPEECH, HEADERS & QUESTIONS (KEEP SHORT REPLIES VERBATIM):
   - Strip ALL speaker labels (Interviewer:, Parent:, Participant:, Speaker:, [Interviewer]:, etc.).
   - Detect and completely remove every sentence or turn spoken by the interviewer—even when no speaker labels exist—including study introductions ("from food company", "researching gut health", "now we make gut health"), prompts, and confirmation echoes ("10?", "boy?").
   - DELETE EVERY QUESTION: Remove every interrogative sentence or clarification question (anything ending in '?' or phrased as a question).
   - KEEP SHORT REPLIES VERBATIM: Do NOT invent or merge question context back into short participant replies like "10.", "boy.", or "do not have.". Keep them verbatim in literal English.`
        : `2. STRIP SPEAKER LABELS ONLY:
   - Strip speaker labels while retaining non-label turns and formatting cleanly.`;

    const fillerRule =
      cleaningOptions.removeFillers !== false
        ? `5. REMOVE FILLERS & DISCOURSE CRUTCHES:
   - Strip English & local hesitations/particles: um, uh, er, erm, ah, eh, huh, hmm, mm, mhm, ha, hah, lah, lor, kan, aiyo, ayaya, oh.
   - Strip discourse fillers: "like" (ONLY when used as a filler—KEEP when used as a verb such as "he likes yogurt" or "i like yogurt"), standalone/starter "so" (KEEP connective "so" inside sentences such as "he only likes yogurt, so buy it sometimes"), filler "well", "right", "okay", "yeah".
   - Strip attention starters: "anyway", "now", "look", "listen" when used as discourse starters.
   - Strip filler adverbs/qualifiers: "actually", "basically", "literally", "honestly", "obviously", "essentially", "seriously", and filler uses of "totally", "really", "just".`
        : '5. Keep conversational fillers unless exact consecutive stutters.';

    const phaticRule =
      cleaningOptions.removePhatic !== false
        ? `6. REMOVE ALL PHATICS:
   - Strip all greetings, farewells, politeness rituals, and social acknowledgments across languages: hello, hello miss, hi, thank you, thanks, terima kasih, sorry, maaf, alright, bye, bye bye, you're welcome, no worries, i understand.`
        : '6. Keep greetings and politeness expressions unless purely duplicated.';

    const noiseRule =
      cleaningOptions.removeNoise !== false
        ? `3. REMOVE NOISE & DUPLICATES:
   - Strip timestamps ([00:00]), non-verbal tags ([Laughter], [笑声], *indecipherable*, --), extra punctuation, and consecutive repeated words or echoed phrases ("child. child." -> "child.", "do not have. do not have." -> "do not have.", "Vitagen. Vitagen." -> "Vitagen.").`
        : '3. Collapse consecutive repeated words/phrases and extra whitespace.';

    const buildCleanPrompt = (chunkText: string) => `You are an expert qualitative research transcript cleaner and literal multilingual translator (Malay, Mandarin, Cantonese, Manglish, English).

TASK:
Transform the RAW INTERVIEW TRANSCRIPT below in one pass using the exact 6-step pipeline. Do NOT summarize or merge separate answers.

STRICT 6-STEP PIPELINE:
${languageRule}

${speakerRule}

${noiseRule}

4. REMOVE ALL QUESTIONS:
   - Delete every question or clarification question (? or interrogative phrasing). Never leave any question mark (?) in output${cleaningOptions.removeInterviewer === false ? ' unless interviewer questions are explicitly retained' : ''}.

${fillerRule}

${phaticRule}

OUTPUT FORMATTING:
- Format general prose in lowercase, single-spaced, with clean sentence boundaries (".").
- Preserve original proper-name casing for brands, products, stores, and personal names (e.g. Vitagen, Yakult, Biogaya, Amway, AEON Mall, Jaya Grocer, Lotus, Publika, Brem Mall).
- Preserve all standard stopwords ("not", "no", "only", "sometimes", "he", "i", connective "so") so exact meaning stays intact.
- Output ONLY the final cleaned transcript text — zero commentary, no labels, no bullet points, no markdown fences.

TARGET EXAMPLE:
Raw snippet:
[00:00] Hello miss, because I am from food company, now we are researching gut health. Adik, anak, I, I think I, I choosing yogurt lah, so I like yogurt. Berapa tahun anak? 10. 10? Ya, sudah besar. Dia ialah boy or girl? Boy. Boy. Dia selalu beli Vitagen dan Yakult dekat AEON Mall. Tak ada. Tak adalah. Basically he only likes yogurt, so kadang-kadang beli. Look, hanya makan sayur, buah. Buah. Terima kasih, no worries, i understand.

Cleaned output:
child, i choosing yogurt, so i like yogurt. 10. already grown up. boy. he always buys Vitagen and Yakult at AEON Mall. do not have. he only likes yogurt, so buy it sometimes. only eat vegetables, fruits.

RAW INTERVIEW TRANSCRIPT:
${chunkText}`;

    const splitRawTranscriptByLines = (text: string, maxChars = 6000): string[] => {
      const normalized = text.trim();
      if (normalized.length <= maxChars) return [normalized];

      const lines = normalized.split(/\r?\n/);
      const chunks: string[] = [];
      let current: string[] = [];
      let currentLen = 0;

      for (const line of lines) {
        const nextLen = currentLen + line.length + 1;
        if (current.length > 0 && nextLen > maxChars) {
          chunks.push(current.join('\n'));
          current = [line];
          currentLen = line.length;
        } else {
          current.push(line);
          currentLen = nextLen;
        }
      }
      if (current.length > 0) chunks.push(current.join('\n'));
      return chunks.filter(Boolean);
    };

    const chunks = splitRawTranscriptByLines(rawSource, 6000);
    const routeDeadline = Date.now() + 26000;

    const invokeCleanModel = async (
      modelName: string,
      prompt: string,
      timeoutMs: number
    ): Promise<string> => {
      const isGemini25 = modelName.startsWith('gemini-2.5');
      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: isGemini25
          ? { temperature: 0 }
          : {
              temperature: 0,
              thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            },
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI cleaning request timed out')), timeoutMs)
      );
      const response = await Promise.race([generatePromise, timeoutPromise]);
      return (response.text || '')
        .replace(/^```(?:txt|text|markdown)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    };

    const isModelUnavailableError = (err: any): boolean => {
      const msg = String(err?.message || '').toLowerCase();
      return (
        err?.status === 404 ||
        msg.includes('not_found') ||
        msg.includes('no longer available') ||
        msg.includes('is not found')
      );
    };

    const cleanChunkWithGemini = async (chunkText: string): Promise<string> => {
      const prompt = buildCleanPrompt(chunkText);
      let lastError: any = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        const remainingMs = routeDeadline - Date.now();
        if (remainingMs < 3500) {
          lastError = lastError || new Error('AI cleaning request timed out');
          break;
        }

        const primaryModel = preferFallbackFlashCleanModel ? 'gemini-3.1-flash-lite' : 'gemini-2.5-flash';
        const perAttemptTimeout = Math.min(18000, remainingMs - 500);

        try {
          const out = await invokeCleanModel(primaryModel, prompt, perAttemptTimeout);
          if (out) return out;
        } catch (apiErr: any) {
          lastError = apiErr;
          if (primaryModel === 'gemini-2.5-flash' && isModelUnavailableError(apiErr)) {
            console.warn('[AI Clean] gemini-2.5-flash unavailable in runtime; switching cleanly to gemini-3.1-flash-lite');
            preferFallbackFlashCleanModel = true;
            const fallbackRemaining = routeDeadline - Date.now();
            if (fallbackRemaining >= 3500) {
              try {
                const fallbackOut = await invokeCleanModel(
                  'gemini-3.1-flash-lite',
                  prompt,
                  Math.min(18000, fallbackRemaining - 500)
                );
                if (fallbackOut) return fallbackOut;
              } catch (fbErr: any) {
                lastError = fbErr;
              }
            }
          }

          const status = lastError?.status;
          const isTimeout = /timed out/i.test(lastError?.message || '');
          if (isTimeout || (status && status >= 400 && status < 500 && status !== 429)) {
            break;
          }
          if (attempt < 1 && routeDeadline - Date.now() > 6000) {
            await new Promise((r) => setTimeout(r, 400));
          }
        }
      }

      throw lastError || new Error('AI transcript cleaning service returned an empty response. Please retry.');
    };

    let aiOutput = '';
    try {
      const results: string[] = new Array(chunks.length);
      let nextIndex = 0;
      const workerCount = Math.min(3, chunks.length);
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (nextIndex < chunks.length) {
            const idx = nextIndex++;
            results[idx] = await cleanChunkWithGemini(chunks[idx]);
          }
        })
      );
      aiOutput = results.filter(Boolean).join(' ').trim();
    } catch (cleanErr: any) {
      console.error('Gemini clean-data error:', cleanErr);
      const isTimeout = /timed out/i.test(cleanErr?.message || '');
      return res.status(cleanErr?.status || (isTimeout ? 504 : 502)).json({
        error: cleanErr?.message || 'AI transcript cleaning service failed. Please retry.',
      });
    }

    if (!aiOutput) {
      return res.status(502).json({
        error: 'AI transcript cleaning service returned an empty response. Please retry.',
      });
    }

    // Dedicated post-AI sanitizer preserves Case B "question? answer." pairs and stopwords
    // while enforcing lowercase single-spaced formatting and deduplicating echoes/fillers/noise.
    const guarded = sanitizeAiCleanedTranscript(aiOutput, cleaningOptions);
    const cleanedText = guarded.cleanedText;
    const cleanedWordCount = countWords(cleanedText);

    const cleaningStats = {
      removedInterviewerTurns: Math.max(baseline.stats.removedInterviewerTurns, guarded.stats.removedInterviewerTurns),
      removedFillersCount: Math.max(baseline.stats.removedFillersCount, guarded.stats.removedFillersCount),
      removedPhaticCount: Math.max(baseline.stats.removedPhaticCount, guarded.stats.removedPhaticCount),
      removedNoiseTagsCount: Math.max(baseline.stats.removedNoiseTagsCount, guarded.stats.removedNoiseTagsCount),
    };

    return res.json({
      success: true,
      fileName,
      cleanedText,
      rawWordCount,
      cleanedWordCount,
      removedWordsCount: Math.max(0, rawWordCount - cleanedWordCount),
      preservedPronounsCount: guarded.preservedPronounsCount,
      cleaningStats,
      reductionPercent: rawWordCount > 0 ? Math.round(((rawWordCount - cleanedWordCount) / rawWordCount) * 100) : 0,
      cleanedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Clean data error:', err);
    return res.status(500).json({ error: err.message || 'Failed to clean transcript data' });
  }
});

/**
 * Lightweight fast English translation endpoint used by Quick Clean Result
 * when untranslated Bahasa Melayu / Chinese / code-switched segments remain after local dictionary lookup.
 */
app.post('/api/translate-english', async (req: Request, res: Response) => {
  try {
    const { text, fileName = 'Transcript' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text to translate' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel.',
      });
    }

    const splitIntoSentenceChunks = (input: string, maxChars = 3200): string[] => {
      const normalized = input.trim();
      if (normalized.length <= maxChars) return [normalized];
      const sentences = normalized.split(/(?<=[.!?])\s+/);
      const chunks: string[] = [];
      let current = '';
      for (const s of sentences) {
        if (current && current.length + s.length + 1 > maxChars) {
          chunks.push(current.trim());
          current = s;
        } else {
          current = current ? `${current} ${s}` : s;
        }
      }
      if (current.trim()) chunks.push(current.trim());
      return chunks.filter(Boolean);
    };

    const chunks = splitIntoSentenceChunks(text, 3200);
    const routeDeadline = Date.now() + 20000;

    const translateChunk = async (chunk: string): Promise<string> => {
      const prompt = `Translate the following nutrition interview transcript into 100% natural, fluent, grammatically clear English—NOT literal word-for-word translation.
RULES:
1. Convert any remaining Malay, Mandarin, Cantonese, Tamil, or Manglish into clear natural English (e.g., "adik, anak, choosing yogurt" -> "my child likes yogurt", "kesihatan sistem dalam" -> "internal digestive system health", "tak ada" -> "no other products"). Leave ZERO untranslated non-English words except brand names.
2. Preserve exact meaning, pronouns (i, he, she, they, we, you, it, my), negations (no, not), and stopwords.
3. Keep ALL product and brand names intact verbatim (e.g., yakult, vitagen, nutrilite, amway, bio gaia, sunglo, emmi, farmers union, fernleaf, karihome, epicode, marigold, chobani, milo).
4. Collapse repeated words/stutters, do NOT add filler words, greetings, questions, or speaker headers.
5. Output ONLY clean lowercase single-spaced English text with no commentary or markdown fences.

TEXT:
${chunk}`;

      let lastErr: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const remainingMs = routeDeadline - Date.now();
        if (remainingMs < 3500) {
          lastErr = lastErr || new Error('Translation request timed out');
          break;
        }
        try {
          const generatePromise = ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            },
          });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Translation request timed out')), Math.min(8500, remainingMs - 400))
          );
          const response = await Promise.race([generatePromise, timeoutPromise]);
          const out = (response.text || '')
            .replace(/^```(?:txt|text|markdown)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          if (out) return out;
        } catch (err: any) {
          lastErr = err;
          const status = err?.status;
          if (status && status >= 400 && status < 500 && status !== 429) {
            break;
          }
          if (attempt < 1 && routeDeadline - Date.now() > 4000) {
            await new Promise((r) => setTimeout(r, 250));
          }
        }
      }
      throw lastErr || new Error('Translation service returned an empty response. Please retry.');
    };

    const results: string[] = new Array(chunks.length);
    let nextIndex = 0;
    const workerCount = Math.min(3, chunks.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < chunks.length) {
          const idx = nextIndex++;
          results[idx] = await translateChunk(chunks[idx]);
        }
      })
    );

    const combined = results.filter(Boolean).join(' ').trim();
    const normalizedText = removeStuttersAndNormalize(
      stripQuestionSentences(stripSpeakerHeaders(combined))
    );

    if (!normalizedText) {
      return res.status(502).json({ error: 'Translation returned an empty result. Please retry.' });
    }

    return res.json({
      success: true,
      fileName,
      translatedText: normalizedText,
      wordCount: countWords(normalizedText),
      preservedPronounsCount: countPreservedPronouns(normalizedText),
      translatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Translate-english error:', err);
    const isTimeout = /timed out/i.test(err?.message || '');
    return res.status(err?.status || (isTimeout ? 504 : 502)).json({
      error: err?.message || 'Failed to translate transcript to English',
    });
  }
});

// Maps API configuration endpoint
app.get('/api/maps/config', (_req: Request, res: Response) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
  res.json({
    apiKey,
    configured: Boolean(apiKey && apiKey.length > 5),
    defaultCenter: { lat: 3.1390, lng: 101.6869 }, // Klang Valley / KL
    defaultZoom: 11,
  });
});

/**
 * MODULE 3: Real ADKOTM Qualitative Research Decode
 * A - Activities (daily routine, shopping behaviour, food consumption behaviour, food preparation, eating context)
 * D - Demographic (gender, age, location, district, household composition, family role, education level)
 * K - Knowledge (Awareness on gut health, awareness level, understanding summary)
 * O - Objects (products purchased, supplement products, food products, actions to solve gut problems, brand preferences, product preference)
 * T - Time (purchase frequency, consumption frequency, purchase timing, purchase occasion, consumption timing)
 * M - Meta-data (interview time, location)
 *
 * Post-analysis codes:
 * FR - Family role analysis (strictly "Mum", "Dad", "Elderly", or null)
 * RL - Residential location analysis [from D]
 * AW - Awareness & Understanding on gut health [from K]
 * PP - Products purchased categories to solve gut health/digestive problem [from O]
 * PP1 - Products purchased brand analysis (sub-categories) [from O]
 * IL - Interview location analysis [from M]
 *
 * CRITICAL RULE: NO GUESSING OR MOCK SAMPLES. If not mentioned in transcript, value MUST BE null.
 */
function extractUpstreamErrorStatus(err: any): number {
  const msg = String(err?.message || err || '');
  const status = Number(err?.status || err?.code || 0);
  if (status === 429 || /RESOURCE_EXHAUSTED|429|quota/i.test(msg)) return 429;
  if (status === 403 || /PERMISSION_DENIED|API_KEY_INVALID/i.test(msg)) return 403;
  if (status === 400) return 400;
  return 502;
}

function parseJsonResponseText(rawText: string): any {
  try {
    return JSON.parse(rawText);
  } catch {
    let cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(cleaned);
  }
}

async function generateStructuredJsonWithFallback(
  prompt: string,
  responseSchema: any
): Promise<any> {
  const candidates: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
  ];

  let lastError: any = null;
  for (const candidate of candidates) {
    if (modelCooldownUntil[candidate.model] && Date.now() < modelCooldownUntil[candidate.model]) {
      continue;
    }
    try {
      const response = await ai.models.generateContent({
        model: candidate.model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
        },
      });
      const rawText = response.text || '';
      return parseJsonResponseText(rawText);
    } catch (err: any) {
      lastError = err;
      const errStatus = extractUpstreamErrorStatus(err);
      if (errStatus === 429) {
        modelCooldownUntil[candidate.model] = Date.now() + parseRetryDelayMs(err);
      }
      console.warn(`[Gemini JSON] ${candidate.model} failed (${errStatus}):`, err?.message || err);
    }
  }

  throw lastError || new Error('All Gemini structured JSON attempts failed');
}

async function runAdkotmDecodeWithGemini(
  transcript: string,
  fileName: string,
  metadataHint?: { location?: string | null; date?: string | null },
  customRules: string[] = []
) {
  const fieldObjectSchema = {
    type: Type.OBJECT,
    properties: {
      code: { type: Type.STRING, nullable: true },
      evidence_quote: { type: Type.STRING, nullable: true },
      confidence: { type: Type.STRING, enum: ['HIGH', 'REVIEW_NEEDED', 'NULL'] },
      status: { type: Type.STRING, enum: ['STAGED', 'ACCEPTED', 'REJECTED', 'MANUAL'] },
      reasoning: { type: Type.STRING, nullable: true },
    },
    required: ['code', 'evidence_quote', 'confidence', 'status', 'reasoning'],
  };

  const schemaProperties: Record<string, any> = {};
  for (const param of ADKOTM_PARAMETER_CATALOG) {
    schemaProperties[param.key] = fieldObjectSchema;
  }

  const decodeResponseSchema = {
    type: Type.OBJECT,
    properties: schemaProperties,
    required: ADKOTM_PARAMETER_CATALOG.map((p) => p.key),
  };

  const cleanRules = Array.isArray(customRules)
    ? customRules.map((r) => String(r || '').trim()).filter(Boolean)
    : [];

  const rulesBlock =
    cleanRules.length > 0
      ? `\nSTUDY-SPECIFIC CUSTOM CODING RULES (MUST FOLLOW):\n${cleanRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`
      : '';

  const prompt = `You are a rigorous qualitative research decoder for a nutrition empathy study using the ADKOTM taxonomy.
Analyze the cleaned interview transcript below and extract structured parameters into the JSON schema.

STRICT GROUNDING & ANALYTICAL CODE RULES:
1. For every parameter, return { "code", "evidence_quote", "confidence", "status", "reasoning" }.
2. Initial AI extractions must always set "status": "STAGED".
3. "code" MUST be a concise, standardized analytical label (e.g. "Daily morning probiotic routine", "Selective eater; prefers yogurt and fruits", "Probiotic Drinks", "Mum"), NEVER a raw copy-pasted conversational transcript fragment.
4. "evidence_quote" MUST be an exact verbatim substring copied directly from the TRANSCRIPT below that justifies "code".
5. If the transcript has NO direct textual support for a parameter, you MUST set:
   "code": null, "evidence_quote": null, "confidence": "NULL", "status": "STAGED", "reasoning": null.
   NEVER guess or invent unstated facts.
6. Set "confidence" to "HIGH" when explicitly stated, or "REVIEW_NEEDED" when the phrasing is subtle, indirect, or ambiguous even though a quote exists.
7. CRITICAL SEPARATION:
   - "residentialLocation" [RL] (D): STRICTLY where the participant LIVES (e.g. "Kepong", "Shah Alam", "Ampang"). NEVER use the interview mall/store venue!
   - "interviewLocation" [IL] (M): Field retail venue where the interview took place if spoken; if unstated in speech, leave null (server will check filename/session metadata).
   - "productsPurchased" [PP] (O): Standardized macro-category ("Probiotic Drinks", "Yogurt Products", "Dietary Supplements", "Fruits & Vegetables", "Dairy & Functional Milks", etc.).
   - "brandPreferences" [PP1] (O): Specific brand names mentioned (e.g. "Yakult, Vitagen, Bio Gaia, Amway, Epicode, Sunglo, Emmi, Farmers Union, Fernleaf, Karihome").
   - "familyRole" [FR] (D): Strictly "Mum", "Dad", or "Elderly" if stated.
   - "awarenessLevel" (K): Strictly "Aware" or "Not Aware" if gut health awareness is discussed, else null.
${rulesBlock}
TRANSCRIPT:
${transcript}

RECORDING FILENAME: ${fileName}
${metadataHint ? `SESSION METADATA HINT: location=${metadataHint.location || 'none'}, date=${metadataHint.date || 'none'}` : ''}`;

  const rawFields = await generateStructuredJsonWithFallback(prompt, decodeResponseSchema);
  if (!rawFields || typeof rawFields !== 'object') {
    throw new Error('Gemini returned an invalid ADKOTM JSON payload.');
  }

  const groundedFields = enforceStrictGrounding(rawFields, transcript, fileName, metadataHint);
  const syncedDecode = syncFlatDecodeFromFieldStates(groundedFields);
  const missedSignals = scanMissedSignals(transcript, groundedFields);

  return {
    ...syncedDecode,
    missedSignals,
    dismissedSignalIds: [],
    decodedAt: new Date().toISOString(),
  };
}

app.post('/api/decode/adkotm', async (req: Request, res: Response) => {
  try {
    const { transcript, fileName = 'Transcript', metadataHint, customRules = [] } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Missing transcript text to decode' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    const finalDecode = await runAdkotmDecodeWithGemini(
      transcript,
      fileName,
      metadataHint,
      customRules
    );

    return res.json({
      success: true,
      fileName,
      decode: finalDecode,
      reviewStatus: 'needs_review',
      decodedAt: finalDecode.decodedAt,
    });
  } catch (err: any) {
    console.error('[ADKOTM Decode Error]:', err);
    const httpStatus = extractUpstreamErrorStatus(err);
    return res.status(httpStatus).json({
      error: err?.message || 'Failed to decode transcript with Gemini ADKOTM model',
    });
  }
});

/**
 * Copilot Missed-Signal Gap Scanner
 * Compares cleaned transcript sentences against existing evidence_quote spans and detects subtle uncoded cues.
 */
app.post('/api/copilot/missed-signals', async (req: Request, res: Response) => {
  try {
    const { transcript, fieldStates = {}, dismissedIds = [] } = req.body;
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Missing transcript string' });
    }

    const deterministicSignals = scanMissedSignals(transcript, fieldStates, dismissedIds);
    const merged = [...deterministicSignals];

    if (process.env.GEMINI_API_KEY) {
      try {
        const coveredQuotes = Object.values(fieldStates as Record<string, any>)
          .filter((v) => v && v.status !== 'REJECTED' && v.code && v.evidence_quote)
          .map((v) => v.evidence_quote);

        const gapSchema = {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sentence: { type: Type.STRING },
                  suggestedFieldKey: { type: Type.STRING },
                  suggestedCode: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['sentence', 'suggestedFieldKey', 'suggestedCode', 'reason'],
              },
            },
          },
          required: ['suggestions'],
        };

        const validKeys = ADKOTM_PARAMETER_CATALOG.map((p) => `${p.key} (${p.dimension}: ${p.label})`).join(', ');
        const prompt = `Inspect the cleaned interview transcript and find up to 4 substantive sentences NOT covered by the already-extracted quotes that contain implicit ADKOTM clues (e.g., health triggers like constipation, child activities like swimmer, picky eating, local brands like Biogaya/Amway/Vitagen/Yakult, frequency, or residential hints).

RULES:
- "sentence" MUST be an exact verbatim sentence from CLEANED TRANSCRIPT.
- "suggestedFieldKey" MUST be one of the exact keys in VALID FIELD KEYS (e.g. "foodConsumptionBehaviour", "brandPreferences", "dailyRoutine").
- "suggestedCode" MUST be a concise, descriptive analytical label (e.g. "Competitive swimmer; prefers Greek yogurt and fruits", "Biogaya probiotic drops"), NEVER an abbreviation like "PP" or "FCP".

ALREADY COVERED QUOTES:
${JSON.stringify(coveredQuotes)}

VALID FIELD KEYS:
${validKeys}

CLEANED TRANSCRIPT:
${transcript}`;

        const aiResp = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: gapSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          },
        });

        const parsed = JSON.parse(aiResp.text || '{}');
        const paramLookup = new Map(ADKOTM_PARAMETER_CATALOG.map((p) => [p.key, p]));
        const dismissedSet = new Set<string>(Array.isArray(dismissedIds) ? dismissedIds : []);

        if (Array.isArray(parsed.suggestions)) {
          for (const s of parsed.suggestions) {
            const param = paramLookup.get(s.suggestedFieldKey);
            if (!param) continue;
            const grounded = verifyEvidenceQuote(transcript, s.sentence);
            if (!grounded) continue;

            const id = `ai_sig_${param.key}_${grounded.start}`;
            if (dismissedSet.has(id)) continue;
            const alreadyPresent = merged.some(
              (m) => m.suggestedFieldKey === param.key && m.sentence.toLowerCase() === grounded.matchedText.toLowerCase()
            );
            if (alreadyPresent) continue;

            merged.push({
              id,
              sentence: grounded.matchedText,
              suggestedFieldKey: param.key,
              suggestedDimension: param.dimension,
              suggestedCode: String(s.suggestedCode || '').trim(),
              reason: String(s.reason || 'Implicit behavioral clue detected by AI Copilot').trim(),
            });
          }
        }
      } catch (aiErr: any) {
        console.warn('[Missed Signals AI] Falling back to deterministic signals:', aiErr.message);
      }
    }

    return res.json({
      success: true,
      missedSignals: merged,
    });
  } catch (err: any) {
    console.error('Missed signals error:', err);
    return res.status(500).json({ error: err.message || 'Failed to scan for missed signals' });
  }
});

/**
 * Copilot Suggest: Inspects null/weak ADKOTM parameters for implicit evidence-grounded suggestions
 */
app.post('/api/copilot/suggest', async (req: Request, res: Response) => {
  try {
    const { record, customRules = [] } = req.body;
    const transcript = record?.cleanedTranscript || record?.transcript;
    if (!record || !transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Missing record transcript to inspect' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    const currentFieldStates = record.adkotmDecode?.fieldStates || {};
    const emptyFields = ADKOTM_PARAMETER_CATALOG.filter((p) => {
      const existing = currentFieldStates[p.key];
      return !existing || existing.status === 'REJECTED' || !existing.code;
    });

    const targetKeys = (emptyFields.length > 0 ? emptyFields : ADKOTM_PARAMETER_CATALOG)
      .map((p) => `${p.key} (${p.label})`)
      .join(', ');

    const suggestionSchema = {
      type: Type.OBJECT,
      properties: {
        suggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              targetField: { type: Type.STRING },
              suggestedCode: { type: Type.STRING },
              evidence_quote: { type: Type.STRING },
              confidence: { type: Type.STRING, enum: ['HIGH', 'MEDIUM'] },
              reasoning: { type: Type.STRING },
            },
            required: ['targetField', 'suggestedCode', 'evidence_quote', 'confidence', 'reasoning'],
          },
        },
      },
      required: ['suggestions'],
    };

    const rulesNote =
      Array.isArray(customRules) && customRules.length > 0
        ? `\nCUSTOM RULES:\n${customRules.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}\n`
        : '';

    const prompt = `Inspect the cleaned interview transcript for implicit or overlooked clues that populate missing ADKOTM fields.
Only suggest fields from MISSING OR WEAK FIELDS below. Each suggestion MUST include a concise analytical "suggestedCode" (never raw transcript text) and an exact verbatim substring "evidence_quote" from the transcript.
${rulesNote}
MISSING OR WEAK FIELDS:
${targetKeys}

TRANSCRIPT:
${transcript}`;

    const parsed = await generateStructuredJsonWithFallback(prompt, suggestionSchema);
    const paramLookup = new Map(ADKOTM_PARAMETER_CATALOG.map((p) => [p.key, p]));
    const suggestions: any[] = [];

    if (Array.isArray(parsed?.suggestions)) {
      for (const item of parsed.suggestions) {
        const param = paramLookup.get(item.targetField);
        const meta = findFieldMeta(item.targetField);
        if (!param || !meta) continue;
        const grounded = verifyEvidenceQuote(transcript, item.evidence_quote);
        const code = String(item.suggestedCode || '').trim();
        if (!code) continue;

        suggestions.push({
          id: `sug_${param.key}_${grounded ? grounded.start : Date.now()}_${suggestions.length}`,
          targetSection: meta.section,
          targetField: param.key,
          targetLabel: param.label,
          ...(meta.postAnalysisCode ? { postAnalysisCode: meta.postAnalysisCode } : {}),
          suggestedCode: code,
          evidence_quote: grounded ? grounded.matchedText : null,
          confidence: grounded ? (item.confidence === 'HIGH' ? 'HIGH' : 'MEDIUM') : 'UNVERIFIED',
          reasoning: String(item.reasoning || 'Implicit clue detected from cleaned transcript.'),
          source: grounded ? 'implicit_clue' : 'ungrounded_fallback',
        });
      }
    }

    return res.json({ success: true, suggestions });
  } catch (err: any) {
    console.error('[Copilot Suggest Error]:', err);
    return res.status(extractUpstreamErrorStatus(err)).json({
      error: err?.message || 'Failed to generate copilot suggestions',
    });
  }
});

/**
 * Copilot Normalize: Cross-interview PP & PP1 standardization proposals
 */
app.post('/api/copilot/normalize', (req: Request, res: Response) => {
  try {
    const { records = [] } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid records payload' });
    }

    const aggregateProposals = proposeTaxonomyNormalizations(records);
    const recordMap = new Map<string, any>(records.map((r: any) => [r.id, r]));
    const flatProposals: any[] = [];

    for (const prop of aggregateProposals) {
      for (const recId of prop.affectedRecordIds) {
        const rec = recordMap.get(recId);
        if (!rec?.adkotmDecode) continue;
        const beforePP =
          rec.adkotmDecode.postAnalysisCodes?.PP ||
          rec.adkotmDecode.objects?.productsPurchased ||
          null;
        const beforePP1 =
          rec.adkotmDecode.postAnalysisCodes?.PP1 ||
          rec.adkotmDecode.objects?.brandPreferences ||
          null;

        flatProposals.push({
          ...prop,
          id: `${prop.id}_${recId}`,
          recordId: recId,
          fileName: stripRecordingExtension(rec.fileName),
          beforePP,
          afterPP: prop.normalizedValue,
          beforePP1,
          afterPP1: prop.preservedBrands[recId] || beforePP1,
        });
      }
    }

    return res.json({ success: true, proposals: flatProposals });
  } catch (err: any) {
    console.error('[Copilot Normalize Error]:', err);
    return res.status(500).json({ error: err?.message || 'Failed to analyze PP/PP1 normalization' });
  }
});

/**
 * Copilot Scan Gaps: Scans uncovered sentences in a record for missed signals
 */
app.post('/api/copilot/scan-gaps', async (req: Request, res: Response) => {
  try {
    const { record } = req.body;
    const transcript = record?.cleanedTranscript || record?.transcript;
    if (!record || !transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Missing record transcript to scan' });
    }

    const uncoveredSentences = findUncoveredSentences(transcript, record.adkotmDecode);
    const deterministic = scanMissedSignals(
      transcript,
      record.adkotmDecode?.fieldStates || {},
      record.adkotmDecode?.dismissedSignalIds || []
    );

    const signals = deterministic
      .map((sig) => {
        const meta = findFieldMeta(sig.suggestedFieldKey);
        if (!meta) return null;
        return {
          id: sig.id,
          sentence: sig.sentence,
          suggestedSection: meta.section,
          suggestedField: meta.field,
          suggestedLabel: meta.label,
          ...(meta.postAnalysisCode ? { postAnalysisCode: meta.postAnalysisCode } : {}),
          suggestedCode: sig.suggestedCode,
          reasoning: sig.reason,
        };
      })
      .filter(Boolean);

    return res.json({
      success: true,
      signals,
      uncoveredCount: uncoveredSentences.length,
    });
  } catch (err: any) {
    console.error('[Copilot Scan Gaps Error]:', err);
    return res.status(500).json({ error: err?.message || 'Failed to scan uncovered sentences' });
  }
});

/**
 * Copilot Rules Re-Decode: Re-runs ADKOTM decode with custom rules and returns field-level diffs
 */
app.post('/api/copilot/redecode-rules', async (req: Request, res: Response) => {
  try {
    const { records = [], customRules = [] } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Missing target records to re-decode' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    const diffs: any[] = [];
    const decodedByRecordId: Record<string, any> = {};

    for (const record of records) {
      const textToDecode = record?.cleanedTranscript || record?.transcript;
      if (!textToDecode) continue;

      const candidateDecode = await runAdkotmDecodeWithGemini(
        textToDecode,
        record.fileName || 'Transcript',
        { location: record.sessionLocation, date: record.sessionDate },
        customRules
      );
      decodedByRecordId[record.id] = candidateDecode;

      const recordDiffs = computeDecodeDiffs(
        record.id,
        record.fileName || 'Transcript',
        record.adkotmDecode,
        candidateDecode
      );
      diffs.push(...recordDiffs);
    }

    return res.json({
      success: true,
      diffs,
      decodedByRecordId,
    });
  } catch (err: any) {
    console.error('[Copilot Re-Decode Error]:', err);
    return res.status(extractUpstreamErrorStatus(err)).json({
      error: err?.message || 'Failed to re-decode records with custom rules',
    });
  }
});

/**
 * MODULE 4: Cross-Analysis & Deep Analysis (Spending Power)
 * Formula: Spending Power = D + O + T + M (specifically RL + PP + IL)
 * Analyzes Residential Location (RL) + Products Purchased Categories & Brands (PP/PP1) + Interview Location (IL).
 * STRICT RULE: If transcript had no data for these components, return null with explanation.
 */
app.post('/api/cross-analysis/spending-power', async (req: Request, res: Response) => {
  try {
    const { decodedRecords } = req.body;

    if (!Array.isArray(decodedRecords) || decodedRecords.length === 0) {
      return res.status(400).json({ error: 'Missing decodedRecords array' });
    }

    const analyses = decodedRecords.map((item: any) => {
      const dec = item.adkotmDecode;
      if (!dec) {
        return {
          recordId: item.id,
          fileName: item.fileName,
          spendingPowerTier: null,
          components: {
            D_demographic: null,
            FR_familyRole: null,
            RL_residentialLocation: null,
            age: null,
            gender: null,
            educationLevel: null,
            O_objects: null,
            T_time: null,
            M_metadata: null,
            PP_productsPurchased: null,
            PP1_brandPreferences: null,
            IL_interviewLocation: null,
          },
          justification: 'Not decoded yet (null)',
        };
      }

      const fr = dec.postAnalysisCodes?.FR || dec.demographic?.familyRole || null;
      const rl = dec.postAnalysisCodes?.RL || dec.demographic?.residentialLocation || dec.demographic?.residentialDistrict || null;
      const pp = dec.postAnalysisCodes?.PP || dec.objects?.productsPurchased || null;
      const pp1 = dec.postAnalysisCodes?.PP1 || dec.objects?.brandPreferences || null;
      const il = dec.postAnalysisCodes?.IL || dec.metadata?.interviewLocation || null;
      const timeContext = dec.time?.purchaseFrequency || dec.time?.purchaseTiming || null;
      const ageContext = dec.demographic?.age || null;
      const genderContext = dec.demographic?.gender || null;
      const eduContext = dec.demographic?.educationLevel || null;

      // Determine spending power strictly if evidence exists
      let tier: 'High' | 'Medium-High' | 'Medium' | 'Low' | null = null;
      let justification: string | null = null;

      const combinedText = `${rl || ''} ${pp || ''} ${pp1 || ''} ${il || ''}`.toLowerCase();

      if (!rl && !pp && !pp1 && !il) {
        tier = null;
        justification = 'Insufficient spending signals: Residential location, products, and venue were not mentioned (null).';
      } else {
        // High spending indicators: premium expat/upscale locations (Publika, Mont Kiara, Bangsar, BSC, Solaris) or specialty organic/imported brands
        if (
          combinedText.includes('publika') ||
          combinedText.includes('mont kiara') ||
          combinedText.includes('bangsar') ||
          combinedText.includes('organic') ||
          combinedText.includes('imported') ||
          combinedText.includes('karihome')
        ) {
          tier = 'High';
          justification = `High spending power indicated by residential/interview venue (${il || rl || 'Affluent area'}) and premium category selection (${pp || pp1 || 'Premium'}).`;
        } else if (
          combinedText.includes('nsk') ||
          combinedText.includes('brem mall') ||
          combinedText.includes('kepong') ||
          combinedText.includes('pasir gudang') ||
          combinedText.includes('hypermarket') ||
          combinedText.includes('wholesale')
        ) {
          tier = 'Medium';
          justification = `Medium / value-conscious spending indicated by hypermarket venue (${il || 'Brem Mall / NSK'}) and budget-conscious household basket (${pp || 'Value staple'}).`;
        } else if (pp || pp1 || rl || il) {
          tier = 'Medium-High';
          justification = `Moderate-to-high spending based on identified products (${pp || pp1 || 'Standard commercial brand'}) and location (${il || rl || 'Urban center'}).`;
        } else {
          tier = null;
          justification = 'No clear spending power indicators identified (null).';
        }
      }

      return {
        recordId: item.id,
        fileName: item.fileName,
        spendingPowerTier: tier,
        components: {
          D_demographic: fr, // Strictly Family Role (never fallback to residential location)
          FR_familyRole: fr,
          RL_residentialLocation: rl,
          age: ageContext,
          gender: genderContext,
          educationLevel: eduContext,
          O_objects: pp || pp1 || null,
          T_time: timeContext,
          M_metadata: il,
          PP_productsPurchased: pp,
          PP1_brandPreferences: pp1,
          IL_interviewLocation: il,
        },
        justification,
      };
    });

    return res.json({
      success: true,
      analyses,
      analyzedCount: analyses.length,
    });
  } catch (err: any) {
    console.error('Spending power cross analysis error:', err);
    return res.status(500).json({ error: err.message || 'Failed to compute spending power analysis' });
  }
});

/**
 * Generalized Cross-Analysis Formula Evaluation Engine
 * Evaluates any custom or preset qualitative formula (e.g. Spending Power, Gut Health Proactiveness, Brand Loyalty)
 */
app.post('/api/cross-analysis/evaluate', async (req: Request, res: Response) => {
  try {
    const { formula, decodedRecords } = req.body;
    if (!formula || !Array.isArray(decodedRecords)) {
      return res.status(400).json({ error: 'Missing formula or decodedRecords' });
    }

    const outputTiers: string[] =
      formula.outputTiers && formula.outputTiers.length > 0
        ? formula.outputTiers
        : ['High', 'Medium', 'Low'];

    const evaluations: any[] = [];

    for (const item of decodedRecords) {
      const dec = item.adkotmDecode;
      if (!dec) {
        evaluations.push({
          recordId: item.id,
          fileName: item.fileName,
          formulaId: formula.id,
          tier: null,
          components: {},
          justification: 'Not decoded yet (null)',
        });
        continue;
      }

      // Extract components based on formula dimensions & codes
      const components: Record<string, string | null> = {};
      const codes = (formula.analysisCodes || '')
        .split('+')
        .map((s: string) => s.trim().toUpperCase());

      // Check specific post-analysis codes
      if (dec.postAnalysisCodes) {
        codes.forEach((c: string) => {
          if (c in dec.postAnalysisCodes) {
            components[c] = (dec.postAnalysisCodes as any)[c] || null;
          }
        });
      }

      // Include dimension details requested
      const dims: string[] = formula.dimensions || ['D', 'O', 'T', 'M'];
      if (dims.includes('A')) {
        components['A_activities'] = dec.activities?.dailyRoutine || dec.activities?.foodPreparation || null;
      }
      if (dims.includes('D')) {
        const fr = dec.demographic?.familyRole || dec.postAnalysisCodes?.FR || null;
        const rl = dec.demographic?.residentialLocation || dec.demographic?.residentialDistrict || dec.postAnalysisCodes?.RL || null;
        const age = dec.demographic?.age || null;
        const gender = dec.demographic?.gender || null;
        const edu = dec.demographic?.educationLevel || null;

        components['FR_familyRole'] = fr;
        components['RL_residentialLocation'] = rl;
        components['age'] = age;
        components['gender'] = gender;
        components['educationLevel'] = edu;
        // Strictly family role for D_demographic (never fallback to residential location)
        components['D_demographic'] = fr;
        if (!components['RL']) components['RL'] = rl;
        if (!components['FR']) components['FR'] = fr;
      }
      if (dims.includes('K')) {
        components['K_knowledge'] = dec.knowledge?.awarenessOnGutHealth || null;
        if (!components['AW']) components['AW'] = dec.postAnalysisCodes?.AW || dec.knowledge?.awarenessOnGutHealth || null;
      }
      if (dims.includes('O')) {
        components['O_objects'] = dec.objects?.productsPurchased || dec.objects?.brandPreferences || null;
        if (!components['PP']) components['PP'] = dec.postAnalysisCodes?.PP || dec.objects?.productsPurchased || null;
        if (!components['PP1']) components['PP1'] = dec.postAnalysisCodes?.PP1 || dec.objects?.brandPreferences || null;
      }
      if (dims.includes('T')) {
        components['T_time'] = dec.time?.purchaseFrequency || dec.time?.consumptionFrequency || null;
      }
      if (dims.includes('M')) {
        components['M_metadata'] = dec.metadata?.interviewLocation || null;
        if (!components['IL']) components['IL'] = dec.postAnalysisCodes?.IL || dec.metadata?.interviewLocation || null;
      }

      // Strict null rule: check if any relevant data exists
      const nonNullEntries = Object.entries(components).filter(
        ([, v]) => v !== null && typeof v === 'string' && v.trim() !== ''
      );

      if (nonNullEntries.length === 0) {
        evaluations.push({
          recordId: item.id,
          fileName: item.fileName,
          formulaId: formula.id,
          tier: null,
          components,
          justification: 'Insufficient signals: Relevant variables for this formula were not mentioned in this interview (null).',
        });
        continue;
      }

      // Spending Power formula evaluation
      if (formula.id === 'spending_power') {
        const rl = components['RL'] || dec.demographic?.residentialLocation || null;
        const pp = components['PP'] || dec.objects?.productsPurchased || null;
        const pp1 = components['PP1'] || dec.objects?.brandPreferences || null;
        const il = components['IL'] || dec.metadata?.interviewLocation || null;
        const combined = `${rl || ''} ${pp || ''} ${pp1 || ''} ${il || ''}`.toLowerCase();

        let tier: string | null = 'Medium';
        let just = 'Medium tier based on standard consumer signals';
        if (
          combined.includes('publika') ||
          combined.includes('mont kiara') ||
          combined.includes('bangsar') ||
          combined.includes('karihome') ||
          combined.includes('organic') ||
          combined.includes('imported')
        ) {
          tier = 'High';
          just = `High tier indicated by location/venue (${il || rl || 'Affluent area'}) and premium selection (${pp || pp1 || 'Specialty product'}).`;
        } else if (
          combined.includes('nsk') ||
          combined.includes('brem mall') ||
          combined.includes('kepong') ||
          combined.includes('wholesale')
        ) {
          tier = 'Medium';
          just = `Medium tier indicated by hypermarket venue (${il || 'Brem Mall / NSK'}) and value-basket selection.`;
        } else if (pp || pp1 || rl || il) {
          tier = 'Medium-High';
          just = `Medium-High tier based on identified commercial brands (${pp || pp1}) in urban market.`;
        }

        evaluations.push({
          recordId: item.id,
          fileName: item.fileName,
          formulaId: formula.id,
          tier,
          components,
          justification: just,
        });
        continue;
      }

      // Gut Health Proactiveness evaluation (K + O + A)
      if (
        formula.id === 'gut_health_proactiveness' ||
        formula.name?.toLowerCase().includes('proactiveness') ||
        formula.name?.toLowerCase().includes('gut health')
      ) {
        const aw = components['AW'] || dec.knowledge?.awarenessOnGutHealth || '';
        const pp = components['PP'] || dec.objects?.productsPurchased || '';
        const combined = `${aw} ${pp}`.toLowerCase();

        let tier: string = outputTiers[outputTiers.length - 1] || 'Low';
        let just = 'Basic or emergent gut health awareness';

        if (
          combined.includes('probiotic') &&
          (combined.includes('regular') || combined.includes('daily') || combined.includes('digest') || pp.length > 3)
        ) {
          tier = outputTiers[0] || 'High';
          just = `High Proactiveness: demonstrates active probiotic understanding and routine dietary purchases (${pp || aw}).`;
        } else if (aw.length > 6 || pp.length > 6) {
          tier = outputTiers[1] || outputTiers[0] || 'Medium';
          just = `Moderate Proactiveness: exhibits gut health recognition with occasional category purchase (${aw || pp}).`;
        }

        evaluations.push({
          recordId: item.id,
          fileName: item.fileName,
          formulaId: formula.id,
          tier,
          components,
          justification: just,
        });
        continue;
      }

      // Brand Loyalty vs Sensitivity evaluation (O + T + M)
      if (
        formula.id === 'brand_loyalty' ||
        formula.name?.toLowerCase().includes('loyalty') ||
        formula.name?.toLowerCase().includes('brand')
      ) {
        const pp1 = components['PP1'] || dec.objects?.brandPreferences || '';
        const freq = components['T_time'] || dec.time?.purchaseFrequency || '';
        const il = components['IL'] || dec.metadata?.interviewLocation || '';
        const combined = `${pp1} ${freq} ${il}`.toLowerCase();

        let tier: string = outputTiers[outputTiers.length - 1] || 'Low';
        let just = 'General brand awareness';

        if (pp1 && pp1.length > 2 && (combined.includes('always') || combined.includes('only') || combined.includes('yakult') || combined.includes('karihome'))) {
          tier = outputTiers[0] || 'High';
          just = `Strong Brand Loyalty: committed to designated brand (${pp1}) with routine repurchase.`;
        } else if (pp1) {
          tier = outputTiers[1] || outputTiers[0] || 'Medium';
          just = `Moderate Brand Preference: named preferred brand (${pp1}) alongside multi-retail options.`;
        }

        evaluations.push({
          recordId: item.id,
          fileName: item.fileName,
          formulaId: formula.id,
          tier,
          components,
          justification: just,
        });
        continue;
      }

      // Generic custom qualitative formula: assign tier based on empirical signal strength
      const tierIndex = Math.min(
        nonNullEntries.length >= 3 ? 0 : nonNullEntries.length === 2 ? 1 : outputTiers.length - 1,
        outputTiers.length - 1
      );
      const assignedTier = outputTiers[tierIndex];
      const signalSummary = nonNullEntries.map(([k, v]) => `${k}: ${v}`).join('; ');

      evaluations.push({
        recordId: item.id,
        fileName: item.fileName,
        formulaId: formula.id,
        tier: assignedTier,
        components,
        justification: `Qualitative evaluation for ${formula.name} [${formula.code}]: Evidence captured in ${signalSummary}.`,
      });
    }

    return res.json({
      success: true,
      evaluations,
      analyzedCount: evaluations.length,
    });
  } catch (err: any) {
    console.error('Cross-analysis evaluation error:', err);
    return res.status(500).json({ error: err.message || 'Failed to evaluate cross-analysis formula' });
  }
});

/**
 * Transcribe / process text document or interview notes using gemini-3.8-flash
 */
app.post('/api/transcribe/text', async (req: Request, res: Response) => {
  try {
    const { text, fileName } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid text content' });
    }

    if (!process.env.GEMINI_API_KEY) {
      // If no API key, return the text directly formatted
      return res.json({
        success: true,
        transcript: text.trim(),
        fileName,
        transcribedAt: new Date().toISOString(),
      });
    }

    const prompt = `The following text document contains raw notes or an interview record from our nutrition empathy study with families and consumers.
Please organize and format this document into a clear, professional interview transcript:
- Standardize speaker turns (e.g., Interviewer, Parent / Guardian, Child, Subject)
- Maintain all original statements, nuances, mealtime anecdotes, and product feedback faithfully
- Ensure clean paragraph breaks and readable layout

Document Name: ${fileName || 'Interview Notes'}
Raw Content:
${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an empathetic research transcription specialist for a nutrition company researching family eating habits, children nutrition, and dietary experiences.',
      },
    });

    const transcript = response.text || text;

    res.json({
      success: true,
      transcript,
      fileName,
      transcribedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Text transcription error:', error);
    // Fallback: return raw text if model call fails
    res.json({
      success: true,
      transcript: req.body.text || '',
      fileName: req.body.fileName,
      transcribedAt: new Date().toISOString(),
      note: 'Processed as direct raw text due to processing error: ' + error.message,
    });
  }
});

/**
 * Aggregated Empathy Studies Analytics
 * Computes demographic breakdown, gut health awareness segmented for Mummy vs Elderly,
 * understanding qualitative synthesis, digestive solutions, and supplements vs food products.
 */
app.post('/api/analytics/empathy-summary', (req: Request, res: Response) => {
  try {
    const { records = [] } = req.body;
    const eligibleRecords = Array.isArray(records) ? records.filter((r: any) => isHumanVerifiedRecord(r)) : [];

    // 1. Demographic aggregation
    const ageBuckets: Record<string, number> = {
      '20-29': 0,
      '30-39': 0,
      '40-49': 0,
      '50-59': 0,
      '60+ (Elderly)': 0,
      'Not Stated': 0,
    };

    const districtCounts: Record<string, number> = {};
    const educationCounts: Record<string, number> = {};
    const spendingCounts: Record<string, number> = {
      High: 0,
      'Medium-High': 0,
      Medium: 0,
      Low: 0,
      Unclassified: 0,
    };

    // 2. Gut Health Awareness segmented for Mummy vs Elderly
    const awarenessSegmented = {
      mummy: { total: 0, aware: 0, notAware: 0, unstated: 0 },
      elderly: { total: 0, aware: 0, notAware: 0, unstated: 0 },
      dadAndOther: { total: 0, aware: 0, notAware: 0, unstated: 0 },
    };

    // 3. Understanding themes & quotes
    const understandings: { role: string; location: string; text: string }[] = [];

    // 4. Solutions to solve gut / digestive problems
    const solutionCounts: Record<string, number> = {
      'Cultivated Milk / Probiotics (Yakult, Vitagen)': 0,
      'High-Fiber Fruits & Diet (Papaya, Banana, Warm Water)': 0,
      'Nutritional Supplements / Enzymes': 0,
      'Pediatrician / Clinic Medical Visit': 0,
      'Switch Milk Formula': 0,
      'Traditional Herbal Remedy': 0,
      'Other / Unspecified': 0,
    };

    // 5. Products Purchased: Supplements vs Food Products
    const supplementMap: Record<string, number> = {};
    const foodProductMap: Record<string, number> = {};
    let totalSupplementsCount = 0;
    let totalFoodProductsCount = 0;

    eligibleRecords.forEach((item: any) => {
      const dec = item.adkotmDecode;
      const demo = dec?.demographic;
      const role = (demo?.familyRole || dec?.postAnalysisCodes?.FR || '').trim().toLowerCase();
      const loc = demo?.residentialLocation || dec?.postAnalysisCodes?.RL || item.sessionLocation || 'Klang Valley';
      const spendingTier = item.spendingPower?.spendingPowerTier || 'Unclassified';

      // Spending power
      if (spendingTier in spendingCounts) {
        spendingCounts[spendingTier]++;
      } else {
        spendingCounts['Unclassified']++;
      }

      // Age categorization
      const ageStr = (demo?.age || '').toLowerCase();
      if (role.includes('elderly') || ageStr.includes('60') || ageStr.includes('65') || ageStr.includes('70') || ageStr.includes('elderly')) {
        ageBuckets['60+ (Elderly)']++;
      } else if (ageStr.includes('20') || ageStr.includes('25') || ageStr.includes('28') || ageStr.includes('29')) {
        ageBuckets['20-29']++;
      } else if (ageStr.includes('30') || ageStr.includes('32') || ageStr.includes('35') || ageStr.includes('38') || ageStr.includes('39')) {
        ageBuckets['30-39']++;
      } else if (ageStr.includes('40') || ageStr.includes('45') || ageStr.includes('48')) {
        ageBuckets['40-49']++;
      } else if (ageStr.includes('50') || ageStr.includes('55')) {
        ageBuckets['50-59']++;
      } else if (ageStr) {
        ageBuckets['30-39']++; // Default inferred adult bracket if specified but unbucketed
      } else {
        ageBuckets['Not Stated']++;
      }

      // District
      const district = (demo?.residentialDistrict || demo?.residentialLocation || dec?.postAnalysisCodes?.RL || 'Unspecified').trim();
      if (district && district !== 'null') {
        districtCounts[district] = (districtCounts[district] || 0) + 1;
      }

      // Education Level
      const edu = (demo?.educationLevel || 'Not Stated').trim();
      educationCounts[edu] = (educationCounts[edu] || 0) + 1;

      // Gut Health Awareness segmentation
      const awText = dec?.knowledge?.awarenessOnGutHealth || dec?.postAnalysisCodes?.AW || '';
      const awLevel = dec?.knowledge?.awarenessLevel || (
        awText.toLowerCase().includes('aware') || awText.toLowerCase().includes('probiotic') || awText.toLowerCase().includes('good bacteria') || awText.toLowerCase().includes('regular')
          ? 'Aware'
          : awText.toLowerCase().includes('not aware') || awText.toLowerCase().includes('never heard') || awText.toLowerCase().includes('don\'t know')
          ? 'Not Aware'
          : null
      );

      const targetSegment = role.includes('mum') || role.includes('mother')
        ? awarenessSegmented.mummy
        : role.includes('elderly') || role.includes('grand')
        ? awarenessSegmented.elderly
        : awarenessSegmented.dadAndOther;

      targetSegment.total++;
      if (awLevel === 'Aware') {
        targetSegment.aware++;
      } else if (awLevel === 'Not Aware') {
        targetSegment.notAware++;
      } else {
        targetSegment.unstated++;
      }

      // Understanding
      const understandText = dec?.knowledge?.understandingSummary || dec?.knowledge?.awarenessOnGutHealth || '';
      if (understandText && understandText.length > 5) {
        understandings.push({
          role: demo?.familyRole || 'Participant',
          location: loc,
          text: understandText,
        });
      }

      // Solutions to gut problems
      const actions: string[] = dec?.objects?.actionsToSolve || [];
      if (Array.isArray(actions) && actions.length > 0) {
        actions.forEach((act) => {
          const lower = act.toLowerCase();
          if (lower.includes('yakult') || lower.includes('vitagen') || lower.includes('probiotic') || lower.includes('cultivated milk')) {
            solutionCounts['Cultivated Milk / Probiotics (Yakult, Vitagen)']++;
          } else if (lower.includes('fruit') || lower.includes('papaya') || lower.includes('banana') || lower.includes('water') || lower.includes('fiber')) {
            solutionCounts['High-Fiber Fruits & Diet (Papaya, Banana, Warm Water)']++;
          } else if (lower.includes('supplement') || lower.includes('enzyme') || lower.includes('powder') || lower.includes('tablet')) {
            solutionCounts['Nutritional Supplements / Enzymes']++;
          } else if (lower.includes('doctor') || lower.includes('clinic') || lower.includes('pediatrician') || lower.includes('hospital')) {
            solutionCounts['Pediatrician / Clinic Medical Visit']++;
          } else if (lower.includes('formula') || lower.includes('milk')) {
            solutionCounts['Switch Milk Formula']++;
          } else if (lower.includes('herb') || lower.includes('traditional') || lower.includes('chinese medicine')) {
            solutionCounts['Traditional Herbal Remedy']++;
          } else {
            solutionCounts['Other / Unspecified']++;
          }
        });
      }

      // Supplements vs Food Products
      const supps: string[] = dec?.objects?.supplementProducts || [];
      if (Array.isArray(supps)) {
        supps.forEach((s) => {
          supplementMap[s] = (supplementMap[s] || 0) + 1;
          totalSupplementsCount++;
        });
      }

      const foods: string[] = dec?.objects?.foodProducts || [];
      if (Array.isArray(foods)) {
        foods.forEach((f) => {
          foodProductMap[f] = (foodProductMap[f] || 0) + 1;
          totalFoodProductsCount++;
        });
      }

      // Fallback from productsPurchased if explicit arrays weren't filled
      const rawProducts = dec?.objects?.productsPurchased || dec?.postAnalysisCodes?.PP || '';
      if (rawProducts && supps.length === 0 && foods.length === 0) {
        const lower = rawProducts.toLowerCase();
        if (lower.includes('supplement') || lower.includes('enzyme') || lower.includes('powder')) {
          supplementMap['Supplements / Enzymes'] = (supplementMap['Supplements / Enzymes'] || 0) + 1;
          totalSupplementsCount++;
        }
        if (lower.includes('yakult') || lower.includes('vitagen') || lower.includes('milk') || lower.includes('yogurt') || lower.includes('drink')) {
          foodProductMap['Cultivated Milk & Dairy'] = (foodProductMap['Cultivated Milk & Dairy'] || 0) + 1;
          totalFoodProductsCount++;
        }
      }
    });

    return res.json({
      success: true,
      totalParticipants: eligibleRecords.length,
      demographics: {
        ageDistribution: Object.entries(ageBuckets).map(([label, value]) => ({ label, value })),
        districtDistribution: Object.entries(districtCounts).map(([label, value]) => ({ label, value })),
        educationDistribution: Object.entries(educationCounts).map(([label, value]) => ({ label, value })),
        spendingPowerDistribution: Object.entries(spendingCounts).map(([label, value]) => ({ label, value })),
      },
      gutHealthAwareness: {
        segmented: awarenessSegmented,
        mummyAwarenessRate: awarenessSegmented.mummy.total > 0
          ? Math.round((awarenessSegmented.mummy.aware / awarenessSegmented.mummy.total) * 100)
          : 0,
        elderlyAwarenessRate: awarenessSegmented.elderly.total > 0
          ? Math.round((awarenessSegmented.elderly.aware / awarenessSegmented.elderly.total) * 100)
          : 0,
      },
      understandings: understandings.slice(0, 15),
      solutions: Object.entries(solutionCounts)
        .filter(([, v]) => v > 0)
        .map(([label, value]) => ({ label, value })),
      productsPurchased: {
        totalSupplementsCount,
        totalFoodProductsCount,
        ratio: {
          supplements: totalSupplementsCount,
          foodProducts: totalFoodProductsCount,
        },
        topSupplements: Object.entries(supplementMap).map(([name, count]) => ({ name, count })),
        topFoods: Object.entries(foodProductMap).map(([name, count]) => ({ name, count })),
      },
    });
  } catch (err: any) {
    console.error('Empathy summary error:', err);
    return res.status(500).json({ error: err.message || 'Failed to compute empathy summary' });
  }
});

/**
 * AI Assistant Chat & Analytics Copilot
 * Uses gemini-3.8-flash to answer questions, generate charts (pie, bar, histogram, map, line),
 * and create custom formulas on the fly.
 */
app.post('/api/ai-assistant/chat', async (req: Request, res: Response) => {
  try {
    const { message, records = [], history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message string' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    const eligibleRecords = Array.isArray(records) ? records.filter((r: any) => isHumanVerifiedRecord(r)) : [];

    // Build condensed dataset context
    const datasetSummary = eligibleRecords.map((r: any, idx: number) => {
      const dec = r.adkotmDecode;
      return {
        id: r.id || `P${idx + 1}`,
        fileName: r.fileName,
        familyRole: dec?.demographic?.familyRole || dec?.postAnalysisCodes?.FR || 'null',
        age: dec?.demographic?.age || 'null',
        district: dec?.demographic?.residentialDistrict || dec?.demographic?.residentialLocation || dec?.postAnalysisCodes?.RL || 'null',
        educationLevel: dec?.demographic?.educationLevel || 'null',
        spendingPower: r.spendingPower?.spendingPowerTier || 'null',
        gutAwareness: dec?.knowledge?.awarenessLevel || dec?.knowledge?.awarenessOnGutHealth || 'null',
        understanding: dec?.knowledge?.understandingSummary || 'null',
        solutions: dec?.objects?.actionsToSolve || [],
        supplements: dec?.objects?.supplementProducts || [],
        foodProducts: dec?.objects?.foodProducts || [],
        brands: dec?.objects?.brandPreferences || dec?.postAnalysisCodes?.PP1 || 'null',
        interviewLocation: dec?.metadata?.interviewLocation || dec?.postAnalysisCodes?.IL || 'null',
      };
    });

    const prompt = `You are the Nutrition Empathy Study Copilot and Analytics Assistant.
You assist qualitative researchers analyzing interview recordings with parents, mummies, and elderly consumers in Malaysia (Klang Valley / Selangor / KL).

CURRENT DATASET SUMMARY (${datasetSummary.length} participants):
${JSON.stringify(datasetSummary, null, 2)}

USER REQUEST:
"${message}"

INSTRUCTIONS:
1. Provide a direct, empathetic, and insight-rich conversational response answering the user's specific request using the actual participants' data.
2. If the user asks for a chart, visualization, distribution, comparison, or breakdown (e.g., pie chart, bar chart, histogram, graph, map):
   - You MUST generate a "chartSpec" object in the JSON with:
     * type: "pie" | "bar" | "histogram" | "line" | "map"
     * title: clear descriptive title
     * description: key insight or takeaway
     * data: array of objects { label: string, value: number, secondaryValue?: number, color?: string, category?: string }
     * xAxisLabel: optional label for X axis
     * yAxisLabel: optional label for Y axis
3. If the user asks to add or create a new analytics formula or cross-analysis (e.g., "Add formula for Brand Loyalty", "Create an index for Health Proactivity"):
   - You MUST generate a "suggestedFormula" object in the JSON:
     * id: unique slug (e.g. "child_nutrition_risk")
     * name: formula title (e.g. "Child Nutrition Risk Score")
     * code: dimensional formula (e.g. "D + K + O")
     * analysisCodes: specific codes (e.g. "Age + AW + PP")
     * dimensions: array of dimension letters ["D", "K", "O"]
     * description: comprehensive qualitative rationale
     * outputTiers: e.g. ["High Risk", "Moderate Attention", "Balanced / Healthy"]
     * evaluationRules: clear logic how tiers are assigned
4. If no chart or formula is requested, set chartSpec and suggestedFormula to null.
5. Zero guessing rule: Only report what exists in the data. If a dimension is null, note it factually.

Return ONLY a valid JSON object matching this schema:
{
  "reply": "Clear, markdown-formatted conversational answer summarizing the findings...",
  "chartSpec": null or {
    "type": "pie",
    "title": "Gut Health Awareness: Mummy vs Elderly",
    "description": "Comparison of conscious awareness between demographic segments",
    "data": [
      { "label": "Mummy - Aware", "value": 8, "color": "#10b981" },
      { "label": "Mummy - Not Aware", "value": 3, "color": "#f59e0b" },
      { "label": "Elderly - Aware", "value": 2, "color": "#3b82f6" },
      { "label": "Elderly - Not Aware", "value": 6, "color": "#ef4444" }
    ],
    "xAxisLabel": "Segment & Awareness Status",
    "yAxisLabel": "Participant Count"
  },
  "suggestedFormula": null or {
    "id": "formula_id",
    "name": "Formula Name",
    "code": "A + D + K",
    "analysisCodes": "FR + AW",
    "dimensions": ["A", "D", "K"],
    "description": "Formula description...",
    "outputTiers": ["High", "Medium", "Low"],
    "evaluationRules": "Rule description..."
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');

    return res.json({
      success: true,
      reply: parsed.reply || 'Analysis complete.',
      chartSpec: parsed.chartSpec || null,
      suggestedFormula: parsed.suggestedFormula || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('AI Assistant error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to process AI assistant request',
      reply: 'An error occurred while analyzing the dataset. Please verify your query or try again.',
    });
  }
});

// Ensure unmatched /api/* requests always return JSON instead of falling through to SPA HTML
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Centralized Express error handler that always responds with JSON
app.use((err: any, _req: Request, res: Response, next: express.NextFunction) => {
  console.error('[Express Global Error]:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'SERVER_ERROR',
  });
});

// Start Express server and mount Vite
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server] Port ${PORT} already in use. Retrying in 1s...`);
      setTimeout(() => {
        server.close();
        server.listen(PORT, '0.0.0.0');
      }, 1000);
    } else {
      console.error('[Server Error]:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
});
