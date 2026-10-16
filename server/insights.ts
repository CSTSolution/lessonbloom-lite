// Learning summary, computed from Attempts with the teacher's criteria (Chi's defaults:
// 80 / 50 / 3 times in 2 sessions / 30% / 70%). Labels attach to a SKILL for a pupil or a
// class; nothing here is ever sent to a pupil. Pure functions, so they are easy to test.
import type { Attempt, Criteria, Label, Pupil, SelfCheck, Skill } from './types.ts';

export interface PupilSkill { pupilId: string; name: string; label: Label; right: number; total: number; topError?: string; enough: boolean }
export interface SkillSummary {
  skill: string; skillName: string; classLabel: Label;
  pupils: PupilSkill[];
  errors: { errorType: string; count: number; pupils: string[]; example?: string; exampleExercise?: string }[];   // repeated error types, most common first
}

export function pupilLabel(atts: Attempt[], c: Criteria): Omit<PupilSkill, 'pupilId' | 'name'> {
  const sorted = [...atts].sort((a, b) => a.at.localeCompare(b.at));
  const last = sorted.slice(-c.lastN);
  const right = last.filter((a) => a.correct).length, total = last.length;
  // same error type, repeated, across sessions (looks at all of this pupil's answers on the skill)
  const byErr = new Map<string, { n: number; sessions: Set<string> }>();
  for (const a of sorted) if (!a.correct && a.errorType) {
    const e = byErr.get(a.errorType) || { n: 0, sessions: new Set() };
    e.n++; e.sessions.add(a.session); byErr.set(a.errorType, e);
  }
  const top = [...byErr].sort((a, b) => b[1].n - a[1].n)[0];
  const repeatedErr = top && top[1].n >= c.repeatTimes && top[1].sessions.size >= c.repeatSessions;
  const enough = total >= c.minAnswers;
  const pct = total ? (100 * right) / total : 0;
  let label: Label = 'practising';
  if (repeatedErr || (enough && pct < c.repeatedPct)) label = 'repeated';
  else if (enough && pct >= c.securePct) label = 'secure';
  return { label, right, total, topError: top?.[0], enough };
}

// One row per pupil of the class for one lesson (teacher only): finished = reached the "all done"
// screen (a self-check), started = answered at least once. Questions are counted, never scored.
export interface PupilRow {
  pupilId: string; name: string; status: 'none' | 'started' | 'done'; tried: number; answers: number;
  skills: Record<string, Label | null>; topError?: string; mood?: SelfCheck['mood']; lastAt?: string;
}
export function pupilRows(skills: Skill[], pupils: Pupil[], attempts: Attempt[], checks: SelfCheck[], c: Criteria): PupilRow[] {
  const order = { none: 2, started: 1, done: 0 };
  return pupils.map((p): PupilRow => {
    const mine = attempts.filter((a) => a.pupilId === p.id), own = checks.filter((x) => x.pupilId === p.id).sort((a, b) => b.at.localeCompare(a.at));
    const check = own[0], felt = own.find((x) => x.mood);
    const errs = new Map<string, number>();
    for (const a of mine) if (!a.correct && a.errorType) errs.set(a.errorType, (errs.get(a.errorType) || 0) + 1);
    const top = [...errs].sort((a, b) => b[1] - a[1])[0];
    const last = [...mine.map((a) => a.at), check?.at].filter(Boolean).sort().pop();
    return {
      pupilId: p.id, name: p.displayName, status: check ? 'done' : mine.length ? 'started' : 'none',
      tried: new Set(mine.map((a) => a.exerciseId)).size, answers: mine.length,
      skills: Object.fromEntries(skills.map((s) => { const on = mine.filter((a) => a.skill === s.tag); return [s.tag, on.length ? pupilLabel(on, c).label : null]; })),
      topError: top && top[1] >= 2 ? top[0] : undefined, mood: felt?.mood, lastAt: last,
    };
  }).sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, 'vi'));
}

// a pupil's answer as a person reads it: a word-picture match is stored as JSON
export function readableAnswer(answer: string): string {
  if (!answer.startsWith('{')) return answer;
  try { return Object.entries(JSON.parse(answer) as Record<string, string>).map(([w, e]) => `${w} → ${e}`).join(', '); } catch { return answer; }
}

