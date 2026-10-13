import type { Exercise, Intake, Lesson, Level, Slide } from '../../server/types.ts';
export type { Exercise, Intake, Lesson, Level, Slide };

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${r.status}`);
  return j as T;
}

export type PupilExercise = Omit<Exercise, 'answer' | 'explain'> & { pictures?: string[]; options?: string[]; words?: string[]; pairs?: { word: string }[]; say?: string; sentence?: string; equation?: string; statement?: string; unit?: string };
export interface PupilLesson { title: string; subject: 'math' | 'english'; grade: number; lang: 'vi' | 'en'; slides: Omit<Slide, 'notes'>[]; video?: string; exercises: PupilExercise[] }
export interface Marked { right: number; total: number; result: Record<string, { correct: boolean; answer: string; explain: string }> }
export interface Report { pupils: number; items: { id: string; level: Level; type: string; prompt: string; tried: number; wrong: number; wrongRate: number }[] }

export const api = {
  intake: (source: string) => call<Intake>('POST', '/api/intake', { source }),
  create: (source: string, intake: Intake) => call<{ id: string }>('POST', '/api/lessons', { source, intake }),
  lesson: (id: string) => call<Lesson>('GET', `/api/lessons/${id}`),
  save: (id: string, patch: Partial<Pick<Lesson, 'slides' | 'exercises'>>) => call<Lesson>('PUT', `/api/lessons/${id}`, patch),
  share: (id: string) => call<{ shareId: string; url: string }>('POST', `/api/lessons/${id}/share`),
  report: (id: string) => call<Report>('GET', `/api/lessons/${id}/report`),
  pupil: (share: string) => call<PupilLesson>('GET', `/api/s/${share}`),
  submit: (share: string, level: Level, answers: Record<string, string>) => call<Marked>('POST', `/api/s/${share}/submit`, { level, answers }),
};

export function go(path: string) { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')); }

// Read a word aloud in the browser (listen-and-choose); the video uses Google TTS.
export function sayAloud(text: string, lang: 'vi' | 'en' = 'en') {
  try { const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'vi' ? 'vi-VN' : 'en-US'; u.rate = 0.85; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* no speech support */ }
}
