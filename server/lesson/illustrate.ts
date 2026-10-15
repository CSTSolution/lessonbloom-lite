// Slide illustrations with a Gemini-vision check (the StoryForge critic loop): generate,
// review for text / unsuitable content / wrong scene, regenerate from the critic's revised
// prompt, keep the best try.
import type { AI } from '../ai/provider.ts';
import { config } from '../config.ts';
import type { Slide } from '../types.ts';
import { IMAGE_CRITIC_SCHEMA, IMAGE_CRITIC_SYSTEM, IMAGE_STYLE } from './prompts.ts';

export interface Verdict { pass: boolean; score: number; issues: string[]; revisedPrompt?: string }
export interface Illustration { slide: string; image: Buffer; ext: 'png' | 'jpg'; tries: { prompt: string; verdict: Verdict }[] }

export function imageType(b: Buffer): 'png' | 'jpg' | null {
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpg';
  return null;
}

export async function illustrate(ai: AI, slide: Slide, log: (m: string) => void = () => {}): Promise<Illustration> {
  let prompt = `${IMAGE_STYLE}\nScene: ${slide.imagePrompt}`;
  const tries: Illustration['tries'] = [], imgs: Buffer[] = [];
  for (let n = 1; n <= config.maxImageTries; n++) {
    const img = await ai.image({ prompt, key: `${slide.id}#${n}`, aspect: '4:3' });
    const verdict: Verdict = imageType(img)
      ? await ai.see<Verdict & { hasText?: boolean; unsafe?: boolean; broken?: boolean; offTopic?: boolean }>({ task: 'image-critic', tier: 'fast', system: IMAGE_CRITIC_SYSTEM, schema: IMAGE_CRITIC_SCHEMA, image: img,
          prompt: `SLIDE: ${slide.heading}\nREQUESTED SCENE: ${slide.imagePrompt}\nPROMPT USED:\n${prompt}`, input: { slide: slide.id, attempt: n, prompt } })
          // pass/fail is decided here from the flags, not by the model's mood
          .then((v) => ({ ...v, pass: 'hasText' in v ? !(v.hasText || v.unsafe || v.broken || v.offTopic) : v.pass, score: Math.max(v.score ?? 0, 'hasText' in v && !(v.hasText || v.unsafe || v.broken || v.offTopic) ? 7 : 0) }))
      : { pass: false, score: 0, issues: ['not a PNG or JPEG'] };
    tries.push({ prompt, verdict }); imgs.push(img);
    if (verdict.pass && verdict.score >= 7) { log(`${slide.id}: picture accepted on try ${n}`); break; }
    log(`${slide.id}: picture try ${n} rejected: ${verdict.issues.join('; ')}`);
    prompt = verdict.revisedPrompt || prompt;
  }
  let best = tries.findIndex((t) => t.verdict.pass && t.verdict.score >= 7);
  if (best < 0) best = tries.reduce((b, t, i) => (t.verdict.score > tries[b].verdict.score ? i : b), 0);
  return { slide: slide.id, image: imgs[best], ext: imageType(imgs[best]) || 'png', tries };
}
