// "Tổng kết bài đã giao" (Lớp học → Bài đã giao → Xem tóm tắt): for one lesson given to one class, the class
// as a whole first (who has done it, the skills many pupils are stuck on), then one row per pupil (parts
// opened, right / not yet right per skill, repeated slip, retries, self-check, what to practise next).
// Tap a pupil to see every question they answered. Teacher only; no scores, no ranking.
import { Fragment, useEffect, useState } from 'react';
import { teacherApi, type AssignmentSummaryT, type PupilQuestions } from '../api.ts';
import { useLang, useT, withCls } from '../i18n.ts';
import { T } from './dict.ts';
import { ErrorNote } from './ErrorNote.tsx';
import { LabelChip } from './Insights.tsx';
import { Link } from './TeacherRoutes.tsx';

const S = {
  vi: {
    title: 'Tổng kết bài đã giao', back: '‹ Về lớp', due: 'Hạn', clsH: 'Cả lớp', pupilsH: 'Từng học sinh', tap: 'Bấm vào một em để xem từng câu em đã làm.',
    counts: (d: number, s: number, n: number, all: number, j: number) => `Đã xong ${d}/${all} · Đang làm ${s} · Chưa làm ${n} · Đã vào lớp ${j}/${all}`,
    colSkill: 'Dạng bài', colLabel: 'Nhãn của lớp', colStuck: 'Số em lỗi lặp lại', colSecure: 'Số em đã vững', colErr: 'Lỗi hay gặp',
    colPupil: 'Học sinh', colStatus: 'Trạng thái', colParts: 'Phần đã học', colRep: 'Lỗi lặp lại', colRetry: 'Làm lại', colMood: 'Con thấy bài', colNext: 'Gợi ý tiếp',
    status: { none: 'Chưa làm', started: 'Đang làm', done: 'Đã xong' }, parts: { video: 'Video', cards: 'Thẻ nhớ', practice: 'Bài tập', memory: 'Lật thẻ' },
    right: 'đúng', wrong: 'chưa đúng', moods: { easy: '😊 Dễ', ok: '🙂 Vừa', hard: '😟 Khó' }, same: 'Luyện thêm', harder: 'Nâng cao', times: (n: number) => `${n} lần`,
    qH: (n: string) => `Từng câu của ${n}`, tries: 'Các lần trả lời', none: 'Em chưa trả lời câu nào.', insights: 'Tóm tắt học tập và gợi ý lời nhận xét ›', notJoined: 'chưa vào lớp',
    levels: { basic: 'Cơ bản', good: 'Khá', advanced: 'Nâng cao' }, note: 'Chỉ cô xem được. Học sinh và phụ huynh không thấy số câu đúng / chưa đúng hay nhãn.',
  },
  en: {
    title: 'Assigned lesson summary', back: '‹ Back to class', due: 'Due', clsH: 'The class', pupilsH: 'Each pupil', tap: 'Tap a pupil to see every question they answered.',
    counts: (d: number, s: number, n: number, all: number, j: number) => `Finished ${d}/${all} · In progress ${s} · Not started ${n} · Joined ${j}/${all}`,
    colSkill: 'Skill', colLabel: 'Class label', colStuck: 'Pupils with a repeated slip', colSecure: 'Pupils secure', colErr: 'Common slip',
    colPupil: 'Pupil', colStatus: 'Status', colParts: 'Parts done', colRep: 'Repeated slip', colRetry: 'Retries', colMood: 'How it felt', colNext: 'Next practice',
    status: { none: 'Not started', started: 'In progress', done: 'Finished' }, parts: { video: 'Video', cards: 'Flashcards', practice: 'Exercises', memory: 'Memory' },
    right: 'right', wrong: 'not yet', moods: { easy: '😊 Easy', ok: '🙂 Just right', hard: '😟 Hard' }, same: 'More practice', harder: 'Challenge', times: (n: number) => `${n}×`,
    qH: (n: string) => `${n}'s answers`, tries: 'Answers given', none: 'No answers yet.', insights: 'Learning summary and suggested comments ›', notJoined: 'not joined yet',
    levels: { basic: 'Basic', good: 'Good', advanced: 'Advanced' }, note: 'Only you see this. Pupils and parents never see right / not-yet counts or labels.',
  },
};
const ICON = { video: '▶', cards: '⇄', practice: '?', memory: '◆' } as const;

function Questions({ aid, pid }: { aid: string; pid: string }) {
  const s = useT(S);
  const [q, setQ] = useState<PupilQuestions | null>(null), [err, setErr] = useState('');
  useEffect(() => { teacherApi.assignmentPupil(aid, pid).then(setQ, (e) => setErr((e as Error).message)); }, [aid, pid]);
  if (err) return <ErrorNote text={err} />;
  if (!q) return <p className="muted small" role="status">…</p>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <strong>{s.qH(q.name)}</strong>
      {!q.questions.length && <p className="muted small" style={{ margin: 0 }}>{s.none}</p>}
      {q.questions.map((x, i) => (
        <div key={x.id} className="qa-row">
          <div><span className="muted small">{i + 1}. {x.skill} · {s.levels[x.level as keyof typeof s.levels] || x.level}</span><div>{x.question}</div></div>
          <div className="qa-tries" aria-label={s.tries}>{x.tries.map((a, k) => (
            <span key={k} className={`qa-try ${a.correct ? 'ok' : 'no'}`}>{a.correct ? '✓' : '✗'} {a.answer || '–'}{!a.correct && a.errorType ? <em> · {a.errorType}</em> : null}</span>))}</div>
        </div>
      ))}
    </div>
  );
}

