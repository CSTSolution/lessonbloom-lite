// Tiny dependency-free WAV and PNG writers: Gemini TTS returns raw PCM, and the mock
// provider needs placeholder art and audio without ffmpeg or a canvas library.
import { deflateSync } from 'node:zlib';

export function wavFromPcm(pcm: Buffer, rate = 24000, channels = 1, bits = 16): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels * bits / 8, 28); h.writeUInt16LE(channels * bits / 8, 32);
  h.writeUInt16LE(bits, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// A quiet hum, so a mock narration line is audible as "something speaking" and has the
// right length. 24 kHz mono s16le, like Gemini TTS.
export function humWav(seconds: number, rate = 24000): Buffer {
  const n = Math.round(seconds * rate), pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate, env = Math.min(1, t * 8, (seconds - t) * 8);
    pcm.writeInt16LE(Math.round(900 * env * Math.sin(2 * Math.PI * 180 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t))), i * 2);
  }
  return wavFromPcm(pcm, rate);
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b: Buffer) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// Vertical two-tone gradient with a soft vignette; hue picks the colour.
export function gradientPng(w: number, h: number, hue: number): Buffer {
  const rgb = (h0: number, s: number, l: number) => {
    const a = s * Math.min(l, 1 - l), f = (n: number) => { const k = (n + h0 / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
  };
  const top = rgb(hue, 0.45, 0.62), bot = rgb((hue + 40) % 360, 0.5, 0.18);
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const u = y / h, dx = x / w - 0.5, dy = u - 0.45, v = Math.max(0.35, 1 - 1.4 * (dx * dx + dy * dy));
      for (let c = 0; c < 3; c++) raw[y * (w * 3 + 1) + 1 + x * 3 + c] = Math.round((top[c] * (1 - u) + bot[c] * u) * v);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
