// System prompts and response schemas for every Gemini step. Teacher- and pupil-facing text
// is Vietnamese (English lessons keep English content in English). Everything stays inside
// the teacher's document, and the product's words follow Chi's rules: "bài luyện tập",
// never "bài kiểm tra"; no scores; gentle, specific feedback.

const str = { type: 'string' };
const strs = { type: 'array', items: str };
const LEVELS = ['basic', 'good', 'advanced'];

export const MATH_TYPES = ['math_mcq', 'math_fill', 'math_truefalse', 'math_word'];
export const ENG_TYPES = ['eng_match', 'eng_fill', 'eng_listen', 'eng_order'];

export const INTAKE_SYSTEM = `You help a Vietnamese primary-school teacher (grades 1-5) turn lesson notes into a lesson.
Read the document and pre-fill the setup so the teacher only checks it:
- subject "math" or "english"; grade 1-5 (infer from numbers/vocabulary if not stated)
- title: the lesson title in the document's language
- objectives: 1-2 short learning objectives in Vietnamese ("Học sinh biết ...")
- minutes: 15, 25 or 35
- level: "basic", "good", "advanced", or "mixed" when the class has all levels (default "mixed")
- lang: "vi" for maths, "en" for English lessons
- outputs: which of slides, video, exercises, flashcards suit this lesson (usually all four)`;

export const INTAKE_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string', enum: ['math', 'english'] }, grade: { type: 'integer', minimum: 1, maximum: 5 },
    title: str, objectives: strs, minutes: { type: 'integer' }, level: { type: 'string', enum: [...LEVELS, 'mixed'] },
    lang: { type: 'string', enum: ['vi', 'en'] }, outputs: { type: 'array', items: { type: 'string', enum: ['slides', 'video', 'exercises', 'flashcards'] } },
  },
  required: ['subject', 'grade', 'title', 'objectives', 'minutes', 'level', 'lang', 'outputs'],
};

export const LESSON_SYSTEM = `You build a slide lesson for Vietnamese primary pupils (age 6-11) from the teacher's own document.
- Use ONLY the document. Nothing from later grades.
- {{count}} slides in teaching order: "title", "warmup" (activate what they know), "concept" and "example" slides, 1-2 "practice" (a question the class answers together), "summary".
- Big type: heading under 8 words; at most 4 bullets under 10 words. Put a worked example in "example" (maths: e.g. "36 + 27 = 63", with the carrying step in a bullet).
- Familiar Vietnamese names and situations (Lan, Nam, xoài, chợ quê, Tết, sân trường).
- Language: {{langName}}. For English lessons keep English in English, add a short Vietnamese hint where a grade {{grade}} pupil needs it.
- imagePrompt: English, one simple scene for a cheerful flat cartoon. Never ask for text, numbers or letters in the picture.
- notes: speaker notes for the teacher in Vietnamese, 1-3 sentences ("Các con nhìn hàng đơn vị: ...").
- source: the exact sentence(s) from the document this slide is based on (copy, max 200 characters).
- narration: what a friendly teacher's voice says over this slide in the video, {{langName}}, 1-3 short sentences (10-20 s). All narrations together: about {{videoMin}}-{{videoMax}} minutes.
{{note}}`;

export const LESSON_SCHEMA = {
  type: 'object',
  properties: { slides: { type: 'array', items: { type: 'object', properties: {
    kind: { type: 'string', enum: ['title', 'warmup', 'concept', 'example', 'practice', 'summary'] },
    heading: str, bullets: strs, example: str, imagePrompt: str, notes: str, source: str, narration: str,
  }, required: ['kind', 'heading', 'bullets', 'imagePrompt', 'notes', 'source', 'narration'] } } },
  required: ['slides'],
};

export const SLIDE_EDIT_SYSTEM = `You edit one slide of a primary-school lesson. Keep the same slide kind, language and facts from the source.
"rewrite": say it differently, same level. "simpler": shorter words and sentences for a younger or weaker pupil, fewer bullets.
Return the whole slide.`;
export const SLIDE_SCHEMA = { type: 'object', properties: LESSON_SCHEMA.properties.slides.items.properties, required: LESSON_SCHEMA.properties.slides.items.required };

