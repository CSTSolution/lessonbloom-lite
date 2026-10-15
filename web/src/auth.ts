// Teacher accounts with Firebase Authentication. Config comes from /api/config at runtime, so
// the same build works with or without Firebase (without it, only the demo workspace exists).
// Firebase sends the emails: address verification and password reset.
import type { Auth, User } from 'firebase/auth';
import { useSyncExternalStore } from 'react';
import { getLang } from './i18n.ts';

let auth: Auth | null = null;
let user: User | null = null;
let ready = false, enabled = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

const boot = (async () => {
  try {
    const { firebase, authEmulator } = await (await fetch('/api/config')).json();
    if (!firebase?.apiKey) return;
    const [{ initializeApp }, a] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
    // Session kept in localStorage, never IndexedDB: IndexedDB can hang in some in-app browsers
    // (Zalo, Facebook) and private windows, which would leave the page loading forever.
    auth = a.initializeAuth(initializeApp(firebase), { persistence: [a.browserLocalPersistence, a.inMemoryPersistence] });
    if (authEmulator) a.connectAuthEmulator(auth, authEmulator, { disableWarnings: true });
    enabled = true;
    // ...and never wait more than 8 s for the saved session: show the sign-in page instead
    await Promise.race([
      new Promise<void>((res) => a.onAuthStateChanged(auth!, (u) => { user = u; ready = true; emit(); res(); })),
      new Promise<void>((res) => setTimeout(res, 8000)),
    ]);
  } catch { /* stay in demo-only mode */ } finally { ready = true; emit(); }
})();

export const authReady = () => boot;
// re-renders when the signed-in user (or their verified state) changes
const snapshot = () => (!ready ? 'loading' : user ? `${user.uid}:${user.emailVerified}` : 'none');
export function useAuth() {
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, snapshot, () => 'loading');
  return { ready, enabled, user };
}
export const currentUser = () => user;
export async function idToken(): Promise<string | null> { await boot; return user ? user.getIdToken() : null; }

const fa = () => import('firebase/auth');
// Firebase writes the emails in the language the teacher is using, and the link in them comes
// back to LessonBloom (?verified=1 / ?reset=1) after Firebase's confirmation page.
const mailSetup = (back: string) => { auth!.languageCode = getLang(); return { url: `${location.origin}/?${back}=1` }; };
// The workspace is created on the first API call, which can come before updateProfile finishes,
// so the name typed at registration is kept here and sent with that call.
let pendingName = '';
export const displayName = () => user?.displayName || pendingName || '';
export async function signUp(name: string, email: string, password: string) {
  const a = await fa();
  pendingName = name;
  const cred = await a.createUserWithEmailAndPassword(auth!, email, password);
  await a.updateProfile(cred.user, { displayName: name });
  user = cred.user; emit();
  await a.sendEmailVerification(cred.user, mailSetup('verified')).catch(() => { /* the banner offers "Resend" */ });
}
export async function signIn(email: string, password: string) { const a = await fa(); user = (await a.signInWithEmailAndPassword(auth!, email, password)).user; emit(); }
export async function resetPassword(email: string) { const a = await fa(); await a.sendPasswordResetEmail(auth!, email, mailSetup('reset')); }
export async function resendVerification() { const a = await fa(); if (user) await a.sendEmailVerification(user, mailSetup('verified')); }
// After the teacher clicks the link: reload the account and get a fresh ID token, so the
// server sees email_verified = true straight away (an old token would say false for up to an hour).
export async function refreshUser(): Promise<boolean> {
  if (!user) return false;
  await user.reload();
  user = auth!.currentUser;
  if (user?.emailVerified) await user.getIdToken(true);
  emit();
  return !!user?.emailVerified;
}
export async function signOut() { const a = await fa(); await a.signOut(auth!); user = null; emit(); }

// Firebase error codes -> short messages in the teacher's language
export function authError(e: unknown, lang: 'vi' | 'en'): string {
  const code = String((e as { code?: string })?.code || '');
  const wrong: [string, string] = ['Email hoặc mật khẩu chưa đúng.', 'Wrong email or password.'];
  const M: Record<string, [string, string]> = {
    'auth/invalid-credential': wrong, 'auth/wrong-password': wrong, 'auth/invalid-login-credentials': wrong,
    'auth/user-not-found': ['Chưa có tài khoản với email này. Cô bấm "Đăng ký" nhé.', 'No account with this email. Please register.'],
    'auth/email-already-in-use': ['Email này đã có tài khoản. Cô đăng nhập, hoặc bấm "Quên mật khẩu?" nhé.', 'This email already has an account. Sign in, or use "Forgot password?".'],
    'auth/weak-password': ['Mật khẩu cần ít nhất 6 ký tự.', 'The password needs at least 6 characters.'],
    'auth/missing-password': ['Cô nhập mật khẩu nhé.', 'Please enter your password.'],
    'auth/invalid-email': ['Email chưa đúng định dạng (ví dụ: ten@truong.edu.vn).', 'That email address looks wrong (e.g. name@school.edu).'],
    'auth/missing-email': ['Cô nhập email nhé.', 'Please enter your email.'],
    'auth/user-disabled': ['Tài khoản này đã bị khoá. Cô liên hệ đội LessonBloom nhé.', 'This account has been disabled. Please contact the LessonBloom team.'],
    'auth/too-many-requests': ['Thử quá nhiều lần. Cô đợi vài phút rồi thử lại nhé.', 'Too many attempts. Please wait a few minutes and try again.'],
    'auth/network-request-failed': ['Mất kết nối mạng. Cô kiểm tra mạng rồi thử lại nhé.', 'No connection. Please check the network and try again.'],
    'auth/quota-exceeded': ['Hôm nay đã gửi quá nhiều email. Cô thử lại sau nhé.', 'Too many emails sent today. Please try again later.'],
    'auth/operation-not-allowed': ['Đăng nhập bằng email đang tạm tắt.', 'Email sign-in is turned off for now.'],
    'auth/requires-recent-login': ['Cô đăng nhập lại rồi thử lại nhé.', 'Please sign in again and retry.'],
  };
  const fallback: [string, string] = ['Chưa làm được, cô thử lại nhé.', 'That did not work. Please try again.'];
  if (!M[code]) console.warn('auth error', code, e);
  return (M[code] || fallback)[lang === 'vi' ? 0 : 1];
}
