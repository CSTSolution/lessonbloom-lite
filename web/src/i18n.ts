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
export function useLang(): UiLang {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => lang);
}
export function useT<D extends { vi: object; en: object }>(dict: D): D['vi'] & D['en'] {
  return dict[useLang()] as D['vi'] & D['en'];
}
