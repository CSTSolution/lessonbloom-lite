// Teacher accounts with Firebase Authentication. Config comes from /api/config at runtime, so
// the same build works with or without Firebase (without it, only the demo workspace exists).
// Firebase sends the emails: address verification and password reset.
import type { Auth, User } from 'firebase/auth';
import { useSyncExternalStore } from 'react';

let auth: Auth | null = null;
let user: User | null = null;
let ready = false, enabled = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

const boot = (async () => {
  try {
    const { firebase } = await (await fetch('/api/config')).json();
    if (!firebase?.apiKey) return;
    const [{ initializeApp }, a] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
    auth = a.getAuth(initializeApp(firebase));
    enabled = true;
    try { auth.languageCode = localStorage.getItem('lb-lang') || 'vi'; } catch { /* default */ }
    await new Promise<void>((res) => a.onAuthStateChanged(auth!, (u) => { user = u; ready = true; emit(); res(); }));
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
export async function signUp(name: string, email: string, password: string) {
  const a = await fa();
  const cred = await a.createUserWithEmailAndPassword(auth!, email, password);
  await a.updateProfile(cred.user, { displayName: name });
  await a.sendEmailVerification(cred.user);
  user = cred.user; emit();
}
export async function signIn(email: string, password: string) { const a = await fa(); user = (await a.signInWithEmailAndPassword(auth!, email, password)).user; emit(); }
export async function resetPassword(email: string) { const a = await fa(); await a.sendPasswordResetEmail(auth!, email); }
export async function resendVerification() { const a = await fa(); if (user) await a.sendEmailVerification(user); }
export async function refreshUser() { if (user) { await user.reload(); user = auth!.currentUser; emit(); } }
export async function signOut() { const a = await fa(); await a.signOut(auth!); user = null; emit(); }

// Firebase error codes -> short messages
export function authError(e: unknown, lang: 'vi' | 'en'): string {
  const code = String((e as { code?: string })?.code || '');
  const M: Record<string, [string, string]> = {
    'auth/invalid-credential': ['Email hoặc mật khẩu chưa đúng.', 'Wrong email or password.'],
    'auth/wrong-password': ['Email hoặc mật khẩu chưa đúng.', 'Wrong email or password.'],
    'auth/user-not-found': ['Chưa có tài khoản với email này.', 'No account with this email.'],
    'auth/email-already-in-use': ['Email này đã có tài khoản, cô đăng nhập nhé.', 'This email already has an account – please sign in.'],
    'auth/weak-password': ['Mật khẩu cần ít nhất 6 ký tự.', 'Password needs at least 6 characters.'],
    'auth/invalid-email': ['Email chưa đúng định dạng.', 'That email address looks wrong.'],
    'auth/too-many-requests': ['Thử quá nhiều lần, cô đợi một lúc nhé.', 'Too many attempts – please wait a moment.'],
    'auth/network-request-failed': ['Mất kết nối mạng.', 'Network problem.'],
  };
  return (M[code] || [String((e as Error)?.message || e), String((e as Error)?.message || e)])[lang === 'vi' ? 0 : 1];
}
