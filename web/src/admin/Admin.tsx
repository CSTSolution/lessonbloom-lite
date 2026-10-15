// /admin (Son only): AI usage counted from real model responses, the spending guard, and links
// to the official bill in Cloud Billing. The admin key lives only in this tab (sessionStorage).
import { useEffect, useState } from 'react';
import { idToken } from '../auth.ts';
import { Logo } from '../main.tsx';

interface Model { calls: number; inTokens: number; outTokens: number; images: number; chars: number; usd: number }
interface Day { day: string; calls: number; usd: number; byModel: Record<string, Model>; byTask: Record<string, { calls: number; usd: number }> }
interface UserRow { id: string; name: string; email: string | null; plan: 'demo' | 'free' | 'pro'; account: boolean; createdAt: string; proRequestedAt: string | null; lessons: number; creditsToday: number; creditsMonth: number; usdMonth: number; lastActive: string }
interface Overview { provider: string; project: string; guard: { month: string; usd: number; limit: number; today: number; dayLimit: number }; days: Day[]; links: Record<string, string>; prices: Record<string, unknown> }

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

export function Admin() {
  const [key, setKey] = useState(() => { try { return sessionStorage.getItem('lb-admin') || ''; } catch { return ''; } });
  const [data, setData] = useState<Overview | null>(null), [err, setErr] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]), [showDemo, setShowDemo] = useState(false);
  const headers = async (kk = key) => { const tok = await idToken(); return { 'x-admin': kk, 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }; };
  const loadUsers = async (kk = key) => { const r = await fetch('/api/admin/users', { headers: await headers(kk) }); if (r.ok) setUsers(await r.json()); };
  const setPlan = async (id: string, plan: string) => { await fetch(`/api/admin/users/${id}/plan`, { method: 'POST', headers: await headers(), body: JSON.stringify({ plan }) }); loadUsers(); };
  const load = async (kk = key) => {
    setErr('');
    const tok = await idToken();     // signed in as an admin email works too
    const r = await fetch('/api/admin/overview?days=31', { headers: { 'x-admin': kk, ...(tok ? { authorization: `Bearer ${tok}` } : {}) } });
    if (!r.ok) { setErr(kk ? (r.status === 403 ? 'Wrong admin key' : `Error ${r.status}`) : ''); setData(null); return; }
    try { sessionStorage.setItem('lb-admin', kk); } catch { /* ok */ }
    setData(await r.json());
    loadUsers(kk);
  };
  useEffect(() => { load(); }, []);

  const totals = new Map<string, Model>();
  const tasks = new Map<string, { calls: number; usd: number }>();
  for (const d of data?.days || []) {
    for (const [m, v] of Object.entries(d.byModel)) { const t = totals.get(m) || { calls: 0, inTokens: 0, outTokens: 0, images: 0, chars: 0, usd: 0 }; for (const f of Object.keys(t) as (keyof Model)[]) t[f] += v[f]; totals.set(m, t); }
    for (const [n, v] of Object.entries(d.byTask)) { const t = tasks.get(n) || { calls: 0, usd: 0 }; t.calls += v.calls; t.usd += v.usd; tasks.set(n, t); }
  }
  const month = data?.days.filter((d) => d.day.startsWith(data.guard.month)).reduce((a, d) => a + d.usd, 0) || 0;

  return (
    <>
      <header className="topbar"><span className="logo"><Logo /> LessonBloom · Admin</span>{data && <span className="muted small">{data.project} · {data.provider}</span>}</header>
      <main className="page stack" style={{ gap: 18 }}>
        {!data && (
          <div className="card stack" style={{ maxWidth: 480 }}>
            <h2>Admin key</h2>
            <input type="password" value={key} autoComplete="off" onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
            <button className="btn primary" onClick={() => load()}>Open</button>
            {err && <p className="error">{err}</p>}
          </div>
        )}
        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div className="card"><div className="muted small">AI cost this month (from token counts)</div><div className="display" style={{ fontSize: 30 }}>{usd(month)}</div></div>
              <div className="card"><div className="muted small">Spending guard · month</div><div className="display" style={{ fontSize: 30 }}>{usd(data.guard.usd)} <span className="muted" style={{ fontSize: 16 }}>/ {usd(data.guard.limit)}</span></div>
                <div className="bar"><span style={{ width: `${Math.min(100, (100 * data.guard.usd) / data.guard.limit)}%`, background: data.guard.usd > data.guard.limit * 0.8 ? 'var(--orange-dark)' : 'var(--green)' }} /></div></div>
              <div className="card"><div className="muted small">Spending guard · today</div><div className="display" style={{ fontSize: 30 }}>{usd(data.guard.today)} <span className="muted" style={{ fontSize: 16 }}>/ {usd(data.guard.dayLimit)}</span></div></div>
              <div className="card stack" style={{ gap: 4 }}><div className="muted small">Official bill (Cloud Billing)</div>
                {data.links.reports && <a href={data.links.reports} target="_blank" rel="noreferrer">Billing reports ↗</a>}
                {data.links.run && <a href={data.links.run} target="_blank" rel="noreferrer">Cloud Run ↗</a>}
                {data.links.vertex && <a href={data.links.vertex} target="_blank" rel="noreferrer">Vertex AI ↗</a>}</div>
            </div>
            <p className="note small">Costs here are estimates from the tokens, images and voice characters each model call reported, at list prices. The guard uses deliberately high per-action estimates and stops new AI work at its limits. The exact amount is in Cloud Billing.</p>
            <div className="card stack">
              <h3>By model (last 31 days)</h3>
              <table className="t"><thead><tr><th>Model</th><th>Calls</th><th>Input tokens</th><th>Output tokens</th><th>Images</th><th>TTS chars</th><th>Cost</th></tr></thead>
                <tbody>{[...totals].sort((a, b) => b[1].usd - a[1].usd).map(([m, v]) => <tr key={m}><td>{m}</td><td>{v.calls}</td><td>{k(v.inTokens)}</td><td>{k(v.outTokens)}</td><td>{v.images || ''}</td><td>{v.chars ? k(v.chars) : ''}</td><td>{usd(v.usd)}</td></tr>)}</tbody></table>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18, alignItems: 'start' }}>
              <div className="card stack"><h3>By day</h3>
                <table className="t"><thead><tr><th>Day</th><th>Calls</th><th>Cost</th></tr></thead>
                  <tbody>{data.days.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.calls}</td><td>{usd(d.usd)}</td></tr>)}</tbody></table>
                {!data.days.length && <p className="muted">No AI calls yet.</p>}</div>
              <div className="card stack"><h3>By task</h3>
                <table className="t"><thead><tr><th>Task</th><th>Calls</th><th>Cost</th></tr></thead>
                  <tbody>{[...tasks].sort((a, b) => b[1].usd - a[1].usd).map(([n, v]) => <tr key={n}><td>{n}</td><td>{v.calls}</td><td>{usd(v.usd)}</td></tr>)}</tbody></table></div>
            </div>
            <div className="card stack">
              <div className="row"><h3 className="grow">Users ({users.filter((x) => x.account).length} accounts · {users.filter((x) => !x.account).length} demo)</h3>
                <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={showDemo} onChange={(e) => setShowDemo(e.target.checked)} />show demo workspaces</label></div>
              {users.some((x) => x.proRequestedAt) && <div className="ok-note">Pro requests: {users.filter((x) => x.proRequestedAt).map((x) => x.email || x.name).join(', ')}</div>}
              <table className="t"><thead><tr><th>User</th><th>Plan</th><th>Lessons</th><th>Credits today</th><th>Credits month</th><th>AI cost month</th><th>Last active</th><th /></tr></thead>
                <tbody>{users.filter((x) => showDemo || x.account).map((x) => (
                  <tr key={x.id} style={x.proRequestedAt ? { background: 'var(--green-soft)' } : undefined}>
                    <td><strong>{x.name}</strong><div className="muted small">{x.email || `demo · ${x.id.slice(0, 6)}…`}</div></td>
                    <td><span className={`chip ${x.plan === 'pro' ? 'green' : x.plan === 'free' ? 'blue' : ''}`}>{x.plan}</span>{x.proRequestedAt && <div className="small" style={{ color: 'var(--green-ink)' }}>wants Pro</div>}</td>
                    <td>{x.lessons}</td><td>{x.creditsToday}</td><td>{x.creditsMonth}</td><td>{usd(x.usdMonth)}</td><td>{x.lastActive}</td>
                    <td>{x.plan === 'pro' ? <button className="btn sm" onClick={() => setPlan(x.id, x.account ? 'free' : 'demo')}>Set {x.account ? 'Free' : 'Demo'}</button>
                      : <button className="btn sm green" onClick={() => setPlan(x.id, 'pro')}>Make Pro</button>}</td>
                  </tr>))}</tbody></table>
            </div>
            <div className="row"><button className="btn" onClick={() => load()}>Refresh</button><button className="btn ghost" onClick={() => { try { sessionStorage.removeItem('lb-admin'); } catch { /* ok */ } setData(null); setKey(''); }}>Lock</button></div>
          </>
        )}
      </main>
    </>
  );
}
