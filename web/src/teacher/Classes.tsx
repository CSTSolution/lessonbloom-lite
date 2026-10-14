// Screen 02 · "Lớp học của cô": class tabs, key numbers, assigned lessons with progress, the
// roster (names only) and the class code; add a class or pupils.
import { useEffect, useState } from 'react';
import { go, teacherApi, type ClassCard, type ClassDetail, type Insights } from '../api.ts';
import { useT } from '../i18n.ts';
import { T } from './dict.ts';
import { Link } from './TeacherRoutes.tsx';

export function Classes() {
  const t = useT(T);
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [cid, setCid] = useState('');
  const [d, setD] = useState<ClassDetail | null>(null);
  const [ins, setIns] = useState<Insights | null>(null);
  const [adding, setAdding] = useState<'class' | 'pupils' | null>(null);
  const [form, setForm] = useState({ name: '', names: '' });
  const load = () => teacherApi.classes().then((cs) => { setClasses(cs); setCid((c) => c || cs[0]?.id || ''); });
  useEffect(() => { load(); }, []);
  useEffect(() => { if (cid) { teacherApi.klass(cid).then(setD); teacherApi.insights(undefined, cid).then(setIns); } }, [cid]);
  const names = (s: string) => s.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  const repeated = ins?.detail?.find((s) => s.classLabel === 'repeated');
  const today = new Date().toISOString().slice(0, 10);

  const submit = async () => {
    if (adding === 'class' && form.name.trim()) { const k = await teacherApi.addClass(form.name, names(form.names)); await load(); setCid(k.id); }
    if (adding === 'pupils' && d) { await teacherApi.addPupils(d.id, names(form.names)); setD(await teacherApi.klass(d.id)); load(); }
    setAdding(null); setForm({ name: '', names: '' });
  };

  return (
    <main className="page stack" style={{ gap: 18 }}>
      <div className="row"><div className="grow"><h1>{t.clTitle}</h1><p className="muted" style={{ margin: '6px 0 0' }}>{t.clSub(classes.length)}</p></div>
        <button className="btn" onClick={() => setAdding('class')}>{t.addClass}</button></div>
      <div className="pills">{classes.map((k) => <button key={k.id} className={`pill ${cid === k.id ? 'on' : ''}`} onClick={() => setCid(k.id)}>{t.cls} {k.name}</button>)}</div>
      {adding && (
        <div className="card stack">
          {adding === 'class' && <label className="field">{t.newClassName}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>}
          <label className="field">{adding === 'class' ? t.newClassNames : t.addPupilsPh}<textarea rows={4} value={form.names} onChange={(e) => setForm({ ...form, names: e.target.value })} /></label>
          <div className="row"><button className="btn primary" onClick={submit}>{t.save}</button><button className="btn" onClick={() => setAdding(null)}>{t.cancel}</button></div>
        </div>
      )}
      {d && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
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
          <div className="card stack">
            <div className="row"><h3 className="grow">{t.pupilsH(d.name)}</h3><button className="btn sm" onClick={() => setAdding('pupils')}>{t.addPupil}</button><button className="btn sm" onClick={() => print()}>{t.printCodes}</button></div>
            <p className="muted small" style={{ margin: 0 }}>{t.privacy(d.joinCode)}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {d.pupils.map((p) => <div key={p.id} className="card" style={{ padding: 12 }}><strong>{p.displayName}</strong><div className="small" style={{ color: p.joinedAt ? 'var(--green-ink)' : 'var(--muted)' }}>{p.joinedAt ? t.joined : t.notYet}</div></div>)}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
