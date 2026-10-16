// Demo workspace for a new visitor (each browser gets its own, isolated): "Cô Hạnh", classes
// 2A/2B/2C with invented first names, one ready-made lesson written by the team (not copied
// from a textbook) and two practice sessions of invented answers, so the learning summary
// shows Đã vững / Đang luyện / Lỗi lặp lại on first open. No real pupil data, ever.
import { randomBytes } from 'node:crypto';
import type { Store } from './store.ts';
import type { Assignment, Attempt, ClassRoom, Exercise, Lesson, Pupil, Teacher } from './types.ts';
import { DEFAULT_CRITERIA } from './types.ts';

export const NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khôi', 'Linh', 'Minh', 'Nam', 'Phương', 'Quân', 'Thảo'];
export const id = (n = 10) => randomBytes(n).toString('base64url').replace(/[-_]/g, 'x').slice(0, n);
const code = () => Array.from(randomBytes(4)).map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

export const SAMPLE_SOURCE = 'Bài mẫu do đội LessonBloom tự viết.';   // what demo lessons stored as their source before 16 Oct
// the text the demo lesson is shown as made from (same as the Maths sample on the Create page)
export const SAMPLE_TEXT = `Toán lớp 2 – Phép cộng có nhớ trong phạm vi 100

Mục tiêu: Học sinh biết đặt tính thẳng cột và thực hiện phép cộng có nhớ hai số có hai chữ số trong phạm vi 100.

Cách làm: Đặt tính thẳng cột, hàng đơn vị thẳng hàng đơn vị, hàng chục thẳng hàng chục. Cộng từ phải sang trái. Cộng hàng đơn vị trước: nếu kết quả từ 10 trở lên thì viết chữ số hàng đơn vị và nhớ 1 sang hàng chục. Sau đó cộng hàng chục, nhớ cộng thêm 1.

Ví dụ: 36 + 27. Hàng đơn vị: 6 cộng 7 bằng 13, viết 3 nhớ 1. Hàng chục: 3 cộng 2 bằng 5, thêm 1 bằng 6, viết 6. Vậy 36 + 27 = 63.

Luyện tập: 48 + 25; 19 + 36; 57 + 28.

Bài toán: Vườn nhà Nam có 28 cây cam và 15 cây bưởi. Hỏi vườn nhà Nam có tất cả bao nhiêu cây?

Lưu ý: Nhiều bạn quên cộng thêm số nhớ ở hàng chục. Hãy viết số 1 nhỏ phía trên hàng chục để nhớ.`;
// Demo data, including workspaces seeded before the sample flag existed (same source text, classes 2A/2B/2C given that lesson)
export function sampleOf(classes: ClassRoom[], lessons: Lesson[], assigns: Assignment[]) {
  // a copy of the sample lesson has sample: false, so only unflagged lessons fall back to the source text
  const ls = lessons.filter((l) => l.sample || (l.sample === undefined && l.source === SAMPLE_SOURCE)), lids = new Set(ls.map((l) => l.id));
  const ks = classes.filter((k) => k.sample || (['2A', '2B', '2C'].includes(k.name) && assigns.some((a) => a.classId === k.id && lids.has(a.lessonId))));
  return { classes: ks, lessons: ls };
}

const CARRY = 'Quên nhớ 1 sang hàng chục', COLUMN = 'Đặt tính sai cột';

