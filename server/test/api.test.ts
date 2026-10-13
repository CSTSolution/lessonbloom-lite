// The whole teacher -> pupil -> report flow over HTTP, on the mock provider and a temp store.
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { MockProvider } from '../ai/mock.ts';
import { createApp, mark } from '../app.ts';
import { LocalStore } from '../store.ts';
import type { Exercise, Lesson } from '../types.ts';

const source = await readFile(new URL('../../samples/toan-lop2-cong-co-nho.txt', import.meta.url), 'utf8');

test('teacher creates and shares a lesson, pupils submit, teacher sees the report', async () => {
  const app = createApp(new MockProvider(), new LocalStore(await mkdtemp(join(tmpdir(), 'lb-'))));
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json() as any };
  };
  const it = (await call('POST', '/api/intake', { source })).json;
  assert.equal(it.subject, 'math');
  const { id } = (await call('POST', '/api/lessons', { source, intake: it })).json;
  let l: Lesson;
  for (let i = 0; ; i++) {
    l = (await call('GET', `/api/lessons/${id}`)).json;
    if (l.status !== 'working' || i > 200) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal(l.status, 'ready', l.error ?? '');
  assert.ok(l.slides.every((s) => s.image?.startsWith(`/media/${id}/`)));
  assert.ok(l.progress.length > 3);

  const { shareId } = (await call('POST', `/api/lessons/${id}/share`)).json;
  const pupil = (await call('GET', `/api/s/${shareId}`)).json;
  assert.ok(pupil.exercises.every((e: any) => !('answer' in e) && !('expr' in e)), 'answers must not reach the pupil');
  assert.ok(pupil.slides.every((s: any) => !('notes' in s)));

  const basic = l.exercises.filter((e) => e.level === 'basic');
  const allRight = Object.fromEntries(basic.map((e) => [e.id, (e as any).answer]));
  const r1 = (await call('POST', `/api/s/${shareId}/submit`, { level: 'basic', answers: allRight })).json;
  assert.equal(r1.right, basic.length);
  const oneWrong = { ...allRight, [basic[0].id]: '1' };
  await call('POST', `/api/s/${shareId}/submit`, { level: 'basic', answers: oneWrong });

  const rep = (await call('GET', `/api/lessons/${id}/report`)).json;
  assert.equal(rep.pupils, 2);
  assert.equal(rep.items[0].id, basic[0].id);
  assert.equal(rep.items[0].wrongRate, 0.5);
});

test('marking is forgiving about case, spaces and the final full stop', () => {
  const order = { id: 'o', level: 'basic', type: 'eng_order', prompt: '', words: [], answer: 'My name is Nam.', explain: '' } as Exercise;
  assert.ok(mark(order, ' my name is  Nam'));
  const match = { id: 'm', level: 'basic', type: 'eng_match', prompt: '', pairs: [{ word: 'cat', emoji: '🐱' }, { word: 'sun', emoji: '☀️' }], explain: '' } as Exercise;
  assert.ok(mark(match, JSON.stringify({ cat: '🐱', sun: '☀️' })));
  assert.ok(!mark(match, JSON.stringify({ cat: '☀️', sun: '🐱' })));
});
