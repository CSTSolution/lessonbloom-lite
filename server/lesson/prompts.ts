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
- objectives: 1-2 short learning objectives in {{langName}}, the teacher's language (Vietnamese: "Học sinh biết ..."; English: "Pupils can ...")
- minutes: 15, 25 or 35
- level: "basic", "good", "advanced", or "mixed" when the class has all levels (default "mixed")
- lang: "vi" for maths, "en" for English lessons
- outputs: which of slides, video, exercises, flashcards suit this lesson (usually all four)
- usable: false when the text is not lesson content a teacher could teach from (random letters or numbers, a few unrelated words, spam, a shopping list, a message); true for real lesson notes, even short ones`;

export const INTAKE_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string', enum: ['math', 'english'] }, grade: { type: 'integer', minimum: 1, maximum: 5 },
    title: str, objectives: strs, minutes: { type: 'integer' }, level: { type: 'string', enum: [...LEVELS, 'mixed'] },
    lang: { type: 'string', enum: ['vi', 'en'] }, outputs: { type: 'array', items: { type: 'string', enum: ['slides', 'video', 'exercises', 'flashcards'] } },
    usable: { type: 'boolean' },
  },
  required: ['usable', 'subject', 'grade', 'title', 'objectives', 'minutes', 'level', 'lang', 'outputs'],
};

export const LESSON_SYSTEM = `You build a slide lesson for Vietnamese primary pupils (age 6-11) from the teacher's own document.
- Use ONLY the document. Nothing from later grades.
- {{count}} slides in teaching order: "title", "warmup" (activate what they know), "concept" and "example" slides, 1-2 "practice" (a question the class answers together), "summary".
- Big type: heading under 8 words, in sentence case (only the first word and names capitalised: "Using can't for things we cannot do", not "Using Can't When You Cannot"); at most 4 bullets under 10 words. Put a worked example in "example" (maths: e.g. "36 + 27 = 63", with the carrying step in a bullet).
- Familiar Vietnamese names and situations (Lan, Nam, xoài, chợ quê, Tết, sân trường).
- Language: {{langName}}. For English lessons keep English in English, add a short Vietnamese hint where a grade {{grade}} pupil needs it.
- imagePrompt: English, one simple scene for a cheerful flat cartoon showing objects and children (e.g. "two children sorting bundles of sticks into groups"). Never mention digits, numbers, equations, text or letters, and never ask for an exact count.
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
First list the lesson's SKILLS ("dạng bài"): 2-4 skills the lesson actually teaches, each { tag: short snake_case id, name: short name in {{langName}} } (e.g. maths: carry_1 "Nhớ 1 sang hàng chục", no_carry "Cộng không nhớ"; English: colour_words "Colour words", what_colour "Asking 'What colour is it?'").
Then write items using ONLY these templates:
{{templates}}
Rules:
- {{perLevel}} items for each level: "basic" (direct practice), "good" (one step more), "advanced" (word problem or a twist). Every item has "skill" = the ONE skill tag it really practises: a picture-matching item about nouns is never tagged with a grammar skill. Cover every skill at every level where it makes sense.
- Use a template only when it fits the lesson's content. eng_match only for picture-able nouns the lesson teaches; if the lesson teaches grammar or sentence patterns, use eng_fill / eng_order / eng_listen instead. Never bring in words from outside the lesson's topic just to fill a template.
- Stay inside the lesson and the grade {{grade}} range. Prompts in {{langName}}; English items keep English words in English.
- The prompt is only the instruction ("Match each word to its picture.", "Choose the missing word."). It NEVER contains the answer, the word-picture pairs, the word read aloud or the finished sentence; the item's own fields carry those.
- Exactly one correct answer per item. "explain": one short line a child understands, in {{langName}}, showing the method or the reason ("6 + 7 = 13, viết 3 nhớ 1; 3 + 2 + 1 = 6", "'It's' because we talk about one thing.").
- Wrong options should be the mistakes children really make (forgetting to carry, adding the wrong column...).
Machine-checked fields (the server recomputes maths; be exact):
- math_mcq: "prompt" shows the calculation itself, e.g. "52 - 28 = ?" or "Chọn kết quả đúng: 52 - 28 = ?" (pupils do not see "expr"); "expr" the same calculation (e.g. "52 - 28"); "options" 3-4 numbers as strings, exactly one equal to expr; "answer" = that option.
- math_fill: "equation" with one blank written "?" (e.g. "45 - ? = 20"); "answer" = the number for the blank.
- math_truefalse: "statement" is an equation (e.g. "5 × 4 = 25"); "answer" = "true" or "false".
- math_word: "prompt" is the story; "expr" solves it; "answer" the number; "unit" = exactly the thing the question asks for (asks "bao nhiêu con gà mái?" → "con gà mái", not "con gà"); "explain" ends with that same unit.
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
The pupil sees the "prompt" TOGETHER WITH the item's equation / statement / sentence / options / words / pairs, so a short prompt like "Điền số vào ô trống" is complete when the equation is given. The pupil never sees "expr": a math_mcq whose prompt does not show the calculation cannot be answered.
For each item, ok=false only if: more than one acceptable answer or the marked answer is wrong; a grammar or spelling mistake (English or Vietnamese); vocabulary or numbers clearly beyond grade {{grade}} or outside the lesson; confusing for a 6-11 year old; a math_word "unit" that does not name exactly what the question asks for (asks for "gà mái", unit says "gà"); unsuitable for children; the item breaks its template (no gap, answer not among the options...); the prompt gives away the answer (e.g. lists the word-picture pairs or the finished sentence); the item clearly does not practise its skill (e.g. matching nouns to pictures tagged as a grammar skill such as relative pronouns) or does not fit the lesson's topic.
Close or overlapping skill tags are fine; only flag a clear mismatch. Short issues in English. Do not rewrite items.`;

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
- errorType: a short name for the kind of mistake, in {{langName}}, reusing one of these when it fits and is in {{langName}}: {{known}}. Examples: Vietnamese "Quên nhớ 1 sang hàng chục", "Nhầm phép tính", "Nhầm nghĩa từ"; English "Forgot to carry the one", "Wrong colour word", "Words in the wrong order".
- hint: 1-2 short sentences in {{langName}} TO THE CHILD that point at the step to fix WITHOUT giving the final answer, warm tone ("6 + 7 = 13, viết 3 và nhớ 1 sang hàng chục. 3 + 2 rồi thêm 1 nữa là mấy nhỉ?" / "Look at the picture again: which colour is the apple?"). The screen already shows "Almost! Try again" above it, so do not open with praise or "wrong"; never mention scores.`;
export const ERROR_SCHEMA = { type: 'object', properties: { errorType: str, hint: str }, required: ['errorType', 'hint'] };

