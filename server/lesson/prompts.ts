// System prompts and response schemas for each Gemini step. Teacher-facing text is Vietnamese;
// English lessons keep the English content in English. Everything stays inside the teacher's
// own document: the model adapts, it does not invent a new syllabus.

const str = { type: 'string' };
const strs = { type: 'array', items: str };
const LEVELS = ['basic', 'good', 'advanced'];

export const MATH_TYPES = ['math_mcq', 'math_fill', 'math_truefalse', 'math_word'];
export const ENG_TYPES = ['eng_match', 'eng_fill', 'eng_listen', 'eng_order'];

export const INTAKE_SYSTEM = `You help a Vietnamese primary-school teacher (grades 1-5) turn lesson notes into a lesson.
Read the document and pre-fill the setup form so the teacher only has to check it:
- subject: "math" or "english".
- grade: 1-5, from the content (number range, vocabulary) if not stated.
- title: the lesson title, in the document's language.
- objectives: 1-3 short learning objectives, written in Vietnamese for the teacher.
- minutes: lesson length (default 35 for a Vietnamese primary period).
- level: "basic", "good" or "advanced" for the class (default "good").
- lang: "vi" for maths lessons, "en" for English lessons.`;

export const INTAKE_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string', enum: ['math', 'english'] }, grade: { type: 'integer', minimum: 1, maximum: 5 },
    title: str, objectives: strs, minutes: { type: 'integer' }, level: { type: 'string', enum: LEVELS }, lang: { type: 'string', enum: ['vi', 'en'] },
  },
  required: ['subject', 'grade', 'title', 'objectives', 'minutes', 'level', 'lang'],
};

export const LESSON_SYSTEM = `You build a slide lesson for Vietnamese primary pupils (age 6-11) from the teacher's own notes.
Rules:
- Use only the content of the document. Do not add topics from later grades.
- {{count}} slides: one "title", then "concept" and "example" slides in teaching order, one or two "practice" slides (a question the class answers together), and one "summary".
- Big-type slides: heading under 8 words, at most 4 bullets of under 10 words each. Put a worked example in "example" (for maths, e.g. "36 + 27 = 63", with the carrying step in a bullet).
- Names, objects and situations familiar to Vietnamese children (Lan, Nam, mango, bánh chưng, Tết, school yard...).
- Slide language: {{langName}}. For English lessons, keep English words in English and add a short Vietnamese hint where a grade {{grade}} pupil would need it.
- imagePrompt: in English, one simple scene for a cheerful flat cartoon illustration. Never ask for text, numbers or letters in the image.
- notes: speaker notes for the teacher, in Vietnamese, 1-3 sentences (what to ask, what to point at).
- narration: what a friendly teacher's voice says over this slide in the video, in {{langName}}, 1-3 short sentences, about 10-20 seconds when spoken. The narrations together form a {{videoMin}}-{{videoMax}} minute video.`;

export const LESSON_SCHEMA = {
  type: 'object',
  properties: {
    slides: { type: 'array', items: { type: 'object', properties: {
      kind: { type: 'string', enum: ['title', 'concept', 'example', 'practice', 'summary'] },
      heading: str, bullets: strs, example: str, imagePrompt: str, notes: str, narration: str,
    }, required: ['kind', 'heading', 'bullets', 'imagePrompt', 'notes', 'narration'] } },
  },
  required: ['slides'],
};

export const EXERCISES_SYSTEM = `You write exercises for Vietnamese primary pupils from the teacher's lesson, using ONLY these templates:
{{templates}}
Rules:
- {{perLevel}} items for each level: "basic" (direct practice), "good" (one step more), "advanced" (word problem or a twist). Mix the templates.
- Stay inside the lesson content and the grade {{grade}} range. Prompts in {{langName}}; English-lesson items keep the English words in English.
- Every item has exactly one correct answer, and "explain" gives a one-line explanation a child understands (Vietnamese).
Machine-checked fields (the server recomputes maths, so be exact):
- math_mcq: "expr" is the calculation (e.g. "36 + 27"), "options" 3-4 numbers as strings, exactly one equal to expr; "answer" is that option.
- math_fill: "equation" has one blank written "?" (e.g. "45 - ? = 20"); "answer" is the number for the blank.
- math_truefalse: "statement" is an equation (e.g. "5 × 4 = 25"); "answer" is "true" or "false".
- math_word: "prompt" is the story; "expr" is the calculation that solves it; "answer" the number; "unit" e.g. "quả cam".
- eng_match: "pairs" of 3-4 {word, emoji}; each word a picture-able noun from the lesson.
- eng_fill: "sentence" has one gap written "___"; "options" 3 words; "answer" one of them.
- eng_listen: "say" is the word or short phrase the voice reads; "options" 3 choices (words, or emoji when the task is "choose the picture"); "answer" one of them.
- eng_order: "words" are the shuffled words of one short sentence; "answer" is the sentence, correctly ordered, with capital letter and full stop.`;

const ITEM = {
  type: 'object',
  properties: {
    type: { type: 'string' }, level: { type: 'string', enum: LEVELS }, prompt: str, explain: str,
    expr: str, options: strs, answer: str, equation: str, statement: str, unit: str,
    pairs: { type: 'array', items: { type: 'object', properties: { word: str, emoji: str }, required: ['word', 'emoji'] } },
    sentence: str, say: str, words: strs,
  },
  required: ['type', 'level', 'prompt', 'explain'],
};
export const EXERCISES_SCHEMA = { type: 'object', properties: { items: { type: 'array', items: ITEM } }, required: ['items'] };

export const REVIEW_SYSTEM = `You are a strict primary-school teacher checking exercises before they reach children.
For each item, ok=false if ANY of these is true:
- more than one answer could be accepted, or the marked answer is wrong
- a grammar or spelling mistake (English or Vietnamese)
- vocabulary or numbers beyond grade {{grade}}, or outside the lesson
- the prompt is unclear for a 6-11 year old, or the content is unsuitable for children
- the item does not follow its template (missing gap, answer not among the options...)
Give short issues in English. Do not rewrite items.`;

export const REVIEW_SCHEMA = {
  type: 'object',
  properties: { results: { type: 'array', items: { type: 'object', properties: { id: str, ok: { type: 'boolean' }, issues: strs }, required: ['id', 'ok', 'issues'] } } },
  required: ['results'],
};

export const IMAGE_STYLE = 'Cheerful flat cartoon illustration for a primary-school lesson slide, soft pastel colours, simple shapes, friendly Vietnamese children and everyday objects, plain light background, no text, no letters, no numbers, no watermark.';

export const IMAGE_CRITIC_SYSTEM = `You check one illustration for a primary-school slide. Fail it (pass=false) if: any text, letters or numbers are visible; anything scary, violent or unsuitable for young children; broken anatomy or AI artefacts; it does not show the requested scene. score 0-10. If it fails, write revisedPrompt fixing every issue.`;

export const IMAGE_CRITIC_SCHEMA = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, score: { type: 'number' }, issues: strs, revisedPrompt: str },
  required: ['pass', 'score', 'issues'],
};

export const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => String(v[k] ?? ''));
