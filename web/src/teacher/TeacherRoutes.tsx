// Teacher app: top bar + routes. The first visit creates this browser's demo workspace.
import { useEffect, useState } from 'react';
import { go, isDemo, leaveDemo, loadWorkspace, type Teacher } from '../api.ts';
import { authError, refreshUser, resendVerification, signOut, useAuth } from '../auth.ts';
import { useLang, useT } from '../i18n.ts';
import { LangToggle, Logo } from '../main.tsx';
import { Classes } from './Classes.tsx';
import { Create } from './Create.tsx';
import { Criteria } from './Criteria.tsx';
import { T } from './dict.ts';
import { Home } from './Home.tsx';
import { Insights } from './Insights.tsx';
import { LessonFlow } from './LessonFlow.tsx';
import { Login } from './Login.tsx';
import { Usage } from './Usage.tsx';
import { teacherApi, type Usage as UsageT } from '../api.ts';
import './teacher.css';

export function Link({ to, children, className, ...rest }: { to: string; children: React.ReactNode; className?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={to} className={className} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(to); }} {...rest}>{children}</a>;
}

const U = {
  vi: { signOut: 'Đăng xuất', demo: 'Bản dùng thử', register: 'Đăng ký để lưu bài của cô',
    verify: (e: string) => `Cô mở email gửi tới ${e} và bấm đường link xác nhận (xem cả mục Spam) để dùng AI.`, resend: 'Gửi lại email', done: 'Tôi đã xác nhận', sent: 'Đã gửi lại',
    notYet: 'Chưa thấy xác nhận. Cô bấm đường link trong email rồi bấm lại nút này nhé.', verified: 'Đã xác nhận email! Cô dùng AI được rồi.', checking: 'Đang kiểm tra…',
    loadErr: 'Chưa tải được trang.', retry: 'Thử lại', loading: 'Đang tải…' },
  en: { signOut: 'Sign out', demo: 'Demo', register: 'Register to keep your lessons',
    verify: (e: string) => `Open the email we sent to ${e} and click the confirmation link (check Spam too) to use AI.`, resend: 'Resend email', done: 'I have confirmed', sent: 'Sent again',
    notYet: 'Not confirmed yet. Click the link in the email, then press this button again.', verified: 'Email confirmed! You can use AI now.', checking: 'Checking…',
    loadErr: 'The page could not load.', retry: 'Try again', loading: 'Loading…' },
};

export function TopBar({ teacher, path, onSignOut }: { teacher: Teacher; path: string; onSignOut: () => void }) {
  const t = useT(T), u = useT(U);
  const nav: [string, string][] = [['/', t.navLessons], ['/classes', t.navClasses], ['/insights', t.navInsights], ['/criteria', t.navCriteria]];
  const on = (p: string) => (p === '/' ? path === '/' || path.startsWith('/new') || path.startsWith('/lesson') : path.startsWith(p));
  return (
    <header className="topbar">
      <Link to="/" className="logo"><Logo /> LessonBloom</Link>
      <nav className="nav" aria-label="Main">{nav.map(([p, l]) => <Link key={p} to={p} className={on(p) ? 'on' : ''} aria-current={on(p) ? 'page' : undefined}>{l}</Link>)}</nav>
      <div className="row">
        <LangToggle />
        {isDemo() && <span className="chip amber hide-sm" title={u.register}>{u.demo}</span>}
        <CreditPill path={path} />
        <span className="avatar" title={teacher.name}>{teacher.name.replace(/^(Cô|Thầy)\s*/, '').slice(0, 1).toUpperCase()}</span><span className="hide-sm">{teacher.name}</span>
        <button className="btn ghost sm" onClick={onSignOut}>{u.signOut}</button>
      </div>
    </header>
  );
}

