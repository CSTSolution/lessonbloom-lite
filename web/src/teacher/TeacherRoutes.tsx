// Teacher app: top bar + routes. The first visit creates this browser's demo workspace.
import { useEffect, useState } from 'react';
import { go, goRegister, isDemo, leaveDemo, loadWorkspace, type Teacher } from '../api.ts';
import { refreshUser, signOut, useAuth } from '../auth.ts';
import { getLang, useT } from '../i18n.ts';
import { LangToggle, Logo } from '../main.tsx';
import { Classes } from './Classes.tsx';
import { Create } from './Create.tsx';
import { Criteria } from './Criteria.tsx';
import { T } from './dict.ts';
import { Home } from './Home.tsx';
import { Insights } from './Insights.tsx';
import { Account } from './Account.tsx';
import { AssignmentSummary } from './AssignmentSummary.tsx';
import { LessonFlow } from './LessonFlow.tsx';
import { Login } from './Login.tsx';
import { Usage } from './Usage.tsx';
import { Pupil } from './Pupil.tsx';
import { teacherApi, type Usage as UsageT } from '../api.ts';
import './teacher.css';

export function Link({ to, children, className, ...rest }: { to: string; children: React.ReactNode; className?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={to} className={className} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(to); }} {...rest}>{children}</a>;
}

const U = {
  vi: { registerShort: 'Đăng ký', signOut: 'Đăng xuất', account: 'Tài khoản của tôi', demo: 'Bản dùng thử', register: 'Đăng ký để lưu bài của cô',
    verify: (e: string) => `Xác nhận email ${e} để dùng AI.`, send: 'Gửi mã xác nhận', sentTo: (e: string) => `Đã gửi mã 6 số tới ${e} (xem cả mục Spam).`,
    codePh: 'Mã 6 số', confirm: 'Xác nhận', resend: 'Gửi lại mã', resendIn: (s: number) => `Gửi lại sau ${s} giây`, codeShort: 'Cô nhập đủ 6 số nhé.',
    verified: 'Đã xác nhận email! Cô dùng AI được rồi.', busy: 'Đang gửi…', checking: 'Đang xác nhận…',
    updated: 'LessonBloom vừa có phiên bản mới nên trang đã tải lại. Nội dung cô đã dán vẫn còn; nếu cô đang chọn file, hãy chọn lại nhé.', loadErr: 'Chưa tải được trang.', retry: 'Thử lại', loading: 'Đang tải…' },
  en: { registerShort: 'Register', signOut: 'Sign out', account: 'My account', demo: 'Demo', register: 'Register to keep your lessons',
    verify: (e: string) => `Confirm ${e} to use AI.`, send: 'Send verification code', sentTo: (e: string) => `A 6-digit code was sent to ${e} (check Spam too).`,
    codePh: '6-digit code', confirm: 'Confirm', resend: 'Send a new code', resendIn: (s: number) => `New code in ${s} s`, codeShort: 'Please enter all 6 digits.',
    verified: 'Email confirmed! You can use AI now.', busy: 'Sending…', checking: 'Checking…',
    updated: 'LessonBloom has just been updated, so the page reloaded. Text you pasted is still there; if you were picking a file, please pick it again.', loadErr: 'The page could not load.', retry: 'Try again', loading: 'Loading…' },
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
        {isDemo() && <button className="chip amber hide-sm" style={{ border: 0, cursor: 'pointer', font: 'inherit' }} title={u.register} onClick={goRegister}>{u.demo} · {u.registerShort}</button>}
        <CreditPill path={path} />
        <Link to="/account" className={`me ${path.startsWith('/account') ? 'on' : ''}`} title={u.account}><span className="avatar">{teacher.name.replace(/^(Cô|Thầy)\s*/, '').slice(0, 1).toUpperCase()}</span><span className="hide-sm hide-md">{teacher.name}</span></Link>
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
  return <Link to="/usage" className={`chip ${u.plan === 'pro' ? 'green' : 'blue'}`} title={getLang() === 'en' ? 'AI credits left today' : 'Lượt AI còn lại hôm nay'}>{u.plan === 'pro' ? 'PRO' : `⚡ ${Math.max(0, (u.limit ?? 0) - u.usedToday)}/${u.limit}`}</Link>;
}

