// The lesson agent.
//   intake()        pre-fills the teacher's step-2 questions from the document
//   makeSlides()    slides grounded in the document (each carries its source quote)
//   editSlide()     per-slide "rewrite" / "simpler"
//   makeExercises() skills + template items, then a self-check loop: maths recomputed in code,
//                   English structural checks, a Gemini reviewer, failing items regenerated
//   makeCards()     flashcards + memory-game pairs
//   tagError()      why a pupil's answer is wrong + a gentle hint (cached per answer)
//   draftComments() TT27-style comment drafts for the teacher
import type { AI } from '../ai/provider.ts';
import { config } from '../config.ts';
import type { CheckLog, CheckResult, Exercise, Flashcard, Intake, Level, MemoryPair, Skill, Slide } from '../types.ts';
import { checkMath } from './mathcheck.ts';
import {
  CARDS_SCHEMA, CARDS_SYSTEM, COMMENT_SCHEMA, COMMENT_SYSTEM, ENG_TYPES, ERROR_SCHEMA, ERROR_SYSTEM, exercisesSchema, EXERCISES_SYSTEM, fill,
  INTAKE_SCHEMA, INTAKE_SYSTEM, LESSON_SCHEMA, LESSON_SYSTEM, MATH_TYPES, REVIEW_SCHEMA, REVIEW_SYSTEM, SLIDE_EDIT_SYSTEM, SLIDE_SCHEMA,
} from './prompts.ts';

const LANG_NAME = { vi: 'Vietnamese', en: 'English' } as const;
const TEMPLATE_HELP: Record<string, string> = {
  math_mcq: 'math_mcq: multiple choice, 3-4 options', math_fill: 'math_fill: fill the box', math_truefalse: 'math_truefalse: true or false',
  math_word: 'math_word: word problem', eng_match: 'eng_match: match word to picture', eng_fill: 'eng_fill: fill the missing word',
  eng_listen: 'eng_listen: listen and choose', eng_order: 'eng_order: put words in order',
};
const noteLine = (it: Intake) => (it.note?.trim() ? `Teacher's note: ${it.note.trim()}` : '');
const pad = (n: number) => String(n).padStart(2, '0');

export async function intake(ai: AI, source: string): Promise<Intake> {
  const r = await ai.json<Intake>({ task: 'intake', tier: 'fast', system: INTAKE_SYSTEM, prompt: `DOCUMENT:\n${source}`, schema: INTAKE_SCHEMA, input: { source } });
  const minutes = [15, 25, 35].reduce((b, m) => (Math.abs(m - (r.minutes || 25)) < Math.abs(b - (r.minutes || 25)) ? m : b), 25);
  return { ...r, grade: Math.min(5, Math.max(1, Math.round(r.grade))) as Intake['grade'], minutes, objectives: r.objectives.slice(0, 2),
    // everything ticked by default; the teacher unticks what they don't want (Gemini's guess here was unreliable)
    outputs: ['slides', 'video', 'exercises', 'flashcards'] };
}

export const slideCount = (minutes: number) => (minutes <= 15 ? 8 : minutes <= 25 ? 10 : 12);

export async function makeSlides(ai: AI, source: string, it: Intake): Promise<Slide[]> {
  const count = slideCount(it.minutes);
  const r = await ai.json<{ slides: Omit<Slide, 'id'>[] }>({ task: 'lesson', tier: 'pro',
    system: fill(LESSON_SYSTEM, { count, langName: LANG_NAME[it.lang], grade: it.grade, videoMin: 2, videoMax: 4, note: noteLine(it) }),
    prompt: `SETUP:\n${JSON.stringify(it)}\n\nDOCUMENT:\n${source}`, schema: LESSON_SCHEMA, input: { source, intake: it, count } });
  return r.slides.map((s, i) => ({ ...s, id: `sl${pad(i + 1)}`, bullets: (s.bullets || []).filter(Boolean).slice(0, 4), source: s.source || '' }));
}

export async function editSlide(ai: AI, slide: Slide, how: 'rewrite' | 'simpler', it: Intake): Promise<Slide> {
  const r = await ai.json<Omit<Slide, 'id'>>({ task: 'slide-edit', tier: 'fast', system: SLIDE_EDIT_SYSTEM,
    prompt: `ACTION: ${how}\nGRADE: ${it.grade}\nSLIDE:\n${JSON.stringify(slide)}`, schema: SLIDE_SCHEMA, input: { slide, how } });
  return { ...slide, ...r, id: slide.id, image: slide.image, bullets: (r.bullets || []).slice(0, 4) };
}

