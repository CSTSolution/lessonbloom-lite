// Screens 13 + 17: practice with instant, gentle feedback. One dot per question shows where the
// pupil is (not how many were right). Wrong → "Gần đúng rồi! Thử lại nhé" + the server's hint and
// another try; right → praise + the short explanation. Answers are marked on the server.
import { useEffect, useMemo, useRef, useState } from 'react';
import { go, pupilApi, sayAloud, session, type AnswerResult, type Learn, type PupilExercise } from '../api.ts';
import { useT } from '../i18n.ts';
import { BackButton, Gate, markVisited, shuffle, useLearn } from './shared.tsx';
import { LangToggle } from '../main.tsx';

const MAX = 10;

/** Today's set: basic items, then 'good' ones, those not yet answered right first; at most 10. */
export function practiceSet(all: PupilExercise[], done: string[] = []): PupilExercise[] {
  const lv = all.filter((e) => e.level === 'basic' || e.level === 'good');
  const pool = (lv.length ? lv : all).slice().sort((a, b) => (a.level === b.level ? 0 : a.level === 'basic' ? -1 : 1));
  const fresh = pool.filter((e) => !done.includes(e.id)), again = pool.filter((e) => done.includes(e.id));
  return [...fresh, ...again].slice(0, MAX);
}

const D = {
  vi: {
    back: 'Quay lại', qAria: (i: number, n: number) => `Câu ${i} trên ${n}`, listen: 'Nghe câu hỏi', hear: 'Nghe lại', check: 'Kiểm tra', sending: 'Đang xem…',
    ask: { math_mcq: 'Con chọn kết quả đúng nhé', math_fill: 'Điền số vào ô trống', math_truefalse: 'Đúng hay sai?', math_word: 'Con đọc đề rồi trả lời nhé', eng_fill: 'Chọn từ còn thiếu', eng_match: 'Nối từ với hình', eng_order: 'Xếp các từ thành câu', eng_listen: 'Nghe rồi chọn từ đúng' } as Record<string, string>,
    yes: 'Đúng', no: 'Sai', answerAria: 'Câu trả lời của con', blank: 'ô trống',
    wrongH: 'Gần đúng rồi! Con chọn lại nhé', wrongNoRetry: 'Gần đúng rồi!', moveOn: 'Mình sang câu tiếp theo nhé.', skip: 'Bỏ qua, sang câu sau',
    praise: ['Đúng rồi, giỏi quá!', 'Tuyệt vời, con làm đúng rồi!', 'Chính xác! Con giỏi lắm!'],
    next: 'Câu tiếp theo', finish: 'Xong rồi!', net: 'Mạng đang chậm, con bấm lại nhé.', nothing: 'Hôm nay chưa có câu nào để luyện.', home: 'Về trang bài học',
    pickWord: 'Chọn một từ trước, rồi chạm vào hình', remove: (w: string) => `Bỏ từ ${w}`, add: (w: string) => `Thêm từ ${w}`, matchOf: (w: string, e: string) => `${w}, đã nối với ${e}`,
  },
  en: {
    back: 'Back', qAria: (i: number, n: number) => `Question ${i} of ${n}`, listen: 'Listen to the question', hear: 'Listen again', check: 'Check', sending: 'Checking…',
    ask: { math_mcq: 'Pick the right answer', math_fill: 'Fill in the missing number', math_truefalse: 'True or false?', math_word: 'Read the problem and answer', eng_fill: 'Choose the missing word', eng_match: 'Match the words with the pictures', eng_order: 'Put the words in order', eng_listen: 'Listen and choose the right word' } as Record<string, string>,
    yes: 'True', no: 'False', answerAria: 'Your answer', blank: 'blank',
    wrongH: 'So close! Have another go', wrongNoRetry: 'So close!', moveOn: 'Let’s go to the next question.', skip: 'Skip to the next one',
    praise: ['Correct, well done!', 'Brilliant, that’s right!', 'Exactly! Great job!'],
    next: 'Next question', finish: 'All done!', net: 'The connection is slow, please tap again.', nothing: 'There is nothing to practise today.', home: 'Back to the lesson',
    pickWord: 'Pick a word first, then tap a picture', remove: (w: string) => `Remove ${w}`, add: (w: string) => `Add ${w}`, matchOf: (w: string, e: string) => `${w}, matched with ${e}`,
  },
};

