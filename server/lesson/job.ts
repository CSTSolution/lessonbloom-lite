// Builds one lesson in the background and saves progress as it goes, so the teacher sees the
// agent working: slides -> exercises (self-check) -> flashcards & memory pairs -> pictures (vision check).
// The video is made separately in step 4 (video.ts), once the teacher has seen the slides.
import type { AI } from '../ai/provider.ts';
import type { Store } from '../store.ts';
import type { Lesson } from '../types.ts';
import { makeCards, makeExercises, makeSlides } from './build.ts';
import { illustrate } from './illustrate.ts';

export async function runLesson(ai: AI, store: Store, l: Lesson): Promise<Lesson> {
  const save = () => store.put('lessons', l);
  const step = async (m: string) => { l.progress.push(m); await save(); };
  try {
    await step('Đang đọc tài liệu và soạn slide…');
    l.slides = await makeSlides(ai, l.source, l.intake);
    await step(`Đã có ${l.slides.length} slide. Đang soạn bài tập theo mẫu và tự kiểm tra đáp án…`);
    const ex = await makeExercises(ai, l.source, l.intake, l.slides, (m) => l.progress.push(m));
    Object.assign(l, { skills: ex.skills, exercises: ex.exercises, checks: ex.checks });
    await step(`Đã có ${l.exercises.length} câu cho ${l.skills.length} dạng bài; máy đã tự sửa ${l.checks.length} câu. Đang làm thẻ nhớ…`);
    if (l.intake.outputs.includes('flashcards')) Object.assign(l, await makeCards(ai, l.source, l.intake));
    await step('Đang vẽ hình minh họa và tự kiểm tra từng hình…');
    let n = 0;
    await Promise.all(l.slides.map(async (s) => {
      const pic = await illustrate(ai, s, (m) => l.progress.push(m));
      s.image = await store.putFile(l.id, `${s.id}.${pic.ext}`, pic.image, pic.ext === 'png' ? 'image/png' : 'image/jpeg');
      if (++n % 4 === 0) await save();
    }));
    l.status = 'ready';
    await step('Xong! Cô xem lại slide, video và bài tập trước khi giao nhé.');
  } catch (e) {
    l.status = 'error'; l.error = (e as Error).message;
    await save();
  }
  return l;
}
