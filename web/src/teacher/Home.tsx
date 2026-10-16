// Screen 01 · "Bài giảng của tôi": lesson cards, subject and class filters, this week's summary;
// for an account, the getting-started guide (accounts start empty) and, if it still has demo data, a way to clear it.
import { useEffect, useState } from 'react';
import { go, teacherApi, type ClassCard, type Insights, type LessonCard, type StartState, type Teacher } from '../api.ts';
import { GuideCard } from './Guide.tsx';
import { useT, withCls, withClsList } from '../i18n.ts';
import { T } from './dict.ts';
import { Link } from './TeacherRoutes.tsx';

const M = {
  vi: { menu: 'Thao tác với bài', open: 'Mở bài', copy: 'Nhân bản', print: 'In / PDF', del: 'Xoá bài', copying: 'Đang nhân bản…',
    copied: (x: string) => `Đã tạo bản sao “${x}”: giữ nguyên slide, video và bài tập, chưa giao cho lớp nào (bản nháp).`, copyChip: 'Bản sao',
    teaches: 'Cô dạy:', subj: { math: 'Toán', english: 'Tiếng Anh', both: 'Toán và Tiếng Anh' } as Record<string, string>, profile: 'Đổi môn và lớp trong Hồ sơ ›' },
  en: { menu: 'Lesson actions', open: 'Open', copy: 'Duplicate', print: 'Print / PDF', del: 'Delete lesson', copying: 'Duplicating…',
    copied: (x: string) => `Created the copy “${x}”: same slides, video and exercises, not assigned to any class yet (draft).`, copyChip: 'Copy',
    teaches: 'You teach:', subj: { math: 'Maths', english: 'English', both: 'Maths and English' } as Record<string, string>, profile: 'Change subject and classes in your profile ›' },
};

// "⋯" on a lesson card: open, duplicate (stays on this page and says what happened), print, delete
function CardMenu({ l, onDone, onNote }: { l: LessonCard; onDone: () => void; onNote: (s: string, err?: boolean) => void }) {
  const m = useT(M), t = useT(T);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) return; const k = () => setOpen(false); addEventListener('click', k); return () => removeEventListener('click', k); }, [open]);
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  const ready = l.status === 'ready';
  const copy = async () => {
    setBusy(true); setOpen(false);
    try { const { id } = await teacherApi.copyLesson(l.id); const x = await teacherApi.lesson(id); onNote(m.copied(x.intake.title)); onDone(); }
    catch (e) { onNote((e as Error).message, true); } finally { setBusy(false); }
  };
  const del = async () => { setOpen(false); if (!confirm(t.delLessonConfirm)) return; try { await teacherApi.deleteLesson(l.id); onDone(); } catch (e) { onNote((e as Error).message, true); } };
  return (
    <div className="card-menu" onClick={stop}>
      <button className="btn ghost sm" aria-label={m.menu} aria-haspopup="menu" aria-expanded={open} disabled={busy} onClick={(e) => { stop(e); setOpen(!open); }}>{busy ? '…' : '⋯'}</button>
      {open && (
        <div className="menu" role="menu">
          <button role="menuitem" onClick={() => go(ready ? `/lesson/${l.id}/slides` : `/lesson/${l.id}/build`)}>{m.open}</button>
          {ready && <button role="menuitem" onClick={copy}>{m.copy}</button>}
          {ready && <button role="menuitem" onClick={() => go(`/lesson/${l.id}/exercises?print=1`)}>{m.print}</button>}
          <button role="menuitem" className="danger" onClick={del}>{m.del}</button>
        </div>
      )}
    </div>
  );
}

const TINTS = [{ bg: 'var(--blue-soft)', ink: 'var(--blue)' }, { bg: 'var(--amber-soft)', ink: 'var(--amber)' }];

