// Offline stand-in for Gemini, deterministic so tests can assert on it. It reads the teacher's
// text for numbers and words, plants one wrong maths answer and one bad English item so the
// self-check loop really runs, and its image critic rejects the first picture of slide 2.
import type { Exercise, Intake } from '../types.ts';
import { gradientPng, humWav } from './media.ts';
import type { AI, ImageRequest, SpeechRequest, TextRequest, VisionRequest } from './provider.ts';

const sentences = (t: string) => (t.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map((s) => s.trim()).filter(Boolean);

export class MockProvider implements AI {
  name = 'mock';
  calls: { task: string; key?: string }[] = [];
  constructor(private opts: { clean?: boolean } = {}) {}   // clean: no planted mistakes

  async json<T>(req: TextRequest): Promise<T> {
    this.calls.push({ task: req.task });
    const inp = req.input as any;
    switch (req.task) {
      case 'intake': {
        const english = /\b(the|is|my|name|colou?r|apple|cat)\b/i.test(inp.source) && !/[ăâđêôơư]/i.test(inp.source.slice(0, 200));
        const grade = Number(/lớp\s*(\d)|grade\s*(\d)/i.exec(inp.source)?.slice(1).find(Boolean) || 2);
        const it: Intake = { subject: english ? 'english' : 'math', grade: grade as Intake['grade'], title: sentences(inp.source)[0].slice(0, 60),
          objectives: ['Hiểu nội dung chính của bài', 'Làm được bài tập cơ bản'], minutes: 35, level: 'good', lang: english ? 'en' : 'vi' };
        return it as T;
      }
      case 'lesson': {
        const s = sentences(inp.source), n = inp.count as number;
        const kinds = ['title', ...Array(n - 3).fill(0).map((_, i) => (i % 2 ? 'example' : 'concept')), 'practice', 'summary'];
        return { slides: kinds.map((kind, i) => ({ kind, heading: (s[i % s.length] || 'Bài học').split(/[,:]/)[0].slice(0, 40), bullets: [s[(i + 1) % s.length]?.slice(0, 50) || ''],
          example: kind === 'example' ? '36 + 27 = 63' : undefined, imagePrompt: 'two children counting mangoes in a school yard', notes: 'Hỏi cả lớp trước khi chuyển trang.',
          narration: s[i % s.length] || 'Chúng ta cùng học nhé.' })) } as T;
      }
      case 'exercises': {
        if (inp.redo) return { items: (inp.redo as Exercise[]).map((e) => this.fixed(e)) } as T;
        const math = inp.intake.subject === 'math', per = inp.perLevel as number, items: any[] = [];
        for (const level of ['basic', 'good', 'advanced']) for (let k = 0; k < per; k++) items.push(math ? this.mathItem(level, k) : this.engItem(level, k));
        if (!this.opts.clean) {
          if (math) items[0] = { ...items[0], answer: '53' };   // wrong: 36 + 27 = 63 (code fixes it)
          else items[1] = { ...items[1], answer: 'has' };       // not among the options (regenerated)
        }
        return { items } as T;
      }
      case 'review': return { results: (inp.items as Exercise[]).map((e) => ({ id: e.id, ok: true, issues: [] })) } as T;
      default: throw new Error(`mock has no answer for ${req.task}`);
    }
  }

  private mathItem(level: string, k: number) {
    const a = 36 + k, b = 27 + (level === 'advanced' ? 10 : 0), t = ['math_mcq', 'math_fill', 'math_truefalse', 'math_word'][k % 4];
    if (t === 'math_mcq') return { type: t, level, prompt: `${a} + ${b} = ?`, expr: `${a} + ${b}`, options: [a + b - 10, a + b, a + b + 1].map(String), answer: String(a + b), explain: 'Cộng hàng đơn vị, nhớ 1 sang hàng chục.' };
    if (t === 'math_fill') return { type: t, level, prompt: 'Điền số vào ô trống', equation: `${a + b} - ? = ${a}`, answer: String(b), explain: `${a + b} - ${b} = ${a}` };
    if (t === 'math_truefalse') return { type: t, level, prompt: 'Đúng hay sai?', statement: `${a} + ${b} = ${a + b + 1}`, answer: 'false', explain: `${a} + ${b} = ${a + b}` };
    return { type: t, level, prompt: `Lan có ${a} quả xoài, mẹ cho thêm ${b} quả. Lan có tất cả bao nhiêu quả xoài?`, expr: `${a} + ${b}`, answer: String(a + b), unit: 'quả xoài', explain: `${a} + ${b} = ${a + b}` };
  }

  private engItem(level: string, k: number) {
    const t = ['eng_match', 'eng_fill', 'eng_listen', 'eng_order'][k % 4];
    if (t === 'eng_match') return { type: t, level, prompt: 'Match the word to the picture', pairs: [{ word: 'apple', emoji: '🍎' }, { word: 'cat', emoji: '🐱' }, { word: 'sun', emoji: '☀️' }], explain: 'Nhìn hình và đọc to từ.' };
    if (t === 'eng_fill') return { type: t, level, prompt: 'Choose the missing word', sentence: 'I ___ a cat.', options: ['have', 'am', 'is'], answer: 'have', explain: '"I have" = tôi có.' };
    if (t === 'eng_listen') return { type: t, level, prompt: 'Listen and choose the colour', say: 'blue', options: ['🔵', '🔴', '🟢'], answer: '🔵', explain: 'Blue = màu xanh dương.' };
    return { type: t, level, prompt: 'Put the words in order', words: ['name', 'my', 'is', 'Nam'], answer: 'My name is Nam.', explain: 'Câu giới thiệu tên.' };
  }

  private fixed(e: Exercise): any {
    if (e.type === 'eng_fill') return { ...e, answer: e.options[0] };
    return e;
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
    return (fail ? { pass: false, score: 3, issues: ['numbers visible on the fruit'], revisedPrompt: `${prompt} Plain fruit, no numbers or writing.` }
      : { pass: true, score: 8, issues: [] }) as T;
  }

  async speak(req: SpeechRequest): Promise<Buffer> {
    this.calls.push({ task: 'tts' });
    return humWav(Math.max(0.8, req.text.split(/\s+/).length / 2.5));
  }
}
