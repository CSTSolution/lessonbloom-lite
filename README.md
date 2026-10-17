# LessonBloom

LessonBloom is a web app for Vietnamese primary-school teachers (Maths and English, grades 1–5).
- **The teacher** uploads one page of lesson notes. In about 2 minutes a Gemini agent turns it into big-type slides with teacher notes, a narrated video, practice exercises in 3 levels, flashcards and a memory game. The teacher reviews and edits everything, then assigns it to a class.
- **Pupils** join with a class code and tap their name. They practise and get a gentle hint when they slip. **No scores, no rankings.**
- **The teacher sees which skills** each class has mastered and which mistakes keep coming back. Gemini drafts comments in the style of Circular 27/2020/TT-BGDĐT.

This is our entry for the **Google Cloud AI Builder Cup 2026** (JAPAC, Hack2skill), team CSTSolution (Son, Chi), problem statement *Media, Content & Digital Experiences*.

- **Live:** <https://lessonbloom-148938648869.asia-southeast1.run.app>. Choose "Dùng thử ngay" to try a demo workspace without registering.
- **Docs:**
  - [docs/SETUP.md](docs/SETUP.md): run it with your own keys (mock, Gemini on your computer, or your own Cloud Run)
  - [docs/USER-GUIDE.md](docs/USER-GUIDE.md): roles, screens, and a 5-minute walkthrough
  - [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how it works, and where Gemini is used
- This is a public copy of the code for the competition. Keys are never in the code: on Cloud Run they come from Secret Manager, locally from your own environment.

## Run it locally

You need Node 22 or later, and ffmpeg on your PATH. Chromium is only used for the video; it comes from the Playwright cache, or set `CHROMIUM_PATH`.

Install, then run the tests (mock AI, about 2 s):

```bash
npm install
```

```bash
npm test
```

To run the app on mock AI (no keys, no cloud), build the web app and start the server, then open http://localhost:8080:

```bash
npm run build
```

```bash
LB_MOCK=1 npm start
```

The mock answers deterministically. It plants a few mistakes so you can see the self-check loops work: a wrong maths answer, a broken English item and a rejected picture.

With real Gemini locally, either:
- put `GEMINI_API_KEY=…` (from AI Studio) in your environment, or
- run `gcloud auth application-default login` and set `GOOGLE_GENAI_USE_VERTEXAI=true GOOGLE_CLOUD_PROJECT=<your-project-id> GOOGLE_CLOUD_LOCATION=global`.

Data then goes to `data/` (gitignored) unless `LB_BUCKET` is set.

## Deploy

`PROJECT=<your-project-id> ADMIN_EMAILS=you@example.com ./deploy.sh` deploys to Cloud Run (asia-southeast1 by default). It is safe to re-run and needs `gcloud auth login` as a project Owner. It creates:
- a service account
- a Firestore database and a private bucket
- the secrets in Secret Manager: a random admin key (local copy in `~/.config/lessonbloom/admin-key`); the SMTP key, only if `SMTP_KEY` is set on the first run

Optional settings:
- **Teacher sign-in:** put your Firebase web config in `~/.config/lessonbloom/firebase-web.json` (Firebase console → Project settings → Your apps).
- **Code emails:** set `SMTP_USER`, `SMTP_SERVER` and `LB_MAIL_FROM`. Without an SMTP key, codes are printed to the server log instead of emailed.

Never commit any of these values; `scripts/check-secrets.sh` can be installed as a pre-commit hook to block them.

## Code map

| Path | What |
|---|---|
| `server/main.ts`, `server/app.ts` | Hono server: teacher API (`/api/t/*`), pupil API (`/api/join`, `/api/learn/*`), admin, media; also serves the built web app |
| `server/lesson/` | The agent: `prompts.ts` (all prompts and JSON schemas), `build.ts` (intake, slides, exercises with self-check, cards, error tags, comments), `mathcheck.ts` (recomputes maths), `illustrate.ts` (pictures + vision check), `video.ts` (slides + TTS → MP4), `job.ts` (background build) |
| `server/insights.ts` | Skill labels per pupil and class, from the teacher's criteria; next-step suggestions |
| `server/ai/` | `gemini.ts` (Vertex AI / AI Studio, Gemini image, Cloud TTS), `mock.ts`, `provider.ts` |
| `server/store.ts`, `gcpstore.ts` | Local JSON store / Firestore + Cloud Storage |
| `server/auth.ts`, `credits.ts`, `spend.ts`, `usage.ts`, `seed.ts` | Firebase sign-in, plans + daily credits per teacher, app-wide spending guard, AI usage log, demo workspace |
| `web/src/teacher/`, `web/src/pupil/`, `web/src/admin/` | React screens (Chi's design), VI/EN |
| `server/test/` | 36 tests on mock AI |
