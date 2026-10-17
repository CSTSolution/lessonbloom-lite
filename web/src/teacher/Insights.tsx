// Screen 03 · "Tóm tắt học tập": lesson + class filter, the TT27 notice, overview (skill × class
// labels), repeated mistakes with the pupils' names (teacher only), mastered skills, and AI
// comment drafts the teacher edits and copies. No scores anywhere.
import { useEffect, useState } from 'react';
import { teacherApi, type Comments as Cm, type Insights as Ins, type Label } from '../api.ts';
import { useLang, useT, withCls } from '../i18n.ts';
import { LABEL_KEY, T } from './dict.ts';
import { Link } from './TeacherRoutes.tsx';
import { ErrorNote } from './ErrorNote.tsx';
import { GuideHint } from './Guide.tsx';
import { shareMessage } from './share.ts';

// "Kết quả từng học sinh": every pupil of the class for this lesson, including those not started
const R = {
  vi: { h: 'Kết quả từng học sinh', sub: 'Bấm tên để xem chi tiết. Chỉ cô xem được; học sinh không thấy nhãn hay điểm.',
    status: { none: 'Chưa làm', started: 'Đang làm', done: 'Đã xong' }, colPupil: 'Học sinh', colStatus: 'Trạng thái', colTried: 'Câu đã làm', colErr: 'Lỗi hay gặp', colMood: 'Con thấy bài', colLast: 'Lần cuối',
    count: (d: number, s: number, n: number, all: number) => `Đã xong ${d}/${all} · Đang làm ${s} · Chưa làm ${n}`, moods: { easy: '😊 Dễ', ok: '🙂 Vừa', hard: '😟 Khó' },
    notAssigned: (k: string) => `Bài này chưa giao cho ${k}.`, assign: 'Giao bài', noPupils: 'Lớp này chưa có học sinh.', remind: 'Nhắc các em chưa làm', reminded: 'Đã chép lời nhắc' ,
    remindMsg: (names: string[], title: string) => `Phụ huynh của ${names.join(', ')} nhắc con làm bài "${title}" trên LessonBloom giúp cô nhé. Cảm ơn quý phụ huynh!` },
  en: { h: 'Each pupil’s results', sub: 'Tap a name for details. Only you see this; pupils never see labels or scores.',
    status: { none: 'Not started', started: 'In progress', done: 'Finished' }, colPupil: 'Pupil', colStatus: 'Status', colTried: 'Questions done', colErr: 'Common slip', colMood: 'How it felt', colLast: 'Last active',
    count: (d: number, s: number, n: number, all: number) => `Finished ${d}/${all} · In progress ${s} · Not started ${n}`, moods: { easy: '😊 Easy', ok: '🙂 Just right', hard: '😟 Hard' },
    notAssigned: (k: string) => `This lesson is not assigned to ${k} yet.`, assign: 'Assign', noPupils: 'This class has no pupils yet.', remind: 'Remind those not started', reminded: 'Reminder copied',
    remindMsg: (names: string[], title: string) => `Dear parents of ${names.join(', ')}: please remind your child to do "${title}" on LessonBloom. Thank you!` },
};

