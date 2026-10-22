// Screens 05-06 · steps 1-2: upload or paste the document, then check the questions Gemini
// pre-filled (goal, length, class level, outputs, an optional note), then build.
import { useEffect, useState } from 'react';
import { go, goRegister, teacherApi, type Intake, type Teacher, type Usage } from '../api.ts';
import { useT } from '../i18n.ts';
import { T } from './dict.ts';
import { Stepper } from './LessonFlow.tsx';
import { Link } from './TeacherRoutes.tsx';
import { ErrorNote } from './ErrorNote.tsx';
import { GuideHint } from './Guide.tsx';

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

// photos are made smaller in the browser before upload (long side 1600 px, JPEG), enough for Gemini to read the page
async function shrink(f: File): Promise<{ data: string; type: string }> {
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height);
  return { data: cv.toDataURL('image/jpeg', 0.85).split(',')[1], type: 'image/jpeg' };
}
const isPhoto = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);

// the demo's daily limits, shown before they run out
const DM = {
  vi: { left: (l: number, _lm: number, c: number, cm: number) => `Bản dùng thử: hôm nay còn ${c}/${cm} lượt AI, đủ tạo ${l} bài mới (mỗi bài mới dùng 10 lượt). Tài khoản miễn phí có 30 lượt AI mỗi ngày.`,
    register: 'Đăng ký tài khoản miễn phí', registerSub: 'Bài trong bản dùng thử không chuyển sang tài khoản mới.' },
  en: { left: (l: number, _lm: number, c: number, cm: number) => `Demo: ${c}/${cm} AI credits left today, enough for ${l} new ${l === 1 ? 'lesson' : 'lessons'} (a new lesson uses 10). A free account has 30 AI credits a day.`,
    register: 'Register a free account', registerSub: 'Lessons made in the demo do not move to the new account.' },
};

const PH = {
  vi: { photos: (n: number, max: number) => `Ảnh đã dùng: ${n}/${max}`, reading: (n: number) => `AI đang đọc ${n} ảnh…`, check: 'AI đã chép chữ từ ảnh vào ô bên dưới. Cô đọc lại và sửa chỗ sai trước khi tiếp tục nhé.',
    tooMany: (max: number, left: number) => left > 0 ? `Mỗi bài dùng tối đa ${max} ảnh, nên LessonBloom chỉ đọc ${left} ảnh đầu cô chọn.` : `Bài này đã dùng đủ ${max} ảnh.`,
    cantRead: (n: string) => `Không mở được ảnh ${n}. Cô chụp lại bằng JPG hoặc PNG nhé (ảnh HEIC của iPhone: chọn từ ứng dụng Ảnh trên điện thoại).` },
  en: { photos: (n: number, max: number) => `Photos used: ${n}/${max}`, reading: (n: number) => `The AI is reading ${n === 1 ? '1 photo' : `${n} photos`}…`, check: 'The AI copied the text from the photos into the box below. Please read it and fix any mistakes before continuing.',
    tooMany: (max: number, left: number) => left > 0 ? `A lesson can use up to ${max} photos, so only the first ${left} you chose were read.` : `This lesson already uses ${max} photos.`,
    cantRead: (n: string) => `Could not open the photo ${n}. Please use JPG or PNG (for iPhone HEIC photos, pick them from the Photos app on the phone).` },
};

