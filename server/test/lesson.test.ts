import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { MockProvider } from '../ai/mock.ts';
import { checkLocal, intake, makeCards, makeExercises, makeSlides } from '../lesson/build.ts';
import { illustrate } from '../lesson/illustrate.ts';
import { checkMath, evaluate, solveBlank } from '../lesson/mathcheck.ts';
import type { Exercise } from '../types.ts';

const math = await readFile(new URL('../../samples/toan-lop2-cong-co-nho.txt', import.meta.url), 'utf8');
const eng = await readFile(new URL('../../samples/tieng-anh-lop3-colours.txt', import.meta.url), 'utf8');

test('evaluator handles Vietnamese maths notation', () => {
  assert.equal(evaluate('36 + 27'), 63);
  assert.equal(evaluate('5 × 4'), 20);
  assert.equal(evaluate('20 : 4'), 5);
  assert.equal(evaluate('(12 − 5) x 2'), 14);
  assert.throws(() => evaluate('2 + abc'));
});

test('blank solver finds the unique number', () => {
  assert.deepEqual(solveBlank('45 - ? = 20'), [25]);
  assert.deepEqual(solveBlank('… + 27 = 63'), [36]);
  assert.deepEqual(solveBlank('? × 0 = 0').length, 2);   // not unique -> caller rejects it
});

test('maths checks catch and fix wrong answers', () => {
  const mcq = { id: 'a', level: 'basic', skill: 's', type: 'math_mcq', prompt: '', expr: '36 + 27', options: ['53', '63', '64'], answer: '53', explain: '' } as Exercise;
  assert.deepEqual(checkMath(mcq).fixedAnswer, '63');
  const two = { ...mcq, options: ['63', '63.0', '64'], answer: '63' } as Exercise;
  assert.equal(checkMath(two).ok, false);
  const tf = { id: 'b', level: 'basic', skill: 's', type: 'math_truefalse', prompt: '', statement: '5 × 4 = 25', answer: 'true', explain: '' } as Exercise;
  assert.equal(checkMath(tf).fixedAnswer, 'false');
  const word = { id: 'c', level: 'good', skill: 's', type: 'math_word', prompt: '', expr: '28 + 15', answer: '43', explain: '' } as Exercise;
  assert.equal(checkMath(word).ok, true);
  const neg = { ...word, expr: '15 - 28', answer: '-13' } as Exercise;
  assert.equal(checkMath(neg).ok, false);
});

test('English structural checks', () => {
  const order = { id: 'o', level: 'basic', skill: 's', type: 'eng_order', prompt: '', words: ['name', 'my', 'is', 'Nam'], answer: 'My name is Nam.', explain: '' } as Exercise;
  assert.equal(checkLocal(order).ok, true);
  assert.equal(checkLocal({ ...order, answer: 'My name is Lan.' } as Exercise).ok, false);
  const fill = { id: 'f', level: 'basic', skill: 's', type: 'eng_fill', prompt: '', sentence: 'I ___ a cat.', options: ['have', 'am', 'is'], answer: 'has', explain: '' } as Exercise;
  assert.match(checkLocal(fill).issues[0], /one of the options/);
});

test('intake reads subject and grade', async () => {
  const ai = new MockProvider();
  assert.equal((await intake(ai, math)).subject, 'math');
  const e = await intake(ai, eng);
  assert.equal(e.subject, 'english');
  assert.equal(e.grade, 3);
});

test('maths lesson: slides plus exercises with the wrong answer fixed by code', async () => {
  const ai = new MockProvider();
  const it = await intake(ai, math);
  const slides = await makeSlides(ai, math, it);
  assert.ok(slides.length >= 8 && slides.length <= 12);
  assert.equal(slides[0].kind, 'title');
  const r = await makeExercises(ai, math, it, slides);
  assert.equal(r.exercises.length, 12);
  assert.deepEqual(r.skills.map((s) => s.tag), ['carry_1', 'word_1step']);
  for (const e of r.exercises) assert.ok(checkLocal(e).ok, `${e.id} still fails`);
  for (const e of r.exercises) assert.ok(r.skills.some((s) => s.tag === e.skill), `${e.id} has an unknown skill`);
  assert.ok(r.checks.some((c) => c.issues.some((i) => i.startsWith('fixed by code'))));
});

test('English lesson: a broken item is regenerated', async () => {
  const ai = new MockProvider();
  const it = await intake(ai, eng);
  const r = await makeExercises(ai, eng, it, await makeSlides(ai, eng, it));
  const c = r.checks.find((x) => x.exercise === 'ex02')!;
  assert.equal(c.attempts, 2);
  assert.ok(ai.calls.filter((x) => x.task === 'exercises').length === 2);
  assert.equal(r.exercises.length, 12);
});

test('flashcards and memory pairs have unique sides', async () => {
  const ai = new MockProvider();
  const c = await makeCards(ai, eng, await intake(ai, eng));
  assert.ok(c.flashcards.length >= 4);
  assert.equal(c.pairs.length, 4);
  const sides = c.pairs.flatMap((p) => [p.a, p.b]);
  assert.equal(new Set(sides).size, 8);
});

test('illustration critic rejects and regenerates', async () => {
  const ai = new MockProvider();
  const it = await intake(ai, math);
  const slides = await makeSlides(ai, math, it);
  const pic = await illustrate(ai, slides[1]);
  assert.equal(pic.tries.length, 2);
  assert.match(pic.tries[1].prompt, /no numbers/);
  assert.equal((await illustrate(ai, slides[2])).tries.length, 1);
});
