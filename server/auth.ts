// Teacher sign-in with Firebase Authentication (email + password). Accounts are created and
// passwords reset by this server after a 6-digit code sent by email (otp.ts, mail.ts), so
// Firebase never sends its own emails. The browser sends its Firebase ID token; we verify
// it with the Admin SDK, which on Cloud Run authenticates as the service account (no key files).
// Pupils never sign in. The demo workspace (x-teacher key) keeps working without an account.
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

export const firebaseEnabled = () => !!process.env.LB_FIREBASE_CONFIG;

// Web config for the browser (apiKey, authDomain, projectId, appId). It is public by design:
// Firebase web API keys identify the project, they don't grant access.
export function webConfig(): Record<string, string> | null {
  try { return process.env.LB_FIREBASE_CONFIG ? JSON.parse(process.env.LB_FIREBASE_CONFIG) : null; } catch { return null; }
}

export async function verify(idToken: string): Promise<DecodedIdToken | null> {
  if (!firebaseEnabled() || !idToken) return null;
  try { return await admin().verifyIdToken(idToken); } catch { return null; }
}

export const isAdminEmail = (t: DecodedIdToken | null) =>
  !!t?.email && t.email_verified === true && (process.env.LB_ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).includes(t.email.toLowerCase());

// Accounts are created and passwords reset here, after the emailed code checks out, so every
// account starts with a confirmed email (emailVerified: true) and nobody can reset a password
// without access to the mailbox.
// the Firebase project from the web config (the same project as Google Cloud in production; the emulator's when testing)
const admin = () => { if (!getApps().length) initializeApp({ projectId: webConfig()?.projectId || process.env.GOOGLE_CLOUD_PROJECT }); return getAuth(); };
export async function accountExists(email: string): Promise<boolean> {
  try { await admin().getUserByEmail(email); return true; } catch (e) { if ((e as { code?: string }).code === 'auth/user-not-found') return false; throw e; }
}
export async function createAccount(email: string, password: string, name: string): Promise<void> {
  await admin().createUser({ email, password, displayName: name, emailVerified: true });
}
export async function setPassword(email: string, password: string): Promise<void> {
  const u = await admin().getUserByEmail(email);
  await admin().updateUser(u.uid, { password, emailVerified: true });   // owning the mailbox proves the email too
}
export async function markVerified(uid: string): Promise<void> { await admin().updateUser(uid, { emailVerified: true }); }
export async function setDisplayName(uid: string, name: string): Promise<void> { await admin().updateUser(uid, { displayName: name }); }