async function readFileText(f: File): Promise<string> {
  if (/\.docx$/i.test(f.name)) {
    // @ts-expect-error browser build has no types
    const mammoth = (await import('mammoth/mammoth.browser.js')).default;
    return (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value as string;
  }
  return f.text();
}

export function Create({ teacher }: { teacher?: Teacher }) {
  const t = useT(T), ph = useT(PH), dm = useT(DM);
  const [step, setStep] = useState<1 | 2>(1);
  // the draft (subject + text) survives a reload in this tab, e.g. the automatic one after a new version
  const draft = (() => { try { return JSON.parse(sessionStorage.getItem('lb-draft') || '{}') as { subject?: 'math' | 'english'; source?: string; files?: string[] }; } catch { return {}; } })();
  const [subject, setSubject] = useState<'math' | 'english'>(draft.subject || (teacher?.subject === 'english' ? 'english' : 'math'));
  const [source, setSource] = useState(draft.source || '');
  const [files, setFiles] = useState<string[]>(draft.files || []);   // shown later on the read-only Document step
  const [maxPhotos, setMaxPhotos] = useState(5), [photoNote, setPhotoNote] = useState(''), [reading, setReading] = useState(0);
  const [usage, setUsage] = useState<Usage | null>(null), [errCode, setErrCode] = useState('');
  useEffect(() => { teacherApi.usage().then((u) => { setUsage(u); if (u.photos) setMaxPhotos(u.photos); }).catch(() => {}); }, []);
  const photosUsed = files.filter((f) => f.startsWith('📷 ')).length;
  useEffect(() => { if (!source.trim() && files.length) setFiles([]); }, [source]);
  useEffect(() => { try { sessionStorage.setItem('lb-draft', JSON.stringify({ subject, source, files })); } catch { /* private mode */ } }, [subject, source, files]);
  const [it, setIt] = useState<Intake | null>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [over, setOver] = useState(false);
  const words = source.trim() ? source.trim().split(/\s+/).length : 0;

  const load = async (list?: FileList | File[] | null) => {
    const all = [...(list || [])];
    if (!all.length) return;
    setErr(''); setPhotoNote('');
    const photos = all.filter(isPhoto), doc = all.find((f) => !isPhoto(f));
    if (doc && !photos.length) { try { setSource((await readFileText(doc)).slice(0, 20000)); setFiles([doc.name]); } catch (e) { setErr((e as Error).message); } return; }
    const left = maxPhotos - photosUsed;
    if (photos.length > left) { setErr(ph.tooMany(maxPhotos, left)); if (left <= 0) return; }
    const use = photos.slice(0, Math.max(0, left));
    const images: { data: string; type: string }[] = [];
    for (const f of use) { try { images.push(await shrink(f)); } catch { setErr(ph.cantRead(f.name)); return; } }
    setReading(images.length);
    try {
      const { text } = await teacherApi.ocr(images);
      setSource((s) => (s.trim() ? `${s.trim()}\n\n${text}` : text).slice(0, 20000));
      setFiles((x) => [...x, ...use.map((f) => `📷 ${f.name}`)]);
      setPhotoNote(ph.check);
    } catch (e) { setErr((e as Error).message); } finally { setReading(0); }
  };
  const MIN_WORDS = 8;
  const toQuestions = async () => {
    if (words < MIN_WORDS) { setErr(words ? t.needMore(words, MIN_WORDS) : t.needSource); return; }   // say why, never a silently disabled button
    setBusy(true); setErr('');
    try { const r = await teacherApi.intake(source); setIt({ ...r, subject: r.subject || subject }); setStep(2); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const build = async () => {
    if (!it) return;
    const missing = [!it.title.trim() && t.q0, !it.objectives.some((o) => o.trim()) && t.q1].filter(Boolean).map((x) => String(x).replace(/^\d+\.\s*/, ''));
    if (missing.length) { setErr(t.required(missing)); return; }
    setBusy(true); setErr('');
    try { const { id } = await teacherApi.create(source, it, files); try { sessionStorage.removeItem('lb-draft'); } catch { /* ok */ } go(`/lesson/${id}/build`); } catch (e) { setErr((e as Error).message); setErrCode(String((e as { code?: string }).code || '')); setBusy(false); }
  };
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => setIt((p) => (p ? { ...p, [k]: v } : p));

  return (
    <>
      <Stepper current={step - 1} />
      <main className="page narrow stack" style={{ gap: 18 }}>
        <div className="row"><div className="grow" /><Link to="/" className="btn ghost">{t.exit}</Link></div>
        {step === 1 && <GuideHint step="lesson" />}
        {usage?.plan === 'demo' && usage.lessonsMax != null && (
          <div className="note row" style={{ justifyContent: 'space-between' }}>
            <span className="grow">{dm.left(Math.max(0, Math.min(usage.lessonsMax - (usage.lessonsToday || 0), Math.floor(((usage.limit || 0) - usage.usedToday) / (usage.costs.lesson || 10)))), usage.lessonsMax, Math.max(0, (usage.limit || 0) - usage.usedToday), usage.limit || 0)}</span>
            <button className="btn sm" onClick={goRegister}>{dm.register}</button>
          </div>
        )}
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
              onDrop={(e) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files); }}
              style={{ border: `2px dashed ${over ? 'var(--blue)' : 'var(--line-2)'}`, borderRadius: 14, padding: 28, textAlign: 'center', background: over ? 'var(--blue-soft)' : '#fff', cursor: 'pointer' }}>
              <div style={{ fontSize: 26, color: 'var(--blue)' }}>⤒</div>
              <strong>{t.drop}</strong>
              <div className="muted small">{t.formats}</div>
              <span className="btn sm" style={{ marginTop: 10, borderColor: 'var(--blue)', color: 'var(--blue)' }}>{t.choose}</span>
              <input type="file" multiple accept=".txt,.docx,text/plain,image/*" className="sr" onChange={(e) => { load(e.target.files); e.target.value = ''; }} />
            </label>
            <div className="row small" style={{ marginTop: -8 }}>
              <span className="muted">{ph.photos(photosUsed, maxPhotos)}</span>
              {files.length > 0 && <span className="muted">· {files.join(', ')}</span>}
              {reading > 0 && <span role="status" style={{ color: 'var(--blue)' }}>⏳ {ph.reading(reading)}</span>}
            </div>
            {photoNote && <p className="ok-note" role="status" style={{ margin: 0 }}>✓ {photoNote}</p>}
            <label className="field">{t.paste}
              <textarea rows={10} value={source} onChange={(e) => setSource(e.target.value)} />
            </label>
            <div className="row small">
              <span className="muted">{t.useSample}</span>
              <button className="btn ghost sm" onClick={() => { setSubject('math'); setSource(SAMPLES.math); setFiles([]); }}>{t.sampleMath}</button>
              <button className="btn ghost sm" onClick={() => { setSubject('english'); setSource(SAMPLES.english); setFiles([]); }}>{t.sampleEng}</button>
            </div>
            <div className="row">
              <span className={`small grow ${words > 0 && words < MIN_WORDS ? '' : 'muted'}`} style={words > 0 && words < MIN_WORDS ? { color: 'var(--amber)' } : undefined}>
                {words > 0 && (words < MIN_WORDS ? t.needMore(words, MIN_WORDS) : t.received(words))}</span>
              <button className="btn primary lg" disabled={busy || reading > 0} onClick={toQuestions}>{busy ? t.reading : t.next}</button>
            </div>
          </>
        )}
        {step === 2 && it && (
          <>
            <div><h1>{t.qTitle}</h1><p className="muted">{t.qSub}</p></div>
            <div className="card stack" style={{ gap: 18 }}>
              <label className="field"><span>{t.q0} <span className="req" aria-hidden="true">*</span></span><input required aria-invalid={!it.title.trim()} value={it.title} onChange={(e) => set('title', e.target.value)} /></label>
              <label className="field"><span>{t.q1} <span className="req" aria-hidden="true">*</span> <span className="chip blue small">{t.aiTag}</span></span>
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
        <ErrorNote text={err} />
        {err && usage?.plan === 'demo' && (errCode === 'demoLessons' || errCode === 'credits') && <div className="row"><button className="btn primary" onClick={goRegister}>{dm.register}</button><span className="muted small">{dm.registerSub}</span></div>}
      </main>
    </>
  );
}