// "Gợi ý lời nhận xét": drafted on its own when the page opens (once there are answers), one card per pupil
const C = {
  vi: { none: 'Chưa có lượt làm bài để nhận xét. Khi các em làm bài, gợi ý sẽ tự hiện ở đây.', waiting: (n: string[]) => `Chưa làm bài: ${n.join(', ')}.`,
    auto: (n: number) => `AI đang soạn nhận xét cho ${n} em…`, stale: 'Có bài làm mới từ khi soạn.', shorter: 'Ngắn hơn', shortening: 'Đang rút gọn…', saved: 'Đã lưu',
    count: (n: number) => `${n} em`, felt: { easy: '😊 Dễ', ok: '🙂 Vừa', hard: '😟 Khó' } as Record<string, string> },
  en: { none: 'No answers yet to comment on. When pupils do the lesson, suggestions appear here on their own.', waiting: (n: string[]) => `Not started: ${n.join(', ')}.`,
    auto: (n: number) => `The AI is drafting comments for ${n} pupils…`, stale: 'New answers since these were drafted.', shorter: 'Shorter', shortening: 'Shortening…', saved: 'Saved',
    count: (n: number) => `${n} pupils`, felt: { easy: '😊 Easy', ok: '🙂 Just right', hard: '😟 Hard' } as Record<string, string> },
};
function CommentsCard({ d }: { d: Ins }) {
  const t = useT(T), c = useT(C);
  const [x, setX] = useState<Cm | null>(null), [busy, setBusy] = useState(''), [err, setErr] = useState(''), [copied, setCopied] = useState('');
  const [text, setText] = useState<Record<string, string>>({});
  const run = async (k: string, fn: () => Promise<void>) => { setErr(''); setBusy(k); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(''); } };
  const take = (r: Cm) => { setX(r); setText(Object.fromEntries((r.comments || []).map((m) => [m.pupilId, m.text]))); };
  const draft = () => run('draft', async () => take(await teacherApi.draftComments(d.lessonId, d.classId)));
  useEffect(() => {
    let live = true;
    setX(null); setErr('');
    teacherApi.comments(d.lessonId, d.classId).then((r) => {
      if (!live) return;
      take(r);
      if (!r.comments && r.ready > 0) draft();       // answers but no drafts yet: draft them now
    }, (e) => live && setErr((e as Error).message));
    return () => { live = false; };
  }, [d.lessonId, d.classId]);
  const copy = (s: string, key: string) => { navigator.clipboard?.writeText(s).catch(() => {}); setCopied(key); setTimeout(() => setCopied(''), 1500); };
  const save = (pid: string) => { const v = text[pid]; if (v !== undefined) teacherApi.saveComment(d.lessonId, d.classId, pid, v).catch(() => {}); };
  const shorter = (pid: string) => run(`s-${pid}`, async () => { const r = await teacherApi.shorterComment(text[pid]); setText((m) => ({ ...m, [pid]: r.text })); await teacherApi.saveComment(d.lessonId, d.classId, pid, r.text); });
  const list = x?.comments || [];
  return (
    <div className="card stack">
      <div className="row"><h2 className="grow" style={{ margin: 0 }}>{t.commentH} {list.length > 0 && <span className="muted small">· {c.count(list.length)}</span>}</h2>
        {x && x.ready > 0 && <button className="btn sm" disabled={!!busy} onClick={draft}>{busy === 'draft' ? t.drafting : t.regenComments}</button>}
        {list.length > 0 && <button className="btn sm" onClick={() => copy(list.map((m) => `${m.name}: ${text[m.pupilId] ?? m.text}`).join('\n'), 'all')}>{copied === 'all' ? `✓ ${t.copied}` : t.copyAll}</button>}
      </div>
      <p className="muted small" style={{ margin: 0 }}>{t.commentD}</p>
      {!x && !err && <p className="muted" role="status">{t.loading}</p>}
      {x && x.ready === 0 && <p className="ro-note" style={{ margin: 0 }}>{c.none}</p>}
      {busy === 'draft' && !list.length && <p role="status" style={{ color: 'var(--blue)', margin: 0 }}>⏳ {c.auto(x?.ready || 0)}</p>}
      {x?.stale && <p className="small" style={{ margin: 0, color: 'var(--amber)' }}>{c.stale}</p>}
      <ErrorNote text={err} />
      <div className="cm-list">
        {list.map((m) => (
          <div key={m.pupilId} className="cm-card">
            <div className="row" style={{ gap: 6 }}>
              <Link to={`/classes/${d.classId}/pupil/${m.pupilId}`}><strong>{m.name}</strong></Link>
              <span className="grow" />
              <span title={m.skills.map((s) => `${s.skill}: ${t[LABEL_KEY[s.label as Lb]]}`).join('\n')}><LabelChip l={(['repeated', 'practising', 'secure'] as Lb[]).find((k) => m.skills.some((s) => s.label === k)) || null} /></span>
              {m.felt && <span className="small muted">· {c.felt[m.felt]}</span>}
            </div>
            <textarea rows={4} value={text[m.pupilId] ?? m.text} onChange={(e) => setText({ ...text, [m.pupilId]: e.target.value })} onBlur={() => save(m.pupilId)} aria-label={m.name} />
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm" onClick={() => copy(text[m.pupilId] ?? m.text, m.pupilId)}>{copied === m.pupilId ? `✓ ${t.copied}` : t.copy}</button>
              <button className="btn ghost sm" disabled={!!busy} onClick={() => shorter(m.pupilId)}>{busy === `s-${m.pupilId}` ? c.shortening : c.shorter}</button>
            </div>
          </div>
        ))}
      </div>
      {x && x.waiting.length > 0 && x.ready > 0 && <p className="muted small" style={{ margin: 0 }}>{c.waiting(x.waiting)}</p>}
    </div>
  );
}

