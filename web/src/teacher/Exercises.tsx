// Screen 09 · step 5: exercises grouped by template and level, each with its skill tag and
// solution; the self-check note; edit / delete; flashcards and memory pairs; print worksheet.
import { useMemo, useState } from 'react';
import { go, teacherApi, type Exercise, type Lesson, type Level } from '../api.ts';
import { useT } from '../i18n.ts';
import { T } from './dict.ts';

type Ans = Exercise & { answer?: string };

function Options({ e, t }: { e: Exercise; t: (typeof T)['vi'] }) {
  const right = (o: string) => 'answer' in e && String(e.answer).trim().toLowerCase() === o.trim().toLowerCase();
  const opts: string[] = e.type === 'math_truefalse' ? ['true', 'false'] : 'options' in e ? e.options : [];
  if (!opts.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, opts.length)}, 1fr)`, gap: 8 }}>
      {opts.map((o) => <div key={o} style={{ padding: '10px 12px', borderRadius: 10, textAlign: 'center', border: `1px solid ${right(o) ? 'var(--green)' : 'var(--line)'}`, background: right(o) ? 'var(--green-soft)' : '#fff', fontWeight: right(o) ? 700 : 400 }}>
        {e.type === 'math_truefalse' ? (o === 'true' ? t.tTrue : t.tFalse) : o}</div>)}
    </div>
  );
}

export function questionText(e: Exercise) {
  switch (e.type) {
    case 'math_fill': return `${e.prompt}: ${e.equation.replace('?', '…')}`;
    case 'math_truefalse': return `${e.prompt} ${e.statement}`;
    case 'eng_fill': return `${e.prompt}: ${e.sentence}`;
    case 'eng_listen': return `${e.prompt} 🔊 “${e.say}”`;
    case 'eng_order': return `${e.prompt}: ${e.words.join(' / ')}`;
    case 'eng_match': return `${e.prompt}: ${e.pairs.map((p) => `${p.word} ↔ ${p.emoji}`).join(', ')}`;
    default: return e.prompt;
  }
}

export function Exercises({ l, onChange, onPrint }: { l: Lesson; onChange: (l: Lesson) => void; onPrint: () => void }) {
  const t = useT(T);
  const types = useMemo(() => [...new Set(l.exercises.map((e) => e.type))], [l.exercises]);
  const [tab, setTab] = useState<string>(types[0] || 'cards');
  const [level, setLevel] = useState<Level>('good');
  const [editing, setEditing] = useState<{ id: string; prompt: string; answer: string; explain: string } | null>(null);
  const skillName = (tag: string) => l.skills.find((s) => s.tag === tag)?.name || tag;
  const fixed = new Set(l.checks.map((c) => c.exercise));
  const list = l.exercises.filter((e) => e.type === tab && e.level === level);
  const tabs = [...types.map((k) => ({ k, n: l.exercises.filter((e) => e.type === k).length })), { k: 'cards', n: l.flashcards.length }, { k: 'memory', n: l.pairs.length }].filter((x) => x.n);

  const save = async (exercises: Exercise[]) => onChange(await teacherApi.save(l.id, { exercises }));
  const saveEdit = async () => {
    if (!editing) return;
    await save(l.exercises.map((e) => (e.id === editing.id ? ({ ...e, prompt: editing.prompt, explain: editing.explain, ...('answer' in e ? { answer: editing.answer } : {}) } as Exercise) : e)));
    setEditing(null);
  };

  return (
    <main className="page" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 220px) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
      <aside className="stack no-print" style={{ gap: 8 }}>
        <h3>{t.tplTitle}</h3>
        {tabs.map(({ k, n }) => (
          <button key={k} className="btn" style={{ justifyContent: 'space-between', ...(tab === k ? { borderColor: 'var(--blue)', background: 'var(--blue-soft)', color: 'var(--blue)' } : {}) }} onClick={() => setTab(k)}>
            <span>{t.tpl[k] || k}</span><span className="muted small">{n}</span>
          </button>
        ))}
      </aside>
      <section className="stack">
        <div className="row">
          <h1 className="grow" style={{ fontSize: 24, minWidth: 200 }}>{t.tpl[tab]}{tab !== 'cards' && tab !== 'memory' ? ` · ${list.length} ${t.q.toLowerCase()}` : ''}</h1>
          {tab !== 'cards' && tab !== 'memory' && (
            <div className="lang no-print" role="group" aria-label="level">{(['basic', 'good', 'advanced'] as Level[]).map((lv) => <button key={lv} className={level === lv ? 'on' : ''} onClick={() => setLevel(lv)}>{t[lv]}</button>)}</div>
          )}
          <button className="btn sm no-print" onClick={onPrint}>{t.print}</button>
        </div>
        <div className="ok-note">✓ {t.checked}{fixed.size ? ` ${t.fixedN(fixed.size)}` : ''}</div>

        {tab === 'cards' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {l.flashcards.map((c) => <div key={c.id} className="card stack" style={{ gap: 6, padding: 16 }}><div className="display" style={{ fontSize: 26 }}>{c.emoji} {c.front}</div><div className="muted">{c.back}</div>{c.example && <div className="small">{c.example}{c.exampleVi ? ` – ${c.exampleVi}` : ''}</div>}</div>)}
        </div>}
        {tab === 'memory' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {l.pairs.map((p) => <div key={p.id} className="card row display" style={{ fontSize: 22, justifyContent: 'center' }}>{p.a} <span className="muted">↔</span> {p.b}</div>)}
        </div>}

        {list.map((e, i) => (
          <div key={e.id} className="card stack" style={{ gap: 10 }}>
            <div className="row">
              <strong className="grow">{t.q} {i + 1}. {questionText(e)}</strong>
              <span className="chip amber">{t.skillW} {skillName(e.skill)}</span>
              {fixed.has(e.id) && <span className="chip green" title={l.checks.find((c) => c.exercise === e.id)?.issues.join('\n')}>🛡️ AI</span>}
            </div>
            <Options e={e} t={t} />
            {(e.type === 'math_fill' || e.type === 'math_word' || e.type === 'eng_order') && <div><span className="muted">{t.answer}:</span> <strong>{(e as Ans).answer}{e.type === 'math_word' && e.unit ? ` ${e.unit}` : ''}</strong></div>}
            <div className="small"><span className="muted">{t.solution}</span> {e.explain}</div>
            {editing?.id === e.id ? (
              <div className="stack">
                <input value={editing.prompt} onChange={(x) => setEditing({ ...editing, prompt: x.target.value })} />
                {'answer' in e && <label className="field">{t.answer}<input value={editing.answer} onChange={(x) => setEditing({ ...editing, answer: x.target.value })} /></label>}
                <label className="field">{t.solution}<input value={editing.explain} onChange={(x) => setEditing({ ...editing, explain: x.target.value })} /></label>
                <div className="row"><button className="btn primary sm" onClick={saveEdit}>{t.save}</button><button className="btn sm" onClick={() => setEditing(null)}>{t.cancel}</button></div>
              </div>
            ) : (
              <div className="row no-print">
                <button className="btn sm" onClick={() => setEditing({ id: e.id, prompt: e.prompt, answer: String((e as Ans).answer ?? ''), explain: e.explain })}>{t.edit}</button>
                <button className="btn sm" style={{ color: 'var(--red)' }} onClick={() => save(l.exercises.filter((x) => x.id !== e.id))}>{t.del}</button>
              </div>
            )}
          </div>
        ))}
        <div className="row no-print"><div className="grow" /><button className="btn primary lg" onClick={() => go(`/lesson/${l.id}/assign`)}>{t.nextAssign}</button></div>
      </section>
    </main>
  );
}