// For accounts made before registration used codes: confirm the email with a 6-digit code
function VerifyBanner() {
  const u = useT(U);
  const { user } = useAuth();
  const [state, setState] = useState<'' | 'sending' | 'sent' | 'checking' | 'verified'>('');
  const [code, setCode] = useState(''), [wait, setWait] = useState(0), [err, setErr] = useState('');
  useEffect(() => { if (wait > 0) { const id = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(id); } }, [wait]);
  useEffect(() => { if (state === 'verified') { const id = setTimeout(() => setState(''), 6000); return () => clearTimeout(id); } }, [state]);
  const send = async () => {
    setErr(''); setState('sending');
    try { const r = await teacherApi.verifySend(); if (r.verified) { await refreshUser(); setState('verified'); } else { setState('sent'); setWait(60); } }
    catch (e) { setErr((e as Error).message); setWait((e as { retryIn?: number }).retryIn || 0); setState(code || wait ? 'sent' : ''); }
  };
  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setErr(u.codeShort);
    setErr(''); setState('checking');
    try { await teacherApi.verify(code); await refreshUser(); setState('verified'); } catch (x) { setErr((x as Error).message); setState('sent'); }
  };
  if (state === 'verified') return <div className="ok-note" role="status" style={{ borderRadius: 0, textAlign: 'center' }}>✓ {u.verified}</div>;
  if (!user || user.emailVerified) return null;
  const sent = state === 'sent' || state === 'checking';
  return (
    <div className="note verify-banner" role="status">
      <span>✉️ {sent ? u.sentTo(user.email || '') : u.verify(user.email || '')}</span>
      {sent ? (
        <form className="row" style={{ gap: 8 }} onSubmit={confirm}>
          <input className="code-input sm" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder={u.codePh} aria-label={u.codePh}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button className="btn primary sm" disabled={state === 'checking'}>{state === 'checking' ? u.checking : u.confirm}</button>
          <button type="button" className="btn ghost sm" disabled={wait > 0} onClick={send}>{wait > 0 ? u.resendIn(wait) : u.resend}</button>
        </form>
      ) : <button className="btn primary sm" disabled={state === 'sending'} onClick={send}>{state === 'sending' ? u.busy : u.send}</button>}
      {err && <span className="small error" style={{ width: '100%' }}>{err}</span>}
    </div>
  );
}

// after the automatic reload for a new version (main.tsx)
function UpdatedNote() {
  const u = useT(U);
  const [on, setOn] = useState(() => { try { const v = sessionStorage.getItem('lb-updated') === '1'; sessionStorage.removeItem('lb-updated'); return v; } catch { return false; } });
  if (!on) return null;
  return <div className="note row" role="status" style={{ borderRadius: 0, justifyContent: 'center' }}><span>↻ {u.updated}</span><button className="link-btn" onClick={() => setOn(false)}>✕</button></div>;
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
  let body: React.ReactNode, pm: RegExpExecArray | null;
  if (m) body = <LessonFlow id={m[1]} step={m[2] || 'slides'} />;
  else if (path.startsWith('/new')) body = <Create teacher={teacher} />;
  else if ((pm = /^\/classes\/(\w+)\/pupil\/(\w+)/.exec(path))) body = <Pupil cid={pm[1]} pid={pm[2]} />;
  else if ((pm = /^\/classes\/\w+\/a\/(\w+)/.exec(path))) body = <AssignmentSummary aid={pm[1]} />;
  else if (path.startsWith('/classes')) body = <Classes teacher={teacher} />;
  else if (path.startsWith('/insights')) body = <Insights />;
  else if (path.startsWith('/usage')) body = <Usage />;
  else if (path.startsWith('/account')) body = <Account teacher={teacher} onSaved={setTeacher} onSignOut={out} />;
  else if (path.startsWith('/criteria')) body = <Criteria teacher={teacher} onSaved={setTeacher} />;
  else body = <Home teacher={teacher} />;
  return <><TopBar teacher={teacher} path={path} onSignOut={out} /><VerifyBanner /><UpdatedNote />{body}</>;
}
