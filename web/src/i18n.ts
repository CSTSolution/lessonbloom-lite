// UI text in Vietnamese (for teachers and pupils) and English (for the judges and demo video).
import { useSyncExternalStore } from 'react';

const T = {
  vi: {
    tagline: 'Từ một trang giáo án đến bài giảng sinh động và phiếu bài tập trong 5 phút.',
    step1: '1. Dán nội dung bài học', step2: '2. Kiểm tra thông tin bài', step3: '3. AI soạn bài',
    pastePh: 'Dán nội dung bài Toán hoặc Tiếng Anh (lớp 1–5) vào đây, hoặc chọn tệp .txt…',
    sample: 'Dùng bài mẫu', math2: 'Toán lớp 2: Cộng có nhớ', eng3: 'Tiếng Anh lớp 3: Colours',
    suggest: 'AI đọc tài liệu', reading: 'AI đang đọc tài liệu…',
    subject: 'Môn', math: 'Toán', english: 'Tiếng Anh', grade: 'Lớp', title: 'Tên bài', objectives: 'Mục tiêu (mỗi dòng một ý)',
    minutes: 'Thời lượng (phút)', level: 'Mức độ lớp', basic: 'Cơ bản', good: 'Khá', advanced: 'Nâng cao', aiFilled: 'AI đã điền sẵn, cô chỉ cần sửa nếu cần.',
    create: 'Tạo bài giảng', working: 'AI đang soạn bài…', ready: 'Bài đã sẵn sàng',
    slides: 'Slide', exercises: 'Bài tập', share: 'Giao bài', report: 'Báo cáo',
    notes: 'Lời giảng cho cô', narration: 'Lời đọc trong video', edit: 'Sửa', save: 'Lưu', saved: 'Đã lưu',
    checked: 'AI đã tự kiểm tra', fixedBy: 'Đã sửa', answer: 'Đáp án', explain: 'Giải thích',
    shareBtn: 'Tạo link cho học sinh', shareHint: 'Học sinh mở link, không cần tài khoản.', copy: 'Chép link', copied: 'Đã chép!',
    pupils: 'học sinh đã làm', wrongMost: 'Câu nhiều em sai nhất', noSubs: 'Chưa có học sinh nào làm bài.',
    watch: 'Xem bài học', practice: 'Làm bài tập', chooseLevel: 'Chọn mức', check: 'Nộp bài', again: 'Làm lại',
    praiseGreat: ['Tuyệt vời!', 'Giỏi quá!', 'Xuất sắc!'], praiseGood: ['Làm tốt lắm!', 'Cố lên, sắp đúng hết rồi!'], tryAgain: 'Thử lại nhé, em làm được mà!',
    right: 'đúng', of: 'trên', prev: 'Trước', next: 'Tiếp', listen: 'Nghe', true: 'Đúng', false: 'Sai',
    matchHint: 'Chạm một từ rồi chạm hình đúng', orderHint: 'Chạm các từ theo thứ tự đúng', clear: 'Xóa', error: 'Có lỗi',
  },
  en: {
    tagline: 'From one page of lesson notes to a lively lesson and worksheet in 5 minutes.',
    step1: '1. Paste the lesson', step2: '2. Check the lesson details', step3: '3. AI builds the lesson',
    pastePh: 'Paste a Maths or English lesson (grades 1–5) here, or choose a .txt file…',
    sample: 'Use a sample', math2: 'Maths grade 2: Adding with carrying', eng3: 'English grade 3: Colours',
    suggest: 'Let AI read it', reading: 'AI is reading the document…',
    subject: 'Subject', math: 'Maths', english: 'English', grade: 'Grade', title: 'Lesson title', objectives: 'Objectives (one per line)',
    minutes: 'Length (minutes)', level: 'Class level', basic: 'Basic', good: 'Good', advanced: 'Advanced', aiFilled: 'AI pre-filled this; just correct anything that is off.',
    create: 'Build the lesson', working: 'AI is building the lesson…', ready: 'Lesson ready',
    slides: 'Slides', exercises: 'Exercises', share: 'Share', report: 'Report',
    notes: 'Teacher notes', narration: 'Video narration', edit: 'Edit', save: 'Save', saved: 'Saved',
    checked: 'AI self-checked', fixedBy: 'Fixed', answer: 'Answer', explain: 'Explanation',
    shareBtn: 'Create pupil link', shareHint: 'Pupils open the link; no account needed.', copy: 'Copy link', copied: 'Copied!',
    pupils: 'pupils took part', wrongMost: 'Most-missed questions', noSubs: 'No pupils have answered yet.',
    watch: 'Watch the lesson', practice: 'Practise', chooseLevel: 'Choose a level', check: 'Check my answers', again: 'Try again',
    praiseGreat: ['Amazing!', 'Brilliant!', 'Superstar!'], praiseGood: ['Well done!', 'Nearly all right, keep going!'], tryAgain: 'Have another go, you can do it!',
    right: 'right', of: 'of', prev: 'Back', next: 'Next', listen: 'Listen', true: 'True', false: 'False',
    matchHint: 'Tap a word, then tap its picture', orderHint: 'Tap the words in the right order', clear: 'Clear', error: 'Something went wrong',
  },
};
export type UiLang = keyof typeof T;
export type Strings = typeof T.vi;

let lang: UiLang = (() => { try { return (localStorage.getItem('lb-ui') as UiLang) || 'vi'; } catch { return 'vi'; } })();
const subs = new Set<() => void>();
export function setUiLang(l: UiLang) { lang = l; try { localStorage.setItem('lb-ui', l); } catch { /* private mode */ } subs.forEach((f) => f()); }
export function useT(): [Strings, UiLang] {
  const l = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => lang);
  return [T[l] as Strings, l];
}
