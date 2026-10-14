// Screens 05-06 · steps 1-2: upload or paste the document, then check the questions Gemini
// pre-filled (goal, length, class level, outputs, an optional note), then build.
import { useState } from 'react';
import { go, teacherApi, type Intake } from '../api.ts';
import { useT } from '../i18n.ts';
import { T } from './dict.ts';
import { Stepper } from './LessonFlow.tsx';
import { Link } from './TeacherRoutes.tsx';

const SAMPLES = {
  math: `Toán lớp 2 – Phép cộng có nhớ trong phạm vi 100

Mục tiêu: Học sinh biết đặt tính thẳng cột và thực hiện phép cộng có nhớ hai số có hai chữ số trong phạm vi 100.

Cách làm: Đặt tính thẳng cột, hàng đơn vị thẳng hàng đơn vị, hàng chục thẳng hàng chục. Cộng từ phải sang trái. Cộng hàng đơn vị trước: nếu kết quả từ 10 trở lên thì viết chữ số hàng đơn vị và nhớ 1 sang hàng chục. Sau đó cộng hàng chục, nhớ cộng thêm 1.

Ví dụ: 36 + 27. Hàng đơn vị: 6 cộng 7 bằng 13, viết 3 nhớ 1. Hàng chục: 3 cộng 2 bằng 5, thêm 1 bằng 6, viết 6. Vậy 36 + 27 = 63.

Luyện tập: 48 + 25; 19 + 36; 57 + 28.

Bài toán: Vườn nhà Nam có 28 cây cam và 15 cây bưởi. Hỏi vườn nhà Nam có tất cả bao nhiêu cây?

Lưu ý: Nhiều bạn quên cộng thêm số nhớ ở hàng chục. Hãy viết số 1 nhỏ phía trên hàng chục để nhớ.`,
  english: `English Grade 3 – Unit: My favourite colour

Vocabulary: red, blue, green, yellow, pink, orange.

Sentence patterns:
- What colour is it? It's red.
- What's your favourite colour? My favourite colour is blue.

Example dialogue:
Mai: What colour is your pencil, Nam?
Nam: It's green.
Mai: What's your favourite colour?
Nam: My favourite colour is yellow. I like the sun!

Objectives: Pupils can name six colours, ask and answer "What colour is it?", and say their favourite colour.`,
};