export const EXERCISES_SYSTEM = `You write practice exercises ("bài luyện tập") for Vietnamese primary pupils from the teacher's lesson.
First list the lesson's SKILLS ("dạng bài"): 2-4 skills, each { tag: short snake_case id, name: short Vietnamese name } (e.g. carry_1 "Nhớ 1 sang hàng chục", no_carry "Cộng không nhớ", word_1step "Toán có lời văn một bước").
Then write items using ONLY these templates:
{{templates}}
Rules:
- {{perLevel}} items for each level: "basic" (direct practice), "good" (one step more), "advanced" (word problem or a twist). Every item has "skill" = one skill tag. Cover every skill at every level where it makes sense.
- Stay inside the lesson and the grade {{grade}} range. Prompts in {{langName}}; English items keep English words in English.
- Exactly one correct answer per item. "explain": one short line a child understands (Vietnamese), showing the method ("6 + 7 = 13, viết 3 nhớ 1; 3 + 2 + 1 = 6").
- Wrong options should be the mistakes children really make (forgetting to carry, adding the wrong column...).
Machine-checked fields (the server recomputes maths; be exact):
- math_mcq: "expr" (e.g. "36 + 27"), "options" 3-4 numbers as strings, exactly one equal to expr; "answer" = that option.
- math_fill: "equation" with one blank written "?" (e.g. "45 - ? = 20"); "answer" = the number for the blank.
- math_truefalse: "statement" is an equation (e.g. "5 × 4 = 25"); "answer" = "true" or "false".
- math_word: "prompt" is the story; "expr" solves it; "answer" the number; "unit" e.g. "bông hoa".
- eng_match: "pairs" 3-4 {word, emoji}, picture-able nouns from the lesson.
- eng_fill: "sentence" with one gap "___"; "options" 3 words; "answer" one of them.
- eng_listen: "say" = word/phrase read aloud; "options" 3 choices (words, or emoji for "choose the picture"); "answer" one of them.
- eng_order: "words" = shuffled words of one short sentence; "answer" = the sentence with capital letter and full stop.
{{note}}`;

// One schema per template, every field the server checks is required, so Gemini can't omit them.
const BASE = { level: { type: 'string', enum: LEVELS }, skill: str, prompt: str, explain: str };
const BASE_REQ = ['type', 'level', 'skill', 'prompt', 'explain'];
const tpl = (type: string, props: Record<string, object>, req: string[]) =>
  ({ type: 'object', properties: { type: { type: 'string', enum: [type] }, ...BASE, ...props }, required: [...BASE_REQ, ...req] });
export const ITEM_SCHEMAS: Record<string, object> = {
  math_mcq: tpl('math_mcq', { expr: str, options: strs, answer: str }, ['expr', 'options', 'answer']),
  math_fill: tpl('math_fill', { equation: str, answer: str }, ['equation', 'answer']),
  math_truefalse: tpl('math_truefalse', { statement: str, answer: { type: 'string', enum: ['true', 'false'] } }, ['statement', 'answer']),
  math_word: tpl('math_word', { expr: str, answer: str, unit: str }, ['expr', 'answer']),
  eng_match: tpl('eng_match', { pairs: { type: 'array', items: { type: 'object', properties: { word: str, emoji: str }, required: ['word', 'emoji'] } } }, ['pairs']),
  eng_fill: tpl('eng_fill', { sentence: str, options: strs, answer: str }, ['sentence', 'options', 'answer']),
  eng_listen: tpl('eng_listen', { say: str, options: strs, answer: str }, ['say', 'options', 'answer']),
  eng_order: tpl('eng_order', { words: strs, answer: str }, ['words', 'answer']),
};
const SKILLS = { type: 'array', items: { type: 'object', properties: { tag: str, name: str }, required: ['tag', 'name'] } };
export const exercisesSchema = (types: string[]) => ({ type: 'object', properties: { skills: SKILLS, items: { type: 'array', items: { anyOf: types.map((t) => ITEM_SCHEMAS[t]) } } }, required: ['skills', 'items'] });

