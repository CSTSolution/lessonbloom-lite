// Teacher sign-in / registration / password reset (Firebase email + password; Firebase sends the
// verification and reset emails, whose links come back here with ?verified=1 or ?reset=1) and
// the "try without registering" demo. Pupils never see this page; they get a link to /learn.
import { useEffect, useRef, useState } from 'react';
import { startDemo, type Teacher } from '../api.ts';
import { authError, resetPassword, signIn, signUp, useAuth } from '../auth.ts';
import { useLang, useT } from '../i18n.ts';
import { LangToggle, Logo } from '../main.tsx';

const L = {
  vi: {
    badge: 'Cho giáo viên tiểu học · Toán và Tiếng Anh lớp 1–5',
    head: 'Từ một trang giáo án đến bài giảng sinh động trong 5 phút',
    lead: 'LessonBloom soạn slide, video có giọng đọc và bài tập theo mẫu. Học sinh luyện trên điện thoại; cô xem tóm tắt theo từng dạng bài.',
    tiles: [['36 + 27', 'Slide và video'], ['🍎 apple', 'Bài tập, thẻ nhớ'], ['⭐ Đã vững', 'Tóm tắt học tập']],
    privacy: 'LessonBloom chỉ lưu email và tên hiển thị của cô. Học sinh không cần tài khoản, chỉ lưu tên gọi.',
    inTitle: 'Chào cô!', inSub: 'Đăng nhập để tiếp tục soạn bài.',
    upTitle: 'Tạo tài khoản miễn phí', upSub: '30 lượt AI mỗi ngày; bài giảng và lớp học được lưu lại.',
    resetTitle: 'Đặt lại mật khẩu', resetSub: 'Nhập email cô đã đăng ký. LessonBloom gửi đường link để đặt mật khẩu mới.',
    signIn: 'Đăng nhập', register: 'Đăng ký', forgot: 'Quên mật khẩu?',
    name: 'Tên hiển thị', namePh: 'Ví dụ: Cô Hạnh', email: 'Email', emailPh: 'ten@truong.edu.vn', password: 'Mật khẩu', pwHint: 'Ít nhất 6 ký tự.',
    show: 'Hiện', hide: 'Ẩn', showAria: 'Hiện mật khẩu', hideAria: 'Ẩn mật khẩu',
    doSignIn: 'Đăng nhập', doRegister: 'Tạo tài khoản', doReset: 'Gửi đường link', busyIn: 'Đang đăng nhập…', busyUp: 'Đang tạo tài khoản…', busyReset: 'Đang gửi…', busyDemo: 'Đang mở bản dùng thử…',
    back: '‹ Quay lại đăng nhập',
    resetSent: (e: string) => `Đã gửi! Nếu ${e} đã đăng ký, cô sẽ nhận được email trong vài phút (xem cả mục Spam). Bấm đường link trong email để đặt mật khẩu mới.`,
    resetDone: 'Đã đổi mật khẩu. Cô đăng nhập bằng mật khẩu mới nhé.', verifiedDone: 'Email đã được xác nhận. Cô đăng nhập để bắt đầu nhé.',
    or: 'hoặc', demo: 'Dùng thử ngay, không cần đăng ký', demoNote: 'Bản dùng thử có sẵn lớp 2A, 2B, 2C và kết quả học tập mẫu. Bài cô tạo chỉ lưu trên trình duyệt này.',
    pupil: 'Học sinh?', pupilGo: 'Vào học bằng mã lớp ›', terms: 'Khi đăng ký, cô đồng ý để LessonBloom lưu email và tên hiển thị để đăng nhập.',
    soon: 'Đăng nhập bằng email chưa bật. Cô dùng thử bản demo nhé.',
  },
  en: {
    badge: 'For primary teachers · Maths and English, grades 1–5',
    head: 'From one page of lesson notes to a lively lesson in 5 minutes',
    lead: 'LessonBloom writes slides, a narrated video and template exercises. Pupils practise on a phone; you see a summary for each skill.',
    tiles: [['36 + 27', 'Slides and video'], ['🍎 apple', 'Exercises, flashcards'], ['⭐ Mastered', 'Learning summary']],
    privacy: 'LessonBloom stores only your email and display name. Pupils need no account; only a first name is stored.',
    inTitle: 'Welcome back!', inSub: 'Sign in to keep preparing your lessons.',
    upTitle: 'Create a free account', upSub: '30 AI credits a day; your lessons and classes are saved.',
    resetTitle: 'Reset your password', resetSub: 'Enter the email you registered with. LessonBloom will send a link to set a new password.',
    signIn: 'Sign in', register: 'Register', forgot: 'Forgot password?',
    name: 'Display name', namePh: 'e.g. Ms. Hanh', email: 'Email', emailPh: 'name@school.edu', password: 'Password', pwHint: 'At least 6 characters.',
    show: 'Show', hide: 'Hide', showAria: 'Show password', hideAria: 'Hide password',
    doSignIn: 'Sign in', doRegister: 'Create account', doReset: 'Send the link', busyIn: 'Signing in…', busyUp: 'Creating your account…', busyReset: 'Sending…', busyDemo: 'Opening the demo…',
    back: '‹ Back to sign in',
    resetSent: (e: string) => `Sent! If ${e} is registered, the email will arrive in a few minutes (check Spam too). Open the link in it to set a new password.`,
    resetDone: 'Your password has been changed. Please sign in with the new one.', verifiedDone: 'Your email is confirmed. Please sign in to start.',
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
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<'' | 'form' | 'demo'>(''), [msg, setMsg] = useState<'' | 'resetDone' | 'verifiedDone' | 'resetSent'>(''), [err, setErr] = useState<unknown>(null);
  const first = useRef<HTMLInputElement>(null);

  // back from a Firebase email link
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.has('reset')) setMsg('resetDone');
    else if (q.has('verified')) setMsg('verifiedDone');
    if (q.has('reset') || q.has('verified')) history.replaceState(null, '', '/');
  }, []);

  const switchTo = (m: Mode) => { setMode(m); setErr(null); setMsg(''); setShowPw(false); setTimeout(() => first.current?.focus(), 0); };
  const run = async (kind: 'form' | 'demo', fn: () => Promise<void>) => {
    setBusy(kind); setErr(null); setMsg('');
    try { await fn(); } catch (e) { setErr(e); } finally { setBusy(''); }
  };
  // Firebase errors have a code and are translated here; server errors arrive already in the chosen language
  const errText = err ? ((err as { code?: string }).code?.startsWith('auth/') ? authError(err, lang) : (err as Error).message) : '';
  const msgText = msg === 'resetSent' ? t.resetSent(f.email.trim()) : msg ? t[msg] : '';
  // checked here, not by the browser, so the messages follow the app's language
  const invalid = (email: string): string => {
    if (!email) return 'auth/missing-email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'auth/invalid-email';
    if (mode !== 'reset' && !f.password) return 'auth/missing-password';
    if (mode === 'up' && f.password.length < 6) return 'auth/weak-password';
    return '';
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = f.email.trim();
    const bad = invalid(email);
    if (bad) { setMsg(''); setErr({ code: bad }); return; }
    if (mode === 'in') run('form', () => signIn(email, f.password));
    if (mode === 'up') run('form', () => signUp(f.name.trim() || email.split('@')[0], email, f.password));
    if (mode === 'reset') run('form', async () => { await resetPassword(email); setMsg('resetSent'); });
  };
  const title = { in: [t.inTitle, t.inSub], up: [t.upTitle, t.upSub], reset: [t.resetTitle, t.resetSub] }[mode];
  const action = busy === 'form' ? { in: t.busyIn, up: t.busyUp, reset: t.busyReset }[mode] : { in: t.doSignIn, up: t.doRegister, reset: t.doReset }[mode];

  return (
    <div className="auth">
      <header className="topbar"><span className="logo"><Logo /> LessonBloom</span><LangToggle /></header>
      <main className="auth-main">
        <section className="auth-hero">
          <span className="chip blue auth-badge">{t.badge}</span>
          <h1 className="display">{t.head}</h1>
          <p className="auth-lead">{t.lead}</p>
          <div className="auth-tiles" aria-hidden="true">
            {t.tiles.map(([big, label], i) => (
              <div key={label} className="auth-tile"><div className={`auth-tile-face ${['blue', 'amber', 'green'][i]}`}>{big}</div><span>{label}</span></div>
            ))}
          </div>
          <p className="muted small auth-privacy">{t.privacy}</p>
        </section>

        <section className="card auth-card" aria-labelledby="auth-title">
          <div className="stack" style={{ gap: 4 }}>
            <h2 id="auth-title" className="display">{title[0]}</h2>
            <p className="muted" style={{ margin: 0 }}>{title[1]}</p>
          </div>
          {enabled ? (
            <form className="stack" style={{ gap: 14 }} onSubmit={submit} noValidate>
              {mode !== 'reset' && (
                <div className="auth-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => switchTo('in')}>{t.signIn}</button>
                  <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => switchTo('up')}>{t.register}</button>
                </div>
              )}
              {mode === 'up' && (
                <label className="field">{t.name}
                  <input ref={first} autoComplete="name" placeholder={t.namePh} maxLength={40} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                </label>
              )}
              <label className="field">{t.email}
                <input ref={mode === 'up' ? undefined : first} type="email" inputMode="email" autoComplete="email" placeholder={t.emailPh} required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              </label>
              {mode !== 'reset' && (
                <div className="field">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <label htmlFor="pw">{t.password}</label>
                    {mode === 'in' && <button type="button" className="link-btn" onClick={() => switchTo('reset')}>{t.forgot}</button>}
                  </div>
                  <div className="pw">
                    <input id="pw" type={showPw ? 'text' : 'password'} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={6}
                      value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-describedby={mode === 'up' ? 'pw-hint' : undefined} />
                    <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} aria-label={showPw ? t.hideAria : t.showAria} aria-pressed={showPw}>{showPw ? t.hide : t.show}</button>
                  </div>
                  {mode === 'up' && <span id="pw-hint" className="muted small" style={{ fontWeight: 400 }}>{t.pwHint}</span>}
                </div>
              )}
              {errText && <p className="auth-msg err" role="alert">{errText}</p>}
              {msgText && <p className="auth-msg ok" role="status">{msgText}</p>}
              {!(mode === 'reset' && msg === 'resetSent') && <button className="btn primary lg block" disabled={!!busy}>{action}</button>}
              {mode === 'up' && <p className="muted small" style={{ margin: 0 }}>{t.terms}</p>}
              {mode === 'reset' && <button type="button" className="btn ghost" style={{ alignSelf: 'center' }} onClick={() => switchTo('in')}>{t.back}</button>}
            </form>
          ) : <p className="muted">{t.soon}</p>}

          {mode !== 'reset' && (
            <>
              <div className="auth-or"><span>{t.or}</span></div>
              <button className="btn lg block auth-demo" disabled={!!busy} onClick={() => run('demo', async () => onReady(await startDemo()))}>{busy === 'demo' ? t.busyDemo : t.demo}</button>
              <p className="muted small" style={{ margin: 0 }}>{t.demoNote}</p>
            </>
          )}
        </section>
      </main>
      <footer className="auth-pupil"><span>🎒 {t.pupil}</span> <a href="/learn">{t.pupilGo}</a></footer>
    </div>
  );
}