async function readFileText(f: File): Promise<string> {
  if (/\.docx$/i.test(f.name)) {
    // @ts-expect-error browser build has no types
    const mammoth = (await import('mammoth/mammoth.browser.js')).default;
    return (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value as string;
  }
  return f.text();
}

export function Create() {
  const t = useT(T);
  const [step, setStep] = useState<1 | 2>(1);
  const [subject, setSubject] = useState<'math' | 'english'>('math');
  const [source, setSource] = useState('');
  const [it, setIt] = useState<Intake | null>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [over, setOver] = useState(false);
  const words = source.trim() ? source.trim().split(/\s+/).length : 0;

  const load = async (f?: File) => { if (!f) return; try { setSource((await readFileText(f)).slice(0, 20000)); } catch (e) { setErr((e as Error).message); } };
  const toQuestions = async () => {
    setBusy(true); setErr('');
    try { const r = await teacherApi.intake(source); setIt({ ...r, subject: r.subject || subject }); setStep(2); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const build = async () => {
    if (!it) return;
    setBusy(true); setErr('');
    try { const { id } = await teacherApi.create(source, it); go(`/lesson/${id}/build`); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => setIt((p) => (p ? { ...p, [k]: v } : p));

  return (
    <>
      <Stepper current={step - 1} />
      <main className="page narrow stack" style={{ gap: 18 }}>
        <div className="row"><div className="grow" /><Link to="/" className="btn ghost">{t.exit}</Link></div>
        {step === 1 && (
          <>
            <div><h1>{t.upTitle}</h1><p className="muted">{t.upSub}</p></div>
            <div className="row" style={{ gap: 16 }}>
              <label className="field grow">{t.subject}
                <select value={subject} onChange={(e) => setSubject(e.target.value as 'math' | 'english')}><option value="math">{t.math}</option><option value="english">{t.english}</option></select>
              </label>
            </div>
            <label
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files[0]); }}
              style={{ border: `2px dashed ${over ? 'var(--blue)' : 'var(--line-2)'}`, borderRadius: 14, padding: 28, textAlign: 'center', background: over ? 'var(--blue-soft)' : '#fff', cursor: 'pointer' }}>
              <div style={{ fontSize: 26, color: 'var(--blue)' }}>⤒</div>
              <strong>{t.drop}</strong>
              <div className="muted small">{t.formats}</div>
              <span className="btn sm" style={{ marginTop: 10, borderColor: 'var(--blue)', color: 'var(--blue)' }}>{t.choose}</span>
              <input type="file" accept=".txt,.docx,text/plain" className="sr" onChange={(e) => load(e.target.files?.[0])} />
            </label>
            <label className="field">{t.paste}
              <textarea rows={10} value={source} onChange={(e) => setSource(e.target.value)} />
            </label>
            <div className="row small">
              <span className="muted">{t.useSample}</span>
              <button className="btn ghost sm" onClick={() => { setSubject('math'); setSource(SAMPLES.math); }}>{t.sampleMath}</button>
              <button className="btn ghost sm" onClick={() => { setSubject('english'); setSource(SAMPLES.english); }}>{t.sampleEng}</button>
            </div>
            <div className="row">
              <span className="muted small grow">{words > 0 && t.received(words)}</span>
              <button className="btn primary lg" disabled={words < 8 || busy} onClick={toQuestions}>{busy ? t.reading : t.next}</button>
            </div>
          </>
        )}
        {step === 2 && it && (
          <>
            <div><h1>{t.qTitle}</h1><p className="muted">{t.qSub}</p></div>
            <div className="card stack" style={{ gap: 18 }}>
              <label className="field">{t.q0}<input value={it.title} onChange={(e) => set('title', e.target.value)} /></label>
              <label className="field"><span>{t.q1} <span className="chip blue small">{t.aiTag}</span></span>
                <textarea rows={2} value={it.objectives.join('\n')} onChange={(e) => set('objectives', e.target.value.split('\n'))} /></label>
              <div className="field"><span>{t.q2}</span>
                <div className="radio-pills">{[15, 25, 35].map((m) => <label key={m} className={it.minutes === m ? 'on' : ''}><input type="radio" className="sr" checked={it.minutes === m} onChange={() => set('minutes', m)} />{m} {t.min}</label>)}</div></div>
              <div className="field"><span>{t.q3}</span>
                <div className="radio-pills">{(['basic', 'good', 'mixed'] as const).map((l) => <label key={l} className={it.level === l ? 'on' : ''}><input type="radio" className="sr" checked={it.level === l} onChange={() => set('level', l)} />{t[l]}</label>)}</div></div>
              <div className="field"><span>{t.q4}</span>
                <div className="row" style={{ gap: 18 }}>{(['slides', 'video', 'exercises', 'flashcards'] as const).map((o) => (
                  <label key={o} className="row" style={{ gap: 6, fontWeight: 400 }}><input type="checkbox" checked={it.outputs.includes(o)} disabled={o === 'slides' || o === 'exercises'}
                    onChange={(e) => set('outputs', e.target.checked ? [...it.outputs, o] : it.outputs.filter((x) => x !== o))} />{t.outputs[o]}</label>))}</div></div>
              <div className="row" style={{ gap: 16 }}>
                <label className="field grow">{t.subject}<select value={it.subject} onChange={(e) => set('subject', e.target.value as Intake['subject'])}><option value="math">{t.math}</option><option value="english">{t.english}</option></select></label>
                <label className="field grow">{t.grade}<select value={it.grade} onChange={(e) => set('grade', Number(e.target.value) as Intake['grade'])}>{[1, 2, 3, 4, 5].map((g) => <option key={g}>{g}</option>)}</select></label>
              </div>
              <label className="field">{t.q5}<input placeholder={t.q5ph} value={it.note || ''} onChange={(e) => set('note', e.target.value)} /></label>
            </div>
            <div className="row"><button className="btn" onClick={() => setStep(1)}>{t.back}</button><div className="grow" /><button className="btn primary lg" disabled={busy} onClick={build}>{t.create}</button></div>
          </>
        )}
        {err && <p className="error">{err}</p>}
      </main>
    </>
  );
}
