// API client. Teacher calls carry the workspace key (x-teacher) kept in this browser; the first
// visit creates a seeded demo workspace. Pupil calls carry only the pupil id they joined with.
import type { Assignment, ClassRoom, Criteria, Exercise, Flashcard, Intake, Label, Lesson, Level, MemoryPair, Pupil, Skill, Slide, Teacher } from '../../server/types.ts';
export type { Assignment, ClassRoom, Criteria, Exercise, Flashcard, Intake, Label, Lesson, Level, MemoryPair, Pupil, Skill, Slide, Teacher };

import { currentUser, displayName, idToken } from './auth.ts';
import { getLang } from './i18n.ts';

const KEY = 'lb-teacher';
const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };

async function call<T>(method: string, path: string, body?: unknown, teacher = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (teacher) {
    // signed-in teachers send their Firebase ID token; otherwise the demo workspace key
    const tok = await idToken();
    if (tok) { headers.authorization = `Bearer ${tok}`; const n = displayName(); if (n) headers['x-teacher-name'] = encodeURIComponent(n); }
    else headers['x-teacher'] = getKey();
  }
  const en = getLang() === 'en';
  let r: Response;
  try { r = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch { throw Object.assign(new Error(en ? 'No connection. Please check the network and try again.' : 'Mất kết nối mạng. Cô kiểm tra mạng rồi thử lại nhé.'), { status: 0 }); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    // the server sends both languages: error (VI) and errorEn
    const msg = (en ? j.errorEn || j.error : j.error) || (en ? `The server could not finish this (error ${r.status}). Please try again.` : `Máy chủ chưa làm xong việc này (lỗi ${r.status}). Cô thử lại nhé.`);
    throw Object.assign(new Error(msg), { status: r.status, code: j.code as string | undefined, limit: j.limit as string | undefined });
  }
  return j as T;
}
const tc = <T,>(method: string, path: string, body?: unknown) => call<T>(method, `/api/t${path}`, body, true);

// Signed in: the account's workspace (created on first visit). Otherwise the demo workspace in
// this browser, if there is one. Returns null when the visitor should see the sign-in page.
export async function loadWorkspace(): Promise<Teacher | null> {
  if (currentUser() || getKey()) {
    try { return await tc<Teacher>('GET', '/me'); } catch (e) { if ((e as { status?: number }).status !== 403) throw e; }
  }
  return null;
}
export async function startDemo(): Promise<Teacher> {
  const { teacher, key } = await call<{ teacher: Teacher; key: string }>('POST', '/api/t/me', {});
  try { localStorage.setItem(KEY, key); } catch { /* private mode: workspace lasts this tab */ }
  return teacher;
}
export const isDemo = () => !currentUser() && !!getKey();
export function leaveDemo() { try { localStorage.removeItem(KEY); } catch { /* ok */ } }

export interface LessonCard { id: string; title: string; subject: string; grade: number; status: string; createdAt: string; slides: number; exercises: number; flashcards: number; video: boolean; cover: string; classes: string[] }
export interface ClassCard extends ClassRoom { pupils: number; joined: number; assignments: number }
export interface ClassDetail extends ClassRoom { pupils: Pupil[]; assignments: (Assignment & { title: string; done: number; total: number })[] }
export interface PupilSkill { pupilId: string; name: string; label: Label; right: number; total: number; topError?: string }
export interface SkillSummary { skill: string; skillName: string; classLabel: Label; pupils: PupilSkill[]; errors: { errorType: string; count: number; pupils: string[]; example?: string }[] }
export interface Usage { plan: 'demo' | 'free' | 'pro'; limit: number | null; usedToday: number; costs: Record<string, number>; proRequestedAt: string | null;
  days: { day: string; credits: number; actions: Record<string, number>; usd: number; calls: number }[] }
export interface Insights { lessons: { id: string; title: string }[]; lessonId: string; classId: string; classes: { id: string; name: string }[];
  overview: { skill: string; name: string; byClass: Record<string, Label | null> }[]; detail: SkillSummary[] | null }

export const teacherApi = {
  me: () => tc<Teacher>('GET', '/me'),
  saveCriteria: (c: Partial<Criteria>) => tc<Teacher>('PUT', '/me/criteria', c),
  classes: () => tc<ClassCard[]>('GET', '/classes'),
  klass: (id: string) => tc<ClassDetail>('GET', `/classes/${id}`),
  addClass: (name: string, names: string[]) => tc<ClassRoom>('POST', '/classes', { name, names }),
  addPupils: (id: string, names: string[]) => tc<Pupil[]>('POST', `/classes/${id}/pupils`, { names }),
  lessons: () => tc<LessonCard[]>('GET', '/lessons'),
  intake: (source: string) => tc<Intake>('POST', '/intake', { source }),
  create: (source: string, intake: Intake) => tc<{ id: string }>('POST', '/lessons', { source, intake }),
  lesson: (id: string) => tc<Lesson>('GET', `/lessons/${id}`),
  save: (id: string, patch: Partial<Pick<Lesson, 'slides' | 'exercises' | 'flashcards' | 'pairs'>>) => tc<Lesson>('PUT', `/lessons/${id}`, patch),
  slideAction: (id: string, sid: string, action: 'rewrite' | 'simpler' | 'image') => tc<Slide>('POST', `/lessons/${id}/slides/${sid}`, { action }),
  makeVideo: (id: string, o: { speed: number; subtitles: boolean; voice?: string }) => tc<Lesson['video']>('POST', `/lessons/${id}/video`, o),
  assign: (b: { lessonId: string; classId: string; dueAt?: string; allowRetry: boolean; autoSuggest: boolean }) => tc<Assignment & { joinCode: string }>('POST', '/assignments', b),
  insights: (lessonId?: string, classId?: string) => tc<Insights>('GET', `/insights?${new URLSearchParams({ ...(lessonId ? { lessonId } : {}), ...(classId ? { classId } : {}) })}`),
  usage: () => tc<Usage>('GET', '/usage'),
  proRequest: () => tc<{ proRequestedAt: string }>('POST', '/pro-request'),
  comments: (lessonId: string, classId: string) => tc<{ pupilId: string; text: string }[]>('POST', '/insights/comments', { lessonId, classId }),
};

// ----- pupil -----
export type PupilExercise = Omit<Exercise, 'answer' | 'explain' | 'expr'> & Record<string, any>;
export interface Learn {
  name: string; className: string; assignmentId?: string; dueAt?: string; reminder: string | null; done?: string[];
  lesson: null | { title: string; subject: 'math' | 'english'; grade: number; lang: 'vi' | 'en'; skills: Skill[]; slides: Omit<Slide, 'notes' | 'source' | 'imagePrompt'>[];
    video: string | null; videoSeconds?: number; exercises: PupilExercise[]; flashcards: Flashcard[]; pairs: MemoryPair[] };
}
export interface AnswerResult { correct: boolean; hint?: string; explain?: string; retry: boolean }
export interface NextStep { kind: 'same' | 'harder'; skill: string; skillName: string; reason?: string; exercises: PupilExercise[] }

export const pupilApi = {
  roster: (code: string) => call<{ className: string; pupils: { id: string; name: string }[] }>('GET', `/api/join/${encodeURIComponent(code.trim())}`),
  join: (code: string, pupilId: string) => call<{ pupilId: string; name: string; className: string }>('POST', '/api/join', { code, pupilId }),
  learn: (pid: string) => call<Learn>('GET', `/api/learn/${pid}`),
  answer: (pid: string, b: { assignmentId: string; exerciseId: string; answer: string; session: string }) => call<AnswerResult>('POST', `/api/learn/${pid}/answer`, b),
  next: (pid: string) => call<NextStep[]>('GET', `/api/learn/${pid}/next`),
  selfcheck: (pid: string, mood: 'easy' | 'ok' | 'hard') => call<{ ok: true }>('POST', `/api/learn/${pid}/selfcheck`, { mood }),
};

export function go(path: string) { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')); scrollTo(0, 0); }

// Read aloud in the browser (listen-and-choose, flashcards). The lesson video uses Google TTS.
export function sayAloud(text: string, lang: 'vi' | 'en' = 'en') {
  try { const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'vi' ? 'vi-VN' : 'en-US'; u.rate = 0.85; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* no speech */ }
}
export const session = () => new Date().toISOString().slice(0, 10);
