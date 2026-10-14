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
  for (let i = 0; i < 300; i++) { l = (await call('GET', `/api/t/lessons/${id}`)).json; if (l.status !== 'working') break; await new Promise((r) => setTimeout(r, 10)); }
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
