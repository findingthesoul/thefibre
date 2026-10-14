// Membership lifecycle emails, in the member's language (i18n P1 — the
// Thread's typed-catalog pattern; a key missing a locale fails typecheck).
// All of them render inside the shared shell with the WORKSPACE's brand — a
// membership email is from the community, not from The Fibre.
//
// Machine-drafted non-EN lines carry `// MT` pending native review
// (nl reviewed by Sjoerd pre-ship, unmarked).

import { INTL_LOCALES, makeT, toLocale, type I18nEntry, type Locale } from '@thefibre/shared';
import { shell, escapeHtml } from './templates.js';
import type { EmailBrand } from './templates.js';

const CATALOG = {
  m_hi: {
    en: 'Hi {name},',
    nl: 'Hoi {name},',
    es: 'Hola {name}:', // MT
    pt: 'Olá {name},', // MT
    de: 'Hallo {name},', // MT
    fr: 'Bonjour {name},', // MT
  },
  // ── THE WELCOME, written out (2026-10-14) ────────────────────────────────
  //
  // It was three thin lines: hello, your membership is active, and a vague
  // sentence about invitations arriving from each space. The first thing a new
  // member receives from a community should sound like a person wrote it, and
  // should tell them where to go.
  //
  // Sjoerd asked for "super inviting". What makes it inviting is not
  // adjectives: it is that the community's OWN words appear (the tier's
  // description and its characteristics, which is the text they wrote on the
  // join card), and that the one thing the member can act on — their portal —
  // is a button and not a paragraph.
  //
  // Later this becomes editable per tier, with styles and an image. These
  // strings are the default it starts from.
  m_welcome_greeting: {
    en: 'Welcome to {community}, {name}.',
    nl: 'Welkom bij {community}, {name}.',
    es: 'Bienvenido a {community}, {name}.', // MT
    pt: 'Boas-vindas a {community}, {name}.', // MT
    de: 'Willkommen bei {community}, {name}.', // MT
    fr: 'Bienvenue chez {community}, {name}.', // MT
  },
  m_welcome_opening: {
    en: 'Your membership is active, and we are glad you are here.',
    nl: 'Je lidmaatschap is actief, en we zijn blij dat je er bent.',
    es: 'Tu membres\u00eda est\u00e1 activa y nos alegra que est\u00e9s aqu\u00ed.', // MT
    pt: 'A tua ades\u00e3o est\u00e1 ativa e ficamos felizes por te ter aqui.', // MT
    de: 'Deine Mitgliedschaft ist aktiv, und wir freuen uns, dass du da bist.', // MT
    fr: 'Ton adh\u00e9sion est active, et nous sommes heureux de t\u2019accueillir.', // MT
  },
  m_welcome_community_heading: {
    en: 'What you have joined',
    nl: 'Waar je lid van bent geworden',
    es: 'A qu\u00e9 te has unido', // MT
    pt: 'Aquilo a que ades\u00edste', // MT
    de: 'Dem du beigetreten bist', // MT
    fr: 'Ce que tu as rejoint', // MT
  },
  // The fallback, for a tier whose description the community has not written.
  // Deliberately plain rather than enthusiastic on their behalf: inventing
  // warmth about somebody else's community is worse than saying the fact.
  m_welcome_community_generic: {
    en: 'Your membership of {community}: {tier}.',
    nl: 'Je lidmaatschap van {community}: {tier}.',
    es: 'Tu membres\u00eda de {community}: {tier}.', // MT
    pt: 'A tua ades\u00e3o a {community}: {tier}.', // MT
    de: 'Deine Mitgliedschaft bei {community}: {tier}.', // MT
    fr: 'Ton adh\u00e9sion \u00e0 {community}\u00a0: {tier}.', // MT
  },
  m_welcome_expect_heading: {
    en: 'What your membership includes',
    nl: 'Wat je lidmaatschap bevat',
    es: 'Qu\u00e9 incluye tu membres\u00eda', // MT
    pt: 'O que inclui a tua ades\u00e3o', // MT
    de: 'Was deine Mitgliedschaft umfasst', // MT
    fr: 'Ce que comprend ton adh\u00e9sion', // MT
  },
  m_welcome_calendar: {
    en: 'Your membership includes {team}\u2019s calendar. You will find what you can join in my.thread.',
    nl: 'Je lidmaatschap bevat de agenda van {team}. In my.thread zie je waar je aan mee kunt doen.',
    es: 'Tu membres\u00eda incluye el calendario de {team}. En my.thread ver\u00e1s a qu\u00e9 puedes apuntarte.', // MT
    pt: 'A tua ades\u00e3o inclui o calend\u00e1rio de {team}. No my.thread ver\u00e1s onde podes participar.', // MT
    de: 'Deine Mitgliedschaft umfasst den Kalender von {team}. In my.thread siehst du, woran du teilnehmen kannst.', // MT
    fr: 'Ton adh\u00e9sion comprend le calendrier de {team}. Dans my.thread, tu verras \u00e0 quoi tu peux participer.', // MT
  },
  m_welcome_portal_heading: {
    en: 'Your own page',
    nl: 'Je eigen pagina',
    es: 'Tu propia p\u00e1gina', // MT
    pt: 'A tua pr\u00f3pria p\u00e1gina', // MT
    de: 'Deine eigene Seite', // MT
    fr: 'Ta page personnelle', // MT
  },
  m_welcome_portal_cta: {
    en: 'Open my.thread',
    nl: 'Open my.thread',
    es: 'Abrir my.thread', // MT
    pt: 'Abrir my.thread', // MT
    de: 'my.thread \u00f6ffnen', // MT
    fr: 'Ouvrir my.thread', // MT
  },
  m_welcome_portal_intro: {
    en: 'Everything about your membership lives there:',
    nl: 'Alles over je lidmaatschap staat daar:',
    es: 'Todo sobre tu membres\u00eda est\u00e1 ah\u00ed:', // MT
    pt: 'Tudo sobre a tua ades\u00e3o est\u00e1 l\u00e1:', // MT
    de: 'Alles zu deiner Mitgliedschaft findest du dort:', // MT
    fr: 'Tout ce qui concerne ton adh\u00e9sion s\u2019y trouve\u00a0:', // MT
  },
  m_welcome_portal_memberships: {
    en: 'Memberships \u2014 what is included, and what you can join',
    nl: 'Lidmaatschappen \u2014 wat erbij hoort, en waar je aan mee kunt doen',
    es: 'Membres\u00edas \u2014 qu\u00e9 est\u00e1 incluido y a qu\u00e9 puedes apuntarte', // MT
    pt: 'Ades\u00f5es \u2014 o que est\u00e1 inclu\u00eddo e onde podes participar', // MT
    de: 'Mitgliedschaften \u2014 was dazugeh\u00f6rt und woran du teilnehmen kannst', // MT
    fr: 'Adh\u00e9sions \u2014 ce qui est inclus et \u00e0 quoi tu peux participer', // MT
  },
  m_welcome_portal_purchases: {
    en: 'Purchases \u2014 every invoice, to download whenever you need it',
    nl: 'Aankopen \u2014 elke factuur, te downloaden wanneer je wilt',
    es: 'Compras \u2014 cada factura, para descargar cuando la necesites', // MT
    pt: 'Compras \u2014 cada fatura, para descarregar quando precisares', // MT
    de: 'Eink\u00e4ufe \u2014 jede Rechnung, jederzeit zum Herunterladen', // MT
    fr: 'Achats \u2014 chaque facture, \u00e0 t\u00e9l\u00e9charger quand tu veux', // MT
  },
  m_welcome_portal_members: {
    en: 'Members \u2014 the member list, and whether you appear in it',
    nl: 'Leden \u2014 de ledenlijst, en of je erin staat',
    es: 'Miembros \u2014 la lista de miembros y si apareces en ella', // MT
    pt: 'Membros \u2014 a lista de membros e se apareces nela', // MT
    de: 'Mitglieder \u2014 die Mitgliederliste und ob du darin erscheinst', // MT
    fr: 'Membres \u2014 la liste des membres, et si tu y figures', // MT
  },
  m_welcome_portal_you: {
    en: 'You \u2014 your details and your calendar subscription',
    nl: 'Jij \u2014 je gegevens en je agenda-abonnement',
    es: 'T\u00fa \u2014 tus datos y tu suscripci\u00f3n al calendario', // MT
    pt: 'Tu \u2014 os teus dados e a tua subscri\u00e7\u00e3o do calend\u00e1rio', // MT
    de: 'Du \u2014 deine Angaben und dein Kalender-Abo', // MT
    fr: 'Toi \u2014 tes informations et ton abonnement au calendrier', // MT
  },
  m_welcome_portal_signin: {
    en: 'Sign in with {email} and we will email you a code \u2014 there is no password to remember.',
    nl: 'Meld je aan met {email}; we mailen je een code \u2014 je hoeft geen wachtwoord te onthouden.',
    es: 'Inicia sesi\u00f3n con {email} y te enviaremos un c\u00f3digo por correo: no hay contrase\u00f1a que recordar.', // MT
    pt: 'Entra com {email} e enviamos-te um c\u00f3digo por email \u2014 n\u00e3o h\u00e1 palavra-passe para memorizar.', // MT
    de: 'Melde dich mit {email} an, wir senden dir einen Code per E-Mail \u2014 kein Passwort zu merken.', // MT
    fr: 'Connecte-toi avec {email} et nous t\u2019enverrons un code par e-mail : aucun mot de passe \u00e0 retenir.', // MT
  },
  m_welcome_invoice_follows: {
    en: 'Your invoice arrives in a separate email.',
    nl: 'Je factuur komt in een aparte e-mail.',
    es: 'Tu factura llegar\u00e1 en un correo aparte.', // MT
    pt: 'A tua fatura chega num email separado.', // MT
    de: 'Deine Rechnung kommt in einer separaten E-Mail.', // MT
    fr: 'Ta facture arrive dans un e-mail s\u00e9par\u00e9.', // MT
  },
  m_welcome_signoff: {
    en: 'Warmly,\nthe {community} team',
    nl: 'Hartelijke groet,\nhet team van {community}',
    es: 'Un cordial saludo,\nel equipo de {community}', // MT
    pt: 'Com os melhores cumprimentos,\na equipa de {community}', // MT
    de: 'Herzliche Gr\u00fc\u00dfe,\ndas Team von {community}', // MT
    fr: 'Chaleureusement,\nl\u2019\u00e9quipe de {community}', // MT
  },
  m_welcome_subject: {
    en: 'Welcome to {community}',
    nl: 'Welkom bij {community}',
    es: 'Te damos la bienvenida a {community}', // MT
    pt: 'Boas-vindas a {community}', // MT
    de: 'Willkommen bei {community}', // MT
    fr: 'Bienvenue chez {community}', // MT
  },
  m_welcome_active: {
    en: 'Your {tier} membership of {community} is active. {renews}',
    nl: 'Je {tier}-lidmaatschap van {community} is actief. {renews}',
    es: 'Tu membresía {tier} de {community} está activa. {renews}', // MT
    pt: 'Sua associação {tier} de {community} está ativa. {renews}', // MT
    de: 'Deine {tier}-Mitgliedschaft bei {community} ist aktiv. {renews}', // MT
    fr: 'Ton adhésion {tier} à {community} est active. {renews}', // MT
  },
  m_welcome_renews: {
    en: 'Your membership renews on {date}.',
    nl: 'Je lidmaatschap wordt verlengd op {date}.',
    es: 'Tu membresía se renueva el {date}.', // MT
    pt: 'Sua associação será renovada em {date}.', // MT
    de: 'Deine Mitgliedschaft verlängert sich am {date}.', // MT
    fr: 'Ton adhésion sera renouvelée le {date}.', // MT
  },
  m_welcome_spaces: {
    en: "You'll receive access to your member spaces shortly — invitations arrive by email from each space.",
    nl: 'Je krijgt binnenkort toegang tot je ledenomgevingen — de uitnodigingen komen per e-mail vanuit elke omgeving.',
    es: 'En breve recibirás acceso a tus espacios de miembro — las invitaciones llegan por correo desde cada espacio.', // MT
    pt: 'Em breve você receberá acesso aos seus espaços de membro — os convites chegam por e-mail de cada espaço.', // MT
    de: 'Du erhältst in Kürze Zugang zu deinen Mitgliederbereichen — die Einladungen kommen per E-Mail aus jedem Bereich.', // MT
    fr: 'Tu recevras bientôt l’accès à tes espaces membres — les invitations arrivent par e-mail depuis chaque espace.', // MT
  },
  m_renew_subject: {
    en: 'Your {community} membership renews on {date}',
    nl: 'Je lidmaatschap van {community} wordt verlengd op {date}',
    es: 'Tu membresía de {community} se renueva el {date}', // MT
    pt: 'Sua associação de {community} será renovada em {date}', // MT
    de: 'Deine Mitgliedschaft bei {community} verlängert sich am {date}', // MT
    fr: 'Ton adhésion à {community} sera renouvelée le {date}', // MT
  },
  m_renew_line: {
    en: 'A quick heads-up: your {tier} membership of {community} renews on {date}{amount}.',
    nl: 'Even een seintje: je {tier}-lidmaatschap van {community} wordt op {date} verlengd{amount}.',
    es: 'Un aviso rápido: tu membresía {tier} de {community} se renueva el {date}{amount}.', // MT
    pt: 'Um aviso rápido: sua associação {tier} de {community} será renovada em {date}{amount}.', // MT
    de: 'Kurzer Hinweis: Deine {tier}-Mitgliedschaft bei {community} verlängert sich am {date}{amount}.', // MT
    fr: 'Petit rappel : ton adhésion {tier} à {community} sera renouvelée le {date}{amount}.', // MT
  },
  m_renew_nothing: {
    en: "Nothing to do if you'd like to continue — the renewal happens automatically. To make changes, reply to this email.",
    nl: 'Je hoeft niets te doen als je wilt doorgaan — de verlenging gebeurt automatisch. Wil je iets wijzigen, antwoord dan op deze e-mail.',
    es: 'No tienes que hacer nada si quieres continuar — la renovación es automática. Para hacer cambios, responde a este correo.', // MT
    pt: 'Você não precisa fazer nada se quiser continuar — a renovação é automática. Para fazer alterações, responda a este e-mail.', // MT
    de: 'Wenn du dabeibleiben möchtest, musst du nichts tun — die Verlängerung passiert automatisch. Für Änderungen antworte einfach auf diese E-Mail.', // MT
    fr: 'Rien à faire si tu souhaites continuer — le renouvellement est automatique. Pour un changement, réponds simplement à cet e-mail.', // MT
  },
  m_failed_subject: {
    en: 'Payment issue with your {community} membership',
    nl: 'Betaalprobleem met je lidmaatschap van {community}',
    es: 'Problema de pago con tu membresía de {community}', // MT
    pt: 'Problema de pagamento com sua associação de {community}', // MT
    de: 'Zahlungsproblem bei deiner Mitgliedschaft bei {community}', // MT
    fr: 'Problème de paiement pour ton adhésion à {community}', // MT
  },
  m_failed_line: {
    en: "The renewal payment for your {tier} membership of {community} didn't go through. Your membership stays active for now while the payment is retried.",
    nl: 'De verlengingsbetaling voor je {tier}-lidmaatschap van {community} is niet gelukt. Je lidmaatschap blijft voorlopig actief terwijl de betaling opnieuw wordt geprobeerd.',
    es: 'El pago de renovación de tu membresía {tier} de {community} no se ha completado. Tu membresía sigue activa por ahora mientras se reintenta el pago.', // MT
    pt: 'O pagamento de renovação da sua associação {tier} de {community} não foi concluído. Sua associação continua ativa por enquanto, enquanto o pagamento é tentado novamente.', // MT
    de: 'Die Verlängerungszahlung für deine {tier}-Mitgliedschaft bei {community} ist fehlgeschlagen. Deine Mitgliedschaft bleibt vorerst aktiv, während die Zahlung erneut versucht wird.', // MT
    fr: 'Le paiement de renouvellement de ton adhésion {tier} à {community} n’a pas abouti. Ton adhésion reste active pour l’instant pendant que le paiement est retenté.', // MT
  },
  m_failed_fix: {
    en: 'Usually this is an expired card — updating your payment method fixes it. If you need help, just reply to this email.',
    nl: 'Meestal is het een verlopen kaart — je betaalmethode bijwerken lost het op. Hulp nodig? Antwoord gewoon op deze e-mail.',
    es: 'Normalmente se trata de una tarjeta caducada — actualizar tu método de pago lo soluciona. Si necesitas ayuda, responde a este correo.', // MT
    pt: 'Normalmente é um cartão vencido — atualizar seu método de pagamento resolve. Se precisar de ajuda, é só responder a este e-mail.', // MT
    de: 'Meist ist es eine abgelaufene Karte — das Aktualisieren deiner Zahlungsmethode behebt es. Wenn du Hilfe brauchst, antworte einfach auf diese E-Mail.', // MT
    fr: 'La plupart du temps, c’est une carte expirée — mettre à jour ton moyen de paiement règle le problème. Si tu as besoin d’aide, réponds simplement à cet e-mail.', // MT
  },
  m_lapsed_subject: {
    en: 'Your {community} membership has ended',
    nl: 'Je lidmaatschap van {community} is beëindigd',
    es: 'Tu membresía de {community} ha terminado', // MT
    pt: 'Sua associação de {community} terminou', // MT
    de: 'Deine Mitgliedschaft bei {community} ist beendet', // MT
    fr: 'Ton adhésion à {community} a pris fin', // MT
  },
  m_lapsed_line: {
    en: "Your membership of {community} has ended. We'd love to have you back any time.",
    nl: 'Je lidmaatschap van {community} is beëindigd. Je bent altijd weer welkom.',
    es: 'Tu membresía de {community} ha terminado. Nos encantaría verte de vuelta cuando quieras.', // MT
    pt: 'Sua associação de {community} terminou. Adoraríamos ter você de volta a qualquer momento.', // MT
    de: 'Deine Mitgliedschaft bei {community} ist beendet. Du bist jederzeit wieder willkommen.', // MT
    fr: 'Ton adhésion à {community} a pris fin. On serait ravis de te revoir à tout moment.', // MT
  },
  m_lapsed_rejoin: {
    en: 'Rejoin {community}',
    nl: 'Word weer lid van {community}',
    es: 'Vuelve a unirte a {community}', // MT
    pt: 'Voltar a fazer parte de {community}', // MT
    de: 'Wieder Mitglied bei {community} werden', // MT
    fr: 'Rejoindre à nouveau {community}', // MT
  },
} satisfies Record<string, I18nEntry>;

