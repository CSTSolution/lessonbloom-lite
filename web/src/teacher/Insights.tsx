// Screen 03 · "Tóm tắt học tập": lesson + class filter, the TT27 notice, overview (skill × class
// labels), repeated mistakes with the pupils' names (teacher only), mastered skills, and AI
// comment drafts the teacher edits and copies. No scores anywhere.
import { useEffect, useState } from 'react';
import { teacherApi, type Insights as Ins, type Label } from '../api.ts';
import { useLang, useT } from '../i18n.ts';
import { LABEL_KEY, T } from './dict.ts';
import { Link } from './TeacherRoutes.tsx';
import { GuideHint } from './Guide.tsx';
import { shareMessage } from './share.ts';

// "Kết quả từng học sinh": every pupil of the class for this lesson, including those not started
const R = {
  vi: { h: 'Kết quả từng học sinh', sub: 'Bấm tên để xem chi tiết. Chỉ cô xem được; học sinh không thấy nhãn hay điểm.',
    status: { none: 'Chưa làm', started: 'Đang làm', done: 'Đã xong' }, colPupil: 'Học sinh', colStatus: 'Trạng thái', colTried: 'Câu đã làm', colErr: 'Lỗi hay gặp', colMood: 'Con thấy bài', colLast: 'Lần cuối',
    count: (d: number, s: number, n: number, all: number) => `Đã xong ${d}/${all} · Đang làm ${s} · Chưa làm ${n}`, moods: { easy: '😊 Dễ', ok: '🙂 Vừa', hard: '😟 Khó' },
    notAssigned: (k: string) => `Bài này chưa giao cho lớp ${k}.`, assign: 'Giao bài', noPupils: 'Lớp này chưa có học sinh.', remind: 'Nhắc các em chưa làm', reminded: 'Đã chép lời nhắc' ,
    remindMsg: (names: string[], title: string) => `Phụ huynh của ${names.join(', ')} nhắc con làm bài "${title}" trên LessonBloom giúp cô nhé. Cảm ơn quý phụ huynh!` },
  en: { h: 'Each pupil’s results', sub: 'Tap a name for details. Only you see this; pupils never see labels or scores.',
    status: { none: 'Not started', started: 'In progress', done: 'Finished' }, colPupil: 'Pupil', colStatus: 'Status', colTried: 'Questions done', colErr: 'Common slip', colMood: 'How it felt', colLast: 'Last active',
    count: (d: number, s: number, n: number, all: number) => `Finished ${d}/${all} · In progress ${s} · Not started ${n}`, moods: { easy: '😊 Easy', ok: '🙂 Just right', hard: '😟 Hard' },
    notAssigned: (k: string) => `This lesson is not assigned to class ${k} yet.`, assign: 'Assign', noPupils: 'This class has no pupils yet.', remind: 'Remind those not started', reminded: 'Reminder copied',
    remindMsg: (names: string[], title: string) => `Dear parents of ${names.join(', ')}: please remind your child to do "${title}" on LessonBloom. Thank you!` },
};

