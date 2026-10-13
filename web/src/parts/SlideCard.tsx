// One 16:9 slide: big heading, short bullets, a worked example, the illustration.
import type { Slide } from '../api.ts';

export function SlideCard({ s, n, total }: { s: Omit<Slide, 'notes'>; n?: number; total?: number }) {
  return (
    <div className={`slide kind-${s.kind}`}>
      <div className="slide-text">
        <h3>{s.heading}</h3>
        {s.bullets.filter(Boolean).length > 0 && <ul>{s.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}</ul>}
        {s.example && <div className="example">{s.example}</div>}
      </div>
      {s.image && <img className="slide-img" src={s.image} alt="" />}
      {n !== undefined && <span className="slide-n">{n + 1}{total ? ` / ${total}` : ''}</span>}
    </div>
  );
}
