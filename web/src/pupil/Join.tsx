// Screen 11: join with the class code the teacher gives, then tap your name.
import { useEffect, useRef, useState } from 'react';
import { go, pupilApi } from '../api.ts';
import { useT } from '../i18n.ts';
import { Flower, TopBar, savePupil, savedPupil } from './shared.tsx';

const D = {
  vi: { hi: 'Chào con!', sub: 'Nhập mã lớp cô đưa, rồi chọn tên con nhé.', codeLabel: 'Mã lớp', nameLabel: 'Con là ai?', go: 'Vào học', help: 'Không thấy tên con? Hỏi cô giáo nhé.',
    find: 'Tìm lớp', finding: 'Đang tìm lớp…', notFound: 'Không tìm thấy mã lớp. Con hỏi cô giáo nhé.', net: 'Mạng đang chậm, con thử lại nhé.', empty: 'Lớp chưa có tên bạn nào. Con hỏi cô giáo nhé.',
    cont: 'Học tiếp', contAs: (n: string) => `Học tiếp với tên ${n}`, notMe: 'Không phải con?', cls: 'Lớp', joining: 'Đang vào lớp…' },
  en: { hi: 'Hello!', sub: 'Type the class code, then tap your name.', codeLabel: 'Class code', nameLabel: 'Who are you?', go: 'Start learning', help: 'Can’t see your name? Ask your teacher.',
    find: 'Find my class', finding: 'Looking for the class…', notFound: 'We can’t find that class code. Ask your teacher.', net: 'The connection is slow, please try again.', empty: 'No names in this class yet. Ask your teacher.',
    cont: 'Keep learning', contAs: (n: string) => `Keep learning as ${n}`, notMe: 'Not you?', cls: 'Class', joining: 'Joining…' },
};

const norm = (s: string) => s.toUpperCase().replace(/\s+/g, '').slice(0, 16);

export function Join() {
  const t = useT(D);
  const [saved, setSaved] = useState(savedPupil);
  const [code, setCode] = useState(() => norm(new URLSearchParams(location.search).get('code') || saved?.code || ''));
  const [roster, setRoster] = useState<null | { className: string; pupils: { id: string; name: string }[] }>(null);
  const [pick, setPick] = useState('');
  const [status, setStatus] = useState<'' | 'finding' | 'notFound' | 'net' | 'joining'>('');
  const asked = useRef('');

  const find = async (c: string) => {
    if (c.length < 4 || asked.current === c) return;
    asked.current = c;
    setStatus('finding'); setRoster(null); setPick('');
    try {
      const r = await pupilApi.roster(c);
      if (asked.current !== c) return;
      setRoster(r); setStatus('');
    } catch (e) {
      if (asked.current !== c) return;
      asked.current = '';
      setStatus((e as { status?: number }).status === 404 ? 'notFound' : 'net');
    }
  };

  // look the class up as soon as the code looks complete (and on load when ?code= is given;
  // a remembered pupil sees "Học tiếp" first instead of their old class roster)
  const first = useRef(true);
  useEffect(() => {
    const skip = first.current && saved && !new URLSearchParams(location.search).get('code');
    first.current = false;
    if (skip) return;
    const h = setTimeout(() => void find(code), code.length >= 6 ? 250 : 700);
    return () => clearTimeout(h);
  }, [code]);

  const enter = async () => {
    if (!pick || !roster) return;
    setStatus('joining');
    try {
      const r = await pupilApi.join(code, pick);
      savePupil({ id: r.pupilId, name: r.name, className: r.className, code });
      go(`/learn/${r.pupilId}`);
    } catch (e) {
      setStatus((e as { status?: number }).status === 404 ? 'notFound' : 'net');
    }
  };

  return (
    <>
      <TopBar />
      <div className="p-center" style={{ gap: 14, marginTop: -8 }}>
        <Flower />
        <div>
          <h1>{t.hi}</h1>
          <p className="p-sub" style={{ marginTop: 4 }}>{t.sub}</p>
        </div>
      </div>

      {saved && (
        <div className="j-continue">
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="display" style={{ fontSize: 20 }}>{saved.name}</div>
            <div className="p-muted small">{t.cls} {saved.className}</div>
          </div>
          <button className="p-btn" style={{ width: 'auto', fontSize: 18, minHeight: 48 }} onClick={() => go(`/learn/${saved.id}`)} aria-label={t.contAs(saved.name)}>{t.cont}</button>
          <button className="btn ghost sm" style={{ minHeight: 48 }} onClick={() => { savePupil(null); setSaved(null); }}>{t.notMe}</button>
        </div>
      )}

      <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); if (roster && pick) void enter(); else { asked.current = ''; void find(code); } }}>
        <label className="j-label">{t.codeLabel}
          <input className="j-code" type="text" value={code} autoCapitalize="characters" autoComplete="off" spellCheck={false} inputMode="text"
            onChange={(e) => { const v = norm(e.target.value); setCode(v); if (v !== asked.current) { setRoster(null); setPick(''); if (status !== 'joining') setStatus(''); } }}
            placeholder="2A-XXXX" aria-label={t.codeLabel} aria-describedby="join-status" />
        </label>

        <div id="join-status" role="status" aria-live="polite">
          {status === 'finding' && <p className="p-sub center">{t.finding}</p>}
          {status === 'notFound' && <p className="p-error">{t.notFound}</p>}
          {status === 'net' && <p className="p-error">{t.net}</p>}
        </div>

        {roster && (
          <div className="stack" style={{ gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{t.nameLabel} <span className="p-muted" style={{ fontWeight: 500 }}>· {t.cls} {roster.className}</span></div>
            {roster.pupils.length === 0 ? <p className="p-sub">{t.empty}</p> : (
              <div className="j-names" role="radiogroup" aria-label={t.nameLabel}>
                {roster.pupils.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={pick === p.id} className="j-name" onClick={() => setPick(p.id)}>{p.name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {roster
          ? <button className="p-btn" type="submit" disabled={!pick || status === 'joining'} style={{ fontSize: 24 }}>{status === 'joining' ? t.joining : t.go}</button>
          : <button className="p-btn" type="submit" disabled={code.length < 4 || status === 'finding'} style={{ fontSize: 22 }}>{t.find}</button>}
      </form>

      <span className="p-spacer" />
      <p className="p-sub center p-muted" style={{ fontSize: 14 }}>{t.help}</p>
    </>
  );
}
