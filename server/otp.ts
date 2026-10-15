// 6-digit email codes for registration and password reset. One live code per email and
// purpose; 10-minute expiry; 5 wrong tries kill the code; resends limited per email and per
// network, because every code is an email out of the shared Brevo allowance (300/day).
// Only a hash of the code is stored (Firestore "cache" collection, or data/ locally).
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { Store } from './store.ts';

export type Purpose = 'register' | 'reset' | 'verify';
interface Code { id: string; hash: string; expires: number; tries: number; sent: number[] }

const TTL = 10 * 60_000, MAX_TRIES = 5, GAP = 60_000, PER_HOUR = 5, PER_IP_DAY = 30;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const keyOf = (email: string, p: Purpose) => `otp-${p}-${sha(email.toLowerCase()).slice(0, 32)}`;

export class Otp {
  constructor(private store: Store) {}

  // A new code, or why not: 'wait' (asked again within a minute) / 'limit' (too many this hour or from this network)
  async issue(email: string, p: Purpose, ip: string): Promise<{ code: string } | { refused: 'wait' | 'limit'; retryIn?: number }> {
    const now = Date.now();
    const ipKey = `otpip-${sha(ip).slice(0, 16)}-${new Date().toISOString().slice(0, 10)}`;
    const perIp = (await this.store.get<{ id: string; n: number }>('cache', ipKey)) || { id: ipKey, n: 0 };
    if (perIp.n >= PER_IP_DAY) return { refused: 'limit' };
    const old = await this.store.get<Code>('cache', keyOf(email, p));
    const sent = (old?.sent || []).filter((t) => now - t < 3600_000);
    if (sent.length && now - sent[sent.length - 1] < GAP) return { refused: 'wait', retryIn: Math.ceil((GAP - (now - sent[sent.length - 1])) / 1000) };
    if (sent.length >= PER_HOUR) return { refused: 'limit' };
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.store.put('cache', { id: keyOf(email, p), hash: sha(`${email.toLowerCase()}:${code}`), expires: now + TTL, tries: 0, sent: [...sent, now] } satisfies Code);
    await this.store.put('cache', { ...perIp, n: perIp.n + 1 });
    return { code };
  }

  // 'ok' uses the code up; otherwise why it failed
  async check(email: string, p: Purpose, code: string): Promise<'ok' | 'wrong' | 'expired'> {
    const c = await this.store.get<Code>('cache', keyOf(email, p));
    if (!c || !c.hash || Date.now() > c.expires || c.tries >= MAX_TRIES) return 'expired';
    const want = Buffer.from(c.hash), got = Buffer.from(sha(`${email.toLowerCase()}:${String(code).trim()}`));
    if (want.length === got.length && timingSafeEqual(want, got)) {
      await this.store.put('cache', { ...c, hash: '', expires: 0 });
      return 'ok';
    }
    await this.store.put('cache', { ...c, tries: c.tries + 1 });
    return c.tries + 1 >= MAX_TRIES ? 'expired' : 'wrong';
  }
}
