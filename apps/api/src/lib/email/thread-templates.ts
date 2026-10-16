// The Thread's transactional emails — same visual shell as Meet + auth
// emails (branding.ts is the SPoT).

import { emailSignoff, INTL_LOCALES, makeT, toLocale, type I18nEntry, type Locale } from '@thefibre/shared';
import { shell, escapeHtml, type EmailBrand } from './templates.js';
import { myThreadUrl } from '../message-tokens.js';

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
/**
 * Make the visitor portal's address clickable in the HTML part.
 *
 * This runs AFTER `escapeHtml`, and that order is the whole design. The body
 * is an organiser's plain text on its way into HTML, so it is escaped whole
 * and nothing they type can become markup. The only string that turns into an
 * anchor is one `{my.thread}` expanded a moment earlier — a URL this codebase
 * chose, matched literally, not a URL-shaped thing found by a regex sweeping
 * the participant's mail.
 *
 * It also catches the address typed by hand, which is the same string and
 * deserves the same treatment.
 *
 * The visible text stays the address rather than a friendly label, so the
 * HTML part and the plain-text part say the identical thing and differ only
 * in whether you can click it.
 *
 * #171717 is not a new colour: it is what every inline link in these emails
 * already uses (templates.ts — join, reschedule, cancel, add-to-calendar).
 * Mail clients cannot read our design tokens, so these hexes are written
 * out; copying the neighbouring one is how that stays a single decision
 * rather than a per-email invention.
 */