// "⚡ 10/30" credits left today (or PRO), links to the usage page; refreshes on navigation
function CreditPill({ path }: { path: string }) {
  const [u, setU] = useState<UsageT | null>(null);
  useEffect(() => { teacherApi.usage().then(setU).catch(() => {}); }, [path]);
  if (!u) return null;
  return <Link to="/usage" className={`chip ${u.plan === 'pro' ? 'green' : 'blue'}`} title="AI">{u.plan === 'pro' ? 'PRO' : `⚡ ${Math.max(0, (u.limit ?? 0) - u.usedToday)}/${u.limit}`}</Link>;
}

function VerifyBanner() {
  const u = useT(U), lang = useLang();
  const { user } = useAuth();
  const [state, setState] = useState<'' | 'sent' | 'checking' | 'notYet' | 'verified'>('');
  const [err, setErr] = useState<unknown>(null);
  const check = async () => { setState('checking'); setErr(null); try { setState((await refreshUser()) ? 'verified' : 'notYet'); } catch (e) { setErr(e); setState(''); } };
  // back from the confirmation link (?verified=1) while signed in: check straight away
  useEffect(() => {
    if (new URLSearchParams(location.search).has('verified')) { history.replaceState(null, '', location.pathname); if (user) check(); }
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (state === 'verified') { const id = setTimeout(() => setState(''), 6000); return () => clearTimeout(id); } }, [state]);
  if (state === 'verified') return <div className="ok-note" role="status" style={{ borderRadius: 0, textAlign: 'center' }}>✓ {u.verified}</div>;
  if (!user || user.emailVerified) return null;
  return (
    <div className="note verify-banner" role="status">
      <span>✉️ {u.verify(user.email || '')}</span>
      <span className="row" style={{ gap: 8 }}>
        <button className="btn sm" disabled={state === 'sent'} onClick={async () => { setErr(null); try { await resendVerification(); setState('sent'); } catch (e) { setErr(e); } }}>{state === 'sent' ? u.sent : u.resend}</button>
        <button className="btn primary sm" disabled={state === 'checking'} onClick={check}>{state === 'checking' ? u.checking : u.done}</button>
      </span>
      {state === 'notYet' && <span className="small" style={{ color: 'var(--amber)', width: '100%' }}>{u.notYet}</span>}
      {!!err && <span className="small error" style={{ width: '100%' }}>{authError(err, lang)}</span>}
    </div>
  );
}

export function TeacherRoutes({ path }: { path: string }) {
  const { ready, user } = useAuth();
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const u = useT(U);
  const [err, setErr] = useState(''), [tries, setTries] = useState(0);
  useEffect(() => { if (ready) { setErr(''); loadWorkspace().then(setTeacher).catch((e) => setErr(String(e.message || e))); } }, [ready, user?.uid, tries]);
  if (err) return (
    <main className="page narrow"><div className="card stack" style={{ alignItems: 'flex-start' }}>
      <h2>{u.loadErr}</h2><p className="error" style={{ margin: 0 }}>{err}</p>
      <button className="btn primary" onClick={() => { setTeacher(undefined); setTries(tries + 1); }}>{u.retry}</button>
    </div></main>
  );
  if (!ready || teacher === undefined) return <p className="page muted" role="status">{u.loading}</p>;
  if (!teacher) return <Login onReady={setTeacher} />;
  const out = async () => { if (user) await signOut(); else leaveDemo(); setTeacher(null); go('/'); };
  const m = /^\/lesson\/(\w+)(?:\/(\w+))?/.exec(path);
  let body: React.ReactNode;
  if (m) body = <LessonFlow id={m[1]} step={m[2] || 'slides'} />;
  else if (path.startsWith('/new')) body = <Create />;
  else if (path.startsWith('/classes')) body = <Classes />;
  else if (path.startsWith('/insights')) body = <Insights />;
  else if (path.startsWith('/usage')) body = <Usage />;
  else if (path.startsWith('/criteria')) body = <Criteria teacher={teacher} onSaved={setTeacher} />;
  else body = <Home teacher={teacher} />;
  return <><TopBar teacher={teacher} path={path} onSignOut={out} /><VerifyBanner />{body}</>;
}
