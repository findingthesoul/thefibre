// THE one list of tags people can type into text that is filled per person —
// thread messages, the member page — and the one function that fills them.
//
// Sjoerd, 2026-10-16: "Make one consistent list from now on. Add a few like
// facilitator and host." There were two vocabularies: thread messages had
// {name} {thread} {organiser} {date} {start_date} {my.thread}
// (apps/api/src/lib/message-tokens.ts), the member page had {first_name}
// {last_name} {community} {tier} {next_event} (./member-page.ts). Each kept
// its own list and its own substituter, so a tag worked in one place and was
// printed literally in the other.
//
// Every surface now reads THIS registry: which tags it offers (the chips),
// and which it fills. A test asserts each surface's filler fills exactly the
// tags assigned to it here, so the offer and the filling cannot drift apart.
//
// The old spellings stay as ALIASES — {name} → {first_name}, {start_date} →
// {date}, {thread_title} → {thread} — so every message already written keeps
// working.
//
// ONE RULE for filling, everywhere: an unknown tag (or one not valid on this
// surface) is left as typed, so the writer sees the typo; a known tag with no
// value becomes empty, never the literal tag; and on an HTML surface every
// value is HTML-escaped, after the text was sanitised, so a name can never
// inject markup.

import type { Locale } from './i18n.js';

export type TokenSurface = 'thread_message' | 'member_page' | 'member_email';

export type MergeToken = {
  /** As typed, without braces: `first_name` → {first_name}. */
  key: string;
  /** Older spellings that fill the same value. */
  aliases: readonly string[];
  surfaces: readonly TokenSurface[];
  /** For the chip's tooltip and the help. */
  description: Record<Locale, string>;
  /** What it might become, for the help. */
  example: string;
};

const both: readonly TokenSurface[] = ['thread_message', 'member_page'];
const msg: readonly TokenSurface[] = ['thread_message'];
const page: readonly TokenSurface[] = ['member_page'];
// A community's own words in its member emails (Members → Settings → Emails,
// 2026-10-16): the person, the community, the tier, the renewal and the link.
const everywhere: readonly TokenSurface[] = ['thread_message', 'member_page', 'member_email'];
const pageAndEmail: readonly TokenSurface[] = ['member_page', 'member_email'];
const email: readonly TokenSurface[] = ['member_email'];

