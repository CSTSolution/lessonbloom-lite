// HTTP API (Hono).
// Teacher routes need the x-teacher header: an unguessable workspace id kept in the teacher's
//   browser (demo: no accounts). Every read and write is scoped to that teacher.
// Pupil routes: join with a class code, tap your name; answers never leave the server, and
//   nothing a pupil receives contains scores, percentages or labels.
import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import type { AI } from './ai/provider.ts';
import { nextSteps, summarise } from './insights.ts';
import { draftComments, editSlide, intake, tagError } from './lesson/build.ts';
import { illustrate } from './lesson/illustrate.ts';
import { runLesson } from './lesson/job.ts';
import { makeVideo } from './lesson/video.ts';
import { id, seedTeacher } from './seed.ts';
import { SpendGuard, type SpendKind } from './spend.ts';
import { PRICE, UsageLog } from './usage.ts';
import { config } from './config.ts';
import type { Store } from './store.ts';
import type { Assignment, Attempt, ClassRoom, Criteria, Exercise, Intake, Lesson, Pupil, SelfCheck, Slide, Teacher } from './types.ts';

const MAX_SOURCE = 20000;
const bad = (c: Context, msg: string, code: 400 | 403 | 404 | 409 = 400) => c.json({ error: msg }, code);

// What a pupil's browser gets for an exercise: enough to render, no answers or maths expressions.
export function forPupil(e: Exercise) {
  const { answer: _a, explain: _x, ...rest } = e as Exercise & { answer?: string };
  if (e.type === 'math_mcq' || e.type === 'math_word') { const { expr: _e, ...r } = rest as Record<string, unknown>; return r; }
  if (e.type === 'eng_order') return { ...rest, words: [...e.words].sort((a, b) => a.localeCompare(b)) };
  if (e.type === 'eng_match') return { ...rest, pictures: e.pairs.map((p) => p.emoji).sort(), pairs: e.pairs.map((p) => ({ word: p.word })) };
  return rest;
}

const clean = (s: string) => String(s ?? '').trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
export function mark(e: Exercise, given: string): boolean {
  if (e.type === 'eng_match') { try { const m = JSON.parse(given) as Record<string, string>; return e.pairs.every((p) => m[p.word] === p.emoji); } catch { return false; } }
  if (e.type === 'math_mcq' || e.type === 'math_fill' || e.type === 'math_word') return clean(given).replace(',', '.') === clean(e.answer).replace(',', '.');
  return clean(given) === clean((e as { answer: string }).answer);
}

