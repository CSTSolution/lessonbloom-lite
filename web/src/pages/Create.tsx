// Teacher step 1-2: paste the lesson, let Gemini pre-fill the setup, check it, build.
import { useState } from 'react';
import { api, go, type Intake } from '../api.ts';
import { useT } from '../i18n.ts';

const SAMPLES: Record<string, string> = {
  math2: `Toán lớp 2 – Phép cộng có nhớ trong phạm vi 100

Mục tiêu: Học sinh biết đặt tính và thực hiện phép cộng có nhớ hai số có hai chữ số trong phạm vi 100.

Cách làm: Đặt tính thẳng cột, hàng đơn vị thẳng hàng đơn vị, hàng chục thẳng hàng chục. Cộng từ phải sang trái. Cộng hàng đơn vị trước: nếu kết quả từ 10 trở lên thì viết chữ số hàng đơn vị và nhớ 1 sang hàng chục. Sau đó cộng hàng chục, nhớ cộng thêm 1.

Ví dụ: 36 + 27. Hàng đơn vị: 6 cộng 7 bằng 13, viết 3 nhớ 1. Hàng chục: 3 cộng 2 bằng 5, thêm 1 bằng 6, viết 6. Vậy 36 + 27 = 63.

Bài toán: Vườn nhà Nam có 28 cây cam và 15 cây bưởi. Hỏi vườn nhà Nam có tất cả bao nhiêu cây?`,
  eng3: `English Grade 3 – Unit: My favourite colour

Vocabulary: red, blue, green, yellow, pink, orange.
Sentence patterns:
- What colour is it? It's red.
- What's your favourite colour? My favourite colour is blue.

Example dialogue:
Mai: What colour is your pencil, Nam?
Nam: It's green.
Mai: What's your favourite colour?
Nam: My favourite colour is yellow. I like the sun!`,
};

export function Create() {
  const [t] = useT();
  const [source, setSource] = useState('');
  const [it, setIt] = useState<Intake | null>(null);
  const [busy, setBusy] = useState(''), [err, setErr] = useState('');

  const read = async () => {
    setBusy(t.reading); setErr('');
    try { setIt(await api.intake(source)); } catch (e) { setErr((e as Error).message); } finally { setBusy(''); }
  };
  const build = async () => {
    if (!it) return;
    setBusy(t.working); setErr('');
    try { const { id } = await api.create(source, it); go(`/lesson/${id}`); } catch (e) { setErr((e as Error).message); setBusy(''); }
  };
  const file = async (f?: File) => { if (f) { setSource(await f.text()); setIt(null); } };
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => setIt((p) => (p ? { ...p, [k]: v } : p));

  return (
    <div className="page narrow">
      <p className="tagline">{t.tagline}</p>

      <section className="card">
        <h2>{t.step1}</h2>
        <textarea value={source} placeholder={t.pastePh} rows={10} onChange={(e) => { setSource(e.target.value); setIt(null); }} />
        <div className="row">
          <label className="filebtn">.txt<input type="file" accept=".txt,text/plain" onChange={(e) => file(e.target.files?.[0])} /></label>
          <span className="muted">{t.sample}:</span>
          <button className="link" onClick={() => { setSource(SAMPLES.math2); setIt(null); }}>{t.math2}</button>
          <button className="link" onClick={() => { setSource(SAMPLES.eng3); setIt(null); }}>{t.eng3}</button>
          <span className="grow" />
          <button className="primary" disabled={!source.trim() || !!busy} onClick={read}>{busy === t.reading ? t.reading : t.suggest}</button>
        </div>
      </section>

      {it && (
        <section className="card">
          <h2>{t.step2}</h2>
          <p className="muted">✨ {t.aiFilled}</p>
          <div className="form">
            <label>{t.subject}
              <select value={it.subject} onChange={(e) => set('subject', e.target.value as Intake['subject'])}>
                <option value="math">{t.math}</option><option value="english">{t.english}</option>
              </select></label>
            <label>{t.grade}
              <select value={it.grade} onChange={(e) => set('grade', Number(e.target.value) as Intake['grade'])}>
                {[1, 2, 3, 4, 5].map((g) => <option key={g}>{g}</option>)}
              </select></label>
            <label className="wide">{t.title}<input value={it.title} onChange={(e) => set('title', e.target.value)} /></label>
            <label className="wide">{t.objectives}
              <textarea rows={3} value={it.objectives.join('\n')} onChange={(e) => set('objectives', e.target.value.split('\n'))} /></label>
            <label>{t.minutes}<input type="number" min={10} max={60} value={it.minutes} onChange={(e) => set('minutes', Number(e.target.value))} /></label>
            <label>{t.level}
              <select value={it.level} onChange={(e) => set('level', e.target.value as Intake['level'])}>
                <option value="basic">{t.basic}</option><option value="good">{t.good}</option><option value="advanced">{t.advanced}</option>
              </select></label>
          </div>
          <div className="row"><span className="grow" /><button className="primary big" disabled={!!busy} onClick={build}>{busy === t.working ? t.working : `${t.create} →`}</button></div>
        </section>
      )}
      {err && <p className="error">{t.error}: {err}</p>}
    </div>
  );
}