export const COMMENT_SYSTEM = `Draft short comments ("gợi ý lời nhận xét") a Vietnamese primary teacher can copy into the pupil's notebook or school record, in the spirit of Thông tư 27/2020/TT-BGDĐT: describe progress and what to practise next, specific to the skills; no scores, no numbers of right or wrong answers, no comparison with other pupils, encouraging.
Write exactly ONE comment for EVERY pupil in the list, with that pupil's pupilId. Each pupil comes with their skills: label secure = làm chắc, practising = đang luyện, repeated = hay mắc cùng một lỗi (the error is given); "felt" is how the pupil said the lesson felt.
1-2 sentences each, in {{langName}}, address the pupil by name (Vietnamese: "Em An ..."; English: "An ..."): one thing done well, then one thing to practise next.`;
export const COMMENT_SHORT_SYSTEM = `Rewrite this comment for a Vietnamese primary-school pupil to be shorter: one sentence, at most 20 words, same meaning, keep the name and the thing to practise, no scores. Same language as the comment.`;
export const COMMENT_SHORT_SCHEMA = { type: 'object', properties: { text: str }, required: ['text'] };
export const COMMENT_SCHEMA = { type: 'object', properties: { comments: { type: 'array', items: { type: 'object', properties: { pupilId: str, text: str }, required: ['pupilId', 'text'] } } }, required: ['comments'] };

export const IMAGE_STYLE = 'Cheerful flat cartoon illustration for a primary-school lesson slide, soft pastel colours, simple shapes, friendly Vietnamese children and everyday objects, plain light background, no text, no letters, no numbers, no watermark.';
export const IMAGE_CRITIC_SYSTEM = `You check one illustration for a primary-school slide. Answer each flag honestly:
- hasText: legible text, letters, digits or numbers are visible anywhere
- unsafe: anything scary, violent or unsuitable for young children
- broken: clearly broken anatomy (hands, faces, limbs) or melted / garbled shapes
- offTopic: the picture has nothing to do with the slide topic (small details like which fruit, exact counts or colours do NOT count)
score 0-10 for how well it serves the slide. issues: short list of what is wrong. revisedPrompt: the image prompt rewritten to fix the flagged problems.`;
export const IMAGE_CRITIC_SCHEMA = { type: 'object', properties: { hasText: { type: 'boolean' }, unsafe: { type: 'boolean' }, broken: { type: 'boolean' }, offTopic: { type: 'boolean' }, score: { type: 'number' }, issues: strs, revisedPrompt: str }, required: ['hasText', 'unsafe', 'broken', 'offTopic', 'score', 'issues'] };

export const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => String(v[k] ?? ''));

// Photos of a lesson (textbook page, handwritten notes, worksheet) -> plain text for step 1
export const OCR_SYSTEM = `You read photos a Vietnamese primary-school teacher took of lesson material (a textbook page, handwritten notes, a worksheet or a whiteboard) and copy out the text so it can be used as lesson notes.
- Copy the text exactly, in its original language (Vietnamese or English), with Vietnamese diacritics. Do not translate, summarise or add anything.
- Keep the reading order. Put each photo's text in order, separated by one blank line. Keep headings, numbered exercises and line breaks.
- Write maths exactly: digits, + - × : = < >, fractions as 1/2. Keep column additions as a line such as "36 + 27 = 63".
- A picture that carries lesson content becomes a short note in brackets in the language of that page: a Vietnamese page "[hình: 3 quả táo và 2 quả cam]", an English page "[picture: a red apple]". Skip decorations, page numbers, logos and publisher text.
- If a word is unreadable write "[…]".
- usable = false when the photos show no readable lesson text (e.g. a selfie, a blank page, a blurred photo); then text is "".`;
export const OCR_SCHEMA = {
  type: 'object', required: ['usable', 'text'],
  properties: { usable: { type: 'boolean' }, text: { type: 'string' } },
};
