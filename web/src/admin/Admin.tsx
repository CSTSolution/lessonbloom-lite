// /admin (Son only): AI usage counted from real model responses, the spending guard, and links
// to the official bill in Cloud Billing. The admin key lives only in this tab (sessionStorage).
import { useEffect, useState } from 'react';
import { idToken } from '../auth.ts';
import { useT } from '../i18n.ts';
import { LangToggle, Logo } from '../main.tsx';

const A = {
  vi: {
    keyTitle: 'Khoá quản trị', keyHelp: 'Nhập khoá admin, hoặc đăng nhập bằng email quản trị ở trang chính.', open: 'Mở', wrongKey: 'Sai khoá quản trị.', errorN: (n: number) => `Lỗi ${n}. Thử lại sau nhé.`,
    monthCost: 'Chi phí AI tháng này (tính từ token)', guardMonth: 'Giới hạn chi phí · tháng', guardDay: 'Giới hạn chi phí · hôm nay', bill: 'Hoá đơn chính thức (Cloud Billing)', reports: 'Báo cáo thanh toán ↗',
    note: 'Chi phí ở đây là ước tính từ số token, hình và ký tự giọng đọc mà mỗi lần gọi mô hình báo về, theo giá niêm yết. Giới hạn chi phí dùng ước tính cao cho mỗi việc và dừng AI khi chạm mức. Số chính xác xem ở Cloud Billing.',
    byModel: 'Theo mô hình (31 ngày qua)', model: 'Mô hình', calls: 'Lượt gọi', inTok: 'Token vào', outTok: 'Token ra', images: 'Hình', tts: 'Ký tự giọng đọc', cost: 'Chi phí',
    byDay: 'Theo ngày', day: 'Ngày', none: 'Chưa có lượt gọi AI nào.', byTask: 'Theo việc', task: 'Việc',
    users: (a: number, d: number) => `Người dùng (${a} tài khoản · ${d} bản dùng thử)`, showDemo: 'hiện bản dùng thử', proReq: 'Yêu cầu Pro:',
    user: 'Người dùng', plan: 'Gói', lessons: 'Bài giảng', today: 'Lượt hôm nay', month: 'Lượt tháng', aiMonth: 'Chi phí AI tháng', last: 'Hoạt động gần nhất', wantsPro: 'muốn dùng Pro',
    plans: { demo: 'Dùng thử', free: 'Miễn phí', pro: 'Pro' }, setFree: 'Chuyển về Miễn phí', setDemo: 'Chuyển về Dùng thử', makePro: 'Mở Pro', refresh: 'Làm mới', lock: 'Khoá',
  },
  en: {
    keyTitle: 'Admin key', keyHelp: 'Enter the admin key, or sign in with an admin email on the main page.', open: 'Open', wrongKey: 'Wrong admin key.', errorN: (n: number) => `Error ${n}. Please try again later.`,
    monthCost: 'AI cost this month (from token counts)', guardMonth: 'Spending guard · month', guardDay: 'Spending guard · today', bill: 'Official bill (Cloud Billing)', reports: 'Billing reports ↗',
    note: 'Costs here are estimates from the tokens, images and voice characters each model call reported, at list prices. The guard uses deliberately high per-action estimates and stops new AI work at its limits. The exact amount is in Cloud Billing.',
    byModel: 'By model (last 31 days)', model: 'Model', calls: 'Calls', inTok: 'Input tokens', outTok: 'Output tokens', images: 'Images', tts: 'TTS chars', cost: 'Cost',
    byDay: 'By day', day: 'Day', none: 'No AI calls yet.', byTask: 'By task', task: 'Task',
    users: (a: number, d: number) => `Users (${a} accounts · ${d} demo)`, showDemo: 'show demo workspaces', proReq: 'Pro requests:',
    user: 'User', plan: 'Plan', lessons: 'Lessons', today: 'Credits today', month: 'Credits month', aiMonth: 'AI cost month', last: 'Last active', wantsPro: 'wants Pro',
    plans: { demo: 'Demo', free: 'Free', pro: 'Pro' }, setFree: 'Set Free', setDemo: 'Set Demo', makePro: 'Make Pro', refresh: 'Refresh', lock: 'Lock',
  },
};

