// Email transport. Thin wrapper around Resend's REST API via fetch — avoids
// adding the SDK dep. No-ops (and logs) when RESEND_API_KEY is unset so local
// dev and CI don't need outbound mail.

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string | undefined;
  /** Attached files (Resend: base64 content). Used for the internal invoice
   *  PDF — the ledger is the record, never Stripe's hosted page.
   *
   *  `contentType` matters for exactly one case and it is load-bearing there:
   *  a calendar invitation is only an invitation because its part says
   *  `text/calendar; method=REQUEST`. Drop the method and the same bytes
   *  arrive as a file to download — the recipient's calendar does nothing and
   *  nothing on our side looks wrong. The PDF needs none of this because
   *  Resend infers it from the `.pdf` filename, which is why this field did
   *  not exist until invitations needed it. */
  attachments?: { filename: string; content: string; contentType?: string }[] | undefined;
  /**
   * Who it comes from, when a workspace has said. Two halves with very
   * different costs: a display NAME is free — a mailbox shows it and nothing
   * needs verifying — while an ADDRESS only sends from a domain that has been
   * verified with SPF and DKIM. See the fallback in sendEmail.
   */
  fromName?: string | undefined;
  fromAddress?: string | undefined;
};

import { defaultEmailFrom } from '@thefibre/shared';

function fromAddress(): string {
  return defaultEmailFrom(process.env);
}

/**
 * The platform's bare sender address — `noreply@thefibre.app` out of
 * "The Thread <noreply@thefibre.app>" (or EMAIL_FROM, whichever form it
 * takes). For fields that want an address and nothing else: iCal ORGANIZER,
 * envelope senders. Email headers keep the display-name form via composeFrom.
 */
export function platformFromAddress(): string {
  const from = fromAddress();
  return from.match(/<([^>]+)>/)?.[1] || from;
}

/**
 * "Name <address>", from whichever halves we have. A workspace that has only
 * set a name borrows the platform's address, which is the point: it reads as
 * theirs in the inbox with no DNS work at all.
 */
function composeFrom(msg: EmailMessage): string {
  const fallback = fromAddress();
  const address = msg.fromAddress?.trim() || platformFromAddress();
  const name = msg.fromName?.trim();
  return name ? `${name.replace(/[<>"]/g, '')} <${address}>` : (msg.fromAddress ? address : fallback);
}

async function post(key: string, body: Record<string, unknown>): Promise<Response> {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log('[email] RESEND_API_KEY unset — would send:', {
      to: msg.to,
      subject: msg.subject,
      from: composeFrom(msg),
    });
    return;
  }
  const body: Record<string, unknown> = {
    from: composeFrom(msg),
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  };
  if (msg.replyTo) body.reply_to = msg.replyTo;
  if (msg.attachments?.length) {
    body.attachments = msg.attachments.map((a) =>
      a.contentType ? { filename: a.filename, content: a.content, content_type: a.contentType } : a,
    );
  }

  let r = await post(key, body);

  // An unverified sender domain is refused, and the workspace that typed it in
  // has no way to know that from here. Rather than losing the email — which is
  // somebody's ticket — send it from the platform address and say so in the
  // log. The name, which needs no verification, is kept.
  if (!r.ok && msg.fromAddress) {
    const detail = await r.text().catch(() => '');
    console.warn(
      `[email] sender "${msg.fromAddress}" refused (resend ${r.status}: ${detail.slice(0, 200)}) — ` +
        'falling back to the platform address. Verify the domain in Resend to use it.',
    );
    r = await post(key, { ...body, from: composeFrom({ ...msg, fromAddress: undefined }) });
  }

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`resend ${r.status}: ${text}`);
  }
}
