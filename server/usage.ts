// Actual AI usage, counted from every model response (Gemini usageMetadata, images returned,
// TTS characters) and kept per day in Firestore ("cache" docs usage-YYYY-MM-DD). The admin page
// shows it next to the spending guard. Prices are list-price estimates (USD), overridable by env;
// the official bill is in Cloud Billing.
import type { Store } from './store.ts';

const env = (k: string, d: number) => Number(process.env[k] || d);
export const PRICE = {
  // per 1M tokens
  pro: { in: env('LB_PRICE_PRO_IN', 1.25), out: env('LB_PRICE_PRO_OUT', 10) },
  fast: { in: env('LB_PRICE_FAST_IN', 0.3), out: env('LB_PRICE_FAST_OUT', 2.5) },
  image: env('LB_PRICE_IMAGE', 0.039),          // per generated image
  ttsPerM: env('LB_PRICE_TTS', 16),             // per 1M characters
};

export interface UsageEvent { model: string; tier: 'pro' | 'fast' | 'image' | 'tts'; task: string; inTokens?: number; outTokens?: number; images?: number; chars?: number }
export interface DayUsage {
  id: string; day: string; calls: number; usd: number;
  byModel: Record<string, { calls: number; inTokens: number; outTokens: number; images: number; chars: number; usd: number }>;
  byTask: Record<string, { calls: number; usd: number }>;
}

export const costOf = (e: UsageEvent) =>
  e.tier === 'image' ? (e.images || 0) * PRICE.image
    : e.tier === 'tts' ? ((e.chars || 0) / 1e6) * PRICE.ttsPerM
      : ((e.inTokens || 0) / 1e6) * PRICE[e.tier].in + ((e.outTokens || 0) / 1e6) * PRICE[e.tier].out;

// Batches events in memory and writes each day's doc at most every few seconds.
export class UsageLog {
  private pending = new Map<string, DayUsage>();
  private timer: NodeJS.Timeout | null = null;
  constructor(private store: Store) {}

  record(e: UsageEvent) {
    const day = new Date().toISOString().slice(0, 10), usd = costOf(e);
    const d = this.pending.get(day) || { id: `usage-${day}`, day, calls: 0, usd: 0, byModel: {}, byTask: {} };
    const m = (d.byModel[e.model] ||= { calls: 0, inTokens: 0, outTokens: 0, images: 0, chars: 0, usd: 0 });
    m.calls++; m.inTokens += e.inTokens || 0; m.outTokens += e.outTokens || 0; m.images += e.images || 0; m.chars += e.chars || 0; m.usd += usd;
    const t = (d.byTask[e.task] ||= { calls: 0, usd: 0 });
    t.calls++; t.usd += usd;
    d.calls++; d.usd += usd;
    this.pending.set(day, d);
    this.timer ||= setTimeout(() => void this.flush(), 3000);
  }

  async flush() {
    this.timer = null;
    const batch = [...this.pending.values()]; this.pending.clear();
    for (const p of batch) {
      const cur = (await this.store.get<DayUsage>('cache', p.id)) || { ...p, calls: 0, usd: 0, byModel: {}, byTask: {} };
      for (const [k, v] of Object.entries(p.byModel)) {
        const m = (cur.byModel[k] ||= { calls: 0, inTokens: 0, outTokens: 0, images: 0, chars: 0, usd: 0 });
        m.calls += v.calls; m.inTokens += v.inTokens; m.outTokens += v.outTokens; m.images += v.images; m.chars += v.chars; m.usd += v.usd;
      }
      for (const [k, v] of Object.entries(p.byTask)) { const t = (cur.byTask[k] ||= { calls: 0, usd: 0 }); t.calls += v.calls; t.usd += v.usd; }
      cur.calls += p.calls; cur.usd += p.usd;
      await this.store.put('cache', cur);
    }
  }

  async days(n: number): Promise<DayUsage[]> {
    await this.flush();
    const out: DayUsage[] = [];
    for (let i = 0; i < n; i++) {
      const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      const d = await this.store.get<DayUsage>('cache', `usage-${day}`);
      if (d) out.push(d);
    }
    return out;
  }
}
