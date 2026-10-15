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
  maxImageTries: Number(env('LB_IMAGE_TRIES', '2')),
  maxPictures: Number(env('LB_MAX_PICTURES', '6')),   // slides with an illustration (image quotas are tight)
  monthUsd: Number(env('LB_MONTH_USD', '40')),     // in-app spending guard (Google budgets only alert)
  dayUsd: Number(env('LB_DAY_USD', '8')),
  lessonsPerWorkspaceDay: Number(env('LB_WORKSPACE_LESSONS_DAY', '5')),
  port: Number(env('PORT', '8080')),
  dataDir: env('LB_DATA_DIR', 'data'),
  chromium: env('CHROMIUM_PATH', `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1148/chrome-mac/Chromium.app/Contents/MacOS/Chromium`),
};