export function Practice({ pid }: { pid: string }) {
  const state = useLearn(pid);
  useEffect(() => markVisited(pid, 'practice'), [pid]);
  return <Gate pid={pid} state={state}>{(learn) => <Run pid={pid} learn={learn} />}</Gate>;
}

type Status = 'idle' | 'sending' | 'wrong' | 'right';

function Run({ pid, learn }: { pid: string; learn: Learn }) {
  const t = useT(D);
  const lesson = learn.lesson!;
  const items = useMemo(() => {
    const ids = (new URLSearchParams(location.search).get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length) { const picked = ids.map((id) => lesson.exercises.find((e) => e.id === id)).filter(Boolean) as PupilExercise[]; if (picked.length) return picked; }
    return practiceSet(lesson.exercises, learn.done);
  }, [lesson, learn.done]);

  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState<boolean[]>(() => items.map(() => false));
  const [status, setStatus] = useState<Status>('idle');
  const [res, setRes] = useState<AnswerResult | null>(null);
  const [last, setLast] = useState('');          // the answer last sent (to colour the chosen option)
  const [netErr, setNetErr] = useState(false);
  const [typed, setTyped] = useState('');
  const headRef = useRef<HTMLDivElement>(null);

  const item = items[idx];
  const n = items.length;

  if (!item) return (
    <>
      <div className="pupil-top"><BackButton to={`/learn/${pid}`} /><span className="p-spacer" /><LangToggle /></div>
      <div className="p-center" style={{ padding: '40px 0' }}><p className="p-sub">{t.nothing}</p><button className="p-btn" onClick={() => go(`/learn/${pid}`)}>{t.home}</button></div>
    </>
  );

  const locked = status === 'sending' || status === 'right' || (status === 'wrong' && res?.retry === false);

  const submit = async (answer: string) => {
    if (locked) return;
    setStatus('sending'); setLast(answer); setNetErr(false);
    try {
      const r = await pupilApi.answer(pid, { assignmentId: learn.assignmentId || '', exerciseId: item.id, answer, session: session() });
      setRes(r); setStatus(r.correct ? 'right' : 'wrong');
      setAnswered((a) => a.map((v, i) => (i === idx ? true : v)));
    } catch {
      setNetErr(true); setStatus(res && !res.correct ? 'wrong' : 'idle');
    }
  };

  const next = () => {
    if (idx + 1 >= n) { go(`/learn/${pid}/done`); return; }
    setAnswered((a) => a.map((v, i) => (i === idx ? true : v)));
    setIdx(idx + 1); setStatus('idle'); setRes(null); setLast(''); setNetErr(false); setTyped('');
    requestAnimationFrame(() => headRef.current?.focus());
  };

  const ask = t.ask[item.type] || item.prompt;
  const speakText = [item.prompt, item.equation, item.statement, item.sentence].filter(Boolean).join('. ').replace(/_{2,}/g, '…');

  return (
    <>
      <div className="pupil-top">
        <BackButton to={`/learn/${pid}`} />
        <div className="q-dots" role="img" aria-label={t.qAria(idx + 1, n)}>
          {items.map((e, i) => <span key={e.id} className={i === idx ? 'cur' : answered[i] || i < idx ? 'done' : ''} />)}
        </div>
        <LangToggle />
      </div>

      <div className="q-card" ref={headRef} tabIndex={-1} style={{ outline: 'none' }}>
        <Question key={item.id} item={item} lang={lesson.lang} locked={locked} status={status} last={last} submit={submit} t={t} typed={typed} setTyped={setTyped} ask={ask} counter={`${idx + 1}/${n}`} />
        <button className="p-pill" style={{ marginTop: 4, minHeight: 44 }} onClick={() => sayAloud(speakText, lesson.lang)}>{t.listen}</button>
      </div>

      <Answers key={`a-${item.id}`} item={item} lang={lesson.lang} locked={locked} status={status} last={last} submit={submit} t={t} typed={typed} setTyped={setTyped} />

      <div aria-live="polite" role="status" className="stack" style={{ gap: 12 }}>
        {netErr && <p className="p-error">{t.net}</p>}
        {status === 'wrong' && res && (
          <div className="q-fb wrong">
            <div className="h">{res.retry ? t.wrongH : t.wrongNoRetry}</div>
            {res.hint && <div className="b">{res.hint}</div>}
            {!res.retry && <div className="b">{t.moveOn}</div>}
          </div>
        )}
        {status === 'right' && res && (
          <div className="q-fb right">
            <div className="h">{t.praise[idx % t.praise.length]}</div>
            {res.explain && <div className="b">{res.explain}</div>}
          </div>
        )}
      </div>

      <span className="p-spacer" />
      {(status === 'right' || (status === 'wrong' && res?.retry === false)) && (
        <button className="p-btn" style={{ minHeight: 64 }} onClick={next} autoFocus={status === 'right'}>{idx + 1 >= n ? t.finish : t.next}</button>
      )}
      {status === 'wrong' && res?.retry !== false && (
        <button className="p-pill" style={{ alignSelf: 'center', minHeight: 44 }} onClick={next}>{idx + 1 >= n ? t.finish : t.skip}</button>
      )}
    </>
  );
}

