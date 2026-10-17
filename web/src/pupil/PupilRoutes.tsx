// Pupil side: /learn (join with class code), /learn/:pid (today's
// lesson) and its activities: /video, /cards, /practice, /memory, /done.
// Product rules: no scores, percentages, rankings or labels are ever shown to a pupil.
import { Done } from './Done.tsx';
import { Flashcards } from './Flashcards.tsx';
import { Hub } from './Hub.tsx';
import { Join } from './Join.tsx';
import { Memory } from './Memory.tsx';
import { Practice } from './Practice.tsx';
import { Video } from './Video.tsx';
import './pupil.css';

const THEME: Record<string, string> = { cards: 'theme-green', memory: 'theme-purple' };

export function PupilRoutes({ path }: { path: string }) {
  const [, , pidRaw, page = ''] = path.replace(/\/+$/, '').split('/');   // '', 'learn', pid, page
  const pid = pidRaw ? decodeURIComponent(pidRaw) : '';
  const key = `${path}${location.search}`;
  let screen;
  if (!pid) screen = <Join key={key} />;
  else if (page === 'video') screen = <Video key={key} pid={pid} />;
  else if (page === 'cards') screen = <Flashcards key={key} pid={pid} />;
  else if (page === 'practice') screen = <Practice key={key} pid={pid} />;
  else if (page === 'memory') screen = <Memory key={key} pid={pid} />;
  else if (page === 'done') screen = <Done key={key} pid={pid} />;
  else screen = <Hub key={key} pid={pid} />;
  return (
    <div className={`pupil-app ${THEME[page] || ''}`}>
      <main className="pupil-wrap">{screen}</main>
    </div>
  );
}
