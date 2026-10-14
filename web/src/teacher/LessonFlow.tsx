// Steps 3-6 of the create flow (slides, video, exercises, assign) plus the live "AI is
// preparing your lesson" view while the agent works. The step bar stays on top of every screen.
import { useEffect, useState } from 'react';
import { teacherApi, type Lesson } from '../api.ts';
import { useT } from '../i18n.ts';
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

export function LessonFlow({ id, step }: { id: string; step: string }) {
  const t = useT(T);
  const [l, setL] = useState<Lesson | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stop = false, timer = 0;
    const poll = async () => {
      try {
        const x = await teacherApi.lesson(id);
        if (stop) return;
        setL(x);
        if (x.status === 'working' || x.video?.status === 'working') timer = window.setTimeout(poll, 1500);
      } catch (e) { setErr((e as Error).message); }
    };
    poll();
    return () => { stop = true; clearTimeout(timer); };
  }, [id, step]);

  if (err) return <p className="page error">{err}</p>;
  if (!l) return <p className="page muted">…</p>;
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
              {l.progress.map((m, i) => <li key={i} style={{ color: i === l.progress.length - 1 && l.status === 'working' ? 'var(--blue)' : undefined }}>{m}{i === l.progress.length - 1 && l.status === 'working' ? ' ⏳' : ''}</li>)}
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
      {idx === 2 && <Slides l={l} onChange={onChange} />}
      {idx === 3 && <Video l={l} onChange={onChange} onStarted={() => setTimeout(restartPoll, 300)} />}
      {idx === 4 && <Exercises l={l} onChange={onChange} />}
      {idx === 5 && <Assign l={l} />}
    </>
  );
}
