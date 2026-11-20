import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeInterviewText,
  cleanInterviewTranscript,
  countPreservedPronouns,
  countWords,
  needsEnglishTranslation,
  quickCleanLocal,
  sanitizeAiCleanedTranscript,
  stripQuestionSentences,
} from './textCleaning.ts';

test('Rule 1: preserves core meaning, standard stopwords, negations, pronouns, and plurals', () => {
  const input =
    'Participant: The children do not eat spicy food, and she likes to drink milk with them every morning.';

  const result = cleanInterviewTranscript(input);

  assert.equal(result.cleanedText.includes('\n'), false);
  assert.equal(result.cleanedText, result.cleanedText.toLowerCase());
  assert.match(result.cleanedText, /\bthe children do not eat spicy food\b/);
  assert.match(result.cleanedText, /\bshe likes to drink milk with them every morning\b/);
  assert.ok(result.preservedPronounsCount >= 2);
});

test('Rule 2: strictly removes all interviewer turns and standalone question lines with zero context merging', () => {
  const ageDialogue = `Interviewer: How old is he?
Parent: Ten`;
  assert.equal(cleanInterviewTranscript(ageDialogue).cleanedText, 'ten');
  assert.equal(cleanInterviewTranscript(ageDialogue, undefined, 'post_ai').cleanedText, 'ten');

  const kidDialogue = `Moderator: So you have only one kid?
Participant: Yes, only one`;
  assert.equal(cleanInterviewTranscript(kidDialogue).cleanedText, 'yes, only one');

  const foodDialogue = `I: What type of food does he eat?
Parent: Mango`;
  assert.equal(cleanInterviewTranscript(foodDialogue).cleanedText, 'mango');

  const unlabelledAndExpandedLabels = `How old is your child?
Ten.
Int: Does she drink Yakult?
Parent: I buy Yakult every week.
What brand does your husband prefer?
Parent: I think he prefers Vitagen.`;
  const unlabelledRes = cleanInterviewTranscript(unlabelledAndExpandedLabels);
  assert.equal(
    unlabelledRes.cleanedText,
    'ten. i buy yakult every week. i think he prefers vitagen.'
  );
  assert.equal(unlabelledRes.stats.removedInterviewerTurns, 3);

  const selfExplanatory = `Q: Can you tell me about your cooking and her diet?
Parent: I cook every day. She is a swimmer so she needs a lot of protein and carbs.`;
  const selfRes = cleanInterviewTranscript(selfExplanatory);
  assert.equal(
    selfRes.cleanedText,
    'i cook every day. she is a swimmer so she needs a lot of protein and carbs.'
  );
  assert.equal(/tell me about/i.test(selfRes.cleanedText), false);
});

test('Rule 2b: Quick Clean always strips any sentence ending with a question mark across turns and mid-paragraph while preserving decimals & abbreviations', () => {
  const inlineParagraph =
    'Yeah, I buy Yakult. How often do you buy it? Every week. What about Vitagen? Sometimes I buy Dr. Tan e.g. Vitagen 2.5 liters.';
  const inlineRes = cleanInterviewTranscript(inlineParagraph, undefined, 'deterministic');
  assert.equal(
    inlineRes.cleanedText,
    'i buy yakult. every week. sometimes i buy dr. tan e.g. vitagen 2.5 liters.'
  );
  assert.equal(/[?？]/.test(inlineRes.cleanedText), false);

  const participantWithQuestions = `Participant: She likes yogurt? No, she prefers milk! Do you buy "less sweet?" Yes, "less sweet" and No. 2 size.
Wait... what brand？
Parent: Anak saya minum 1.5 liter setiap hari。孩子几岁？Ten years old.`;
  const partRes = cleanInterviewTranscript(participantWithQuestions, undefined, 'deterministic');
  assert.equal(
    partRes.cleanedText,
    'no, she prefers milk! yes, "less sweet" and no. 2 size. my child drink 1.5 liter every day。 ten years old.'
  );
  assert.equal(/[?？]/.test(partRes.cleanedText), false);

  // Nested fillers inside a deleted question must not leak fragments
  assert.equal(
    stripQuestionSentences('Um, how old is he? Ten. Wait, why?'),
    'Ten.'
  );
  assert.equal(
    cleanInterviewTranscript('Participant: Um, how old? (really?) Ten.', undefined, 'deterministic').cleanedText,
    'ten.'
  );
});

