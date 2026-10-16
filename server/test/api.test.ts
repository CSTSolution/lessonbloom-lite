// The whole loop over HTTP on the mock provider and a temp store: teacher workspace (seeded)
// -> create lesson -> assign -> pupil joins with code -> answers (error tagged, hint, retry)
// -> next steps -> learning summary. Also checks nothing private reaches a pupil.
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { MOCK_CARRY_ERROR, MockProvider } from '../ai/mock.ts';
import { createApp, mark } from '../app.ts';
import { LocalStore } from '../store.ts';
import type { Exercise, Lesson } from '../types.ts';

const source = await readFile(new URL('../../samples/toan-lop2-cong-co-nho.txt', import.meta.url), 'utf8');

test('teacher -> pupil -> learning summary', async () => {
  const app = createApp(new MockProvider(), new LocalStore(await mkdtemp(join(tmpdir(), 'lb-'))));
  let key = '';
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await app.request(path, { method, headers: { 'content-type': 'application/json', 'x-teacher': key }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json() as any };
  };
  assert.equal((await call('GET', '/api/t/me')).status, 403, 'no workspace, no access');
  key = (await call('POST', '/api/t/me', { name: 'Cô Hạnh' })).json.key;
  const classes = (await call('GET', '/api/t/classes')).json;
  assert.deepEqual(classes.map((k: any) => k.name), ['2A', '2B', '2C']);
  const seededSummary = (await call('GET', '/api/t/insights')).json;
  const carry = seededSummary.overview.find((o: any) => o.skill === 'carry_1');
  assert.equal(carry.byClass[classes[0].id], 'repeated', '2A is seeded with a carrying problem');
  assert.equal(carry.byClass[classes[2].id], 'secure');

  // create a lesson
  const it = (await call('POST', '/api/t/intake', { source })).json;
  const { id } = (await call('POST', '/api/t/lessons', { source, intake: it })).json;
  let l!: Lesson;
  for (let i = 0; i < 300; i++) { l = (await call('GET', `/api/t/lessons/${id}`)).json; if (l.status !== 'working' && !l.picturesPending) break; await new Promise((r) => setTimeout(r, 10)); }
  assert.equal(l.status, 'ready', l.error ?? '');
  assert.ok(l.flashcards.length && l.pairs.length === 4 && l.skills.length);
  const edited = (await call('POST', `/api/t/lessons/${id}/slides/sl03`, { action: 'simpler' })).json;
  assert.ok(edited.heading.split(' ').length <= 4);

  // assign to 2C and join as a pupil
  const as = (await call('POST', '/api/t/assignments', { lessonId: id, classId: classes[2].id, dueAt: '2026-10-20' })).json;
  const roster = (await call('GET', `/api/join/${as.joinCode.toLowerCase()}`)).json;
  assert.equal(roster.className, '2C');
  const pupil = roster.pupils[0];
  assert.equal((await call('POST', '/api/join', { code: as.joinCode, pupilId: pupil.id })).status, 200);
  const learn = (await call('GET', `/api/learn/${pupil.id}`)).json;
  assert.equal(learn.lesson.title, l.intake.title);
  const leaked = JSON.stringify(learn);
  assert.ok(!/"answer"|"expr"|"notes"|"source"|"label"|"secure"|"repeated"/.test(leaked), 'no answers, notes or labels for pupils');

  // a carrying slip: tagged, hinted, retried
  const q = l.exercises.find((e) => e.type === 'math_mcq')!;
  const wrong = String(Number((q as any).answer) - 10);
  const r1 = (await call('POST', `/api/learn/${pupil.id}/answer`, { assignmentId: as.id, exerciseId: q.id, answer: wrong, session: 's1' })).json;
  assert.equal(r1.correct, false); assert.match(r1.hint, /nhớ 1/); assert.equal(r1.retry, true);
  const r2 = (await call('POST', `/api/learn/${pupil.id}/answer`, { assignmentId: as.id, exerciseId: q.id, answer: (q as any).answer, session: 's1' })).json;
  assert.equal(r2.correct, true); assert.ok(r2.explain);
  for (const e of l.exercises.filter((x) => x.skill === 'carry_1').slice(1, 3)) {
    const a = String(Number((e as any).answer) - 10);
    if (a !== 'NaN') await call('POST', `/api/learn/${pupil.id}/answer`, { assignmentId: as.id, exerciseId: e.id, answer: a, session: 's1' });
  }
  const next = (await call('GET', `/api/learn/${pupil.id}/next`)).json;
  assert.equal(next[0].kind, 'same');
  assert.ok(next[0].exercises.every((e: any) => !('answer' in e)));
  assert.equal((await call('POST', `/api/learn/${pupil.id}/selfcheck`, { mood: 'ok' })).status, 200);

  // the teacher sees the slip in 2C
  const sum = (await call('GET', `/api/t/insights?lessonId=${id}&classId=${classes[2].id}`)).json;
  const carry2 = sum.detail.find((s: any) => s.skill === 'carry_1');
  assert.equal(carry2.pupils[0].name, pupil.name);
  assert.equal(carry2.pupils[0].topError, MOCK_CARRY_ERROR);
  const comments = (await call('POST', '/api/t/insights/comments', { lessonId: seededSummary.lessonId, classId: classes[0].id })).json;
  assert.ok(comments.length > 0 && comments.every((c: any) => !/điểm|%/.test(c.text)));

  // another workspace cannot read this one
  const other = key; key = (await call('POST', '/api/t/me', {})).json.key;
  assert.equal((await call('GET', `/api/t/lessons/${id}`)).status, 404);
  key = other;
});

