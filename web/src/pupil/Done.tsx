// Screen 16: finished. Warm words, the teacher's suggested next practice (more of the same kind,
// or a harder challenge), a three-face self-check, and a note for the parent holding the phone:
// what the child did today (never a score), to share with the family. Confetti once.
import { useEffect, useState } from 'react';
import { go, pupilApi, type NextStep } from '../api.ts';
import { useLang, useT, nOf } from '../i18n.ts';
import { shareMessage } from '../teacher/share.ts';
import { Confetti, Star, TopBar, markFinished, useLearn, visited } from './shared.tsx';

type Mood = 'easy' | 'ok' | 'hard';
const D = {
  vi: { done: 'Con làm xong rồi!', sub: 'Con đã cố gắng rất nhiều. Đây là bài cô gợi ý cho con:', subNone: 'Con đã cố gắng rất nhiều. Cô rất vui!',
    same: 'Luyện thêm cùng dạng', harder: 'Thử thách nâng cao', go: 'Làm ngay', nQ: (n: number) => `${n} câu`,
    sameB: (r?: string) => (r ? `Vì con hay ${r}. Luyện thêm một chút là con nhớ ngay!` : 'Luyện thêm một chút là con nhớ ngay!'),
    harderB: 'Con đã làm rất chắc phần này. Thử bài khó hơn nhé!',
    selfQ: 'Con thấy bài hôm nay thế nào?', moods: { easy: 'Dễ', ok: 'Vừa', hard: 'Khó' }, thanks: 'Cảm ơn con đã cho cô biết!', home: 'Về trang bài học', loading: 'Cô đang chọn bài cho con…',
    parentH: 'Bố mẹ ơi!', parentB: (n: string, l: string, d: string) => `${n} đã học xong bài “${l}” hôm nay (${d}). Con đã:`,
    did: { video: 'Xem video bài giảng', cards: (k: number) => `Ôn ${k} thẻ nhớ`, practice: (k: number) => `Làm ${k} câu bài tập`, memory: 'Chơi lật thẻ tìm cặp' },
    felt: (m: string) => `Con thấy bài: ${m}`, parentNote: 'Cô giáo đã nhận được bài làm của con. Bố mẹ khen con một câu nhé!', share: 'Gửi cho gia đình', shared: 'Đã chép lời nhắn, bố mẹ dán vào Zalo nhé.',
    shareMsg: (n: string, l: string, items: string[]) => `🎉 ${n} đã học xong bài “${l}” trên LessonBloom: ${items.join(', ').toLocaleLowerCase('vi')}.` },
  en: { done: 'All done!', sub: 'You worked really hard. Here is what we suggest next:', subNone: 'You worked really hard. Well done!',
    same: 'More of the same type', harder: 'Advanced challenge', go: 'Start now', nQ: (n: number) => nOf(n, 'question'),
    sameB: (r?: string) => (r ? `You often had trouble with: ${r}. A little more practice and you’ve got it!` : 'A little more practice and you’ve got it!'),
    harderB: 'You are steady on this. Try something harder!',
    selfQ: 'How did today feel?', moods: { easy: 'Easy', ok: 'Just right', hard: 'Hard' }, thanks: 'Thanks for telling us!', home: 'Back to the lesson', loading: 'Picking your next practice…',
    parentH: 'Dear parents!', parentB: (n: string, l: string, d: string) => `${n} finished the lesson “${l}” today (${d}). Today they:`,
    did: { video: 'Watched the lesson video', cards: (k: number) => `Reviewed ${nOf(k, 'flashcard')}`, practice: (k: number) => `Did ${nOf(k, 'exercise')}`, memory: 'Played the memory game' },
    felt: (m: string) => `How it felt: ${m}`, parentNote: 'The teacher has received the work. A word of praise goes a long way!', share: 'Share with the family', shared: 'Message copied; paste it into your family chat.',
    shareMsg: (n: string, l: string, items: string[]) => `🎉 ${n} finished “${l}” on LessonBloom: ${items.join(', ').toLowerCase()}.` },
};
const FACE: Record<Mood, string> = { easy: '😄', ok: '🙂', hard: '😕' };
const lower1 = (s: string) => s.charAt(0).toLocaleLowerCase('vi') + s.slice(1);
const moodKey = (pid: string) => `lb-mood-${pid}`;