const t = makeT(CATALOG);

function euro(cents: number | null | undefined, currency = 'EUR', locale: Locale = 'en'): string {
  if (cents == null) return '';
  return new Intl.NumberFormat(INTL_LOCALES[locale], { style: 'currency', currency }).format(
    cents / 100,
  );
}

function longDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(INTL_LOCALES[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** The body size the membership emails are read at.
 *
 *  Sjoerd asked for the text 1.5× larger (queued a while ago, shipped
 *  2026-10-14). The shell sets no size, so these mails were rendering at
 *  whatever the client's default was — around 16px — while the templates that
 *  did set one used 15px. 22px is 1.5× that 15, applied to the membership
 *  mails as a group so the welcome, the receipt and the renewal reminder
 *  match rather than drifting one at a time.
 *
 *  Set on the wrapper rather than on every paragraph: a `<p>` with no size of
 *  its own inherits it, and Outlook respects an inherited size on a div far
 *  more reliably than it respects one on a table cell. */
const BODY = 'font-size:22px;line-height:1.55;';
const SMALL = 'font-size:17px;line-height:1.55;color:#525252;';

/** A `<p>` at the membership reading size. */
function para(html: string, extra = ''): string {
  return `<p style="margin:0 0 18px;${BODY}${extra}">${html}</p>`;
}

/** The name to greet somebody by, capitalised only when we made it up.
 *
 *  A member added by hand often has no name: the person row is created from
 *  an email, and `first_name` ends up as the local part — so the welcome
 *  opened "Welcome to soul.com, sjoerd." (Sjoerd, on production, 2026-10-14.)
 *
 *  Capitalising EVERY first name would be the easy fix and the wrong one: a
 *  name somebody typed is theirs, and plenty of people write their own name
 *  lowercase on purpose. So this capitalises only when the name is exactly
 *  the email's local part, case-insensitively — which is the case where
 *  nobody chose it and we are reading a mailbox, not a person. */
export function greetingName(firstName: string | null | undefined, email?: string | null): string {
  const name = (firstName ?? '').trim();
  if (!name) return 'there';
  const local = (email ?? '').split('@')[0] ?? '';
  // Only the derived case. `sjoerd+invitetest` → compare on the part before
  // a plus too, since that is still the same mailbox and the same derivation.
  const bare = local.split('+')[0] ?? '';
  const derived =
    !!local &&
    (name.toLowerCase() === local.toLowerCase() || name.toLowerCase() === bare.toLowerCase());
  if (!derived) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function membershipWelcome(opts: {
  name: string;
  communityName: string;
  tierName: string;
  renewsAt: string | null;
  /** The community's OWN words about this tier, from the join card. Shown in
   *  preference to anything we could write, because they know what they are
   *  offering and we do not. */
  tierDescription?: string | null;
  /** The ticks on the join card — what the membership includes, as the
   *  community listed them. */
  characteristics?: string[] | null;
  /** The teams whose calendars this membership opens, when it opens any.
   *
   *  A LIST, because a membership can carry more than one and soul.com's
   *  does — the Fellowship product grants two. The sentence is possessive
   *  ("{team}'s calendar"), so one sentence per calendar rather than a
   *  joined list, which would read as a mistake in English and worse in the
   *  five machine-translated locales. */
  calendarTeamNames?: string[] | null;
  /** The member's portal. Passed in rather than built here: an absolute URL
   *  in an email must name the right stack, and only the caller knows which
   *  one it is serving. */
  portalUrl?: string | null;
  /** The address they joined with — the one that will work at sign-in. */
  email?: string | null;
  /** Whether an invoice is on its way.
   *
   *  True for somebody who joined and paid; FALSE for a member an admin added
   *  by hand without billing them, where "your invoice arrives in a separate
   *  email" would promise a message that never comes. One welcome, two
   *  triggers — not two templates that drift. */
  invoiceFollows?: boolean;
  locale?: string | null;
  brand?: EmailBrand;
}): { subject: string; html: string; text: string } {
  const loc = toLocale(opts.locale);
  const subject = t(loc, 'm_welcome_subject', { community: opts.communityName });

  const greeting = t(loc, 'm_welcome_greeting', {
    community: opts.communityName,
    name: greetingName(opts.name, opts.email),
  });
  const invoiceFollows = opts.invoiceFollows !== false;
  const opening = t(loc, 'm_welcome_opening');

  // WHAT THEY JOINED, in the community's words where there are any. The
  // fallback states the fact plainly rather than inventing enthusiasm on
  // somebody else's behalf.
  const description = (opts.tierDescription ?? '').trim();
  const community =
    description ||
    t(loc, 'm_welcome_community_generic', {
      tier: opts.tierName,
      community: opts.communityName,
    });

  const ticks = (opts.characteristics ?? []).map((c) => c.trim()).filter(Boolean);
  const calendarLines = (opts.calendarTeamNames ?? [])
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .map((team) => t(loc, 'm_welcome_calendar', { team }));
  const renewLine = opts.renewsAt
    ? t(loc, 'm_welcome_renews', { date: longDate(opts.renewsAt, loc) })
    : '';
  const signoff = t(loc, 'm_welcome_signoff', { community: opts.communityName });

  const portalRows = [
    t(loc, 'm_welcome_portal_memberships'),
    t(loc, 'm_welcome_portal_purchases'),
    t(loc, 'm_welcome_portal_members'),
    t(loc, 'm_welcome_portal_you'),
  ];
  const signin = opts.email
    ? t(loc, 'm_welcome_portal_signin', { email: opts.email })
    : '';

  const heading = (text: string) =>
    `<p style="margin:32px 0 10px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#737373;">${escapeHtml(text)}</p>`;

  const html = [
    para(`<strong>${escapeHtml(greeting)}</strong>`),
    para(escapeHtml(opening)),
    heading(t(loc, 'm_welcome_community_heading')),
    // The community's own description may be several lines; keep them.
    para(escapeHtml(community).replace(/\n/g, '<br />')),
    ticks.length || calendarLines.length ? heading(t(loc, 'm_welcome_expect_heading')) : '',
    ticks.length
      ? `<ul style="margin:0 0 18px;padding-left:24px;${BODY}">${ticks
          .map((c) => `<li style="margin:0 0 6px;">${escapeHtml(c)}</li>`)
          .join('')}</ul>`
      : '',
    ...calendarLines.map((line) => para(escapeHtml(line))),
    // THE WHOLE SECTION, OR NONE OF IT. Without a portal URL this printed
    // "Everything about your membership lives there:" and a list of four
    // things, with no link anywhere — "there" pointing at nothing. Describing
    // a page somebody cannot open is worse than not mentioning it, and the
    // sign-in sentence has nothing to sign in to either.
    ...(opts.portalUrl
      ? [
          heading(t(loc, 'm_welcome_portal_heading')),
          `<p style="margin:0 0 18px;"><a href="${opts.portalUrl}" style="display:inline-block;background:#171717;color:#ffffff;font-size:18px;padding:14px 26px;border-radius:8px;text-decoration:none;">${escapeHtml(
            t(loc, 'm_welcome_portal_cta'),
          )}</a></p>`,
          para(escapeHtml(t(loc, 'm_welcome_portal_intro'))),
          `<ul style="margin:0 0 18px;padding-left:24px;${BODY}">${portalRows
            .map((r) => `<li style="margin:0 0 6px;">${escapeHtml(r)}</li>`)
            .join('')}</ul>`,
          signin ? `<p style="margin:0 0 18px;${SMALL}">${escapeHtml(signin)}</p>` : '',
        ]
      : []),
    renewLine ? `<p style="margin:0 0 18px;${SMALL}">${escapeHtml(renewLine)}</p>` : '',
    invoiceFollows
      ? `<p style="margin:0 0 18px;${SMALL}">${escapeHtml(t(loc, 'm_welcome_invoice_follows'))}</p>`
      : '',
    para(escapeHtml(signoff).replace(/\n/g, '<br />')),
  ]
    .filter(Boolean)
    .join('\n    ');

  const text = [
    greeting,
    opening,
    '',
    t(loc, 'm_welcome_community_heading').toUpperCase(),
    community,
    ...(ticks.length
      ? ['', t(loc, 'm_welcome_expect_heading').toUpperCase(), ...ticks.map((c) => `\u2022 ${c}`)]
      : []),
    ...(calendarLines.length ? ['', ...calendarLines] : []),
    ...(opts.portalUrl
      ? [
          '',
          t(loc, 'm_welcome_portal_heading').toUpperCase(),
          opts.portalUrl,
          '',
          t(loc, 'm_welcome_portal_intro'),
          ...portalRows.map((r) => `\u2022 ${r}`),
          ...(signin ? ['', signin] : []),
        ]
      : []),
    ...(renewLine ? ['', renewLine] : []),
    ...(invoiceFollows ? ['', t(loc, 'm_welcome_invoice_follows')] : []),
    '',
    signoff,
  ].join('\n');

  return { subject, html: shell(subject, html, opts.brand), text };
}

export function membershipRenewalReminder(opts: {
  name: string;
  communityName: string;
  tierName: string;
  renewsAt: string;
  amountCents: number | null;
  currency: string;
  locale?: string | null;
  brand?: EmailBrand;
}): { subject: string; html: string; text: string } {
  const loc = toLocale(opts.locale);
  const date = longDate(opts.renewsAt, loc);
  const amount =
    opts.amountCents != null ? ` (${euro(opts.amountCents, opts.currency, loc)})` : '';
  const subject = t(loc, 'm_renew_subject', { community: opts.communityName, date });
  const lineHtml = t(loc, 'm_renew_line', {
    tier: `<strong>${escapeHtml(opts.tierName)}</strong>`,
    community: `<strong>${escapeHtml(opts.communityName)}</strong>`,
    date: `<strong>${escapeHtml(date)}</strong>`,
    amount: escapeHtml(amount),
  });
  const lineText = t(loc, 'm_renew_line', {
    tier: opts.tierName,
    community: opts.communityName,
    date,
    amount,
  });
  const nothing = t(loc, 'm_renew_nothing');
  const body = `
    <p>${escapeHtml(t(loc, 'm_hi', { name: opts.name }))}</p>
    <p>${lineHtml}</p>
    <p>${escapeHtml(nothing)}</p>`;
  return {
    subject,
    html: shell(subject, body, opts.brand),
    text: `${t(loc, 'm_hi', { name: opts.name })}\n\n${lineText}\n\n${nothing}`,
  };
}

export function membershipPaymentFailed(opts: {
  name: string;
  communityName: string;
  tierName: string;
  locale?: string | null;
  brand?: EmailBrand;
}): { subject: string; html: string; text: string } {
  const loc = toLocale(opts.locale);
  const subject = t(loc, 'm_failed_subject', { community: opts.communityName });
  const lineHtml = t(loc, 'm_failed_line', {
    tier: `<strong>${escapeHtml(opts.tierName)}</strong>`,
    community: `<strong>${escapeHtml(opts.communityName)}</strong>`,
  });
  const lineText = t(loc, 'm_failed_line', {
    tier: opts.tierName,
    community: opts.communityName,
  });
  const fix = t(loc, 'm_failed_fix');
  const body = `
    <p>${escapeHtml(t(loc, 'm_hi', { name: opts.name }))}</p>
    <p>${lineHtml}</p>
    <p>${escapeHtml(fix)}</p>`;
  return {
    subject,
    html: shell(subject, body, opts.brand),
    text: `${t(loc, 'm_hi', { name: opts.name })}\n\n${lineText}\n\n${fix}`,
  };
}

export function membershipLapsed(opts: {
  name: string;
  communityName: string;
  joinUrl: string | null;
  locale?: string | null;
  brand?: EmailBrand;
}): { subject: string; html: string; text: string } {
  const loc = toLocale(opts.locale);
  const subject = t(loc, 'm_lapsed_subject', { community: opts.communityName });
  const lineHtml = t(loc, 'm_lapsed_line', {
    community: `<strong>${escapeHtml(opts.communityName)}</strong>`,
  });
  const lineText = t(loc, 'm_lapsed_line', { community: opts.communityName });
  const rejoinLabel = t(loc, 'm_lapsed_rejoin', { community: opts.communityName });
  const rejoin = opts.joinUrl
    ? `<p style="margin:24px 0 0;"><a href="${opts.joinUrl}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">${escapeHtml(rejoinLabel)}</a></p>`
    : '';
  const body = `
    <p>${escapeHtml(t(loc, 'm_hi', { name: opts.name }))}</p>
    <p>${lineHtml}</p>${rejoin}`;
  return {
    subject,
    html: shell(subject, body, opts.brand),
    text: `${t(loc, 'm_hi', { name: opts.name })}\n\n${lineText}${opts.joinUrl ? `\n\n${rejoinLabel}: ${opts.joinUrl}` : ''}`,
  };
}
