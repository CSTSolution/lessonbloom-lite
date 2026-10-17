# Setting up LessonBloom with your own keys

This repository contains no keys. The live demo (<https://lessonbloom-148938648869.asia-southeast1.run.app>) runs on the team's own Google Cloud project, and its keys stay there.

To run your own copy, pick one of three levels. Each level adds to the one before.

| Level | What works | What you need | Cost |
|---|---|---|---|
| 1. Mock | The whole app on fixed sample answers: lessons, pupils, summaries | Node 22+, ffmpeg | Free |
| 2. Real Gemini, on your computer | Real lessons, pictures, hints and comments | A Gemini API key (AI Studio) **or** a Google Cloud project with Vertex AI | Gemini pay-per-use, roughly $0.30 per lesson with pictures and video |
| 3. Your own Cloud Run deployment | A public site like the live demo, with teacher accounts | A Google Cloud project with billing; optionally Firebase and an SMTP provider | Pay-per-use; small at demo scale |

## 1. Mock (no keys)

```bash
npm install
```

```bash
npm run build
```

```bash
LB_MOCK=1 npm start
```

Open http://localhost:8080 and choose "Dùng thử ngay" (Try it now). Data is kept in `data/` (not committed). `npm test` runs the 36 tests on the mock.

## 2. Real Gemini on your computer

**Option A: AI Studio key** (simplest)
1. Create a key at <https://aistudio.google.com/apikey>.
2. Put it in your shell for this session: `export GEMINI_API_KEY=...` (the app reads environment variables only; there is no `.env` file to fill in, and `.env.example` just lists the settings).
3. `npm run build`, then `npm start` (without `LB_MOCK`).

The video voice then uses Gemini text-to-speech; on Vertex AI it uses Cloud Text-to-Speech.

**Option B: your Google Cloud project (Vertex AI)**
1. In your project, enable *Vertex AI API* and *Cloud Text-to-Speech API* (the video voice).
2. Run `gcloud auth application-default login`.
3. Start with `GOOGLE_GENAI_USE_VERTEXAI=true GOOGLE_CLOUD_PROJECT=<your-project-id> GOOGLE_CLOUD_LOCATION=global npm start`.

**Models.** The defaults are in `server/config.ts`:
- text: `gemini-3.8-flash`
- pictures: `gemini-3.1-flash-image`

If your project does not have one of them yet, set `LB_MODEL_PRO`, `LB_MODEL_FAST` or `LB_MODEL_IMAGE`, for example `LB_MODEL_FAST=gemini-2.5-flash`.

Without Firebase settings, only the demo workspace exists. That is enough to try everything.

## 3. Your own deployment on Cloud Run

**Before you start**
1. A Google Cloud project with billing turned on. You need Owner on it.
2. The Google Cloud CLI, signed in: `gcloud auth login`.
3. **Optional, teacher accounts:**
   1. Add Firebase to the same project.
   2. Turn on *Authentication → Email/Password*.
   3. Add your Cloud Run domain under *Authorized domains*.
   4. Save the web app config (Project settings → Your apps → Config) as `~/.config/lessonbloom/firebase-web.json`.

   This config is public by design but specific to your project; keep it out of the repo.
4. **Optional, emailed 6-digit codes:** an SMTP account (for example Brevo, SendGrid or Mailgun) and a sender address on a domain you control.

**Deploy**

You can keep your settings in `~/.config/lessonbloom/deploy.env` (outside the repo; `deploy.sh` reads it), for example `PROJECT=...`, `ADMIN_EMAILS=...`, `SMTP_USER=...`, `SMTP_SERVER=...`, `LB_MAIL_FROM=...`. Or pass them on the command line:

```bash
PROJECT=<your-project-id> ADMIN_EMAILS=you@example.com ./deploy.sh
```

On the first run with email codes, add `SMTP_KEY=<your SMTP password>` in front of the command. Also set these:
- `SMTP_USER=<your SMTP login>`
- `SMTP_SERVER=<smtp host>`
- `LB_MAIL_FROM='"LessonBloom" <no-reply@your-domain>'`

`deploy.sh` is safe to re-run. It:
- enables the APIs (Cloud Run, Cloud Build, Vertex AI, Firestore, Cloud Storage, Text-to-Speech, Secret Manager)
- creates a service account with only the roles it needs
- creates a Firestore database and a **private** Cloud Storage bucket
- stores the secrets in **Secret Manager**:
  - `lb-admin-key`: random; your local copy is `~/.config/lessonbloom/admin-key`, which opens `/admin`
  - `lb-smtp-key`: only if you gave `SMTP_KEY`
- deploys from source and prints the URL

**Limits.** These are environment variables on the Cloud Run service; change them with `gcloud run services update`:

| Variable | Meaning | Default |
|---|---|---|
| `LB_MONTH_USD`, `LB_DAY_USD` | App-wide spending guard (USD) | 40 a month, 10 a day |
| `LB_CREDITS_DEMO`, `LB_CREDITS_FREE` | Daily AI credits per workspace (Pro: unlimited) | 20 (demo), 30 (free) |
| `LB_DEMO_PER_IP_DAY` | New demo workspaces per network per day | 5 |

Also set a budget alert in Google Cloud Billing; the app's guard is not a hard cap from Google.

## Keeping keys out of git

- Never commit `firebase-web.json`, the admin key, SMTP passwords or service-account JSON. They are already in `.gitignore`.
- Install the secret check as a pre-commit hook. It blocks commits that contain API keys, private keys, tokens or your admin key:

```bash
ln -sf ../../scripts/check-secrets.sh .git/hooks/pre-commit
```

- On Cloud Run, keys come only from Secret Manager (`--set-secrets` in `deploy.sh`). They are never put in environment variables in the code or in images.
