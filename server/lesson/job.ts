// Builds one lesson in the background and saves progress as it goes, so the teacher sees the
// agent working: slides -> exercises (self-check) -> flashcards & memory pairs -> READY, then
// pictures (vision check) keep arriving in the background while the teacher already reviews.
// The video is made separately in step 4 (video.ts), once the teacher has seen the slides.
import type { AI } from '../ai/provider.ts';
import { config } from '../config.ts';
import type { Store } from '../store.ts';
import type { Lesson } from '../types.ts';
import { makeCards, makeExercises, makeSlides } from './build.ts';
import { illustrate } from './illustrate.ts';
import { pool } from './pool.ts';
import { MSG, type Msg } from '../messages.ts';

export async function runLesson(ai: AI, store: Store, l: Lesson): Promise<Lesson> {
  const save = () => store.put('lessons', l);
  const step = async (m: Msg) => { l.progress.push(m); await save(); };
  try {
    await step(MSG.pReading);
    l.slides = await makeSlides(ai, l.source, l.intake);
    await step(MSG.pSlides(l.slides.length));
    const ex = await makeExercises(ai, l.source, l.intake, l.slides, (m) => l.progress.push(m));
    Object.assign(l, { skills: ex.skills, exercises: ex.exercises, checks: ex.checks });
    await step(MSG.pExercises(l.exercises.length, l.skills.length, l.checks.length));
    if (l.intake.outputs.includes('flashcards')) Object.assign(l, await makeCards(ai, l.source, l.intake));
    l.status = 'ready'; l.picturesPending = true;
    await step(MSG.pDone);
  } catch (e) {
    l.status = 'error'; l.error = (e as Error).message;
    await save();
    return l;
  }

  // Pictures for the title and teaching slides first, two at a time (image quotas are tight).
  // Each finished picture is written onto the LATEST copy of the lesson, so edits the teacher
  // makes meanwhile are never overwritten.
  const order = ['title', 'example', 'concept', 'warmup', 'practice', 'summary'];
  const pick = [...l.slides].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).slice(0, config.maxPictures);
  const patch = async (fn: (x: Lesson) => void) => { const cur = (await store.get<Lesson>('lessons', l.id)) || l; fn(cur); await store.put('lessons', cur); };
  await pool(pick, 2, async (s) => {
    try {
      const pic = await illustrate(ai, s, () => {});
      const url = await store.putFile(l.id, `${s.id}.${pic.ext}`, pic.image, pic.ext === 'png' ? 'image/png' : 'image/jpeg');
      await patch((x) => { const t = x.slides.find((y) => y.id === s.id); if (t && !t.image) t.image = url; });
    } catch (e) {
      console.warn(`[picture] ${l.id}/${s.id}: ${String((e as Error).message).slice(0, 200)}`);
      await patch((x) => x.progress.push(MSG.pNoPicture(x.slides.findIndex((y) => y.id === s.id) + 1)));
    }
  });
  await patch((x) => { x.picturesPending = false; });
  return l;
}
