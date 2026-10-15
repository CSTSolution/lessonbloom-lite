// Chi's default criteria: secure >= 80% of the last 10 (min 5 answers); repeated < 50% or the
// same error type >= 3 times across >= 2 sessions; class repeated if >= 30% of pupils are.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextSteps, pupilLabel, summarise } from '../insights.ts';
import { type Attempt, DEFAULT_CRITERIA as C } from '../types.ts';

let n = 0;
const att = (pupilId: string, correct: boolean, session = 's1', errorType?: string, skill = 'carry_1', exerciseId = `e${n % 6}`): Attempt =>
  ({ id: `a${n++}`, assignmentId: 'as', classId: 'k', pupilId, lessonId: 'l', exerciseId, skill, answer: correct ? '63' : '53', correct, errorType, at: new Date(1e12 + n * 1000).toISOString(), session });

test('pupil labels follow the criteria', () => {
  assert.equal(pupilLabel([att('p', true), att('p', true), att('p', true), att('p', true), att('p', true)], C).label, 'secure');
  assert.equal(pupilLabel([att('p', true), att('p', true)], C).label, 'practising', 'too few answers to say');
  assert.equal(pupilLabel([att('p', false), att('p', false), att('p', false), att('p', true), att('p', true)], C).label, 'repeated', 'below 50%');
  const sameSlip = [att('p', false, 's1', 'carry'), att('p', false, 's1', 'carry'), att('p', false, 's2', 'carry'), ...Array(7).fill(0).map(() => att('p', true, 's2'))];
  assert.equal(pupilLabel(sameSlip, C).label, 'repeated', 'same error 3x in 2 sessions, even at 70%');
  const oneSession = [att('p', false, 's1', 'carry'), att('p', false, 's1', 'carry'), att('p', false, 's1', 'carry'), ...Array(7).fill(0).map(() => att('p', true, 's1'))];
  assert.equal(pupilLabel(oneSession, C).label, 'practising', 'one bad session is not a pattern');
});

test('class label and repeated-error groups', () => {
  const pupils = ['a', 'b', 'c', 'd'].map((x) => ({ id: x, classId: 'k', displayName: x.toUpperCase() }));
  const atts = [
    ...['a', 'b'].flatMap((p) => [att(p, false, 's1', 'carry'), att(p, false, 's1', 'carry'), att(p, false, 's2', 'carry'), att(p, true, 's2'), att(p, true, 's2')]),
    ...['c', 'd'].flatMap((p) => Array(5).fill(0).map(() => att(p, true))),
  ];
  const s = summarise({ tag: 'carry_1', name: 'Nhớ 1' }, pupils, atts, C);
  assert.equal(s.classLabel, 'repeated');                       // 50% of pupils >= 30%
  assert.deepEqual(s.errors[0].pupils.sort(), ['A', 'B']);
  const allGood = summarise({ tag: 'carry_1', name: 'Nhớ 1' }, pupils, pupils.flatMap((p) => Array(5).fill(0).map(() => att(p.id, true))), C);
  assert.equal(allGood.classLabel, 'secure');
});

test('next steps: same skill after slips, harder when secure', () => {
  const pool = [{ id: 'e1', skill: 'carry_1', level: 'basic' }, { id: 'e2', skill: 'carry_1', level: 'good' }, { id: 'e3', skill: 'carry_1', level: 'advanced' },
    { id: 'w1', skill: 'word', level: 'basic' }, { id: 'w3', skill: 'word', level: 'advanced' }];
  const skills = [{ tag: 'carry_1', name: 'Nhớ 1' }, { tag: 'word', name: 'Lời văn' }];
  const mine = [att('p', false, 's1', 'carry', 'carry_1', 'e0'), att('p', false, 's1', 'carry', 'carry_1', 'e0'), att('p', false, 's1', 'carry', 'carry_1', 'e0'),
    att('p', true, 's1', undefined, 'word', 'w1'), att('p', true, 's1', undefined, 'word', 'w0'), att('p', true, 's1', undefined, 'word', 'w9')];
  const s = nextSteps(skills, mine, pool, C);
  assert.equal(s[0].kind, 'same'); assert.equal(s[0].skill, 'carry_1'); assert.ok(!s[0].exerciseIds.includes('e3'));
  assert.equal(s[1].kind, 'harder'); assert.deepEqual(s[1].exerciseIds, ['w3']);
});

test('next steps still suggest practice when every item was already answered', () => {
  const pool = [{ id: 'e1', skill: 'carry_1', level: 'basic' }, { id: 'e2', skill: 'carry_1', level: 'good' }];
  const mine = ['e1', 'e2'].flatMap((id) => [att('p', false, 's1', 'carry', 'carry_1', id), att('p', true, 's1', undefined, 'carry_1', id)]);
  const s = nextSteps([{ tag: 'carry_1', name: 'Nhớ 1' }], mine, pool, C);
  assert.equal(s.length, 1); assert.equal(s[0].kind, 'same'); assert.ok(s[0].exerciseIds.length >= 1);
});
