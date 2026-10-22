// Screen 09 · step 5: exercises grouped by template and level, each with its skill tag and
// solution; the self-check note; edit / delete; flashcards and memory pairs; print worksheet.
import { useMemo, useState } from 'react';
import { go, teacherApi, type Exercise, type Lesson, type Level } from '../api.ts';
import { getLang, useT } from '../i18n.ts';
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

// the instruction, then the item's own content; never the answer (word-picture pairs are shown mixed)
const lead = (p: string) => p.trim().replace(/[\s.:;!?…]+$/u, '');
export function questionText(e: Exercise) {
  switch (e.type) {
    case 'math_fill': return `${lead(e.prompt)}: ${e.equation.replace('?', '…')}`;
    case 'math_truefalse': return `${e.prompt} ${e.statement}`;
    case 'eng_fill': return `${lead(e.prompt)}: ${e.sentence}`;
    // the pupil only hears this (the app reads it aloud); it is never printed on the pupil's screen or the worksheet
    case 'eng_listen': return `${e.prompt} · 🔊 ${getLang() === 'en' ? 'read aloud, pupils only hear it' : 'đọc to, học sinh chỉ nghe'}: “${e.say}”`;
    case 'eng_order': return `${lead(e.prompt)}: ${[...e.words].sort((a, b) => a.localeCompare(b)).join(' / ')}`;
    case 'eng_match': return e.prompt;
    default: return e.prompt;
  }
}
// word-picture pairs: words in order, pictures rotated so none sits next to its word
function MatchColumns({ e }: { e: Exercise }) {
  if (e.type !== 'eng_match') return null;
  const pics = e.pairs.map((p) => p.emoji); pics.push(pics.shift()!);
  return (
    <div style={{ display: 'flex', gap: 40, fontSize: 18 }}>
      <div className="stack" style={{ gap: 6 }}>{e.pairs.map((p) => <span key={p.word}>{p.word}</span>)}</div>
      <div className="stack" style={{ gap: 6 }}>{pics.map((x) => <span key={x}>{x}</span>)}</div>
    </div>
  );
}

export function Exercises({ l, onChange, onPrint }: { l: Lesson; onChange: (l: Lesson) => void; onPrint: () => void }) {
  const t = useT(T);
  const types = useMemo(() => [...new Set(l.exercises.map((e) => e.type))], [l.exercises]);
  const [tab, setTab] = useState<string>('all');            // 'all', a template, 'cards' or 'memory'
  const [level, setLevel] = useState<Level | 'all'>('all');
  const [editing, setEditing] = useState<{ id: string; prompt: string; answer: string; explain: string } | null>(null);
  const skillName = (tag: string) => l.skills.find((s) => s.tag === tag)?.name || tag;
  const fixed = new Set(l.checks.map((c) => c.exercise));
  const atLevel = l.exercises.filter((e) => level === 'all' || e.level === level);
  const list = atLevel.filter((e) => tab === 'all' || e.type === tab);
  const exTab = tab !== 'cards' && tab !== 'memory';
  const tabs = [{ k: 'all', n: atLevel.length }, ...types.map((k) => ({ k, n: atLevel.filter((e) => e.type === k).length })), { k: 'cards', n: l.flashcards.length }, { k: 'memory', n: l.pairs.length }].filter((x) => x.n || x.k === 'all');
  const lvN = (lv: Level | 'all') => l.exercises.filter((e) => (lv === 'all' || e.level === lv) && (tab === 'all' || !exTab || e.type === tab)).length;

  const save = async (exercises: Exercise[]) => onChange(await teacherApi.save(l.id, { exercises }));
  const saveEdit = async () => {
    if (!editing) return;
    await save(l.exercises.map((e) => (e.id === editing.id ? ({ ...e, prompt: editing.prompt, explain: editing.explain, ...('answer' in e ? { answer: editing.answer } : {}) } as Exercise) : e)));
    setEditing(null);
  };

  return (
    <main className="page stack" style={{ gap: 14 }}>
      <section className="stack">
        <div className="row">
          <h1 className="grow" style={{ fontSize: 24, minWidth: 200 }}>{tab === 'all' ? t.allTypes : t.tpl[tab]}{exTab ? ` · ${t.itemsN(list.length)}` : ''}</h1>
        </div>
        <div className="pills no-print ex-filter" role="group" aria-label={t.tplTitle}>
          {tabs.map(({ k, n }) => <button key={k} className={`pill sm ${tab === k ? 'on' : ''}`} aria-pressed={tab === k} onClick={() => setTab(k)}>{k === 'all' ? t.allTypes : t.tpl[k] || k} <b>{n}</b></button>)}
        </div>
        {exTab && <p className="muted small no-print" style={{ margin: 0 }}>{t.roundNote(Math.min(10, l.exercises.filter((e) => e.level !== 'advanced').length), l.exercises.filter((e) => e.level === 'advanced').length)}</p>}
        {exTab && (
          <div className="lang no-print" role="group" aria-label="level" style={{ alignSelf: 'flex-start' }}>{(['all', 'basic', 'good', 'advanced'] as const).map((lv) => <button key={lv} className={level === lv ? 'on' : ''} aria-pressed={level === lv} onClick={() => setLevel(lv)}>{lv === 'all' ? t.allLevels : t[lv]} · {lvN(lv)}</button>)}</div>
        )}
        <div className="ok-note">✓ {t.checked}{fixed.size ? ` ${t.fixedN(fixed.size)}` : ''}</div>

        {tab === 'cards' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {l.flashcards.map((c) => <div key={c.id} className="card stack" style={{ gap: 6, padding: 16 }}><div className="display" style={{ fontSize: 26 }}>{c.emoji} {c.front}</div><div className="muted">{c.back}</div>{c.example && <div className="small">{c.example}{c.exampleVi ? ` – ${c.exampleVi}` : ''}</div>}</div>)}
        </div>}
        {tab === 'memory' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {l.pairs.map((p) => <div key={p.id} className="card row display" style={{ fontSize: 22, justifyContent: 'center' }}>{p.a} <span className="muted">↔</span> {p.b}</div>)}
        </div>}

        {exTab && list.map((e, i) => (
          <div key={e.id} className="card stack" style={{ gap: 10 }}>
            <div className="row">
              <strong className="grow">{t.q} {i + 1}. {questionText(e)}</strong>
              {tab === 'all' && <span className="chip">{t.tpl[e.type] || e.type}</span>}
              <span className="chip amber">{t.skillW} {skillName(e.skill)}</span>
              {fixed.has(e.id) && <span className="chip green" title={l.checks.find((c) => c.exercise === e.id)?.issues.join('\n')}>🛡️ AI</span>}
            </div>
            <Options e={e} t={t} />
            <MatchColumns e={e} />
            {(e.type === 'math_fill' || e.type === 'math_word' || e.type === 'eng_order') && <div><span className="muted">{t.answer}:</span> <strong>{(e as Ans).answer}{e.type === 'math_word' && e.unit ? ` ${e.unit}` : ''}</strong></div>}
            {e.type === 'eng_match' && <div><span className="muted">{t.answer}:</span> <strong>{e.pairs.map((p) => `${p.word} – ${p.emoji}`).join(', ')}</strong></div>}
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
