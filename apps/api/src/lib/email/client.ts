// Email transport. Thin wrapper around Resend's REST API via fetch — avoids
// adding the SDK dep. No-ops (and logs) when RESEND_API_KEY is unset so local
// dev and CI don't need outbound mail.

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string | undefined;
};

import { defaultEmailFrom } from '@thefibre/shared';

function fromAddress(): string {
  return defaultEmailFrom(process.env);
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log('[email] RESEND_API_KEY unset — would send:', {
      to: msg.to,
      subject: msg.subject,
    });
    return;
  }
  const body: Record<string, unknown> = {
    from: fromAddress(),
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  };
  if (msg.replyTo) body.reply_to = msg.replyTo;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`resend ${r.status}: ${text}`);
  }
}
