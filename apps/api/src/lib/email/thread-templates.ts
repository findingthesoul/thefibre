// The Thread's transactional emails — same visual shell as Meet + auth
// emails (branding.ts is the SPoT).

import { emailSignoff, INTL_LOCALES, toLocale, type Locale } from '@thefibre/shared';
import { shell, escapeHtml, type EmailBrand } from './templates.js';

/**
 * The organiser's own words, dropped into the platform's email.
 *
 * Written by a human in a settings box, so newlines are paragraphs and
 * everything else is escaped — this is text on its way into HTML, and the
 * person writing it is not writing markup.
 */
function noteHtml(note: string | null | undefined): string {
  if (!note?.trim()) return '';
  const paragraphs = note
    .trim()
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(para).replaceAll('\n', '<br />')}</p>`,
    )
    .join('');
  return `<div style="margin:24px 0;padding:20px;border-left:3px solid #e7e5e4;">${paragraphs}</div>`;
}

export type ThreadEnrolmentEmail = {
  participantName: string;
  threadTitle: string;
  intention: string | null;
  organiserName: string;
  startsOn: string | null; // yyyy-mm-dd
  threadUrl: string;
  /** Public-surface locale (thread.language). Defaults to en. */
  locale?: string;
  /**
   * The door ticket. When present the email gains a QR block (image served
   * by the API — data URIs are stripped by most mail clients) and, per
   * configured wallet, an add-to-wallet link. All three URLs are built by
   * the caller so this file stays free of env reads.
   */
  ticket?: {
    qrUrl: string;
    appleUrl: string | null;
    googleUrl: string | null;
  } | null;
  /** The organiser's own message, if the workspace or thread has one. */
  note?: string | null;
  /** The workspace's logo, if it has one. */
  brand?: EmailBrand | undefined;
};

// Public emails follow the thread's language (the catalog for the web
// surfaces lives in apps/thread/lib/i18n.ts — keep vocabularies aligned).
// Typed Record<Locale, …>: adding a locale to the shared list breaks this
// file at typecheck until every table has an entry. Machine-drafted lines
// carry `// MT` pending native review (nl reviewed by Sjoerd, unmarked).
const EMAIL_I18N: Record<
  Locale,
  {
    subject: string;
    hi: string;
    enrolled: string;
    starts: string;
    open: string;
    ticket: string;
    apple: string;
    google: string;
  }
> = {
  en: {
    subject: "You're enrolled: {title}",
    hi: 'Hi {name},',
    enrolled: "You're enrolled in {title}{with}.",
    starts: 'It starts {date}.',
    open: 'Open the thread',
    ticket: 'Your ticket — show this QR at the door.',
    apple: 'Add to Apple Wallet',
    google: 'Save to Google Wallet',
  },
  nl: {
    subject: 'Je bent ingeschreven: {title}',
    hi: 'Hoi {name},',
    enrolled: 'Je bent ingeschreven voor {title}{with}.',
    starts: 'Het begint op {date}.',
    open: 'Open de thread',
    ticket: 'Je ticket — laat deze QR bij de deur zien.',
    apple: 'Voeg toe aan Apple Wallet',
    google: 'Opslaan in Google Wallet',
  },
  es: {
    subject: 'Estás inscrito: {title}',
    hi: 'Hola {name}:',
    enrolled: 'Estás inscrito en {title}{with}.',
    starts: 'Comienza el {date}.',
    open: 'Abrir el thread',
    ticket: 'Tu entrada: muestra este QR en la puerta.',
    apple: 'Añadir a Apple Wallet',
    google: 'Guardar en Google Wallet',
  },
  pt: {
    subject: 'Você está inscrito: {title}',
    hi: 'Olá {name},',
    enrolled: 'Você está inscrito em {title}{with}.',
    starts: 'Começa em {date}.',
    open: 'Abrir o thread',
    ticket: 'Seu ingresso — mostre este QR na entrada.',
    apple: 'Adicionar à Apple Wallet',
    google: 'Salvar no Google Wallet',
  },
  de: {
    subject: 'Du bist angemeldet: {title}',
    hi: 'Hallo {name},',
    enrolled: 'Du bist für {title}{with} angemeldet.',
    starts: 'Es beginnt am {date}.',
    open: 'Thread öffnen',
    ticket: 'Dein Ticket — zeig diesen QR-Code am Eingang.',
    apple: 'Zu Apple Wallet hinzufügen',
    google: 'In Google Wallet speichern',
  },
  fr: {
    subject: 'Ton inscription est confirmée : {title}', // MT
    hi: 'Bonjour {name},', // MT
    enrolled: 'Ton inscription à {title}{with} est confirmée.', // MT
    starts: 'Ça commence le {date}.', // MT
    open: 'Ouvrir le thread', // MT
    ticket: 'Ton billet — montre ce QR à l’entrée.', // MT
    apple: 'Ajouter à Apple Wallet', // MT
    google: 'Enregistrer dans Google Wallet', // MT
  },
};

