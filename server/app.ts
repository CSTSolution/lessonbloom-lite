// HTTP API (Hono). Teacher: intake -> create lesson (runs in the background) -> poll -> edit
// -> share. Pupil: open the share link (answers stripped) -> submit -> marked with praise.
// Teacher report: which questions most pupils got wrong.
import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import type { AI } from './ai/provider.ts';
import { intake } from './lesson/build.ts';
import { runLesson } from './lesson/job.ts';
import type { Store } from './store.ts';
import type { Exercise, Intake, Lesson, Level } from './types.ts';

const newId = (n = 6) => randomBytes(n).toString('base64url').replace(/[-_]/g, '').slice(0, n + 2).toLowerCase();
const MAX_SOURCE = 12000;

// What a pupil's browser gets: everything needed to render, no answers.
export function forPupil(e: Exercise) {
  const { answer: _a, explain: _x, ...rest } = e as Exercise & { answer?: string };
  if (e.type === 'math_mcq') { const { expr: _e, ...r } = rest as any; return r; }
  if (e.type === 'math_word') { const { expr: _e, ...r } = rest as any; return r; }
  if (e.type === 'eng_order') return { ...rest, words: [...e.words].sort(() => 0.5 - Math.random()) };
  if (e.type === 'eng_match') return { ...rest, pictures: e.pairs.map((p) => p.emoji).sort(), pairs: e.pairs.map((p) => ({ word: p.word })) };
  return rest;
}

const clean = (s: string) => String(s ?? '').trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
export function mark(e: Exercise, given: string): boolean {
  switch (e.type) {
    case 'eng_match': {
      try { const m = JSON.parse(given) as Record<string, string>; return e.pairs.every((p) => m[p.word] === p.emoji); } catch { return false; }
    }
    case 'math_mcq': case 'math_fill': case 'math_word':
      return clean(given).replace(',', '.') === clean(e.answer).replace(',', '.');
    default:
      return clean(given) === clean((e as { answer: string }).answer);
  }
}

export function createApp(ai: AI, store: Store) {
  const app = new Hono();
  const lessonOr404 = async (id: string) => store.getLesson(id);

  app.get('/api/health', (c) => c.json({ ok: true, provider: ai.name }));

  app.post('/api/intake', async (c) => {
    const { source } = await c.req.json<{ source: string }>();
    if (!source?.trim()) return c.json({ error: 'Cô dán nội dung bài học vào nhé.' }, 400);
    return c.json(await intake(ai, source.slice(0, MAX_SOURCE)));
  });

  app.post('/api/lessons', async (c) => {
    const { source, intake: it } = await c.req.json<{ source: string; intake: Intake }>();
    if (!source?.trim() || !it?.subject) return c.json({ error: 'missing source or intake' }, 400);
    const l: Lesson = { id: newId(), createdAt: new Date().toISOString(), status: 'working', progress: [], source: source.slice(0, MAX_SOURCE),
      intake: it, slides: [], exercises: [], checks: [] };
    await store.putLesson(l);
    void runLesson(ai, store, l);                // background: the page polls GET /api/lessons/:id
    return c.json({ id: l.id }, 202);
  });

  app.get('/api/lessons/:id', async (c) => {
    const l = await lessonOr404(c.req.param('id'));
    return l ? c.json(l) : c.json({ error: 'not found' }, 404);
  });

  // Teacher edits: slides and exercises come back whole from the editor.
  app.put('/api/lessons/:id', async (c) => {
    const l = await lessonOr404(c.req.param('id'));
    if (!l) return c.json({ error: 'not found' }, 404);
    const body = await c.req.json<Partial<Pick<Lesson, 'slides' | 'exercises'>>>();
    if (body.slides) l.slides = body.slides;
    if (body.exercises) l.exercises = body.exercises;
    await store.putLesson(l);
    return c.json(l);
  });

  app.post('/api/lessons/:id/share', async (c) => {
    const l = await lessonOr404(c.req.param('id'));
    if (!l || l.status !== 'ready') return c.json({ error: 'lesson not ready' }, 409);
    l.shareId ||= newId(4);
    await store.putLesson(l);
    return c.json({ shareId: l.shareId, url: `/s/${l.shareId}` });
  });

  app.get('/api/lessons/:id/report', async (c) => {
    const l = await lessonOr404(c.req.param('id'));
    if (!l) return c.json({ error: 'not found' }, 404);
    const subs = l.shareId ? await store.submissions(l.shareId) : [];
    const items = l.exercises.map((e) => {
      const tried = subs.filter((s) => e.id in s.correct), wrong = tried.filter((s) => !s.correct[e.id]).length;
      const detail = 'equation' in e ? e.equation.replace('?', '…') : 'statement' in e ? e.statement : 'sentence' in e ? e.sentence : 'words' in e && e.type === 'eng_order' ? e.answer : '';
      return { id: e.id, level: e.level, type: e.type, prompt: detail ? `${e.prompt}: ${detail}` : e.prompt, tried: tried.length, wrong, wrongRate: tried.length ? wrong / tried.length : 0 };
    }).sort((a, b) => b.wrongRate - a.wrongRate);
    return c.json({ pupils: subs.length, items });
  });

  app.get('/api/s/:share', async (c) => {
    const l = await store.findShare(c.req.param('share'));
    if (!l) return c.json({ error: 'not found' }, 404);
    return c.json({ title: l.intake.title, subject: l.intake.subject, grade: l.intake.grade, lang: l.intake.lang, slides: l.slides.map(({ notes: _n, ...s }) => s),
      video: l.video, exercises: l.exercises.map(forPupil) });
  });

  app.post('/api/s/:share/submit', async (c) => {
    const shareId = c.req.param('share');
    const l = await store.findShare(shareId);
    if (!l) return c.json({ error: 'not found' }, 404);
    const { level, answers } = await c.req.json<{ level: Level; answers: Record<string, string> }>();
    const result: Record<string, { correct: boolean; answer: string; explain: string }> = {};
    const correct: Record<string, boolean> = {};
    for (const e of l.exercises.filter((x) => x.level === level && x.id in (answers || {}))) {
      correct[e.id] = mark(e, answers[e.id]);
      result[e.id] = { correct: correct[e.id], answer: e.type === 'eng_match' ? e.pairs.map((p) => `${p.word} ${p.emoji}`).join(', ') : (e as { answer: string }).answer, explain: e.explain };
    }
    await store.addSubmission({ shareId, at: new Date().toISOString(), level, answers, correct });
    const right = Object.values(correct).filter(Boolean).length;
    return c.json({ right, total: Object.keys(correct).length, result });
  });

  app.get('/media/:id/:name', async (c) => {
    const f = await store.getFile(c.req.param('id'), c.req.param('name'));
    if (!f) return c.notFound();
    const ext = c.req.param('name').split('.').pop();
    const type = { png: 'image/png', jpg: 'image/jpeg', wav: 'audio/wav', mp4: 'video/mp4', pdf: 'application/pdf' }[ext || ''] || 'application/octet-stream';
    return c.body(new Uint8Array(f), 200, { 'content-type': type, 'cache-control': 'public, max-age=86400' });
  });

  return app;
}
