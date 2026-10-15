// npm run make -- <lesson.txt> [--mock] [--no-images]  ->  data/<id>/lesson.json (+ images)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { GeminiProvider } from './ai/gemini.ts';
import { MockProvider } from './ai/mock.ts';
import type { AI } from './ai/provider.ts';
import { config } from './config.ts';
import { intake, makeCards, makeExercises, makeSlides } from './lesson/build.ts';
import { illustrate } from './lesson/illustrate.ts';
import type { Lesson } from './types.ts';

const args = process.argv.slice(2), flag = (f: string) => args.includes(f);
const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('usage: npm run make -- <lesson.txt> [--mock] [--no-images]'); process.exit(1); }
const mock = flag('--mock') || !(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_USE_VERTEXAI);
const ai: AI = mock ? new MockProvider() : new GeminiProvider();
const t0 = Date.now(), log = (m: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s  ${m}`);

const source = await readFile(file, 'utf8');
log(`provider: ${ai.name}`);
const it = await intake(ai, source);
log(`intake: ${it.subject}, grade ${it.grade}, "${it.title}", ${it.minutes} min, ${it.lang}`);
const slides = await makeSlides(ai, source, it);
log(`slides: ${slides.length}`);
const ex = await makeExercises(ai, source, it, slides, (m) => log(m.en));
log(`exercises: ${ex.exercises.length} kept, ${ex.checks.length} caught by the self-check`);
for (const c of ex.checks) log(`  ${c.exercise} (try ${c.attempts}): ${c.issues.join('; ')}`);

const id = `${basename(file).replace(/\.\w+$/, '')}-${ai.name}`;
const dir = join(config.dataDir, id);
await mkdir(dir, { recursive: true });
if (!flag('--no-images')) {
  for (const s of slides) {
    const pic = await illustrate(ai, s, log);
    s.image = `${s.id}.${pic.ext}`;
    await writeFile(join(dir, s.image), pic.image);
  }
}
const cards = await makeCards(ai, source, it);
log(`flashcards: ${cards.flashcards.length}, memory pairs: ${cards.pairs.length}; skills: ${ex.skills.map((s) => s.name).join(', ')}`);
const lesson: Lesson = { id, teacherId: 'cli', createdAt: new Date().toISOString(), status: 'ready', progress: [], source, intake: it, skills: ex.skills, slides, exercises: ex.exercises, checks: ex.checks, ...cards };
await writeFile(join(dir, 'lesson.json'), JSON.stringify(lesson, null, 1));
log(`saved ${join(dir, 'lesson.json')}`);
