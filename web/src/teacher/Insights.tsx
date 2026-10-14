// Screen 03 · "Tóm tắt học tập": lesson + class filter, the TT27 notice, overview (skill × class
// labels), repeated mistakes with the pupils' names (teacher only), mastered skills, and AI
// comment drafts the teacher edits and copies. No scores anywhere.
import { useEffect, useState } from 'react';
import { teacherApi, type Insights as Ins, type Label } from '../api.ts';
import { useT } from '../i18n.ts';
import { LABEL_KEY, T } from './dict.ts';
import { Link } from './TeacherRoutes.tsx';

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
  if (!d) return <p className="page muted">…</p>;
  if (!d.lessons.length) return <main className="page"><h1>{t.inTitle}</h1><p className="muted">{t.noData}</p></main>;
  const cname = d.classes.find((k) => k.id === d.classId)?.name || '';
  const repeated = (d.detail || []).filter((s) => s.classLabel === 'repeated' || s.errors.length);
  const mastered = (d.detail || []).filter((s) => s.classLabel === 'secure');
  const nameOf = new Map((d.detail || []).flatMap((s) => s.pupils.map((p) => [p.pupilId, p.name] as const)));

  const draft = async () => { setDrafting(true); try { setComments(await teacherApi.comments(d.lessonId, d.classId)); } finally { setDrafting(false); } };
  const copy = (text: string, key: string) => { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); };

  return (
    <main className="page stack" style={{ gap: 18 }}>
      <h1>{t.inTitle}</h1>
      <div className="card row" style={{ gap: 16 }}>
        <label className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><span className="muted">{t.lessonLabel}</span>
          <select value={d.lessonId} onChange={(e) => setLessonId(e.target.value)} style={{ minWidth: 260 }}>{d.lessons.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
        <span className="muted">{t.cls}</span>
        <div className="pills">{d.classes.map((k) => <button key={k.id} className={`pill ${d.classId === k.id ? 'on' : ''}`} onClick={() => setClassId(k.id)}>{t.cls} {k.name}</button>)}</div>
      </div>
      <div className="note">ⓘ {t.notice}</div>

      <div className="card stack">
        <h2>{t.overview}</h2>
        <table className="t">
          <thead><tr><th>{t.colSkill}</th>{d.classes.map((k) => <th key={k.id}>{t.cls} {k.name}</th>)}</tr></thead>
          <tbody>{d.overview.map((o) => <tr key={o.skill}><td>{o.name}</td>{d.classes.map((k) => <td key={k.id}><LabelChip l={o.byClass[k.id]} /></td>)}</tr>)}</tbody>
        </table>
        <div className="row small muted" style={{ gap: 16 }}>
          <span><LabelChip l="repeated" />: {t.tagRd}</span><span><LabelChip l="practising" />: {t.tagPd}</span><span><LabelChip l="secure" />: {t.tagMd}</span>
          <span className="grow" /><Link to="/criteria">{t.editCriteria}</Link>
        </div>
      </div>

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
                  {e.example && <div className="muted">{t.example} → {e.example}</div>}
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