test('Rule 3: removes fillers, phatic expressions, noise tags, timestamps, and repeated stutters while keeping verb like', () => {
  const input = `[00:05] Interviewer: Hello! Thank you for joining us today. What does your child eat?
[00:12] Participant: *indecipherable* Oh, um, ayaya, basically, you know, I buy Vitagen every every day -- [笑声] uh, no no I I know she likes to eat yogurt, sort of, actually. Thank you so much! Oh okay, bye bye.`;

  const result = cleanInterviewTranscript(input);

  // Fillers removed, verb "likes" preserved
  assert.equal(/\b(uh|um|ah|er|hmm|ayaya|basically|actually|oh)\b/i.test(result.cleanedText), false);
  assert.equal(/you know|sort of|kind of/i.test(result.cleanedText), false);
  assert.match(result.cleanedText, /she likes to eat yogurt/);

  // Phatic expressions removed
  assert.equal(/thank you|oh okay|okay|bye|hello/i.test(result.cleanedText), false);

  // Noise, timestamps, and repeated stutters removed
  assert.equal(/00:05|00:12|indecipherable|笑声|--/i.test(result.cleanedText), false);
  assert.match(result.cleanedText, /\bi buy vitagen every day\b/);
  assert.match(result.cleanedText, /\bi know she likes to eat yogurt\b/);
  assert.equal(/\bno no\b/i.test(result.cleanedText), false);
});

test('Rule 4 & Rule 5: strips all speaker headers regardless of formatting and outputs lowercase single-spaced text', () => {
  const input = `[Interviewer]: Good morning! Do you buy probiotic drinks?
[Speaker]:   Yeah, I buy Yakult.
**Parent:**   I   cook   vegetables
at   home.`;

  const result = cleanInterviewTranscript(input);

  assert.equal(/interviewer|speaker|parent|participant/i.test(result.cleanedText), false);
  assert.equal(result.cleanedText.includes('\n'), false);
  assert.equal(/\s{2,}/.test(result.cleanedText), false);
  assert.equal(result.cleanedText, result.cleanedText.toLowerCase());
  assert.match(result.cleanedText, /i buy yakult/);
  assert.match(result.cleanedText, /i cook vegetables at home/);
});

test('canonicalizeInterviewText translates Malay/Chinese terms while preserving negations and brand names', () => {
  const input =
    'Participant: UM saya tak makan sayur-sayuran, tapi anak saya minum Yakult setiap hari and she likes buah-buahan and air suam.';

  const result = canonicalizeInterviewText(input);

  assert.equal(result.includes('um'), false);
  assert.match(result, /\bi do not eat vegetables\b/);
  assert.match(result, /\bmy child drink yakult every day\b|\bmy child\b/);
  assert.match(result, /\byakult\b/);
  assert.match(result, /\bshe likes fruits\b/);
  assert.match(result, /\bwarm water\b/);
  assert.equal(result, result.toLowerCase());
});

