// Gemini through the Google Gen AI SDK. The same code runs on an AI Studio key
// (GEMINI_API_KEY) or on Vertex AI (GOOGLE_GENAI_USE_VERTEXAI=true + GOOGLE_CLOUD_PROJECT
// + GOOGLE_CLOUD_LOCATION), which is what the Cloud Run deployment uses.
// (Adapted from our StoryForge prototype, Oct 2026.)
import { GoogleGenAI, type Part } from '@google/genai';
import { config } from '../config.ts';
import { cloudSpeak } from './cloudtts.ts';
import { wavFromPcm } from './media.ts';
import type { UsageEvent } from '../usage.ts';
import type { AI, ImageRequest, SpeechRequest, TextRequest, VisionRequest } from './provider.ts';

type Meta = { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } };

const RETRIES = 5;

async function withRetry<T>(what: string, fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < RETRIES; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const msg = String((e as Error)?.message || e);
      if (!/429|500|503|UNAVAILABLE|RESOURCE_EXHAUSTED|deadline/i.test(msg)) break;   // only retry transient errors
      console.warn(`[retry] ${what} attempt ${i + 1}: ${msg.slice(0, 160)}`);
      await new Promise((r) => setTimeout(r, (/429|RESOURCE_EXHAUSTED/.test(msg) ? 6000 : 2000) * 2 ** i));
    }
  }
  throw new Error(`${what} failed: ${(last as Error)?.message || last}`);
}

export class GeminiProvider implements AI {
  name: string;
  onUsage?: (e: UsageEvent) => void;
  private ai: GoogleGenAI;
  private thinkingOk = true;        // Imagen is served from regional endpoints only, not "global"

  // thinking tokens are billed as output
  private report(r: Meta, e: Omit<UsageEvent, 'inTokens' | 'outTokens'>) {
    const u = r.usageMetadata || {};
    this.onUsage?.({ ...e, inTokens: u.promptTokenCount || 0, outTokens: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) });
  }

  constructor() {
    this.ai = new GoogleGenAI({});   // the SDK reads the env vars above
    this.name = process.env.GOOGLE_GENAI_USE_VERTEXAI ? 'gemini-vertex' : 'gemini-aistudio';
  }

  // Text models: the chosen model first; on a quota / overload error move at once to the
  // fallback model (separate quota). Only when every model is busy does withRetry back off.
  private async generateJson<T>(req: TextRequest, parts: Part[]): Promise<T> {
    const primary = req.tier === 'pro' ? config.models.pro : config.models.fast;
    const chain = [primary, ...config.models.textFallbacks.filter((m) => m !== primary)];
    const base = { systemInstruction: req.system, responseMimeType: 'application/json', responseJsonSchema: req.schema, temperature: req.tier === 'pro' ? 0.7 : 0.2 };
    const ask = (model: string, thinking: boolean) => this.ai.models.generateContent({ model, contents: [{ role: 'user', parts }],
      config: thinking ? { ...base, thinkingConfig: { thinkingBudget: req.tier === 'pro' ? 2048 : 512 } } : base });
    return withRetry(`${req.task} (${primary})`, async () => {
      let lastErr: unknown;
      for (const model of chain) {
        const t0 = Date.now();
        try {
          // a model that doesn't accept a thinking budget gets the call again without it
          const r = await ask(model, this.thinkingOk).catch((e) => {
            if (this.thinkingOk && /thinking/i.test(String(e?.message))) { this.thinkingOk = false; return ask(model, false); }
            throw e;
          });
          if (Date.now() - t0 > 20000) console.warn(`[slow] ${req.task} on ${model}: ${Math.round((Date.now() - t0) / 1000)}s`);
          this.report(r, { model, tier: req.tier, task: req.task });
          if (!r.text) throw new Error(`empty answer (finish: ${r.candidates?.[0]?.finishReason})`);
          return JSON.parse(r.text) as T;
        } catch (e) {
          lastErr = e;
          if (!/429|RESOURCE_EXHAUSTED|503|UNAVAILABLE/.test(String((e as Error)?.message))) throw e;
          console.warn(`[fallback] ${req.task}: ${model} busy`);
        }
      }
      throw lastErr;
    });
  }

  json<T>(req: TextRequest) { return this.generateJson<T>(req, [{ text: req.prompt }]); }

  see<T>(req: VisionRequest) {
    const pics = req.images || (req.image ? [{ data: req.image, mime: 'image/png' }] : []);
    return this.generateJson<T>(req, [...pics.map((p) => ({ inlineData: { mimeType: p.mime, data: p.data.toString('base64') } })), { text: req.prompt }]);
  }

  // Pictures: each image model has its own per-minute quota, so on a 429 we move straight to
  // the next model in the chain; only when every model is busy do we wait and go round again.
  async image(req: ImageRequest): Promise<Buffer> {
    const chain = [config.models.image, ...config.models.imageFallbacks.filter((m) => m !== config.models.image)];
    let last = '';
    for (let round = 0; round < 4; round++) {
      for (const model of chain) {
        try {
          const r = await this.ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
            config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: req.aspect || '4:3' } } });
          const img = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
          this.report(r, { model, tier: 'image', task: 'image', images: img ? 1 : 0 });
          if (img?.inlineData?.data) return Buffer.from(img.inlineData.data, 'base64');
          last = `no image (finish: ${r.candidates?.[0]?.finishReason})`;
        } catch (e) {
          last = String((e as Error)?.message || e);
          if (!/429|RESOURCE_EXHAUSTED|503|UNAVAILABLE/.test(last)) throw new Error(`image ${req.key} failed: ${last}`);
        }
      }
      await new Promise((r) => setTimeout(r, 4000 * 2 ** round));
    }
    throw new Error(`image ${req.key} failed: ${last.slice(0, 200)}`);
  }

  async speak(req: SpeechRequest): Promise<Buffer> {
    // On Google Cloud: Cloud Text-to-Speech (real vi-VN voices, North/South choice). With only an
    // AI Studio key: Gemini TTS.
    if (process.env.GOOGLE_GENAI_USE_VERTEXAI) {
      const wav = await withRetry('cloud tts', () => cloudSpeak(req.text, req.lang, req.voice ?? 0));
      this.onUsage?.({ model: 'cloud-tts', tier: 'tts', task: 'tts', chars: req.text.length });
      return wav;
    }
    // A primary teacher's voice: warm, clear, a little slower than normal speech.
    const style = req.lang === 'vi'
      ? 'Đọc như một cô giáo tiểu học: giọng ấm, rõ ràng, chậm rãi, vui vẻ: '
      : 'Read like a friendly primary-school teacher: warm, clear, a little slow, cheerful: ';
    return withRetry('tts', async () => {
      const r = await this.ai.models.generateContent({
        model: config.models.tts,
        contents: [{ role: 'user', parts: [{ text: style + req.text }] }],
        config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voices[req.lang] } } } },
      });
      this.report(r, { model: config.models.tts, tier: 'fast', task: 'tts' });
      const a = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!a?.data) throw new Error('no audio returned');
      const rate = Number(/rate=(\d+)/.exec(a.mimeType || '')?.[1] || 24000);
      return wavFromPcm(Buffer.from(a.data, 'base64'), rate);
    });
  }
}
