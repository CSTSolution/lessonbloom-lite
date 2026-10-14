// Google Cloud Text-to-Speech for the lesson video on Cloud Run (service-account auth, no key).
// Voice choice from the teacher's step 4: 0 = female (North), 1 = female (South), 2 = male (North).
// Voices are picked from what the API lists for vi-VN / en-US, best tier first, so the code
// doesn't depend on hard-coded voice names.
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const TIER = ['Chirp3-HD', 'Chirp-HD', 'Neural2', 'Wavenet', 'Standard'];
let client: TextToSpeechClient | null = null;
const cache = new Map<string, { name: string; gender: string }[]>();

async function voices(lang: string) {
  if (!cache.has(lang)) {
    client ||= new TextToSpeechClient();
    const [r] = await client.listVoices({ languageCode: lang });
    const list = (r.voices || []).map((v) => ({ name: v.name || '', gender: String(v.ssmlGender || '') }))
      .sort((a, b) => TIER.findIndex((t) => a.name.includes(t)) - TIER.findIndex((t) => b.name.includes(t)));
    cache.set(lang, list);
  }
  return cache.get(lang)!;
}

export async function cloudSpeak(text: string, lang: 'vi' | 'en', choice = 0, speakingRate = 1): Promise<Buffer> {
  client ||= new TextToSpeechClient();
  const code = lang === 'vi' ? 'vi-VN' : 'en-US';
  const all = await voices(code);
  const female = all.filter((v) => v.gender === 'FEMALE'), male = all.filter((v) => v.gender === 'MALE');
  const pick = choice === 2 ? male[0] : choice === 1 ? female[1] || female[0] : female[0];
  const [r] = await client.synthesizeSpeech({
    input: { text }, voice: { languageCode: code, name: pick?.name },
    audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000, speakingRate },
  });
  return Buffer.from(r.audioContent as Uint8Array);    // LINEAR16 comes back as a WAV file
}
