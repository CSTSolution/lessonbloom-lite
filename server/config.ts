// All knobs in one place. Model ids are env-overridable so we can switch Gemini versions or
// move from an AI Studio key to Vertex AI without code changes.
const env = (k: string, d: string) => process.env[k] || d;

export const config = {
  models: {
    pro: env('LB_MODEL_PRO', 'gemini-2.5-pro'),            // lesson + exercises
    fast: env('LB_MODEL_FAST', 'gemini-2.5-flash'),        // intake, reviewer, image critic, report
    image: env('LB_MODEL_IMAGE', 'gemini-2.5-flash-image'),
    tts: env('LB_MODEL_TTS', 'gemini-2.5-flash-preview-tts'),
  },
  voices: { vi: env('LB_VOICE_VI', 'Aoede'), en: env('LB_VOICE_EN', 'Aoede') },
  maxFixRounds: 2,            // self-check: regenerate failing items up to N times
  maxImageTries: 3,
  port: Number(env('PORT', '8080')),
  dataDir: env('LB_DATA_DIR', 'data'),
  chromium: env('CHROMIUM_PATH', `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1148/chrome-mac/Chromium.app/Contents/MacOS/Chromium`),
};
