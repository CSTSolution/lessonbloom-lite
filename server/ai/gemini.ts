// Gemini through the Google Gen AI SDK. The same code runs on an AI Studio key
// (GEMINI_API_KEY) or on Vertex AI (GOOGLE_GENAI_USE_VERTEXAI=true + GOOGLE_CLOUD_PROJECT
// + GOOGLE_CLOUD_LOCATION), which is what the Cloud Run deployment uses.
// (Adapted from our StoryForge prototype, Oct 2026.)
import { GoogleGenAI, type Part } from '@google/genai';
import { config } from '../config.ts';
import { wavFromPcm } from './media.ts';
import type { AI, ImageRequest, SpeechRequest, TextRequest, VisionRequest } from './provider.ts';

const RETRIES = 3;

async function withRetry<T>(what: string, fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < RETRIES; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const msg = String((e as Error)?.message || e);
      if (!/429|500|503|UNAVAILABLE|RESOURCE_EXHAUSTED|deadline/i.test(msg)) break;   // only retry transient errors
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw new Error(`${what} failed: ${(last as Error)?.message || last}`);
}

export class GeminiProvider implements AI {
  name: string;
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({});   // the SDK reads the env vars above
    this.name = process.env.GOOGLE_GENAI_USE_VERTEXAI ? 'gemini-vertex' : 'gemini-aistudio';
  }

  private async generateJson<T>(req: TextRequest, parts: Part[]): Promise<T> {
    const model = req.tier === 'pro' ? config.models.pro : config.models.fast;
    return withRetry(`${req.task} (${model})`, async () => {
      const r = await this.ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: { systemInstruction: req.system, responseMimeType: 'application/json', responseJsonSchema: req.schema, temperature: req.tier === 'pro' ? 0.7 : 0.2 },
      });
      if (!r.text) throw new Error(`empty answer (finish: ${r.candidates?.[0]?.finishReason})`);
      return JSON.parse(r.text) as T;
    });
  }

  json<T>(req: TextRequest) { return this.generateJson<T>(req, [{ text: req.prompt }]); }

  see<T>(req: VisionRequest) {
    return this.generateJson<T>(req, [{ inlineData: { mimeType: 'image/png', data: req.image.toString('base64') } }, { text: req.prompt }]);
  }

  async image(req: ImageRequest): Promise<Buffer> {
    const parts: Part[] = [{ text: req.prompt }];
    return withRetry(`image ${req.key}`, async () => {
      const r = await this.ai.models.generateContent({
        model: config.models.image,
        contents: [{ role: 'user', parts }],
        config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: req.aspect || '4:3' } },
      });
      const img = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!img?.inlineData?.data) throw new Error(`no image returned (finish: ${r.candidates?.[0]?.finishReason})`);
      return Buffer.from(img.inlineData.data, 'base64');
    });
  }

  async speak(req: SpeechRequest): Promise<Buffer> {
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
      const a = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!a?.data) throw new Error('no audio returned');
      const rate = Number(/rate=(\d+)/.exec(a.mimeType || '')?.[1] || 24000);
      return wavFromPcm(Buffer.from(a.data, 'base64'), rate);
    });
  }
}
