// Steps 3-6 of the create flow (slides, video, exercises, assign) plus the live "AI is
// preparing your lesson" view while the agent works. The step bar stays on top of every screen.
import { useEffect, useState } from 'react';
import { go, teacherApi, type Lesson } from '../api.ts';
import { pick, useLang, useT } from '../i18n.ts';
import { Assign } from './Assign.tsx';
import { T } from './dict.ts';
import { Exercises } from './Exercises.tsx';
import { Slides } from './Slides.tsx';
import { Link } from './TeacherRoutes.tsx';
import { Video } from './Video.tsx';
import './teacher.css';

const STEP_KEYS = ['doc', 'questions', 'slides', 'video', 'exercises', 'assign'];

export function Stepper({ current, lessonId }: { current: number; lessonId?: string }) {
  const t = useT(T);
  return (
    <nav className="stepper" aria-label="steps">
      {t.steps.map((s, i) => {
        const cls = i < current ? 'done' : i === current ? 'cur' : '';
        const inner = <><span className="n">{i < current ? '✓' : i + 1}</span>{s}</>;
        return lessonId && i >= 2 && i !== current
          ? <Link key={s} to={`/lesson/${lessonId}/${STEP_KEYS[i]}`} className={cls}>{inner}</Link>
          : <span key={s} className={cls} aria-current={i === current ? 'step' : undefined}>{inner}</span>;
      })}
    </nav>
  );
}

// title (rename), duplicate, print, delete: on every step of a ready lesson
function LessonBar({ l, onChange }: { l: Lesson; onChange: (x: Lesson) => void }) {
  const t = useT(T);
  const [edit, setEdit] = useState<string | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(() => { try { const v = sessionStorage.getItem('lb-copied') === l.id; sessionStorage.removeItem('lb-copied'); return v; } catch { return false; } });
  const act = async (fn: () => Promise<void>) => { setErr(''); setBusy(true); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const copy = () => act(async () => { const { id: nid } = await teacherApi.copyLesson(l.id); try { sessionStorage.setItem('lb-copied', nid); } catch { /* ok */ } go(`/lesson/${nid}/slides`); });
  const del = () => { if (confirm(t.delLessonConfirm)) act(async () => { await teacherApi.deleteLesson(l.id); go('/'); }); };
  const save = () => act(async () => { if (!edit?.trim()) throw new Error(t.required([t.q0])); onChange(await teacherApi.renameLesson(l.id, edit)); setEdit(null); });
  return (
    <div className="lesson-bar no-print">
      {edit !== null
        ? <form className="row grow" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); save(); }}><input autoFocus maxLength={120} value={edit} onChange={(e) => setEdit(e.target.value)} /><button className="btn primary sm" disabled={busy}>{t.save}</button><button type="button" className="btn sm" onClick={() => setEdit(null)}>{t.cancel}</button></form>
        : <><strong className="grow lesson-title">{l.intake.title}</strong><button className="btn ghost sm" onClick={() => setEdit(l.intake.title)}>{t.rename}</button></>}
      <button className="btn sm" disabled={busy} onClick={copy}>{t.copyLesson}</button>
      <button className="btn sm danger" disabled={busy} onClick={del}>{t.deleteLesson}</button>
      {copied && <p className="ok-note" role="status" style={{ width: '100%', margin: 0 }}>✓ {t.copiedLesson} {t.copiedHint}</p>}
      {err && <p className="error-note" role="alert" style={{ width: '100%' }}>{err}</p>}
    </div>
  );
}

export function LessonFlow({ id, step }: { id: string; step: string }) {
  const t = useT(T), lang = useLang();
  const [l, setL] = useState<Lesson | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stop = false, timer = 0;
    const poll = async () => {
      try {
        const x = await teacherApi.lesson(id);
        if (stop) return;
        setL(x);
        if (x.status === 'working' || x.video?.status === 'working' || x.picturesPending) timer = window.setTimeout(poll, x.picturesPending ? 4000 : 1500);
      } catch (e) {
        const st = (e as { status?: number }).status ?? 0;
        if (!stop && (st === 0 || st >= 500)) timer = window.setTimeout(poll, 4000);   // network or server hiccup: keep trying
        else setErr((e as Error).message);
      }
    };
    poll();
    return () => { stop = true; clearTimeout(timer); };
  }, [id, step]);

  if (err) return <p className="page error">{err}</p>;
  if (!l) return <p className="page muted" role="status">{t.loading}</p>;
  if (l.status !== 'ready') {
    return (
      <>
        <Stepper current={2} />
        <main className="page narrow stack">
          <h1>{l.intake.title}</h1>
          <div className="card stack">
            <h2>{l.status === 'error' ? t.failed : t.buildTitle}</h2>
            <p className="muted" style={{ margin: 0 }}>{t.buildSub}</p>
            <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
              {l.progress.map((m, i) => <li key={i} style={{ color: i === l.progress.length - 1 && l.status === 'working' ? 'var(--blue)' : undefined }}>{pick(m, lang)}{i === l.progress.length - 1 && l.status === 'working' ? ' ⏳' : ''}</li>)}
            </ol>
            {l.error && <p className="error">{l.error}</p>}
          </div>
        </main>
      </>
    );
  }
  const idx = Math.max(2, STEP_KEYS.indexOf(step));
  const onChange = (x: Lesson) => setL(x);
  const restartPoll = () => teacherApi.lesson(id).then(setL);
  return (
    <>
      <Stepper current={idx} lessonId={l.id} />
      <LessonBar l={l} onChange={onChange} />
      {idx === 2 && <Slides l={l} onChange={onChange} />}
      {idx === 3 && <Video l={l} onChange={onChange} onStarted={() => setTimeout(restartPoll, 300)} />}
      {idx === 4 && <Exercises l={l} onChange={onChange} />}
      {idx === 5 && <Assign l={l} />}
    </>
  );
}
