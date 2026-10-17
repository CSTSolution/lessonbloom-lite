// Screen 12: today's lesson. Four activities and how far the pupil has got through them today
// (which activities they opened, not how well they did).
import { go } from '../api.ts';
import { useT, withCls, nOf } from '../i18n.ts';
import { practiceSet } from './Practice.tsx';
import { Empty, Gate, TopBar, finished, useLearn, visited, type Activity } from './shared.tsx';

const D = {
  vi: { hi: 'Chào', cls: 'Lớp', subj: { math: 'Toán', english: 'Tiếng Anh' }, grade: 'Lớp', today: 'Bài hôm nay:', remindB: 'Nhớ nhé!',
    remind: (r: string) => `Lần trước con hay ${r}. Hôm nay mình để ý điều đó nhé.`,
    progress: 'Con đã đi được', progressAria: (a: number, b: number) => `Đã mở ${a} trên ${b} phần`,
    video: 'Xem video', cards: 'Thẻ nhớ', practice: 'Làm bài tập', memory: 'Lật thẻ',
    min: (m: number) => `${m} phút`, slides: (n: number) => `${n} trang`, nCards: (n: number) => `${n} thẻ`, nQ: (n: number) => `${n} câu`, pairs: (n: number) => `Tìm ${n} cặp`,
    watched: 'đã xem', doneTag: 'đã xong', tried: 'đã làm', played: 'đã chơi',
    finH: 'Con đã hoàn thành bài hôm nay! 🎉', finB: 'Bấm để xem lời khen. Con vẫn có thể luyện thêm nhé.',
    noneH: 'Cô chưa giao bài nào', noneB: 'Khi cô giao bài mới, bài sẽ hiện ở đây. Con quay lại sau nhé!' },
  en: { hi: 'Hi', cls: 'Class', subj: { math: 'Math', english: 'English' }, grade: 'Grade', today: 'Today:', remindB: 'Remember!',
    remind: (r: string) => `Last time you often had trouble with: ${r}. Let’s watch out for it today.`,
    progress: 'Your progress today', progressAria: (a: number, b: number) => `${a} of ${nOf(b, 'part')} opened`,
    video: 'Watch video', cards: 'Flashcards', practice: 'Exercises', memory: 'Memory game',
    min: (m: number) => `${m} min`, slides: (n: number) => nOf(n, 'slide'), nCards: (n: number) => nOf(n, 'card'), nQ: (n: number) => nOf(n, 'question'), pairs: (n: number) => `Find ${nOf(n, 'pair')}`,
    watched: 'watched', doneTag: 'done', tried: 'done', played: 'played',
    finH: 'You finished today’s lesson! 🎉', finB: 'Tap to see your praise. You can still practise more.',
    noneH: 'No lesson yet', noneB: 'When your teacher gives you a lesson, it will show up here. Come back later!' },
};

const ICON: Record<Activity, string> = { video: '▶', cards: '⇄', practice: '?', memory: '◆' };
const lower1 = (s: string) => s.charAt(0).toLocaleLowerCase('vi') + s.slice(1);

export function Hub({ pid }: { pid: string }) {
  const t = useT(D);
  const state = useLearn(pid, true);
  return (
    <Gate pid={pid} state={state} needLesson={false}>
      {(learn) => {
        const top = <TopBar><span className="p-hi">{t.hi} {learn.name} · {withCls(t.cls, learn.className)}</span></TopBar>;
        const l = learn.lesson;
        if (!l) return (<>{top}<Empty title={t.noneH} body={t.noneB} /></>);
        const seen = visited(pid);
        const nQ = practiceSet(l.exercises, learn.done).length;
        const tiles: { key: Activity; show: boolean; sub: string; tag: string }[] = [
          { key: 'video', show: !!l.video || l.slides.length > 0, sub: l.video && l.videoSeconds ? t.min(Math.max(1, Math.round(l.videoSeconds / 60))) : t.slides(l.slides.length), tag: t.watched },
          { key: 'cards', show: l.flashcards.length > 0, sub: t.nCards(l.flashcards.length), tag: t.doneTag },
          { key: 'practice', show: nQ > 0, sub: t.nQ(nQ), tag: t.tried },
          { key: 'memory', show: l.pairs.length >= 2, sub: t.pairs(Math.min(4, l.pairs.length)), tag: t.played },
        ];
        const shown = tiles.filter((x) => x.show);
        const opened = shown.filter((x) => seen.includes(x.key)).length;
        return (
          <>
            {top}
            <span className="p-chip">{t.subj[l.subject]} · {t.grade} {l.grade}</span>
            <h1 className="h-title">{t.today} {l.title}</h1>
            {finished(pid, learn.assignmentId) && (
              <button className="h-fin" onClick={() => go(`/learn/${pid}/done`)}><span className="e" aria-hidden="true">🏆</span><span><b>{t.finH}</b><span className="small">{t.finB}</span></span></button>
            )}
            {learn.reminder && (
              <div className="h-remind">
                <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" style={{ flex: '0 0 28px' }}><circle cx="14" cy="14" r="12" fill="#FFE7CC" /><path d="M14 8v8M14 19.5v.5" stroke="#B4561A" strokeWidth="2.6" strokeLinecap="round" /></svg>
                <div><b>{t.remindB}</b> {t.remind(lower1(learn.reminder))}</div>
              </div>
            )}
            <div className="h-tiles">
              {shown.map((x) => (
                <button key={x.key} className={`h-tile ${x.key}`} onClick={() => go(`/learn/${pid}/${x.key}`)}>
                  <span className="ic" aria-hidden="true">{ICON[x.key]}</span>
                  <span>
                    <span className="nm">{t[x.key]}</span>
                    <span className="sb">{x.sub}{seen.includes(x.key) ? ` · ${x.tag}` : ''}</span>
                  </span>
                </button>
              ))}
            </div>
            <span className="p-spacer" />
            <div className="h-prog">
              <div style={{ fontWeight: 600, fontSize: 15 }}>{t.progress}</div>
              <div className="segs" role="img" aria-label={t.progressAria(opened, shown.length)}>
                {shown.map((x, i) => <span key={x.key} className={i < opened ? 'on' : ''} />)}
              </div>
            </div>
          </>
        );
      }}
    </Gate>
  );
}
