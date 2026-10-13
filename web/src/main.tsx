import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { go } from './api.ts';
import { setUiLang, useT } from './i18n.ts';
import { Create } from './pages/Create.tsx';
import { LessonPage } from './pages/LessonPage.tsx';
import { Pupil } from './pages/Pupil.tsx';
import './styles.css';

function usePath() {
  const [p, setP] = useState(location.pathname);
  useEffect(() => { const f = () => setP(location.pathname); addEventListener('popstate', f); return () => removeEventListener('popstate', f); }, []);
  return p;
}

function App() {
  const path = usePath();
  const [, lang] = useT();
  const lesson = /^\/lesson\/(\w+)/.exec(path)?.[1], share = /^\/s\/(\w+)/.exec(path)?.[1];
  return (
    <>
      <header className={share ? 'top pupil-top' : 'top'}>
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); if (!share) go('/'); }}>🌸 LessonBloom</a>
        <div className="langs">
          {(['vi', 'en'] as const).map((l) => <button key={l} className={l === lang ? 'on' : ''} onClick={() => setUiLang(l)}>{l.toUpperCase()}</button>)}
        </div>
      </header>
      <main>{share ? <Pupil share={share} /> : lesson ? <LessonPage id={lesson} /> : <Create />}</main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
