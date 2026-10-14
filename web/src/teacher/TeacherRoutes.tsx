// Teacher app: top bar + routes. The first visit creates this browser's demo workspace.
import { useEffect, useState } from 'react';
import { ensureWorkspace, go, type Teacher } from '../api.ts';
import { useT } from '../i18n.ts';
import { LangToggle, Logo } from '../main.tsx';
import { Classes } from './Classes.tsx';
import { Create } from './Create.tsx';
import { Criteria } from './Criteria.tsx';
import { T } from './dict.ts';
import { Home } from './Home.tsx';
import { Insights } from './Insights.tsx';
import { LessonFlow } from './LessonFlow.tsx';
import './teacher.css';

export function Link({ to, children, className, ...rest }: { to: string; children: React.ReactNode; className?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={to} className={className} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(to); }} {...rest}>{children}</a>;
}

export function TopBar({ teacher, path }: { teacher: Teacher; path: string }) {
  const t = useT(T);
  const nav: [string, string][] = [['/', t.navLessons], ['/classes', t.navClasses], ['/insights', t.navInsights], ['/criteria', t.navCriteria]];
  const on = (p: string) => (p === '/' ? path === '/' || path.startsWith('/new') || path.startsWith('/lesson') : path.startsWith(p));
  return (
    <header className="topbar">
      <Link to="/" className="logo"><Logo /> LessonBloom</Link>
      <nav className="nav" aria-label="Main">{nav.map(([p, l]) => <Link key={p} to={p} className={on(p) ? 'on' : ''} aria-current={on(p) ? 'page' : undefined}>{l}</Link>)}</nav>
      <div className="row"><LangToggle /><span className="avatar">{teacher.name.replace(/^Cô\s*/, '').slice(0, 1)}</span><span>{teacher.name}</span></div>
    </header>
  );
}

export function TeacherRoutes({ path }: { path: string }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { ensureWorkspace().then(setTeacher).catch((e) => setErr(String(e.message || e))); }, []);
  if (err) return <p className="page error">{err}</p>;
  if (!teacher) return <p className="page muted">…</p>;
  const m = /^\/lesson\/(\w+)(?:\/(\w+))?/.exec(path);
  let body: React.ReactNode;
  if (m) body = <LessonFlow id={m[1]} step={m[2] || 'slides'} />;
  else if (path.startsWith('/new')) body = <Create />;
  else if (path.startsWith('/classes')) body = <Classes />;
  else if (path.startsWith('/insights')) body = <Insights />;
  else if (path.startsWith('/criteria')) body = <Criteria teacher={teacher} onSaved={setTeacher} />;
  else body = <Home teacher={teacher} />;
  return <><TopBar teacher={teacher} path={path} />{body}</>;
}
