# LessonBloom architecture

## One picture

```
Teacher browser ──┐                      ┌── Gemini 3.8 Flash (Vertex AI, global)
Pupil browser ────┼── Cloud Run ─────────┼── Gemini 3.1 Flash Image (Vertex AI, global)
Admin (/admin) ───┘  "lessonbloom"       ├── Cloud Text-to-Speech (vi-VN, en-US voices)
                     Node 22 + Hono      ├── Firestore (Native): teachers, classes, pupils, lessons,
                     React app (Vite)    │     assignments, attempts, self-checks, cache, ledgers
                     ffmpeg + Chromium   ├── Cloud Storage (private bucket): pictures, videos
                                         ├── Firebase Authentication: teacher accounts, emails
                                         └── Secret Manager: admin key
```

- **One Cloud Run service** in `asia-southeast1` serves both the API and the built web app.
- It runs as a dedicated service account (`lessonbloom-run@…`) with only the permissions it needs: Vertex AI user, Datastore user, objectAdmin on its bucket, and the accessor for one secret. It uses **no API keys**.
- It scales to zero when idle, with at most 3 instances. CPU stays on after a response because lessons are built in the background.

## The lesson agent (the Gen-AI part)

| Step | Model | What it does | How it checks itself |
|---|---|---|---|
| Intake | Gemini 3.8 Flash | Reads the teacher's document and pre-fills subject, grade, title, goals, length, class level, outputs | Normalised in code (grade 1–5, length 15/25/35) |
| Slides | Gemini 3.8 Flash (2k thinking) | 8–12 big-type slides. Each has a **quote from the source document**, teacher notes, narration, and a scene prompt with no text | Grounded in the document; the source quote is shown to the teacher |
| Exercises | Gemini 3.8 Flash | 2–4 **skills** (dạng bài), then items from 8 templates at 3 levels, each tagged with a skill. Structured output uses a separate JSON schema per template, with every checked field required | **Maths is recomputed in code**: a safe evaluator (no `eval`, with `max`/`min`), a solver for blanks, comparisons (and a true/false claim left in the question text), and multiple choice whose options are sums. English gets structural checks (one gap, answer among options, word order uses exactly the given words). A **Gemini reviewer** checks single answer, grammar, grade level, safety and skill match. Failing items are **rewritten up to 2 rounds**, and anything still failing is dropped. Every catch is logged and shown to the teacher (🛡️) |
| Flashcards + memory pairs | Gemini Flash | 8–12 cards and 4 pairs from the lesson | Pairs de-duplicated in code |
| Pictures | Gemini 3.1 Flash Image | Cheerful flat cartoons for up to 6 slides | **Gemini vision critic** returns flags (text or digits / unsafe / broken anatomy / off-topic). **Code** decides pass or fail from the flags; a failed picture is redrawn once with the critic's revised prompt |
| Video | Cloud Text-to-Speech + Chromium + ffmpeg | Each slide is drawn once with its subtitle and narrated; ffmpeg holds each picture for exactly the length of its voice. No generative video | Duration comes from the audio; chapters are saved for the player |
| Error tags | Gemini Flash | When a pupil answers wrongly: the **kind of mistake** ("Quên nhớ 1 sang hàng chục", forgot to carry 1) and a gentle hint that points at the step without giving the answer | Cached per (lesson, item, answer), so a whole class making the same slip costs one call |
| Comment drafts | Gemini Flash | Comments for each pupil in the style of Circular 27: progress and what to practise, no scores, no comparisons | The teacher edits before using them |

## Learning summary (no scores)

`server/insights.ts` turns Attempts into labels **per skill**, using the teacher's criteria (Chi's defaults):

- **A pupil on one skill:** looks at the last 10 answers.
  - ≥ 80% right → **Đã vững** (secure).
  - < 50% right, **or** the same error type ≥ 3 times across ≥ 2 sessions → **Lỗi lặp lại** (repeated mistake).
  - Otherwise, or fewer than 5 answers → **Đang luyện** (practising).