test('marking is forgiving about case, spaces and the final full stop', () => {
  const order = { id: 'o', level: 'basic', skill: 's', type: 'eng_order', prompt: '', words: [], answer: 'My name is Nam.', explain: '' } as unknown as Exercise;
  assert.ok(mark(order, ' my name is  Nam'));
  const match = { id: 'm', level: 'basic', skill: 's', type: 'eng_match', prompt: '', pairs: [{ word: 'cat', emoji: '🐱' }, { word: 'sun', emoji: '☀️' }], explain: '' } as unknown as Exercise;
  assert.ok(mark(match, JSON.stringify({ cat: '🐱', sun: '☀️' })));
  assert.ok(!mark(match, JSON.stringify({ cat: '☀️', sun: '🐱' })));
});

test('match pictures are never shown in the same order as the words', async () => {
  const { forPupil } = await import('../app.ts');
  for (const id of ['ex01', 'ex02', 'ex03', 'ex04', 'ex05', 'ex06']) {
    const e = { id, level: 'basic', skill: 's', type: 'eng_match', prompt: '', explain: '', pairs: [{ word: 'red', emoji: '🔴' }, { word: 'blue', emoji: '🔵' }, { word: 'yellow', emoji: '🟡' }] } as unknown as Exercise;
    const p = forPupil(e) as { pictures: string[] };
    assert.notDeepEqual(p.pictures, ['🔴', '🔵', '🟡']);
    assert.deepEqual([...p.pictures].sort(), ['🔴', '🔵', '🟡'].sort());
  }
});

