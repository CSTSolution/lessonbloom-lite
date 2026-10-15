// "Gửi qua Zalo / tin nhắn": on a phone, the system share sheet (Zalo, Messenger, SMS…); on a
// computer, the message is copied for the teacher to paste into the class's Zalo group.
export async function shareMessage(text: string, url: string): Promise<'shared' | 'copied' | 'cancelled'> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && nav.share) {
    try { await nav.share({ title: 'LessonBloom', text, url }); return 'shared'; } catch { return 'cancelled'; }
  }
  try { await navigator.clipboard.writeText(text); } catch { /* old browsers: the text is still shown */ }
  return 'copied';
}