export function AssignmentSummary({ aid }: { aid: string }) {
  const s = useT(S), t = useT(T), lang = useLang();
  const [d, setD] = useState<AssignmentSummaryT | null>(null), [err, setErr] = useState(''), [open, setOpen] = useState<string | null>(null);
  useEffect(() => { teacherApi.assignmentSummary(aid).then(setD, (e) => setErr((e as Error).message)); }, [aid]);
  if (err) return <main className="page"><ErrorNote text={err} /></main>;
  if (!d) return <p className="page muted" role="status">{t.loading}</p>;
  const c = d.cls, skills = d.lesson.skills;
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB') : '');
  return (
    <main className="page stack" style={{ gap: 18 }}>
      <div><Link to={`/classes?cid=${d.klass.id}`} className="small">{s.back}</Link>
        <h1 style={{ margin: '6px 0 0' }}>{s.title}: {d.lesson.title}</h1>
        <p className="muted" style={{ margin: 0 }}>{withCls(t.cls, d.klass.name)}{d.assignment.dueAt ? ` · ${s.due} ${when(d.assignment.dueAt)}` : ''}</p></div>
      <p className="ro-note" role="note">🔒 {s.note}</p>

      <div className="card stack">
        <div className="row"><h2 className="grow" style={{ margin: 0 }}>{s.clsH}</h2><span className="muted small">{s.counts(c.done, c.started, c.none, c.total, c.joined)}</span></div>
        <div className="bar" style={{ height: 10 }}><span style={{ width: `${(100 * c.done) / Math.max(1, c.total)}%` }} /></div>
        <div className="table-scroll"><table className="t">
          <thead><tr><th>{s.colSkill}</th><th>{s.colLabel}</th><th>{s.colStuck}</th><th>{s.colSecure}</th><th>{s.colErr}</th></tr></thead>
          <tbody>{c.skills.map((k) => <tr key={k.tag}><td>{k.name}</td><td>{k.label ? <LabelChip l={k.label} /> : '–'}</td><td>{k.stuck || '–'}</td><td>{k.secure || '–'}</td><td className="small">{k.topError || '–'}</td></tr>)}</tbody>
        </table></div>
        <Link to={`/insights?lessonId=${d.lesson.id}&classId=${d.klass.id}`} className="small">{s.insights}</Link>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>{s.pupilsH}</h2>
        <p className="muted small" style={{ margin: 0 }}>{s.tap}</p>
        <div className="table-scroll"><table className="t pupils-t as-t">
          <thead><tr><th>{s.colPupil}</th><th>{s.colStatus}</th><th>{s.colParts}</th>{skills.map((k) => <th key={k.tag}>{k.name}</th>)}<th>{s.colRep}</th><th>{s.colRetry}</th><th>{s.colMood}</th><th>{s.colNext}</th></tr></thead>
          <tbody>{d.pupils.map((p) => (
            <Fragment key={p.pupilId}>
              <tr className={`${p.status === 'none' ? 'muted' : ''} clickable ${open === p.pupilId ? 'open' : ''}`} onClick={() => setOpen(open === p.pupilId ? null : p.pupilId)}
                tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(open === p.pupilId ? null : p.pupilId); } }} aria-expanded={open === p.pupilId}>
                <td><strong>{p.name}</strong>{!p.joined && <div className="small muted">{s.notJoined}</div>}</td>
                <td><span className={`st st-${p.status}`}>{s.status[p.status]}</span></td>
                <td><span className="parts">{d.lesson.parts.map((x) => <span key={x} className={p.parts.includes(x) ? 'on' : ''} title={s.parts[x]} aria-label={`${s.parts[x]}${p.parts.includes(x) ? ' ✓' : ''}`}>{ICON[x]}</span>)}</span></td>
                {skills.map((k) => { const v = p.skills[k.tag]; return <td key={k.tag}>{v && v.right + v.wrong > 0 ? <div className="stack" style={{ gap: 2 }}><LabelChip l={v.label} /><span className="small"><span className="ok-t">{v.right} {s.right}</span> · <span className="no-t">{v.wrong} {s.wrong}</span></span></div> : '–'}</td>; })}
                <td className="small">{p.repeated || '–'}</td>
                <td>{p.retries ? s.times(p.retries) : '–'}</td>
                <td className="small">{p.mood ? s.moods[p.mood] : '–'}</td>
                <td className="small">{p.next.length ? p.next.map((x) => `${x.kind === 'same' ? s.same : s.harder}: ${x.skillName}`).join('; ') : '–'}</td>
              </tr>
              {open === p.pupilId && <tr className="detail"><td colSpan={7 + skills.length}><Questions aid={aid} pid={p.pupilId} /></td></tr>}
            </Fragment>
          ))}</tbody>
        </table></div>
      </div>
    </main>
  );
}
