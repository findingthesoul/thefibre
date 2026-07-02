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
  /** Public-surface locale (thread.language). Defaults to en. */
  locale?: string;
};

// Public emails follow the thread's language (the catalog for the web
// surfaces lives in apps/thread/lib/i18n.ts — keep vocabularies aligned).
const EMAIL_I18N: Record<
  string,
  { subject: string; hi: string; enrolled: string; starts: string; open: string }
> = {
  en: {
    subject: "You're enrolled: {title}",
    hi: 'Hi {name},',
    enrolled: "You're enrolled in {title}{with}.",
    starts: 'It starts {date}.',
    open: 'Open the thread',
  },
  nl: {
    subject: 'Je bent ingeschreven: {title}',
    hi: 'Hoi {name},',
    enrolled: 'Je bent ingeschreven voor {title}{with}.',
    starts: 'Het begint op {date}.',
    open: 'Open de thread',
  },
  es: {
    subject: 'Estás inscrito: {title}',
    hi: 'Hola {name}:',
    enrolled: 'Estás inscrito en {title}{with}.',
    starts: 'Comienza el {date}.',
    open: 'Abrir el thread',
  },
  pt: {
    subject: 'Você está inscrito: {title}',
    hi: 'Olá {name},',
    enrolled: 'Você está inscrito em {title}{with}.',
    starts: 'Começa em {date}.',
    open: 'Abrir o thread',
  },
  de: {
    subject: 'Du bist angemeldet: {title}',
    hi: 'Hallo {name},',
    enrolled: 'Du bist für {title}{with} angemeldet.',
    starts: 'Es beginnt am {date}.',
    open: 'Thread öffnen',
  },
};

const WITH_I18N: Record<string, string> = {
  en: ' with {organiser}',
  nl: ' bij {organiser}',
  es: ' con {organiser}',
  pt: ' com {organiser}',
  de: ' bei {organiser}',
};

const EMAIL_DATE_LOCALE: Record<string, string> = {
  en: 'en-GB',
  nl: 'nl-NL',
  es: 'es-ES',
  pt: 'pt-PT',
  de: 'de-DE',
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
  const loc = c.locale && EMAIL_I18N[c.locale] ? c.locale : 'en';
  const L = EMAIL_I18N[loc] ?? EMAIL_I18N.en!;
  const first = c.participantName.split(/\s+/)[0] ?? '';
  const withPart = c.organiserName
    ? (WITH_I18N[loc] ?? WITH_I18N.en!).replace('{organiser}', c.organiserName)
    : '';
  const startDate = c.startsOn
    ? new Intl.DateTimeFormat(EMAIL_DATE_LOCALE[loc] ?? 'en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(c.startsOn))
    : null;

  const subject = L.subject.replace('{title}', c.threadTitle);
  const hi = L.hi.replace('{name}', first);
  const enrolledLine = L.enrolled.replace('{title}', c.threadTitle).replace('{with}', withPart);
  const startLine = startDate ? L.starts.replace('{date}', startDate) : '';

  const text = `${hi}

${enrolledLine}
${startLine ? `\n${startLine}\n` : ''}
${c.intention ? `${c.intention}\n\n` : ''}${c.threadUrl}

${emailSignoff()}`;

  const enrolledHtml = L.enrolled
    .replace('{title}', `<strong>${escapeHtml(c.threadTitle)}</strong>`)
    .replace('{with}', escapeHtml(withPart));

  const html = shell(
    subject,
    `
      <p style="margin:0 0 16px;font-size:15px;">${escapeHtml(hi)}</p>
      <p style="margin:0 0 16px;font-size:15px;">
        ${enrolledHtml}${startLine ? ` ${escapeHtml(startLine)}` : ''}
      </p>
      ${
        c.intention
          ? `<p style="margin:0 0 16px;font-size:14px;color:#525252;">${escapeHtml(c.intention)}</p>`
          : ''
      }
      <p style="margin:24px 0;">
        <a href="${c.threadUrl}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">${escapeHtml(L.open)}</a>
      </p>
      <p style="margin:24px 0 0;font-size:14px;color:#525252;">${escapeHtml(emailSignoff())}</p>
    `,
  );

  return { subject, text, html };
}