interface Model { calls: number; inTokens: number; outTokens: number; images: number; chars: number; usd: number }
interface Day { day: string; calls: number; usd: number; byModel: Record<string, Model>; byTask: Record<string, { calls: number; usd: number }> }
interface UserRow { id: string; name: string; email: string | null; plan: 'demo' | 'free' | 'pro'; account: boolean; createdAt: string; proRequestedAt: string | null; lessons: number; creditsToday: number; creditsMonth: number; usdMonth: number; lastActive: string }
interface Overview { provider: string; project: string; guard: { month: string; usd: number; limit: number; today: number; dayLimit: number }; days: Day[]; links: Record<string, string>; prices: Record<string, unknown> }

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

export function Admin() {
  const t = useT(A);
  const [key, setKey] = useState(() => { try { return sessionStorage.getItem('lb-admin') || ''; } catch { return ''; } });
  const [data, setData] = useState<Overview | null>(null), [err, setErr] = useState<number>(0);
  const [users, setUsers] = useState<UserRow[]>([]), [showDemo, setShowDemo] = useState(false);
  const headers = async (kk = key) => { const tok = await idToken(); return { 'x-admin': kk, 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }; };
  const loadUsers = async (kk = key) => { const r = await fetch('/api/admin/users', { headers: await headers(kk) }); if (r.ok) setUsers(await r.json()); };
  const setPlan = async (id: string, plan: string) => { await fetch(`/api/admin/users/${id}/plan`, { method: 'POST', headers: await headers(), body: JSON.stringify({ plan }) }); loadUsers(); };
  const load = async (kk = key) => {
    setErr(0);
    const tok = await idToken();     // signed in as an admin email works too
    const r = await fetch('/api/admin/overview?days=31', { headers: { 'x-admin': kk, ...(tok ? { authorization: `Bearer ${tok}` } : {}) } });
    if (!r.ok) { setErr(kk ? r.status : 0); setData(null); return; }
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
      <header className="topbar"><span className="logo"><Logo /> LessonBloom · Admin</span><div className="row" style={{ flexWrap: 'nowrap' }}>{data && <span className="muted small hide-sm">{data.project} · {data.provider}</span>}<LangToggle /></div></header>
      <main className="page stack" style={{ gap: 18 }}>
        {!data && (
          <div className="card stack" style={{ maxWidth: 480 }}>
            <h2>{t.keyTitle}</h2><p className="muted small" style={{ margin: 0 }}>{t.keyHelp}</p>
            <input type="password" value={key} autoComplete="off" onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
            <button className="btn primary" onClick={() => load()}>{t.open}</button>
            {!!err && <p className="error">{err === 403 ? t.wrongKey : t.errorN(err)}</p>}
          </div>
        )}
        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div className="card"><div className="muted small">{t.monthCost}</div><div className="display" style={{ fontSize: 30 }}>{usd(month)}</div></div>
              <div className="card"><div className="muted small">{t.guardMonth}</div><div className="display" style={{ fontSize: 30 }}>{usd(data.guard.usd)} <span className="muted" style={{ fontSize: 16 }}>/ {usd(data.guard.limit)}</span></div>
                <div className="bar"><span style={{ width: `${Math.min(100, (100 * data.guard.usd) / data.guard.limit)}%`, background: data.guard.usd > data.guard.limit * 0.8 ? 'var(--orange-dark)' : 'var(--green)' }} /></div></div>
              <div className="card"><div className="muted small">{t.guardDay}</div><div className="display" style={{ fontSize: 30 }}>{usd(data.guard.today)} <span className="muted" style={{ fontSize: 16 }}>/ {usd(data.guard.dayLimit)}</span></div></div>
              <div className="card stack" style={{ gap: 4 }}><div className="muted small">{t.bill}</div>
                {data.links.reports && <a href={data.links.reports} target="_blank" rel="noreferrer">{t.reports}</a>}
                {data.links.run && <a href={data.links.run} target="_blank" rel="noreferrer">Cloud Run ↗</a>}
                {data.links.vertex && <a href={data.links.vertex} target="_blank" rel="noreferrer">Vertex AI ↗</a>}</div>
            </div>
            <p className="note small">{t.note}</p>
            <div className="card stack">
              <h3>{t.byModel}</h3>
              <div className="table-scroll"><table className="t"><thead><tr><th>{t.model}</th><th>{t.calls}</th><th>{t.inTok}</th><th>{t.outTok}</th><th>{t.images}</th><th>{t.tts}</th><th>{t.cost}</th></tr></thead>
                <tbody>{[...totals].sort((a, b) => b[1].usd - a[1].usd).map(([m, v]) => <tr key={m}><td>{m}</td><td>{v.calls}</td><td>{k(v.inTokens)}</td><td>{k(v.outTokens)}</td><td>{v.images || ''}</td><td>{v.chars ? k(v.chars) : ''}</td><td>{usd(v.usd)}</td></tr>)}</tbody></table></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18, alignItems: 'start' }}>
              <div className="card stack"><h3>{t.byDay}</h3>
                <table className="t"><thead><tr><th>{t.day}</th><th>{t.calls}</th><th>{t.cost}</th></tr></thead>
                  <tbody>{data.days.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.calls}</td><td>{usd(d.usd)}</td></tr>)}</tbody></table>
                {!data.days.length && <p className="muted">{t.none}</p>}</div>
              <div className="card stack"><h3>{t.byTask}</h3>
                <table className="t"><thead><tr><th>{t.task}</th><th>{t.calls}</th><th>{t.cost}</th></tr></thead>
                  <tbody>{[...tasks].sort((a, b) => b[1].usd - a[1].usd).map(([n, v]) => <tr key={n}><td>{n}</td><td>{v.calls}</td><td>{usd(v.usd)}</td></tr>)}</tbody></table></div>
            </div>
            <div className="card stack">
              <div className="row"><h3 className="grow">{t.users(users.filter((x) => x.account).length, users.filter((x) => !x.account).length)}</h3>
                <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={showDemo} onChange={(e) => setShowDemo(e.target.checked)} />{t.showDemo}</label></div>
              {users.some((x) => x.proRequestedAt) && <div className="ok-note">{t.proReq} {users.filter((x) => x.proRequestedAt).map((x) => x.email || x.name).join(', ')}</div>}
              <div className="table-scroll"><table className="t"><thead><tr><th>{t.user}</th><th>{t.plan}</th><th>{t.lessons}</th><th>{t.today}</th><th>{t.month}</th><th>{t.aiMonth}</th><th>{t.last}</th><th /></tr></thead>
                <tbody>{users.filter((x) => showDemo || x.account).map((x) => (
                  <tr key={x.id} style={x.proRequestedAt ? { background: 'var(--green-soft)' } : undefined}>
                    <td><strong>{x.name}</strong><div className="muted small">{x.email || `demo · ${x.id.slice(0, 6)}…`}</div></td>
                    <td><span className={`chip ${x.plan === 'pro' ? 'green' : x.plan === 'free' ? 'blue' : ''}`}>{t.plans[x.plan]}</span>{x.proRequestedAt && <div className="small" style={{ color: 'var(--green-ink)' }}>{t.wantsPro}</div>}</td>
                    <td>{x.lessons}</td><td>{x.creditsToday}</td><td>{x.creditsMonth}</td><td>{usd(x.usdMonth)}</td><td>{x.lastActive}</td>
                    <td>{x.plan === 'pro' ? <button className="btn sm" onClick={() => setPlan(x.id, x.account ? 'free' : 'demo')}>{x.account ? t.setFree : t.setDemo}</button>
                      : <button className="btn sm green" onClick={() => setPlan(x.id, 'pro')}>{t.makePro}</button>}</td>
                  </tr>))}</tbody></table></div>
            </div>
            <div className="row"><button className="btn" onClick={() => load()}>{t.refresh}</button><button className="btn ghost" onClick={() => { try { sessionStorage.removeItem('lb-admin'); } catch { /* ok */ } setData(null); setKey(''); }}>{t.lock}</button></div>
          </>
        )}
      </main>
    </>
  );
}