// Checks the model can't be trusted with and code can do exactly.
export function checkLocal(ex: Exercise): CheckResult {
  if (ex.type.startsWith('math_')) return checkMath(ex);
  const issues: string[] = [];
  const inOpts = (opts: string[], a: string) => opts.filter((o) => o.trim().toLowerCase() === a.trim().toLowerCase()).length === 1;
  switch (ex.type) {
    case 'eng_fill':
      if ((ex.sentence.match(/_{2,}/g) || []).length !== 1) issues.push('sentence needs exactly one ___ gap');
      if (!inOpts(ex.options, ex.answer)) issues.push('answer must be exactly one of the options');
      break;
    case 'eng_listen':
      if (!inOpts(ex.options, ex.answer)) issues.push('answer must be exactly one of the options');
      if (!ex.say?.trim()) issues.push('nothing to say aloud');
      break;
    case 'eng_order': {
      const bag = (s: string) => s.toLowerCase().replace(/[.!?,]/g, '').split(/\s+/).filter(Boolean).sort().join(' ');
      if (bag(ex.words.join(' ')) !== bag(ex.answer)) issues.push('answer does not use exactly the given words');
      if (ex.words.join(' ').toLowerCase() === ex.answer.toLowerCase().replace(/[.!?]$/, '')) issues.push('words are not shuffled');
      break;
    }
    case 'eng_match': {
      const words = ex.pairs.map((p) => p.word.toLowerCase()), emo = ex.pairs.map((p) => p.emoji);
      if (ex.pairs.length < 3) issues.push('needs at least 3 pairs');
      if (new Set(words).size !== words.length || new Set(emo).size !== emo.length) issues.push('words and pictures must be unique');
      break;
    }
  }
  return { ok: !issues.length, issues };
}

type RawItem = Record<string, any>;
const toExercise = (r: RawItem, id: string, skills: Skill[]): Exercise =>
  ({ ...r, ...(r.type === 'math_truefalse' && !/[=<>≤≥]/.test(String(r.statement ?? '')) ? { statement: /[(\d][\d\s+\-×x*:÷()]*(?:<=|>=|≤|≥|=|<|>)[\d\s+\-×x*:÷()]*[\d)]/.exec(r.prompt || '')?.[0]?.trim() ?? r.statement } : {}), id, level: r.level as Level, skill: skills.some((s) => s.tag === r.skill) ? r.skill : skills[0]?.tag || 'general',
    options: r.options || [], words: r.words || [], pairs: r.pairs || [] } as unknown as Exercise);

export interface ExerciseResult { skills: Skill[]; exercises: Exercise[]; checks: CheckLog[] }

export async function makeExercises(ai: AI, source: string, it: Intake, slides: Slide[], log: (m: string) => void = () => {}, perLevel = 4): Promise<ExerciseResult> {
  const types = it.subject === 'math' ? MATH_TYPES : ENG_TYPES;
  const system = fill(EXERCISES_SYSTEM, { templates: types.map((t) => `- ${TEMPLATE_HELP[t]}`).join('\n'), perLevel, grade: it.grade, langName: LANG_NAME[it.lang], note: noteLine(it) });
  const lesson = `SETUP:\n${JSON.stringify(it)}\n\nLESSON SLIDES:\n${JSON.stringify(slides.map(({ heading, bullets, example }) => ({ heading, bullets, example })))}\n\nDOCUMENT:\n${source}`;
  const gen = async (prompt: string, input: unknown) => {
    const r = await ai.json<{ skills: Skill[]; items: RawItem[] }>({ task: 'exercises', tier: (input as { redo?: unknown }).redo ? 'fast' : 'pro', system, prompt, schema: exercisesSchema(types), input });
    return { skills: r.skills || [], items: (r.items || []).filter((x) => types.includes(x.type)) };
  };

  const first = await gen(lesson, { intake: it, slides, perLevel });
  const skills = first.skills.filter((s, i, a) => s.tag && a.findIndex((x) => x.tag === s.tag) === i).slice(0, 4);
  let items = first.items.map((r, i) => toExercise(r, `ex${pad(i + 1)}`, skills));
  const history = new Map<string, string[]>(), tries = new Map<string, number>(items.map((e) => [e.id, 1]));

  for (let round = 0; ; round++) {
    // 1. code checks; maths answers code can compute are fixed in place
    const failing = new Map<string, string[]>();
    items = items.map((e) => {
      const c = checkLocal(e);
      if (!c.ok && c.fixedAnswer !== undefined && c.issues.length === 1 && c.issues[0].startsWith('answer ')) {
        history.set(e.id, [...(history.get(e.id) || []), `fixed by code: ${c.issues[0]}`]);
        return { ...e, answer: c.fixedAnswer } as Exercise;
      }
      if (!c.ok) failing.set(e.id, c.issues);
      return e;
    });
    // 2. Gemini review of what passed the code checks
    const toReview = items.filter((e) => !failing.has(e.id));
    if (toReview.length) {
      const rv = await ai.json<{ results: { id: string; ok: boolean; issues: string[] }[] }>({ task: 'review', tier: 'fast', system: fill(REVIEW_SYSTEM, { grade: it.grade }),
        prompt: `LESSON: ${it.title}\nSKILLS: ${JSON.stringify(skills)}\nITEMS:\n${JSON.stringify(toReview)}`, schema: REVIEW_SCHEMA, input: { items: toReview, round } });
      for (const r of rv.results) if (!r.ok && toReview.some((e) => e.id === r.id)) failing.set(r.id, r.issues);
    }
    for (const [id, iss] of failing) history.set(id, [...(history.get(id) || []), ...iss]);
    if (!failing.size) break;
    if (round >= config.maxFixRounds) { log(`bỏ ${failing.size} câu vẫn chưa đạt sau ${round} lượt sửa`); items = items.filter((e) => !failing.has(e.id)); break; }
    // 3. regenerate only the failing items, telling the model what was wrong
    log(`tự kiểm tra lượt ${round + 1}: viết lại ${failing.size} câu`);
    const bad = items.filter((e) => failing.has(e.id));
    const redo = await gen(`${lesson}\n\nREWRITE these ${bad.length} items, same template and level, fixing the issues (you may switch "skill" to a better-matching tag from SKILLS: ${skills.map((k) => k.tag).join(', ')}). Return the same skills and exactly ${bad.length} items in the same order.\n${JSON.stringify(bad.map((e) => ({ item: e, issues: failing.get(e.id) })))}`,
      { redo: bad, issues: Object.fromEntries(failing) });
    bad.forEach((e, k) => {
      if (!redo.items[k]) return;
      const sk = skills.some((x) => x.tag === redo.items[k].skill) ? redo.items[k].skill : e.skill;
      items[items.findIndex((x) => x.id === e.id)] = toExercise({ ...redo.items[k], level: e.level, skill: sk }, e.id, skills);
      tries.set(e.id, (tries.get(e.id) || 1) + 1);
    });
  }
  const used = new Set(items.map((e) => e.skill));
  return { skills: skills.filter((s) => used.has(s.tag)), exercises: items, checks: [...history].map(([exercise, issues]) => ({ exercise, attempts: tries.get(exercise) || 1, issues })) };
}

