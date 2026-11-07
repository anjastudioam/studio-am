import type { MailMessage } from "./mailer";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function loginEmail(to: string, name: string, link: string): MailMessage {
  const text = `Hi ${name},\n\nUse this link to sign in to your Studio AM portal. It works once and expires in 15 minutes:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.\n\nStudio AM`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1C1B12;max-width:480px">
<p>Hi ${esc(name)},</p>
<p>Use the button below to sign in to your Studio AM portal. It works once and expires in 15 minutes.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#6B6410;color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:4px">Sign in</a></p>
<p style="color:#6F6C5A;font-size:13px">If you didn't ask for this, you can ignore this email.</p>
<p>Studio AM</p></div>`;
  return { to, subject: "Your Studio AM sign-in link", text, html };
}
