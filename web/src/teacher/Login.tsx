// Teacher sign-in, registration and password reset, plus the "try without registering" demo.
// Registering and resetting both go through a 6-digit code sent by email (server/otp.ts): the
// account is created, or the password changed, only after the code checks out. Sign-in itself is
// Firebase email + password. Pupils never see this page; the card links them to /learn.
import { useEffect, useRef, useState } from 'react';
import { accountApi, startDemo, type Teacher } from '../api.ts';
import { authError, rememberName, signIn, useAuth } from '../auth.ts';
import { useLang, useT } from '../i18n.ts';
import { LangToggle, Logo } from '../main.tsx';

const L = {
  vi: {
    head: 'Soạn bài giảng sinh động trong 5 phút',
    lead: 'Dành cho giáo viên tiểu học dạy Toán và Tiếng Anh lớp 1–5. Học sinh luyện trên điện thoại, không cần tài khoản.',
    steps: ['Dán giáo án hoặc tải tài liệu lên', 'AI soạn slide, video có giọng đọc và bài tập theo mẫu', 'Giao bài bằng mã lớp; xem tóm tắt theo từng dạng bài'],
    privacy: 'LessonBloom chỉ lưu email và tên hiển thị của cô. Với học sinh, chỉ lưu tên gọi.',
    inTitle: 'Chào cô!', inSub: 'Đăng nhập để tiếp tục soạn bài.',
    upTitle: 'Tạo tài khoản miễn phí', upSub: '30 lượt AI mỗi ngày; bài giảng và lớp học được lưu lại.',
    resetTitle: 'Quên mật khẩu', resetSub: 'Nhập email cô đã đăng ký. LessonBloom gửi mã 6 số để cô đặt mật khẩu mới.',
    codeUpTitle: 'Xác nhận email', codeResetTitle: 'Đặt mật khẩu mới',
    codeSent: (e: string) => `Mã 6 số đã được gửi tới ${e}. Mã dùng được trong 10 phút; cô xem cả mục Spam nhé.`,
    codeSentReset: (e: string) => `Nếu ${e} đã đăng ký, mã 6 số sẽ đến trong vài phút (xem cả mục Spam). Mã dùng được trong 10 phút.`,
    signIn: 'Đăng nhập', register: 'Đăng ký', forgot: 'Quên mật khẩu?',
    name: 'Tên hiển thị', namePh: 'Ví dụ: Cô Hạnh', email: 'Email', emailPh: 'ten@truong.edu.vn', password: 'Mật khẩu', newPassword: 'Mật khẩu mới', pwHint: 'Ít nhất 6 ký tự.',
    code: 'Mã xác nhận (6 số)', show: 'Hiện', hide: 'Ẩn', showAria: 'Hiện mật khẩu', hideAria: 'Ẩn mật khẩu',
    doSignIn: 'Đăng nhập', doSendUp: 'Gửi mã xác nhận', doSendReset: 'Gửi mã', doVerifyUp: 'Xác nhận và tạo tài khoản', doVerifyReset: 'Đặt mật khẩu mới',
    busyIn: 'Đang đăng nhập…', busySend: 'Đang gửi mã…', busyVerify: 'Đang xác nhận…', busyDemo: 'Đang mở bản dùng thử…',
    resend: 'Gửi lại mã', resendIn: (s: number) => `Gửi lại mã sau ${s} giây`, resent: 'Đã gửi mã mới.', changeEmail: 'Đổi email', back: '‹ Quay lại đăng nhập',
    codeShort: 'Cô nhập đủ 6 số trong email nhé.',
    or: 'hoặc', demo: 'Dùng thử ngay, không cần đăng ký', demoNote: 'Bản dùng thử có sẵn lớp 2A, 2B, 2C và kết quả học tập mẫu. Bài cô tạo chỉ lưu trên trình duyệt này.',
    pupil: 'Học sinh?', pupilGo: 'Vào học bằng mã lớp ›', terms: 'Khi đăng ký, cô đồng ý để LessonBloom lưu email và tên hiển thị để đăng nhập.',
    soon: 'Đăng nhập bằng email chưa bật. Cô dùng thử bản demo nhé.',
  },
  en: {
    head: 'A lively lesson from your notes in 5 minutes',
    lead: 'For primary teachers of Maths and English, grades 1–5. Pupils practise on a phone, with no account.',
    steps: ['Paste your lesson notes or upload a document', 'AI writes slides, a narrated video and template exercises', 'Assign with a class code; see a summary for each skill'],
    privacy: 'LessonBloom stores only your email and display name. For pupils, only a first name.',
    inTitle: 'Welcome back!', inSub: 'Sign in to keep preparing your lessons.',
    upTitle: 'Create a free account', upSub: '30 AI credits a day; your lessons and classes are saved.',
    resetTitle: 'Forgot password', resetSub: 'Enter the email you registered with. LessonBloom will send a 6-digit code to set a new password.',
    codeUpTitle: 'Confirm your email', codeResetTitle: 'Set a new password',
    codeSent: (e: string) => `A 6-digit code was sent to ${e}. It works for 10 minutes; check Spam too.`,
    codeSentReset: (e: string) => `If ${e} is registered, a 6-digit code will arrive in a few minutes (check Spam too). It works for 10 minutes.`,
    signIn: 'Sign in', register: 'Register', forgot: 'Forgot password?',
    name: 'Display name', namePh: 'e.g. Ms. Hanh', email: 'Email', emailPh: 'name@school.edu', password: 'Password', newPassword: 'New password', pwHint: 'At least 6 characters.',
    code: 'Verification code (6 digits)', show: 'Show', hide: 'Hide', showAria: 'Show password', hideAria: 'Hide password',
    doSignIn: 'Sign in', doSendUp: 'Send verification code', doSendReset: 'Send code', doVerifyUp: 'Confirm and create account', doVerifyReset: 'Set new password',
    busyIn: 'Signing in…', busySend: 'Sending the code…', busyVerify: 'Checking…', busyDemo: 'Opening the demo…',
    resend: 'Send a new code', resendIn: (s: number) => `New code in ${s} s`, resent: 'A new code was sent.', changeEmail: 'Change email', back: '‹ Back to sign in',
    codeShort: 'Please enter all 6 digits from the email.',
    or: 'or', demo: 'Try it now, no registration', demoNote: 'The demo comes with classes 2A, 2B, 2C and sample results. Lessons you make are kept only in this browser.',
    pupil: 'Pupil?', pupilGo: 'Join with a class code ›', terms: 'By registering you agree that LessonBloom stores your email and display name for sign-in.',
    soon: 'Email sign-in is not switched on. Please try the demo.',
  },
};

