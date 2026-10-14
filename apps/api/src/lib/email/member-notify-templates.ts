// The one email a member gets about their team calendars: what is new, and
// which sessions they can see moved or were cancelled — ALL of it since the
// last one, for one community, in one message (lib/member-notify.ts).
//
// Short on purpose. Each line is a date, a title and — for something new —
// the member's own price; one button to Upcoming; one line to stop these.
// The community's own brand, the 17px reading size of the membership mails
// (membership-templates.ts says why there is only one size).

import { INTL_LOCALES, makeT, toLocale, type I18nEntry, type Locale } from '@thefibre/shared';
import { shell, escapeHtml, type EmailBrand } from './templates.js';

export type DigestItem =
  | {
      kind: 'new_thread';
      title: string;
      startsAt: string | null;
      /** What THIS member pays, from the walk that charges them; null when
       *  it could not be worked out (the line then shows no price). */
      yourPriceCents: number | null;
      listPriceCents: number | null;
      currency: string;
    }
  | { kind: 'session_moved' | 'session_cancelled'; title: string; startsAt: string | null };

const CATALOG = {
  // "{community}: …" and never "the {community} calendar": a community
  // called "The Thread" made "New on the The Thread calendar" (found
  // rendering with a real staging brand, 2026-10-14).
  n_subject: {
    en: '{community}: new on the calendar',
    nl: '{community}: nieuw in de agenda', // MT
    es: '{community}: novedades en el calendario', // MT
    pt: '{community}: novidades no calendário', // MT
    de: '{community}: neu im Kalender', // MT
    fr: '{community} : nouveau dans l’agenda', // MT
  },
  n_subject_changes: {
    en: '{community}: changes on the calendar',
    nl: '{community}: wijzigingen in de agenda', // MT
    es: '{community}: cambios en el calendario', // MT
    pt: '{community}: mudanças no calendário', // MT
    de: '{community}: Änderungen im Kalender', // MT
    fr: '{community} : changements dans l’agenda', // MT
  },
  n_hi: {
    en: 'Hi {name},',
    nl: 'Hoi {name},', // MT
    es: 'Hola {name}:', // MT
    pt: 'Olá {name},', // MT
    de: 'Hallo {name},', // MT
    fr: 'Bonjour {name},', // MT
  },
  n_new_heading: {
    en: 'New',
    nl: 'Nieuw', // MT
    es: 'Nuevo', // MT
    pt: 'Novo', // MT
    de: 'Neu', // MT
    fr: 'Nouveau', // MT
  },
  n_changed_heading: {
    en: 'Changed',
    nl: 'Gewijzigd', // MT
    es: 'Cambios', // MT
    pt: 'Alterado', // MT
    de: 'Geändert', // MT
    fr: 'Modifié', // MT
  },
  n_included: {
    en: 'included in your membership',
    nl: 'inbegrepen in je lidmaatschap', // MT
    es: 'incluido en tu membresía', // MT
    pt: 'incluído na sua assinatura', // MT
    de: 'in deiner Mitgliedschaft enthalten', // MT
    fr: 'inclus dans ton adhésion', // MT
  },
  n_price_instead: {
    en: '{price} instead of {list}',
    nl: '{price} in plaats van {list}', // MT
    es: '{price} en lugar de {list}', // MT
    pt: '{price} em vez de {list}', // MT
    de: '{price} statt {list}', // MT
    fr: '{price} au lieu de {list}', // MT
  },
  n_moved: {
    en: 'now {when}',
    nl: 'nu {when}', // MT
    es: 'ahora {when}', // MT
    pt: 'agora {when}', // MT
    de: 'jetzt {when}', // MT
    fr: 'désormais {when}', // MT
  },
  n_cancelled: {
    en: 'cancelled',
    nl: 'geannuleerd', // MT
    es: 'cancelado', // MT
    pt: 'cancelado', // MT
    de: 'abgesagt', // MT
    fr: 'annulé', // MT
  },
  n_button: {
    en: 'See what’s coming up',
    nl: 'Bekijk wat eraan komt', // MT
    es: 'Ver lo que viene', // MT
    pt: 'Ver o que vem aí', // MT
    de: 'Sieh dir an, was kommt', // MT
    fr: 'Voir ce qui arrive', // MT
  },
  n_why: {
    en: 'You get this because your membership of {community} includes its calendar.',
    nl: 'Je krijgt dit omdat je lidmaatschap van {community} de agenda omvat.', // MT
    es: 'Recibes esto porque tu membresía de {community} incluye su calendario.', // MT
    pt: 'Você recebe isto porque sua assinatura de {community} inclui o calendário.', // MT
    de: 'Du bekommst das, weil deine Mitgliedschaft bei {community} den Kalender umfasst.', // MT
    fr: 'Tu reçois ceci car ton adhésion à {community} inclut son agenda.', // MT
  },
  n_stop: {
    en: 'Stop these emails',
    nl: 'Stop deze e-mails', // MT
    es: 'Dejar de recibir estos correos', // MT
    pt: 'Parar estes e-mails', // MT
    de: 'Diese E-Mails abbestellen', // MT
    fr: 'Ne plus recevoir ces e-mails', // MT
  },
} satisfies Record<string, I18nEntry>;

