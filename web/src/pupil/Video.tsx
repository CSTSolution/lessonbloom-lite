// The lesson video. When the teacher has not made a video yet, the slides are shown one at a
// time with a button that reads the slide's narration aloud.
import { useEffect, useRef, useState } from 'react';
import { go, sayAloud, type Learn } from '../api.ts';
import { useT } from '../i18n.ts';
import { Gate, SpeakerIcon, TopBar, markVisited, useLearn } from './shared.tsx';

const D = {
  vi: { title: 'Xem video', slidesTitle: 'Xem bài giảng', prev: 'Trang trước', next: 'Trang sau', listen: 'Nghe cô giảng', page: (i: number, n: number) => `Trang ${i} trên ${n}`,
    done: 'Xem xong rồi', after: 'Xem xong rồi thì mình ôn bằng thẻ nhớ nhé!', cards: 'Sang thẻ nhớ', home: 'Về trang bài học', empty: 'Bài này chưa có video.' },
  en: { title: 'Watch video', slidesTitle: 'Lesson slides', prev: 'Previous', next: 'Next', listen: 'Listen', page: (i: number, n: number) => `Page ${i} of ${n}`,
    done: 'Finished', after: 'When you’ve finished, review with the flashcards!', cards: 'Go to flashcards', home: 'Back to the lesson', empty: 'This lesson has no video yet.' },
};

export function Video({ pid }: { pid: string }) {
  const state = useLearn(pid);
  useEffect(() => markVisited(pid, 'video'), [pid]);
  return <Gate pid={pid} state={state}>{(_, lesson) => <Player pid={pid} lesson={lesson} />}</Gate>;
}

function Player({ pid, lesson }: { pid: string; lesson: NonNullable<Learn['lesson']> }) {
  const t = useT(D);
  const [i, setI] = useState(0);
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => { try { speechSynthesis.cancel(); } catch { /* no speech */ } }, []);
  const slides = lesson.slides;
  const head = (title: string) => (
    <TopBar back={`/learn/${pid}`}>
      <div className="p-head"><div className="t">{title}</div><div className="s">{lesson.title}</div></div>
    </TopBar>
  );
  const after = (
    <>
      <span className="p-spacer" />
      {lesson.flashcards.length > 0 && <button className="p-btn green" onClick={() => go(`/learn/${pid}/cards`)}>{t.cards}</button>}
      <button className="p-btn ghost" onClick={() => go(`/learn/${pid}`)}>{t.home}</button>
    </>
  );

  if (lesson.video) return (
    <>
      {head(t.title)}
      <video className="v-player" src={lesson.video} controls playsInline preload="metadata" />
      <p className="p-sub center">{t.after}</p>
      {after}
    </>
  );
  if (!slides.length) return (<>{head(t.title)}<p className="p-sub center" style={{ padding: '40px 0' }}>{t.empty}</p>{after}</>);

  const s = slides[i];
  const move = (d: number) => { try { speechSynthesis.cancel(); } catch { /* no speech */ } setI(Math.min(slides.length - 1, Math.max(0, i + d))); requestAnimationFrame(() => headRef.current?.focus()); };
  const last = i === slides.length - 1;
  return (
    <>
      {head(t.slidesTitle)}
      <div className="p-card v-slide" aria-label={t.page(i + 1, slides.length)} role="group">
        <h2 ref={headRef} tabIndex={-1} className="display" style={{ fontSize: 26, lineHeight: 1.2, outline: 'none' }}>{s.heading}</h2>
        {s.image && <img src={s.image} alt="" />}
        {s.bullets.length > 0 && <ul>{s.bullets.map((b, k) => <li key={k}>{b}</li>)}</ul>}
        {s.example && <div className="v-ex">{s.example}</div>}
        {s.narration && <button className="p-pill" onClick={() => sayAloud(s.narration, lesson.lang)}><SpeakerIcon />{t.listen}</button>}
      </div>
      <div className="v-nav">
        <button className="p-btn ghost" onClick={() => move(-1)} disabled={i === 0}>‹ {t.prev}</button>
        <span className="n" aria-live="polite">{i + 1}/{slides.length}</span>
        {last
          ? <button className="p-btn" onClick={() => go(lesson.flashcards.length ? `/learn/${pid}/cards` : `/learn/${pid}`)}>{t.done} ✓</button>
          : <button className="p-btn" onClick={() => move(1)}>{t.next} ›</button>}
      </div>
      <span className="p-spacer" />
      <button className="p-btn ghost" onClick={() => go(`/learn/${pid}`)}>{t.home}</button>
    </>
  );
}