test('classes and pupils can be edited and removed; one pupil’s progress; lessons copied and deleted; sample data cleared', async () => {
  const app = createApp(new MockProvider(), new LocalStore(await mkdtemp(join(tmpdir(), 'lb-'))));
  let key = '';
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await app.request(path, { method, headers: { 'content-type': 'application/json', 'x-teacher': key }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json() as any };
  };
  key = (await call('POST', '/api/t/me', {})).json.key;
  const [k2a] = (await call('GET', '/api/t/classes')).json;
  const detail = (await call('GET', `/api/t/classes/${k2a.id}`)).json;
  const an = detail.pupils.find((p: any) => p.displayName === 'An');

  // one pupil: the seeded lesson with skills from their own answers only
  const prog = (await call('GET', `/api/t/classes/${k2a.id}/pupils/${an.id}`)).json;
  assert.equal(prog.pupil.displayName, 'An');
  assert.equal(prog.lessons.length, 1);
  assert.ok(prog.lessons[0].answered > 0 && prog.lessons[0].skills.some((s: any) => s.label === 'repeated'), 'An is seeded with a carrying problem');

  assert.equal((await call('PUT', `/api/t/classes/${k2a.id}/pupils/${an.id}`, { name: 'An Nhiên' })).json.displayName, 'An Nhiên');
  assert.equal((await call('DELETE', `/api/t/classes/${k2a.id}/pupils/${an.id}`)).status, 200);
  assert.equal((await call('GET', `/api/t/classes/${k2a.id}`)).json.pupils.length, 11);

  assert.equal((await call('PUT', `/api/t/classes/${k2a.id}`, { name: '2A1', subject: 'english' })).json.subject, 'english');
  assert.equal((await call('PUT', `/api/t/classes/${k2a.id}`, { name: ' ' })).status, 400);

  // lessons: copy keeps the content, delete removes its assignments too
  const [lesson] = (await call('GET', '/api/t/lessons')).json;
  const copy = (await call('POST', `/api/t/lessons/${lesson.id}/copy`, { lang: 'vi' })).json;
  const c = (await call('GET', `/api/t/lessons/${copy.id}`)).json;
  assert.ok(c.intake.title.endsWith('(bản sao)') && c.exercises.length === 12 && !c.sample);
  assert.equal((await call('DELETE', `/api/t/lessons/${lesson.id}`)).status, 200);
  assert.equal((await call('GET', `/api/t/classes/${k2a.id}`)).json.assignments.length, 0);

  // a class goes with its pupils; another workspace cannot touch it
  const other = (await call('POST', '/api/t/me', {})).json.key, mine = key;
  key = other;
  assert.equal((await call('DELETE', `/api/t/classes/${k2a.id}`)).status, 404);
  key = mine;
  assert.equal((await call('DELETE', `/api/t/classes/${k2a.id}`)).status, 200);
  assert.equal((await call('GET', '/api/t/classes')).json.length, 2);

  // sample data: the copy (own lesson) stays, the demo classes go
  const cleared = (await call('POST', '/api/t/sample/clear')).json.removed;
  assert.equal(cleared.classes, 2);
  assert.deepEqual((await call('GET', '/api/t/lessons')).json.map((l: any) => l.id), [copy.id]);
  const start = (await call('GET', '/api/t/start')).json;
  assert.equal(start.sample, false);
  assert.equal(start.lessons, 1);
});

test('a teacher’s own class named 2A is not sample data, and the guide state still loads', async () => {
  const app = createApp(new MockProvider(), new LocalStore(await mkdtemp(join(tmpdir(), 'lb-'))));
  let key = '';
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await app.request(path, { method, headers: { 'content-type': 'application/json', 'x-teacher': key }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json() as any };
  };
  key = (await call('POST', '/api/t/me', {})).json.key;
  assert.equal((await call('POST', '/api/t/sample/clear')).status, 200);
  assert.equal((await call('POST', '/api/t/classes', { name: '2A', names: ['An'], subject: 'math' })).status, 200);
  const start = await call('GET', '/api/t/start');
  assert.equal(start.status, 200);
  assert.equal(start.json.classes, 1);
  assert.equal(start.json.sample, false);
});

test('intake refuses meaningless text with a message in both languages', async () => {
  const app = createApp(new MockProvider(), new LocalStore(await mkdtemp(join(tmpdir(), 'lb-'))));
  const me = await (await app.request('/api/t/me', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json() as any;
  const r = await app.request('/api/t/intake', { method: 'POST', headers: { 'content-type': 'application/json', 'x-teacher': me.key }, body: JSON.stringify({ source: '121212 121212 121212 121212 121212 121212' }) });
  const j = await r.json() as any;
  assert.equal(r.status, 400);
  assert.equal(j.code, 'notLesson');
  assert.ok(j.error && j.errorEn);
});