type T = (typeof D)['vi'];
interface QProps { item: PupilExercise; lang: 'vi' | 'en'; locked: boolean; status: Status; last: string; submit: (a: string) => void; t: T; typed: string; setTyped: (v: string) => void }

/** The question itself (inside the white card). */
function Question(p: QProps & { ask: string; counter: string }) {
  const { item, ask, counter, t } = p;
  useEffect(() => { if (item.type === 'eng_listen' && item.say) sayAloud(item.say, 'en'); }, [item]);
  const head = <div className="q-ask">{ask} · {counter}</div>;
  switch (item.type) {
    case 'math_mcq': return <>{head}<div className="q-big">{item.prompt}</div></>;
    case 'math_truefalse': return <>{head}<div className="q-big" style={{ fontSize: 44 }}>{item.statement}</div></>;
    case 'math_fill': { const parts = String(item.equation || '?').split('?');
      return <>{head}<div className="q-big" style={{ fontSize: 44 }}>{parts[0]}<TypedBox {...p} />{parts.slice(1).join('?')}</div></>; }
    case 'math_word': return (<>{head}<div className="q-story">{item.prompt}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}><TypedBox {...p} wide />{item.unit && <span className="q-unit">{item.unit}</span>}</div></>);
    case 'eng_fill': return <>{head}<div className="q-mid">{String(item.sentence || '').split(/_{2,}/).map((part, i, a) => <span key={i}>{part}{i < a.length - 1 && <span aria-label={t.blank} style={{ borderBottom: '3px solid currentColor', display: 'inline-block', minWidth: 70, color: p.status === 'right' ? 'var(--green-ink)' : undefined }}>{p.status === 'right' ? p.last : '\u00a0'}</span>}</span>)}</div></>;
    case 'eng_listen': return (<>{head}
      <button className="q-listen" aria-label={t.hear} onClick={() => sayAloud(item.say || '', 'en')}><span aria-hidden="true">🔊</span></button>
      <span className="p-muted small">{t.hear}</span></>);
    default: return <>{head}</>;
  }
}

/** The answer area under the card, per exercise type. */
function Answers(p: QProps) {
  const { item, locked, status, last, submit, t } = p;
  const optClass = (o: string, text = false) => `q-opt${text ? ' text' : ''}${last === o && status === 'right' ? ' right' : last === o && status === 'wrong' ? ' wrong' : ''}`;
  const choice = (opts: [string, string][], text = false) => (
    <div className="q-opts">
      {opts.map(([val, label]) => (
        <button key={val} className={optClass(val, (text && /\p{L}/u.test(label)) || label.length > 6)} disabled={locked} aria-pressed={last === val} onClick={() => submit(val)}>{label}</button>
      ))}
    </div>
  );
  switch (item.type) {
    case 'math_mcq': case 'eng_fill': case 'eng_listen':
      return choice((item.options as string[] || []).map((o) => [o, o]), item.type !== 'math_mcq');
    case 'math_truefalse':
      return choice([['true', `✓ ${t.yes}`], ['false', `✗ ${t.no}`]], true);
    case 'math_fill': case 'math_word': return <CheckBtn ok={!!p.typed.trim()} p={{ ...p, value: p.typed.trim() }} />;
    case 'eng_match': return <Match {...p} />;
    case 'eng_order': return <Order {...p} />;
    default: return null;
  }
}

