// Teacher step 3-4: watch the agent work, review and edit slides and exercises, share one
// link, then see which questions pupils got wrong.
import { useEffect, useState } from 'react';
import { api, type Exercise, type Lesson, type Level, type Report } from '../api.ts';
import { useT } from '../i18n.ts';
import { SlideCard } from '../parts/SlideCard.tsx';

type Tab = 'slides' | 'exercises' | 'share' | 'report';

export function LessonPage({ id }: { id: string }) {
  const [t] = useT();
  const [l, setL] = useState<Lesson | null>(null);
  const [tab, setTab] = useState<Tab>('slides');
  const [err, setErr] = useState('');

  useEffect(() => {
    let stop = false, timer = 0;
    const poll = async () => {
      try { const x = await api.lesson(id); if (stop) return; setL(x); if (x.status === 'working') timer = window.setTimeout(poll, 1200); }
      catch (e) { setErr((e as Error).message); }
    };
    poll();
    return () => { stop = true; clearTimeout(timer); };
  }, [id]);

  if (err) return <p className="error page">{t.error}: {err}</p>;
  if (!l) return <p className="page muted">…</p>;
  const save = async (patch: Partial<Pick<Lesson, 'slides' | 'exercises'>>) => setL(await api.save(id, patch));

  return (
    <div className="page">
      <div className="lesson-head">
        <div>
          <h1>{l.intake.title}</h1>
          <p className="muted">{l.intake.subject === 'math' ? t.math : t.english} · {t.grade} {l.intake.grade} · {l.intake.minutes}′</p>
        </div>
        <span className={`status ${l.status}`}>{l.status === 'working' ? t.working : l.status === 'ready' ? `✓ ${t.ready}` : t.error}</span>
      </div>

      {l.status !== 'ready' && (
        <section className="card progress">
          {l.progress.map((m, i) => <div key={i} className={i === l.progress.length - 1 && l.status === 'working' ? 'now' : ''}>{m}</div>)}
          {l.error && <div className="error">{l.error}</div>}
        </section>
      )}

      {l.status === 'ready' && (
        <>
          <nav className="tabs">
            {(['slides', 'exercises', 'share', 'report'] as Tab[]).map((k) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t[k]}{k === 'exercises' ? ` (${l.exercises.length})` : k === 'slides' ? ` (${l.slides.length})` : ''}</button>
            ))}
          </nav>
          {tab === 'slides' && <Slides l={l} save={save} />}
          {tab === 'exercises' && <Exercises l={l} save={save} />}
          {tab === 'share' && <Share l={l} onShared={(shareId) => setL({ ...l, shareId })} />}
          {tab === 'report' && <ReportView id={l.id} />}
        </>
      )}
    </div>
  );
}

