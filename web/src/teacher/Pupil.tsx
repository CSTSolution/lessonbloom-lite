// One pupil (teacher view, /classes/:cid/pupil/:pid): every lesson assigned to the class, the
// pupil's skills with the same labels as the learning summary, recent mistakes and self-checks.
// The teacher can rename the pupil or remove them. Pupils themselves never see labels or scores.
import { useEffect, useState } from 'react';
import { go, teacherApi, type PupilProgress } from '../api.ts';
import { useLang, useT, withCls } from '../i18n.ts';
import { LABEL_KEY, T } from './dict.ts';
import { ErrorNote } from './ErrorNote.tsx';
import { Link } from './TeacherRoutes.tsx';

export function Pupil({ cid, pid }: { cid: string; pid: string }) {
  const t = useT(T), lang = useLang();
  const [d, setD] = useState<PupilProgress | null>(null), [err, setErr] = useState('');
  const [editing, setEditing] = useState(false), [name, setName] = useState('');
  const load = () => teacherApi.pupil(cid, pid).then((x) => { setD(x); setName(x.pupil.displayName); }).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, [cid, pid]);
  if (err && !d) return <main className="page narrow"><ErrorNote text={err} /></main>;
  if (!d) return <p className="page muted" role="status">{t.loading}</p>;
  const day = (s: string | null) => (s ? new Date(s).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB') : '');
  const rename = async () => { try { await teacherApi.renamePupil(cid, pid, name); setEditing(false); load(); } catch (e) { setErr((e as Error).message); } };
  const remove = async () => { if (!confirm(t.delPupilConfirm(d.pupil.displayName))) return; try { await teacherApi.deletePupil(cid, pid); go('/classes'); } catch (e) { setErr((e as Error).message); } };

  return (
    <main className="page narrow stack" style={{ gap: 18 }}>
      <Link to="/classes" className="link-btn" style={{ alignSelf: 'flex-start' }}>{t.backClass}</Link>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="grow">
          {editing
            ? <form className="row" onSubmit={(e) => { e.preventDefault(); rename(); }}><input autoFocus maxLength={30} value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 260 }} /><button className="btn primary sm">{t.save}</button><button type="button" className="btn sm" onClick={() => setEditing(false)}>{t.cancel}</button></form>
            : <h1>{d.pupil.displayName}</h1>}
          <p className="muted" style={{ margin: '6px 0 0' }}>{t.pupilOf(withCls(t.cls, d.className))} · {d.pupil.joinedAt ? t.joined : t.notYet}</p>
        </div>
        {!editing && <button className="btn sm" onClick={() => setEditing(true)}>{t.rename}</button>}
        <button className="btn sm danger" onClick={remove}>{t.removePupil}</button>
      </div>
      <ErrorNote text={err} />
      {d.lessons.length === 0 && <div className="card empty"><p className="muted">{t.pNoLessons}</p></div>}
      {d.lessons.map((l) => (
        <section key={l.lessonId} className="card stack">
          <div className="row"><h3 className="grow">{l.title}</h3><span className="chip">{l.subject === 'english' ? t.english : t.math}</span></div>
          <p className="muted small" style={{ margin: 0 }}>{l.answered ? `${t.pAnswered(l.answered, l.sessions)} · ${t.pLast}: ${day(l.lastAt)}` : t.pNone}{l.mood ? ` · ${t.pMood}: ${t.moods[l.mood]}` : ''}</p>
          {l.skills.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <strong className="small">{t.pSkills}</strong>
              {l.skills.map((s) => (
                <div key={s.skill} className="row" style={{ gap: 10 }}>
                  <span className={`chip lbl-${s.label}`}>{t[LABEL_KEY[s.label]]}</span>
                  <span className="grow">{s.name}</span>
                  <span className="muted small">{s.right}/{s.total}</span>
                </div>
              ))}
            </div>
          )}
          {l.mistakes.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              <strong className="small">{t.pMistakes}</strong>
              {l.mistakes.map((m, i) => <div key={i} className="small"><span style={{ color: 'var(--amber)', fontWeight: 600 }}>{m.errorType}</span> · {m.exercise} → <em>{m.answer}</em></div>)}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
