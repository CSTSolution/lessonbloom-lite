// Getting-started guide for a new account (accounts start empty; only the demo has sample data).
// The home page shows five steps that tick themselves off from the teacher's own data
// (GET /api/t/start). "Làm ngay" opens the right screen and remembers the step in this tab, so
// that screen shows a hint above the control to use and highlights it.
import { useEffect, useState } from 'react';
import { go, type StartState } from '../api.ts';
import { useT } from '../i18n.ts';

export type Step = 'class' | 'lesson' | 'assign' | 'share' | 'insights';
const ORDER: Step[] = ['class', 'lesson', 'assign', 'share', 'insights'];

const G = {
  vi: {
    title: 'Bắt đầu với LessonBloom', sub: 'Năm bước để có bài giảng đầu tiên trên điện thoại học sinh.', of: (a: number, b: number) => `${a}/${b} bước`,
    go: 'Làm ngay', open: 'Mở', hide: 'Ẩn hướng dẫn', show: 'Xem hướng dẫn bắt đầu', doneAll: 'Cô đã đi hết các bước. Chúc cô dạy vui!',
    needLesson: 'Cần một bài giảng trước',
    steps: {
      class: ['Tạo lớp học', 'Đặt tên lớp, chọn môn và dán danh sách tên học sinh (mỗi dòng một tên). Học sinh không cần tài khoản.'],
      lesson: ['Tạo bài giảng đầu tiên', 'Dán giáo án hoặc chọn bài mẫu. AI soạn slide, video và bài tập trong khoảng 1–2 phút.'],
      assign: ['Giao bài cho lớp', 'Ở bước 6 “Giao bài” của bài giảng: chọn lớp, hạn nộp, rồi bấm Giao bài.'],
      share: ['Mời học sinh vào học', 'Gửi đường link hoặc chiếu mã QR/mã lớp. Học sinh mở trang học, nhập mã và chạm vào tên mình.'],
      insights: ['Xem tóm tắt học tập', 'Khi học sinh đã làm bài: dạng nào đã vững, dạng nào lỗi lặp lại, và gợi ý nhận xét.'],
    } as Record<Step, [string, string]>,
    hint: {
      class: 'Đặt tên lớp (ví dụ 2A), chọn môn, dán tên học sinh mỗi dòng một tên, rồi bấm Lưu.',
      lesson: 'Dán giáo án vào ô dưới, kéo thả file .docx, hoặc bấm một bài mẫu; rồi bấm Tiếp tục.',
      assign: 'Chọn lớp, kiểm tra hạn nộp, rồi bấm Giao bài. Đường link, mã QR và mã lớp hiện ngay bên trên.',
      share: 'Mã lớp và đường link ở ô xanh bên dưới: bấm Sao chép để gửi cho phụ huynh, hoặc In mã lớp. Học sinh mở link (hoặc nhập mã) rồi chạm vào tên mình.',
      insights: 'Chọn bài và lớp. Nhãn Đã vững / Đang luyện / Lỗi lặp lại tính theo tiêu chí của cô; bấm “Soạn gợi ý nhận xét” để có lời nhận xét.',
    } as Record<Step, string>,
    stepN: (n: number) => `Bước ${n}/5`, close: 'Đóng',
  },
  en: {
    title: 'Getting started', sub: 'Five steps to your first lesson on your pupils’ phones.', of: (a: number, b: number) => `${a} of ${b} steps`,
    go: 'Do it now', open: 'Open', hide: 'Hide guide', show: 'Show the getting-started guide', doneAll: 'You have done every step. Enjoy teaching!',
    needLesson: 'Needs a lesson first',
    steps: {
      class: ['Create a class', 'Name the class, pick the subject and paste the pupils’ names (one per line). Pupils need no account.'],
      lesson: ['Create your first lesson', 'Paste your lesson notes or pick a sample. AI writes slides, a video and exercises in about 1–2 minutes.'],
      assign: ['Assign it to a class', 'In the lesson’s step 6 “Assign”: pick the class and due date, then press Assign.'],
      share: ['Invite your pupils', 'Send the link or show the QR / class code. Pupils open the learning page, type the code and tap their name.'],
      insights: ['Check the learning summary', 'Once pupils have practised: which skills are mastered, which mistakes repeat, and draft comments.'],
    } as Record<Step, [string, string]>,
    hint: {
      class: 'Name the class (e.g. 2A), pick the subject, paste the pupils’ names one per line, then press Save.',
      lesson: 'Paste your lesson notes below, drop a .docx file, or pick a sample; then press Continue.',
      assign: 'Pick the class, check the due date, then press Assign. The link, QR code and class code are just above.',
      share: 'The class code and link are in the blue box below: press Copy to send it to parents, or print the class code. Pupils open the link (or type the code) and tap their name.',
      insights: 'Pick the lesson and class. Mastered / Practising / Repeated mistake follow your criteria; press “Draft comments” for comment drafts.',
    } as Record<Step, string>,
    stepN: (n: number) => `Step ${n} of 5`, close: 'Close',
  },
};