export const REVIEW_SYSTEM = `You are a strict primary-school teacher checking practice items before they reach children.
For each item, ok=false if ANY: more than one acceptable answer or the marked answer is wrong; a grammar or spelling mistake (English or Vietnamese); vocabulary or numbers beyond grade {{grade}} or outside the lesson; unclear for a 6-11 year old; unsuitable for children; does not follow its template; "skill" does not match what the item practises.
Short issues in English. Do not rewrite items.`;
export const REVIEW_SCHEMA = {
  type: 'object',
  properties: { results: { type: 'array', items: { type: 'object', properties: { id: str, ok: { type: 'boolean' }, issues: strs }, required: ['id', 'ok', 'issues'] } } },
  required: ['results'],
};

export const CARDS_SYSTEM = `From the teacher's lesson, make revision material for primary pupils:
- flashcards: {{nCards}} cards of the key facts. Maths: front = a calculation, rule or shape name ("7 × 8", "1 dm = ? cm"), back = the answer, optional example. English: front = the word with an emoji, back = Vietnamese meaning, example = a short English sentence, exampleVi = its Vietnamese. "say" = what to read aloud for the front (English words only).
- pairs: 4 memory-game pairs that match a card to its partner ("3 × 4" ↔ "12", "cat" ↔ "🐱"). Each side under 10 characters; all 8 sides different.
Only content from the lesson, grade {{grade}}.`;
export const CARDS_SCHEMA = {
  type: 'object',
  properties: {
    flashcards: { type: 'array', items: { type: 'object', properties: { front: str, emoji: str, back: str, example: str, exampleVi: str, say: str }, required: ['front', 'back'] } },
    pairs: { type: 'array', items: { type: 'object', properties: { a: str, b: str }, required: ['a', 'b'] } },
  },
  required: ['flashcards', 'pairs'],
};

export const ERROR_SYSTEM = `A primary pupil (grade {{grade}}) answered a practice item wrongly. Work out WHY, like a kind teacher.
- errorType: a short Vietnamese name for the kind of mistake, reusing one of these when it fits: {{known}}. Examples: "Quên nhớ 1 sang hàng chục", "Đặt tính sai cột", "Nhầm phép tính", "Sai thì của động từ", "Nhầm nghĩa từ".
- hint: 1-2 short Vietnamese sentences TO THE CHILD that point at the step to fix WITHOUT giving the final answer, warm tone ("6 + 7 = 13, viết 3 và nhớ 1 sang hàng chục. 3 + 2 rồi thêm 1 nữa là mấy nhỉ?"). The screen already shows "Gần đúng rồi! Thử lại nhé" above it, so do not open with praise or "sai rồi"; never mention scores.`;
export const ERROR_SCHEMA = { type: 'object', properties: { errorType: str, hint: str }, required: ['errorType', 'hint'] };

export const COMMENT_SYSTEM = `Draft short comments ("gợi ý lời nhận xét") a Vietnamese primary teacher can copy into the pupil's notebook or school record, in the spirit of Thông tư 27/2020/TT-BGDĐT: describe progress and what to practise next, specific to the skill; no scores, no comparison with other pupils, encouraging. 1-2 sentences each, Vietnamese, address the pupil by name ("Em An ...").`;
export const COMMENT_SCHEMA = { type: 'object', properties: { comments: { type: 'array', items: { type: 'object', properties: { pupilId: str, text: str }, required: ['pupilId', 'text'] } } }, required: ['comments'] };

export const IMAGE_STYLE = 'Cheerful flat cartoon illustration for a primary-school lesson slide, soft pastel colours, simple shapes, friendly Vietnamese children and everyday objects, plain light background, no text, no letters, no numbers, no watermark.';
export const IMAGE_CRITIC_SYSTEM = `You check one illustration for a primary-school slide. Fail it (pass=false) ONLY for real problems: legible text, letters or numbers; anything scary, violent or unsuitable for young children; broken anatomy (hands, faces) or obvious AI artefacts; a scene unrelated to the slide. Do NOT fail for small details (which fruit or tree, exact counts, clothing colours) - a cheerful picture that fits the topic passes. score 0-10. If it fails, write revisedPrompt fixing the issues.`;
export const IMAGE_CRITIC_SCHEMA = { type: 'object', properties: { pass: { type: 'boolean' }, score: { type: 'number' }, issues: strs, revisedPrompt: str }, required: ['pass', 'score', 'issues'] };

export const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => String(v[k] ?? ''));
