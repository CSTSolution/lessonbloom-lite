// Teacher sign-in with Firebase Authentication (email + password; Firebase sends the
// verification and password-reset emails). The browser sends its Firebase ID token; we verify
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
  if (!getApps().length) initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
  try { return await getAuth().verifyIdToken(idToken); } catch { return null; }
}

export const isAdminEmail = (t: DecodedIdToken | null) =>
  !!t?.email && t.email_verified === true && (process.env.LB_ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).includes(t.email.toLowerCase());