function PupilTable({ d }: { d: Ins }) {
  const r = useT(R), lang = useLang();
  const [copied, setCopied] = useState(false);
  const rows = d.pupils || [], skills = d.skills || [];
  const cname = withCls(useT(T).cls, d.classes.find((k) => k.id === d.classId)?.name || '');
  const title = d.lessons.find((x) => x.id === d.lessonId)?.title || '';
  const n = (s: string) => rows.filter((x) => x.status === s).length;
  const notYet = rows.filter((x) => x.status === 'none').map((x) => x.name);
  const when = (iso?: string) => iso ? new Date(iso).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
  const remind = async () => { const url = `${location.origin}/learn`; await shareMessage(`${r.remindMsg(notYet, title)} ${url}`, url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="card stack">
      <div className="row"><h2 className="grow" style={{ margin: 0 }}>{r.h}</h2>
        {d.assigned && rows.length > 0 && <span className="muted small">{r.count(n('done'), n('started'), n('none'), rows.length)}</span>}
        {d.assigned && notYet.length > 0 && <button className="btn sm" onClick={remind}>{copied ? `✓ ${r.reminded}` : r.remind}</button>}
      </div>
      <p className="muted small" style={{ margin: 0 }}>{r.sub}</p>
      {!d.assigned ? <div className="row"><span className="muted">{r.notAssigned(cname)}</span><Link to={`/lesson/${d.lessonId}/assign`} className="btn sm primary">{r.assign}</Link></div>
        : !rows.length ? <p className="muted" style={{ margin: 0 }}>{r.noPupils}</p>
        : <div className="table-scroll"><table className="t pupils-t">
          <thead><tr><th>{r.colPupil}</th><th>{r.colStatus}</th><th>{r.colTried}</th>{skills.map((s) => <th key={s.tag}>{s.name}</th>)}<th>{r.colErr}</th><th>{r.colMood}</th><th>{r.colLast}</th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.pupilId} className={p.status === 'none' ? 'muted' : ''}>
              <td><Link to={`/classes/${d.classId}/pupil/${p.pupilId}`}>{p.name}</Link></td>
              <td><span className={`st st-${p.status}`}>{r.status[p.status]}</span></td>
              <td>{p.status === 'none' ? '–' : p.tried}</td>
              {skills.map((s) => <td key={s.tag}>{p.skills[s.tag] ? <LabelChip l={p.skills[s.tag]} /> : '–'}</td>)}
              <td className="small">{p.topError || '–'}</td>
              <td className="small">{p.mood ? r.moods[p.mood] : '–'}</td>
              <td className="small muted">{when(p.lastAt)}</td>
            </tr>))}</tbody>
        </table></div>}
    </div>
  );
}

export function LabelChip({ l }: { l: Label | null }) {
  const t = useT(T);
  if (!l) return <span className="muted">–</span>;
  return <span className={`chip lbl-${l}`}>{t[LABEL_KEY[l]]}</span>;
}

