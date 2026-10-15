// Screen 08 · step 4: the video made from the slides + Text-to-Speech, with voice, speed and
// subtitle options, chapters, and MP4 download.
import { useRef, useState } from 'react';
import { go, teacherApi, type Lesson } from '../api.ts';
import { useT } from '../i18n.ts';
import { fmtTime, T } from './dict.ts';
import { ErrorNote } from './ErrorNote.tsx';

export function Video({ l, onChange, onStarted }: { l: Lesson; onChange: (l: Lesson) => void; onStarted: () => void }) {
  const t = useT(T);
  const v = l.video;
  const [voice, setVoice] = useState(0), [speed, setSpeed] = useState(v?.speed ?? 0.9), [subs, setSubs] = useState(v?.subtitles ?? true);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLVideoElement>(null);
  const working = v?.status === 'working';

  const make = async () => {
    setErr('');
    try { const nv = await teacherApi.makeVideo(l.id, { speed, subtitles: subs, voice: String(voice) }); onChange({ ...l, video: nv }); onStarted(); }
    catch (e) { setErr((e as Error).message); }
  };
  const title = (sid: string) => l.slides.find((s) => s.id === sid)?.heading || sid;

  return (
    <main className="page" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 300px)', gap: 20, alignItems: 'start' }}>
      <section className="stack">
        <div><h1>{t.vTitle}</h1>{v?.status === 'ready' && <p className="muted" style={{ margin: '6px 0 0' }}>{t.vSub(fmtTime(v.seconds))}</p>}</div>
        {v?.status === 'ready' && v.url ? (
          <video ref={ref} src={v.url} controls playsInline style={{ width: '100%', borderRadius: 14, background: '#17202E', aspectRatio: '16/9' }} />
        ) : (
          <div className="card center" style={{ aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <p className="muted">{working ? `${t.vWorking} ⏳` : v?.status === 'error' ? `${t.failed}: ${v.error}` : t.vNone}</p>
          </div>
        )}
        <ErrorNote text={err} />
      </section>
      <aside className="stack">
        <div className="card stack">
          <h3>{t.voiceTitle}</h3>
          <label className="field">{t.voice}<select value={voice} onChange={(e) => setVoice(Number(e.target.value))}>{t.voices.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></label>
          <label className="field">{t.speed}<select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={0.85}>{t.slow}</option><option value={1}>{t.normal}</option></select></label>
          <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={subs} onChange={(e) => setSubs(e.target.checked)} />{t.showSubs}</label>
          <button className="btn" style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }} disabled={working} onClick={make}>{working ? t.busy : v?.status === 'ready' ? t.regen : t.makeVideo}</button>
          {v?.status === 'ready' && v.url && <a className="btn sm" href={v.url} download={`${l.intake.title}.mp4`}>{t.download}</a>}
        </div>
        {v?.chapters?.length ? (
          <div className="card stack" style={{ gap: 4 }}>
            <h3>{t.chapters}</h3>
            {v.chapters.map((c) => (
              <button key={c.slide} className="row btn ghost sm" style={{ justifyContent: 'space-between', color: 'var(--ink)' }} onClick={() => { if (ref.current) { ref.current.currentTime = c.at; ref.current.play(); } }}>
                <span style={{ textAlign: 'left' }}>{title(c.slide)}</span><span className="muted">{fmtTime(c.at)}</span>
              </button>
            ))}
          </div>
        ) : null}
        <button className="btn primary lg" onClick={() => go(`/lesson/${l.id}/exercises`)}>{v?.status === 'ready' ? t.nextEx : t.skipVideo}</button>
      </aside>
    </main>
  );
}
