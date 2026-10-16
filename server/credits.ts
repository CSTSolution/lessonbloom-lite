// Plans and daily credits per teacher. Every AI action that costs money costs credits; the
// daily allowance depends on the plan (demo < free < pro = unlimited). The app-wide spending
// guard (spend.ts) still applies on top, so "unlimited" can never run away while we are on credits.
// Each teacher's day is one doc in "cache": credits used, actions, and the real AI cost
// attributed to that teacher (from usage.ts via the request context).
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from './config.ts';
import type { Store } from './store.ts';
import type { Teacher } from './types.ts';

export type Plan = 'demo' | 'free' | 'pro';
export const CREDIT_COST = { lesson: 10, video: 2, slideImage: 1, slideEdit: 1, comments: 1, intake: 0, ocr: 1 } as const;
export type CreditKind = keyof typeof CREDIT_COST;
// photos that can be read into one lesson's text (step 1)
export const PHOTOS_PER_LESSON: Record<Plan, number> = { demo: 3, free: 3, pro: 5 };
export const planOf = (t: Teacher): Plan => t.plan || (t.account ? 'free' : 'demo');
export const dailyLimit = (p: Plan) => (p === 'pro' ? Infinity : p === 'free' ? config.creditsFree : config.creditsDemo);

export interface TeacherDay { id: string; teacherId: string; day: string; credits: number; actions: Record<string, number>; usd: number; calls: number }
const today = () => new Date().toISOString().slice(0, 10);
const docId = (teacherId: string, day = today()) => `tday-${teacherId}-${day}`;

// which teacher the current request (and the background work it starts) belongs to
export const ctx = new AsyncLocalStorage<{ teacherId: string }>();

export class Credits {
  constructor(private store: Store) {}

  async day(teacherId: string, day = today()): Promise<TeacherDay> {
    return (await this.store.get<TeacherDay>('cache', docId(teacherId, day))) || { id: docId(teacherId, day), teacherId, day, credits: 0, actions: {}, usd: 0, calls: 0 };
  }

  // Take the credits for one action, or say why not.
  async charge(t: Teacher, kind: CreditKind): Promise<{ ok: true } | { ok: false; used: number; limit: number }> {
    const cost = CREDIT_COST[kind], limit = dailyLimit(planOf(t));
    const d = await this.day(t.id);
    if (cost > 0 && d.credits + cost > limit) return { ok: false, used: d.credits, limit };
    d.credits += cost; d.actions[kind] = (d.actions[kind] || 0) + 1;
    await this.store.put('cache', d);
    return { ok: true };
  }

  // Real AI cost of a model call, attributed to the teacher whose request made it. Batched:
  // a lesson makes dozens of calls, written at most every few seconds.
  private pending = new Map<string, { usd: number; calls: number }>();
  private timer: NodeJS.Timeout | null = null;
  addCost(teacherId: string, usd: number) {
    const p = this.pending.get(teacherId) || { usd: 0, calls: 0 };
    p.usd += usd; p.calls++; this.pending.set(teacherId, p);
    this.timer ||= setTimeout(() => void this.flush(), 3000);
  }
  async flush() {
    this.timer = null;
    const batch = [...this.pending]; this.pending.clear();
    for (const [teacherId, p] of batch) {
      const d = await this.day(teacherId);
      d.usd = Math.round((d.usd + p.usd) * 1e5) / 1e5; d.calls += p.calls;
      await this.store.put('cache', d);
    }
  }

  async history(teacherId: string, days = 30): Promise<TeacherDay[]> {
    await this.flush();
    const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    return (await this.store.find<TeacherDay>('cache', 'teacherId', teacherId)).filter((d) => d.id.startsWith('tday-') && d.day >= since).sort((a, b) => b.day.localeCompare(a.day));
  }
}
