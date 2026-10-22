// Demo workspace for a new visitor (each browser gets its own, isolated): "Cô Hạnh", classes
// 2A/2B/2C with invented first names, one ready-made lesson written by the team (not copied
// from a textbook) and two practice sessions of invented answers, so the learning summary
// shows Đã vững / Đang luyện / Lỗi lặp lại on first open. No real pupil data, ever.
import { randomBytes } from 'node:crypto';
import type { Store } from './store.ts';
import type { Assignment, Attempt, ClassRoom, Exercise, Lesson, Pupil, SelfCheck, Teacher, Visit } from './types.ts';
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
    { id: 'ex07', type: 'math_fill', level: 'good', skill: 'column', prompt: 'Đặt tính rồi tính', equation: '27 + 18 = ?', answer: '45', explain: 'Đặt 27 trên 18, đơn vị thẳng đơn vị: 7 + 8 = 15, viết 5 nhớ 1; 2 + 1 + 1 = 4. Vậy 27 + 18 = 45.' },
    { id: 'ex08', type: 'math_word', level: 'good', skill: 'word_1step', prompt: 'Lan có 19 bông hoa, Mai có 36 bông hoa. Cả hai bạn có bao nhiêu bông hoa?', expr: '19 + 36', answer: '55', unit: 'bông hoa', explain: '19 + 36 = 55 bông hoa.' },
    mcq(9, 'advanced', 38, 47), { id: 'ex10', type: 'math_truefalse', level: 'advanced', skill: 'carry_1', prompt: 'Đúng hay sai?', statement: '68 + 25 = 83', answer: 'false', explain: '8 + 5 = 13, viết 3 nhớ 1; 6 + 2 + 1 = 9. Vậy 68 + 25 = 93.' },
    { id: 'ex11', type: 'math_word', level: 'advanced', skill: 'word_1step', prompt: 'Vườn nhà Nam có 28 cây cam và 15 cây bưởi. Vườn có tất cả bao nhiêu cây?', expr: '28 + 15', answer: '43', unit: 'cây', explain: '28 + 15 = 43 cây.' },
    { id: 'ex12', type: 'math_fill', level: 'advanced', skill: 'column', prompt: 'Đặt tính rồi tính', equation: '56 + 35 = ?', answer: '91', explain: 'Đặt 56 trên 35, đơn vị thẳng đơn vị: 6 + 5 = 11, viết 1 nhớ 1; 5 + 3 + 1 = 9. Vậy 56 + 35 = 91.' },
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