export function sampleLesson(teacherId: string): Lesson {
  const mcq = (n: number, level: Exercise['level'], a: number, b: number, skill = 'carry_1'): Exercise =>
    ({ id: `ex${String(n).padStart(2, '0')}`, type: 'math_mcq', level, skill, prompt: `${a} + ${b} = ?`, expr: `${a} + ${b}`,
      options: [a + b - 10, a + b, Number(`${Math.floor((a + b) / 10) - 1}${(a % 10) + (b % 10)}`), a + b - 1].map(String).filter((v, i, x) => x.indexOf(v) === i), answer: String(a + b),
      explain: `${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}, viết ${((a % 10) + (b % 10)) % 10} nhớ 1; ${Math.floor(a / 10)} + ${Math.floor(b / 10)} + 1 = ${Math.floor(a / 10) + Math.floor(b / 10) + 1}.` });
  const ex: Exercise[] = [
    mcq(1, 'basic', 36, 27), mcq(2, 'basic', 48, 25),
    { id: 'ex03', type: 'math_fill', level: 'basic', skill: 'carry_1', prompt: 'Điền số vào ô trống', equation: '19 + 36 = ?', answer: '55', explain: '9 + 6 = 15, viết 5 nhớ 1; 1 + 3 + 1 = 5.' },
    { id: 'ex04', type: 'math_truefalse', level: 'basic', skill: 'no_carry', prompt: 'Đúng hay sai?', statement: '42 + 35 = 77', answer: 'true', explain: '2 + 5 = 7; 4 + 3 = 7. Không cần nhớ.' },
    mcq(5, 'good', 57, 28), mcq(6, 'good', 29, 46),
    { id: 'ex07', type: 'math_fill', level: 'good', skill: 'column', prompt: 'Điền số vào ô trống', equation: '? + 18 = 45', answer: '27', explain: '45 - 18 = 27.' },
    { id: 'ex08', type: 'math_word', level: 'good', skill: 'word_1step', prompt: 'Lan có 19 bông hoa, Mai có 36 bông hoa. Cả hai bạn có bao nhiêu bông hoa?', expr: '19 + 36', answer: '55', unit: 'bông hoa', explain: '19 + 36 = 55 bông hoa.' },
    mcq(9, 'advanced', 38, 47), { id: 'ex10', type: 'math_truefalse', level: 'advanced', skill: 'carry_1', prompt: 'Đúng hay sai?', statement: '68 + 25 = 83', answer: 'false', explain: '8 + 5 = 13, viết 3 nhớ 1; 6 + 2 + 1 = 9. Vậy 68 + 25 = 93.' },
    { id: 'ex11', type: 'math_word', level: 'advanced', skill: 'word_1step', prompt: 'Vườn nhà Nam có 28 cây cam và 15 cây bưởi. Vườn có tất cả bao nhiêu cây?', expr: '28 + 15', answer: '43', unit: 'cây', explain: '28 + 15 = 43 cây.' },
    { id: 'ex12', type: 'math_fill', level: 'advanced', skill: 'column', prompt: 'Điền số vào ô trống', equation: '56 + ? = 91', answer: '35', explain: '91 - 56 = 35.' },
  ];
  const slide = (n: number, kind: Lesson['slides'][0]['kind'], heading: string, bullets: string[], notes: string, narration: string, example?: string) =>
    ({ id: `sl${String(n).padStart(2, '0')}`, kind, heading, bullets, example, notes, narration, imagePrompt: 'children counting mangoes', source: 'Phép cộng có nhớ trong phạm vi 100 (tài liệu mẫu của đội).' });
  return {
    id: id(), teacherId, createdAt: new Date(Date.now() - 3 * 864e5).toISOString(), status: 'ready', progress: [], sample: true, source: SAMPLE_TEXT,
    intake: { subject: 'math', grade: 2, title: 'Phép cộng có nhớ trong phạm vi 100', objectives: ['Học sinh biết đặt tính thẳng cột và thực hiện phép cộng có nhớ trong phạm vi 100.'], minutes: 25, level: 'mixed', lang: 'vi', outputs: ['slides', 'video', 'exercises', 'flashcards'] },
    skills: [{ tag: 'carry_1', name: 'Nhớ 1 sang hàng chục' }, { tag: 'column', name: 'Đặt tính thẳng cột' }, { tag: 'no_carry', name: 'Cộng không nhớ' }, { tag: 'word_1step', name: 'Toán có lời văn một bước' }],
    slides: [
      slide(1, 'title', 'Phép cộng có nhớ trong phạm vi 100', ['Toán lớp 2'], 'Chào cả lớp, hôm nay mình học cộng có nhớ.', 'Chào các con! Hôm nay chúng ta học phép cộng có nhớ trong phạm vi 100.'),
      slide(2, 'warmup', 'Khởi động: đếm chục', ['10, 20, 30… 100', '1 chục = 10 đơn vị'], 'Cho cả lớp đếm theo chục.', 'Cùng đếm theo chục nào: mười, hai mươi, ba mươi… Mười đơn vị là một chục.'),
      slide(3, 'concept', 'Đặt tính thẳng cột', ['Đơn vị thẳng đơn vị', 'Chục thẳng chục', 'Cộng từ phải sang trái'], 'Chỉ vào từng cột khi nói.', 'Khi đặt tính, hàng đơn vị thẳng hàng đơn vị, hàng chục thẳng hàng chục. Ta cộng từ phải sang trái.'),
      slide(4, 'example', 'Cùng tính 36 + 27 nhé!', ['6 + 7 = 13, viết 3, nhớ 1', '3 + 2 = 5, thêm 1 bằng 6', 'Vậy 36 + 27 = 63'], 'Hỏi: ai nhắc lại giúp cô số nhớ là mấy?', 'Các con nhìn hàng đơn vị: 6 cộng 7 được 13. Mình viết 3, còn 1 chục thì nhớ sang hàng chục nhé.', '36 + 27 = 63'),
      slide(5, 'concept', 'Vì sao phải nhớ 1?', ['13 đơn vị = 1 chục và 3 đơn vị', 'Chục đó phải sang hàng chục'], 'Dùng que tính bó 10 que.', 'Mười ba đơn vị là một chục và ba đơn vị. Một chục đó phải chuyển sang hàng chục.'),
      slide(6, 'example', 'Thử 48 + 25', ['8 + 5 = 13, viết 3, nhớ 1', '4 + 2 + 1 = 7'], 'Gọi 1 em lên bảng.', 'Bây giờ thử 48 cộng 25. 8 cộng 5 bằng 13, viết 3 nhớ 1. 4 cộng 2 là 6, thêm 1 là 7.', '48 + 25 = 73'),
      slide(7, 'practice', 'Con thử nhé: 19 + 36', ['Đặt tính thẳng cột', 'Nhớ số 1 nhỏ trên hàng chục'], 'Cho cả lớp làm vào bảng con.', 'Đến lượt các con: 19 cộng 36 bằng bao nhiêu? Nhớ viết số 1 nhỏ để không quên nhé.'),
      slide(8, 'summary', 'Ghi nhớ', ['Đặt tính thẳng cột', 'Cộng từ phải sang trái', 'Quá 10 thì nhớ 1 sang hàng chục'], 'Tóm tắt, chuyển sang bài luyện tập.', 'Hôm nay các con đã học: đặt tính thẳng cột, cộng từ phải sang trái, và nhớ 1 sang hàng chục. Giỏi lắm!'),
    ],
    exercises: ex,
    flashcards: [['36 + 27', '63'], ['48 + 25', '73'], ['19 + 36', '55'], ['57 + 28', '85'], ['29 + 46', '75'], ['38 + 47', '85']].map(([front, back], i) => ({ id: `fc0${i + 1}`, front, back, example: 'Quá 10 thì nhớ 1 sang hàng chục' })),
    pairs: [['36 + 27', '63'], ['48 + 25', '73'], ['19 + 36', '55'], ['57 + 28', '85']].map(([a, b], i) => ({ id: `mp${i + 1}`, a, b })),
    checks: [{ exercise: 'ex10', attempts: 1, issues: ['fixed by code: answer true but "68 + 25 = 83" is false'] }],
  };
}