type Mode = 'in' | 'up' | 'reset';

export function Login({ onReady }: { onReady: (t: Teacher) => void }) {
  const t = useT(L), lang = useLang();
  const { enabled } = useAuth();
  const [mode, setMode] = useState<Mode>('in');
  const [stage, setStage] = useState<'form' | 'code'>('form');      // register/reset: details first, then the emailed code
  const [f, setF] = useState({ name: '', email: '', password: '', code: '' });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<'' | 'form' | 'demo' | 'resend'>(''), [err, setErr] = useState<unknown>(null), [note, setNote] = useState('');
  const [wait, setWait] = useState(0);                              // seconds until "send a new code" is allowed
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => { if (wait > 0) { const id = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(id); } }, [wait]);
  // older links from Firebase emails (?verified=1, ?reset=1) just land here
  useEffect(() => { const q = new URLSearchParams(location.search); if (q.has('reset') || q.has('verified')) history.replaceState(null, '', '/'); }, []);

  const focusFirst = () => setTimeout(() => first.current?.focus(), 0);
  const switchTo = (m: Mode) => { setMode(m); setStage('form'); setErr(null); setNote(''); setShowPw(false); setF((x) => ({ ...x, code: '', password: m === 'reset' ? '' : x.password })); focusFirst(); };
  const run = async (kind: 'form' | 'demo' | 'resend', fn: () => Promise<void>) => {
    setBusy(kind); setErr(null); setNote('');
    try { await fn(); } catch (e) { setErr(e); const w = (e as { retryIn?: number }).retryIn; if (w) setWait(w); } finally { setBusy(''); }
  };
  // Firebase errors have an auth/ code and are translated here; server errors arrive already in the chosen language
  const errText = err ? ((err as { code?: string }).code?.startsWith('auth/') ? authError(err, lang) : (err as Error).message) : '';
  const fail = (code: string) => { setNote(''); setErr({ code }); };
  const local = (msg: string) => { setNote(''); setErr(new Error(msg)); };

  const email = f.email.trim().toLowerCase();
  const checkDetails = () => {
    if (!email) return 'auth/missing-email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'auth/invalid-email';
    if (mode === 'reset' && stage === 'form') return '';
    if (!f.password) return 'auth/missing-password';
    if (mode !== 'in' && f.password.length < 6) return 'auth/weak-password';
    return '';
  };
  const sendCode = (again = false) => run(again ? 'resend' : 'form', async () => {
    await accountApi.sendCode(email, mode === 'reset' ? 'reset' : 'register');
    setStage('code'); setWait(60); setF((x) => ({ ...x, code: '' }));
    if (again) setNote(t.resent);
    focusFirst();
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const bad = checkDetails();
    if (bad) return fail(bad);
    if (mode === 'in') return run('form', () => signIn(email, f.password));
    if (stage === 'form') return sendCode();
    if (!/^\d{6}$/.test(f.code.trim())) return local(t.codeShort);
    const name = f.name.trim() || email.split('@')[0];
    run('form', async () => {
      if (mode === 'up') { await accountApi.register({ email, code: f.code.trim(), password: f.password, name }); rememberName(email, name); }
      else await accountApi.reset({ email, code: f.code.trim(), password: f.password });
      await signIn(email, f.password);      // signed in: the app loads the workspace
    });
  };

  const codeStage = mode !== 'in' && stage === 'code';
  const [title, sub] = codeStage
    ? [mode === 'up' ? t.codeUpTitle : t.codeResetTitle, mode === 'up' ? t.codeSent(email) : t.codeSentReset(email)]
    : ({ in: [t.inTitle, t.inSub], up: [t.upTitle, t.upSub], reset: [t.resetTitle, t.resetSub] } as const)[mode];
  const action = busy === 'form'
    ? (mode === 'in' ? t.busyIn : codeStage ? t.busyVerify : t.busySend)
    : mode === 'in' ? t.doSignIn : codeStage ? (mode === 'up' ? t.doVerifyUp : t.doVerifyReset) : (mode === 'up' ? t.doSendUp : t.doSendReset);
  const pwField = (label: string, newPw: boolean) => (
    <div className="field">
      <label htmlFor="pw">{label}</label>
      <div className="pw">
        <input id="pw" ref={codeStage ? undefined : undefined} type={showPw ? 'text' : 'password'} autoComplete={newPw ? 'new-password' : 'current-password'}
          value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-describedby={newPw ? 'pw-hint' : undefined} />
        <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} aria-label={showPw ? t.hideAria : t.showAria} aria-pressed={showPw}>{showPw ? t.hide : t.show}</button>
      </div>
      {newPw && <span id="pw-hint" className="muted small">{t.pwHint}</span>}
    </div>
  );

  return (
    <div className="auth">
      <header className="topbar"><span className="logo"><Logo /> LessonBloom</span><LangToggle /></header>
      <main className="auth-main">
        <section className="auth-hero">
          <h1 className="display">{t.head}</h1>
          <p className="auth-lead">{t.lead}</p>
          <ol className="auth-steps">{t.steps.map((s, i) => <li key={s}><span className={`auth-step-n n${i}`} aria-hidden="true">{i + 1}</span><span>{s}</span></li>)}</ol>
          <p className="muted small auth-privacy">{t.privacy}</p>
        </section>

        <section className="card auth-card" aria-labelledby="auth-title">
          <div className="auth-head">
            <h2 id="auth-title" className="display">{title}</h2>
            <p className="muted">{sub}</p>
          </div>
          {enabled ? (
            <form className="auth-form" onSubmit={submit} noValidate>
              {mode !== 'reset' && !codeStage && (
                <div className="auth-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => switchTo('in')}>{t.signIn}</button>
                  <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => switchTo('up')}>{t.register}</button>
                </div>
              )}
              {codeStage ? (
                <>
                  <label className="field">{t.code}
                    <input ref={first} className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••"
                      value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
                  </label>
                  {mode === 'reset' && pwField(t.newPassword, true)}
                </>
              ) : (
                <>
                  {mode === 'up' && (
                    <label className="field">{t.name}
                      <input ref={first} autoComplete="name" placeholder={t.namePh} maxLength={40} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                    </label>
                  )}
                  <label className="field">{t.email}
                    <input ref={mode === 'up' ? undefined : first} type="email" inputMode="email" autoComplete="email" placeholder={t.emailPh} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                  </label>
                  {mode !== 'reset' && pwField(t.password, mode === 'up')}
                </>
              )}
              {errText && <p className="auth-msg err" role="alert">{errText}</p>}
              {note && <p className="auth-msg ok" role="status">{note}</p>}
              <button className="btn primary lg block" disabled={!!busy}>{action}</button>
              {mode === 'in' && <button type="button" className="link-btn auth-forgot" onClick={() => switchTo('reset')}>{t.forgot}</button>}
              {codeStage && (
                <div className="auth-links">
                  <button type="button" className="link-btn" disabled={wait > 0 || !!busy} onClick={() => sendCode(true)}>{wait > 0 ? t.resendIn(wait) : t.resend}</button>
                  <button type="button" className="link-btn" onClick={() => { setStage('form'); setErr(null); setNote(''); }}>{t.changeEmail}</button>
                </div>
              )}
              {mode === 'up' && !codeStage && <p className="muted small" style={{ margin: 0 }}>{t.terms}</p>}
              {mode === 'reset' && <button type="button" className="link-btn auth-forgot" onClick={() => switchTo('in')}>{t.back}</button>}
            </form>
          ) : <p className="muted">{t.soon}</p>}

          {mode !== 'reset' && !codeStage && (
            <>
              <div className="auth-or"><span>{t.or}</span></div>
              <button className="btn lg block auth-demo" disabled={!!busy} onClick={() => run('demo', async () => onReady(await startDemo()))}>{busy === 'demo' ? t.busyDemo : t.demo}</button>
              <p className="muted small" style={{ margin: 0 }}>{t.demoNote}</p>
            </>
          )}
          <div className="auth-pupil"><span aria-hidden="true">🎒</span><span>{t.pupil}</span><a href="/learn">{t.pupilGo}</a></div>
        </section>
      </main>
    </div>
  );
}