const WITH_I18N: Record<Locale, string> = {
  en: ' with {organiser}',
  nl: ' bij {organiser}',
  es: ' con {organiser}',
  pt: ' com {organiser}',
  de: ' bei {organiser}',
  fr: ' avec {organiser}', // MT
};

export type EmailTicket = {
  qrUrl: string;
  appleUrl: string | null;
  googleUrl: string | null;
};

/**
 * The QR block.
 *
 * Exported because the ticket no longer belongs to one hard-coded email: since
 * v0.19.33 the confirmation can be a message the organiser wrote themselves,
 * and the ticket is appended to it by the sender. Never by the text — an
 * organiser editing their welcome should not be able to delete the ticket from
 * their own ticket email.
 */
export function ticketBlock(ticket: EmailTicket | null | undefined, locale: string): string {
  if (!ticket) return '';
  const L = EMAIL_I18N[toLocale(locale)];
  return `
      <div style="margin:24px 0;padding:20px;border:1px solid #e7e5e4;border-radius:12px;text-align:center;">
        <p style="margin:0 0 12px;font-size:14px;color:#525252;">${escapeHtml(L.ticket)}</p>
        <img src="${ticket.qrUrl}" width="180" height="180" alt="QR" style="display:inline-block;width:180px;height:180px;" />
        ${
          ticket.appleUrl || ticket.googleUrl
            ? `<p style="margin:14px 0 0;font-size:13px;">${[
                ticket.appleUrl
                  ? `<a href="${ticket.appleUrl}" style="color:#171717;">${escapeHtml(L.apple)}</a>`
                  : '',
                ticket.googleUrl
                  ? `<a href="${ticket.googleUrl}" style="color:#171717;">${escapeHtml(L.google)}</a>`
                  : '',
              ]
                .filter(Boolean)
                .join(' &nbsp;·&nbsp; ')}</p>`
            : ''
        }
      </div>`;
}

/** The default wording for the messages the platform seeds into a thread.
 *
 *  Composed from the strings the compiled emails already use, in every
 *  locale — so a seeded default says exactly what today's email says, in
 *  the thread's language, without anybody inventing new prose in languages
 *  they do not speak. The organiser edits it from there. */
export function systemMessageDefaults(locale: string): {
  enrolment_received: { title: string; body: string };
  enrolment_confirmed: { title: string; body: string };
} {
  const loc = toLocale(locale);
  const L = EMAIL_I18N[loc];
  const P = PENDING_I18N[loc];
  const withOrganiser = WITH_I18N[loc].replaceAll('{organiser}', '{organiser}');
  return {
    enrolment_received: {
      title: P.subject,
      body: `${L.hi}\n\n${P.body.replaceAll('{with}', withOrganiser)}`,
    },
    enrolment_confirmed: {
      title: L.subject,
      body: `${L.hi}\n\n${L.enrolled.replaceAll('{with}', withOrganiser)} ${L.starts.replaceAll('{date}', '{start_date}')}`,
    },
  };
}

// A message-family engagement rendered as an email — used by every
// triggered send (lifecycle triggers AND the 5-minute scheduler).
export function engagementMessage(c: {
  title: string;
  bodyText: string; // tokens already substituted; newlines preserved
  threadTitle: string;
  brand?: EmailBrand | undefined;
  /** Appended after the body when this message is the one that admits you. */
  ticket?: EmailTicket | null | undefined;
  locale?: string | undefined;
}): { subject: string; text: string; html: string } {
  const subject = c.title;
  const text = `${c.bodyText}\n\n${emailSignoff()}`;
  const html = shell(
    c.threadTitle,
    `
      <h2 style="margin:0 0 16px;font-size:18px;font-weight:600;">${escapeHtml(c.title)}</h2>
      <div style="font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(c.bodyText)}</div>
      ${ticketBlock(c.ticket, c.locale ?? 'en')}
      <p style="margin:24px 0 0;font-size:14px;color:#525252;">${escapeHtml(emailSignoff())}</p>
    `,
    c.brand,
  );
  return { subject, text, html };
}

