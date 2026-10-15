// "Lượt dùng AI": the teacher's plan, credits left today, the last 30 days (credits, actions,
// real AI cost) and the Pro upgrade request. Pro is approved by the LessonBloom team (no payment
// in the prototype).
import { useEffect, useState } from 'react';
import { teacherApi, type Usage as U } from '../api.ts';
import { useT } from '../i18n.ts';

const D = {
  vi: {
    loading: 'Đang tải…',
    title: 'Lượt dùng AI', sub: 'Mỗi việc AI làm cho cô dùng một số lượt. Lượt được làm mới mỗi ngày.',
    plan: 'Gói của cô', plans: { demo: 'Dùng thử', free: 'Miễn phí', pro: 'Pro' }, today: 'Hôm nay', of: 'trên', unlimited: 'Không giới hạn',
    costs: 'Mỗi việc dùng bao nhiêu lượt', kinds: { lesson: 'Tạo bài giảng mới (slide, bài tập, thẻ nhớ, hình)', video: 'Tạo video có giọng đọc', slideImage: 'Đổi hình minh họa', slideEdit: 'Viết lại / đơn giản hơn một slide', comments: 'Soạn gợi ý lời nhận xét', intake: 'AI đọc tài liệu' } as Record<string, string>,
    history: '30 ngày qua', day: 'Ngày', credits: 'Lượt', actions: 'Việc', cost: 'Chi phí AI thực tế', none: 'Chưa dùng lượt nào.',
    proTitle: 'Gói Pro', proPoints: ['Tạo bài giảng, video và bài tập không giới hạn mỗi ngày', 'Ưu tiên khi vẽ hình và làm video', 'Tóm tắt học tập cho nhiều lớp và nhiều môn'],
    proAsk: 'Đăng ký dùng Pro', proAsked: 'Đã gửi yêu cầu – đội LessonBloom sẽ mở Pro cho cô sớm.', proNeedAccount: 'Cô đăng ký tài khoản (miễn phí) để nâng cấp Pro.', proYou: 'Cô đang dùng gói Pro. Cảm ơn cô!',
    proNote: 'Bản dự thi: Pro được mở miễn phí theo yêu cầu, chưa thu phí.',
  },
  en: {
    loading: 'Loading…',
    title: 'AI usage', sub: 'Each AI task uses some credits. Credits refresh every day.',
    plan: 'Your plan', plans: { demo: 'Demo', free: 'Free', pro: 'Pro' }, today: 'Today', of: 'of', unlimited: 'Unlimited',
    costs: 'Credits per task', kinds: { lesson: 'New lesson (slides, exercises, flashcards, pictures)', video: 'Narrated video', slideImage: 'New illustration', slideEdit: 'Rewrite / simplify a slide', comments: 'Draft comments', intake: 'AI reads the document' } as Record<string, string>,
    history: 'Last 30 days', day: 'Day', credits: 'Credits', actions: 'Tasks', cost: 'Actual AI cost', none: 'No credits used yet.',
    proTitle: 'Pro plan', proPoints: ['Unlimited lessons, videos and exercises every day', 'Priority for pictures and video', 'Learning insights across classes and subjects'],
    proAsk: 'Request Pro', proAsked: 'Request sent – the LessonBloom team will enable Pro for you soon.', proNeedAccount: 'Register a free account to upgrade to Pro.', proYou: 'You are on Pro. Thank you!',
    proNote: 'Competition prototype: Pro is enabled free on request; no payment yet.',
  },
};

export function Usage() {
  const t = useT(D);
  const [u, setU] = useState<U | null>(null), [err, setErr] = useState('');
  const load = () => teacherApi.usage().then(setU).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (err) return <p className="page error">{err}</p>;
  if (!u) return <p className="page muted" role="status">{t.loading}</p>;
  const pct = u.limit ? Math.min(100, (100 * u.usedToday) / u.limit) : 0;
  return (
    <main className="page" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 24, alignItems: 'start' }}>
      <section className="stack" style={{ gap: 18 }}>
        <div><h1>{t.title}</h1><p className="muted" style={{ margin: '6px 0 0' }}>{t.sub}</p></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div className="card"><div className="muted small">{t.plan}</div><div className="display" style={{ fontSize: 30, color: u.plan === 'pro' ? 'var(--green-ink)' : 'var(--blue)' }}>{t.plans[u.plan]}</div></div>
          <div className="card stack" style={{ gap: 8 }}><div className="muted small">{t.today}</div>
            <div className="display" style={{ fontSize: 30 }}>{u.usedToday} <span className="muted" style={{ fontSize: 16 }}>{t.of} {u.limit ?? '∞'}</span></div>
            {u.limit ? <div className="bar"><span style={{ width: `${pct}%`, background: pct > 80 ? 'var(--orange-dark)' : 'var(--green)' }} /></div> : <span className="chip green">{t.unlimited}</span>}</div>
        </div>
        <div className="card stack">
          <h3>{t.history}</h3>
          {u.days.length ? (
            <div className="table-scroll"><table className="t history"><thead><tr><th>{t.day}</th><th>{t.credits}</th><th>{t.actions}</th><th>{t.cost}</th></tr></thead>
              <tbody>{u.days.map((d) => <tr key={d.day}><td>{d.day.split('-').reverse().join('/')}</td><td>{d.credits}</td>
                <td className="small">{Object.entries(d.actions).map(([k, n]) => `${t.kinds[k]?.split(' (')[0] || k} ×${n}`).join(' · ')}</td><td>${d.usd.toFixed(3)}</td></tr>)}</tbody></table></div>
          ) : <p className="muted">{t.none}</p>}
        </div>
        <div className="card stack">
          <h3>{t.costs}</h3>
          <table className="t"><tbody>{Object.entries(u.costs).map(([k, n]) => <tr key={k}><td>{t.kinds[k] || k}</td><td style={{ textAlign: 'right' }}><strong>{n}</strong></td></tr>)}</tbody></table>
        </div>
      </section>
      <aside className="card stack" style={{ borderColor: 'var(--green)', gap: 12 }}>
        <span className="chip green" style={{ alignSelf: 'flex-start' }}>PRO</span>
        <h2>{t.proTitle}</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>{t.proPoints.map((p) => <li key={p}>{p}</li>)}</ul>
        {u.plan === 'pro' ? <div className="ok-note">✓ {t.proYou}</div>
          : u.plan === 'demo' ? <p className="muted small" style={{ margin: 0 }}>{t.proNeedAccount}</p>
            : u.proRequestedAt ? <div className="ok-note">✓ {t.proAsked}</div>
              : <button className="btn green lg" onClick={async () => { await teacherApi.proRequest(); load(); }}>{t.proAsk}</button>}
        <p className="muted small" style={{ margin: 0 }}>{t.proNote}</p>
      </aside>
    </main>
  );
}
