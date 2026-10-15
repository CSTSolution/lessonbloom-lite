// Screen 10 · step 6: pick a class, due date and options, assign; show the pupil link, a QR
// code and the class code, and the roster with who has joined.
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { go, teacherApi, type ClassCard, type ClassDetail, type Lesson } from '../api.ts';
import { useT } from '../i18n.ts';
import { T } from './dict.ts';
import { GuideHint, pulse } from './Guide.tsx';
import { shareMessage } from './share.ts';
import { Link } from './TeacherRoutes.tsx';
import { ErrorNote } from './ErrorNote.tsx';

export function Assign({ l, presetClass }: { l: Lesson; presetClass?: string }) {
  const t = useT(T);
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [cid, setCid] = useState(presetClass || '');
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [due, setDue] = useState(new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10));
  const [retry, setRetry] = useState(true), [suggest, setSuggest] = useState(true);
  const [also, setAlso] = useState<string[]>([]), [doneNames, setDoneNames] = useState(''), [shared, setShared] = useState(false);
  const [loaded, setLoaded] = useState(false), [done, setDone] = useState(false), [qr, setQr] = useState(''), [copied, setCopied] = useState(false), [err, setErr] = useState('');

  // classes of this lesson's subject first (and picked by default)
  useEffect(() => {
    teacherApi.classes().then((all) => {
      const fits = (k: ClassCard) => !k.subject || k.subject === 'both' || k.subject === l.intake.subject;
      const cs = [...all.filter(fits), ...all.filter((k) => !fits(k))];
      setClasses(cs); setLoaded(true); setCid((c) => c || cs[0]?.id || '');
    });
  }, [l.intake.subject]);
  useEffect(() => { if (cid) { setDone(false); setShared(false); setDoneNames(''); teacherApi.klass(cid).then(setDetail); } }, [cid]);
  const url = detail ? `${location.origin}/learn?code=${detail.joinCode}` : '';
  useEffect(() => { if (url) QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#17202E' } }).then(setQr); }, [url]);
  const already = detail?.assignments.some((a) => a.lessonId === l.id);

  const assign = async () => {
    setErr('');
    try {
      const ids = [cid, ...also.filter((x) => x !== cid)];
      for (const classId of ids) await teacherApi.assign({ lessonId: l.id, classId, dueAt: due, allowRetry: retry, autoSuggest: suggest });
      setDoneNames(ids.map((x) => `${t.cls} ${classes.find((k) => k.id === x)?.name}`).join(', ')); setAlso([]);
      setDone(true); teacherApi.klass(cid).then(setDetail);
    }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <main className="page stack" style={{ gap: 20 }}>
      <GuideHint step="assign" />
      {loaded && classes.length === 0 && <div className="card empty"><p style={{ margin: 0 }}>{t.needClass}</p><Link to="/classes?add=1" className="btn primary">{t.goClasses}</Link></div>}
      <div className="row">
        <span className="muted">{t.pickClassAssign}</span>
        <div className="pills">{classes.map((k) => <button key={k.id} className={`pill ${cid === k.id ? 'on' : ''}`} onClick={() => setCid(k.id)}>{t.cls} {k.name}</button>)}</div>
        {detail && <span className="muted small">{detail.pupils.filter((p) => p.joinedAt).length}/{detail.pupils.length} {t.joinedSuffix}</span>}
      </div>
      {detail && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }} className="assign-grid">
          <section className="stack">
            <h1 style={{ fontSize: 24 }}>{t.assignTitle(detail.name)}</h1>
            <div className="card stack">
              <h3>{t.linkTitle}</h3>
              <div className="row" style={{ flexWrap: 'nowrap' }}><input readOnly value={url} onFocus={(e) => e.target.select()} /><button className="btn primary" style={{ whiteSpace: 'nowrap' }} onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); }}>{copied ? t.copied : t.copy}</button></div>
              <div className="row qr-row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                {qr && <img src={qr} alt="QR" width={120} height={120} style={{ borderRadius: 8, border: '1px solid var(--line)' }} />}
                <div className="stack" style={{ gap: 6 }}><span className="chip blue" style={{ alignSelf: 'flex-start', fontSize: 18, fontWeight: 700 }}>{t.joinCode}: {detail.joinCode}</span><p className="muted small" style={{ margin: 0 }}>{t.qrHelp}</p></div>
              </div>
            </div>
            <div className="card stack">
              <label className="field">{t.due}<input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
              <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={retry} onChange={(e) => setRetry(e.target.checked)} />{t.retry}</label>
              <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={suggest} onChange={(e) => setSuggest(e.target.checked)} />{t.suggest}</label>
              {classes.length > 1 && !done && (
                <div className="stack" style={{ gap: 6 }}>
                  <span className="small" style={{ fontWeight: 600 }}>{t.alsoAssign}</span>
                  <div className="pills">{classes.filter((k) => k.id !== cid).map((k) => (
                    <label key={k.id} className={`pill ${also.includes(k.id) ? 'on' : ''}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" className="sr" checked={also.includes(k.id)} onChange={(e) => setAlso(e.target.checked ? [...also, k.id] : also.filter((x) => x !== k.id))} />{also.includes(k.id) ? '✓ ' : ''}{t.cls} {k.name}
                    </label>))}</div>
                </div>
              )}
            </div>
            {done ? (
              <div className="stack" style={{ gap: 8 }}>
                <div className="ok-note">✓ {doneNames ? t.assignedMany(doneNames) : `${t.assigned} ${t.cls} ${detail.name}`} · {t.joinCode}: <strong>{detail.joinCode}</strong></div>
                <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={async () => { if ((await shareMessage(t.shareMsg(l.intake.title, detail.name, detail.joinCode, url), url)) === 'copied') setShared(true); }}>{t.share}</button>
                {shared && <p className="ok-note" style={{ margin: 0 }}>{t.msgCopied}</p>}
                <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { try { sessionStorage.setItem('lb-guide', 'share'); } catch { /* ok */ } go('/classes'); }}>{t.nextInvite}</button>
              </div>
            ) : <button className={`btn primary lg${pulse('assign')}`} onClick={assign}>{already ? `${t.assign} ✓` : t.assign}</button>}
            <ErrorNote text={err} />
          </section>
          <section className="card stack">
            <h3>{t.pupilsH(detail.name)}</h3>
            <table className="t"><thead><tr><th>{t.colName}</th><th>{t.colStatus}</th></tr></thead>
              <tbody>{detail.pupils.map((p) => <tr key={p.id}><td>{p.displayName}</td><td style={{ color: p.joinedAt ? 'var(--green-ink)' : 'var(--muted)' }}>{p.joinedAt ? t.joined : t.notYet}</td></tr>)}</tbody></table>
          </section>
        </div>
      )}
    </main>
  );
}