function linkPortal(escaped: string, url: string): string {
  const safeUrl = escapeHtml(url);
  const shown = url.replace(/^https?:\/\//, '');
  return escaped.replaceAll(
    safeUrl,
    `<a href="${safeUrl}" style="color:#171717;">${escapeHtml(shown)}</a>`,
  );
}

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
      <div style="font-size:15px;line-height:1.6;white-space:pre-wrap;">${linkPortal(escapeHtml(c.bodyText), myThreadUrl())}</div>
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

// ---------------------------------------------------------------------------
// Calendar invitations — the message that carries the .ics
//
// Deliberately plain. The .ics is doing the work: the recipient's calendar
// reads it and files or corrects the event, often before they open anything.
// What the human sees is the courtesy half — what changed, in words, so the
// message is not a bare attachment from a name they half-recognise.
//
// Escaping stays where it is in engagementMessage above: organiser text is
// escaped whole, and the only string that becomes a link is one we put there.
// ---------------------------------------------------------------------------

export type CalendarInviteKind = 'added' | 'moved' | 'cancelled';

// The words of the calendar email, in the RECIPIENT's language
// (platformEmailLocale: their own profile, then the thread's language, then
// English). English only until 2026-10-16, while every other Thread mail was
// translated (Sjoerd: participants hear about every change). English is
// unchanged word for word; the other five are machine translations, marked
// like everywhere else.
const INVITE_CATALOG = {
  ci_subj_removed: {
    en: 'Removed: {title}',
    nl: 'Verwijderd: {title}', // MT
    es: 'Eliminado: {title}', // MT
    pt: 'Removido: {title}', // MT
    de: 'Entfernt: {title}', // MT
    fr: 'Retiré : {title}', // MT
  },
  ci_subj_host: {
    en: 'Invitation to host: {title}',
    nl: 'Uitnodiging om te hosten: {title}', // MT
    es: 'Invitación para ser anfitrión: {title}', // MT
    pt: 'Convite para ser anfitrião: {title}', // MT
    de: 'Einladung zum Hosten: {title}', // MT
    fr: 'Invitation à animer : {title}', // MT
  },
  ci_subj_cancelled: {
    en: 'Cancelled: {title}',
    nl: 'Geannuleerd: {title}', // MT
    es: 'Cancelado: {title}', // MT
    pt: 'Cancelado: {title}', // MT
    de: 'Abgesagt: {title}', // MT
    fr: 'Annulé : {title}', // MT
  },
  ci_subj_moved: {
    en: 'Moved: {title} — now {when}',
    nl: 'Verplaatst: {title} — nu {when}', // MT
    es: 'Cambiado: {title} — ahora {when}', // MT
    pt: 'Remarcado: {title} — agora {when}', // MT
    de: 'Verschoben: {title} — jetzt {when}', // MT
    fr: 'Déplacé : {title} — désormais {when}', // MT
  },
  ci_subj_place: {
    en: 'New place: {title}',
    nl: 'Nieuwe plek: {title}', // MT
    es: 'Nuevo lugar: {title}', // MT
    pt: 'Novo local: {title}', // MT
    de: 'Neuer Ort: {title}', // MT
    fr: 'Nouveau lieu : {title}', // MT
  },
  ci_subj_added: {
    en: 'Invitation: {title}',
    nl: 'Uitnodiging: {title}', // MT
    es: 'Invitación: {title}', // MT
    pt: 'Convite: {title}', // MT
    de: 'Einladung: {title}', // MT
    fr: 'Invitation : {title}', // MT
  },
  ci_lead_removed: {
    en: '{org} has taken you off this session of {thread}. It goes ahead without you hosting it.',
    nl: '{org} heeft je van deze sessie van {thread} gehaald. Ze gaat door zonder dat jij host.', // MT
    es: '{org} te ha quitado de esta sesión de {thread}. Se celebra sin que tú seas anfitrión.', // MT
    pt: '{org} retirou você desta sessão de {thread}. Ela acontece sem você como anfitrião.', // MT
    de: '{org} hat dich von dieser Sitzung von {thread} genommen. Sie findet ohne dich als Host statt.', // MT
    fr: '{org} vous a retiré de cette séance de {thread}. Elle a lieu sans que vous l’animiez.', // MT
  },
  ci_lead_host: {
    en: '{org} has added you as a host of this session of {thread}.',
    nl: '{org} heeft je toegevoegd als host van deze sessie van {thread}.', // MT
    es: '{org} te ha añadido como anfitrión de esta sesión de {thread}.', // MT
    pt: '{org} adicionou você como anfitrião desta sessão de {thread}.', // MT
    de: '{org} hat dich als Host dieser Sitzung von {thread} hinzugefügt.', // MT
    fr: '{org} vous a ajouté comme animateur de cette séance de {thread}.', // MT
  },
  ci_lead_cancelled: {
    en: '{org} has cancelled this session of {thread}.',
    nl: '{org} heeft deze sessie van {thread} geannuleerd.', // MT
    es: '{org} ha cancelado esta sesión de {thread}.', // MT
    pt: '{org} cancelou esta sessão de {thread}.', // MT
    de: '{org} hat diese Sitzung von {thread} abgesagt.', // MT
    fr: '{org} a annulé cette séance de {thread}.', // MT
  },
  ci_lead_moved: {
    en: '{org} has moved this session of {thread}.',
    nl: '{org} heeft deze sessie van {thread} verplaatst.', // MT
    es: '{org} ha cambiado esta sesión de {thread}.', // MT
    pt: '{org} remarcou esta sessão de {thread}.', // MT
    de: '{org} hat diese Sitzung von {thread} verschoben.', // MT
    fr: '{org} a déplacé cette séance de {thread}.', // MT
  },
  ci_lead_place: {
    en: '{org} has changed where this session of {thread} takes place. The time stays the same.',
    nl: '{org} heeft de plek van deze sessie van {thread} gewijzigd. De tijd blijft hetzelfde.', // MT
    es: '{org} ha cambiado el lugar de esta sesión de {thread}. La hora sigue siendo la misma.', // MT
    pt: '{org} mudou o local desta sessão de {thread}. O horário continua o mesmo.', // MT
    de: '{org} hat den Ort dieser Sitzung von {thread} geändert. Die Zeit bleibt gleich.', // MT
    fr: '{org} a changé le lieu de cette séance de {thread}. L’horaire reste le même.', // MT
  },
  ci_lead_added: {
    en: '{org} has added a session to {thread}.',
    nl: '{org} heeft een sessie toegevoegd aan {thread}.', // MT
    es: '{org} ha añadido una sesión a {thread}.', // MT
    pt: '{org} adicionou uma sessão a {thread}.', // MT
    de: '{org} hat {thread} eine Sitzung hinzugefügt.', // MT
    fr: '{org} a ajouté une séance à {thread}.', // MT
  },
  ci_was: { en: 'Was', nl: 'Was', es: 'Antes', pt: 'Antes', de: 'Vorher', fr: 'Avant' }, // MT
  ci_now: { en: 'Now', nl: 'Nu', es: 'Ahora', pt: 'Agora', de: 'Jetzt', fr: 'Désormais' }, // MT
  ci_when: { en: 'When', nl: 'Wanneer', es: 'Cuándo', pt: 'Quando', de: 'Wann', fr: 'Quand' }, // MT
  ci_where: { en: 'Where', nl: 'Waar', es: 'Dónde', pt: 'Onde', de: 'Wo', fr: 'Où' }, // MT
  ci_online: { en: 'Online', nl: 'Online', es: 'En línea', pt: 'Online', de: 'Online', fr: 'En ligne' }, // MT
  ci_foot_cancelled: {
    en: "We've sent your calendar the cancellation. If the session is still there, open the attached file to remove it.",
    nl: 'We hebben de annulering naar je agenda gestuurd. Staat de sessie er nog? Open dan het bijgevoegde bestand om haar te verwijderen.', // MT
    es: 'Hemos enviado la cancelación a tu calendario. Si la sesión sigue ahí, abre el archivo adjunto para eliminarla.', // MT
    pt: 'Enviamos o cancelamento para o seu calendário. Se a sessão ainda estiver lá, abra o arquivo anexo para removê-la.', // MT
    de: 'Wir haben die Absage an deinen Kalender geschickt. Steht die Sitzung noch drin, öffne die angehängte Datei, um sie zu entfernen.', // MT
    fr: 'Nous avons envoyé l’annulation à votre agenda. Si la séance y figure encore, ouvrez le fichier joint pour la supprimer.', // MT
  },
  ci_foot_moved: {
    en: 'The new time is above. The invitation is attached if you need to add it.',
    nl: 'De nieuwe tijd staat hierboven. De uitnodiging zit in de bijlage als je haar wilt toevoegen.', // MT
    es: 'La nueva hora está arriba. La invitación va adjunta por si necesitas añadirla.', // MT
    pt: 'O novo horário está acima. O convite está anexado caso precise adicioná-lo.', // MT
    de: 'Die neue Zeit steht oben. Die Einladung ist angehängt, falls du sie hinzufügen musst.', // MT
    fr: 'Le nouvel horaire figure ci-dessus. L’invitation est jointe si vous devez l’ajouter.', // MT
  },
  ci_foot_place: {
    en: 'The new place is above. The invitation is attached if you need to update it.',
    nl: 'De nieuwe plek staat hierboven. De uitnodiging zit in de bijlage als je haar moet bijwerken.', // MT
    es: 'El nuevo lugar está arriba. La invitación va adjunta por si necesitas actualizarla.', // MT
    pt: 'O novo local está acima. O convite está anexado caso precise atualizá-lo.', // MT
    de: 'Der neue Ort steht oben. Die Einladung ist angehängt, falls du sie aktualisieren musst.', // MT
    fr: 'Le nouveau lieu figure ci-dessus. L’invitation est jointe si vous devez la mettre à jour.', // MT
  },
  ci_foot_added: {
    en: 'The invitation is attached, if you would like it in your calendar.',
    nl: 'De uitnodiging zit in de bijlage, als je haar in je agenda wilt.', // MT
    es: 'La invitación va adjunta, por si la quieres en tu calendario.', // MT
    pt: 'O convite está anexado, caso queira colocá-lo no seu calendário.', // MT
    de: 'Die Einladung ist angehängt, falls du sie in deinem Kalender haben möchtest.', // MT
    fr: 'L’invitation est jointe, si vous souhaitez l’ajouter à votre agenda.', // MT
  },
} satisfies Record<string, I18nEntry>;
const ti = makeT(INVITE_CATALOG);

export function calendarInviteEmail(c: {
  kind: CalendarInviteKind;
  sessionTitle: string;
  threadTitle: string;
  organiserName: string;
  /** Rendered, human, already in the reader's timezone where we know it. */
  whenLine: string;
  /** The previous when-line, for a move. Seeing what it WAS is most of how
   *  somebody recognises whether this affects them. */
  wasLine?: string | null;
  whereLine?: string | null;
  /** A move where only the PLACE changed (the time did not): said as such,
   *  with the old place struck through, instead of "Moved — now <the same
   *  time>", which read as a time change that had not happened. */
  placeOnly?: boolean;
  /** The place before, for a place-only move. */
  wasWhereLine?: string | null;
  /** The online link (meeting or location URL). It used to travel only
   *  inside the .ics, so a changed link was invisible in the email. Shown as
   *  a link only when it is http(s). */
  onlineUrl?: string | null;
  /** The reader's language (platformEmailLocale). English when absent. */
  locale?: string | null;
  /** The organiser's own words, typed once at the moment of sending. */
  note?: string | null;
  brand?: EmailBrand | undefined;
  /** A HOST's copy when who hosts changed: added to the session, or taken
   *  off it (the session itself goes on for everyone else). */
  hostChange?: 'added' | 'removed' | null;
}): { subject: string; text: string; html: string } {
  const loc = toLocale(c.locale);
  const placeOnly = c.kind === 'moved' && !!c.placeOnly && !c.hostChange;
  const vars = { title: c.sessionTitle, when: c.whenLine, org: c.organiserName, thread: c.threadTitle };
  const subject = ti(
    loc,
    c.hostChange === 'removed'
      ? 'ci_subj_removed'
      : c.hostChange === 'added'
        ? 'ci_subj_host'
        : c.kind === 'cancelled'
          ? 'ci_subj_cancelled'
          : placeOnly
            ? 'ci_subj_place'
            : c.kind === 'moved'
              ? 'ci_subj_moved'
              : 'ci_subj_added',
    vars,
  );
  const online = c.onlineUrl && /^https?:\/\//i.test(c.onlineUrl) ? c.onlineUrl : null;

  const lines: string[] = [];
  lines.push(
    ti(
      loc,
      c.hostChange === 'removed'
        ? 'ci_lead_removed'
        : c.hostChange === 'added'
          ? 'ci_lead_host'
          : c.kind === 'cancelled'
            ? 'ci_lead_cancelled'
            : placeOnly
              ? 'ci_lead_place'
              : c.kind === 'moved'
                ? 'ci_lead_moved'
                : 'ci_lead_added',
      vars,
    ),
  );
  lines.push('');
  lines.push(c.sessionTitle);
  if (placeOnly) {
    lines.push(c.whenLine);
    if (c.wasWhereLine) lines.push(`${ti(loc, 'ci_was')}: ${c.wasWhereLine}`);
    if (c.whereLine) lines.push(`${ti(loc, 'ci_now')}: ${c.whereLine}`);
  } else {
    if (c.kind === 'moved' && c.wasLine) lines.push(`${ti(loc, 'ci_was')}: ${c.wasLine}`);
    if (c.kind !== 'cancelled') lines.push(c.kind === 'moved' ? `${ti(loc, 'ci_now')}: ${c.whenLine}` : c.whenLine);
    if (c.whereLine && c.kind !== 'cancelled') lines.push(c.whereLine);
  }
  if (online && c.kind !== 'cancelled') lines.push(`${ti(loc, 'ci_online')}: ${online}`);
  if (c.note?.trim()) {
    lines.push('');
    lines.push(c.note.trim());
  }
  lines.push('');
  // DO NOT promise that their calendar has updated itself.
  //
  // It said exactly that until 2026-09-25, and it was false. Gmail recognises
  // the attached invitation and then refuses it — "Unable to load event" —
  // almost certainly because the message leaves from our address while the
  // invitation names the organiser as its ORGANIZER, which Google reads as
  // forged. Found by looking at a real sent message rather than at our own
  // logs, where it appeared to have worked perfectly.
  //
  // So: say nothing about the calendar AT ALL, not even hedged. This email
  // cannot know whether the invitation was honoured — that is the entire
  // finding — and a hedge like "some calendars update themselves and some do
  // not" is still a guess wearing the clothes of a statement. Tell the person
  // what they can DO. That reads as true whether the iMIP half works, does
  // not work, or starts working later, which also means it never needs
  // revisiting when the alignment is fixed. (The second wording here is the
  // peer session's; it is better than the hedge I wrote first.)
  //
  // Both directions of the old copy were expensive, and the cancellation was
  // the worse one: "you do not need to add anything" costs somebody a session
  // they meant to attend, while "it should disappear on its own" sends
  // somebody to a room for a session that is not happening, having been told
  // explicitly not to act.
  lines.push(
    ti(
      loc,
      // Measured 2026-10-15: Apple Calendar removed the event on its own, and
      // opening the file showed the cancellation. Gmail is not yet measured,
      // so this says what was SENT, not what the calendar did.
      c.kind === 'cancelled'
        ? 'ci_foot_cancelled'
        : placeOnly
          ? 'ci_foot_place'
          : c.kind === 'moved'
            ? 'ci_foot_moved'
            : 'ci_foot_added',
    ),
  );

  // Signed by the ORGANISER: the invitation is theirs (its ORGANIZER name),
  // not the platform's. "— The Fibre" under a Thread invitation read as
  // somebody else's mail (Sjoerd, 2026-10-15).
  const signoff = `— ${c.organiserName || 'The Thread'}`;
  const body = lines.join('\n');
  const text = `${body}\n\n${signoff}`;

  const onlineRow = online
    ? `<tr><td style="padding:2px 16px 2px 0;color:#737373;white-space:nowrap;">${escapeHtml(ti(loc, 'ci_online'))}</td><td style="padding:2px 0;"><a href="${escapeHtml(online)}" style="color:#171717;">${escapeHtml(online)}</a></td></tr>`
    : '';
  const html = shell(
    c.threadTitle,
    `
      <h2 style="margin:0 0 16px;font-size:18px;font-weight:600;">${escapeHtml(c.sessionTitle)}</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(lines[0]!)}</p>
      <table style="font-size:15px;line-height:1.6;border-collapse:collapse;">
        ${
          placeOnly
            ? `${row(ti(loc, 'ci_when'), c.whenLine)}${c.wasWhereLine ? row(ti(loc, 'ci_was'), c.wasWhereLine, true) : ''}${c.whereLine ? row(ti(loc, 'ci_where'), c.whereLine) : ''}`
            : `${c.kind === 'moved' && c.wasLine ? row(ti(loc, 'ci_was'), c.wasLine, true) : ''}${
                c.kind !== 'cancelled' ? row(ti(loc, c.kind === 'moved' ? 'ci_now' : 'ci_when'), c.whenLine) : ''
              }${c.whereLine && c.kind !== 'cancelled' ? row(ti(loc, 'ci_where'), c.whereLine) : ''}`
        }
        ${c.kind !== 'cancelled' ? onlineRow : ''}
      </table>
      ${
        c.note?.trim()
          ? `<div style="margin:20px 0 0;font-size:15px;line-height:1.6;white-space:pre-wrap;">${linkPortal(escapeHtml(c.note.trim()), myThreadUrl())}</div>`
          : ''
      }
      <p style="margin:24px 0 0;font-size:14px;color:#525252;">${escapeHtml(lines[lines.length - 1]!)}</p>
      <p style="margin:16px 0 0;font-size:14px;color:#525252;">${escapeHtml(signoff)}</p>
    `,
    c.brand,
  );

  return { subject, text, html };
}

/** A label/value pair, with the old value struck through so a move reads at a
 *  glance rather than needing both lines compared word by word. */
function row(label: string, value: string, struck = false): string {
  const v = struck
    ? `<span style="text-decoration:line-through;color:#737373;">${escapeHtml(value)}</span>`
    : escapeHtml(value);
  return `<tr><td style="padding:2px 16px 2px 0;color:#737373;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:2px 0;">${v}</td></tr>`;
}

// ---------------------------------------------------------------------------
// The nudge — to the ORGANISER, when calendar changes have waited a day for
// their SEND (lib/calendar-nudge.ts). Says what is waiting and where the
// button is; it never sends anything itself (Sjoerd, 2026-10-16: "keep send
// manual with nudge").
// ---------------------------------------------------------------------------

const NUDGE_CATALOG = {
  nu_subject: {
    en: 'Not sent yet: changes to {thread}',
    nl: 'Nog niet verstuurd: wijzigingen in {thread}', // MT
    es: 'Aún sin enviar: cambios en {thread}', // MT
    pt: 'Ainda não enviado: alterações em {thread}', // MT
    de: 'Noch nicht gesendet: Änderungen an {thread}', // MT
    fr: 'Pas encore envoyé : modifications de {thread}', // MT
  },
  nu_lead_one: {
    en: 'You changed a session of {thread} a day or more ago. Nobody has been told yet.',
    nl: 'Je hebt meer dan een dag geleden een sessie van {thread} gewijzigd. Er is nog niemand op de hoogte gebracht.', // MT
    es: 'Cambiaste una sesión de {thread} hace un día o más. Todavía no se ha avisado a nadie.', // MT
    pt: 'Você alterou uma sessão de {thread} há um dia ou mais. Ninguém foi avisado ainda.', // MT
    de: 'Du hast vor einem Tag oder länger eine Sitzung von {thread} geändert. Bisher wurde niemand informiert.', // MT
    fr: 'Vous avez modifié une séance de {thread} il y a un jour ou plus. Personne n’a encore été prévenu.', // MT
  },
  nu_lead_many: {
    en: 'You changed {n} sessions of {thread} a day or more ago. Nobody has been told yet.',
    nl: 'Je hebt meer dan een dag geleden {n} sessies van {thread} gewijzigd. Er is nog niemand op de hoogte gebracht.', // MT
    es: 'Cambiaste {n} sesiones de {thread} hace un día o más. Todavía no se ha avisado a nadie.', // MT
    pt: 'Você alterou {n} sessões de {thread} há um dia ou mais. Ninguém foi avisado ainda.', // MT
    de: 'Du hast vor einem Tag oder länger {n} Sitzungen von {thread} geändert. Bisher wurde niemand informiert.', // MT
    fr: 'Vous avez modifié {n} séances de {thread} il y a un jour ou plus. Personne n’a encore été prévenu.', // MT
  },
  nu_more: {
    en: 'and {n} more',
    nl: 'en nog {n}', // MT
    es: 'y {n} más', // MT
    pt: 'e mais {n}', // MT
    de: 'und {n} weitere', // MT
    fr: 'et {n} de plus', // MT
  },
  nu_why: {
    en: 'Participants hear about a change only when you send it, so you can finish editing first.',
    nl: 'Deelnemers horen pas van een wijziging als jij die verstuurt, zodat je eerst kunt afronden.', // MT
    es: 'Los participantes solo se enteran de un cambio cuando lo envías, para que puedas terminar de editar antes.', // MT
    pt: 'Os participantes só ficam sabendo de uma alteração quando você a envia, para que possa terminar de editar antes.', // MT
    de: 'Teilnehmende erfahren von einer Änderung erst, wenn du sie sendest – so kannst du zuerst fertig bearbeiten.', // MT
    fr: 'Les participants n’apprennent une modification que lorsque vous l’envoyez, pour que vous puissiez d’abord terminer.', // MT
  },
  nu_button: {
    en: 'Review and send',
    nl: 'Bekijken en versturen', // MT
    es: 'Revisar y enviar', // MT
    pt: 'Revisar e enviar', // MT
    de: 'Prüfen und senden', // MT
    fr: 'Vérifier et envoyer', // MT
  },
  nu_once: {
    en: 'This is the only reminder about these changes.',
    nl: 'Dit is de enige herinnering over deze wijzigingen.', // MT
    es: 'Este es el único recordatorio sobre estos cambios.', // MT
    pt: 'Este é o único lembrete sobre estas alterações.', // MT
    de: 'Dies ist die einzige Erinnerung zu diesen Änderungen.', // MT
    fr: 'C’est le seul rappel concernant ces modifications.', // MT
  },
} satisfies Record<string, I18nEntry>;
const tn = makeT(NUDGE_CATALOG);

/** Up to five change titles are named; the rest are counted. */
export const NUDGE_TITLES_SHOWN = 5;

export function calendarNudgeEmail(c: {
  threadTitle: string;
  count: number;
  titles: string[];
  /** The thread in the Thread app, where the SEND button is. */
  url: string;
  locale?: string | null;
  brand?: EmailBrand;
}): { subject: string; text: string; html: string } {
  const loc = toLocale(c.locale);
  const subject = tn(loc, 'nu_subject', { thread: c.threadTitle });
  const lead = tn(loc, c.count === 1 ? 'nu_lead_one' : 'nu_lead_many', { n: c.count, thread: c.threadTitle });
  const shown = c.titles.slice(0, NUDGE_TITLES_SHOWN);
  const rest = c.titles.length - shown.length;
  const items = [...shown, ...(rest > 0 ? [tn(loc, 'nu_more', { n: rest })] : [])];
  const text = [
    lead,
    '',
    ...items.map((i) => `- ${i}`),
    '',
    tn(loc, 'nu_why'),
    '',
    `${tn(loc, 'nu_button')}: ${c.url}`,
    '',
    tn(loc, 'nu_once'),
  ].join('\n');
  const html = shell(
    c.threadTitle,
    `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(lead)}</p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6;">${items
        .map((i) => `<li>${escapeHtml(i)}</li>`)
        .join('')}</ul>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#525252;">${escapeHtml(tn(loc, 'nu_why'))}</p>
      <p style="margin:24px 0;">
        <a href="${escapeHtml(c.url)}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">${escapeHtml(tn(loc, 'nu_button'))}</a>
      </p>
      <p style="margin:0;font-size:13px;color:#737373;">${escapeHtml(tn(loc, 'nu_once'))}</p>
    `,
    c.brand,
  );
  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Cancellation requests (Sjoerd's 2iv, 2026-10-16) — three emails:
//   · the request, to the organiser and the thread's hosts, with the reason;
//   · the approval, to the participant ("€x refunded to your card" when so);
//   · the rejection, to the participant, with the organiser's note.
// A withdrawal sends nothing. Each in its reader's language.
// ---------------------------------------------------------------------------

const CANCEL_CATALOG = {
  cr_subject: {
    en: 'Cancellation request: {thread}',
    nl: 'Annuleringsverzoek: {thread}', // MT
    es: 'Solicitud de cancelación: {thread}', // MT
    pt: 'Pedido de cancelamento: {thread}', // MT
    de: 'Stornierungsanfrage: {thread}', // MT
    fr: 'Demande d’annulation : {thread}', // MT
  },
  cr_lead: {
    en: '{name} asks to cancel their place in {thread}.',
    nl: '{name} vraagt om hun plek in {thread} te annuleren.', // MT
    es: '{name} pide cancelar su plaza en {thread}.', // MT
    pt: '{name} pede para cancelar a sua vaga em {thread}.', // MT
    de: '{name} bittet darum, den Platz in {thread} zu stornieren.', // MT
    fr: '{name} demande à annuler sa place dans {thread}.', // MT
  },
  cr_reason: { en: 'Their reason:', nl: 'Hun reden:', es: 'Su motivo:', pt: 'O motivo:', de: 'Begründung:', fr: 'Sa raison :' }, // MT
  cr_no_reason: {
    en: 'They gave no reason.',
    nl: 'Er is geen reden opgegeven.', // MT
    es: 'No indicó ningún motivo.', // MT
    pt: 'Nenhum motivo foi indicado.', // MT
    de: 'Es wurde keine Begründung angegeben.', // MT
    fr: 'Aucune raison n’a été donnée.', // MT
  },
  cr_decide: {
    en: 'You decide: approve (their place is freed, with a refund to their card if you choose) or decline (they keep their place).',
    nl: 'Jij beslist: goedkeuren (hun plek komt vrij, met terugbetaling op hun kaart als je dat kiest) of afwijzen (ze houden hun plek).', // MT
    es: 'Tú decides: aprobar (se libera su plaza, con reembolso a su tarjeta si lo eliges) o rechazar (conserva su plaza).', // MT
    pt: 'Você decide: aprovar (a vaga é liberada, com reembolso no cartão se escolher) ou recusar (a pessoa mantém a vaga).', // MT
    de: 'Du entscheidest: annehmen (der Platz wird frei, auf Wunsch mit Erstattung auf die Karte) oder ablehnen (der Platz bleibt).', // MT
    fr: 'À vous de décider : accepter (la place est libérée, avec remboursement sur la carte si vous le souhaitez) ou refuser (la place est conservée).', // MT
  },
  cr_button: { en: 'Open the registrations', nl: 'Inschrijvingen openen', es: 'Abrir las inscripciones', pt: 'Abrir as inscrições', de: 'Anmeldungen öffnen', fr: 'Ouvrir les inscriptions' }, // MT
  ca_subject: {
    en: 'Your place in {thread} is cancelled',
    nl: 'Je plek in {thread} is geannuleerd', // MT
    es: 'Tu plaza en {thread} está cancelada', // MT
    pt: 'A sua vaga em {thread} foi cancelada', // MT
    de: 'Dein Platz in {thread} ist storniert', // MT
    fr: 'Votre place dans {thread} est annulée', // MT
  },
  ca_lead: {
    en: '{org} has approved your request to cancel your place in {thread}.',
    nl: '{org} heeft je verzoek goedgekeurd om je plek in {thread} te annuleren.', // MT
    es: '{org} ha aprobado tu solicitud de cancelar tu plaza en {thread}.', // MT
    pt: '{org} aprovou o seu pedido de cancelar a sua vaga em {thread}.', // MT
    de: '{org} hat deine Anfrage angenommen, deinen Platz in {thread} zu stornieren.', // MT
    fr: '{org} a accepté votre demande d’annuler votre place dans {thread}.', // MT
  },
  ca_refunded: {
    en: '{amount} has been refunded to your card. Depending on your bank it can take a few days to show.',
    nl: '{amount} is teruggestort op je kaart. Afhankelijk van je bank kan het een paar dagen duren voor je het ziet.', // MT
    es: 'Se han reembolsado {amount} a tu tarjeta. Según tu banco, puede tardar unos días en aparecer.', // MT
    pt: '{amount} foi reembolsado no seu cartão. Dependendo do banco, pode levar alguns dias para aparecer.', // MT
    de: '{amount} wurden auf deine Karte erstattet. Je nach Bank kann es ein paar Tage dauern, bis du es siehst.', // MT
    fr: '{amount} ont été remboursés sur votre carte. Selon votre banque, cela peut prendre quelques jours.', // MT
  },
  rj_subject: {
    en: 'About your cancellation request: {thread}',
    nl: 'Over je annuleringsverzoek: {thread}', // MT
    es: 'Sobre tu solicitud de cancelación: {thread}', // MT
    pt: 'Sobre o seu pedido de cancelamento: {thread}', // MT
    de: 'Zu deiner Stornierungsanfrage: {thread}', // MT
    fr: 'À propos de votre demande d’annulation : {thread}', // MT
  },
  rj_lead: {
    en: '{org} has not cancelled your place in {thread}. You keep your place.',
    nl: '{org} heeft je plek in {thread} niet geannuleerd. Je houdt je plek.', // MT
    es: '{org} no ha cancelado tu plaza en {thread}. Conservas tu plaza.', // MT
    pt: '{org} não cancelou a sua vaga em {thread}. Você mantém a vaga.', // MT
    de: '{org} hat deinen Platz in {thread} nicht storniert. Du behältst deinen Platz.', // MT
    fr: '{org} n’a pas annulé votre place dans {thread}. Vous conservez votre place.', // MT
  },
  rj_note: { en: 'Their note:', nl: 'Hun toelichting:', es: 'Su nota:', pt: 'A nota:', de: 'Anmerkung:', fr: 'Leur note :' }, // MT
  cx_portal: {
    en: 'Your personal page',
    nl: 'Je persoonlijke pagina', // MT
    es: 'Tu página personal', // MT
    pt: 'A sua página pessoal', // MT
    de: 'Deine persönliche Seite', // MT
    fr: 'Votre page personnelle', // MT
  },
} satisfies Record<string, I18nEntry>;
const tc = makeT(CANCEL_CATALOG);

const cxButton = (url: string, label: string) =>
  `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">${escapeHtml(label)}</a></p>`;
const cxQuote = (label: string, body: string) =>
  `<p style="margin:0 0 4px;font-size:14px;color:#525252;">${escapeHtml(label)}</p><div style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #e7e5e4;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(body)}</div>`;

/** To the organiser and the thread's hosts. */
export function cancellationRequestedEmail(c: {
  threadTitle: string;
  participantName: string;
  reason: string | null;
  /** The thread's registrations in the Thread app. */
  url: string;
  locale?: string | null;
  brand?: EmailBrand;
}): { subject: string; text: string; html: string } {
  const loc = toLocale(c.locale);
  const subject = tc(loc, 'cr_subject', { thread: c.threadTitle });
  const lead = tc(loc, 'cr_lead', { name: c.participantName, thread: c.threadTitle });
  const reason = c.reason?.trim() || null;
  const text = [
    lead,
    '',
    reason ? `${tc(loc, 'cr_reason')}\n${reason}` : tc(loc, 'cr_no_reason'),
    '',
    tc(loc, 'cr_decide'),
    '',
    `${tc(loc, 'cr_button')}: ${c.url}`,
  ].join('\n');
  const html = shell(
    c.threadTitle,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(lead)}</p>
     ${reason ? cxQuote(tc(loc, 'cr_reason'), reason) : `<p style="margin:0 0 16px;font-size:14px;color:#525252;">${escapeHtml(tc(loc, 'cr_no_reason'))}</p>`}
     <p style="margin:0;font-size:14px;line-height:1.6;color:#525252;">${escapeHtml(tc(loc, 'cr_decide'))}</p>
     ${cxButton(c.url, tc(loc, 'cr_button'))}`,
    c.brand,
  );
  return { subject, text, html };
}

/** To the participant, when the organiser approves. */
export function cancellationApprovedEmail(c: {
  threadTitle: string;
  organiserName: string;
  /** "€35.00", already formatted, when money went back to the card. */
  refundedLine: string | null;
  portalUrl: string;
  locale?: string | null;
  brand?: EmailBrand;
}): { subject: string; text: string; html: string } {
  const loc = toLocale(c.locale);
  const subject = tc(loc, 'ca_subject', { thread: c.threadTitle });
  const lead = tc(loc, 'ca_lead', { org: c.organiserName, thread: c.threadTitle });
  const refund = c.refundedLine ? tc(loc, 'ca_refunded', { amount: c.refundedLine }) : null;
  const text = [lead, ...(refund ? ['', refund] : []), '', `${tc(loc, 'cx_portal')}: ${c.portalUrl}`, '', `— ${c.organiserName}`].join('\n');
  const html = shell(
    c.threadTitle,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(lead)}</p>
     ${refund ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(refund)}</p>` : ''}
     ${cxButton(c.portalUrl, tc(loc, 'cx_portal'))}
     <p style="margin:0;font-size:14px;color:#525252;">— ${escapeHtml(c.organiserName)}</p>`,
    c.brand,
  );
  return { subject, text, html };
}

/** To the participant, when the organiser declines the request. */
export function cancellationRejectedEmail(c: {
  threadTitle: string;
  organiserName: string;
  note: string | null;
  portalUrl: string;
  locale?: string | null;
  brand?: EmailBrand;
}): { subject: string; text: string; html: string } {
  const loc = toLocale(c.locale);
  const subject = tc(loc, 'rj_subject', { thread: c.threadTitle });
  const lead = tc(loc, 'rj_lead', { org: c.organiserName, thread: c.threadTitle });
  const note = c.note?.trim() || null;
  const text = [lead, ...(note ? ['', `${tc(loc, 'rj_note')}\n${note}`] : []), '', `${tc(loc, 'cx_portal')}: ${c.portalUrl}`, '', `— ${c.organiserName}`].join('\n');
  const html = shell(
    c.threadTitle,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(lead)}</p>
     ${note ? cxQuote(tc(loc, 'rj_note'), note) : ''}
     ${cxButton(c.portalUrl, tc(loc, 'cx_portal'))}
     <p style="margin:0;font-size:14px;color:#525252;">— ${escapeHtml(c.organiserName)}</p>`,
    c.brand,
  );
  return { subject, text, html };
}