function PupilTable({ d }: { d: Ins }) {
  const r = useT(R), lang = useLang();
  const [copied, setCopied] = useState(false);
  const rows = d.pupils || [], skills = d.skills || [];
  const cname = d.classes.find((k) => k.id === d.classId)?.name || '';
  const title = d.lessons.find((x) => x.id === d.lessonId)?.title || '';
  const n = (s: string) => rows.filter((x) => x.status === s).length;
  const notYet = rows.filter((x) => x.status === 'none').map((x) => x.name);
  const when = (iso?: string) => iso ? new Date(iso).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
  const remind = async () => { const url = `${location.origin}/learn`; await shareMessage(`${r.remindMsg(notYet, title)} ${url}`, url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="card stack">
      <div className="row"><h2 className="grow" style={{ margin: 0 }}>{r.h}</h2>
        {d.assigned && rows.length > 0 && <span className="muted small">{r.count(n('done'), n('started'), n('none'), rows.length)}</span>}
        {d.assigned && notYet.length > 0 && <button className="btn sm" onClick={remind}>{copied ? `✓ ${r.reminded}` : r.remind}</button>}
      </div>
      <p className="muted small" style={{ margin: 0 }}>{r.sub}</p>
      {!d.assigned ? <div className="row"><span className="muted">{r.notAssigned(cname)}</span><Link to={`/lesson/${d.lessonId}/assign`} className="btn sm primary">{r.assign}</Link></div>
        : !rows.length ? <p className="muted" style={{ margin: 0 }}>{r.noPupils}</p>
        : <div className="table-scroll"><table className="t pupils-t">
          <thead><tr><th>{r.colPupil}</th><th>{r.colStatus}</th><th>{r.colTried}</th>{skills.map((s) => <th key={s.tag}>{s.name}</th>)}<th>{r.colErr}</th><th>{r.colMood}</th><th>{r.colLast}</th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.pupilId} className={p.status === 'none' ? 'muted' : ''}>
              <td><Link to={`/classes/${d.classId}/pupil/${p.pupilId}`}>{p.name}</Link></td>
              <td><span className={`st st-${p.status}`}>{r.status[p.status]}</span></td>
              <td>{p.status === 'none' ? '–' : p.tried}</td>
              {skills.map((s) => <td key={s.tag}>{p.skills[s.tag] ? <LabelChip l={p.skills[s.tag]} /> : '–'}</td>)}
              <td className="small">{p.topError || '–'}</td>
              <td className="small">{p.mood ? r.moods[p.mood] : '–'}</td>
              <td className="small muted">{when(p.lastAt)}</td>
            </tr>))}</tbody>
        </table></div>}
    </div>
  );
}

export function LabelChip({ l }: { l: Label | null }) {
  const t = useT(T);
  if (!l) return <span className="muted">–</span>;
  return <span className={`chip lbl-${l}`}>{t[LABEL_KEY[l]]}</span>;
}

