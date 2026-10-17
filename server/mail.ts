// Sends the verification-code emails over SMTP (any provider; SMTP_SERVER, SMTP_USER, LB_MAIL_FROM). The SMTP key comes from Secret Manager on Cloud Run
// (LB_SMTP_KEY); it is never in the repo. Without a key (local runs) the code is printed to
// the server log instead, so the flow can be tested end to end.
import nodemailer from 'nodemailer';
import type { Purpose } from './otp.ts';

const T = {
  vi: {
    register: { subject: (c: string) => `${c} là mã xác nhận LessonBloom của cô`, intro: 'Cô dùng mã sau để hoàn tất đăng ký tài khoản LessonBloom:' },
    reset: { subject: (c: string) => `${c} là mã đặt lại mật khẩu LessonBloom`, intro: 'Cô dùng mã sau để đặt mật khẩu mới cho tài khoản LessonBloom:' },
    verify: { subject: (c: string) => `${c} là mã xác nhận email LessonBloom`, intro: 'Cô dùng mã sau để xác nhận email cho tài khoản LessonBloom:' },
    expiry: 'Mã có hiệu lực trong 10 phút. Nếu cô không yêu cầu, hãy bỏ qua email này.',
  },
  en: {
    register: { subject: (c: string) => `${c} is your LessonBloom verification code`, intro: 'Use this code to finish creating your LessonBloom account:' },
    reset: { subject: (c: string) => `${c} is your LessonBloom password reset code`, intro: 'Use this code to set a new password for your LessonBloom account:' },
    verify: { subject: (c: string) => `${c} is your LessonBloom email confirmation code`, intro: 'Use this code to confirm the email address of your LessonBloom account:' },
    expiry: 'The code works for 10 minutes. If you did not ask for it, you can ignore this email.',
  },
};

let transport: nodemailer.Transporter | null = null;
const smtp = () => (transport ||= nodemailer.createTransport({
  host: process.env.SMTP_SERVER || 'smtp-relay.brevo.com', port: 587, secure: false,
  auth: { user: process.env.SMTP_USER || '', pass: (process.env.LB_SMTP_KEY || '').trim() },
}));

export async function sendCode(to: string, code: string, p: Purpose, lang: 'vi' | 'en'): Promise<void> {
  const t = T[lang], k = t[p];
  // plain text, code in the subject too (phones show it in the notification), no links
  const text = `${k.intro}\n\n    ${code}\n\n${t.expiry}\n\nLessonBloom`;
  if (!process.env.LB_SMTP_KEY) { console.log(`[mail] (no SMTP key) ${p} code for ${to}: ${code}`); return; }
  await smtp().sendMail({ from: process.env.LB_MAIL_FROM || '"LessonBloom" <no-reply@example.com>', to, subject: k.subject(code), text });
}