// English Grade 3 sample, written by the team (not from a textbook): shown first when the demo opens in English
const COLOUR = 'Wrong colour word', ORDER = 'Words in the wrong order';
export function sampleLessonEn(teacherId: string): Lesson {
  const match = (n: number, level: Exercise['level'], pairs: [string, string][]): Exercise =>
    ({ id: `ex${String(n).padStart(2, '0')}`, type: 'eng_match', level, skill: 'colour_words', prompt: 'Match each colour word to its picture.', pairs: pairs.map(([word, emoji]) => ({ word, emoji })),
      explain: pairs.map(([w, e]) => `${w} = ${e}`).join(', ') + '.' } as Exercise);
  const listen = (n: number, level: Exercise['level'], say: string, options: string[], skill = 'colour_words'): Exercise =>
    ({ id: `ex${String(n).padStart(2, '0')}`, type: 'eng_listen', level, skill, prompt: 'Listen and choose the word you hear.', say, options, answer: say, explain: `You heard “${say}”.` } as Exercise);
  const gap = (n: number, level: Exercise['level'], skill: string, sentence: string, options: string[], answer: string, explain: string): Exercise =>
    ({ id: `ex${String(n).padStart(2, '0')}`, type: 'eng_fill', level, skill, prompt: 'Choose the missing word.', sentence, options, answer, explain } as Exercise);
  const order = (n: number, level: Exercise['level'], skill: string, answer: string, words: string[]): Exercise =>
    ({ id: `ex${String(n).padStart(2, '0')}`, type: 'eng_order', level, skill, prompt: 'Put the words in order.', words, answer, explain: `${answer}` } as Exercise);
  const ex: Exercise[] = [
    match(1, 'basic', [['red', '🔴'], ['blue', '🔵'], ['green', '🟢']]),
    listen(2, 'basic', 'yellow', ['yellow', 'orange', 'pink']),
    gap(3, 'basic', 'ask_colour', 'What colour is it? It’s ___. 🍎', ['red', 'blue', 'green'], 'red', 'The apple is red: It’s red.'),
    order(4, 'basic', 'ask_colour', 'What colour is it?', ['is', 'colour', 'it', 'What']),
    match(5, 'good', [['yellow', '🟡'], ['orange', '🟠'], ['pink', '🌸']]),
    gap(6, 'good', 'favourite', 'My favourite ___ is blue.', ['colour', 'colours', 'red'], 'colour', 'We say “my favourite colour”.'),
    gap(7, 'good', 'ask_colour', '___ colour is your bag?', ['What', 'Who', 'Where'], 'What', 'We ask about colours with “What colour…?”.'),
    order(8, 'good', 'favourite', 'My favourite colour is green.', ['green', 'colour', 'My', 'is', 'favourite']),
    listen(9, 'advanced', 'orange', ['orange', 'yellow', 'red']),
    gap(10, 'advanced', 'favourite', 'What’s your favourite colour? – ___ favourite colour is pink.', ['My', 'Your', 'I'], 'My', 'Answer about yourself with “My”.'),
    order(11, 'advanced', 'favourite', 'What is your favourite colour?', ['favourite', 'your', 'What', 'colour', 'is']),
    gap(12, 'advanced', 'ask_colour', 'What colour is the sun? It’s ___. ☀️', ['yellow', 'blue', 'pink'], 'yellow', 'The sun is yellow.'),
  ];
  const slide = (n: number, kind: Lesson['slides'][0]['kind'], heading: string, bullets: string[], notes: string, narration: string, example?: string) =>
    ({ id: `sl${String(n).padStart(2, '0')}`, kind, heading, bullets, example, notes, narration, imagePrompt: 'children with coloured pencils', source: 'My favourite colour (sample written by the team).' });
  return {
    id: id(), teacherId, createdAt: new Date(Date.now() - 2 * 864e5).toISOString(), status: 'ready', progress: [], sample: true, source: SAMPLE_TEXT_EN,
    intake: { subject: 'english', grade: 3, title: 'My favourite colour', objectives: ['Pupils can name six colours.', 'Pupils can ask and answer “What colour is it?” and talk about their favourite colour.'], minutes: 25, level: 'mixed', lang: 'en', outputs: ['slides', 'video', 'exercises', 'flashcards'] },
    skills: [{ tag: 'colour_words', name: 'Colour words' }, { tag: 'ask_colour', name: 'Asking “What colour is it?”' }, { tag: 'favourite', name: 'Talking about favourite colours' }],
    slides: [
      slide(1, 'title', 'My favourite colour', ['English · Grade 3'], 'Greet the class and show a box of crayons.', 'Hello, everyone! Today we are going to learn about colours.'),
      slide(2, 'warmup', 'Look around the classroom', ['What colours can you see?', 'Point and say!'], 'Let pupils point at things and say colours they know.', 'Look around the classroom. What colours can you see? Point and say!'),
      slide(3, 'concept', 'Six colours', ['red · blue · green', 'yellow · orange · pink'], 'Say each word; the class repeats twice.', 'Listen and repeat: red, blue, green, yellow, orange, pink.'),
      slide(4, 'example', 'What colour is it?', ['What colour is it?', 'It’s red.'], 'Hold up an apple, ask, and model the answer.', 'What colour is it? It’s red. Now you ask your friend.', 'What colour is it? – It’s red.'),
      slide(5, 'concept', 'My favourite colour', ['What’s your favourite colour?', 'My favourite colour is blue.'], 'Model the question, then answer about yourself.', 'What’s your favourite colour? My favourite colour is blue. What about you?'),
      slide(6, 'example', 'Mai and Nam', ['Mai: What’s your favourite colour?', 'Nam: My favourite colour is green.'], 'Read the dialogue in two groups.', 'Mai asks: What’s your favourite colour? Nam answers: My favourite colour is green.'),
      slide(7, 'practice', 'Ask your friend', ['Ask: What’s your favourite colour?', 'Answer: My favourite colour is…'], 'Pair work: two minutes, then swap.', 'Now ask your friend: What’s your favourite colour? Then answer: My favourite colour is…'),
      slide(8, 'summary', 'Today we learned', ['Six colour words', 'What colour is it? – It’s…', 'My favourite colour is…'], 'Review the three points; homework: name five colours at home.', 'Today we learned six colours, how to ask what colour something is, and how to talk about our favourite colour.'),
    ],
    exercises: ex,
    flashcards: [['red', '🔴', 'màu đỏ', 'It’s red.'], ['blue', '🔵', 'màu xanh dương', 'My bag is blue.'], ['green', '🟢', 'màu xanh lá', 'It’s green.'], ['yellow', '🟡', 'màu vàng', 'The sun is yellow.'], ['orange', '🟠', 'màu cam', 'It’s orange.'], ['pink', '🌸', 'màu hồng', 'My favourite colour is pink.']]
      .map(([front, emoji, back, example], i) => ({ id: `fc0${i + 1}`, front, emoji, back, example, say: front })),
    pairs: [['red', '🔴'], ['blue', '🔵'], ['green', '🟢'], ['yellow', '🟡']].map(([a, b], i) => ({ id: `mp${i + 1}`, a, b })),
    checks: [],
  };
}
export const SAMPLE_TEXT_EN = `English Grade 3 – Unit: My favourite colour

Aims: Pupils can name six colours (red, blue, green, yellow, orange, pink), ask and answer "What colour is it? – It's red." and talk about their favourite colour.

Vocabulary: red, blue, green, yellow, orange, pink, colour, favourite.

Structures:
- What colour is it? – It's red.
- What's your favourite colour? – My favourite colour is blue.

Dialogue:
Mai: What's your favourite colour, Nam?
Nam: My favourite colour is green.

Practice: pupils ask and answer in pairs about their favourite colour.`;

