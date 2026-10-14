// Screens 15 + 19: memory game. Four pairs (eight cards) face down; flip two at a time, pairs
// that match stay open in green. Purple theme. Nothing is counted except pairs found.
import { useEffect, useRef, useState } from 'react';
import { go, type MemoryPair } from '../api.ts';
import { useT } from '../i18n.ts';
import { Gate, Star, TopBar, markVisited, shuffle, useLearn } from './shared.tsx';

const D = {
  vi: { title: 'Lật thẻ tìm cặp', sub: { math: 'Ghép phép tính với kết quả', english: 'Ghép từ với hình hoặc nghĩa của nó' }, pairs: 'cặp', help: 'Chạm vào 2 thẻ để lật. Tìm hết các cặp nhé!',
    faceDown: (i: number) => `Thẻ úp số ${i}`, found: 'đã tìm được', match: 'Đúng cặp rồi!', noMatch: 'Chưa đúng cặp, thử lại nhé!',
    doneH: 'Giỏi quá! Con tìm được hết các cặp rồi!', doneB: 'Con có trí nhớ thật tốt.', again: 'Chơi lại', home: 'Về trang bài học', empty: 'Bài này chưa có trò lật thẻ.' },
  en: { title: 'Memory match', sub: { math: 'Match each sum with its answer', english: 'Match each word with its picture or meaning' }, pairs: 'pairs', help: 'Tap two cards to flip them. Find all the pairs!',
    faceDown: (i: number) => `Face-down card ${i}`, found: 'found', match: 'A pair!', noMatch: 'Not a pair, try again!',
    doneH: 'Well done! You found all the pairs!', doneB: 'You have a great memory.', again: 'Play again', home: 'Back to the lesson', empty: 'This lesson has no memory game yet.' },
};

interface Card { key: string; pair: string; face: string }
const deal = (pairs: MemoryPair[]): Card[] =>
  shuffle(shuffle(pairs).slice(0, 4).flatMap((p) => [{ key: `${p.id}-a`, pair: p.id, face: p.a }, { key: `${p.id}-b`, pair: p.id, face: p.b }]));

export function Memory({ pid }: { pid: string }) {
  const state = useLearn(pid);
  useEffect(() => markVisited(pid, 'memory'), [pid]);
  return <Gate pid={pid} state={state}>{(_, lesson) => <Game pid={pid} pairs={lesson.pairs} subject={lesson.subject} />}</Gate>;
}

function Game({ pid, pairs, subject }: { pid: string; pairs: MemoryPair[]; subject: 'math' | 'english' }) {
  const t = useT(D);
  const [deck, setDeck] = useState(() => deal(pairs));
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [say, setSay] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const total = deck.length / 2;
  const busy = open.length === 2;
  const finished = total > 0 && matched.length === total;

  const tap = (c: Card) => {
    if (busy || matched.includes(c.pair) || open.includes(c.key)) return;
    if (open.length === 0) { setOpen([c.key]); setSay(c.face); return; }
    const first = deck.find((d) => d.key === open[0])!;
    if (first.pair === c.pair) { setMatched([...matched, c.pair]); setOpen([]); setSay(`${c.face}. ${t.match}`); return; }
    setOpen([open[0], c.key]); setSay(`${c.face}. ${t.noMatch}`);
    timer.current = setTimeout(() => setOpen([]), 1100);
  };
  const restart = () => { clearTimeout(timer.current); setDeck(deal(pairs)); setOpen([]); setMatched([]); setSay(''); };

  const head = (
    <TopBar back={`/learn/${pid}`}>
      <div className="p-head"><div className="t">{t.title}</div><div className="s">{t.sub[subject]}</div></div>
    </TopBar>
  );
  if (total < 2) return (<>{head}<div className="p-center" style={{ padding: '40px 0' }}><p className="p-sub">{t.empty}</p><button className="p-btn purple" onClick={() => go(`/learn/${pid}`)}>{t.home}</button></div></>);

  return (
    <>
      {head}
      <span className="m-count" aria-live="polite">{matched.length}/{total} {t.pairs}</span>
      {finished ? (
        <>
          <div className="p-center" style={{ padding: '24px 0', gap: 12 }} role="status">
            <Star size={88} />
            <h1>{t.doneH}</h1>
            <p className="p-sub">{t.doneB}</p>
          </div>
          <div className="m-grid" style={{ flex: 'none' }}>
            {[...new Set(deck.map((d) => d.pair))].flatMap((pr) => deck.filter((d) => d.pair === pr).sort((x, y) => x.key.localeCompare(y.key))).map((c) => <div key={c.key} className={`m-card matched${c.face.length > 7 ? ' long' : ''}`} style={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.face}</div>)}
          </div>
          <span className="p-spacer" />
          <div className="stack">
            <button className="p-btn purple" onClick={restart}>{t.again}</button>
            <button className="p-btn ghost" onClick={() => go(`/learn/${pid}`)}>{t.home}</button>
          </div>
        </>
      ) : (
        <>
          <div className="m-grid">
            {deck.map((c, i) => {
              const isM = matched.includes(c.pair), isO = open.includes(c.key), shown = isM || isO;
              return (
                <button key={c.key} className={`m-card${isM ? ' matched' : isO ? ' open' : ''}${shown && c.face.length > 7 ? ' long' : ''}`}
                  aria-label={shown ? `${c.face}${isM ? `, ${t.found}` : ''}` : t.faceDown(i + 1)} aria-disabled={isM || isO || busy} onClick={() => tap(c)}>
                  {shown ? c.face : '?'}
                </button>
              );
            })}
          </div>
          <p className="sr" aria-live="polite">{say}</p>
          <p className="p-sub center">{t.help}</p>
        </>
      )}
    </>
  );
}
