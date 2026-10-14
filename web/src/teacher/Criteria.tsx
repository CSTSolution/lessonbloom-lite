// Screen 04 · "Tiêu chí tóm tắt": the thresholds behind the labels, editable by the teacher,
// with a live preview on three example pupils (same rules as server/insights.ts).
import { useState } from 'react';
import { teacherApi, type Criteria as C, type Label, type Teacher } from '../api.ts';
import { DEFAULT_CRITERIA } from '../../../server/types.ts';
import { useT } from '../i18n.ts';
import { T } from './dict.ts';
import { LabelChip } from './Insights.tsx';
import { Link } from './TeacherRoutes.tsx';

// three illustrative pupils on one skill: right answers out of 10 and how often the same slip recurs
const EXAMPLES = [{ name: 'A', right: 9, slips: 0, sessions: 1 }, { name: 'B', right: 6, slips: 2, sessions: 2 }, { name: 'C', right: 4, slips: 4, sessions: 2 }];
function labelOf(e: (typeof EXAMPLES)[0], c: C): Label {
  const pct = (100 * e.right) / 10;
  if ((e.slips >= c.repeatTimes && e.sessions >= c.repeatSessions) || pct < c.repeatedPct) return 'repeated';
  return pct >= c.securePct ? 'secure' : 'practising';
}

export function Criteria({ teacher, onSaved }: { teacher: Teacher; onSaved: (t: Teacher) => void }) {
  const t = useT(T);
  const [c, setC] = useState<C>(teacher.criteria);
  const [saved, setSaved] = useState(false);
  const num = (k: keyof C, max = 100) => (
    <input type="number" min={0} max={max} value={c[k]} style={{ width: 80 }} onChange={(e) => { setSaved(false); setC({ ...c, [k]: Math.max(0, Math.min(max, Number(e.target.value))) }); }} />
  );
  const labels = EXAMPLES.map((e) => labelOf(e, c));
  const share = (l: Label) => (100 * labels.filter((x) => x === l).length) / labels.length;
  const classLabel: Label = share('repeated') >= c.classRepeatedPct ? 'repeated' : share('secure') >= c.classSecurePct && !labels.includes('repeated') ? 'secure' : 'practising';

  return (
    <main className="page" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 24, alignItems: 'start' }}>
      <section className="stack" style={{ gap: 18 }}>
        <Link to="/insights" className="small">‹ {t.inTitle}</Link>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow"><h1>{t.crTitle}</h1><p className="muted">{t.crSub}</p></div>
          <div className="row"><button className="btn" onClick={() => setC({ ...DEFAULT_CRITERIA })}>{t.reset}</button>
            <button className="btn primary" onClick={async () => { onSaved(await teacherApi.saveCriteria(c)); setSaved(true); }}>{saved ? `✓ ${t.savedCriteria}` : t.saveCriteria}</button></div>
        </div>
        <div className="card stack">
          <h3>{t.s1}</h3><p className="muted small" style={{ margin: 0 }}>{t.s1d}</p>
          <table className="t"><thead><tr><th>{t.colRule}</th><th>{t.colValue}</th></tr></thead><tbody>
            <tr><td>{t.r1}</td><td>{num('lastN', 50)} {t.uQ}</td></tr>
            <tr><td>{t.r2}</td><td>{num('minAnswers', 50)} {t.uQ}</td></tr>
            <tr><td><LabelChip l="secure" /> {t.r3}</td><td>{num('securePct')} %</td></tr>
            <tr><td><LabelChip l="repeated" /> {t.r4}</td><td>{num('repeatedPct')} %</td></tr>
            <tr><td><LabelChip l="repeated" /> {t.r5a} {num('repeatTimes', 20)} {t.r5b}</td><td>{num('repeatSessions', 20)} {t.uS}</td></tr>
            <tr><td><LabelChip l="practising" /> {t.r6}</td><td className="muted">–</td></tr>
          </tbody></table>
        </div>
        <div className="card stack">
          <h3>{t.s2}</h3><p className="muted small" style={{ margin: 0 }}>{t.s2d}</p>
          <table className="t"><thead><tr><th>{t.colRule}</th><th>{t.colValue}</th></tr></thead><tbody>
            <tr><td><LabelChip l="repeated" /> {t.c1}</td><td>{num('classRepeatedPct')} {t.uP}</td></tr>
            <tr><td><LabelChip l="secure" /> {t.c2}</td><td>{num('classSecurePct')} {t.uP}</td></tr>
            <tr><td colSpan={2} className="muted small">{t.c3}</td></tr>
          </tbody></table>
        </div>
      </section>
      <aside className="stack">
        <div className="note stack" style={{ gap: 10 }}>
          {EXAMPLES.map((e, i) => (
            <div key={e.name} className="row" style={{ justifyContent: 'space-between', background: '#fff', borderRadius: 10, padding: '8px 12px' }}>
              <span>Em {e.name} · {e.right}/10{e.slips ? ` · ×${e.slips}` : ''}</span><LabelChip l={labels[i]} />
            </div>
          ))}
          <div className="row" style={{ justifyContent: 'space-between' }}><strong>{t.cls} 2A</strong><LabelChip l={classLabel} /></div>
        </div>
        <p className="muted small">{t.crNote}</p>
      </aside>
    </main>
  );
}
