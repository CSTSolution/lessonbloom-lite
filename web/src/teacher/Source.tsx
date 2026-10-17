// Steps 1-2 of a lesson that is already made, read-only: the text (and file names) the lesson
// was built from, and the answers to the setup questions. Changing them would not change the
// slides already made, so instead the teacher can start a new lesson from the same text.
import { go, type Lesson } from '../api.ts';
import { useLang, useT, nOf } from '../i18n.ts';
import { T } from './dict.ts';

const S = {
  vi: {
    docTitle: 'Tài liệu đã dùng', docSub: 'Bài giảng này được soạn từ nội dung dưới đây.', qTitle: 'Câu hỏi đã trả lời', qSub: 'Các lựa chọn cô đã chọn khi tạo bài.',
    readOnly: 'Chỉ xem: sửa ở đây sẽ không đổi được slide và bài tập đã tạo. Muốn sửa nội dung, cô sửa thẳng ở bước Slide hoặc Bài tập, hoặc tạo bài mới từ tài liệu này.',
    files: 'File đã tải lên', pasted: 'Dán trực tiếp (không có file)', words: (n: number) => `${n} chữ`, reuse: 'Tạo bài mới từ tài liệu này', none: 'Không có', made: 'Ngày tạo',
  },
  en: {
    docTitle: 'Document used', docSub: 'This lesson was made from the text below.', qTitle: 'Answers given', qSub: 'The choices made when the lesson was created.',
    readOnly: 'View only: changing these would not change the slides and exercises already made. To change the content, edit it in the Slides or Exercises step, or start a new lesson from this document.',
    files: 'Uploaded files', pasted: 'Pasted directly (no file)', words: (n: number) => nOf(n, 'word'), reuse: 'New lesson from this document', none: 'None', made: 'Created',
  },
};

export function SourceView({ l, step }: { l: Lesson; step: 'doc' | 'questions' }) {
  const s = useT(S), t = useT(T), lang = useLang();
  const it = l.intake;
  const words = l.source.trim() ? l.source.trim().split(/\s+/).length : 0;
  const reuse = () => {
    try { sessionStorage.setItem('lb-draft', JSON.stringify({ subject: it.subject, source: l.source })); } catch { /* private mode */ }
    go('/new');
  };
  const row = (k: string, v: React.ReactNode) => <div className="ro-row"><dt>{k}</dt><dd>{v}</dd></div>;
  return (
    <main className="page narrow stack" style={{ gap: 16 }}>
      <div><h1>{step === 'doc' ? s.docTitle : s.qTitle}</h1><p className="muted" style={{ margin: 0 }}>{step === 'doc' ? s.docSub : s.qSub}</p></div>
      <p className="ro-note" role="note">🔒 {s.readOnly}</p>
      {step === 'doc' ? (
        <div className="card stack" style={{ gap: 12 }}>
          <dl className="ro">
            {row(t.subject, it.subject === 'english' ? t.english : t.math)}
            {row(s.files, l.files?.length ? l.files.join(', ') : s.pasted)}
            {row(s.made, new Date(l.createdAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'long', timeStyle: 'short' }))}
          </dl>
          <div className="ro-text" tabIndex={0} aria-label={s.docTitle}>{l.source}</div>
          <span className="muted small">{s.words(words)}</span>
        </div>
      ) : (
        <div className="card">
          <dl className="ro">
            {row(t.q0, it.title)}
            {row(t.q1, it.objectives.filter((o) => o.trim()).map((o) => <div key={o}>{o}</div>))}
            {row(t.q2, `${it.minutes} ${t.min}`)}
            {row(t.q3, t[it.level])}
            {row(t.q4, it.outputs.map((o) => t.outputs[o]).join(', '))}
            {row(t.subject, it.subject === 'english' ? t.english : t.math)}
            {row(t.grade, it.grade)}
            {row(t.q5, it.note?.trim() || s.none)}
          </dl>
        </div>
      )}
      <div className="row"><button className="btn" onClick={reuse}>{s.reuse}</button><div className="grow" />
        <button className="btn primary" onClick={() => go(`/lesson/${l.id}/${step === 'doc' ? 'questions' : 'slides'}`)}>{t.next}</button></div>
    </main>
  );
}