export function createApp(ai: AI, store: Store) {
  const app = new Hono();
  const spend = new SpendGuard(store);
  const usage = new UsageLog(store);
  ai.onUsage = (e) => usage.record(e);
  const LIMIT_MSG = { month: 'Bản demo đã dùng hết hạn mức AI của tháng này. / The demo has used this month\'s AI allowance.', day: 'Bản demo đã dùng hết hạn mức AI hôm nay, cô thử lại vào ngày mai nhé. / The demo has used today\'s AI allowance; please try again tomorrow.' };
  const guard = async (c: Context, kind: SpendKind) => { const why = await spend.charge(kind); return why ? c.json({ error: LIMIT_MSG[why as 'month' | 'day'], limit: why }, 429) : null; };
  type Env = { Variables: { teacher: Teacher } };
  const t = new Hono<Env>();

  // ---------- teacher workspace ----------
  t.post('/me', async (c) => {                      // create + seed a demo workspace
    const { name } = await c.req.json<{ name?: string }>().catch(() => ({ name: undefined }));
    const tid = id(24);
    const teacher = await seedTeacher(store, tid, name?.trim().slice(0, 40) || undefined);
    return c.json({ teacher, key: tid });
  });
  t.use('*', async (c, next) => {
    if (c.req.path.endsWith('/me') && c.req.method === 'POST') return next();
    const key = c.req.header('x-teacher') || '';
    const teacher = /^[\w]{16,40}$/.test(key) ? await store.get<Teacher>('teachers', key) : null;
    if (!teacher) return bad(c, 'no workspace', 403);
    c.set('teacher', teacher);
    await next();
  });
  t.get('/me', (c) => c.json(c.get('teacher')));
  t.get('/spend', async (c) => c.json(await spend.status()));
  t.put('/me/criteria', async (c) => {
    const tc = c.get('teacher'), body = await c.req.json<Partial<Criteria>>();
    for (const [k, v] of Object.entries(body)) if (k in tc.criteria && Number.isFinite(v) && (v as number) >= 0 && (v as number) <= 100) (tc.criteria as unknown as Record<string, number>)[k] = Number(v);
    await store.put('teachers', tc);
    return c.json(tc);
  });

  const myLesson = async (c: Context<Env>) => {
    const l = await store.get<Lesson>('lessons', c.req.param('id') || '');
    return l && l.teacherId === c.get('teacher').id ? l : null;
  };
  const myClass = async (c: Context<Env>, classId: string) => {
    const k = await store.get<ClassRoom>('classes', classId);
    return k && k.teacherId === c.get('teacher').id ? k : null;
  };

  // ---------- classes ----------
  t.get('/classes', async (c) => {
    const tid = c.get('teacher').id;
    const classes = await store.find<ClassRoom>('classes', 'teacherId', tid);
    const assigns = await store.find<Assignment>('assignments', 'teacherId', tid);
    return c.json(await Promise.all(classes.sort((a, b) => a.name.localeCompare(b.name)).map(async (k) => {
      const pupils = await store.find<Pupil>('pupils', 'classId', k.id);
      return { ...k, pupils: pupils.length, joined: pupils.filter((p) => p.joinedAt).length, assignments: assigns.filter((a) => a.classId === k.id).length };
    })));
  });
  t.post('/classes', async (c) => {
    const { name, names } = await c.req.json<{ name: string; names?: string[] }>();
    if (!name?.trim()) return bad(c, 'name');
    const k: ClassRoom = { id: id(), teacherId: c.get('teacher').id, name: name.trim().slice(0, 12), joinCode: `${name.trim().slice(0, 4).replace(/\W/g, '').toUpperCase()}-${id(4).toUpperCase()}` };
    await store.put('classes', k);
    await store.putMany('pupils', (names || []).map((n) => n.trim()).filter(Boolean).slice(0, 60).map((n) => ({ id: id(), classId: k.id, displayName: n.slice(0, 30) })));
    return c.json(k);
  });
  t.get('/classes/:cid', async (c) => {
    const k = await myClass(c, c.req.param('cid'));
    if (!k) return bad(c, 'not found', 404);
    const pupils = await store.find<Pupil>('pupils', 'classId', k.id);
    const assigns = await store.find<Assignment>('assignments', 'classId', k.id);
    const rows = await Promise.all(assigns.map(async (a) => {
      const l = await store.get<Lesson>('lessons', a.lessonId);
      const atts = await store.find<Attempt>('attempts', 'assignmentId', a.id);
      return { ...a, title: l?.intake.title || '?', done: new Set(atts.map((x) => x.pupilId)).size, total: pupils.length };
    }));
    return c.json({ ...k, pupils: pupils.sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi')), assignments: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  });
  t.post('/classes/:cid/pupils', async (c) => {
    const k = await myClass(c, c.req.param('cid'));
    if (!k) return bad(c, 'not found', 404);
    const { names } = await c.req.json<{ names: string[] }>();
    const ps = (names || []).map((n) => n.trim()).filter(Boolean).slice(0, 60).map((n) => ({ id: id(), classId: k.id, displayName: n.slice(0, 30) }));
    await store.putMany('pupils', ps);
    return c.json(ps);
  });

  // ---------- lessons ----------
  t.get('/lessons', async (c) => {
    const tid = c.get('teacher').id;
    const [ls, assigns, classes] = await Promise.all([store.find<Lesson>('lessons', 'teacherId', tid), store.find<Assignment>('assignments', 'teacherId', tid), store.find<ClassRoom>('classes', 'teacherId', tid)]);
    const cname = new Map(classes.map((k) => [k.id, k.name]));
    return c.json(ls.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((l) => ({
      id: l.id, title: l.intake.title, subject: l.intake.subject, grade: l.intake.grade, status: l.status, createdAt: l.createdAt,
      slides: l.slides.length, exercises: l.exercises.length, flashcards: l.flashcards.length, video: l.video?.status === 'ready',
      cover: l.slides.find((s) => s.example)?.example || l.exercises[0]?.prompt || '',
      classes: [...new Set(assigns.filter((a) => a.lessonId === l.id).map((a) => cname.get(a.classId)).filter(Boolean))],
    })));
  });
  t.post('/intake', async (c) => {
    const { source } = await c.req.json<{ source: string }>();
    if (!source?.trim() || source.trim().length < 30) return bad(c, 'Cô dán nội dung bài học (ít nhất vài câu) nhé.');
    const stop = await guard(c, 'intake'); if (stop) return stop;
    return c.json(await intake(ai, source.slice(0, MAX_SOURCE)));
  });
  t.post('/lessons', async (c) => {
    const { source, intake: it } = await c.req.json<{ source: string; intake: Intake }>();
    if (!source?.trim() || !it?.subject) return bad(c, 'missing source or intake');
    const today = new Date().toISOString().slice(0, 10);
    const mineToday = (await store.find<Lesson>('lessons', 'teacherId', c.get('teacher').id)).filter((x) => x.createdAt.startsWith(today) && x.source !== 'Bài mẫu do đội LessonBloom tự viết.').length;
    if (mineToday >= config.lessonsPerWorkspaceDay) return c.json({ error: `Mỗi ngày bản demo cho tạo ${config.lessonsPerWorkspaceDay} bài. / The demo allows ${config.lessonsPerWorkspaceDay} new lessons per day.` }, 429);
    const stop = await guard(c, 'lesson'); if (stop) return stop;
    const l: Lesson = { id: id(), teacherId: c.get('teacher').id, createdAt: new Date().toISOString(), status: 'working', progress: [], source: source.slice(0, MAX_SOURCE),
      intake: { ...it, title: String(it.title).slice(0, 120) }, skills: [], slides: [], exercises: [], flashcards: [], pairs: [], checks: [] };
    await store.put('lessons', l);
    void runLesson(ai, store, l);                // background; the page polls GET /lessons/:id
    return c.json({ id: l.id }, 202);
  });
  t.get('/lessons/:id', async (c) => { const l = await myLesson(c); return l ? c.json(l) : bad(c, 'not found', 404); });
  t.put('/lessons/:id', async (c) => {
    const l = await myLesson(c);
    if (!l) return bad(c, 'not found', 404);
    const body = await c.req.json<Partial<Pick<Lesson, 'slides' | 'exercises' | 'flashcards' | 'pairs'>>>();
    for (const k of ['slides', 'exercises', 'flashcards', 'pairs'] as const) if (Array.isArray(body[k])) (l as unknown as Record<string, unknown>)[k] = body[k];
    await store.put('lessons', l);
    return c.json(l);
  });
  t.post('/lessons/:id/slides/:sid', async (c) => {
    const l = await myLesson(c);
    const i = l ? l.slides.findIndex((s) => s.id === c.req.param('sid')) : -1;
    if (!l || i < 0) return bad(c, 'not found', 404);
    const { action } = await c.req.json<{ action: 'rewrite' | 'simpler' | 'image' }>();
    const stop = await guard(c, action === 'image' ? 'slideImage' : 'slideEdit'); if (stop) return stop;
    let s: Slide = l.slides[i];
    if (action === 'image') {
      const pic = await illustrate(ai, { ...s, imagePrompt: `${s.imagePrompt} (a different composition)` });
      s = { ...s, image: await store.putFile(l.id, `${s.id}-${Date.now()}.${pic.ext}`, pic.image, pic.ext === 'png' ? 'image/png' : 'image/jpeg') };
    } else s = await editSlide(ai, s, action === 'simpler' ? 'simpler' : 'rewrite', l.intake);
    l.slides[i] = s;
    await store.put('lessons', l);
    return c.json(s);
  });
  t.post('/lessons/:id/video', async (c) => {
    const l = await myLesson(c);
    if (!l || l.status !== 'ready') return bad(c, 'lesson not ready', 409);
    if (l.video?.status === 'working') return c.json(l.video, 202);
    const o = await c.req.json<{ speed?: number; subtitles?: boolean; voice?: string }>().catch(() => ({} as { speed?: number; subtitles?: boolean; voice?: string }));
    const stop = await guard(c, 'video'); if (stop) return stop;
    l.video = { status: 'working', speed: o.speed ?? 0.9, subtitles: o.subtitles ?? true, voice: o.voice };
    await store.put('lessons', l);
    void (async () => {
      try {
        const v = await makeVideo(ai, store, l, { speed: l.video!.speed!, subtitles: !!l.video!.subtitles, voice: o.voice });
        const fresh = (await store.get<Lesson>('lessons', l.id))!;
        fresh.video = { ...l.video!, status: 'ready', url: v.url, seconds: v.seconds, chapters: v.chapters };
        await store.put('lessons', fresh);
      } catch (e) {
        const fresh = (await store.get<Lesson>('lessons', l.id))!;
        fresh.video = { ...l.video!, status: 'error', error: (e as Error).message };
        await store.put('lessons', fresh);
      }
    })();
    return c.json(l.video, 202);
  });

  // ---------- assignments ----------
  t.post('/assignments', async (c) => {
    const b = await c.req.json<{ lessonId: string; classId: string; dueAt?: string; allowRetry?: boolean; autoSuggest?: boolean }>();
    const l = await store.get<Lesson>('lessons', b.lessonId), k = await myClass(c, b.classId);
    if (!l || l.teacherId !== c.get('teacher').id || !k) return bad(c, 'not found', 404);
    if (l.status !== 'ready') return bad(c, 'lesson not ready', 409);
    const a: Assignment = { id: id(), teacherId: c.get('teacher').id, lessonId: l.id, classId: k.id, dueAt: b.dueAt, allowRetry: b.allowRetry !== false, autoSuggest: b.autoSuggest !== false, createdAt: new Date().toISOString() };
    await store.put('assignments', a);
    return c.json({ ...a, joinCode: k.joinCode });
  });

  // ---------- learning summary ----------
  t.get('/insights', async (c) => {
    const tc = c.get('teacher');
    const lessons = (await store.find<Lesson>('lessons', 'teacherId', tc.id)).filter((l) => l.status === 'ready');
    const lessonId = c.req.query('lessonId') || lessons.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id;
    const l = lessons.find((x) => x.id === lessonId);
    if (!l) return c.json({ lessons: [], classes: [], overview: [], detail: null });
    const classes = (await store.find<ClassRoom>('classes', 'teacherId', tc.id)).sort((a, b) => a.name.localeCompare(b.name));
    const atts = (await store.find<Attempt>('attempts', 'lessonId', l.id));
    const per = await Promise.all(classes.map(async (k) => {
      const pupils = await store.find<Pupil>('pupils', 'classId', k.id);
      return { k, sums: l.skills.map((s) => summarise(s, pupils, atts.filter((a) => a.classId === k.id), tc.criteria)) };
    }));
    const classId = c.req.query('classId') || per[0]?.k.id;
    const detail = per.find((p) => p.k.id === classId);
    return c.json({
      lessons: lessons.map((x) => ({ id: x.id, title: x.intake.title })), lessonId: l.id, classId,
      classes: classes.map((k) => ({ id: k.id, name: k.name })),
      overview: l.skills.map((s, i) => ({ skill: s.tag, name: s.name, byClass: Object.fromEntries(per.map((p) => [p.k.id, p.sums[i].pupils.length ? p.sums[i].classLabel : null])) })),
      // "36 + 27 → 53": the question next to the pupil's slip
      detail: detail ? detail.sums.filter((s) => s.pupils.length).map((s) => ({ ...s, errors: s.errors.map((e) => {
        const q = l.exercises.find((x) => x.id === e.exampleExercise);
        const shown = !q ? '' : 'expr' in q ? q.expr : 'equation' in q ? q.equation : 'statement' in q ? q.statement : q.prompt;
        return { ...e, example: shown ? `${shown} → ${e.example}` : e.example };
      }) })) : null,
    });
  });
  t.post('/insights/comments', async (c) => {
    const { lessonId, classId } = await c.req.json<{ lessonId: string; classId: string }>();
    const tc = c.get('teacher'), l = await store.get<Lesson>('lessons', lessonId), k = await myClass(c, classId);
    if (!l || l.teacherId !== tc.id || !k) return bad(c, 'not found', 404);
    const pupils = await store.find<Pupil>('pupils', 'classId', k.id);
    const atts = (await store.find<Attempt>('attempts', 'lessonId', l.id)).filter((a) => a.classId === k.id);
    const stop = await guard(c, 'comments'); if (stop) return stop;
    const rows = l.skills.flatMap((s) => summarise(s, pupils, atts, tc.criteria).pupils.filter((p) => p.label !== 'practising')
      .map((p) => ({ pupilId: p.pupilId, name: p.name, skill: s.name, label: p.label, error: p.topError })));
    return c.json(await draftComments(ai, l.intake.title, rows.slice(0, 30)));
  });
  app.route('/api/t', t);

  // ---------- pupils ----------
  const findClass = async (code: string) => (await store.find<ClassRoom>('classes', 'joinCode', code.trim().toUpperCase()))[0] || null;
  app.get('/api/join/:code', async (c) => {
    const k = await findClass(c.req.param('code'));
    if (!k) return bad(c, 'Không tìm thấy mã lớp. Con hỏi cô giáo nhé.', 404);
    const pupils = await store.find<Pupil>('pupils', 'classId', k.id);
    return c.json({ className: k.name, pupils: pupils.map((p) => ({ id: p.id, name: p.displayName })).sort((a, b) => a.name.localeCompare(b.name, 'vi')) });
  });
  app.post('/api/join', async (c) => {
    const { code, pupilId } = await c.req.json<{ code: string; pupilId: string }>();
    const k = await findClass(code || ''), p = await store.get<Pupil>('pupils', pupilId || '');
    if (!k || !p || p.classId !== k.id) return bad(c, 'not found', 404);
    if (!p.joinedAt) { p.joinedAt = new Date().toISOString(); await store.put('pupils', p); }
    return c.json({ pupilId: p.id, name: p.displayName, className: k.name });
  });

  const pupilCtx = async (pupilId: string) => {
    const p = await store.get<Pupil>('pupils', pupilId);
    if (!p) return null;
    const k = (await store.get<ClassRoom>('classes', p.classId))!;
    const assigns = (await store.find<Assignment>('assignments', 'classId', k.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const a = assigns[0];
    const l = a ? await store.get<Lesson>('lessons', a.lessonId) : null;
    const teacher = (await store.get<Teacher>('teachers', k.teacherId))!;
    return { p, k, a, l, teacher };
  };
  app.get('/api/learn/:pid', async (c) => {
    const x = await pupilCtx(c.req.param('pid'));
    if (!x) return bad(c, 'not found', 404);
    if (!x.a || !x.l) return c.json({ name: x.p.displayName, className: x.k.name, lesson: null });
    const mine = (await store.find<Attempt>('attempts', 'pupilId', x.p.id)).sort((a, b) => a.at.localeCompare(b.at));
    // remind the pupil of the slip they make most often lately (not just the latest one)
    const counts = new Map<string, number>();
    for (const a of mine.slice(-30)) if (!a.correct && a.errorType) counts.set(a.errorType, (counts.get(a.errorType) || 0) + 1);
    const lastErr = { errorType: [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] };
    const doneHere = new Set(mine.filter((a) => a.assignmentId === x.a!.id && a.correct).map((a) => a.exerciseId));
    const l = x.l;
    return c.json({
      name: x.p.displayName, className: x.k.name, assignmentId: x.a.id, dueAt: x.a.dueAt,
      reminder: lastErr?.errorType || null,
      lesson: { title: l.intake.title, subject: l.intake.subject, grade: l.intake.grade, lang: l.intake.lang, skills: l.skills,
        slides: l.slides.map(({ notes: _n, source: _s, imagePrompt: _i, ...s }) => s), video: l.video?.status === 'ready' ? l.video.url : null, videoSeconds: l.video?.seconds,
        exercises: l.exercises.map(forPupil), flashcards: l.flashcards, pairs: l.pairs },
      done: [...doneHere],
    });
  });
  app.post('/api/learn/:pid/answer', async (c) => {
    const x = await pupilCtx(c.req.param('pid'));
    const b = await c.req.json<{ assignmentId: string; exerciseId: string; answer: string; session: string }>();
    if (!x || !x.l || !x.a || b.assignmentId !== x.a.id) return bad(c, 'not found', 404);
    const e = x.l.exercises.find((q) => q.id === b.exerciseId);
    if (!e) return bad(c, 'not found', 404);
    const answer = String(b.answer ?? '').slice(0, 300), correct = mark(e, answer);
    let errorType: string | undefined, hint: string | undefined;
    if (!correct) {
      // why is it wrong? Gemini, cached per (lesson, item, answer) so a class making the same slip costs one call
      const key = createHash('sha1').update(`${x.l.id}|${e.id}|${clean(answer)}`).digest('hex').slice(0, 24);
      let tag = await store.get<{ id: string; errorType: string; hint: string }>('cache', key);
      if (!tag) {
        const known = [...new Set((await store.find<Attempt>('attempts', 'lessonId', x.l.id)).map((a) => a.errorType).filter(Boolean) as string[])].slice(0, 12);
        const allowed = !(await spend.charge('errorTag'));
        try { tag = allowed ? { id: key, ...(await tagError(ai, e, answer, x.l.intake.grade, known)) } : { id: key, errorType: '', hint: '' }; if (allowed) await store.put('cache', tag); } catch { tag = { id: key, errorType: '', hint: '' }; }
      }
      errorType = tag.errorType || undefined; hint = tag.hint || undefined;
    }
    const att: Attempt = { id: id(14), assignmentId: x.a.id, classId: x.k.id, pupilId: x.p.id, lessonId: x.l.id, exerciseId: e.id, skill: e.skill, answer, correct, errorType,
      at: new Date().toISOString(), session: String(b.session || new Date().toISOString().slice(0, 10)).slice(0, 40) };
    await store.put('attempts', att);
    return c.json({ correct, hint: correct ? undefined : hint || 'Chưa đúng rồi, con thử lại nhé!', explain: correct ? e.explain : undefined, retry: x.a.allowRetry });
  });
  app.get('/api/learn/:pid/next', async (c) => {
    const x = await pupilCtx(c.req.param('pid'));
    if (!x || !x.l || !x.a) return c.json([]);
    const mine = (await store.find<Attempt>('attempts', 'pupilId', x.p.id)).filter((a) => a.lessonId === x.l!.id);
    const steps = x.a.autoSuggest ? nextSteps(x.l.skills, mine, x.l.exercises, x.teacher.criteria) : [];
    return c.json(steps.map((s) => ({ ...s, exercises: s.exerciseIds.map((eid) => forPupil(x.l!.exercises.find((e) => e.id === eid)!)) })));
  });
  app.post('/api/learn/:pid/selfcheck', async (c) => {
    const x = await pupilCtx(c.req.param('pid'));
    const { mood } = await c.req.json<{ mood: SelfCheck['mood'] }>();
    if (!x || !x.a || !['easy', 'ok', 'hard'].includes(mood)) return bad(c, 'bad request');
    await store.put('selfchecks', { id: id(12), assignmentId: x.a.id, pupilId: x.p.id, mood, at: new Date().toISOString() } satisfies SelfCheck);
    return c.json({ ok: true });
  });

  // ---------- admin (Son): AI usage + spending guard. Off unless LB_ADMIN_KEY is set. ----------
  const adminOk = (c: Context) => {
    const want = (process.env.LB_ADMIN_KEY || '').trim(), got = (c.req.header('x-admin') || '').trim();
    return want.length >= 24 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  };
  app.get('/api/admin/overview', async (c) => {
    if (!adminOk(c)) return c.json({ error: 'forbidden' }, 403);
    const days = await usage.days(Math.min(90, Number(c.req.query('days') || 31)));
    const project = process.env.GOOGLE_CLOUD_PROJECT || '';
    return c.json({ provider: ai.name, project, prices: PRICE, guard: await spend.status(), days,
      links: project ? { billing: `https://console.cloud.google.com/billing/linkedaccount?project=${project}`, reports: `https://console.cloud.google.com/billing/reports?project=${project}`,
        run: `https://console.cloud.google.com/run?project=${project}`, vertex: `https://console.cloud.google.com/vertex-ai?project=${project}` } : {} });
  });

  app.get('/api/health', (c) => c.json({ ok: true, provider: ai.name }));
  app.get('/media/:folder/:name', async (c) => {
    const f = await store.getFile(c.req.param('folder'), c.req.param('name')).catch(() => null);
    if (!f) return c.notFound();
    const ext = c.req.param('name').split('.').pop() || '';
    const type = ({ png: 'image/png', jpg: 'image/jpeg', wav: 'audio/wav', mp4: 'video/mp4', pdf: 'application/pdf' } as Record<string, string>)[ext] || 'application/octet-stream';
    const head = { 'content-type': type, 'cache-control': 'public, max-age=86400', 'accept-ranges': 'bytes' };
    // Range requests let the video player jump to a chapter
    const m = /^bytes=(\d*)-(\d*)$/.exec(c.req.header('range') || '');
    if (m && (m[1] || m[2])) {
      const start = m[1] ? Number(m[1]) : Math.max(0, f.length - Number(m[2])), end = m[1] && m[2] ? Math.min(Number(m[2]), f.length - 1) : f.length - 1;
      if (start > end || start >= f.length) return c.body(null, 416, { 'content-range': `bytes */${f.length}` });
      return c.body(new Uint8Array(f.subarray(start, end + 1)), 206, { ...head, 'content-range': `bytes ${start}-${end}/${f.length}` });
    }
    return c.body(new Uint8Array(f), 200, head);
  });
  return app;
}