export function Done({ pid }: { pid: string }) {
  const t = useT(D), lang = useLang();
  const { learn } = useLearn(pid, true);        // fresh: "done" for the hub and the next practice set
  const [sharedNote, setSharedNote] = useState(false);
  useEffect(() => { if (learn?.assignmentId) { markFinished(pid, learn.assignmentId); pupilApi.selfcheck(pid, null).catch(() => {}); } }, [learn, pid]);
  const [steps, setSteps] = useState<NextStep[] | null>(null);
  const [mood, setMood] = useState<Mood | null>(() => { try { return sessionStorage.getItem(moodKey(pid)) as Mood | null; } catch { return null; } });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    pupilApi.next(pid).then((s) => { if (live) setSteps(s); }, () => { if (live) setSteps([]); });
    return () => { live = false; };
  }, [pid]);

  const pick = async (m: Mood) => {
    if (saving) return;
    const before = mood;
    setMood(m); setSaving(true);
    try { await pupilApi.selfcheck(pid, m); try { sessionStorage.setItem(moodKey(pid), m); } catch { /* private mode */ } }
    catch { setMood(before); }
    finally { setSaving(false); }
  };

  const shown = (steps || []).filter((s) => s.exercises.length);
  const l = learn?.lesson, seen = visited(pid);
  const did = !l ? [] : [
    seen.includes('video') && t.did.video,
    seen.includes('cards') && l.flashcards.length > 0 && t.did.cards(l.flashcards.length),
    t.did.practice(Math.max(1, learn?.tried || learn?.done?.length || 0)),
    seen.includes('memory') && t.did.memory,
  ].filter((x): x is string => !!x);
  const today = new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB');
  const share = async () => {
    if (!learn || !l) return;
    const r = await shareMessage(t.shareMsg(learn.name, l.title, did), location.origin);
    if (r === 'copied') { setSharedNote(true); setTimeout(() => setSharedNote(false), 3000); }
  };
  return (
    <>
      <TopBar />
      <Confetti />
      <div className="p-center" style={{ gap: 10, marginTop: -6 }}>
        <Star />
        <h1 style={{ fontSize: 28 }}>{t.done}</h1>
        <p className="p-sub" style={{ fontSize: 16 }}>{steps === null || shown.length ? t.sub : t.subNone}</p>
      </div>

      {steps === null && <p className="p-loading" role="status" style={{ padding: '16px 0' }}>{t.loading}</p>}
      {shown.map((s) => {
        const href = `/learn/${pid}/practice?ids=${s.exercises.map((e) => encodeURIComponent(e.id)).join(',')}`;
        return (
          <div key={`${s.kind}-${s.skill}`} className={`d-sug ${s.kind}`}>
            <span className="tag">{s.kind === 'same' ? t.same : t.harder}</span>
            <span className="h">{s.skillName}</span>
            <span className="b">{s.kind === 'same' ? t.sameB(s.reason ? lower1(s.reason) : undefined) : t.harderB}</span>
            <button className={`p-btn ${s.kind === 'same' ? 'orange' : 'green'}`} onClick={() => go(href)} aria-label={`${t.go}: ${s.skillName}, ${t.nQ(s.exercises.length)}`}>
              {t.go} · {t.nQ(s.exercises.length)}
            </button>
          </div>
        );
      })}

      <div className="d-self">
        <div style={{ fontWeight: 600, fontSize: 15, textAlign: 'center' }} id="selfq">{t.selfQ}</div>
        <div className="d-moods" role="radiogroup" aria-labelledby="selfq">
          {(['easy', 'ok', 'hard'] as Mood[]).map((m) => (
            <button key={m} className="d-mood" role="radio" aria-checked={mood === m} disabled={saving} onClick={() => void pick(m)}>
              <span className="f" aria-hidden="true">{FACE[m]}</span>{t.moods[m]}
            </button>
          ))}
        </div>
        {mood && !saving && <div className="p-sub center" role="status" style={{ fontSize: 14 }}>{t.thanks}</div>}
      </div>

      {learn && l && (
        <div className="d-parent" role="region" aria-label={t.parentH}>
          <span className="h">💌 {t.parentH}</span>
          <span>{t.parentB(learn.name, l.title, today)}</span>
          <ul>{did.map((x) => <li key={x}>{x}</li>)}{mood && <li>{t.felt(t.moods[mood])}</li>}</ul>
          <span className="note">{t.parentNote}</span>
          <button className="p-btn ghost" onClick={() => void share()}>{t.share}</button>
          {sharedNote && <span className="note" role="status">{t.shared}</span>}
        </div>
      )}

      <span className="p-spacer" />
      <button className="p-btn ghost" onClick={() => go(`/learn/${pid}`)}>{t.home}</button>
    </>
  );
}