export function Home({ teacher }: { teacher: Teacher }) {
  const t = useT(T);
  const [lessons, setLessons] = useState<LessonCard[] | null>(null);
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [ins, setIns] = useState<Insights | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [subj, setSubj] = useState<'all' | 'math' | 'english'>('all');
  const [start, setStart] = useState<StartState | null>(null), [clearing, setClearing] = useState(false);
  const [note, setNote] = useState<{ s: string; err?: boolean } | null>(null);
  const m = useT(M);
  const load = () => { teacherApi.lessons().then(setLessons); teacherApi.classes().then(setClasses); teacherApi.insights().then(setIns); teacherApi.start().then(setStart).catch(() => {}); };
  useEffect(load, []);
  const subjClasses = classes.filter((k) => subj === 'all' || !k.subject || k.subject === subj || k.subject === 'both');
  const shown = (lessons || []).filter((l) => (subj === 'all' || l.subject === subj) && (!filter || l.classes.includes(filter)));
  const clear = async () => { if (!confirm(t.clearConfirm)) return; setClearing(true); try { await teacherApi.clearSample(); setFilter(null); load(); } finally { setClearing(false); } };
  // this week's summary from the latest lesson: one repeated skill and the mastered ones, by class
  const cname = new Map((ins?.classes || []).map((k) => [k.id, k.name]));
  const repeated = (ins?.overview || []).flatMap((o) => Object.entries(o.byClass).filter(([, l]) => l === 'repeated').map(([k]) => `${o.name} – ${withCls(t.cls, cname.get(k) || '')}`));
  const mastered = (ins?.overview || []).map((o) => ({ name: o.name, cls: Object.entries(o.byClass).filter(([, l]) => l === 'secure').map(([k]) => cname.get(k)) })).filter((o) => o.cls.length);
  const metaOf = (l: LessonCard) => [l.slides && t.slidesW, l.video && t.videoW, l.exercises && `${l.exercises} ${t.exW}`, l.flashcards && `${l.flashcards} ${t.cardsW}`].filter(Boolean).join(' · ');

  return (
    <main className="page" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <section style={{ flex: '999 1 600px', minWidth: 0 }} className="stack">
        <div className="row hero" style={{ alignItems: 'flex-end' }}>
          <div className="grow">
            <h1>{t.hello(teacher.name)}</h1>
            <p className="muted" style={{ margin: '6px 0 0' }}>{t.intro}</p>
            <p className="small" style={{ margin: '6px 0 0' }}>{m.teaches} <strong>{m.subj[teacher.subject] || m.subj.both}</strong>{classes.length > 0 && <> · {withClsList(t.cls, classes.map((k) => k.name))}</>} · <Link to="/account">{m.profile}</Link></p>
          </div>
          <Link to="/new" className="btn primary lg">＋ {t.newLesson}</Link>
        </div>
        {teacher.account && start && <GuideCard s={start} teacherId={teacher.id} />}
        {teacher.account && start?.sample && (
          <div className="note row" style={{ justifyContent: 'space-between' }}><span className="grow">{t.sampleNote}</span>
            <button className="btn sm" disabled={clearing} onClick={clear}>{clearing ? t.clearing : t.clearSample}</button></div>
        )}
        {(lessons?.length || 0) > 0 && (
          <div className="filters">
            <div className="lang subj" role="group" aria-label={t.subject}>
              {(['all', 'math', 'english'] as const).map((x) => <button key={x} className={subj === x ? 'on' : ''} aria-pressed={subj === x} onClick={() => { setSubj(x); setFilter(null); }}>{x === 'all' ? t.allSubjects : t[x]}</button>)}
            </div>
            {subjClasses.length > 0 && (
              <div className="pills" role="group" aria-label={t.allClasses}>
                <button className={`pill ${!filter ? 'on' : ''}`} onClick={() => setFilter(null)}>{t.allClasses}</button>
                {subjClasses.map((k) => <button key={k.id} className={`pill ${filter === k.name ? 'on' : ''}`} onClick={() => setFilter(k.name)}>{withCls(t.cls, k.name)}</button>)}
              </div>
            )}
          </div>
        )}
        {lessons && lessons.length === 0 && (
          <div className="card empty"><h3>{t.noLessons}</h3><p className="muted">{t.noLessonsSub}</p><Link to="/new" className="btn primary">＋ {t.newLesson}</Link></div>
        )}
        {lessons && lessons.length > 0 && shown.length === 0 && <p className="muted">{t.noneForSubject}</p>}
        {note && <p className={note.err ? 'error-note' : 'ok-note'} role={note.err ? 'alert' : 'status'} style={{ margin: 0 }}>{note.err ? '' : '✓ '}{note.s}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {shown.map((l, i) => {
            const tint = TINTS[i % 2];
            const state = l.status === 'working' ? t.working : l.status === 'error' ? t.failed : l.classes.length ? t.sent : t.draft;
            return (
              <Link key={l.id} to={l.status === 'ready' || l.status === 'error' ? `/lesson/${l.id}/slides` : `/lesson/${l.id}/build`} className="card lesson-card" style={{ textDecoration: 'none', color: 'inherit', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <CardMenu l={l} onDone={load} onNote={(s, err) => setNote({ s, err })} />
                <div className="display" style={{ background: tint.bg, color: tint.ink, borderRadius: 12, height: 104, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: (l.cover || '').length > 10 ? 24 : 30, lineHeight: 1.15, textAlign: 'center', padding: 8, overflow: 'hidden' }}>{l.cover || l.title.slice(0, 18)}</div>
                <div className="row">
                  {l.classes.length > 0 && <span className="chip">{withClsList(t.cls, l.classes)}</span>}
                  <span className={`chip ${l.classes.length ? 'green' : ''}`}>{state}</span>
                  {l.copy && <span className="chip">{m.copyChip}</span>}
                </div>
                <strong style={{ fontSize: 17 }}>{l.title}</strong>
                <span className="muted small">{metaOf(l)}</span>
              </Link>
            );
          })}
        </div>
        {!teacher.account && <p className="muted small">{t.demoNote}</p>}
      </section>
      <aside style={{ flex: '1 1 280px' }} className="stack">
        <div className="card stack">
          <h2>{t.week}</h2>
          {repeated[0] && <div style={{ background: 'var(--cream)', borderRadius: 12, padding: 12 }}><div className="small" style={{ color: 'var(--amber)', fontWeight: 600 }}>{t.repeatTitle}</div>{repeated[0]}</div>}
          {mastered[0] && <div style={{ background: 'var(--green-soft)', borderRadius: 12, padding: 12 }}><div className="small" style={{ color: 'var(--green-ink)', fontWeight: 600 }}>{t.masterTitle}</div>{mastered[0].name} – {withClsList(t.cls, mastered[0].cls.filter((x): x is string => !!x))}</div>}
          {!repeated[0] && !mastered[0] && <p className="muted small" style={{ margin: 0 }}>{t.weekEmpty}</p>}
          <Link to="/insights">{t.seeInsights}</Link>
        </div>
        <div className="note"><strong>{t.tipTitle}</strong><p style={{ margin: '6px 0 0' }}>{t.tip}</p></div>
      </aside>
    </main>
  );
}
