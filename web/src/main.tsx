import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Admin } from './admin/Admin.tsx';
import { setLang, useLang } from './i18n.ts';
import { PupilRoutes } from './pupil/PupilRoutes.tsx';
import { TeacherRoutes } from './teacher/TeacherRoutes.tsx';
import './styles.css';

// A tab opened before a deploy asks for code files the new version no longer has (e.g. the .docx
// reader): reload once to get the new version. TeacherRoutes then says the app was updated.
addEventListener('vite:preloadError', (e) => {
  try {
    if (Date.now() - Number(sessionStorage.getItem('lb-reloaded') || 0) < 60_000) return;   // never loop
    sessionStorage.setItem('lb-reloaded', String(Date.now())); sessionStorage.setItem('lb-updated', '1');
  } catch { return; }
  e.preventDefault();
  location.reload();
});

// Routes. Teacher: / (lessons), /classes, /insights, /criteria, /new, /lesson/:id/:step.
// Pupil: /learn (join with class code), /learn/:pupilId[/practice|/cards|/memory|/video|/done].
export function usePath() {
  const [p, setP] = useState(location.pathname);
  useEffect(() => { const f = () => setP(location.pathname); addEventListener('popstate', f); return () => removeEventListener('popstate', f); }, []);
  return p;
}

export function LangToggle() {
  const lang = useLang();
  return (
    <div className="lang" role="group" aria-label="Ngôn ngữ / Language">
      {(['vi', 'en'] as const).map((l) => <button key={l} aria-pressed={l === lang} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
    </div>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#E6EEF8" />
      <path d="M16 7c3 4 3 8 0 11c-3-3-3-7 0-11zM8 14c5 0 7 3 8 6c-4 1-7-1-8-6zM24 14c-5 0-7 3-8 6c4 1 7-1 8-6z" fill="#1D5FA8" />
      <path d="M16 20v6" stroke="#1D5FA8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function App() {
  const path = usePath();
  if (path.startsWith('/admin')) return <Admin />;
  return path.startsWith('/learn') ? <PupilRoutes path={path} /> : <TeacherRoutes path={path} />;
}

document.documentElement.lang = (() => { try { return localStorage.getItem('lb-lang') || 'vi'; } catch { return 'vi'; } })();
createRoot(document.getElementById('root')!).render(<App />);
