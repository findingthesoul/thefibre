// The Thread's transactional emails — same visual shell as Meet + auth
// emails (branding.ts is the SPoT).

import { emailSignoff } from '@thefibre/shared';
import { shell, escapeHtml } from './templates.js';

export type ThreadEnrolmentEmail = {
  participantName: string;
  threadTitle: string;
  intention: string | null;
  organiserName: string;
  startsOn: string | null; // yyyy-mm-dd
  threadUrl: string;
};

function fmtDate(d: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(d));
}

// A message-family engagement rendered as an email (used by the
// on-enrolment trigger now; the scheduled sender in a later phase).
export function engagementMessage(c: {
  title: string;
  bodyText: string; // tokens already substituted; newlines preserved
  threadTitle: string;
}): { subject: string; text: string; html: string } {
  const subject = c.title;
  const text = `${c.bodyText}\n\n${emailSignoff()}`;
  const html = shell(
    c.threadTitle,
    `
      <h2 style="margin:0 0 16px;font-size:18px;font-weight:600;">${escapeHtml(c.title)}</h2>
      <div style="font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(c.bodyText)}</div>
      <p style="margin:24px 0 0;font-size:14px;color:#525252;">${escapeHtml(emailSignoff())}</p>
    `,
  );
  return { subject, text, html };
}

export function enrolmentConfirmation(c: ThreadEnrolmentEmail): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `You're enrolled: ${c.threadTitle}`;
  const first = c.participantName.split(/\s+/)[0] ?? '';
  const startLine = c.startsOn ? `It starts ${fmtDate(c.startsOn)}.` : '';

  const text = `Hi ${first},

You're enrolled in ${c.threadTitle}${c.organiserName ? ` with ${c.organiserName}` : ''}.
${startLine ? `\n${startLine}\n` : ''}
${c.intention ? `${c.intention}\n\n` : ''}Follow the thread here: ${c.threadUrl}

${emailSignoff()}`;

  const html = shell(
    'Enrolment confirmed',
    `
      <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(first)},</p>
      <p style="margin:0 0 16px;font-size:15px;">
        You're enrolled in <strong>${escapeHtml(c.threadTitle)}</strong>${
          c.organiserName ? ` with ${escapeHtml(c.organiserName)}` : ''
        }.${startLine ? ` ${escapeHtml(startLine)}` : ''}
      </p>
      ${
        c.intention
          ? `<p style="margin:0 0 16px;font-size:14px;color:#525252;">${escapeHtml(c.intention)}</p>`
          : ''
      }
      <p style="margin:24px 0;">
        <a href="${c.threadUrl}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">Open the thread</a>
      </p>
      <p style="margin:24px 0 0;font-size:14px;color:#525252;">${escapeHtml(emailSignoff())}</p>
    `,
  );

  return { subject, text, html };
}
