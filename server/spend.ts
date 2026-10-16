// Spending guard. Google Cloud budgets only alert, they don't stop spending, so the app keeps
// its own running estimate of AI cost per day and per month (Firestore doc in "cache") and
// refuses new AI work past the limits. Estimates are deliberately on the high side.
import { config } from './config.ts';
import type { Store } from './store.ts';

export const COST_USD = {
  lesson: 0.35,         // measured 2026-10-15: $0.22-0.29 per lesson incl. 6 pictures + critic (kept on the high side)
  video: 0.06,          // Text-to-Speech for all slides
  slideImage: 0.06,     // one new illustration + critic
  slideEdit: 0.01,
  intake: 0.005,
  errorTag: 0.002,
  comments: 0.01,
  ocr: 0.01,            // photos of a lesson page -> text (Gemini vision, up to 5 photos)
} as const;
export type SpendKind = keyof typeof COST_USD;

interface Ledger { id: string; usd: number; days: Record<string, number> }

export class SpendGuard {
  constructor(private store: Store, private monthUsd = config.monthUsd, private dayUsd = config.dayUsd) {}

  // Reserve the cost of one action, or return a reason it is refused. Not transactional:
  // a few concurrent requests can overshoot by a few cents, which is fine for a guard.
  async charge(kind: SpendKind): Promise<string | null> {
    const now = new Date(), month = now.toISOString().slice(0, 7), day = now.toISOString().slice(0, 10);
    const id = `spend-${month}`;
    const l = (await this.store.get<Ledger>('cache', id)) || { id, usd: 0, days: {} };
    const cost = COST_USD[kind];
    if (l.usd + cost > this.monthUsd) return 'month';
    if ((l.days[day] || 0) + cost > this.dayUsd) return 'day';
    l.usd = Math.round((l.usd + cost) * 1000) / 1000;
    l.days[day] = Math.round(((l.days[day] || 0) + cost) * 1000) / 1000;
    await this.store.put('cache', l);
    return null;
  }

  async status() {
    const month = new Date().toISOString().slice(0, 7);
    const l = await this.store.get<Ledger>('cache', `spend-${month}`);
    return { month, usd: l?.usd || 0, limit: this.monthUsd, today: l?.days[new Date().toISOString().slice(0, 10)] || 0, dayLimit: this.dayUsd };
  }
}
