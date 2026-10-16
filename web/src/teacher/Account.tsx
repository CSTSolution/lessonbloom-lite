// "Tài khoản của tôi": change the display name; for a registered account also change the
// password (needs the current one), or, if it is forgotten, set a new one with a 6-digit code
// sent to the account's email (same code flow as the sign-in page). A demo workspace has a name only.
import { useEffect, useState } from 'react';
import { accountApi, teacherApi, type Teacher } from '../api.ts';
import { authError, changePassword, signIn, useAuth } from '../auth.ts';
import { useLang, useT } from '../i18n.ts';
import { ErrorNote } from './ErrorNote.tsx';

const A = {
  vi: {
    title: 'Tài khoản của tôi', email: 'Email', plan: 'Gói', plans: { demo: 'Dùng thử', free: 'Miễn phí', pro: 'Pro' },
    nameH: 'Tên hiển thị', nameSub: 'Hiện ở thanh trên cùng và trên màn hình của học sinh.', namePh: 'Ví dụ: Cô Hạnh', save: 'Lưu tên', saved: 'Đã lưu tên.',
    pwH: 'Đổi mật khẩu', current: 'Mật khẩu hiện tại', next: 'Mật khẩu mới', again: 'Nhập lại mật khẩu mới', pwHint: 'Ít nhất 6 ký tự.', change: 'Đổi mật khẩu', changed: 'Đã đổi mật khẩu.',
    forgot: 'Quên mật khẩu hiện tại?', forgotSub: (e: string) => `LessonBloom gửi mã 6 số tới ${e} để cô đặt mật khẩu mới.`, send: 'Gửi mã', resend: 'Gửi lại mã', code: 'Mã xác nhận (6 số)',
    sent: (e: string) => `Mã đã được gửi tới ${e}. Mã dùng được trong 10 phút; cô xem cả mục Spam nhé.`, setNew: 'Đặt mật khẩu mới', cancel: 'Huỷ',
    wrongCurrent: 'Mật khẩu hiện tại chưa đúng. Nếu cô quên, bấm "Quên mật khẩu hiện tại?".', mismatch: 'Hai mật khẩu mới chưa giống nhau.', short: 'Mật khẩu cần ít nhất 6 ký tự.',
    same: 'Mật khẩu mới cần khác mật khẩu hiện tại.', codeShort: 'Cô nhập đủ 6 số trong email nhé.', show: 'Hiện', hide: 'Ẩn',
    demoNote: 'Đây là bản dùng thử: chỉ đổi được tên. Muốn có mật khẩu và lưu bài lâu dài, cô đăng xuất rồi bấm "Đăng ký".', busy: 'Đang lưu…',
  },
  en: {
    title: 'My account', email: 'Email', plan: 'Plan', plans: { demo: 'Trial', free: 'Free', pro: 'Pro' },
    nameH: 'Display name', nameSub: 'Shown on the top bar and on pupils\' screens.', namePh: 'E.g. Ms Hanh', save: 'Save name', saved: 'Name saved.',
    pwH: 'Change password', current: 'Current password', next: 'New password', again: 'New password again', pwHint: 'At least 6 characters.', change: 'Change password', changed: 'Password changed.',
    forgot: 'Forgot your current password?', forgotSub: (e: string) => `LessonBloom sends a 6-digit code to ${e} so you can set a new password.`, send: 'Send code', resend: 'Send again', code: 'Code (6 digits)',
    sent: (e: string) => `A code has been sent to ${e}. It works for 10 minutes; check Spam too.`, setNew: 'Set new password', cancel: 'Cancel',
    wrongCurrent: 'The current password is wrong. If you forgot it, use "Forgot your current password?".', mismatch: 'The two new passwords are not the same.', short: 'The password needs at least 6 characters.',
    same: 'The new password must be different from the current one.', codeShort: 'Please enter all 6 digits from the email.', show: 'Show', hide: 'Hide',
    demoNote: 'This is a trial workspace: only the name can be changed. For a password and lessons kept for good, sign out and choose "Register".', busy: 'Saving…',
  },
};

function Pw({ label, value, onChange, auto, hint }: { label: string; value: string; onChange: (v: string) => void; auto: string; hint?: string }) {
  const a = useT(A);
  const [show, setShow] = useState(false);
  return (
    <label className="field">{label}
      <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
        <input className="grow" type={show ? 'text' : 'password'} autoComplete={auto} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="btn ghost sm" onClick={() => setShow(!show)} aria-pressed={show}>{show ? a.hide : a.show}</button>
      </div>
      {hint && <span className="muted small">{hint}</span>}
    </label>
  );
}