- **A class on one skill:**
  - ≥ 30% of pupils have a repeated mistake → Lỗi lặp lại.
  - ≥ 70% are secure and none has a repeated mistake → Đã vững.

**Next steps for a pupil:** more items on a skill they keep slipping on, or harder items on a skill they've mastered.

**Pupils never receive** labels, scores, percentages, answers, maths expressions, teacher notes or source quotes; tests check this.

## Accounts and access

- **Teachers, two ways in:**
  - **A Firebase account** (email and password). Firebase sends the address-verification and password-reset emails. The server checks the ID token with the Admin SDK; the workspace id is `u_<uid>`.
  - **A demo workspace** with no account: a random 24-character key kept in the browser. It gets invented classes, names and practice history so the learning summary isn't empty.
- **Pupils:** class code, then tap a name. Only a display name is stored.
- **Isolation:** every teacher read and write is scoped to the teacher's workspace, and a test checks one workspace can't read another.
- **Admin:** `/admin`, opened with the admin key from Secret Manager or by signing in as an admin email (`LB_ADMIN_EMAILS`).

## Plans and credits (per teacher)

| Plan | Who | AI credits per day |
|---|---|---|
| Demo | No account (browser key) | 20 |
| Free | Registered account | 30 |
| Pro | Approved by the team on `/admin` (no payment in the prototype) | Unlimited, still under the app-wide guard |

- **Credit costs:**
  - new lesson 10
  - video 2
  - new illustration 1
  - slide rewrite 1
  - comment drafts 1
  - AI reads the document 0
- **What a teacher sees:** the **Usage** page (`/usage`) shows credits left today, the last 30 days with actions and **actual AI cost** (attributed per teacher from each model call through the request context), and a "Request Pro" button.
- **What the admin sees:** `/admin` lists every user with plan, lessons, credits today and this month, and AI cost this month, plus Pro requests and a button to switch plans.
- **Bot protection:** new demo workspaces are capped at 5 per IP per day.

## Models (tested 2026-10-15 on the project)

| Model | Time on a 3-exercise task |
|---|---|
| gemini-3.8-flash | 5.5 s |
| gemini-2.5-flash | 5.0 s |
| gemini-3.5-flash | 8.2 s |
| gemini-2.5-pro / 3.1-pro-preview | ~15 s |

| Image model | Time per picture |
|---|---|
| gemini-3.1-flash-image | 10.9 s, cleanest, no stray text |
| gemini-3.1-flash-lite-image | 4.9 s, drew a sign with text |
| gemini-2.5-flash-image | 6.0 s |

- **Imagen is no longer offered** on Vertex for this project (404 for imagen-3/4).
- **Overrides:** `LB_MODEL_PRO`, `LB_MODEL_FAST`, `LB_MODEL_IMAGE`.

## Cost controls

- **Spending guard** (`server/spend.ts`): each AI action reserves a deliberately high cost estimate. New AI work is refused past **$40/month or $10/day** (configurable), and each workspace can create 5 lessons a day. Google budgets only alert; this actually stops spending.
- **Usage log** (`server/usage.ts`): actual tokens, images and TTS characters from every model response, per day, model and task, with a cost estimate. Shown on `/admin`.
- **Typical cost:** about $0.30–0.70 per full lesson. Idle cost is about $0, because Cloud Run scales to zero and Firestore and Storage stay in the free tier.

## Data

Collections:

| Collection | What it holds |
|---|---|
| `teachers` | criteria |
| `classes` | joinCode |
| `pupils` | displayName only |
| `lessons` | slides, exercises, cards, checks, video |
| `assignments` | — |
| `attempts` | answer, correct, errorType, session |
| `selfchecks` | mood (none = reached "all done") |
| `visits` | parts of a lesson a pupil opened (video, cards, practice, memory) |
| `cache` | error tags, spend and usage ledgers, comment drafts per lesson and class |

Media lives in a private bucket and is served through `/media/…`, which supports byte ranges so video chapters can jump.
