// Teacher sign-in / registration (Firebase email + password; Firebase sends the verification
// and reset emails) and the "try without registering" demo. Pupils never see this page.
import { useState } from 'react';
import { startDemo, type Teacher } from '../api.ts';
import { authError, resetPassword, signIn, signUp, useAuth } from '../auth.ts';
import { useLang, useT } from '../i18n.ts';
import { LangToggle, Logo } from '../main.tsx';

const L = {
  vi: {
    tagline: 'Từ một trang giáo án đến bài giảng sinh động và phiếu bài tập trong 5 phút – cô giáo dành thời gian cho học trò, không phải cho PowerPoint.',
    signIn: 'Đăng nhập', register: 'Đăng ký', forgot: 'Quên mật khẩu?', name: 'Tên hiển thị (ví dụ: Cô Hạnh)', email: 'Email', password: 'Mật khẩu (ít nhất 6 ký tự)',
    doSignIn: 'Đăng nhập', doRegister: 'Tạo tài khoản', doReset: 'Gửi email đặt lại mật khẩu', back: '‹ Quay lại đăng nhập',
    resetSent: 'Đã gửi email đặt lại mật khẩu. Cô kiểm tra hộp thư (cả mục Spam) nhé.', verifySent: 'Đã tạo tài khoản. Cô mở email để xác nhận địa chỉ nhé.',
    or: 'hoặc', demo: 'Dùng thử ngay – không cần đăng ký', demoNote: 'Bản dùng thử có sẵn lớp 2A, 2B, 2C và kết quả học tập giả định để cô xem cách hoạt động.',
    pupil: 'Học sinh? Vào học bằng mã lớp ›', soon: 'Đăng nhập bằng email sẽ sớm có. Cô dùng thử bản demo nhé.',
    privacy: 'LessonBloom chỉ lưu email và tên hiển thị của cô. Học sinh không cần tài khoản, chỉ lưu tên gọi.',
  },
  en: {
    tagline: 'From one page of lesson notes to a lively lesson and worksheet in 5 minutes – teachers spend their time on pupils, not PowerPoint.',
    signIn: 'Sign in', register: 'Register', forgot: 'Forgot password?', name: 'Display name (e.g. Ms. Hanh)', email: 'Email', password: 'Password (at least 6 characters)',
    doSignIn: 'Sign in', doRegister: 'Create account', doReset: 'Email me a reset link', back: '‹ Back to sign in',
    resetSent: 'Reset email sent. Please check your inbox (and Spam).', verifySent: 'Account created. Please open the email to confirm your address.',
    or: 'or', demo: 'Try it now – no registration', demoNote: 'The demo comes with classes 2A, 2B, 2C and made-up learning results so you can see how it works.',
    pupil: 'Pupil? Join with a class code ›', soon: 'Email sign-in is coming soon. Please try the demo.',
    privacy: 'LessonBloom stores only your email and display name. Pupils need no account; only a first name is stored.',
  },
};

export function Login({ onReady }: { onReady: (t: Teacher) => void }) {
  const t = useT(L), lang = useLang();
  const { enabled } = useAuth();
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [err, setErr] = useState('');

  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(''); setMsg(''); try { await fn(); } catch (e) { setErr(authError(e, lang)); } finally { setBusy(false); } };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'in') run(() => signIn(f.email.trim(), f.password));
    if (mode === 'up') run(async () => { await signUp(f.name.trim() || f.email.split('@')[0], f.email.trim(), f.password); setMsg(t.verifySent); });
    if (mode === 'reset') run(async () => { await resetPassword(f.email.trim()); setMsg(t.resetSent); });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="topbar"><span className="logo"><Logo /> LessonBloom</span><LangToggle /></header>
      <main className="page" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 420px)', gap: 40, alignItems: 'center', flex: 1 }}>
        <section className="stack" style={{ gap: 18 }}>
          <h1 className="display" style={{ fontSize: 44, color: 'var(--blue)', lineHeight: 1.1 }}>LessonBloom</h1>
          <p style={{ fontSize: 20, margin: 0, color: 'var(--ink-2)' }}>{t.tagline}</p>
          <div className="row" style={{ gap: 10 }}>
            {['36 + 27 = 63', 'apple ↔ 🍎', '⭐ Đã vững'].map((x, i) => <span key={x} className={`chip ${['blue', 'amber', 'green'][i]}`} style={{ fontSize: 16, padding: '6px 14px' }}>{x}</span>)}
          </div>
          <p className="muted small">{t.privacy}</p>
        </section>
        <section className="card stack" style={{ gap: 14 }}>
          {enabled ? (
            <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
              {mode !== 'reset' && (
                <div className="lang" role="tablist" style={{ alignSelf: 'flex-start' }}>
                  <button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>{t.signIn}</button>
                  <button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>{t.register}</button>
                </div>
              )}
              {mode === 'up' && <label className="field">{t.name}<input autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>}
              <label className="field">{t.email}<input type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
              {mode !== 'reset' && <label className="field">{t.password}<input type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>}
              <button className="btn primary lg" disabled={busy}>{mode === 'in' ? t.doSignIn : mode === 'up' ? t.doRegister : t.doReset}</button>
              {mode === 'in' && <button type="button" className="btn ghost sm" onClick={() => setMode('reset')}>{t.forgot}</button>}
              {mode === 'reset' && <button type="button" className="btn ghost sm" onClick={() => setMode('in')}>{t.back}</button>}
              {msg && <div className="ok-note">{msg}</div>}
              {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
            </form>
          ) : <p className="muted">{t.soon}</p>}
          <div className="row" style={{ gap: 8 }}><span className="grow" style={{ height: 1, background: 'var(--line)' }} /><span className="muted small">{t.or}</span><span className="grow" style={{ height: 1, background: 'var(--line)' }} /></div>
          <button className="btn lg" style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }} disabled={busy} onClick={() => run(async () => onReady(await startDemo()))}>{t.demo}</button>
          <p className="muted small" style={{ margin: 0 }}>{t.demoNote}</p>
          <a href="/learn" className="small">{t.pupil}</a>
        </section>
      </main>
    </div>
  );
}