export function summarise(skill: Skill, pupils: Pupil[], attempts: Attempt[], c: Criteria): SkillSummary {
  const mine = attempts.filter((a) => a.skill === skill.tag);
  const ps: PupilSkill[] = pupils
    .map((p) => ({ pupilId: p.id, name: p.displayName, ...pupilLabel(mine.filter((a) => a.pupilId === p.id), c) }))
    .filter((p) => p.total > 0);
  const counted = ps.filter((p) => p.enough || p.label === 'repeated');
  const share = (l: Label) => (counted.length ? (100 * counted.filter((p) => p.label === l).length) / counted.length : 0);
  let classLabel: Label = 'practising';
  if (counted.length && share('repeated') >= c.classRepeatedPct) classLabel = 'repeated';
  else if (counted.length && share('secure') >= c.classSecurePct && !counted.some((p) => p.label === 'repeated')) classLabel = 'secure';

  const errMap = new Map<string, { count: number; pupils: Set<string>; example?: string; exampleExercise?: string }>();
  for (const a of mine) if (!a.correct && a.errorType) {
    const e = errMap.get(a.errorType) || { count: 0, pupils: new Set<string>() };
    e.count++; e.pupils.add(a.pupilId); if (!e.example) { e.example = readableAnswer(a.answer); e.exampleExercise = a.exerciseId; } errMap.set(a.errorType, e);
  }
  const nameOf = new Map(pupils.map((p) => [p.id, p.displayName]));
  const errors = [...errMap].map(([errorType, e]) => ({ errorType, count: e.count, pupils: [...e.pupils].map((id) => nameOf.get(id) || '?'), example: e.example, exampleExercise: e.exampleExercise }))
    .filter((e) => ps.some((p) => p.label === 'repeated' && p.topError === e.errorType))
    .sort((a, b) => b.count - a.count);
  return { skill: skill.tag, skillName: skill.name, classLabel, pupils: ps, errors };
}

export interface Suggestion { kind: 'same' | 'harder'; skill: string; skillName: string; exerciseIds: string[]; reason?: string }

// What the pupil sees on the "Con làm xong rồi!" screen: more of the skill they keep
// getting wrong, or a harder item where they are secure. Never a score.
export function nextSteps(skills: Skill[], pupilAttempts: Attempt[], pool: { id: string; skill: string; level: string }[], c: Criteria): Suggestion[] {
  const out: Suggestion[] = [];
  for (const s of skills) {
    const atts = pupilAttempts.filter((a) => a.skill === s.tag);
    if (!atts.length) continue;
    const { label, topError } = pupilLabel(atts, { ...c, minAnswers: Math.min(c.minAnswers, 3) });
    const lastWrong = atts.slice(-3).some((a) => !a.correct);
    const seen = new Set(atts.filter((a) => a.correct).map((a) => a.exerciseId));
    if (label === 'repeated' || lastWrong) {
      const sameSkill = pool.filter((e) => e.skill === s.tag);
      // not yet answered right first, then items they slipped on, then anything of the skill
      const slipped = new Set(atts.filter((a) => !a.correct).map((a) => a.exerciseId));
      const fresh = sameSkill.filter((e) => !seen.has(e.id) && e.level !== 'advanced');
      const ranked = fresh.length ? fresh : [...sameSkill.filter((e) => slipped.has(e.id)), ...sameSkill];
      const ids = [...new Set(ranked.map((e) => e.id))].slice(0, 3);
      if (ids.length) out.push({ kind: 'same', skill: s.tag, skillName: s.name, exerciseIds: ids, reason: topError });
    } else if (label === 'secure' || atts.filter((a) => a.correct).length >= 3) {
      const ids = pool.filter((e) => e.skill === s.tag && e.level === 'advanced' && !seen.has(e.id)).map((e) => e.id).slice(0, 3);
      if (ids.length) out.push({ kind: 'harder', skill: s.tag, skillName: s.name, exerciseIds: ids });
    }
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'same' ? -1 : 1)).slice(0, 2);
}
