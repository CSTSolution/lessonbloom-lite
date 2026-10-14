// Offline stand-in for Gemini, deterministic so tests can assert on it. It reads the teacher's
// text, plants one wrong maths answer and one broken English item so the self-check loop really
// runs, rejects the first picture of slide 2 so the vision critic loop runs, and tags errors
// with simple rules (e.g. answer 10 short on a carry sum -> "forgot to carry 1").
import type { Exercise, Intake } from '../types.ts';
import { gradientPng, humWav } from './media.ts';
import type { AI, ImageRequest, SpeechRequest, TextRequest, VisionRequest } from './provider.ts';

const sentences = (t: string) => (t.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map((s) => s.trim()).filter(Boolean);
export const MOCK_CARRY_ERROR = 'Quên nhớ 1 sang hàng chục';

export class MockProvider implements AI {
  name = 'mock';
  calls: { task: string; key?: string }[] = [];
  constructor(private opts: { clean?: boolean } = {}) {}   // clean: no planted mistakes

  async json<T>(req: TextRequest): Promise<T> {
    this.calls.push({ task: req.task });
    const inp = req.input as any;
    switch (req.task) {
      case 'intake': {
        const english = /\b(the|is|my|name|colou?r|apple|cat|dog)\b/i.test(inp.source) && !/[ăâđêôơư]/i.test(inp.source.slice(0, 120));
        const grade = Number(/lớp\s*(\d)|grade\s*(\d)/i.exec(inp.source)?.slice(1).find(Boolean) || 2);
        const it: Intake = { subject: english ? 'english' : 'math', grade: grade as Intake['grade'], title: sentences(inp.source)[0].split(/[–-]/).pop()!.trim().slice(0, 60),
          objectives: ['Học sinh hiểu và vận dụng được nội dung chính của bài.'], minutes: 25, level: 'mixed', lang: english ? 'en' : 'vi', outputs: ['slides', 'video', 'exercises', 'flashcards'] };
        return it as T;
      }
      case 'lesson': {
        const s = sentences(inp.source), n = inp.count as number;
        const kinds = ['title', 'warmup', ...Array(n - 4).fill(0).map((_, i) => (i % 2 ? 'example' : 'concept')), 'practice', 'summary'];
        return { slides: kinds.map((kind, i) => ({ kind, heading: (s[i % s.length] || 'Bài học').split(/[,:]/)[0].slice(0, 40), bullets: [s[(i + 1) % s.length]?.slice(0, 50) || ''],
          example: kind === 'example' ? '36 + 27 = 63' : undefined, imagePrompt: 'two children counting mangoes in a school yard', notes: 'Các con nhìn hàng đơn vị trước nhé.',
          source: s[i % s.length] || '', narration: s[i % s.length] || 'Chúng ta cùng học nhé.' })) } as T;
      }
      case 'slide-edit': return { ...inp.slide, heading: inp.how === 'simpler' ? inp.slide.heading.split(' ').slice(0, 4).join(' ') : `${inp.slide.heading}!`, bullets: inp.slide.bullets.slice(0, 2) } as T;
      case 'exercises': {
        const math = inp.intake ? inp.intake.subject === 'math' : String(inp.redo?.[0]?.type).startsWith('math');
        const skills = math ? [{ tag: 'carry_1', name: 'Nhớ 1 sang hàng chục' }, { tag: 'word_1step', name: 'Toán có lời văn một bước' }]
          : [{ tag: 'colour_words', name: 'Từ chỉ màu sắc' }, { tag: 'sentence', name: 'Câu "What colour is it?"' }];
        if (inp.redo) return { skills, items: (inp.redo as Exercise[]).map((e) => (e.type === 'eng_fill' ? { ...e, answer: e.options[0] } : e)) } as T;
        const per = inp.perLevel as number, items: any[] = [];
        for (const level of ['basic', 'good', 'advanced']) for (let k = 0; k < per; k++) items.push(math ? this.mathItem(level, k) : this.engItem(level, k));
        if (!this.opts.clean) {
          if (math) items[0] = { ...items[0], answer: '53' };   // wrong: 36 + 27 = 63 (code fixes it)
          else items[1] = { ...items[1], answer: 'has' };       // not among the options (regenerated)
        }
        return { skills, items } as T;
      }
      case 'review': return { results: (inp.items as Exercise[]).map((e) => ({ id: e.id, ok: true, issues: [] })) } as T;
      case 'cards': {
        const math = inp.intake.subject === 'math';
        return (math
          ? { flashcards: [['36 + 27', '63'], ['48 + 35', '83'], ['19 + 36', '55'], ['57 + 28', '85']].map(([front, back]) => ({ front, back, example: 'Nhớ 1 sang hàng chục' })),
              pairs: [['36 + 27', '63'], ['3 × 4', '12'], ['48 + 35', '83'], ['19 + 36', '55']].map(([a, b]) => ({ a, b })) }
          : { flashcards: [['dog', '🐶', 'con chó'], ['cat', '🐱', 'con mèo'], ['red', '🔴', 'màu đỏ'], ['blue', '🔵', 'màu xanh dương']].map(([front, emoji, back]) => ({ front, emoji, back, example: `The ${front} is big.`, exampleVi: `${back} thì to.`, say: front })),
              pairs: [['cat', '🐱'], ['dog', '🐶'], ['red', '🔴'], ['sun', '☀️']].map(([a, b]) => ({ a, b })) }) as T;
      }
      case 'error': {
        const ex = inp.ex as Exercise, given = String(inp.given);
        const carry = ex.type.startsWith('math') && 'answer' in ex && Number(ex.answer) - Number(given) === 10;
        return (carry ? { errorType: MOCK_CARRY_ERROR, hint: 'Gần đúng rồi! Hàng đơn vị được 13, viết 3 và nhớ 1 sang hàng chục. Con cộng hàng chục rồi thêm 1 nữa nhé.' }
          : { errorType: ex.type.startsWith('math') ? 'Nhầm phép tính' : 'Nhầm nghĩa từ', hint: 'Chưa đúng rồi, con đọc lại đề và thử lần nữa nhé!' }) as T;
      }
      case 'comments': return { comments: (inp.rows as any[]).map((r) => ({ pupilId: r.pupilId, text: r.label === 'repeated' ? `Em ${r.name} hay ${String(r.error || 'nhầm').toLowerCase()}; cô và em cùng luyện thêm vài bài cùng dạng nhé.` : `Em ${r.name} đã làm chắc dạng ${r.skill}, có thể thử bài nâng cao.` })) } as T;
      default: throw new Error(`mock has no answer for ${req.task}`);
    }
  }

  private mathItem(level: string, k: number) {
    const a = 36 + k, b = 27 + (level === 'advanced' ? 10 : 0), t = ['math_mcq', 'math_fill', 'math_truefalse', 'math_word'][k % 4];
    const skill = t === 'math_word' ? 'word_1step' : 'carry_1';
    if (t === 'math_mcq') return { type: t, level, skill, prompt: `${a} + ${b} = ?`, expr: `${a} + ${b}`, options: [a + b - 10, a + b, a + b + 450, a + b - 1].map(String), answer: String(a + b), explain: 'Cộng hàng đơn vị, nhớ 1 sang hàng chục.' };
    if (t === 'math_fill') return { type: t, level, skill, prompt: 'Điền số vào ô trống', equation: `${a} + ${b} = ?`, answer: String(a + b), explain: `${a} + ${b} = ${a + b}` };
    if (t === 'math_truefalse') return { type: t, level, skill, prompt: 'Đúng hay sai?', statement: `${a} + ${b} = ${a + b - 10}`, answer: 'false', explain: `${a} + ${b} = ${a + b}` };
    return { type: t, level, skill, prompt: `Lan có ${a} quả xoài, mẹ cho thêm ${b} quả. Lan có tất cả bao nhiêu quả xoài?`, expr: `${a} + ${b}`, answer: String(a + b), unit: 'quả xoài', explain: `${a} + ${b} = ${a + b}` };
  }

  private engItem(level: string, k: number) {
    const t = ['eng_match', 'eng_fill', 'eng_listen', 'eng_order'][k % 4], skill = t === 'eng_order' || t === 'eng_fill' ? 'sentence' : 'colour_words';
    if (t === 'eng_match') return { type: t, level, skill, prompt: 'Match the word to the picture', pairs: [{ word: 'red', emoji: '🔴' }, { word: 'blue', emoji: '🔵' }, { word: 'green', emoji: '🟢' }], explain: 'Nhìn hình và đọc to từ.' };
    if (t === 'eng_fill') return { type: t, level, skill, prompt: 'Choose the missing word', sentence: 'What colour ___ it?', options: ['is', 'are', 'am'], answer: 'is', explain: '"What colour is it?" = Nó màu gì?' };
    if (t === 'eng_listen') return { type: t, level, skill, prompt: 'Listen and choose the colour', say: 'blue', options: ['🔵', '🔴', '🟢'], answer: '🔵', explain: 'Blue = màu xanh dương.' };
    return { type: t, level, skill, prompt: 'Put the words in order', words: ['colour', 'my', 'is', 'favourite', 'blue'], answer: 'My favourite colour is blue.', explain: 'Câu nói màu yêu thích.' };
  }

  async image(req: ImageRequest): Promise<Buffer> {
    this.calls.push({ task: 'image', key: req.key });
    const n = [...req.key].reduce((a, c) => a + c.charCodeAt(0), 0);
    return gradientPng(320, 240, (n * 47) % 360);
  }

  async see<T>(req: VisionRequest): Promise<T> {
    this.calls.push({ task: 'image-critic' });
    const { slide, attempt, prompt } = req.input as { slide: string; attempt: number; prompt: string };
    const fail = !this.opts.clean && slide === 'sl02' && attempt === 1;
    return (fail ? { pass: false, score: 3, issues: ['numbers visible on the fruit'], revisedPrompt: `${prompt} Plain fruit, no numbers or writing.` } : { pass: true, score: 8, issues: [] }) as T;
  }

  async speak(req: SpeechRequest): Promise<Buffer> {
    this.calls.push({ task: 'tts' });
    return humWav(Math.max(0.8, req.text.split(/\s+/).length / 2.5));
  }
}