// The items a pupil gets in one practice round (basic and "good"), as the pupil app picks them
const practiceItems = (l: Lesson) => l.exercises.filter((e) => e.level === 'basic' || e.level === 'good');
// a plausible wrong answer for an item, in the form the pupil app sends
function wrongOf(e: Exercise): string {
  const a = (e as { answer?: string }).answer ?? '';
  switch (e.type) {
    case 'eng_match': { const emo = e.pairs.map((p) => p.emoji); emo.push(emo.shift()!); return JSON.stringify(Object.fromEntries(e.pairs.map((p, i) => [p.word, emo[i]]))); }
    case 'eng_order': return [...e.words].join(' ');
    case 'eng_fill': case 'eng_listen': return e.options.find((o) => o !== a) || a;
    default: return /^\d+$/.test(a) ? String(Math.max(0, Number(a) - 10)) : a === 'true' ? 'false' : 'true';   // maths: the forgotten carry
  }
}
const rightOf = (e: Exercise) => (e.type === 'eng_match' ? JSON.stringify(Object.fromEntries(e.pairs.map((p) => [p.word, p.emoji]))) : (e as { answer: string }).answer);

export async function seedTeacher(store: Store, teacherId: string, name?: string, lang: 'vi' | 'en' = 'vi'): Promise<Teacher> {
  const t: Teacher = { id: teacherId, name: name || (lang === 'en' ? 'Ms. Hanh' : 'Cô Hạnh'), subject: lang === 'en' ? 'both' : 'math', criteria: { ...DEFAULT_CRITERIA }, createdAt: new Date().toISOString() };
  await store.put('teachers', t);
  const maths = sampleLesson(teacherId), english = sampleLessonEn(teacherId);
  // the lesson in the visitor's language is the newest, so it opens first everywhere
  const first = lang === 'en' ? english : maths, second = lang === 'en' ? maths : english;
  second.createdAt = new Date(Date.now() - 3 * 864e5).toISOString(); first.createdAt = new Date(Date.now() - 2 * 864e5).toISOString();
  await store.putMany('lessons', [maths, english]);
  // who struggles with what, per class (invented): maths 2A carries, 2B columns; English 2A colour words, 2B word order; 2C fine
  const plan: Record<string, Record<string, string[]>> = {
    '2A': { carry_1: ['An', 'Dũng', 'Khôi', 'Minh', 'Nam', 'Thảo'], colour_words: ['Bình', 'Hà', 'Linh'] },
    '2B': { carry_1: ['Hà'], column: ['Bình', 'Linh', 'Quân', 'Phương'], favourite: ['An', 'Chi', 'Minh', 'Nam'] },
    '2C': {},
  };
  const errName: Record<string, string> = { carry_1: CARRY, column: COLUMN, word_1step: CARRY, no_carry: CARRY, colour_words: COLOUR, ask_colour: ORDER, favourite: ORDER };
  const day = 864e5, now = Date.now();
  for (const cname of ['2A', '2B', '2C']) {
    const c: ClassRoom = { id: id(), teacherId, name: cname, joinCode: `${cname}-${code()}`, subject: 'both', sample: true };
    await store.put('classes', c);
    const pupils: Pupil[] = NAMES.map((n, i) => ({ id: id(), classId: c.id, displayName: n, joinedAt: i < 11 || cname !== '2A' ? new Date(now - 2 * day).toISOString() : undefined }));
    await store.putMany('pupils', pupils);
    const active = pupils.slice(0, cname === '2A' ? 10 : 12);
    for (const [li, lesson] of [second, first].entries()) {
      const a: Assignment = { id: id(), teacherId, lessonId: lesson.id, classId: c.id, dueAt: new Date(now + 4 * day).toISOString().slice(0, 10), allowRetry: true, autoSuggest: true, createdAt: new Date(now - (3 - li) * day).toISOString() };
      await store.put('assignments', a);
      // three practice rounds of the pupil's own set (the same 8 items the pupil app shows); the last two
      // active pupils stopped part-way through their last round. A slip is followed by a second try.
      const items = practiceItems(lesson), atts: Attempt[] = [];
      let k = 0;
      for (const [si, session] of ['s1', 's2', 's3'].entries()) {
        for (const [pi, p] of active.entries()) {
          const upto = pi >= active.length - 2 && si === 2 ? Math.ceil(items.length / 2) : items.length;
          for (const e of items.slice(0, upto)) {
            k++;
            const trouble = (plan[cname][e.skill] || []).includes(p.displayName);
            const slip = trouble ? k % 3 !== 0 : (cname !== '2C' && e.skill === 'word_1step' && k % 5 === 0) || k % 17 === 0;
            const at = (n: number) => new Date(now - (3 - si) * day + k * 1000 + n).toISOString();
            if (slip) atts.push({ id: id(12), assignmentId: a.id, classId: c.id, pupilId: p.id, lessonId: lesson.id, exerciseId: e.id, skill: e.skill, answer: wrongOf(e), correct: false, errorType: errName[e.skill], at: at(0), session });
            if (!slip || k % 2) atts.push({ id: id(12), assignmentId: a.id, classId: c.id, pupilId: p.id, lessonId: lesson.id, exerciseId: e.id, skill: e.skill, answer: rightOf(e), correct: true, at: at(500), session });
          }
        }
      }
      await store.putMany('attempts', atts);
      // the parts each active pupil opened: everything for those who finished, video and exercises for the rest
      await store.putMany('visits', active.map((p, i): Visit => ({ id: `v-${a.id}-${p.id}`, assignmentId: a.id, pupilId: p.id,
        parts: i < active.length - 2 ? (i % 3 === 2 ? ['video', 'cards', 'practice'] : ['video', 'cards', 'practice', 'memory']) : ['video', 'practice'], at: new Date(now - day + i * 60000).toISOString() })));
      // the pupils who finished said how it felt; the last two are still practising
      await store.putMany('selfchecks', active.slice(0, -2).map((p, i): SelfCheck => ({ id: id(12), assignmentId: a.id, pupilId: p.id,
        mood: Object.values(plan[cname]).some((names) => names.includes(p.displayName)) ? 'hard' : (['easy', 'ok', 'easy'] as const)[i % 3], at: new Date(now - day + i * 60000).toISOString() })));
    }
  }
  return t;
}
