// An error from the server or the network, already in the chosen language (api.ts). Scrolled
// into view so a message under a long form is not missed.
import { useEffect, useRef } from 'react';

export function ErrorNote({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (text) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [text]);
  if (!text) return null;
  return <p ref={ref} className="error-note" role="alert">{text}</p>;
}