function CheckBtn({ ok, p }: { ok: boolean; p: QProps & { value: string } }) {
  const { status, locked, submit, value, t } = p;
  if (status === 'right') return null;
  return <button className="p-btn green" disabled={!ok || locked} onClick={() => submit(value)}>{status === 'sending' ? t.sending : t.check}</button>;
}

function TypedBox(p: QProps & { wide?: boolean }) {
  const { locked, status, t, typed, setTyped, wide } = p;
  return (
    <input className={`q-input${wide ? ' wide' : ''}${status === 'wrong' ? ' wrong' : status === 'right' ? ' right' : ''}`} value={typed} inputMode="decimal" autoComplete="off" aria-label={t.answerAria} disabled={locked}
      onChange={(e) => setTyped(e.target.value.slice(0, 12))} onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim()) p.submit(typed.trim()); }} />
  );
}

function Match(p: QProps) {
  const { item, locked, t } = p;
  const words: string[] = (item.pairs || []).map((x: { word: string }) => x.word);
  const pics: string[] = item.pictures || [];
  const [map, setMap] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<string>(() => words[0] || '');
  const usedBy = (e: string) => Object.keys(map).find((w) => map[w] === e);
  const tapPic = (e: string) => {
    if (locked) return;
    if (!sel) { const w = usedBy(e); if (w) setSel(w); return; }   // tap a matched picture to change it
    const m = { ...map };
    const prev = usedBy(e); if (prev) delete m[prev];
    m[sel] = e; setMap(m);
    setSel(words.find((w) => !m[w]) || '');
  };
  const tapWord = (w: string) => {
    if (locked) return;
    if (map[w]) { const m = { ...map }; delete m[w]; setMap(m); }
    setSel(w);
  };
  const complete = words.length > 0 && words.every((w) => map[w]);
  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="p-sub center">{t.pickWord}</p>
      <div className="q-match">
        <div className="col">
          {words.map((w) => (
            <button key={w} className={`q-chip${sel === w ? ' sel' : ''}`} disabled={locked} aria-pressed={sel === w} aria-label={map[w] ? t.matchOf(w, map[w]) : w} onClick={() => tapWord(w)}>
              {w}{map[w] && <span className="em" aria-hidden="true">{map[w]}</span>}
            </button>
          ))}
        </div>
        <div className="col">
          {pics.map((e) => (
            <button key={e} className={`q-chip pic${usedBy(e) ? ' used' : ''}`} disabled={locked} onClick={() => tapPic(e)}>{e}</button>
          ))}
        </div>
      </div>
      <CheckBtn ok={complete} p={{ ...p, value: JSON.stringify(map) }} />
    </div>
  );
}

function Order(p: QProps) {
  const { item, locked, t } = p;
  const words: string[] = useMemo(() => (item.words || []) as string[], [item]);
  const [order, setOrder] = useState<number[]>([]);
  const bank = useMemo(() => shuffle(words.map((_, i) => i)), [words]);
  const sentence = order.map((i) => words[i]).join(' ');
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="q-line" aria-label={sentence || t.answerAria}>
        {order.map((i, k) => (
          <button key={`${i}-${k}`} className="q-chip" disabled={locked} aria-label={t.remove(words[i])} onClick={() => setOrder(order.filter((x) => x !== i))}>{words[i]}</button>
        ))}
      </div>
      <div className="q-bank">
        {bank.filter((i) => !order.includes(i)).map((i) => (
          <button key={i} className="q-chip" disabled={locked} aria-label={t.add(words[i])} onClick={() => setOrder([...order, i])}>{words[i]}</button>
        ))}
      </div>
      <CheckBtn ok={order.length === words.length && words.length > 0} p={{ ...p, value: sentence }} />
    </div>
  );
}
