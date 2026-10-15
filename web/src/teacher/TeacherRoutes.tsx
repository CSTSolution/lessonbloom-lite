// Teacher app: top bar + routes. The first visit creates this browser's demo workspace.
import { useEffect, useState } from 'react';
import { go, isDemo, leaveDemo, loadWorkspace, type Teacher } from '../api.ts';
import { refreshUser, resendVerification, signOut, useAuth } from '../auth.ts';
import { useT } from '../i18n.ts';
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
  vi: { signOut: 'Đăng xuất', demo: 'Bản dùng thử', register: 'Đăng ký để lưu bài của cô', verify: 'Cô mở email để xác nhận địa chỉ nhé.', resend: 'Gửi lại email', done: 'Tôi đã xác nhận', sent: 'Đã gửi' },
  en: { signOut: 'Sign out', demo: 'Demo', register: 'Register to keep your lessons', verify: 'Please confirm your email address from the email we sent.', resend: 'Resend email', done: 'I have confirmed', sent: 'Sent' },
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
        {isDemo() && <span className="chip amber" title={u.register}>{u.demo}</span>}
        <CreditPill path={path} />
        <span className="avatar">{teacher.name.replace(/^(Cô|Thầy)\s*/, '').slice(0, 1).toUpperCase()}</span><span>{teacher.name}</span>
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
  const u = useT(U);
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  if (!user || user.emailVerified) return null;
  return (
    <div className="note row" style={{ borderRadius: 0, justifyContent: 'center' }}>
      ✉️ {u.verify}
      <button className="btn sm" disabled={sent} onClick={async () => { await resendVerification(); setSent(true); }}>{sent ? u.sent : u.resend}</button>
      <button className="btn ghost sm" onClick={() => refreshUser()}>{u.done}</button>
    </div>
  );
}

export function TeacherRoutes({ path }: { path: string }) {
  const { ready, user } = useAuth();
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [err, setErr] = useState('');
  useEffect(() => { if (ready) loadWorkspace().then(setTeacher).catch((e) => setErr(String(e.message || e))); }, [ready, user?.uid]);
  if (err) return <p className="page error">{err}</p>;
  if (!ready || teacher === undefined) return <p className="page muted">…</p>;
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