function Slides({ l, save }: { l: Lesson; save: (p: Partial<Lesson>) => Promise<void> }) {
  const [t] = useT();
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState({ heading: '', bullets: '', notes: '' });
  return (
    <div className="slides-grid">
      {l.slides.map((s, i) => (
        <div key={s.id} className="slide-wrap">
          <SlideCard s={s} n={i} total={l.slides.length} />
          {edit === s.id ? (
            <div className="slide-edit">
              <input value={draft.heading} onChange={(e) => setDraft({ ...draft, heading: e.target.value })} />
              <textarea rows={3} value={draft.bullets} onChange={(e) => setDraft({ ...draft, bullets: e.target.value })} />
              <label className="muted">{t.notes}<textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
              <button className="primary" onClick={async () => {
                await save({ slides: l.slides.map((x) => x.id === s.id ? { ...x, heading: draft.heading, bullets: draft.bullets.split('\n').filter(Boolean), notes: draft.notes } : x) });
                setEdit(null);
              }}>{t.save}</button>
            </div>
          ) : (
            <div className="slide-meta">
              <p><b>{t.notes}:</b> {s.notes}</p>
              <p className="muted"><b>🔊</b> {s.narration}</p>
              <button className="link" onClick={() => { setEdit(s.id); setDraft({ heading: s.heading, bullets: s.bullets.join('\n'), notes: s.notes }); }}>✏️ {t.edit}</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function describe(e: Exercise): string {
  switch (e.type) {
    case 'math_mcq': return `${e.prompt}  [${e.options.join(' · ')}]`;
    case 'math_fill': return `${e.prompt}: ${e.equation.replace('?', '…')}`;
    case 'math_truefalse': return `${e.prompt}: ${e.statement}`;
    case 'eng_fill': return `${e.prompt}: ${e.sentence}  [${e.options.join(' · ')}]`;
    case 'eng_listen': return `${e.prompt}: 🔊 "${e.say}"  [${e.options.join(' · ')}]`;
    case 'eng_order': return `${e.prompt}: ${e.words.join(' / ')}`;
    case 'eng_match': return `${e.prompt}: ${e.pairs.map((p) => `${p.word} ${p.emoji}`).join(', ')}`;
    default: return e.prompt;
  }
}

function Exercises({ l, save }: { l: Lesson; save: (p: Partial<Lesson>) => Promise<void> }) {
  const [t] = useT();
  const levels: Level[] = ['basic', 'good', 'advanced'];
  const checked = new Map(l.checks.map((c) => [c.exercise, c]));
  return (
    <div>
      {l.checks.length > 0 && <p className="checknote">🛡️ {t.checked}: {l.checks.length} · {l.checks.map((c) => c.issues[0]).slice(0, 3).join(' · ')}</p>}
      {levels.map((lv) => (
        <section key={lv} className="card">
          <h2>{t[lv]}</h2>
          {l.exercises.filter((e) => e.level === lv).map((e) => (
            <div key={e.id} className="ex-row">
              <div className="ex-q">{describe(e)}</div>
              <div className="ex-a">
                {e.type !== 'eng_match' && (
                  <label>{t.answer}: <input defaultValue={(e as { answer: string }).answer}
                    onBlur={(ev) => ev.target.value !== (e as { answer: string }).answer && save({ exercises: l.exercises.map((x) => x.id === e.id ? { ...x, answer: ev.target.value } as Exercise : x) })} /></label>
                )}
                <span className="muted">{e.explain}</span>
                {checked.has(e.id) && <span className="badge" title={checked.get(e.id)!.issues.join('\n')}>🛡️ {t.fixedBy}</span>}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function Share({ l, onShared }: { l: Lesson; onShared: (s: string) => void }) {
  const [t] = useT();
  const [copied, setCopied] = useState(false);
  const url = l.shareId ? `${location.origin}/s/${l.shareId}` : '';
  return (
    <section className="card share">
      {!l.shareId ? (
        <button className="primary big" onClick={async () => onShared((await api.share(l.id)).shareId)}>{t.shareBtn}</button>
      ) : (
        <>
          <a className="share-url" href={url} target="_blank" rel="noreferrer">{url}</a>
          <div className="row">
            <button className="primary" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); }}>{copied ? t.copied : t.copy}</button>
            <span className="muted">{t.shareHint}</span>
          </div>
        </>
      )}
    </section>
  );
}

function ReportView({ id }: { id: string }) {
  const [t] = useT();
  const [r, setR] = useState<Report | null>(null);
  useEffect(() => { api.report(id).then(setR); const i = setInterval(() => api.report(id).then(setR), 5000); return () => clearInterval(i); }, [id]);
  if (!r) return null;
  if (!r.pupils) return <p className="card muted">{t.noSubs}</p>;
  return (
    <section className="card">
      <h2>{r.pupils} {t.pupils}</h2>
      <h3>{t.wrongMost}</h3>
      {r.items.filter((x) => x.tried).map((x) => (
        <div key={x.id} className="bar-row">
          <span className="bar-label">{x.prompt}</span>
          <span className="bar"><span style={{ width: `${Math.round(x.wrongRate * 100)}%` }} /></span>
          <span className="bar-n">{Math.round(x.wrongRate * 100)}%</span>
        </div>
      ))}
    </section>
  );
}
