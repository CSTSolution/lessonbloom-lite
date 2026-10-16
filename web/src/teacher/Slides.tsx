// Screen 07 · step 3: slide list, the big slide, teacher notes and the source quote; per-slide
// AI actions (rewrite, simpler, new picture); export PDF via the browser's print.
import { useState } from 'react';
import { go, teacherApi, type Lesson, type Slide } from '../api.ts';
import { useT } from '../i18n.ts';
import { T } from './dict.ts';
import { ErrorNote } from './ErrorNote.tsx';

export function SlideView({ s, n, total, pending }: { s: Pick<Slide, 'kind' | 'heading' | 'bullets' | 'example' | 'image'>; n?: number; total?: number; pending?: boolean }) {
  return (
    <div className={`slide16 k-${s.kind}`}>
      <div className="s-text">
        <h2 className="display">{s.heading}</h2>
        {s.bullets.length > 0 && <ul>{s.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
        {s.example && <div className="s-ex display">{s.example}</div>}
      </div>
      {s.image ? <img src={s.image} alt="" /> : pending && <div className="s-pending">🎨…</div>}
      {n !== undefined && total && <span className="s-n">Slide {n + 1} / {total}</span>}
    </div>
  );
}

export function Slides({ l, onChange, onPrint }: { l: Lesson; onChange: (l: Lesson) => void; onPrint: () => void }) {
  const t = useT(T);
  const [cur, setCur] = useState(0);
  const [busy, setBusy] = useState(''), [err, setErr] = useState('');
  const [edit, setEdit] = useState<{ heading: string; bullets: string; notes: string } | null>(null);
  const s = l.slides[cur];

  const act = async (action: 'rewrite' | 'simpler' | 'image') => {
    setBusy(action); setErr('');
    try { const ns = await teacherApi.slideAction(l.id, s.id, action); onChange({ ...l, slides: l.slides.map((x) => (x.id === ns.id ? ns : x)) }); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(''); }
  };
  const saveEdit = async () => {
    if (!edit) return;
    const slides = l.slides.map((x) => (x.id === s.id ? { ...x, heading: edit.heading, bullets: edit.bullets.split('\n').map((b) => b.trim()).filter(Boolean).slice(0, 4), notes: edit.notes } : x));
    onChange(await teacherApi.save(l.id, { slides }));
    setEdit(null);
  };

  return (
    <main className="page" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 160px) minmax(0, 1fr) minmax(0, 300px)', gap: 20, alignItems: 'start' }}>
      <ol className="thumbs no-print" aria-label="slides">
        {l.slides.map((x, i) => (
          <li key={x.id}><button className={i === cur ? 'on' : ''} onClick={() => { setCur(i); setEdit(null); }}><span>{i + 1}</span>{x.heading}</button></li>
        ))}
      </ol>
      <section className="stack no-print">
        <SlideView s={s} n={cur} total={l.slides.length} pending={l.picturesPending} />
        <div className="row">
          <button className="btn sm" disabled={!!busy} onClick={() => act('rewrite')}>{busy === 'rewrite' ? t.busy : t.a1}</button>
          <button className="btn sm" disabled={!!busy} onClick={() => act('simpler')}>{busy === 'simpler' ? t.busy : t.a2}</button>
          <button className="btn sm" disabled={!!busy} onClick={() => act('image')}>{busy === 'image' ? t.busy : t.a3}</button>
          <button className="btn sm" onClick={() => setEdit({ heading: s.heading, bullets: s.bullets.join('\n'), notes: s.notes })}>✏️ {t.edit}</button>
          <div className="grow" />
          <button className="btn sm" onClick={onPrint}>{t.pdf}</button>
        </div>
        <ErrorNote text={err} />
        {edit && (
          <div className="card stack">
            <input value={edit.heading} onChange={(e) => setEdit({ ...edit, heading: e.target.value })} />
            <textarea rows={4} value={edit.bullets} onChange={(e) => setEdit({ ...edit, bullets: e.target.value })} />
            <label className="field">{t.notesTitle}<textarea rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
            <div className="row"><button className="btn primary" onClick={saveEdit}>{t.save}</button><button className="btn" onClick={() => setEdit(null)}>{t.cancel}</button></div>
          </div>
        )}
      </section>
      <aside className="stack no-print">
        <div className="card stack" style={{ gap: 8 }}><h3>{t.notesTitle}</h3><p style={{ margin: 0 }}>“{s.notes}”</p></div>
        {s.source && <div className="card stack" style={{ gap: 8 }}><h3>{t.srcTitle}</h3><p className="muted" style={{ margin: 0 }}>“{s.source}”</p></div>}
        <div className="card stack" style={{ gap: 8 }}><h3>🔊 {t.narration}</h3><p className="muted small" style={{ margin: 0 }}>{s.narration}</p></div>
        <button className="btn primary lg" onClick={() => go(`/lesson/${l.id}/video`)}>{t.nextVideo}</button>
      </aside>
    </main>
  );
}