export function Account({ teacher, onSaved }: { teacher: Teacher; onSaved: (t: Teacher) => void }) {
  const a = useT(A), lang = useLang();
  const { user } = useAuth();
  const email = user?.email || teacher.email || '';
  const [name, setName] = useState(teacher.name);
  const [pw, setPw] = useState({ current: '', next: '', again: '', code: '' });
  const [mode, setMode] = useState<'change' | 'forgot' | 'code'>('change');
  const [busy, setBusy] = useState(''), [err, setErr] = useState({ name: '', pw: '' }), [ok, setOk] = useState({ name: '', pw: '' });
  const [wait, setWait] = useState(0);
  useEffect(() => { if (wait > 0) { const id = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(id); } }, [wait]);
  const run = async (k: 'name' | 'pw', fn: () => Promise<string>) => {
    setErr({ ...err, [k]: '' }); setOk({ ...ok, [k]: '' }); setBusy(k);
    try { const m = await fn(); setOk((o) => ({ ...o, [k]: m })); } catch (e) { setErr((x) => ({ ...x, [k]: (e as Error).message })); } finally { setBusy(''); }
  };
  const fail = (m: string) => { throw new Error(m); };
  const saveName = () => run('name', async () => {
    if (!name.trim()) fail(lang === 'vi' ? 'Cô nhập tên hiển thị nhé.' : 'Please enter a display name.');
    onSaved(await teacherApi.rename(name)); return a.saved;
  });
  const checkNew = () => { if (pw.next.length < 6) fail(a.short); if (pw.next !== pw.again) fail(a.mismatch); };
  const change = () => run('pw', async () => {
    checkNew(); if (pw.next === pw.current) fail(a.same);
    try { await changePassword(pw.current, pw.next); }
    catch (e) { const c = String((e as { code?: string }).code); fail(/invalid-credential|wrong-password|invalid-login/.test(c) ? a.wrongCurrent : authError(e, lang)); }
    setPw({ current: '', next: '', again: '', code: '' }); return a.changed;
  });
  const send = () => run('pw', async () => { await accountApi.sendCode(email, 'reset'); setMode('code'); setWait(60); return a.sent(email); });
  const reset = () => run('pw', async () => {
    if (!/^\d{6}$/.test(pw.code.trim())) fail(a.codeShort);
    checkNew();
    await accountApi.reset({ email, code: pw.code.trim(), password: pw.next });
    try { await signIn(email, pw.next); } catch (e) { fail(authError(e, lang)); }   // a fresh session with the new password
    setPw({ current: '', next: '', again: '', code: '' }); setMode('change'); return a.changed;
  });
  const set = (k: keyof typeof pw) => (v: string) => setPw({ ...pw, [k]: v });

  return (
    <main className="page narrow stack" style={{ gap: 18 }}>
      <h1>{a.title}</h1>
      <div className="card">
        <dl className="ro">
          {email && <div className="ro-row"><dt>{a.email}</dt><dd>{email}</dd></div>}
          <div className="ro-row"><dt>{a.plan}</dt><dd>{a.plans[teacher.plan || (teacher.account ? 'free' : 'demo')]}</dd></div>
        </dl>
      </div>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
        <div><h2 style={{ margin: 0 }}>{a.nameH}</h2><p className="muted small" style={{ margin: 0 }}>{a.nameSub}</p></div>
        <input aria-label={a.nameH} maxLength={40} placeholder={a.namePh} value={name} aria-invalid={!name.trim()} onChange={(e) => { setName(e.target.value); setOk({ ...ok, name: '' }); }} />
        <div className="row"><button className="btn primary" disabled={busy === 'name' || name.trim() === teacher.name}>{busy === 'name' ? a.busy : a.save}</button>
          {ok.name && <span className="ok-note" role="status">✓ {ok.name}</span>}</div>
        <ErrorNote text={err.name} />
      </form>
      {user ? (
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); if (mode === 'change') change(); else if (mode === 'forgot') send(); else reset(); }}>
          <h2 style={{ margin: 0 }}>{a.pwH}</h2>
          {mode === 'change' && <>
            <Pw label={a.current} value={pw.current} onChange={set('current')} auto="current-password" />
            <Pw label={a.next} value={pw.next} onChange={set('next')} auto="new-password" hint={a.pwHint} />
            <Pw label={a.again} value={pw.again} onChange={set('again')} auto="new-password" />
            <div className="row"><button className="btn primary" disabled={busy === 'pw'}>{busy === 'pw' ? a.busy : a.change}</button>
              <button type="button" className="btn ghost sm" onClick={() => { setMode('forgot'); setErr({ ...err, pw: '' }); setOk({ ...ok, pw: '' }); }}>{a.forgot}</button></div>
          </>}
          {mode === 'forgot' && <>
            <p className="muted" style={{ margin: 0 }}>{a.forgotSub(email)}</p>
            <div className="row"><button className="btn primary" disabled={busy === 'pw'}>{a.send}</button><button type="button" className="btn ghost" onClick={() => setMode('change')}>{a.cancel}</button></div>
          </>}
          {mode === 'code' && <>
            <label className="field">{a.code}<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={pw.code} onChange={(e) => set('code')(e.target.value.replace(/\D/g, ''))} /></label>
            <Pw label={a.next} value={pw.next} onChange={set('next')} auto="new-password" hint={a.pwHint} />
            <Pw label={a.again} value={pw.again} onChange={set('again')} auto="new-password" />
            <div className="row"><button className="btn primary" disabled={busy === 'pw'}>{busy === 'pw' ? a.busy : a.setNew}</button>
              <button type="button" className="btn ghost sm" disabled={wait > 0 || busy === 'pw'} onClick={send}>{wait > 0 ? `${a.resend} (${wait}s)` : a.resend}</button>
              <button type="button" className="btn ghost sm" onClick={() => setMode('change')}>{a.cancel}</button></div>
          </>}
          {ok.pw && <p className="ok-note" role="status" style={{ margin: 0 }}>✓ {ok.pw}</p>}
          <ErrorNote text={err.pw} />
        </form>
      ) : <p className="ro-note" role="note">{a.demoNote}</p>}
    </main>
  );
}