export async function makeCards(ai: AI, source: string, it: Intake): Promise<{ flashcards: Flashcard[]; pairs: MemoryPair[] }> {
  const r = await ai.json<{ flashcards: Omit<Flashcard, 'id'>[]; pairs: Omit<MemoryPair, 'id'>[] }>({ task: 'cards', tier: 'fast',
    system: fill(CARDS_SYSTEM, { nCards: 8, grade: it.grade }), prompt: `SETUP:\n${JSON.stringify(it)}\n\nDOCUMENT:\n${source}`, schema: CARDS_SCHEMA, input: { intake: it } });
  const sides = new Set<string>();
  const pairs = (r.pairs || []).filter((p) => p.a && p.b && p.a !== p.b && !sides.has(p.a) && !sides.has(p.b) && !!sides.add(p.a) && !!sides.add(p.b)).slice(0, 4);
  const noEmoji = (t: string) => t.replace(/\p{Extended_Pictographic}\uFE0F?/gu, '').replace(/\s{2,}/g, ' ').trim();
  return { flashcards: (r.flashcards || []).slice(0, 12).map((c, i) => ({ ...c, front: c.emoji ? noEmoji(c.front) || c.front : c.front, id: `fc${pad(i + 1)}` })), pairs: pairs.map((p, i) => ({ ...p, id: `mp${i + 1}` })) };
}

export async function tagError(ai: AI, ex: Exercise, given: string, grade: number, known: string[]): Promise<{ errorType: string; hint: string }> {
  const correct = ex.type === 'eng_match' ? JSON.stringify(Object.fromEntries(ex.pairs.map((p) => [p.word, p.emoji]))) : (ex as { answer: string }).answer;
  return ai.json({ task: 'error', tier: 'fast', system: fill(ERROR_SYSTEM, { grade, known: known.length ? known.map((k) => `"${k}"`).join(', ') : '(none yet)' }),
    prompt: `ITEM:\n${JSON.stringify(ex)}\nCORRECT ANSWER: ${correct}\nPUPIL'S ANSWER: ${given}`, schema: ERROR_SCHEMA, input: { ex, given } });
}

export async function draftComments(ai: AI, lessonTitle: string, rows: { pupilId: string; name: string; skill: string; label: string; error?: string }[]): Promise<{ pupilId: string; text: string }[]> {
  if (!rows.length) return [];
  const r = await ai.json<{ comments: { pupilId: string; text: string }[] }>({ task: 'comments', tier: 'fast', system: COMMENT_SYSTEM,
    prompt: `LESSON: ${lessonTitle}\nPUPILS (skill, label, repeated error):\n${JSON.stringify(rows)}`, schema: COMMENT_SCHEMA, input: { rows } });
  return r.comments;
}