test('cleanInterviewTranscript always strips ? questions in Quick Clean even when removeInterviewer=false, while leaving post_ai mode independent', () => {
  const input = `Interviewer: Let us talk about groceries. How often do you shop?
Participant: [noise] Um, I shop weekly, thank you.`;

  const quickKeepInterviewer = cleanInterviewTranscript(
    input,
    {
      removeInterviewer: false,
      removeFillers: true,
      removePhatic: true,
      removeNoise: true,
    },
    'deterministic'
  );

  // Quick Clean retains non-question interviewer statements when removeInterviewer=false,
  // but ALWAYS strips every question sentence ending in '?'
  assert.match(quickKeepInterviewer.cleanedText, /let us talk about groceries\./);
  assert.equal(/how often do you shop\?/.test(quickKeepInterviewer.cleanedText), false);
  assert.equal(/interviewer|participant/i.test(quickKeepInterviewer.cleanedText), false);
  assert.equal(/\bum\b/i.test(quickKeepInterviewer.cleanedText), false);
  assert.equal(/thank you/i.test(quickKeepInterviewer.cleanedText), false);
  assert.equal(/\[noise\]/i.test(quickKeepInterviewer.cleanedText), false);
  assert.equal(countWords(quickKeepInterviewer.cleanedText), 8);
  assert.equal(countPreservedPronouns(quickKeepInterviewer.cleanedText), 2);

  // post_ai mode does not enforce Quick Clean question stripping when removeInterviewer=false
  const postAiKeepInterviewer = cleanInterviewTranscript(
    input,
    { removeInterviewer: false },
    'post_ai'
  );
  assert.match(postAiKeepInterviewer.cleanedText, /how often do you shop\?/);

  const malayInput = 'Participant: Saya tak makan sayur tapi beli Yakult setiap hari.';
  const keepOriginal = cleanInterviewTranscript(malayInput, { translateToEnglish: false });
  assert.match(keepOriginal.cleanedText, /\bsaya tak makan sayur\b/);
  assert.match(keepOriginal.cleanedText, /\byakult\b/);
});

test('needsEnglishTranslation detects CJK and untranslated Malay while passing clean English with brand names', () => {
  assert.equal(
    needsEnglishTranslation('i buy yakult and vitagen every week for my child because she likes yogurt'),
    false
  );
  assert.equal(needsEnglishTranslation('i buy bio gaia and karihome goat milk'), false);
  assert.equal(needsEnglishTranslation('她每天早上都喝 yakult'), true);
  assert.equal(needsEnglishTranslation('kadangkala mereka pergi ke klinik berdekatan'), true);
  assert.equal(needsEnglishTranslation('dia suka makan buah-buahan'), true);
});

test('Rule 6: Quick Clean aggressively deduplicates echoed words/phrases, removes Malay/Chinese fillers & phatics, and removes unlabelled interviewer lines', () => {
  const input = `[00:00] Hello miss, I think.
Kami buat yang gut health kerana saya dari food company.
Berapa tahun anak
Dia ialah boy or girl
[00:05] I, I think I, I choosing yogurt lah. He likes gut, gut health and kesihatan sistem dalam.
Boy. Boy.
Fruits. Fruits.
He only likes yogurt, so I buy it sometimes.
Thank you, terima kasih, maaf, ya, aiyo, eh, hah, mhm. Yes.`;

  const res = cleanInterviewTranscript(input, undefined, 'deterministic');

  assert.equal(/hello|terima kasih|maaf|aiyo|\bya\b|\blah\b|\beh\b|\bhah\b|\bmhm\b|food company|berapa tahun|boy or girl/i.test(res.cleanedText), false);
  assert.equal(/gut,\s*gut|boy\.\s*boy|fruits\.\s*fruits|i,\s*i/i.test(res.cleanedText), false);
  assert.match(res.cleanedText, /i choosing yogurt\./);
  assert.match(res.cleanedText, /internal digestive system health/);
  assert.match(res.cleanedText, /boy\. fruits\./);
  assert.match(res.cleanedText, /he only likes yogurt, so i buy it sometimes\./);
  assert.equal(/\byes\b/.test(res.cleanedText), false);
});