// ---- learning summary charts: counts of skill labels (per skill and class), never of pupils ----
type Lb = 'secure' | 'practising' | 'repeated';
const LBS: Lb[] = ['secure', 'practising', 'repeated'];
const COLOR: Record<Lb, string> = { secure: '#3C9A5F', practising: '#B8C1CF', repeated: '#E08A3C' };
const countOf = (labels: (Label | null | undefined)[]) => Object.fromEntries(LBS.map((k) => [k, labels.filter((x) => x === k).length])) as Record<Lb, number>;
const S19 = {
  vi: { sub: (subj: string, t: string) => `${subj} · ${t}`, applies: 'Áp dụng cho cả hai phần bên dưới',
    p1: 'Tổng quan tất cả các lớp cô đang dạy', p1sub: (k: number, s: number) => `${k} lớp · ${s} dạng bài · tính theo dạng bài, không theo từng học sinh`,
    pie: 'Tỉ lệ dạng bài', pieAll: 'tất cả các lớp', unit: 'lượt dạng bài', unitCls: 'dạng bài', byClass: 'Theo từng lớp', see: 'Xem chi tiết ›',
    barNote: 'Mỗi ô là số dạng bài ở mức đó. Không so sánh học sinh.', p2: 'Chi tiết từng lớp', p2sub: 'Bảng, biểu đồ và các mục bên dưới chỉ tính lớp đang chọn.',
    all: 'Tất cả', filterNote: 'Bấm một mức để lọc bảng bên cạnh.', noData: 'Chưa có lượt làm bài cho bài này.', none: 'Không có dạng bài ở mức này.' },
  en: { sub: (subj: string, t: string) => `${subj} · ${t}`, applies: 'Applies to both parts below',
    p1: 'Overview of all your classes', p1sub: (k: number, s: number) => `${k} classes · ${s} skills · counted by skill, not by pupil`,
    pie: 'Skills by level', pieAll: 'all classes', unit: 'skill results', unitCls: 'skills', byClass: 'By class', see: 'See details ›',
    barNote: 'Each block is the number of skills at that level. Pupils are not compared.', p2: 'Class detail', p2sub: 'The table, chart and sections below count the chosen class only.',
    all: 'All', filterNote: 'Tap a level to filter the table next to it.', noData: 'No answers yet for this lesson.', none: 'No skills at this level.' },
};
function Donut({ c, unit, size = 150 }: { c: Record<Lb, number>; unit: string; size?: number }) {
  const total = LBS.reduce((a, k) => a + c[k], 0), r = 15.9155, sw = 5.5;
  let off = 25;
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" role="img" aria-label={`${total} ${unit}`}>
      <circle cx="21" cy="21" r={r} fill="none" stroke="#EEF1F5" strokeWidth={sw} />
      {total > 0 && LBS.map((k) => { const pct = (100 * c[k]) / total; const el = pct > 0 ? <circle key={k} cx="21" cy="21" r={r} fill="none" stroke={COLOR[k]} strokeWidth={sw} strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={off} /> : null; off -= pct; return el; })}
      <text x="21" y="21" textAnchor="middle" fontSize="9" fontWeight="700" fill="#17202E">{total}</text>
      <text x="21" y="27" textAnchor="middle" fontSize="2.6" fill="#556072">{unit}</text>
    </svg>
  );
}
function Legend({ c, pick, on }: { c: Record<Lb, number>; pick?: (k: Lb | 'all') => void; on?: Lb | 'all' }) {
  const t = useT(T), s = useT(S19);
  const total = LBS.reduce((a, k) => a + c[k], 0);
  const name = (k: Lb) => t[LABEL_KEY[k]];
  if (!pick) return (
    <ul className="lg">{LBS.map((k) => <li key={k}><i style={{ background: COLOR[k] }} /><b>{name(k)}</b> {c[k]} · {total ? Math.round((100 * c[k]) / total) : 0}%</li>)}</ul>
  );
  return (
    <div className="lg-pick" role="group">
      <button className={on === 'all' ? 'on' : ''} aria-pressed={on === 'all'} onClick={() => pick('all')}><i className="mix" />{s.all} <span>{total}</span></button>
      {LBS.map((k) => <button key={k} className={on === k ? 'on' : ''} aria-pressed={on === k} onClick={() => pick(k)}><i style={{ background: COLOR[k] }} />{name(k)} <span>{c[k]}</span></button>)}
    </div>
  );
}
function Bar({ c }: { c: Record<Lb, number> }) {
  const total = LBS.reduce((a, k) => a + c[k], 0);
  return <div className="sbar">{total === 0 ? <span className="empty">–</span> : LBS.filter((k) => c[k]).map((k) => <span key={k} style={{ flex: c[k], background: COLOR[k], color: k === 'practising' ? '#3D4757' : '#fff' }}>{c[k]}</span>)}</div>;
}