const KEY = 'lb-guide';
const read = (k: string, store: Storage | undefined) => { try { return store?.getItem(k) || ''; } catch { return ''; } };
const write = (k: string, v: string, store: Storage | undefined) => { try { if (v) store?.setItem(k, v); else store?.removeItem(k); } catch { /* private mode */ } };
const ss = () => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage);
const ls = () => (typeof localStorage === 'undefined' ? undefined : localStorage);

export const activeStep = () => read(KEY, ss()) as Step | '';
export const endGuideStep = () => write(KEY, '', ss());

const isDone = (s: StartState, k: Step) => ({ class: s.classes > 0, lesson: s.lessons > 0, assign: s.assigned > 0, share: s.joined > 0, insights: s.practised }[k]);

export function GuideCard({ s, teacherId }: { s: StartState; teacherId: string }) {
  const t = useT(G);
  const hideKey = `lb-guide-hidden-${teacherId}`;
  const [hidden, setHidden] = useState(() => read(hideKey, ls()) === '1');
  const done = ORDER.filter((k) => isDone(s, k)).length;
  const next = ORDER.find((k) => !isDone(s, k));
  useEffect(() => { const a = activeStep(); if (a && isDone(s, a)) endGuideStep(); }, [s]);
  if (hidden) return <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { write(hideKey, '', ls()); setHidden(false); }}>{t.show}</button>;

  const target = (k: Step) => ({ class: '/classes?add=1', lesson: '/new', assign: s.readyLessonId ? `/lesson/${s.readyLessonId}/assign` : '', share: '/classes', insights: '/insights' }[k]);
  const start = (k: Step) => { const to = target(k); if (!to) return; write(KEY, k, ss()); go(to); };
  if (!next) return (   // all done: one quiet line
    <div className="ok-note row" style={{ justifyContent: 'space-between' }}><span>✓ {t.doneAll}</span>
      <button className="link-btn" onClick={() => { write(hideKey, '1', ls()); setHidden(true); }}>{t.hide}</button></div>
  );
  return (
    <section className="card guide" aria-labelledby="guide-title">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow"><h2 id="guide-title">{t.title}</h2><p className="muted" style={{ margin: '4px 0 0' }}>{next ? t.sub : t.doneAll}</p></div>
        <span className="chip blue">{t.of(done, ORDER.length)}</span>
      </div>
      <div className="bar" aria-hidden="true"><span style={{ width: `${(100 * done) / ORDER.length}%` }} /></div>
      <ol className="guide-steps">
        {ORDER.map((k, i) => {
          const d = isDone(s, k), cur = k === next, to = target(k);
          return (
            <li key={k} className={d ? 'done' : cur ? 'cur' : ''}>
              <span className="guide-n" aria-hidden="true">{d ? '✓' : i + 1}</span>
              <div className="grow"><strong>{t.steps[k][0]}</strong><p>{t.steps[k][1]}</p></div>
              {!d && (to
                ? <button className={`btn ${cur ? 'primary' : ''} sm`} onClick={() => start(k)}>{cur ? t.go : t.open}</button>
                : <span className="muted small">{t.needLesson}</span>)}
            </li>
          );
        })}
      </ol>
      <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { write(hideKey, '1', ls()); setHidden(true); }}>{t.hide}</button>
    </section>
  );
}

// The hint on the screen a guide step opened: says what to do there; the step's control gets `guide-pulse`
export function GuideHint({ step }: { step: Step }) {
  const t = useT(G);
  const [on, setOn] = useState(() => activeStep() === step);
  if (!on) return null;
  return (
    <div className="guide-hint" role="note">
      <span className="chip blue">{t.stepN(ORDER.indexOf(step) + 1)}</span>
      <span className="grow">{t.hint[step]}</span>
      <button className="link-btn" onClick={() => { endGuideStep(); setOn(false); }}>{t.close}</button>
    </div>
  );
}
export const pulse = (step: Step) => (activeStep() === step ? ' guide-pulse' : '');