const t = makeT(CATALOG);

const TEXT_SIZE = '17px';
const BODY = `font-size:${TEXT_SIZE};line-height:1.55;`;
const MUTED = `font-size:${TEXT_SIZE};line-height:1.55;color:#525252;`;
const LABEL = 'font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#737373;margin:28px 0 8px;';

function money(cents: number, currency: string, loc: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALES[loc], { style: 'currency', currency }).format(cents / 100);
}

/** A date, and the time when the item has one (a session does; a thread's
 *  start is a day). */
function when(iso: string | null, loc: Locale, withTime: boolean): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return d.toLocaleString(INTL_LOCALES[loc], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' } : { timeZone: 'UTC' }),
  });
}

function priceLine(i: Extract<DigestItem, { kind: 'new_thread' }>, loc: Locale): string {
  if (i.yourPriceCents === null) return '';
  if (i.yourPriceCents === 0) return t(loc, 'n_included');
  const price = money(i.yourPriceCents, i.currency, loc);
  if (i.listPriceCents !== null && i.listPriceCents > i.yourPriceCents) {
    return t(loc, 'n_price_instead', { price, list: money(i.listPriceCents, i.currency, loc) });
  }
  return price;
}

export function memberNotifyDigest(opts: {
  name: string;
  communityName: string;
  items: DigestItem[];
  upcomingUrl: string;
  unsubscribeUrl: string;
  locale?: string | null;
  brand?: EmailBrand;
}): { subject: string; html: string; text: string } {
  const loc = toLocale(opts.locale);
  const fresh = opts.items.filter((i): i is Extract<DigestItem, { kind: 'new_thread' }> => i.kind === 'new_thread');
  const changed = opts.items.filter((i) => i.kind !== 'new_thread');
  const subject = t(loc, fresh.length ? 'n_subject' : 'n_subject_changes', { community: opts.communityName });

  const freshLines = fresh.map((i) => {
    const date = when(i.startsAt, loc, false);
    const price = priceLine(i, loc);
    return { title: i.title, meta: [date, price].filter(Boolean).join(' · ') };
  });
  const changedLines = changed.map((i) => ({
    title: i.title,
    meta:
      i.kind === 'session_cancelled'
        ? [when(i.startsAt, loc, true), t(loc, 'n_cancelled')].filter(Boolean).join(' · ')
        : t(loc, 'n_moved', { when: when(i.startsAt, loc, true) }),
  }));

  const list = (lines: { title: string; meta: string }[]) =>
    lines
      .map(
        (l) =>
          `<p style="margin:0 0 12px;${BODY}"><strong>${escapeHtml(l.title)}</strong>${
            l.meta ? `<br /><span style="${MUTED}">${escapeHtml(l.meta)}</span>` : ''
          }</p>`,
      )
      .join('');

  const body = `
    <div style="${BODY}">
      <p style="margin:0 0 18px;${BODY}">${escapeHtml(t(loc, 'n_hi', { name: opts.name }))}</p>
      ${freshLines.length ? `<div style="${LABEL}">${escapeHtml(t(loc, 'n_new_heading'))}</div>${list(freshLines)}` : ''}
      ${changedLines.length ? `<div style="${LABEL}">${escapeHtml(t(loc, 'n_changed_heading'))}</div>${list(changedLines)}` : ''}
      <p style="margin:28px 0;text-align:center;">
        <a href="${escapeHtml(opts.upcomingUrl)}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;font-size:${TEXT_SIZE};font-weight:500;padding:12px 24px;border-radius:8px;">${escapeHtml(t(loc, 'n_button'))}</a>
      </p>
      <p style="margin:0;${MUTED}">${escapeHtml(t(loc, 'n_why', { community: opts.communityName }))}
        <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#525252;">${escapeHtml(t(loc, 'n_stop'))}</a>.</p>
    </div>`;

  const textLines = (heading: string, lines: { title: string; meta: string }[]) =>
    lines.length ? [heading.toUpperCase(), ...lines.map((l) => `- ${l.title}${l.meta ? ` — ${l.meta}` : ''}`), ''] : [];
  const text = [
    t(loc, 'n_hi', { name: opts.name }),
    '',
    ...textLines(t(loc, 'n_new_heading'), freshLines),
    ...textLines(t(loc, 'n_changed_heading'), changedLines),
    `${t(loc, 'n_button')}: ${opts.upcomingUrl}`,
    '',
    t(loc, 'n_why', { community: opts.communityName }),
    `${t(loc, 'n_stop')}: ${opts.unsubscribeUrl}`,
  ].join('\n');

  return {
    subject,
    html: shell(subject, body, opts.brand),
    text,
  };
}
