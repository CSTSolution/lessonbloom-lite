// The pupil's one link: watch the lesson (slides with narration), then practise at a chosen
// level, get marked straight away with praise and a short explanation. No account, no name.
import { useEffect, useState } from 'react';
import { api, sayAloud, type Level, type Marked, type PupilLesson } from '../api.ts';
import { useT } from '../i18n.ts';
import { PupilExerciseView } from '../parts/PupilExercise.tsx';
import { SlideCard } from '../parts/SlideCard.tsx';

export function Pupil({ share }: { share: string }) {
  const [t] = useT();
  const [l, setL] = useState<PupilLesson | null>(null), [err, setErr] = useState('');
  const [mode, setMode] = useState<'watch' | 'practice'>('watch');
  const [i, setI] = useState(0);
  const [level, setLevel] = useState<Level>('basic');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Marked | null>(null);

  useEffect(() => { api.pupil(share).then(setL).catch((e) => setErr(e.message)); }, [share]);
  if (err) return <p className="error page">{t.error}: {err}</p>;
  if (!l) return <p className="page muted">…</p>;

  const items = l.exercises.filter((e) => e.level === level);
  const praise = (m: Marked) => {
    const r = m.right / Math.max(1, m.total), pick = (a: string[]) => a[m.right % a.length];
    return r === 1 ? pick(t.praiseGreat) : r >= 0.6 ? pick(t.praiseGood) : t.tryAgain;
  };

  return (
    <div className="page pupil">
      <h1>{l.title}</h1>
      <nav className="tabs big">
        <button className={mode === 'watch' ? 'on' : ''} onClick={() => setMode('watch')}>📺 {t.watch}</button>
        <button className={mode === 'practice' ? 'on' : ''} onClick={() => setMode('practice')}>✏️ {t.practice}</button>
      </nav>

      {mode === 'watch' && (
        <div className="viewer">
          {l.video ? <video src={l.video} controls playsInline className="video" /> : (
            <>
              <SlideCard s={l.slides[i]} n={i} total={l.slides.length} />
              <div className="row center">
                <button disabled={i === 0} onClick={() => setI(i - 1)}>← {t.prev}</button>
                <button className="listen" onClick={() => sayAloud(l.slides[i].narration, l.lang)}>🔊 {t.listen}</button>
                {i < l.slides.length - 1 ? <button className="primary" onClick={() => setI(i + 1)}>{t.next} →</button>
                  : <button className="primary" onClick={() => setMode('practice')}>✏️ {t.practice} →</button>}
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'practice' && (
        <div>
          <div className="row center levels">
            <span>{t.chooseLevel}:</span>
            {(['basic', 'good', 'advanced'] as Level[]).map((lv) => (
              <button key={lv} className={level === lv ? 'on' : ''} onClick={() => { setLevel(lv); setAnswers({}); setMarked(null); }}>
                {'⭐'.repeat(lv === 'basic' ? 1 : lv === 'good' ? 2 : 3)} {t[lv]}
              </button>
            ))}
          </div>
          {items.map((e) => (
            <PupilExerciseView key={e.id} e={e} value={answers[e.id] || ''} set={(v) => setAnswers({ ...answers, [e.id]: v })} result={marked?.result[e.id]} />
          ))}
          {!marked ? (
            <div className="row center"><button className="primary big" disabled={!Object.keys(answers).length} onClick={async () => setMarked(await api.submit(share, level, answers))}>{t.check}</button></div>
          ) : (
            <div className="praise">
              <div className="stars">{'🌟'.repeat(Math.max(1, marked.right))}</div>
              <h2>{praise(marked)}</h2>
              <p>{marked.right} {t.right} {t.of} {marked.total}</p>
              <button className="primary" onClick={() => { setAnswers({}); setMarked(null); scrollTo(0, 0); }}>{t.again}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
