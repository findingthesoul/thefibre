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

export function membershipWelcome(opts: {
  name: string;
  communityName: string;
  tierName: string;
  renewsAt: string | null;
  locale?: string | null;
  brand?: EmailBrand;
}): { subject: string; html: string; text: string } {
  const loc = toLocale(opts.locale);
  const renewLine = opts.renewsAt
    ? t(loc, 'm_welcome_renews', { date: longDate(opts.renewsAt, loc) })
    : '';
  const subject = t(loc, 'm_welcome_subject', { community: opts.communityName });
  const activeHtml = t(loc, 'm_welcome_active', {
    tier: `<strong>${escapeHtml(opts.tierName)}</strong>`,
    community: `<strong>${escapeHtml(opts.communityName)}</strong>`,
    renews: escapeHtml(renewLine),
  }).trim();
  const activeText = t(loc, 'm_welcome_active', {
    tier: opts.tierName,
    community: opts.communityName,
    renews: renewLine,
  }).trim();
  const spaces = t(loc, 'm_welcome_spaces');
  const body = `
    <p>${escapeHtml(t(loc, 'm_hi', { name: opts.name }))}</p>
    <p>${activeHtml}</p>
    <p>${escapeHtml(spaces)}</p>`;
  return {
    subject,
    html: shell(subject, body, opts.brand),
    text: `${t(loc, 'm_hi', { name: opts.name })}\n\n${activeText}\n\n${spaces}`,
  };
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