// A registered account starts empty; the home page's getting-started guide takes it from there
export async function newTeacher(store: Store, teacherId: string, name: string, email?: string): Promise<Teacher> {
  const t: Teacher = { id: teacherId, name, subject: 'math', criteria: { ...DEFAULT_CRITERIA }, createdAt: new Date().toISOString(), email, account: true };
  await store.put('teachers', t);
  return t;
}

export async function seedTeacher(store: Store, teacherId: string, name = 'Cô Hạnh'): Promise<Teacher> {
  const t: Teacher = { id: teacherId, name, subject: 'math', criteria: { ...DEFAULT_CRITERIA }, createdAt: new Date().toISOString() };
  await store.put('teachers', t);
  const lesson = sampleLesson(teacherId);
  await store.put('lessons', lesson);
  // who struggles with what, per class (invented): 2A carries, 2B columns, 2C fine
  const plan: Record<string, { carry: string[]; column: string[] }> = {
    '2A': { carry: ['An', 'Dũng', 'Khôi', 'Minh', 'Nam', 'Thảo'], column: [] },
    '2B': { carry: ['Hà'], column: ['Bình', 'Linh', 'Quân', 'Phương'] },
    '2C': { carry: [], column: [] },
  };
  const day = 864e5, now = Date.now();
  for (const cname of ['2A', '2B', '2C']) {
    const c: ClassRoom = { id: id(), teacherId, name: cname, joinCode: `${cname}-${code()}`, subject: 'math', sample: true };
    await store.put('classes', c);
    const pupils: Pupil[] = NAMES.map((n, i) => ({ id: id(), classId: c.id, displayName: n, joinedAt: i < 11 || cname !== '2A' ? new Date(now - 2 * day).toISOString() : undefined }));
    await store.putMany('pupils', pupils);
    const a: Assignment = { id: id(), teacherId, lessonId: lesson.id, classId: c.id, dueAt: new Date(now + 4 * day).toISOString().slice(0, 10), allowRetry: true, autoSuggest: true, createdAt: new Date(now - 3 * day).toISOString() };
    await store.put('assignments', a);
    // three practice sessions; each pupil answers 2 items per skill per session (6 per skill in all)
    let k = 0;
    const atts: Attempt[] = [];
    const wrongOf = (ans: string) => (/^\d+$/.test(ans) ? String(Math.max(0, Number(ans) - 10)) : ans === 'true' ? 'false' : 'true');
    const bySkill = new Map<string, Exercise[]>();
    for (const e of lesson.exercises) bySkill.set(e.skill, [...(bySkill.get(e.skill) || []), e]);
    for (const [si, session] of ['s1', 's2', 's3'].entries()) {
      for (const p of pupils.slice(0, cname === '2A' ? 10 : 12)) {
        for (const [skill, items] of bySkill) {
          for (let j = 0; j < 2; j++) {
            const e = items[(si * 2 + j) % items.length];
            const carryTrouble = plan[cname].carry.includes(p.displayName) && skill === 'carry_1';
            const columnTrouble = plan[cname].column.includes(p.displayName) && skill === 'column';
            k++;
            const wrong = carryTrouble ? k % 3 !== 0 : columnTrouble ? k % 2 === 0 : (cname !== '2C' && skill === 'word_1step' && k % 3 === 0) || k % 17 === 0;
            const ans = (e as { answer: string }).answer;
            atts.push({ id: id(12), assignmentId: a.id, classId: c.id, pupilId: p.id, lessonId: lesson.id, exerciseId: e.id, skill,
              answer: wrong ? wrongOf(ans) : ans, correct: !wrong, errorType: wrong ? (carryTrouble ? CARRY : columnTrouble ? COLUMN : 'Nhầm phép tính') : undefined,
              at: new Date(now - (3 - si) * day + k * 1000).toISOString(), session });
          }
        }
      }
    }
    await store.putMany('attempts', atts);
  }
  return t;
}
