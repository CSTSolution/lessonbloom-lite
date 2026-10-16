// Screen 02 · "Lớp học của cô": class tabs, key numbers, assigned lessons with progress, the
// roster (names only) and the class code; add a class (with its subject) or pupils; filter by subject.
import { useEffect, useState } from 'react';
import { go, teacherApi, type ClassCard, type ClassDetail, type Insights } from '../api.ts';
import { useT } from '../i18n.ts';
import { T } from './dict.ts';
import { activeStep, GuideHint, pulse } from './Guide.tsx';
import { shareMessage } from './share.ts';
import { ErrorNote } from './ErrorNote.tsx';
import { Link } from './TeacherRoutes.tsx';

export function Classes() {
  const t = useT(T);
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [cid, setCid] = useState('');
  const [d, setD] = useState<ClassDetail | null>(null);
  const [ins, setIns] = useState<Insights | null>(null);
  const [adding, setAdding] = useState<'class' | 'pupils' | null>(() => (new URLSearchParams(location.search).has('add') || activeStep() === 'class' ? 'class' : null));
  const [form, setForm] = useState<{ name: string; names: string; subject: 'math' | 'english' | 'both' }>({ name: '', names: '', subject: 'math' });
  const [subj, setSubj] = useState<'all' | 'math' | 'english'>('all');
  const [loaded, setLoaded] = useState(false), [copied, setCopied] = useState(''), [shared, setShared] = useState(''), [err, setErr] = useState('');
  const [edit, setEdit] = useState<{ name: string; subject: 'math' | 'english' | 'both' } | null>(null);
  const load = () => teacherApi.classes().then((cs) => { setClasses(cs); setLoaded(true); setCid((c) => c || cs[0]?.id || ''); });
  useEffect(() => { load(); }, []);
  const visible = classes.filter((k) => subj === 'all' || !k.subject || k.subject === subj || k.subject === 'both');
  const subjName = (x?: string) => (x === 'math' ? t.math : x === 'english' ? t.english : x === 'both' ? t.both : '');
  useEffect(() => { if (cid) { teacherApi.klass(cid).then(setD); teacherApi.insights(undefined, cid).then(setIns); } }, [cid]);
  const names = (s: string) => s.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  const repeated = ins?.detail?.find((s) => s.classLabel === 'repeated');
  const today = new Date().toISOString().slice(0, 10);

  const submit = async () => {
    setErr('');
    if (adding === 'class' && !form.name.trim()) return setErr(t.required([t.newClassName.replace(/\s*\(.*\)$/, '')]));
    if (adding === 'pupils' && !names(form.names).length) return setErr(t.required([t.addPupilsPh]));
    try {
      if (adding === 'class') { const k = await teacherApi.addClass(form.name, names(form.names), form.subject); await load(); setCid(k.id); setSubj('all'); }
      if (adding === 'pupils' && d) { await teacherApi.addPupils(d.id, names(form.names)); setD(await teacherApi.klass(d.id)); load(); }
    } catch (e) { return setErr((e as Error).message); }
    setAdding(null); setForm({ name: '', names: '', subject: 'math' });
  };

  return (
    <main className="page stack" style={{ gap: 18 }}>
      <div className="row"><div className="grow"><h1>{t.clTitle}</h1><p className="muted" style={{ margin: '6px 0 0' }}>{t.clSub(classes.length)}</p></div>
        <button className="btn" onClick={() => setAdding('class')}>{t.addClass}</button></div>
      {classes.length > 0 && (
        <div className="filters">
          <div className="lang subj" role="group" aria-label={t.subject}>
            {(['all', 'math', 'english'] as const).map((x) => <button key={x} className={subj === x ? 'on' : ''} aria-pressed={subj === x} onClick={() => { setSubj(x); const first = classes.find((k) => x === 'all' || !k.subject || k.subject === x || k.subject === 'both'); if (first) setCid(first.id); }}>{x === 'all' ? t.allSubjects : t[x]}</button>)}
          </div>
          <div className="pills">{visible.map((k) => <button key={k.id} className={`pill ${cid === k.id ? 'on' : ''}`} onClick={() => setCid(k.id)}>{t.cls} {k.name}{k.subject && <span className="pill-sub"> · {subjName(k.subject)}</span>}</button>)}</div>
        </div>
      )}
      {adding === 'class' && <GuideHint step="class" />}
      {adding && (
        <div className="card stack">
          {adding === 'class' && (
            <div className="row" style={{ gap: 16, alignItems: 'flex-end' }}>
              <label className="field grow"><span>{t.newClassName} <span className="req" aria-hidden="true">*</span></span><input autoFocus required placeholder="2A" maxLength={12} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="field grow">{t.classSubject}
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value as 'math' | 'english' | 'both' })}>
                  <option value="math">{t.math}</option><option value="english">{t.english}</option><option value="both">{t.both}</option>
                </select></label>
            </div>
          )}
          <label className="field">{adding === 'class' ? t.newClassNames : t.addPupilsPh}<textarea rows={5} value={form.names} onChange={(e) => setForm({ ...form, names: e.target.value })} /></label>
          <ErrorNote text={err} />
          <div className="row"><button className={`btn primary${adding === 'class' ? pulse('class') : ''}`} onClick={submit}>{t.save}</button>{classes.length > 0 && <button className="btn" onClick={() => setAdding(null)}>{t.cancel}</button>}</div>
        </div>
      )}
      {loaded && classes.length === 0 && !adding && (
        <div className="card empty"><h3>{t.noClasses}</h3><p className="muted">{t.noClassesSub}</p><button className="btn primary" onClick={() => setAdding('class')}>{t.firstClass}</button></div>
      )}
      {d && (
        <>
          {edit ? (
            <form className="card row" style={{ gap: 12, alignItems: 'flex-end' }} onSubmit={async (e) => { e.preventDefault(); await teacherApi.updateClass(d.id, edit); setEdit(null); await load(); setD(await teacherApi.klass(d.id)); }}>
              <label className="field grow">{t.newClassName}<input autoFocus maxLength={12} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
              <label className="field grow">{t.classSubject}<select value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value as 'math' | 'english' | 'both' })}><option value="math">{t.math}</option><option value="english">{t.english}</option><option value="both">{t.both}</option></select></label>
              <button className="btn primary">{t.save}</button><button type="button" className="btn" onClick={() => setEdit(null)}>{t.cancel}</button>
            </form>
          ) : (
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn sm" onClick={() => setEdit({ name: d.name, subject: (d.subject as 'math' | 'english' | 'both') || 'both' })}>{t.editClass}</button>
              <button className="btn sm danger" onClick={async () => { if (!confirm(t.delClassConfirm(d.name))) return; await teacherApi.deleteClass(d.id); setD(null); setCid(''); const cs = await teacherApi.classes(); setClasses(cs); setCid(cs[0]?.id || ''); }}>{t.deleteClass}</button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
            <div className="card"><div className="muted small">{t.kSize}</div><div className="display" style={{ fontSize: 30 }}>{d.pupils.length}</div></div>
            <div className="card"><div className="muted small">{t.kJoined}</div><div className="display" style={{ fontSize: 30, color: 'var(--green-ink)' }}>{d.pupils.filter((p) => p.joinedAt).length}<span className="muted" style={{ fontSize: 18 }}> / {d.pupils.length}</span></div></div>
            <div className="card"><div className="muted small">{t.kOpen}</div><div className="display" style={{ fontSize: 30, color: 'var(--blue)' }}>{d.assignments.filter((a) => !a.dueAt || a.dueAt >= today).length}</div></div>
            <div className="card" style={{ background: repeated ? 'var(--cream)' : undefined, borderColor: repeated ? 'var(--amber-line)' : undefined }}>
              <div className="small" style={{ color: 'var(--amber)' }}>{t.kRepeat}</div>
              <strong>{repeated?.errors[0]?.errorType || repeated?.skillName || t.noRepeat}</strong>
              {repeated && <div><Link to="/insights">{t.seeSummary}</Link></div>}
            </div>
          </div>
          <div className="card stack">
            <div className="row"><h3 className="grow">{t.assignedH(d.name)}</h3><button className="btn primary sm" onClick={() => go('/')}>{t.assignMore}</button></div>
            <table className="t">
              <thead><tr><th>{t.colLesson}</th><th>{t.colDue}</th><th>{t.colDone}</th><th>{t.colState}</th><th /></tr></thead>
              <tbody>{d.assignments.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td><td>{a.dueAt?.split('-').reverse().slice(0, 2).join('/')}</td>
                  <td><div className="row" style={{ flexWrap: 'nowrap' }}><div className="bar" style={{ width: 120 }}><span style={{ width: `${(100 * a.done) / Math.max(1, a.total)}%` }} /></div><span className="small">{a.done}/{a.total}</span></div></td>
                  <td><span className={`chip ${!a.dueAt || a.dueAt >= today ? 'blue' : ''}`}>{!a.dueAt || a.dueAt >= today ? t.sOpen : t.sDone}</span></td>
                  <td><Link to={`/insights?lessonId=${a.lessonId}&classId=${d.id}`}>{t.seeSummary}</Link></td>
                </tr>))}</tbody>
            </table>
          </div>
          <GuideHint step="share" />
          <div className="card stack">
            <div className="row"><h3 className="grow">{t.pupilsH(d.name)}</h3><button className="btn sm" onClick={() => setAdding('pupils')}>{t.addPupil}</button><button className="btn sm" onClick={() => print()}>{t.printCodes}</button></div>
            <div className="row invite">
              <span className="chip blue" style={{ fontSize: 18, fontWeight: 700, padding: '6px 14px' }}>{t.joinCode}: {d.joinCode}</span>
              <code className="small muted">{`${location.origin}/learn?code=${d.joinCode}`}</code>
              <button className={`btn primary sm${pulse('share')}`} onClick={() => { navigator.clipboard?.writeText(`${location.origin}/learn?code=${d.joinCode}`); setCopied(d.id); }}>{copied === d.id ? t.copied : t.copy}</button>
              <button className="btn sm" onClick={async () => { const url = `${location.origin}/learn?code=${d.joinCode}`; if ((await shareMessage(t.shareClassMsg(d.name, d.joinCode, url), url)) === 'copied') setShared(d.id); }}>{t.share}</button>
            </div>
            {shared === d.id && <p className="ok-note" style={{ margin: 0 }}>{t.msgCopied}</p>}
            <p className="muted small" style={{ margin: 0 }}>{t.privacy(d.joinCode)}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {d.pupils.map((p) => <Link key={p.id} to={`/classes/${d.id}/pupil/${p.id}`} className="card pupil-card" aria-label={`${p.displayName}: ${t.viewPupil}`}><strong>{p.displayName}</strong><div className="small" style={{ color: p.joinedAt ? 'var(--green-ink)' : 'var(--muted)' }}>{p.joinedAt ? t.joined : t.notYet}</div></Link>)}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