export function Insights() {
  const t = useT(T);
  const q = new URLSearchParams(location.search);
  const [lessonId, setLessonId] = useState(q.get('lessonId') || undefined);
  const [classId, setClassId] = useState(q.get('classId') || undefined);
  const [d, setD] = useState<Ins | null>(null);
  const [comments, setComments] = useState<{ pupilId: string; text: string }[] | null>(null);
  const [drafting, setDrafting] = useState(false), [copied, setCopied] = useState('');
  useEffect(() => { teacherApi.insights(lessonId, classId).then((x) => { setD(x); setComments(null); }); }, [lessonId, classId]);
  if (!d) return <p className="page muted" role="status">{t.loading}</p>;
  if (!d.lessons.length) return <main className="page stack"><h1>{t.inTitle}</h1><div className="card empty"><p className="muted" style={{ margin: 0 }}>{t.insEmpty}</p><Link to="/new" className="btn primary">＋ {t.newLesson}</Link></div></main>;
  const cname = d.classes.find((k) => k.id === d.classId)?.name || '';
  const repeated = (d.detail || []).filter((s) => s.classLabel === 'repeated' || s.errors.length);
  const mastered = (d.detail || []).filter((s) => s.classLabel === 'secure');
  const nameOf = new Map((d.detail || []).flatMap((s) => s.pupils.map((p) => [p.pupilId, p.name] as const)));

  const draft = async () => { setDrafting(true); try { setComments(await teacherApi.comments(d.lessonId, d.classId)); } finally { setDrafting(false); } };
  const copy = (text: string, key: string) => { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); };

  return (
    <main className="page stack" style={{ gap: 18 }}>
      <h1>{t.inTitle}</h1>
      <GuideHint step="insights" />
      <div className="card row" style={{ gap: 16 }}>
        <label className="row lesson-pick" style={{ gap: 8, flexWrap: 'nowrap' }}><span className="muted" style={{ whiteSpace: 'nowrap' }}>{t.lessonLabel}</span>
          <select value={d.lessonId} onChange={(e) => setLessonId(e.target.value)} style={{ minWidth: 0, maxWidth: 420 }}>{d.lessons.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
        <span className="muted">{t.cls}</span>
        <div className="pills">{d.classes.map((k) => <button key={k.id} className={`pill ${d.classId === k.id ? 'on' : ''}`} onClick={() => setClassId(k.id)}>{t.cls} {k.name}</button>)}</div>
      </div>
      <div className="note">ⓘ {t.notice}</div>

      <div className="card stack">
        <h2>{t.overview}</h2>
        <div className="table-scroll"><table className="t overview">
          <thead><tr><th>{t.colSkill}</th>{d.classes.map((k) => <th key={k.id}>{t.cls} {k.name}</th>)}</tr></thead>
          <tbody>{d.overview.map((o) => <tr key={o.skill}><td>{o.name}</td>{d.classes.map((k) => <td key={k.id}><LabelChip l={o.byClass[k.id]} /></td>)}</tr>)}</tbody>
        </table></div>
        <div className="row small muted" style={{ gap: 16 }}>
          <span><LabelChip l="repeated" />: {t.tagRd}</span><span><LabelChip l="practising" />: {t.tagPd}</span><span><LabelChip l="secure" />: {t.tagMd}</span>
          <span className="grow" /><Link to="/criteria">{t.editCriteria}</Link>
        </div>
      </div>

      <PupilTable d={d} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18, alignItems: 'start' }}>
        <section className="stack">
          <h3 style={{ color: 'var(--amber)' }}>{t.repeatH(cname)}</h3>
          {repeated.length === 0 && <p className="muted">{t.noRepeat}</p>}
          {repeated.map((s) => (
            <div key={s.skill} className="card stack" style={{ gap: 8 }}>
              <strong>{s.errors[0]?.errorType || s.skillName}</strong>
              <span className="muted small">{t.colSkill}: {s.skillName}</span>
              {s.errors.slice(0, 2).map((e) => (
                <div key={e.errorType} className="small">
                  {e.example && <div className="muted">{t.example} {e.example}</div>}
                  <div><strong>{e.pupils.length} {t.pupilsW}:</strong> {e.pupils.join(', ')}</div>
                </div>
              ))}
              {!s.errors.length && <div className="small">{s.pupils.filter((p) => p.label === 'repeated').map((p) => p.name).join(', ')}</div>}
              <div className="small" style={{ background: 'var(--cream)', borderRadius: 10, padding: '8px 10px' }}>{t.autoSame}</div>
            </div>
          ))}
        </section>
        <section className="stack">
          <h3 style={{ color: 'var(--green-ink)' }}>{t.masterH(cname)}</h3>
          {mastered.map((s) => (
            <div key={s.skill} className="card stack" style={{ gap: 8 }}>
              <strong>{s.skillName}</strong>
              <div className="small" style={{ background: 'var(--green-soft)', borderRadius: 10, padding: '8px 10px' }}>{t.autoHarder}</div>
            </div>
          ))}
          {!mastered.length && <p className="muted">–</p>}
        </section>
      </div>

      <div className="card stack">
        <div className="row"><h2 className="grow">{t.commentH}</h2>
          <button className="btn sm" disabled={drafting} onClick={draft}>{drafting ? t.drafting : comments ? t.regenComments : t.draftComments}</button>
          {comments?.length ? <button className="btn sm" onClick={() => copy(comments.map((c) => `${nameOf.get(c.pupilId) || ''}: ${c.text}`).join('\n'), 'all')}>{copied === 'all' ? t.copied : t.copyAll}</button> : null}
        </div>
        <p className="muted small" style={{ margin: 0 }}>{t.commentD}</p>
        {comments?.map((c, i) => (
          <div key={c.pupilId + i} className="row" style={{ alignItems: 'flex-start', borderTop: '1px solid var(--line)', paddingTop: 10, flexWrap: 'nowrap' }}>
            <strong style={{ minWidth: 70 }}>{nameOf.get(c.pupilId) || ''}</strong>
            <textarea rows={2} defaultValue={c.text} style={{ flex: 1 }} onChange={(e) => { c.text = e.target.value; }} />
            <button className="btn sm" onClick={() => copy(c.text, c.pupilId)}>{copied === c.pupilId ? t.copied : t.copy}</button>
          </div>
        ))}
      </div>
    </main>
  );
}
