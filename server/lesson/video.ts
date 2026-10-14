// Step 4: the lesson video, made from the slides and Text-to-Speech, no generative video.
// Each slide is drawn once by headless Chromium (with its subtitle when enabled), its narration
// is spoken, and ffmpeg holds the picture for exactly as long as the voice. Fast and cheap
// enough to run inside the Cloud Run request budget. (Renderer approach from StoryForge, Oct 2026.)
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { AI } from '../ai/provider.ts';
import { config } from '../config.ts';
import type { Store } from '../store.ts';
import type { Lesson, Slide } from '../types.ts';

const run = promisify(execFile);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function slideHtml(s: Slide, n: number, total: number, img: string | null, subtitle: string | null): string {
  return `<!doctype html><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&family=Baloo+2:wght@700&display=swap');
  body{margin:0;width:1280px;height:720px;background:#F4F6FA;font-family:'Be Vietnam Pro',sans-serif;color:#17202E}
  .s{position:absolute;inset:36px;background:#fff;border-radius:24px;border:1px solid #DDE3EC;display:flex;gap:40px;padding:56px 64px;box-sizing:border-box}
  .t{flex:1.2;display:flex;flex-direction:column;justify-content:center}
  h1{font-family:'Baloo 2',sans-serif;font-size:58px;line-height:1.1;margin:0 0 24px;color:#1D5FA8}
  ul{margin:0;padding-left:1.1em;font-size:32px;line-height:1.45}
  .ex{margin-top:20px;font-family:'Baloo 2',sans-serif;font-size:60px;color:#8A4A0F}
  img{flex:1;max-width:44%;object-fit:contain;border-radius:16px}
  .n{position:absolute;right:60px;top:52px;background:#FFE7CC;color:#8A4A0F;font-weight:700;font-size:20px;padding:6px 14px;border-radius:999px}
  .sub{position:absolute;left:120px;right:120px;bottom:48px;background:rgba(23,32,46,.82);color:#fff;font-size:28px;line-height:1.35;padding:12px 20px;border-radius:12px;text-align:center}
  .title .t{align-items:center;text-align:center} .title h1{font-size:72px}
  </style><div class="s ${s.kind}"><div class="t"><h1>${esc(s.heading)}</h1>${s.bullets.length ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}${s.example ? `<div class="ex">${esc(s.example)}</div>` : ''}</div>
  ${img ? `<img src="${img}">` : ''}<span class="n">${n + 1} / ${total}</span></div>${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}`;
}

const duration = async (f: string) => parseFloat((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f])).stdout);

export interface VideoOptions { speed: number; subtitles: boolean; voice?: string }

export async function makeVideo(ai: AI, store: Store, l: Lesson, o: VideoOptions, log: (m: string) => void = () => {}): Promise<{ url: string; seconds: number; chapters: { slide: string; at: number }[] }> {
  const dir = await mkdtemp(join(tmpdir(), 'lb-video-'));
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: config.chromium, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const parts: string[] = [], chapters: { slide: string; at: number }[] = [];
    let at = 0;
    for (const [i, s] of l.slides.entries()) {
      // voice
      const wav = join(dir, `${s.id}.wav`);
      await writeFile(wav, await ai.speak({ text: s.narration, lang: l.intake.lang, voice: Number(o.voice ?? 0) || 0 }));
      // picture (illustration inlined so the page needs no server)
      let img: string | null = null;
      if (s.image) {
        const [, folder, name] = /^\/media\/([^/]+)\/(.+)$/.exec(s.image) || [];
        const buf = folder ? await store.getFile(folder, name) : null;
        if (buf) img = `data:image/${name.endsWith('.jpg') ? 'jpeg' : 'png'};base64,${buf.toString('base64')}`;
      }
      await page.setContent(slideHtml(s, i, l.slides.length, img, o.subtitles ? s.narration : null), { waitUntil: 'networkidle' });
      const png = join(dir, `${s.id}.png`);
      await page.screenshot({ path: png });
      // segment: picture held for the voice (slowed with atempo when speed < 1) + a short breath
      const seg = join(dir, `${s.id}.mp4`), tempo = Math.min(1.2, Math.max(0.7, o.speed));
      await run('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', png, '-i', wav,
        '-filter_complex', `[1:a]atempo=${tempo},apad=pad_dur=0.8,aresample=48000[a]`, '-map', '0:v', '-map', '[a]', '-shortest',
        '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '128k', seg]);
      chapters.push({ slide: s.id, at: Math.round(at) });
      at += await duration(seg);
      parts.push(seg);
      log(`video: ${i + 1}/${l.slides.length}`);
    }
    const list = join(dir, 'list.txt'), out = join(dir, 'lesson.mp4');
    await writeFile(list, parts.map((p) => `file '${p}'`).join('\n'));
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
    const url = await store.putFile(l.id, `lesson-${Date.now()}.mp4`, await readFile(out), 'video/mp4');
    return { url, seconds: Math.round(at), chapters };
  } finally {
    await browser.close();
    await rm(dir, { recursive: true, force: true });
  }
}