// Approval-required threads: "request received" — the confirmation email
// follows once the organiser approves.
const PENDING_I18N: Record<Locale, { subject: string; body: string }> = {
  en: {
    subject: 'Request received: {title}',
    body: 'Your enrolment request for {title}{with} has been received. You will get a confirmation as soon as the organiser approves it.',
  },
  nl: {
    subject: 'Aanvraag ontvangen: {title}',
    body: 'Je aanmeldingsverzoek voor {title}{with} is ontvangen. Je krijgt een bevestiging zodra de organisator het goedkeurt.',
  },
  es: {
    subject: 'Solicitud recibida: {title}',
    body: 'Hemos recibido tu solicitud de inscripción en {title}{with}. Recibirás una confirmación en cuanto el organizador la apruebe.',
  },
  pt: {
    subject: 'Pedido recebido: {title}',
    body: 'Seu pedido de inscrição em {title}{with} foi recebido. Você receberá uma confirmação assim que o organizador aprovar.',
  },
  de: {
    subject: 'Anfrage erhalten: {title}',
    body: 'Deine Anmeldeanfrage für {title}{with} ist eingegangen. Du erhältst eine Bestätigung, sobald die Organisation sie genehmigt.',
  },
  fr: {
    subject: 'Demande reçue : {title}', // MT
    body: 'Ta demande d’inscription à {title}{with} a bien été reçue. Tu recevras une confirmation dès que l’organisateur l’aura approuvée.', // MT
  },
};

export function enrolmentPending(c: {
  participantName: string;
  threadTitle: string;
  organiserName: string;
  locale?: string | null;
  note?: string | null;
  brand?: EmailBrand | undefined;
}): { subject: string; text: string; html: string } {
  const loc = toLocale(c.locale);
  const L = PENDING_I18N[loc];
  const withPart = c.organiserName
    ? WITH_I18N[loc].replaceAll('{organiser}', c.organiserName)
    : '';
  const subject = L.subject.replaceAll('{title}', c.threadTitle);
  const body = L.body.replaceAll('{title}', c.threadTitle).replaceAll('{with}', withPart);
  const hi = EMAIL_I18N[loc].hi.replaceAll(
    '{name}',
    c.participantName.split(/\s+/)[0] ?? c.participantName,
  );
  const note = c.note?.trim();
  const text = `${hi}\n\n${body}\n${note ? `\n${note}\n` : ''}\n${emailSignoff()}`;
  const html = shell(
    c.threadTitle,
    `
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">${escapeHtml(hi)}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">${escapeHtml(body)}</p>
      ${noteHtml(note)}
      <p style="margin:24px 0 0;font-size:14px;color:#525252;">${escapeHtml(emailSignoff())}</p>
    `,
    c.brand,
  );
  return { subject, text, html };
}

export function enrolmentConfirmation(c: ThreadEnrolmentEmail): {
  subject: string;
  text: string;
  html: string;
} {
  const loc = toLocale(c.locale);
  const L = EMAIL_I18N[loc];
  const first = c.participantName.split(/\s+/)[0] ?? '';
  const withPart = c.organiserName
    ? WITH_I18N[loc].replace('{organiser}', c.organiserName)
    : '';
  const startDate = c.startsOn
    ? new Intl.DateTimeFormat(INTL_LOCALES[loc], {
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

  const note = c.note?.trim();
  const text = `${hi}

${enrolledLine}
${startLine ? `\n${startLine}\n` : ''}
${note ? `${note}\n\n` : ''}${c.intention ? `${c.intention}\n\n` : ''}${c.threadUrl}

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
      ${noteHtml(note)}
      ${
        c.intention
          ? `<p style="margin:0 0 16px;font-size:14px;color:#525252;">${escapeHtml(c.intention)}</p>`
          : ''
      }
      <p style="margin:24px 0;">
        <a href="${c.threadUrl}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">${escapeHtml(L.open)}</a>
      </p>
      ${ticketBlock(c.ticket, loc)}
      <p style="margin:24px 0 0;font-size:14px;color:#525252;">${escapeHtml(emailSignoff())}</p>
    `,
    c.brand,
  );

  return { subject, text, html };
}
