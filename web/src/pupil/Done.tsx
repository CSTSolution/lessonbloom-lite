// Screen 16: finished. Warm words, the teacher's suggested next practice (more of the same kind,
// or a harder challenge) and a three-face self-check. No scores.
import { useEffect, useState } from 'react';
import { go, pupilApi, type NextStep } from '../api.ts';
import { useT } from '../i18n.ts';
import { Star, TopBar, loadLearn } from './shared.tsx';

type Mood = 'easy' | 'ok' | 'hard';
const D = {
  vi: { done: 'Con làm xong rồi!', sub: 'Con đã cố gắng rất nhiều. Đây là bài cô gợi ý cho con:', subNone: 'Con đã cố gắng rất nhiều. Cô rất vui!',
    same: 'Luyện thêm cùng dạng', harder: 'Thử thách nâng cao', go: 'Làm ngay', nQ: (n: number) => `${n} câu`,
    sameB: (r?: string) => (r ? `Vì con hay ${r}. Luyện thêm một chút là con nhớ ngay!` : 'Luyện thêm một chút là con nhớ ngay!'),
    harderB: 'Con đã làm rất chắc phần này. Thử bài khó hơn nhé!',
    selfQ: 'Con thấy bài hôm nay thế nào?', moods: { easy: 'Dễ', ok: 'Vừa', hard: 'Khó' }, thanks: 'Cảm ơn con đã cho cô biết!', home: 'Về trang bài học', loading: 'Cô đang chọn bài cho con…' },
  en: { done: 'All done!', sub: 'You worked really hard. Here is what we suggest next:', subNone: 'You worked really hard. Well done!',
    same: 'More of the same type', harder: 'Advanced challenge', go: 'Start now', nQ: (n: number) => `${n} questions`,
    sameB: (r?: string) => (r ? `You often had trouble with: ${r}. A little more practice and you’ve got it!` : 'A little more practice and you’ve got it!'),
    harderB: 'You are steady on this. Try something harder!',
    selfQ: 'How did today feel?', moods: { easy: 'Easy', ok: 'Just right', hard: 'Hard' }, thanks: 'Thanks for telling us!', home: 'Back to the lesson', loading: 'Picking your next practice…' },
};
const FACE: Record<Mood, string> = { easy: '😄', ok: '🙂', hard: '😕' };
const lower1 = (s: string) => s.charAt(0).toLocaleLowerCase('vi') + s.slice(1);
const moodKey = (pid: string) => `lb-mood-${pid}`;

export function Done({ pid }: { pid: string }) {
  const t = useT(D);
  const [steps, setSteps] = useState<NextStep[] | null>(null);
  const [mood, setMood] = useState<Mood | null>(() => { try { return sessionStorage.getItem(moodKey(pid)) as Mood | null; } catch { return null; } });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    loadLearn(pid, true).catch(() => {});        // refresh "done" for the hub and the next practice set
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
  return (
    <>
      <TopBar />
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

      <span className="p-spacer" />
      <button className="p-btn ghost" onClick={() => go(`/learn/${pid}`)}>{t.home}</button>
    </>
  );
}
