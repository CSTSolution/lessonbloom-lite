// Pieces every pupil screen uses: the lesson data (fetched once per pupil and kept for the
// session), the remembered pupil, which activities were visited today (progress through
// activities, never a score), the top bar and the empty / error states.
import { useEffect, useState, type ReactNode } from 'react';
import { go, pupilApi, type Learn } from '../api.ts';
import { useT } from '../i18n.ts';
import { LangToggle } from '../main.tsx';

// ----- remembered pupil (localStorage 'lb-pupil') -----
export interface SavedPupil { id: string; name: string; className: string; code: string }
const PUPIL_KEY = 'lb-pupil';
export function savedPupil(): SavedPupil | null {
  try { const v = JSON.parse(localStorage.getItem(PUPIL_KEY) || 'null'); return v && typeof v.id === 'string' ? v : null; } catch { return null; }
}
export function savePupil(p: SavedPupil | null) {
  try { if (p) localStorage.setItem(PUPIL_KEY, JSON.stringify(p)); else localStorage.removeItem(PUPIL_KEY); } catch { /* private mode */ }
}

// ----- lesson data, cached per pupil so moving between activities is instant -----
const cache = new Map<string, Promise<Learn>>();
export function loadLearn(pid: string, fresh = false): Promise<Learn> {
  let p = cache.get(pid);
  if (!p || fresh) {
    p = pupilApi.learn(pid);
    cache.set(pid, p);
    p.catch(() => cache.delete(pid));
  }
  return p;
}
export type LearnState = { learn: Learn | null; error: null | 'missing' | 'network'; reload: () => void };
export function useLearn(pid: string, fresh = false): LearnState {
  const [learn, setLearn] = useState<Learn | null>(null);
  const [error, setError] = useState<LearnState['error']>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    loadLearn(pid, fresh || n > 0).then((l) => { if (live) setLearn(l); }, (e: { status?: number }) => {
      if (!live) return;
      if (e.status === 404) { if (savedPupil()?.id === pid) savePupil(null); setError('missing'); } else setError('network');
    });
    return () => { live = false; };
  }, [pid, fresh, n]);
  return { learn, error, reload: () => setN((x) => x + 1) };
}