test('Rule 7: quickCleanLocal runs deterministically offline, handles Tak ada. Tak adalah., ha filler, researching intros, and keeps unknown tokens raw', () => {
  const mixed = `[00:00] Hello miss, we are researching gut health for a food company.
Speaker: [Laughter] Berapa tahun anak? 10.
Parent: Tak ada. Tak adalah. Boy. Boy. Ha, only eat sayur sometimes with special_local_term.`;

  const translatedRes = quickCleanLocal(mixed);
  assert.equal(/food company|researching|berapa tahun|hello|laughter|00:00|\bha\b/i.test(translatedRes.cleanedText), false);
  assert.equal(/[?]/.test(translatedRes.cleanedText), false);
  assert.equal(translatedRes.cleanedText, '10. do not have. boy. only eat vegetables sometimes with special_local_term.');

  const untranslatedRes = quickCleanLocal('Tak ada. Tak adalah. Boy. Boy.', { translateToEnglish: false });
  assert.equal(untranslatedRes.cleanedText, 'tak ada. boy.');
});

test('Rule 8: sanitizeAiCleanedTranscript strips stray questions, keeps verbatim short replies & stopwords, and preserves proper-name casing', () => {
  const aiOutput = `[00:00] Hello miss. Because I am from a food company, now we make gut health.
Does he drink yogurt every day?
Parent: Child. Child, I, I think I, I choosing yogurt lah, so I like yogurt.
10. Already grown up. Boy. Boy.
He likes yogurt. Gut health is health of the internal system.
Do not have. Do not have. He only likes yogurt, so buy it sometimes at AEON Mall and Jaya Grocer with Vitagen and Yakult.
Anyway, look, basically he actually only eats vegetables, fruits. Fruits. *laughter* Terima kasih, maaf, aiyo, huh, mm, aiyo, i understand, no worries.`;

  const res = sanitizeAiCleanedTranscript(aiOutput);

  assert.equal(res.cleanedText.includes('\n'), false);
  assert.equal(/[?]/.test(res.cleanedText), false);
  assert.equal(/hello|food company|terima kasih|maaf|aiyo|\bhuh\b|\bmm\b|lah|laughter|00:00|parent:|does he drink|basically|actually|anyway|i understand|no worries/i.test(res.cleanedText), false);
  assert.equal(/child\.\s*child|boy\.\s*boy|fruits\.\s*fruits|i,\s*i|do not have\.\s*do not have/i.test(res.cleanedText), false);

  assert.match(res.cleanedText, /child, i choosing yogurt, so i like yogurt\./);
  assert.match(res.cleanedText, /10\. already grown up\. boy\./);
  assert.match(res.cleanedText, /do not have\. he only likes yogurt, so buy it sometimes at AEON Mall and Jaya Grocer with Vitagen and Yakult\./);
  assert.match(res.cleanedText, /only eat[s]? vegetables, fruits\./);
});

test('Rule 9: sanitizeAiCleanedTranscript preserves brand/store/proper names while removing discourse crutches and preserving verb like', () => {
  const input =
    'Participant: Listen, honestly, I buy Biogaya, Amway, Lotus, Publika, Brem Mall, and Vitagen because Dr. Tan said it helps. Anyway, she likes yogurt and, literally, she just drinks Yakult. Look, I understand. You\'re welcome.';
  const res = sanitizeAiCleanedTranscript(input);

  assert.match(res.cleanedText, /\bBiogaya\b/);
  assert.match(res.cleanedText, /\bAmway\b/);
  assert.match(res.cleanedText, /\bLotus\b/);
  assert.match(res.cleanedText, /\bPublika\b/);
  assert.match(res.cleanedText, /\bBrem Mall\b/);
  assert.match(res.cleanedText, /\bVitagen\b/);
  assert.match(res.cleanedText, /\bYakult\b/);
  assert.match(res.cleanedText, /\bDr\.? Tan\b|\bdr\. tan\b/i);
  assert.match(res.cleanedText, /\bshe likes yogurt\b/);
  assert.equal(/\b(listen|honestly|anyway|literally|i understand|you're welcome)\b/i.test(res.cleanedText), false);
});


