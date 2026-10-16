// "In / Xuất PDF": the teacher picks what to print (slides with or without notes, a worksheet
// from chosen templates and levels with a name line, an answer key on its own page, flashcards to
// cut out). The pages render into #print-root and the browser's print dialog prints or saves a PDF.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Exercise, Lesson, Level } from '../api.ts';
import { useT } from '../i18n.ts';
import { T } from './dict.ts';
import { SlideView } from './Slides.tsx';

const P = {
  vi: {
    title: 'In hoặc lưu PDF', sub: 'Chọn những gì cần in. Trong hộp thoại in, chọn "Lưu thành PDF" nếu cô muốn có file.',
    slides: 'Slide bài giảng', notes: 'Kèm lời giảng cho cô', sheet: 'Phiếu bài tập', templates: 'Mẫu bài', levels: 'Mức', nameLine: 'Dòng "Họ và tên / Lớp" ở đầu phiếu',
    key: 'Đáp án và lời giải (trang riêng)', cards: 'Thẻ nhớ để cắt', print: 'In / Lưu PDF', close: 'Đóng', none: 'Cô chọn ít nhất một mục để in nhé.', noItems: 'Không có câu nào với mẫu và mức đã chọn.',
    count: (n: number) => `${n} câu`, pick: 'Chọn từng câu', pickHide: 'Ẩn danh sách câu', all: 'In tất cả', allSub: 'Slide kèm lời giảng, phiếu tất cả các câu, đáp án và thẻ nhớ', sheetH: 'Phiếu bài tập', keyH: 'Đáp án', cardsH: 'Thẻ nhớ', name: 'Họ và tên:', cls: 'Lớp:', date: 'Ngày:',
    answer: 'Trả lời:', tf: ['Đúng', 'Sai'], listenFor: (w: string) => `Cô đọc: “${w}”`, listen: 'Nghe cô đọc rồi khoanh từ đúng.', match: 'Nối mỗi từ với hình đúng.', order: 'Sắp xếp các từ thành câu đúng.', explain: 'Lời giải:',
  },
  en: {
    title: 'Print or save as PDF', sub: 'Choose what to print. In the print dialog, choose "Save as PDF" to get a file.',
    slides: 'Lesson slides', notes: 'With teacher notes', sheet: 'Worksheet', templates: 'Templates', levels: 'Levels', nameLine: '"Name / Class" line at the top',
    key: 'Answer key with solutions (separate page)', cards: 'Flashcards to cut out', print: 'Print / Save PDF', close: 'Close', none: 'Choose at least one thing to print.', noItems: 'No items for the chosen templates and levels.',
    count: (n: number) => `${n} items`, pick: 'Choose questions', pickHide: 'Hide the question list', all: 'Print everything', allSub: 'Slides with notes, a worksheet with every question, the answer key and flashcards', sheetH: 'Worksheet', keyH: 'Answer key', cardsH: 'Flashcards', name: 'Name:', cls: 'Class:', date: 'Date:',
    answer: 'Answer:', tf: ['True', 'False'], listenFor: (w: string) => `Teacher reads: “${w}”`, listen: 'Listen to your teacher, then circle the right word.', match: 'Match each word to the right picture.', order: 'Put the words in the right order.', explain: 'Solution:',
  },
};
const LEVELS: Level[] = ['basic', 'good', 'advanced'];
export type PrintPart = 'slides' | 'sheet' | 'cards';

// a fixed mix-up of the words that never reads as the answer
function scramble(words: string[], answer: string): string[] {
  const w = [...words].sort();
  if (w.join(' ').replace(/[.?!]$/, '') === answer.replace(/[.?!]$/, '')) w.reverse();
  return w;
}

function Item({ e, n, p }: { e: Exercise; n: number; p: typeof P.vi }) {
  const box = <span className="pr-box" />;
  const opts = (o: string[]) => <div className="pr-opts">{o.map((x, i) => <span key={x}>{String.fromCharCode(65 + i)}. {x}</span>)}</div>;
  let body: React.ReactNode;
  switch (e.type) {
    case 'math_mcq': body = <><p>{e.prompt}</p>{!e.prompt.includes(e.expr) && <p className="pr-big">{e.expr}</p>}{opts(e.options)}</>; break;
    case 'math_fill': body = <><p>{e.prompt}</p><p className="pr-big">{e.equation.split('?').map((part, i, a) => <span key={i}>{part}{i < a.length - 1 && box}</span>)}</p></>; break;
    case 'math_truefalse': body = <><p>{e.prompt}</p><p className="pr-big">{e.statement} &nbsp; <span className="pr-tf">{p.tf[0]} {box}</span> <span className="pr-tf">{p.tf[1]} {box}</span></p></>; break;
    case 'math_word': body = <><p>{e.prompt}</p><p>{p.answer} ............................ {e.unit || ''}</p></>; break;
    case 'eng_match': {
      const pics = e.pairs.map((x) => x.emoji); pics.push(pics.shift()!);   // rotated, so no picture sits next to its word
      body = <><p>{e.prompt || p.match}</p><div className="pr-match"><div>{e.pairs.map((x) => <span key={x.word}>{x.word} •</span>)}</div><div>{pics.map((x) => <span key={x}>• {x}</span>)}</div></div></>; break;
    }
    case 'eng_fill': body = <><p>{e.prompt}</p><p className="pr-big">{e.sentence.replace(/_{2,}/, ' ............ ')}</p>{opts(e.options)}</>; break;
    case 'eng_listen': body = <><p>{e.prompt || p.listen}</p>{opts(e.options)}</>; break;
    case 'eng_order': body = <><p>{e.prompt || p.order}</p><p className="pr-big">{scramble(e.words, e.answer).join('  /  ')}</p><p>.................................................................</p></>; break;
  }
  return <li className="pr-item" value={n}>{body}</li>;
}

