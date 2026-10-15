#!/usr/bin/env node
// End-to-end test against a deployed LessonBloom (real Gemini, Firestore, Storage, TTS).
//   node scripts/e2e-live.mjs [maths|english|both] [--no-video]
// Uses a fresh demo workspace, made Pro through the admin API so daily credits don't block
// repeated runs. Admin key: $LB_ADMIN_KEY or ~/.config/lessonbloom/admin-key (never in the repo).
// Prints a pass/fail table with timings. Costs about $0.5-1 of AI per lesson.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const U = process.env.LB_URL || 'https://lessonbloom-148938648869.asia-southeast1.run.app';
const keyFile = `${homedir()}/.config/lessonbloom/admin-key`;
const ADMIN = (process.env.LB_ADMIN_KEY || (existsSync(keyFile) ? readFileSync(keyFile, 'utf8') : '')).trim();
const which = process.argv[2] || 'both', video = !process.argv.includes('--no-video');
const SAMPLES = { maths: 'samples/toan-lop2-cong-co-nho.txt', english: 'samples/tieng-anh-lop3-colours.txt' };

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function req(method, path, body, headers = {}) {
  const r = await fetch(U + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: r.status, json };
}

async function run(subject) {
  console.log(`\n=== ${subject} ===`);
  const src = readFileSync(SAMPLES[subject], 'utf8');
  const A = { 'x-admin': ADMIN };
  const me = await req('POST', '/api/t/me', {}, A);
  check(`${subject}: demo workspace`, me.status === 200, me.json.error);
  const T = { 'x-teacher': me.json.key };
  if (ADMIN) check(`${subject}: admin makes it Pro`, (await req('POST', `/api/admin/users/${me.json.key}/plan`, { plan: 'pro' }, A)).json.plan === 'pro');

  let t0 = Date.now();
  const it = (await req('POST', '/api/t/intake', { source: src }, T)).json;
  check(`${subject}: intake`, it.subject === (subject === 'maths' ? 'math' : 'english') && it.grade, `${((Date.now() - t0) / 1000).toFixed(1)}s, grade ${it.grade}, "${it.title}"`);

  t0 = Date.now();
  const created = await req('POST', '/api/t/lessons', { source: src, intake: it }, T);
  check(`${subject}: lesson accepted`, created.status === 202, created.json.error);
  let l;
  for (;;) { l = (await req('GET', `/api/t/lessons/${created.json.id}`, null, T)).json; if (l.status !== 'working') break; if (Date.now() - t0 > 12 * 60e3) break; await sleep(3000); }
  const secs = Math.round((Date.now() - t0) / 1000);
  check(`${subject}: lesson ready to review`, l.status === 'ready', `${secs}s ${l.error || ''}`);
  for (;;) { l = (await req('GET', `/api/t/lessons/${created.json.id}`, null, T)).json; if (!l.picturesPending || Date.now() - t0 > 12 * 60e3) break; await sleep(5000); }
  check(`${subject}: pictures done`, !l.picturesPending, `${Math.round((Date.now() - t0) / 1000)}s total`);
  check(`${subject}: slides 8-12`, l.slides?.length >= 8 && l.slides.length <= 12, `${l.slides?.length}`);
  check(`${subject}: slides cite the source`, l.slides?.filter((s) => s.source).length >= l.slides?.length * 0.8);
  const pics = l.slides?.filter((s) => s.image).length || 0;
  check(`${subject}: pictures`, pics >= 4, `${pics}/${l.slides?.length}`);
  check(`${subject}: exercises >= 9`, l.exercises?.length >= 9, `${l.exercises?.length} kept, ${l.checks?.length} caught by self-check`);
  check(`${subject}: skills >= 2`, l.skills?.length >= 2, (l.skills || []).map((s) => s.name).join(', '));
  check(`${subject}: 3 levels`, ['basic', 'good', 'advanced'].every((lv) => l.exercises?.some((e) => e.level === lv)));
  check(`${subject}: flashcards + 4 pairs`, l.flashcards?.length >= 4 && l.pairs?.length === 4, `${l.flashcards?.length} cards`);
  const dropped = (l.progress || []).find((m) => /bỏ \d+ câu/.test(m));
  if (dropped) console.log(`   note: ${dropped}`);
  for (const c of (l.checks || []).slice(0, 4)) console.log(`   self-check ${c.exercise} (try ${c.attempts}): ${String(c.issues[0]).slice(0, 110)}`);

  if (video) {
    t0 = Date.now();
    const v = await req('POST', `/api/t/lessons/${l.id}/video`, { speed: 0.9, subtitles: true, voice: '0' }, T);
    check(`${subject}: video started`, v.status === 202, v.json.error);
    let vv;
    for (;;) { vv = (await req('GET', `/api/t/lessons/${l.id}`, null, T)).json.video; if (vv?.status !== 'working' || Date.now() - t0 > 10 * 60e3) break; await sleep(5000); }
    check(`${subject}: video ready`, vv?.status === 'ready', `${Math.round((Date.now() - t0) / 1000)}s to make, ${vv?.seconds}s long ${vv?.error || ''}`);
    if (vv?.url) { const r = await fetch(U + vv.url, { headers: { range: 'bytes=0-99' } }); check(`${subject}: video streams (range)`, r.status === 206); }
  }

  // assign to class 2C and play as a pupil
  const classes = (await req('GET', '/api/t/classes', null, T)).json;
  const k = classes.find((x) => x.name === '2C');
  const as = (await req('POST', '/api/t/assignments', { lessonId: l.id, classId: k.id, dueAt: '2026-10-25', allowRetry: true, autoSuggest: true }, T)).json;
  check(`${subject}: assigned`, !!as.joinCode, as.joinCode);
  const roster = (await req('GET', `/api/join/${as.joinCode}`)).json;
  const pupil = roster.pupils?.[0];
  check(`${subject}: pupil joins by code`, (await req('POST', '/api/join', { code: as.joinCode, pupilId: pupil.id })).status === 200, pupil?.name);
  const learn = (await req('GET', `/api/learn/${pupil.id}`)).json;
  check(`${subject}: pupil gets no answers/labels`, !/"answer"|"expr"|"notes"|"source"|"secure"|"repeated"/.test(JSON.stringify(learn)));
  let wrongWithHint = 0, rightOk = 0;
  for (const e of l.exercises.filter((x) => x.level !== 'advanced').slice(0, 8)) {
    const right = e.type === 'eng_match' ? JSON.stringify(Object.fromEntries(e.pairs.map((p) => [p.word, p.emoji]))) : e.answer;
    const wrong = /^\d+$/.test(String(right)) ? String(Number(right) - 10) : e.type === 'math_truefalse' ? (right === 'true' ? 'false' : 'true') : (e.options || []).find((o) => o !== right) || 'xyz';
    const w = (await req('POST', `/api/learn/${pupil.id}/answer`, { assignmentId: as.id, exerciseId: e.id, answer: wrong, session: 'e2e' })).json;
    if (!w.correct && w.hint) wrongWithHint++;
    const r = (await req('POST', `/api/learn/${pupil.id}/answer`, { assignmentId: as.id, exerciseId: e.id, answer: right, session: 'e2e' })).json;
    if (r.correct) rightOk++;
  }
  check(`${subject}: wrong answers get a hint`, wrongWithHint >= 6, `${wrongWithHint}/8`);
  check(`${subject}: right answers marked right`, rightOk === 8, `${rightOk}/8`);
  const next = (await req('GET', `/api/learn/${pupil.id}/next`)).json;
  check(`${subject}: next-step suggestions`, Array.isArray(next) && next.length > 0, next.map?.((n) => `${n.kind}:${n.skillName}`).join(', '));
  check(`${subject}: self-check`, (await req('POST', `/api/learn/${pupil.id}/selfcheck`, { mood: 'ok' })).status === 200);
  const ins = (await req('GET', `/api/t/insights?lessonId=${l.id}&classId=${k.id}`, null, T)).json;
  const seen = (ins.detail || []).some((s) => s.pupils.some((p) => p.name === pupil.name));
  check(`${subject}: teacher sees the pupil in insights`, seen, (ins.detail || []).map((s) => `${s.skillName}:${s.classLabel}`).join(', '));
  const usage = (await req('GET', '/api/t/usage', null, T)).json;
  check(`${subject}: usage recorded`, usage.days?.[0]?.credits >= 10, `credits ${usage.usedToday}, AI $${usage.days?.[0]?.usd?.toFixed(3)}`);
}

const subjects = which === 'both' ? ['maths', 'english'] : [which];
for (const s of subjects) { try { await run(s); } catch (e) { check(`${s}: no crash`, false, String(e?.stack || e).slice(0, 300)); } }
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
for (const f of failed) console.log(`  FAILED ${f.name} ${f.detail}`);
process.exit(failed.length ? 1 : 0);
