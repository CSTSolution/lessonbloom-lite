// Shared shapes. Gemini returns these as structured JSON; the web app renders them as-is.

export type Subject = 'math' | 'english';
export type Lang = 'vi' | 'en';
export type Level = 'basic' | 'good' | 'advanced';    // cơ bản, khá, nâng cao

// The 4-5 questions the teacher answers; Gemini pre-fills them from the document.
export interface Intake {
  subject: Subject;
  grade: 1 | 2 | 3 | 4 | 5;
  title: string;
  objectives: string[];        // 1-3 learning objectives
  minutes: number;             // lesson length, drives slide count and video length
  level: Level;                // class level
  lang: Lang;                  // language of slides and narration (English lessons narrate in English)
}

export interface Slide {
  id: string;                  // sl01 ...
  kind: 'title' | 'concept' | 'example' | 'practice' | 'summary';
  heading: string;
  bullets: string[];           // 0-4 short lines, big type
  example?: string;            // worked example shown large, e.g. "36 + 27 = 63"
  imagePrompt: string;         // illustration idea (no text in the image)
  image?: string;              // filled in after illustration
  notes: string;               // speaker notes for the teacher
  narration: string;           // what the video voice says on this slide
}

// One shape per exercise template. "expr" fields are machine-checkable: the server
// recomputes every maths answer instead of trusting the model.
export type Exercise =
  | { id: string; level: Level; type: 'math_mcq'; prompt: string; expr: string; options: string[]; answer: string; explain: string }
  | { id: string; level: Level; type: 'math_fill'; prompt: string; equation: string; answer: string; explain: string }     // "45 - ? = 20"
  | { id: string; level: Level; type: 'math_truefalse'; prompt: string; statement: string; answer: 'true' | 'false'; explain: string }
  | { id: string; level: Level; type: 'math_word'; prompt: string; expr: string; answer: string; unit?: string; explain: string }
  | { id: string; level: Level; type: 'eng_match'; prompt: string; pairs: { word: string; emoji: string }[]; explain: string }
  | { id: string; level: Level; type: 'eng_fill'; prompt: string; sentence: string; options: string[]; answer: string; explain: string }   // "I ___ a cat."
  | { id: string; level: Level; type: 'eng_listen'; prompt: string; say: string; options: string[]; answer: string; explain: string }
  | { id: string; level: Level; type: 'eng_order'; prompt: string; words: string[]; answer: string; explain: string };

export type ExerciseType = Exercise['type'];

export interface CheckResult {
  ok: boolean;
  issues: string[];
  fixedAnswer?: string;        // when code can compute the right answer itself
}

export interface Lesson {
  id: string;
  createdAt: string;
  status: 'working' | 'ready' | 'error';
  progress: string[];          // what the agent is doing, shown live to the teacher
  error?: string;
  source: string;              // the teacher's text
  intake: Intake;
  slides: Slide[];
  exercises: Exercise[];
  checks: { exercise: string; attempts: number; issues: string[] }[];   // what the self-check caught
  video?: string;
  shareId?: string;
}

export interface Submission {
  shareId: string;
  at: string;
  level: Level;
  answers: Record<string, string>;
  correct: Record<string, boolean>;
}