export const MERGE_TOKENS: readonly MergeToken[] = [
  {
    key: 'first_name',
    aliases: ['name'],
    surfaces: everywhere,
    example: 'Marja',
    description: { en: 'Their first name', nl: 'Hun voornaam', es: 'Su nombre', pt: 'O primeiro nome', de: 'Vorname', fr: 'Son prénom' },
  },
  {
    key: 'last_name',
    aliases: [],
    surfaces: everywhere,
    example: 'de Vries',
    description: { en: 'Their last name', nl: 'Hun achternaam', es: 'Su apellido', pt: 'O apelido', de: 'Nachname', fr: 'Son nom de famille' },
  },
  {
    key: 'full_name',
    aliases: [],
    surfaces: everywhere,
    example: 'Marja de Vries',
    description: { en: 'Their full name', nl: 'Hun volledige naam', es: 'Su nombre completo', pt: 'O nome completo', de: 'Vollständiger Name', fr: 'Son nom complet' },
  },
  {
    key: 'community',
    aliases: [],
    surfaces: everywhere,
    example: 'soul.com',
    description: { en: 'The community’s name', nl: 'De naam van de community', es: 'El nombre de la comunidad', pt: 'O nome da comunidade', de: 'Name der Community', fr: 'Le nom de la communauté' },
  },
  {
    key: 'thread',
    aliases: ['thread_title'],
    surfaces: msg,
    example: 'Leadership weekend',
    description: { en: 'The thread’s title', nl: 'De titel van de thread', es: 'El título del hilo', pt: 'O título do fio', de: 'Titel des Threads', fr: 'Le titre du fil' },
  },
  {
    key: 'organiser',
    aliases: [],
    surfaces: msg,
    example: 'Sjoerd',
    description: { en: 'Who organises the thread', nl: 'Wie de thread organiseert', es: 'Quién organiza el hilo', pt: 'Quem organiza o fio', de: 'Wer den Thread organisiert', fr: 'Qui organise le fil' },
  },
  {
    key: 'facilitator',
    aliases: [],
    surfaces: msg,
    example: 'Anna',
    description: { en: 'The main facilitator (else the organiser)', nl: 'De hoofdbegeleider (anders de organisator)', es: 'El facilitador principal (si no, quien organiza)', pt: 'O facilitador principal (senão, quem organiza)', de: 'Die Hauptmoderation (sonst die Organisation)', fr: 'L’animateur principal (sinon l’organisateur)' },
  },
  {
    key: 'hosts',
    aliases: [],
    surfaces: msg,
    example: 'Anna and Peter',
    description: { en: 'The thread’s hosts and facilitators', nl: 'De hosts en begeleiders van de thread', es: 'Los anfitriones y facilitadores del hilo', pt: 'Os anfitriões e facilitadores do fio', de: 'Gastgebende und Moderierende des Threads', fr: 'Les hôtes et animateurs du fil' },
  },
  {
    key: 'date',
    aliases: ['start_date'],
    surfaces: msg,
    example: '4 November 2026',
    description: { en: 'The thread’s start date', nl: 'De startdatum van de thread', es: 'La fecha de inicio del hilo', pt: 'A data de início do fio', de: 'Startdatum des Threads', fr: 'La date de début du fil' },
  },
  // The thread's dates in their different forms (Sjoerd, 2026-10-16: "create
  // tags for different forms"). Values from ./thread-dates — {date} stays the
  // thread start, so messages already written keep their meaning.
  {
    key: 'thread_dates',
    aliases: [],
    surfaces: msg,
    example: '1 September 2026 – 30 June 2027',
    description: { en: 'The thread’s period, start to end', nl: 'De periode van de thread, van begin tot eind', es: 'El periodo del hilo, de principio a fin', pt: 'O período do fio, do início ao fim', de: 'Zeitraum des Threads, Anfang bis Ende', fr: 'La période du fil, du début à la fin' },
  },
  {
    key: 'thread_start',
    aliases: [],
    surfaces: msg,
    example: '1 September 2026',
    description: { en: 'The thread’s start date', nl: 'De startdatum van de thread', es: 'La fecha de inicio del hilo', pt: 'A data de início do fio', de: 'Startdatum des Threads', fr: 'La date de début du fil' },
  },
  {
    key: 'event_dates',
    aliases: [],
    surfaces: msg,
    example: '12 January – 15 June 2027',
    description: { en: 'The event dates, from the key moments', nl: 'De eventdata, uit de kernmomenten', es: 'Las fechas del evento, de los momentos clave', pt: 'As datas do evento, dos momentos-chave', de: 'Die Veranstaltungsdaten, aus den Schlüsselmomenten', fr: 'Les dates de l’événement, d’après les moments clés' },
  },
  {
    key: 'first_event',
    aliases: [],
    surfaces: msg,
    example: '12 January 2027',
    description: { en: 'The first key moment’s date', nl: 'De datum van het eerste kernmoment', es: 'La fecha del primer momento clave', pt: 'A data do primeiro momento-chave', de: 'Datum des ersten Schlüsselmoments', fr: 'La date du premier moment clé' },
  },
  {
    key: 'sessions',
    aliases: [],
    surfaces: msg,
    example: '6',
    description: { en: 'How many key moments', nl: 'Hoeveel kernmomenten', es: 'Cuántos momentos clave', pt: 'Quantos momentos-chave', de: 'Wie viele Schlüsselmomente', fr: 'Combien de moments clés' },
  },
  {
    key: 'signups_close',
    aliases: [],
    surfaces: msg,
    example: '11 January 2027',
    description: { en: 'When sign-ups close', nl: 'Wanneer de inschrijving sluit', es: 'Cuándo se cierran las inscripciones', pt: 'Quando fecham as inscrições', de: 'Wann die Anmeldung schließt', fr: 'Quand les inscriptions ferment' },
  },
  {
    key: 'my.thread',
    aliases: [],
    surfaces: everywhere,
    example: 'https://my.thethread.app',
    description: { en: 'A link to their own page', nl: 'Een link naar hun eigen pagina', es: 'Un enlace a su propia página', pt: 'Uma ligação à própria página', de: 'Ein Link zur eigenen Seite', fr: 'Un lien vers sa propre page' },
  },
  {
    key: 'tier',
    aliases: [],
    surfaces: pageAndEmail,
    example: 'Singer',
    description: { en: 'Their membership tier', nl: 'Hun lidmaatschapsniveau', es: 'Su nivel de membresía', pt: 'O nível de adesão', de: 'Mitgliedschaftsstufe', fr: 'Son niveau d’adhésion' },
  },
  {
    key: 'next_event',
    aliases: [],
    surfaces: page,
    example: 'Open rehearsal',
    description: { en: 'What is next for them', nl: 'Wat er voor hen hierna komt', es: 'Lo próximo para esa persona', pt: 'O que vem a seguir', de: 'Was als Nächstes ansteht', fr: 'Ce qui vient ensuite pour cette personne' },
  },
  {
    key: 'renews_on',
    aliases: [],
    surfaces: email,
    example: '1 January 2027',
    description: { en: 'When their membership renews', nl: 'Wanneer hun lidmaatschap verlengt', es: 'Cuándo se renueva su membresía', pt: 'Quando a adesão é renovada', de: 'Wann die Mitgliedschaft verlängert wird', fr: 'Quand son adhésion est renouvelée' },
  },
];

/** The tags a surface offers and fills, canonical keys. */
export function tokensFor(surface: TokenSurface): string[] {
  return MERGE_TOKENS.filter((t) => t.surfaces.includes(surface)).map((t) => t.key);
}

/** The chips to show on a surface: `{first_name}`, … */
export function tokenChips(surface: TokenSurface): string[] {
  return tokensFor(surface).map((k) => `{${k}}`);
}

/** Alias or canonical → canonical, for one surface; null when not valid there. */
function canonical(raw: string, surface: TokenSurface): string | null {
  for (const t of MERGE_TOKENS) {
    if (!t.surfaces.includes(surface)) continue;
    if (t.key === raw || t.aliases.includes(raw)) return t.key;
  }
  return null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Fill the tags of one surface. `values` is keyed by CANONICAL key.
 * `html: true` escapes every value (an HTML surface, already sanitised);
 * `html: false` leaves values as text (a plain-text surface that escapes the
 * whole result itself afterwards, as the thread-message email does).
 */
export function fillTokens(
  text: string,
  values: Partial<Record<string, string | null | undefined>>,
  surface: TokenSurface,
  opts: { html: boolean },
): string {
  return text.replace(/\{([a-z_]+(?:\.[a-z_]+)?)\}/g, (whole, raw: string) => {
    const key = canonical(raw, surface);
    if (!key) return whole;
    const v = (values[key] ?? '').trim();
    return opts.html ? escapeHtml(v) : v;
  });
}

/** Names as a list in the reader's language: "Anna", "Anna and Peter",
 *  "Anna, Peter and Joost". Empty for none. */
export function listOfNames(names: readonly string[], locale: string): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (!clean.length) return '';
  try {
    return new Intl.ListFormat(locale, { type: 'conjunction' }).format(clean);
  } catch {
    return clean.join(', ');
  }
}
