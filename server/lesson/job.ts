// Runs one lesson end to end in the background and saves progress as it goes, so the teacher
// page can show the agent working: slides -> exercises (self-check) -> pictures (vision check).
import type { AI } from '../ai/provider.ts';
import type { Store } from '../store.ts';
import type { Lesson } from '../types.ts';
import { makeExercises, makeSlides } from './build.ts';
import { illustrate } from './illustrate.ts';

export async function runLesson(ai: AI, store: Store, l: Lesson): Promise<Lesson> {
  const step = async (m: string) => { l.progress.push(m); await store.putLesson(l); };
  try {
    await step('Đang soạn slide…');
    l.slides = await makeSlides(ai, l.source, l.intake);
    await step(`Đã có ${l.slides.length} slide. Đang soạn bài tập và tự kiểm tra đáp án…`);
    const ex = await makeExercises(ai, l.source, l.intake, l.slides, (m) => { l.progress.push(m); });
    l.exercises = ex.exercises; l.checks = ex.checks;
    await step(`Đã có ${l.exercises.length} bài tập; tự kiểm tra đã sửa ${l.checks.length} câu. Đang vẽ hình minh họa…`);
    let n = 0;
    await Promise.all(l.slides.map(async (s) => {
      const pic = await illustrate(ai, s, (m) => l.progress.push(m));
      s.image = await store.putFile(l.id, `${s.id}.${pic.ext}`, pic.image, pic.ext === 'png' ? 'image/png' : 'image/jpeg');
      if (++n % 3 === 0) await store.putLesson(l);
    }));
    l.status = 'ready';
    await step('Xong! Cô xem lại và chỉnh sửa trước khi giao bài.');
  } catch (e) {
    l.status = 'error'; l.error = (e as Error).message;
    await store.putLesson(l);
  }
  return l;
}