export function Insights() {
  const t = useT(T), s19 = useT(S19);
  const q = new URLSearchParams(location.search);
  const [lessonId, setLessonId] = useState(q.get('lessonId') || undefined);
  const [classId, setClassId] = useState(q.get('classId') || undefined);
  const [d, setD] = useState<Ins | null>(null);
  const [lvl, setLvl] = useState<Lb | 'all'>('all');
  useEffect(() => { teacherApi.insights(lessonId, classId).then(setD); }, [lessonId, classId]);
  if (!d) return <p className="page muted" role="status">{t.loading}</p>;
  if (!d.lessons.length) return <main className="page stack"><h1>{t.inTitle}</h1><div className="card empty"><p className="muted" style={{ margin: 0 }}>{t.insEmpty}</p><Link to="/new" className="btn primary">＋ {t.newLesson}</Link></div></main>;
  const cname = withCls(t.cls, d.classes.find((k) => k.id === d.classId)?.name || '');
  const repeated = (d.detail || []).filter((s) => s.classLabel === 'repeated' || s.errors.length);
  const mastered = (d.detail || []).filter((s) => s.classLabel === 'secure');

  const lesson = d.lessons.find((x) => x.id === d.lessonId);
  const withData = d.classes.filter((k) => d.overview.some((o) => o.byClass[k.id]));
  const shownCls = withData.length ? withData : d.classes;
  const allC = countOf(d.overview.flatMap((o) => shownCls.map((k) => o.byClass[k.id])));
  const kC = countOf(d.overview.map((o) => o.byClass[d.classId]));
  const kRows = d.overview.filter((o) => lvl === 'all' ? true : o.byClass[d.classId] === lvl);
  const pickClass = (id: string) => { setClassId(id); setLvl('all'); setTimeout(() => document.getElementById('part2')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };

  return (
    <main className="page stack" style={{ gap: 18 }}>
      <div><h1 style={{ margin: 0 }}>{t.inTitle}</h1>{lesson && <p className="muted" style={{ margin: '4px 0 0' }}>{s19.sub(lesson.subject === 'english' ? t.english : t.math, lesson.title)}</p>}</div>
      <GuideHint step="insights" />
      <div className="card row" style={{ gap: 16 }}>
        <label className="row lesson-pick" style={{ gap: 8, flexWrap: 'nowrap' }}><span className="muted" style={{ whiteSpace: 'nowrap' }}>{t.lessonLabel}</span>
          <select value={d.lessonId} onChange={(e) => { setLessonId(e.target.value); setClassId(undefined); setLvl('all'); }} style={{ minWidth: 0, maxWidth: 420 }}>{d.lessons.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
        <span className="muted small">{s19.applies}</span>
      </div>
      <div className="note">ⓘ {t.notice}</div>

      <section className="card stack ins-part">
        <div className="row" style={{ alignItems: 'flex-start' }}><span className="num-badge">1</span><div className="grow"><h2 style={{ margin: 0 }}>{s19.p1}</h2><p className="muted small" style={{ margin: 0 }}>{s19.p1sub(shownCls.length, d.overview.length)}</p></div></div>
        {!withData.length ? <p className="muted" style={{ margin: 0 }}>{s19.noData}</p> : (
          <div className="ins-grid">
            <div className="card-in"><div className="small" style={{ fontWeight: 600 }}>{s19.pie} · {s19.pieAll}</div>
              <div className="row" style={{ gap: 20, flexWrap: 'nowrap' }}><Donut c={allC} unit={s19.unit} /><Legend c={allC} /></div></div>
            <div className="card-in"><div className="small" style={{ fontWeight: 600 }}>{s19.byClass}</div>
              <div className="stack" style={{ gap: 10, marginTop: 8 }}>{shownCls.map((k) => (
                <div key={k.id} className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><strong style={{ width: 90, flex: '0 0 90px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{withCls(t.cls, k.name)}</strong>
                  <Bar c={countOf(d.overview.map((o) => o.byClass[k.id]))} /><button className="btn sm" onClick={() => pickClass(k.id)}>{s19.see}</button></div>))}</div>
              <p className="muted small" style={{ margin: '10px 0 0' }}>{s19.barNote}</p></div>
          </div>
        )}
        <div className="table-scroll"><table className="t overview">
          <thead><tr><th>{t.colSkill}</th>{shownCls.map((k) => <th key={k.id}>{withCls(t.cls, k.name)}</th>)}</tr></thead>
          <tbody>{d.overview.map((o) => <tr key={o.skill}><td>{o.name}</td>{shownCls.map((k) => <td key={k.id}><LabelChip l={o.byClass[k.id]} /></td>)}</tr>)}</tbody>
        </table></div>
        <div className="row small muted" style={{ gap: 16 }}>
          <span><LabelChip l="repeated" />: {t.tagRd}</span><span><LabelChip l="practising" />: {t.tagPd}</span><span><LabelChip l="secure" />: {t.tagMd}</span>
          <span className="grow" /><Link to="/criteria">{t.editCriteria}</Link>
        </div>
      </section>

      <section id="part2" className="card stack ins-part part2">
        <div className="row" style={{ alignItems: 'flex-start' }}><span className="num-badge">2</span><div className="grow"><h2 style={{ margin: 0 }}>{s19.p2} · {cname}</h2><p className="muted small" style={{ margin: 0 }}>{s19.p2sub}</p></div>
          <div className="pills">{d.classes.map((k) => <button key={k.id} className={`pill ${d.classId === k.id ? 'on' : ''}`} aria-pressed={d.classId === k.id} onClick={() => { setClassId(k.id); setLvl('all'); }}>{withCls(t.cls, k.name)}</button>)}</div></div>
        <div className="ins-grid">
          <div className="card-in"><div className="small" style={{ fontWeight: 600 }}>{s19.pie} · {cname}</div>
            <div className="row" style={{ gap: 20, flexWrap: 'nowrap' }}><Donut c={kC} unit={s19.unitCls} /><Legend c={kC} pick={setLvl} on={lvl} /></div>
            <p className="muted small" style={{ margin: '8px 0 0' }}>{s19.filterNote}</p></div>
          <div className="card-in"><table className="t">
            <thead><tr><th>{t.colSkill}</th><th>{cname}</th></tr></thead>
            <tbody>{kRows.map((o) => <tr key={o.skill}><td>{o.name}</td><td><LabelChip l={o.byClass[d.classId]} /></td></tr>)}
              {!kRows.length && <tr><td colSpan={2} className="muted small">{s19.none}</td></tr>}</tbody>
          </table></div>
        </div>
      </section>

      <PupilTable d={d} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18, alignItems: 'start' }}>
        <section className="stack">
          <h3 style={{ color: 'var(--amber)' }}>{t.repeatH(cname)}</h3>
          {repeated.length === 0 && <p className="muted">{t.noRepeat}</p>}
          {repeated.map((s) => (
            <div key={s.skill} className="card stack" style={{ gap: 8 }}>
              <strong>{s.errors[0]?.errorType || s.skillName}</strong>
              <span className="muted small">{t.colSkill}: {s.skillName}</span>
              {s.errors.slice(0, 2).map((e) => (
                <div key={e.errorType} className="small">
                  {e.example && <div className="muted">{t.example} {e.example}</div>}
                  <div><strong>{e.pupils.length} {t.pupilsW}:</strong> {e.pupils.join(', ')}</div>
                </div>
              ))}
              {!s.errors.length && <div className="small">{s.pupils.filter((p) => p.label === 'repeated').map((p) => p.name).join(', ')}</div>}
              <div className="small" style={{ background: 'var(--cream)', borderRadius: 10, padding: '8px 10px' }}>{t.autoSame}</div>
            </div>
          ))}
        </section>
        <section className="stack">
          <h3 style={{ color: 'var(--green-ink)' }}>{t.masterH(cname)}</h3>
          {mastered.map((s) => (
            <div key={s.skill} className="card stack" style={{ gap: 8 }}>
              <strong>{s.skillName}</strong>
              <div className="small" style={{ background: 'var(--green-soft)', borderRadius: 10, padding: '8px 10px' }}>{t.autoHarder}</div>
            </div>
          ))}
          {!mastered.length && <p className="muted">–</p>}
        </section>
      </div>

      <CommentsCard d={d} />
    </main>
  );
}
