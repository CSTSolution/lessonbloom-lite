// The lesson agent. intake() pre-fills the teacher's form; makeSlides() writes the slide deck;
// makeExercises() writes template exercises and then checks them itself:
//   maths answers are recomputed in code, English items get structural checks, every item is
//   reviewed by Gemini, and failing items are regenerated (up to maxFixRounds) or dropped.
// Every check is recorded so the teacher (and the judges) can see what was caught.
import type { AI } from '../ai/provider.ts';
import { config } from '../config.ts';
import type { CheckResult, Exercise, Intake, Level, Slide } from '../types.ts';
import { checkMath } from './mathcheck.ts';
import { ENG_TYPES, EXERCISES_SCHEMA, EXERCISES_SYSTEM, fill, INTAKE_SCHEMA, INTAKE_SYSTEM, LESSON_SCHEMA, LESSON_SYSTEM, MATH_TYPES, REVIEW_SCHEMA, REVIEW_SYSTEM } from './prompts.ts';

const LANG_NAME = { vi: 'Vietnamese', en: 'English' } as const;
const TEMPLATE_HELP: Record<string, string> = {
  math_mcq: 'math_mcq: multiple choice, 3-4 options', math_fill: 'math_fill: fill the box', math_truefalse: 'math_truefalse: true or false',
  math_word: 'math_word: word problem', eng_match: 'eng_match: match word to picture', eng_fill: 'eng_fill: fill the missing word',
  eng_listen: 'eng_listen: listen and choose', eng_order: 'eng_order: put words in order',
};

export async function intake(ai: AI, source: string): Promise<Intake> {
  const r = await ai.json<Intake>({ task: 'intake', tier: 'fast', system: INTAKE_SYSTEM, prompt: `DOCUMENT:\n${source}`, schema: INTAKE_SCHEMA, input: { source } });
  return { ...r, grade: Math.min(5, Math.max(1, Math.round(r.grade))) as Intake['grade'], minutes: r.minutes || 35, objectives: r.objectives.slice(0, 3) };
}

export const slideCount = (minutes: number) => Math.max(8, Math.min(12, Math.round(minutes / 4)));

export async function makeSlides(ai: AI, source: string, it: Intake): Promise<Slide[]> {
  const count = slideCount(it.minutes);
  const r = await ai.json<{ slides: Omit<Slide, 'id'>[] }>({ task: 'lesson', tier: 'pro',
    system: fill(LESSON_SYSTEM, { count, langName: LANG_NAME[it.lang], grade: it.grade, videoMin: 2, videoMax: 4 }),
    prompt: `SETUP:\n${JSON.stringify(it)}\n\nDOCUMENT:\n${source}`, schema: LESSON_SCHEMA, input: { source, intake: it, count } });
  return r.slides.map((s, i) => ({ ...s, id: `sl${String(i + 1).padStart(2, '0')}`, bullets: (s.bullets || []).slice(0, 4) }));
}

// Checks the model cannot be trusted with and code can do exactly.
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
const toExercise = (r: RawItem, id: string): Exercise => ({ ...r, id, level: r.level as Level, options: r.options || [], words: r.words || [], pairs: r.pairs || [] } as unknown as Exercise);

export interface ExerciseResult { exercises: Exercise[]; checks: { exercise: string; attempts: number; issues: string[] }[] }

export async function makeExercises(ai: AI, source: string, it: Intake, slides: Slide[], log: (m: string) => void = () => {}, perLevel = 4): Promise<ExerciseResult> {
  const types = it.subject === 'math' ? MATH_TYPES : ENG_TYPES;
  const system = fill(EXERCISES_SYSTEM, { templates: types.map((t) => `- ${TEMPLATE_HELP[t]}`).join('\n'), perLevel, grade: it.grade, langName: LANG_NAME[it.lang] });
  const lesson = `SETUP:\n${JSON.stringify(it)}\n\nLESSON SLIDES:\n${JSON.stringify(slides.map(({ heading, bullets, example }) => ({ heading, bullets, example })))}\n\nDOCUMENT:\n${source}`;
  const gen = async (prompt: string, input: unknown) =>
    (await ai.json<{ items: RawItem[] }>({ task: 'exercises', tier: 'pro', system, prompt, schema: EXERCISES_SCHEMA, input })).items.filter((r) => types.includes(r.type));

  let items = (await gen(lesson, { intake: it, slides, perLevel })).map((r, i) => toExercise(r, `ex${String(i + 1).padStart(2, '0')}`));
  const history = new Map<string, string[]>();
  const tries = new Map<string, number>(items.map((e) => [e.id, 1]));

  for (let round = 0; ; round++) {
    // 1. code checks; maths answers that code can compute are fixed in place
    const failing = new Map<string, string[]>();
    items = items.map((e) => {
      const c = checkLocal(e);
      const fixable = !c.ok && c.fixedAnswer !== undefined && c.issues.length === 1 && c.issues[0].startsWith('answer ');
      if (fixable) {
        history.set(e.id, [...(history.get(e.id) || []), `fixed by code: ${c.issues[0]}`]);
        return { ...e, answer: c.fixedAnswer } as Exercise;
      }
      if (!c.ok) failing.set(e.id, c.issues);
      return e;
    });
    // 2. Gemini review of everything that passed the code checks
    const toReview = items.filter((e) => !failing.has(e.id));
    if (toReview.length) {
      const rv = await ai.json<{ results: { id: string; ok: boolean; issues: string[] }[] }>({ task: 'review', tier: 'fast', system: fill(REVIEW_SYSTEM, { grade: it.grade }),
        prompt: `LESSON: ${it.title}\nITEMS:\n${JSON.stringify(toReview)}`, schema: REVIEW_SCHEMA, input: { items: toReview, round } });
      for (const r of rv.results) if (!r.ok && toReview.some((e) => e.id === r.id)) failing.set(r.id, r.issues);
    }
    for (const [id, iss] of failing) history.set(id, [...(history.get(id) || []), ...iss]);
    if (!failing.size) break;
    if (round >= config.maxFixRounds) {
      log(`dropping ${failing.size} item(s) that still fail after ${round} fix rounds`);
      items = items.filter((e) => !failing.has(e.id));
      break;
    }
    // 3. regenerate only the failing items, telling the model what was wrong
    log(`round ${round + 1}: regenerating ${failing.size} item(s)`);
    const bad = items.filter((e) => failing.has(e.id));
    const redo = await gen(`${lesson}\n\nREWRITE these ${bad.length} items, same template and level, fixing the issues. Return exactly ${bad.length} items in the same order.\n${JSON.stringify(bad.map((e) => ({ item: e, issues: failing.get(e.id) })))}`, { redo: bad, issues: Object.fromEntries(failing) });
    bad.forEach((e, k) => {
      if (!redo[k]) return;
      const i = items.findIndex((x) => x.id === e.id);
      items[i] = toExercise({ ...redo[k], level: e.level }, e.id);
      tries.set(e.id, (tries.get(e.id) || 1) + 1);
    });
  }
  const checks = [...history].map(([exercise, issues]) => ({ exercise, attempts: tries.get(exercise) || 1, issues }));
  return { exercises: items, checks };
}