// ----- activities visited this session (sessionStorage), shown as "Con đã đi được" -----
export type Activity = 'video' | 'cards' | 'practice' | 'memory';
const visitKey = (pid: string) => `lb-visited-${pid}`;
export function visited(pid: string): Activity[] {
  try { const v = JSON.parse(sessionStorage.getItem(visitKey(pid)) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function markVisited(pid: string, a: Activity) {
  pupilApi.visit(pid, a).catch(() => {});            // the teacher's summary shows which parts were opened
  const v = visited(pid);
  if (v.includes(a)) return;
  try { sessionStorage.setItem(visitKey(pid), JSON.stringify([...v, a])); } catch { /* private mode */ }
}

// "finished today's lesson": set on the all-done screen, per pupil and assignment (this device only)
const finKey = (pid: string, aid?: string) => `lb-fin-${pid}-${aid || ''}`;
export function finished(pid: string, aid?: string): boolean { try { return !!aid && localStorage.getItem(finKey(pid, aid)) === '1'; } catch { return false; } }
export function markFinished(pid: string, aid?: string) { try { if (aid) localStorage.setItem(finKey(pid, aid), '1'); } catch { /* private mode */ } }

// a short burst of confetti; nothing moves when the device asks for reduced motion
export function Confetti() {
  const colors = ['#1D5FA8', '#F2A33A', '#3C9A5F', '#E0567A', '#8A5CC2', '#F6D04D'];
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 9) * 0.12}s`, animationDuration: `${2.2 + (i % 5) * 0.3}s`, transform: `rotate(${i * 29}deg)` }} />
      ))}
    </div>
  );
}

// ----- small UI pieces -----
const D = {
  vi: { back: 'Quay lại', loading: 'Đang tải bài…', missingH: 'Cô chưa thấy con trong lớp', missingB: 'Con vào lại bằng mã lớp nhé.', rejoin: 'Vào lại bằng mã lớp',
    netH: 'Mạng đang chậm', netB: 'Con chờ một chút rồi thử lại nhé.', retry: 'Thử lại', noneH: 'Cô chưa giao bài nào', noneB: 'Khi cô giao bài mới, bài sẽ hiện ở đây. Con quay lại sau nhé!', home: 'Về trang bài học' },
  en: { back: 'Back', loading: 'Loading your lesson…', missingH: 'We can’t find you in the class', missingB: 'Please join again with the class code.', rejoin: 'Join with class code',
    netH: 'The connection is slow', netB: 'Wait a moment and try again.', retry: 'Try again', noneH: 'No lesson yet', noneB: 'When your teacher gives you a lesson, it will show up here. Come back later!', home: 'Back to the lesson' },
};

export function BackButton({ to }: { to: string }) {
  const t = useT(D);
  return (
    <button className="back" aria-label={t.back} onClick={() => go(to)}>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4l-6 6l6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

/** Top row: back button, a middle slot (title or progress dots), language toggle. */
// screen title + instruction: up to 2 lines each; a tap shows the whole text, another tap folds it again
export function Head({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className={`p-head ${open ? 'open' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="t">{title}</span>{sub ? <span className="s">{sub}</span> : null}
    </button>
  );
}

export function TopBar({ back, children }: { back?: string; children?: ReactNode }) {
  return (
    <div className="pupil-top">
      {back && <BackButton to={back} />}
      {children ?? <span className="p-spacer" />}
      <LangToggle />
    </div>
  );
}

export function Flower({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 132 132" aria-hidden="true">
      <circle cx="66" cy="66" r="62" fill="#FFE7CC" />
      <ellipse cx="66" cy="40" rx="15" ry="22" fill="#F2A65A" />
      <ellipse cx="42" cy="62" rx="22" ry="15" fill="#F2A65A" />
      <ellipse cx="90" cy="62" rx="22" ry="15" fill="#F2A65A" />
      <circle cx="66" cy="62" r="18" fill="#1D5FA8" />
      <circle cx="60" cy="58" r="2.6" fill="#FFFFFF" />
      <circle cx="72" cy="58" r="2.6" fill="#FFFFFF" />
      <path d="M59 67q7 6 14 0" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M66 80v30" stroke="#2E7D4F" strokeWidth="5" strokeLinecap="round" />
      <path d="M66 98q-14-2-18-12q12 0 18 10z" fill="#2E7D4F" />
    </svg>
  );
}

export function Star({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 104 104" aria-hidden="true">
      <circle cx="52" cy="52" r="48" fill="#FFE7CC" />
      <path d="M52 20l9 19l21 3l-15 14l4 21l-19-10l-19 10l4-21l-15-14l21-3z" fill="#F2A65A" stroke="#B4561A" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function SpeakerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 8h3l4-3v10l-4-3H3z" fill="#1D5FA8" />
      <path d="M13 7q2 3 0 6M15.5 5q3.5 5 0 10" fill="none" stroke="#1D5FA8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Renders loading / not-found / network / no-lesson states, or the screen itself once the
 * lesson is here. `needLesson` = the screen can't work without an assigned lesson.
 */
export function Gate({ pid, state, children, needLesson = true }: { pid: string; state: LearnState; needLesson?: boolean;
  children: (learn: Learn, lesson: NonNullable<Learn['lesson']>) => ReactNode }) {
  const t = useT(D);
  const { learn, error } = state;
  if (error === 'missing') return (<><TopBar /><Empty title={t.missingH} body={t.missingB} action={t.rejoin} onAction={() => go('/learn')} /></>);
  if (error === 'network') return (<><TopBar back={`/learn/${pid}`} /><Empty title={t.netH} body={t.netB} action={t.retry} onAction={state.reload} /></>);
  if (!learn) return (<><TopBar /><div className="p-loading" role="status">{t.loading}</div></>);
  if (!learn.lesson) {
    if (!needLesson) return <>{children(learn, null as never)}</>;
    return (<><TopBar back={`/learn/${pid}`} /><Empty title={t.noneH} body={t.noneB} action={t.home} onAction={() => go(`/learn/${pid}`)} /></>);
  }
  return <>{children(learn, learn.lesson)}</>;
}

export function Empty({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <div className="p-center" style={{ padding: '40px 0' }}>
      <Flower size={88} />
      <h1 style={{ fontSize: 26 }}>{title}</h1>
      <p className="p-sub">{body}</p>
      {action && <button className="p-btn" style={{ marginTop: 10 }} onClick={onAction}>{action}</button>}
    </div>
  );
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
