// Shared shapes (Chi's data model, docs/design/LessonBloom_Luong_san_pham.pdf slide 11).
// Gemini returns lesson content as structured JSON; the web app renders it as-is.
// Pupils: display name only. No scores anywhere; labels attach to a skill, never shown to pupils.

export type Subject = 'math' | 'english';
export type Lang = 'vi' | 'en';
export type Level = 'basic' | 'good' | 'advanced';           // Cơ bản, Khá, Nâng cao
export type Label = 'secure' | 'practising' | 'repeated';     // Đã vững, Đang luyện, Lỗi lặp lại
export type Output = 'slides' | 'video' | 'exercises' | 'flashcards';

// The questions the teacher answers in step 2; Gemini pre-fills them from the document.
export interface Intake {
  subject: Subject;
  grade: 1 | 2 | 3 | 4 | 5;
  title: string;
  objectives: string[];
  minutes: number;                 // 15 / 25 / 35
  level: Level | 'mixed';          // 'mixed' = make all 3 levels
  lang: Lang;                      // language of slides and narration
  outputs: Output[];
  note?: string;                   // free note for the AI ("use market situations")
}

export interface Slide {
  id: string;
  kind: 'title' | 'warmup' | 'concept' | 'example' | 'practice' | 'summary';
  heading: string;
  bullets: string[];
  example?: string;                // worked example in big type, e.g. "36 + 27 = 63"
  imagePrompt: string;
  image?: string;
  notes: string;                   // teacher notes (Lời giảng cho cô)
  source: string;                  // quote from the teacher's document this slide is based on
  narration: string;               // video voice for this slide
}

export interface Skill { tag: string; name: string }   // e.g. { tag: 'carry_1', name: 'Nhớ 1 sang hàng chục' }

interface Base { id: string; level: Level; skill: string; prompt: string; explain: string }
export type Exercise =
  | Base & { type: 'math_mcq'; expr: string; options: string[]; answer: string }
  | Base & { type: 'math_fill'; equation: string; answer: string }            // "45 - ? = 20"
  | Base & { type: 'math_truefalse'; statement: string; answer: 'true' | 'false' }
  | Base & { type: 'math_word'; expr: string; answer: string; unit?: string }
  | Base & { type: 'eng_match'; pairs: { word: string; emoji: string }[] }
  | Base & { type: 'eng_fill'; sentence: string; options: string[]; answer: string }
  | Base & { type: 'eng_listen'; say: string; options: string[]; answer: string; audio?: string }
  | Base & { type: 'eng_order'; words: string[]; answer: string };
export type ExerciseType = Exercise['type'];

export interface Flashcard { id: string; front: string; emoji?: string; back: string; example?: string; exampleVi?: string; say?: string }
export interface MemoryPair { id: string; a: string; b: string }     // "3 × 4" ↔ "12", "cat" ↔ "🐱"

export interface CheckResult { ok: boolean; issues: string[]; fixedAnswer?: string }
export interface CheckLog { exercise: string; attempts: number; issues: string[] }

export interface Lesson {
  id: string;
  teacherId: string;
  createdAt: string;
  status: 'draft' | 'working' | 'ready' | 'error';
  progress: string[];
  error?: string;
  source: string;
  intake: Intake;
  skills: Skill[];
  slides: Slide[];
  exercises: Exercise[];
  flashcards: Flashcard[];
  pairs: MemoryPair[];
  checks: CheckLog[];
  video?: { status: 'none' | 'working' | 'ready' | 'error'; url?: string; seconds?: number; voice?: string; speed?: number; subtitles?: boolean; chapters?: { slide: string; at: number }[]; error?: string };
}

export interface Criteria {
  lastN: number; minAnswers: number; securePct: number; repeatedPct: number;
  repeatTimes: number; repeatSessions: number; classRepeatedPct: number; classSecurePct: number;
}
export const DEFAULT_CRITERIA: Criteria = { lastN: 10, minAnswers: 5, securePct: 80, repeatedPct: 50, repeatTimes: 3, repeatSessions: 2, classRepeatedPct: 30, classSecurePct: 70 };

export interface Teacher { id: string; name: string; subject: Subject; criteria: Criteria; createdAt: string; email?: string; account?: boolean; plan?: 'demo' | 'free' | 'pro'; proRequestedAt?: string }
export interface ClassRoom { id: string; teacherId: string; name: string; joinCode: string }
export interface Pupil { id: string; classId: string; displayName: string; joinedAt?: string }
export interface Assignment { id: string; teacherId: string; lessonId: string; classId: string; dueAt?: string; allowRetry: boolean; autoSuggest: boolean; createdAt: string }
export interface Attempt { id: string; assignmentId: string; classId: string; pupilId: string; lessonId: string; exerciseId: string; skill: string; answer: string; correct: boolean; errorType?: string; at: string; session: string }
export interface SelfCheck { id: string; assignmentId: string; pupilId: string; mood: 'easy' | 'ok' | 'hard'; at: string }
