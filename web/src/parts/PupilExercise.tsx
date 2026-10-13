// Interactive exercise for pupils, one view per template. Big tap targets for tablets.
import { useState } from 'react';
import { sayAloud, type PupilExercise } from '../api.ts';
import { useT } from '../i18n.ts';

interface Props { e: PupilExercise; value: string; set: (v: string) => void; result?: { correct: boolean; answer: string; explain: string } }

export function PupilExerciseView({ e, value, set, result }: Props) {
  const [t] = useT();
  const done = !!result;
  const choice = (opts: string[], fmt = (o: string) => o) => (
    <div className="choices">
      {opts.map((o) => <button key={o} disabled={done} className={value === o ? 'picked' : ''} onClick={() => set(o)}>{fmt(o)}</button>)}
    </div>
  );
  let body: React.ReactNode = null;
  switch (e.type) {
    case 'math_mcq': body = choice(e.options || []); break;
    case 'math_truefalse': body = <><div className="big-q">{e.statement}</div>{choice(['true', 'false'], (o) => (o === 'true' ? `✅ ${t.true}` : `❌ ${t.false}`))}</>; break;
    case 'math_fill': {
      const [l, r] = (e.equation || '').split('?');
      body = <div className="big-q">{l}<input className="blank" inputMode="numeric" disabled={done} value={value} onChange={(x) => set(x.target.value)} />{r}</div>;
      break;
    }
    case 'math_word': body = <div className="big-q"><input className="blank wide" inputMode="numeric" disabled={done} value={value} onChange={(x) => set(x.target.value)} /> {e.unit}</div>; break;
    case 'eng_fill': body = <><div className="big-q">{(e.sentence || '').replace(/_{2,}/, value ? `【${value}】` : '____')}</div>{choice(e.options || [])}</>; break;
    case 'eng_listen': body = <><button className="listen" onClick={() => sayAloud(e.say || '', 'en')}>🔊 {t.listen}</button>{choice(e.options || [])}</>; break;
    case 'eng_order': body = <Order words={e.words || []} value={value} set={set} done={done} />; break;
    case 'eng_match': body = <Match words={(e.pairs || []).map((p) => p.word)} pictures={e.pictures || []} value={value} set={set} done={done} />; break;
  }
  return (
    <div className={`ex-card ${result ? (result.correct ? 'right' : 'wrong') : ''}`}>
      <p className="ex-prompt">{e.prompt}</p>
      {body}
      {result && (
        <div className="feedback">{result.correct ? '🌟' : `💡 ${result.answer}`} <span>{result.explain}</span></div>
      )}
    </div>
  );
}

function Order({ words, value, set, done }: { words: string[]; value: string; set: (v: string) => void; done: boolean }) {
  const [t] = useT();
  const used = value ? value.split(' ') : [];
  const left = [...words];
  for (const u of used) { const i = left.indexOf(u); if (i >= 0) left.splice(i, 1); }
  return (
    <>
      <div className="built">{value || '…'}</div>
      <div className="choices">
        {left.map((w, i) => <button key={`${w}${i}`} disabled={done} onClick={() => set([...used, w].join(' '))}>{w}</button>)}
        {used.length > 0 && !done && <button className="link" onClick={() => set('')}>{t.clear}</button>}
      </div>
      <p className="hint muted">{t.orderHint}</p>
    </>
  );
}

function Match({ words, pictures, value, set, done }: { words: string[]; pictures: string[]; value: string; set: (v: string) => void; done: boolean }) {
  const [t] = useT();
  const [pick, setPick] = useState<string | null>(null);
  const m: Record<string, string> = value ? JSON.parse(value) : {};
  const choose = (pic: string) => { if (!pick) return; set(JSON.stringify({ ...m, [pick]: pic })); setPick(null); };
  return (
    <>
      <div className="match">
        <div>{words.map((w) => <button key={w} disabled={done} className={pick === w ? 'picked' : m[w] ? 'paired' : ''} onClick={() => setPick(w)}>{w} {m[w] || ''}</button>)}</div>
        <div>{pictures.map((p) => <button key={p} disabled={done} className="pic" onClick={() => choose(p)}>{p}</button>)}</div>
      </div>
      <p className="hint muted">{t.matchHint}</p>
    </>
  );
}