// one line per question in the chooser's list
const shortQ = (e: Exercise) => ('expr' in e && e.expr ? e.expr : 'equation' in e ? e.equation : 'statement' in e ? e.statement : 'sentence' in e ? e.sentence : e.type === 'eng_match' ? e.pairs.map((x) => x.word).join(', ') : e.type === 'eng_order' ? e.answer : e.prompt);

function keyOf(e: Exercise, p: typeof P.vi): string {
  switch (e.type) {
    case 'math_truefalse': return e.answer === 'true' ? p.tf[0] : p.tf[1];
    case 'eng_match': return e.pairs.map((x) => `${x.word} – ${x.emoji}`).join(', ');
    case 'eng_listen': return `${e.answer} (${p.listenFor(e.say)})`;
    case 'math_word': return `${e.answer}${e.unit ? ' ' + e.unit : ''}`;
    default: return e.answer;
  }
}

export function PrintDialog({ l, initial, onClose }: { l: Lesson; initial: PrintPart; onClose: () => void }) {
  const p = useT(P), t = useT(T);
  const types = [...new Set(l.exercises.map((e) => e.type))];
  const [o, setO] = useState({ slides: initial === 'slides', notes: true, sheet: initial === 'sheet', nameLine: true, key: initial === 'sheet', cards: initial === 'cards',
    types: types as string[], levels: [...LEVELS] as string[] });
  const [printing, setPrinting] = useState(false), [msg, setMsg] = useState('');
  const [skip, setSkip] = useState<string[]>([]), [picking, setPicking] = useState(false);    // questions left out one by one
  const pool = l.exercises.filter((e) => o.types.includes(e.type) && o.levels.includes(e.level));
  const items = pool.filter((e) => !skip.includes(e.id));
  const nOf = (type: string) => l.exercises.filter((e) => e.type === type && o.levels.includes(e.level) && !skip.includes(e.id)).length;
  const printAll = () => { setO({ ...o, slides: true, notes: true, sheet: true, key: true, cards: l.flashcards.length > 0, types: types as string[], levels: [...LEVELS] }); setSkip([]); setMsg(''); setPrinting(true); };
  const toggle = (k: 'types' | 'levels', v: string) => setO({ ...o, [k]: o[k].includes(v) ? o[k].filter((x) => x !== v) : [...o[k], v] });
  useEffect(() => {                               // Esc closes the chooser
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [onClose]);
  useEffect(() => {
    if (!printing) return;
    const done = () => { setPrinting(false); document.body.classList.remove('printing'); };
    addEventListener('afterprint', done, { once: true });
    document.body.classList.add('printing');
    // print once every picture in the pages has loaded (or failed), at most 8 s
    let live = true;
    const imgs = [...document.querySelectorAll<HTMLImageElement>('#print-root img')];
    const loaded = Promise.all(imgs.map((im) => im.complete ? null : new Promise((r) => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); })));
    Promise.race([loaded, new Promise((r) => setTimeout(r, 8000))]).then(() => setTimeout(() => { if (live) print(); }, 100));
    return () => { live = false; removeEventListener('afterprint', done); };
  }, [printing]);
  const go = () => {
    if (!o.slides && !o.sheet && !o.key && !o.cards) return setMsg(p.none);
    if ((o.sheet || o.key) && !items.length) return setMsg(p.noItems);
    setMsg(''); setPrinting(true);
  };
  const head = (h: string) => <header className="pr-head"><strong>{h}</strong><span>{l.intake.title} · {l.intake.subject === 'english' ? t.english : t.math} · {t.grade} {l.intake.grade}</span></header>;

  return (
    <>
      <div className="modal-bg no-print" onClick={onClose}>
        <div className="card modal stack" role="dialog" aria-modal="true" aria-labelledby="pr-title" onClick={(e) => e.stopPropagation()}>
          <h2 id="pr-title">{p.title}</h2>
          <p className="muted small" style={{ margin: 0 }}>{p.sub}</p>
          <label className="row pr-opt"><input type="checkbox" checked={o.slides} onChange={(e) => setO({ ...o, slides: e.target.checked })} /><strong>{p.slides}</strong> <span className="muted small">({l.slides.length})</span></label>
          {o.slides && <label className="row pr-sub"><input type="checkbox" checked={o.notes} onChange={(e) => setO({ ...o, notes: e.target.checked })} />{p.notes}</label>}
          <label className="row pr-opt"><input type="checkbox" checked={o.sheet} onChange={(e) => setO({ ...o, sheet: e.target.checked })} /><strong>{p.sheet}</strong> <span className="muted small">({p.count(items.length)})</span></label>
          {(o.sheet || o.key) && (
            <div className="pr-sub stack" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 6 }}><span className="small muted">{p.templates}:</span>{types.map((x) => <label key={x} className={`pill sm ${o.types.includes(x) ? 'on' : ''}`}><input type="checkbox" className="sr" checked={o.types.includes(x)} onChange={() => toggle('types', x)} />{t.tpl[x as keyof typeof t.tpl] || x} <b>{nOf(x)}</b></label>)}</div>
              <div className="row" style={{ gap: 6 }}><span className="small muted">{p.levels}:</span>{LEVELS.map((x) => <label key={x} className={`pill sm ${o.levels.includes(x) ? 'on' : ''}`}><input type="checkbox" className="sr" checked={o.levels.includes(x)} onChange={() => toggle('levels', x)} />{t[x]}</label>)}</div>
              <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} aria-expanded={picking} onClick={() => setPicking(!picking)}>{picking ? p.pickHide : `${p.pick} (${items.length}/${pool.length})`}</button>
              {picking && (
                <ol className="pr-pick">{pool.map((e) => (
                  <li key={e.id}><label className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={!skip.includes(e.id)} onChange={() => setSkip(skip.includes(e.id) ? skip.filter((x) => x !== e.id) : [...skip, e.id])} />
                    <span><span className="muted small">{t.tpl[e.type as keyof typeof t.tpl] || e.type} · {t[e.level]}</span><br />{shortQ(e)}</span></label></li>))}
                </ol>
              )}
              {o.sheet && <label className="row"><input type="checkbox" checked={o.nameLine} onChange={(e) => setO({ ...o, nameLine: e.target.checked })} />{p.nameLine}</label>}
            </div>
          )}
          <label className="row pr-opt"><input type="checkbox" checked={o.key} onChange={(e) => setO({ ...o, key: e.target.checked })} /><strong>{p.key}</strong></label>
          {l.flashcards.length > 0 && <label className="row pr-opt"><input type="checkbox" checked={o.cards} onChange={(e) => setO({ ...o, cards: e.target.checked })} /><strong>{p.cards}</strong> <span className="muted small">({l.flashcards.length})</span></label>}
          {msg && <p className="error-note" role="alert">{msg}</p>}
          <div className="row"><button className="btn primary" onClick={go}>{p.print}</button><button className="btn" onClick={printAll} title={p.allSub}>{p.all}</button><div className="grow" /><button className="btn ghost" onClick={onClose}>{p.close}</button></div>
        </div>
      </div>
      {printing && createPortal(
        <div id="print-root">
          {o.slides && l.slides.map((x, i) => <section key={x.id} className="pr-page pr-slide"><SlideView s={x} n={i} total={l.slides.length} />{o.notes && x.notes && <p className="pr-notes">{t.notesTitle}: {x.notes}</p>}</section>)}
          {o.sheet && (
            <section className="pr-page">
              {head(p.sheetH)}
              {o.nameLine && <p className="pr-name">{p.name} ........................................ &nbsp; {p.cls} .............. &nbsp; {p.date} ..............</p>}
              <ol className="pr-list">{items.map((e, i) => <Item key={e.id} e={e} n={i + 1} p={p} />)}</ol>
            </section>
          )}
          {o.key && (
            <section className="pr-page">
              {head(p.keyH)}
              <ol className="pr-key">{items.map((e, i) => <li key={e.id} value={i + 1}><strong>{keyOf(e, p)}</strong>{e.explain ? <span className="muted"> · {p.explain} {e.explain}</span> : null}</li>)}</ol>
            </section>
          )}
          {o.cards && (
            <section className="pr-page">
              {head(p.cardsH)}
              <div className="pr-cards">{l.flashcards.map((c) => <div key={c.id} className="pr-card"><div>{c.emoji} {c.front}</div><div>{c.back}{c.example ? <small>{c.example}</small> : null}</div></div>)}</div>
            </section>
          )}
        </div>, document.body)}
    </>
  );
}
