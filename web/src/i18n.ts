// VI/EN for every screen. Each screen keeps its own small dictionary next to its code
// (wording copied from Chi's canvas, docs/design/canvas) and reads it with useT(dict).
import { useSyncExternalStore } from 'react';

export type UiLang = 'vi' | 'en';
let lang: UiLang = (() => { try { return (localStorage.getItem('lb-lang') as UiLang) || 'vi'; } catch { return 'vi'; } })();
const subs = new Set<() => void>();

export function setLang(l: UiLang) {
  lang = l;
  try { localStorage.setItem('lb-lang', l); } catch { /* private mode */ }
  document.documentElement.lang = l;
  subs.forEach((f) => f());
}
export const getLang = () => lang;
// server text that comes in both languages (API errors, lesson progress); old data is a plain string
export type Bi = string | { vi: string; en: string };
export const pick = (m: Bi, l: UiLang = lang) => (typeof m === 'string' ? m : m[l] || m.vi);

export function useLang(): UiLang {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => lang);
}
export function useT<D extends { vi: object; en: object }>(dict: D): D['vi'] & D['en'] {
  return dict[useLang()] as D['vi'] & D['en'];
}

// "Lớp 2A" from a class name, without doubling it when the teacher already wrote "Lớp TômCua" / "Class 3B"
export const withCls = (word: string, name: string) => (/^\s*(lớp|class)(\s|$)/i.test(name) ? name.trim() : `${word} ${name}`);
export const withClsList = (word: string, names: string[]) => (names.some((n) => /^\s*(lớp|class)(\s|$)/i.test(n)) ? names.map((n) => withCls(word, n)).join(', ') : `${word} ${names.join(', ')}`);
