// Screens 14 + 18: flashcards. Tap the card to flip it; "Ôn lại" puts it back into the deck a
// little later, "Đã nhớ" takes it out. Green theme.
import { useEffect, useRef, useState } from 'react';
import { go, sayAloud, type Flashcard } from '../api.ts';
import { useT } from '../i18n.ts';
import { Gate, SpeakerIcon, TopBar, markVisited, useLearn, Head } from './shared.tsx';

const D = {
  vi: { title: 'Thẻ nhớ', subj: { math: 'Toán', english: 'Tiếng Anh' }, grade: 'Lớp', card: (i: number, n: number) => `thẻ ${i}/${n}`,
    flipAria: (f: string) => `Thẻ ${f}. Chạm để lật thẻ`, flipBackAria: 'Chạm để lật lại', tap: 'Chạm để lật thẻ', meaning: { english: 'Nghĩa tiếng Việt', math: 'Kết quả' },
    listen: 'Nghe phát âm', again: 'Ôn lại', got: 'Đã nhớ', doneH: 'Con nhớ hết thẻ rồi!', doneB: 'Giỏi quá! Mình chơi lật thẻ tìm cặp hay làm bài tập nhé.',
    redo: 'Xem lại từ đầu', practice: 'Làm bài tập', home: 'Về trang bài học', empty: 'Bài này chưa có thẻ nhớ.' },
  en: { title: 'Flashcards', subj: { math: 'Math', english: 'English' }, grade: 'Grade', card: (i: number, n: number) => `card ${i}/${n}`,
    flipAria: (f: string) => `Card ${f}. Tap to flip`, flipBackAria: 'Tap to flip back', tap: 'Tap to flip', meaning: { english: 'Vietnamese meaning', math: 'Answer' },
    listen: 'Hear it', again: 'Review again', got: 'I know it', doneH: 'You know all the cards!', doneB: 'Great job! Try the memory game or the exercises next.',
    redo: 'Start again', practice: 'Exercises', home: 'Back to the lesson', empty: 'This lesson has no flashcards yet.' },
};

export function Flashcards({ pid }: { pid: string }) {
  const state = useLearn(pid);
  useEffect(() => markVisited(pid, 'cards'), [pid]);
  return <Gate pid={pid} state={state}>{(_, lesson) => <Deck pid={pid} cards={lesson.flashcards} lesson={lesson} />}</Gate>;
}

function Deck({ pid, cards, lesson }: { pid: string; cards: Flashcard[]; lesson: { title: string; subject: 'math' | 'english'; grade: number; lang: 'vi' | 'en' } }) {
  const t = useT(D);
  const [queue, setQueue] = useState<number[]>(() => cards.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  const n = cards.length;
  const english = lesson.subject === 'english' || lesson.lang === 'en';
  const head = (sub: string) => (
    <TopBar back={`/learn/${pid}`}>
      <Head title={`${t.title} · ${lesson.title}`} sub={<>{t.subj[lesson.subject]} · {t.grade} {lesson.grade}{sub}</>} />
    </TopBar>
  );

  if (!n) return (<>{head('')}<div className="p-center" style={{ padding: '40px 0' }}><p className="p-sub">{t.empty}</p><button className="p-btn green" onClick={() => go(`/learn/${pid}`)}>{t.home}</button></div></>);

  if (!queue.length) return (
    <>
      {head('')}
      <div className="p-center" style={{ padding: '30px 0', gap: 12 }} role="status">
        <div style={{ fontSize: 72 }} aria-hidden="true">🌟</div>
        <h1>{t.doneH}</h1>
        <p className="p-sub">{t.doneB}</p>
      </div>
      <span className="p-spacer" />
      <div className="stack">
        <button className="p-btn green" onClick={() => go(`/learn/${pid}/practice`)}>{t.practice}</button>
        <button className="p-btn ghost" onClick={() => { setQueue(cards.map((_, i) => i)); setFlipped(false); }}>{t.redo}</button>
        <button className="p-btn ghost" onClick={() => go(`/learn/${pid}`)}>{t.home}</button>
      </div>
    </>
  );

  const c = cards[queue[0]];
  const pos = n - queue.length + 1;
  const advance = (keep: boolean) => {
    const [cur, ...rest] = queue;
    // "Ôn lại": back into the deck two or three cards later (or at the end of a short deck)
    const q = keep ? [...rest.slice(0, 2), cur, ...rest.slice(2)] : rest;
    setQueue(keep && rest.length === 0 ? [cur] : q);
    setFlipped(false);
    cardRef.current?.focus();
  };
  const speak = () => (english ? sayAloud(c.say || c.front, 'en') : sayAloud(c.front, 'vi'));

  return (
    <>
      {head(` · ${t.card(pos, n)}`)}
      <button ref={cardRef} className="f-card" onClick={() => setFlipped(!flipped)} aria-label={flipped ? `${c.back}. ${t.flipBackAria}` : t.flipAria(c.front)}>
        {!flipped ? (
          <>
            {c.emoji && <span className="emoji" aria-hidden="true">{c.emoji}</span>}
            <span className="front">{c.front}</span>
            <span className="p-muted" style={{ fontSize: 15 }}>{t.tap}</span>
          </>
        ) : (
          <>
            <span className="backw">{c.back}</span>
            <span className="p-muted" style={{ fontSize: 14 }}>{t.meaning[english ? 'english' : 'math']}</span>
            {c.example && <span className="ex">{c.example}</span>}
            {c.exampleVi && <span className="p-muted" style={{ fontSize: 15 }}>{c.exampleVi}</span>}
          </>
        )}
      </button>
      <button className="p-pill" onClick={speak}><SpeakerIcon />{t.listen}</button>
      <div className="f-acts">
        <button className="f-again" onClick={() => advance(true)}>{t.again}</button>
        <button className="f-got" onClick={() => advance(false)}>{t.got}</button>
      </div>
    </>
  );
}
