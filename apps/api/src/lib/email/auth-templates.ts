// Auth emails rendered by The Fibre API and sent via Resend. Triggered
// by the Supabase Auth "Send Email" webhook (apps/api/src/routes/auth-hook.ts).
//
// Visual identity follows the Thread reference: centred platform mark, big
// "Almost there"-style headline, a single prominent code box, a reassurance
// paragraph, a divider, and a footer with Help / About / Legal links plus a
// whitelist hint and the legal address line.
//
// All copy reads from packages/shared/src/branding.ts so a rename or
// white-label propagates without touching this file.
//
// i18n P2: every action's copy exists in all LOCALES (Record<Locale, …> —
// a missing locale fails typecheck). Locale source: identity_profile.locale
// where the recipient has one (resolved by the auth-hook), en otherwise —
// OTP codes are seen by every non-Google invitee, so this is a public
// money-adjacent surface. Non-EN strings are machine-drafted (// MT blocks)
// pending native review; NL is Sjoerd's review lane.

import {
  APPS,
  BRAND_ASSETS,
  ENTITY,
  FOOTER_LINKS,
  PLATFORM_APP_ID,
  legalFooterLine,
  toLocale,
  type Locale,
} from '@thefibre/shared';
import { escapeHtml } from './templates.js';

const PLATFORM = APPS[PLATFORM_APP_ID];

type AuthEmailActionType =
  | 'signup'
  | 'login'
  | 'magiclink'
  | 'invite'
  | 'recovery'
  | 'email_change_new'
  | 'email_change_current'
  | 'reauthentication';

type RenderArgs = {
  email: string;
  /** One-time code (when present). Supabase OTP length is configurable; we render whatever it gives us. */
  token: string | null;
  /** Magic-link URL fallback (when present). */
  confirmationUrl: string | null;
  /** Validity window for the code, in minutes. Supabase default: 60. */
  validityMinutes: number;
};

export type RenderedEmail = { subject: string; text: string; html: string };

export type AuthEmailBrand = { name?: string | null; logoUrl?: string | null };

export function renderAuthEmail(
  action: AuthEmailActionType,
  args: RenderArgs,
  locale?: string | null,
  // A member signing in belongs to a COMMUNITY, not to The Fibre (Sjoerd,
  // 2026-09-06: "the email with the code was Fibre, not the workspace").
  // The hook resolves the brand from who knows the email; absent = platform.
  brand?: AuthEmailBrand | null,
): RenderedEmail {
  const loc = toLocale(locale);
  const copy = (COPY[action] ?? COPY.magiclink)[loc];
  const chrome = CHROME[loc];
  const name = brand?.name || PLATFORM.name;
  const subject = copy.subject.replaceAll('{platform}', name);
  const text = buildText({ args, copy, chrome, senderName: brand?.name ?? undefined });
  const html = buildHtml({ args, copy, chrome, loc, brand: brand ?? undefined });
  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Copy per action type × locale
// ---------------------------------------------------------------------------

type Copy = {
  /** {platform} is substituted with the platform name. */
  subject: string;
  /** Big headline at the top of the body. */
  headline: string;
  /** One-sentence intro above the code box. */
  intro: string;
  /** Optional CTA button label. Shown only when confirmationUrl is present. */
  cta?: string;
  /** Reassurance line below the code. */
  reassurance: string;
};

// login and magiclink deliberately share their copy — one definition.
const SIGN_IN_COPY: Record<Locale, Copy> = {
  en: {
    subject: 'Sign in to {platform}',
    headline: 'Almost there',
    intro: 'Here is your sign-in code:',
    cta: 'Sign in with one click',
    reassurance:
      "If you didn't try to sign in, ignore this email — someone may have typed your address by accident.",
  },
  nl: {
    subject: 'Inloggen bij {platform}',
    headline: 'Bijna binnen',
    intro: 'Hier is je inlogcode:',
    cta: 'Log in met één klik',
    reassurance:
      'Probeerde je niet in te loggen? Negeer deze e-mail — iemand heeft misschien per ongeluk jouw adres ingetypt.',
  },
  // MT
  es: {
    subject: 'Inicia sesión en {platform}',
    headline: 'Ya casi estás',
    intro: 'Aquí tienes tu código de inicio de sesión:',
    cta: 'Inicia sesión con un clic',
    reassurance:
      'Si no intentaste iniciar sesión, ignora este correo — puede que alguien haya escrito tu dirección por error.',
  },
  // MT
  pt: {
    subject: 'Entrar no {platform}',
    headline: 'Quase lá',
    intro: 'Aqui está seu código de acesso:',
    cta: 'Entre com um clique',
    reassurance:
      'Se você não tentou entrar, ignore este e-mail — alguém pode ter digitado seu endereço por engano.',
  },
  // MT
  de: {
    subject: 'Bei {platform} anmelden',
    headline: 'Fast geschafft',
    intro: 'Hier ist dein Anmeldecode:',
    cta: 'Mit einem Klick anmelden',
    reassurance:
      'Wolltest du dich nicht anmelden? Ignoriere diese E-Mail — vielleicht hat jemand versehentlich deine Adresse eingetippt.',
  },
  // MT
  fr: {
    subject: 'Connexion à {platform}',
    headline: 'Presque là',
    intro: 'Voici ton code de connexion :',
    cta: 'Connecte-toi en un clic',
    reassurance:
      'Tu n’as pas essayé de te connecter ? Ignore cet e-mail — quelqu’un a peut-être saisi ton adresse par erreur.',
  },
};

const COPY: Record<AuthEmailActionType, Record<Locale, Copy>> = {
  signup: {
    en: {
      subject: 'Confirm your {platform} account',
      headline: 'Almost there',
      intro: 'Enter this code to confirm your account:',
      cta: 'Confirm account',
      reassurance:
        "If you didn't sign up for an account, ignore this email — no account will be created.",
    },
    nl: {
      subject: 'Bevestig je {platform}-account',
      headline: 'Bijna klaar',
      intro: 'Voer deze code in om je account te bevestigen:',
      cta: 'Account bevestigen',
      reassurance:
        'Heb je geen account aangemaakt? Negeer deze e-mail — er wordt geen account aangemaakt.',
    },
    // MT
    es: {
      subject: 'Confirma tu cuenta de {platform}',
      headline: 'Ya casi estás',
      intro: 'Introduce este código para confirmar tu cuenta:',
      cta: 'Confirmar cuenta',
      reassurance:
        'Si no creaste una cuenta, ignora este correo — no se creará ninguna cuenta.',
    },
    // MT
    pt: {
      subject: 'Confirme sua conta {platform}',
      headline: 'Quase lá',
      intro: 'Digite este código para confirmar sua conta:',
      cta: 'Confirmar conta',
      reassurance:
        'Se você não criou uma conta, ignore este e-mail — nenhuma conta será criada.',
    },
    // MT
    de: {
      subject: 'Bestätige dein {platform}-Konto',
      headline: 'Fast geschafft',
      intro: 'Gib diesen Code ein, um dein Konto zu bestätigen:',
      cta: 'Konto bestätigen',
      reassurance:
        'Hast du dich nicht registriert? Ignoriere diese E-Mail — es wird kein Konto angelegt.',
    },
    // MT
    fr: {
      subject: 'Confirme ton compte {platform}',
      headline: 'Presque là',
      intro: 'Saisis ce code pour confirmer ton compte :',
      cta: 'Confirmer le compte',
      reassurance:
        'Si tu n’as pas créé de compte, ignore cet e-mail — aucun compte ne sera créé.',
    },
  },
  login: SIGN_IN_COPY,
  magiclink: SIGN_IN_COPY,
  invite: {
    en: {
      subject: "You've been invited to {platform}",
      headline: "You've been invited",
      intro: 'Enter this code to accept the invitation:',
      cta: 'Accept invitation',
      reassurance:
        "If you weren't expecting this, ignore the email — no account will be created.",
    },
    nl: {
      subject: 'Je bent uitgenodigd voor {platform}',
      headline: 'Je bent uitgenodigd',
      intro: 'Voer deze code in om de uitnodiging te accepteren:',
      cta: 'Uitnodiging accepteren',
      reassurance:
        'Verwachtte je dit niet? Negeer de e-mail — er wordt geen account aangemaakt.',
    },
    // MT
    es: {
      subject: 'Te han invitado a {platform}',
      headline: 'Te han invitado',
      intro: 'Introduce este código para aceptar la invitación:',
      cta: 'Aceptar invitación',
      reassurance:
        'Si no esperabas esto, ignora el correo — no se creará ninguna cuenta.',
    },
    // MT
    pt: {
      subject: 'Você foi convidado para o {platform}',
      headline: 'Você foi convidado',
      intro: 'Digite este código para aceitar o convite:',
      cta: 'Aceitar convite',
      reassurance:
        'Se você não esperava isso, ignore o e-mail — nenhuma conta será criada.',
    },
    // MT
    de: {
      subject: 'Du wurdest zu {platform} eingeladen',
      headline: 'Du bist eingeladen',
      intro: 'Gib diesen Code ein, um die Einladung anzunehmen:',
      cta: 'Einladung annehmen',
      reassurance:
        'Hast du das nicht erwartet? Ignoriere die E-Mail — es wird kein Konto angelegt.',
    },
    // MT
    fr: {
      subject: 'Tu as été invité·e sur {platform}',
      headline: 'Tu as été invité·e',
      intro: 'Saisis ce code pour accepter l’invitation :',
      cta: 'Accepter l’invitation',
      reassurance:
        'Si tu ne t’y attendais pas, ignore cet e-mail — aucun compte ne sera créé.',
    },
  },
  recovery: {
    en: {
      subject: 'Reset your {platform} password',
      headline: 'Reset your password',
      intro: 'Use this code to confirm a password reset:',
      cta: 'Reset password',
      reassurance:
        "If you didn't request a reset, ignore this email — your password will not change.",
    },
    nl: {
      subject: 'Stel je {platform}-wachtwoord opnieuw in',
      headline: 'Wachtwoord opnieuw instellen',
      intro: 'Gebruik deze code om het opnieuw instellen te bevestigen:',
      cta: 'Wachtwoord opnieuw instellen',
      reassurance:
        'Heb je dit niet aangevraagd? Negeer deze e-mail — je wachtwoord verandert niet.',
    },
    // MT
    es: {
      subject: 'Restablece tu contraseña de {platform}',
      headline: 'Restablece tu contraseña',
      intro: 'Usa este código para confirmar el restablecimiento:',
      cta: 'Restablecer contraseña',
      reassurance:
        'Si no solicitaste el restablecimiento, ignora este correo — tu contraseña no cambiará.',
    },
    // MT
    pt: {
      subject: 'Redefina sua senha do {platform}',
      headline: 'Redefina sua senha',
      intro: 'Use este código para confirmar a redefinição de senha:',
      cta: 'Redefinir senha',
      reassurance:
        'Se você não pediu a redefinição, ignore este e-mail — sua senha não será alterada.',
    },
    // MT
    de: {
      subject: 'Setze dein {platform}-Passwort zurück',
      headline: 'Passwort zurücksetzen',
      intro: 'Bestätige das Zurücksetzen mit diesem Code:',
      cta: 'Passwort zurücksetzen',
      reassurance:
        'Hast du kein Zurücksetzen angefordert? Ignoriere diese E-Mail — dein Passwort ändert sich nicht.',
    },
    // MT
    fr: {
      subject: 'Réinitialise ton mot de passe {platform}',
      headline: 'Réinitialise ton mot de passe',
      intro: 'Utilise ce code pour confirmer la réinitialisation :',
      cta: 'Réinitialiser le mot de passe',
      reassurance:
        'Si tu n’as rien demandé, ignore cet e-mail — ton mot de passe ne changera pas.',
    },
  },
  email_change_new: {
    en: {
      subject: 'Confirm your new {platform} email',
      headline: 'Confirm your new email',
      intro: 'Enter this code on the address you want to use from now on:',
      cta: 'Confirm new email',
      reassurance:
        "If you didn't request this change, ignore the email and your address stays as it is.",
    },
    nl: {
      subject: 'Bevestig je nieuwe {platform}-e-mailadres',
      headline: 'Bevestig je nieuwe e-mailadres',
      intro: 'Voer deze code in op het adres dat je voortaan wilt gebruiken:',
      cta: 'Nieuw e-mailadres bevestigen',
      reassurance:
        'Heb je deze wijziging niet aangevraagd? Negeer de e-mail — je adres blijft zoals het is.',
    },
    // MT
    es: {
      subject: 'Confirma tu nuevo correo de {platform}',
      headline: 'Confirma tu nuevo correo',
      intro: 'Introduce este código en la dirección que quieres usar a partir de ahora:',
      cta: 'Confirmar nuevo correo',
      reassurance:
        'Si no solicitaste este cambio, ignora el correo y tu dirección quedará como está.',
    },
    // MT
    pt: {
      subject: 'Confirme seu novo e-mail do {platform}',
      headline: 'Confirme seu novo e-mail',
      intro: 'Digite este código no endereço que você quer usar daqui em diante:',
      cta: 'Confirmar novo e-mail',
      reassurance:
        'Se você não pediu essa alteração, ignore o e-mail e seu endereço permanece como está.',
    },
    // MT
    de: {
      subject: 'Bestätige deine neue {platform}-E-Mail-Adresse',
      headline: 'Bestätige deine neue E-Mail-Adresse',
      intro: 'Gib diesen Code auf der Adresse ein, die du ab jetzt nutzen möchtest:',
      cta: 'Neue E-Mail-Adresse bestätigen',
      reassurance:
        'Hast du diese Änderung nicht angefordert? Ignoriere die E-Mail — deine Adresse bleibt, wie sie ist.',
    },
    // MT
    fr: {
      subject: 'Confirme ta nouvelle adresse {platform}',
      headline: 'Confirme ta nouvelle adresse',
      intro: 'Saisis ce code sur l’adresse que tu veux utiliser désormais :',
      cta: 'Confirmer la nouvelle adresse',
      reassurance:
        'Si tu n’as pas demandé ce changement, ignore cet e-mail — ton adresse reste inchangée.',
    },
  },
  email_change_current: {
    en: {
      subject: 'Confirm an email change on your {platform} account',
      headline: 'Confirm an email change',
      intro: 'Enter this code from your current address:',
      cta: 'Confirm change',
      reassurance:
        "If you didn't request this change, ignore the email and your address stays as it is.",
    },
    nl: {
      subject: 'Bevestig een e-mailwijziging op je {platform}-account',
      headline: 'Bevestig een e-mailwijziging',
      intro: 'Voer deze code in vanaf je huidige adres:',
      cta: 'Wijziging bevestigen',
      reassurance:
        'Heb je deze wijziging niet aangevraagd? Negeer de e-mail — je adres blijft zoals het is.',
    },
    // MT
    es: {
      subject: 'Confirma un cambio de correo en tu cuenta de {platform}',
      headline: 'Confirma un cambio de correo',
      intro: 'Introduce este código desde tu dirección actual:',
      cta: 'Confirmar cambio',
      reassurance:
        'Si no solicitaste este cambio, ignora el correo y tu dirección quedará como está.',
    },
    // MT
    pt: {
      subject: 'Confirme uma troca de e-mail na sua conta {platform}',
      headline: 'Confirme uma troca de e-mail',
      intro: 'Digite este código a partir do seu endereço atual:',
      cta: 'Confirmar troca',
      reassurance:
        'Se você não pediu essa alteração, ignore o e-mail e seu endereço permanece como está.',
    },
    // MT
    de: {
      subject: 'Bestätige eine E-Mail-Änderung an deinem {platform}-Konto',
      headline: 'Bestätige eine E-Mail-Änderung',
      intro: 'Gib diesen Code von deiner aktuellen Adresse aus ein:',
      cta: 'Änderung bestätigen',
      reassurance:
        'Hast du diese Änderung nicht angefordert? Ignoriere die E-Mail — deine Adresse bleibt, wie sie ist.',
    },
    // MT
    fr: {
      subject: 'Confirme un changement d’adresse sur ton compte {platform}',
      headline: 'Confirme un changement d’adresse',
      intro: 'Saisis ce code depuis ton adresse actuelle :',
      cta: 'Confirmer le changement',
      reassurance:
        'Si tu n’as pas demandé ce changement, ignore cet e-mail — ton adresse reste inchangée.',
    },
  },
  reauthentication: {
    en: {
      subject: 'Re-verify your {platform} session',
      headline: 'Verify it’s you',
      intro: 'Enter this code to continue:',
      reassurance: "If you didn't trigger this, close the session that asked for it.",
    },
    nl: {
      subject: 'Verifieer je {platform}-sessie opnieuw',
      headline: 'Bevestig dat jij het bent',
      intro: 'Voer deze code in om door te gaan:',
      reassurance: 'Heb je dit niet zelf gedaan? Sluit dan de sessie die erom vroeg.',
    },
    // MT
    es: {
      subject: 'Vuelve a verificar tu sesión de {platform}',
      headline: 'Confirma que eres tú',
      intro: 'Introduce este código para continuar:',
      reassurance: 'Si no fuiste tú, cierra la sesión que lo pidió.',
    },
    // MT
    pt: {
      subject: 'Verifique novamente sua sessão do {platform}',
      headline: 'Confirme que é você',
      intro: 'Digite este código para continuar:',
      reassurance: 'Se não foi você, feche a sessão que pediu o código.',
    },
    // MT
    de: {
      subject: 'Verifiziere deine {platform}-Sitzung erneut',
      headline: 'Bestätige, dass du es bist',
      intro: 'Gib diesen Code ein, um fortzufahren:',
      reassurance: 'Warst du das nicht? Schließe die Sitzung, die danach gefragt hat.',
    },
    // MT
    fr: {
      subject: 'Revérifie ta session {platform}',
      headline: 'Confirme que c’est bien toi',
      intro: 'Saisis ce code pour continuer :',
      reassurance: 'Si ce n’était pas toi, ferme la session qui l’a demandé.',
    },
  },
};

// Shared chrome around every auth email (validity line, link line, support
// line, footer). {n}, {team} substituted at render.
type Chrome = {
  valid_for: string;
  or_click: string;
  questions: string;
  team_label: string;
  help: string;
  about: string;
  legal: string;
  privacy: string;
  whitelist: string;
};

const CHROME: Record<Locale, Chrome> = {
  en: {
    valid_for: 'This code will be active for {n} minutes.',
    or_click: 'Or use this link:',
    questions: 'Questions? Our friendly {team} is always happy to help.',
    team_label: 'support team',
    help: 'Help',
    about: 'About us',
    legal: 'Legal',
    privacy: 'Privacy',
    whitelist: 'To make sure our emails arrive, please add {email} to your contacts.',
  },
  nl: {
    valid_for: 'Deze code is {n} minuten geldig.',
    or_click: 'Of gebruik deze link:',
    questions: 'Vragen? Ons vriendelijke {team} helpt je graag.',
    team_label: 'supportteam',
    help: 'Help',
    about: 'Over ons',
    legal: 'Juridisch',
    privacy: 'Privacy',
    whitelist: 'Voeg {email} toe aan je contacten zodat onze e-mails zeker aankomen.',
  },
  // MT
  es: {
    valid_for: 'Este código estará activo durante {n} minutos.',
    or_click: 'O usa este enlace:',
    questions: '¿Preguntas? Nuestro amable {team} está encantado de ayudarte.',
    team_label: 'equipo de soporte',
    help: 'Ayuda',
    about: 'Sobre nosotros',
    legal: 'Legal',
    privacy: 'Privacidad',
    whitelist: 'Para asegurarte de recibir nuestros correos, añade {email} a tus contactos.',
  },
  // MT
  pt: {
    valid_for: 'Este código ficará ativo por {n} minutos.',
    or_click: 'Ou use este link:',
    questions: 'Dúvidas? Nossa simpática {team} está sempre pronta para ajudar.',
    team_label: 'equipe de suporte',
    help: 'Ajuda',
    about: 'Sobre nós',
    legal: 'Jurídico',
    privacy: 'Privacidade',
    whitelist: 'Para garantir que nossos e-mails cheguem, adicione {email} aos seus contatos.',
  },
  // MT
  de: {
    valid_for: 'Dieser Code ist {n} Minuten lang gültig.',
    or_click: 'Oder nutze diesen Link:',
    questions: 'Fragen? Unser freundliches {team} hilft dir gern.',
    team_label: 'Support-Team',
    help: 'Hilfe',
    about: 'Über uns',
    legal: 'Rechtliches',
    privacy: 'Datenschutz',
    whitelist: 'Füge {email} zu deinen Kontakten hinzu, damit unsere E-Mails sicher ankommen.',
  },
  // MT
  fr: {
    valid_for: 'Ce code restera actif pendant {n} minutes.',
    or_click: 'Ou utilise ce lien :',
    questions: 'Des questions ? Notre sympathique {team} est toujours là pour t’aider.',
    team_label: 'équipe d’assistance',
    help: 'Aide',
    about: 'À propos',
    legal: 'Mentions légales',
    privacy: 'Confidentialité',
    whitelist: 'Pour être sûr·e de recevoir nos e-mails, ajoute {email} à tes contacts.',
  },
};

// ---------------------------------------------------------------------------
// Plain-text rendering
// ---------------------------------------------------------------------------

function buildText({
  args,
  copy,
  chrome,
  senderName,
}: {
  args: RenderArgs;
  copy: Copy;
  chrome: Chrome;
  /** The community's name on branded sends — the text part must agree with
   *  the subject + HTML (cross-session review, 2026-09-06). */
  senderName?: string | undefined;
}): string {
  const lines: string[] = [];
  lines.push(senderName || PLATFORM.name);
  lines.push('');
  lines.push(copy.headline);
  lines.push('');
  lines.push(copy.intro);
  if (args.token) {
    lines.push('');
    lines.push(`    ${args.token.split('').join(' ')}`);
    lines.push('');
    lines.push(chrome.valid_for.replaceAll('{n}', String(args.validityMinutes)));
  }
  if (args.confirmationUrl) {
    lines.push('');
    lines.push(chrome.or_click);
    lines.push(args.confirmationUrl);
  }
  lines.push('');
  lines.push(copy.reassurance);
  lines.push('');
  lines.push('---');
  lines.push(
    `${chrome.help}: ${FOOTER_LINKS.help}   ${chrome.about}: ${FOOTER_LINKS.about}   ${chrome.legal}: ${FOOTER_LINKS.legal}   ${chrome.privacy}: ${FOOTER_LINKS.privacy}`,
  );
  lines.push('');
  lines.push(chrome.whitelist.replaceAll('{email}', ENTITY.whitelistEmail));
  lines.push(
    legalFooterLine(),
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

function buildHtml({
  args,
  copy,
  chrome,
  loc,
  brand,
}: {
  args: RenderArgs;
  copy: Copy;
  chrome: Chrome;
  loc: Locale;
  brand?: AuthEmailBrand | undefined;
}): string {
  const codeBox = args.token
    ? `
        <div style="margin: 32px 0;">
          <div style="background: #f5f5f5; border-radius: 12px; padding: 28px 24px; text-align: center;">
            <div style="font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 32px; letter-spacing: 14px; color: #171717; padding-left: 14px;">
              ${escapeHtml(args.token)}
            </div>
          </div>
          <p style="margin: 16px 0 0; color: #737373; font-size: 14px; text-align: center;">
            ${escapeHtml(chrome.valid_for.replaceAll('{n}', String(args.validityMinutes)))}
          </p>
        </div>
      `
    : '';

  const cta = args.confirmationUrl
    ? `
        <p style="margin: 24px 0; text-align: center;">
          <a href="${escapeHtml(args.confirmationUrl)}"
             style="display: inline-block; background: #171717; color: #fff; text-decoration: none; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 8px;">
            ${escapeHtml(copy.cta ?? 'Continue')}
          </a>
        </p>
      `
    : '';

  const questions = ENTITY.supportEmail
    ? ` ${escapeHtml(chrome.questions).replace(
        '{team}',
        `<a href="mailto:${escapeHtml(ENTITY.supportEmail)}" style="color: #525252;">${escapeHtml(chrome.team_label)}</a>`,
      )}`
    : '';

  return `<!doctype html>
<html lang="${loc}">
<body style="margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #171717;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; padding: 48px 32px;">
        <tr><td align="center">
          <!-- Sender wordmark: the workspace's when the sign-in belongs to a
               community member, the platform's otherwise. -->
          ${
            brand?.logoUrl
              ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name ?? '')}" width="140" style="display: block; margin: 0 auto 48px; border: 0; outline: none; text-decoration: none; height: auto;" />`
              : brand?.name
                ? `<div style="margin: 0 auto 48px; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; color: #171717;">${escapeHtml(brand.name)}</div>`
                : `<img src="${BRAND_ASSETS.logoUrl}" alt="${escapeHtml(BRAND_ASSETS.logoAlt)}" width="140" style="display: block; margin: 0 auto 48px; border: 0; outline: none; text-decoration: none; height: auto;" />`
          }

          <h1 style="margin: 0; font-size: 28px; font-weight: 500; letter-spacing: -0.01em; color: #171717;">
            ${escapeHtml(copy.headline)}
          </h1>

          <p style="margin: 24px 0 0; color: #525252; font-size: 15px; line-height: 1.5;">
            ${escapeHtml(copy.intro)}
          </p>

          ${codeBox}
          ${cta}

          <p style="margin: 32px 0 0; color: #737373; font-size: 13px; line-height: 1.6; max-width: 440px;">
            ${escapeHtml(copy.reassurance)}${questions}
          </p>

          <hr style="margin: 48px 0 24px; border: 0; border-top: 1px solid #e5e5e5;" />

          <p style="margin: 0; font-size: 13px; color: #737373;">
            <a href="${FOOTER_LINKS.help}" style="color: #525252; text-decoration: none;">${escapeHtml(chrome.help)}</a>
            &nbsp;·&nbsp;
            <a href="${FOOTER_LINKS.about}" style="color: #525252; text-decoration: none;">${escapeHtml(chrome.about)}</a>
            &nbsp;·&nbsp;
            <a href="${FOOTER_LINKS.legal}" style="color: #525252; text-decoration: none;">${escapeHtml(chrome.legal)}</a>
            &nbsp;·&nbsp;
            <a href="${FOOTER_LINKS.privacy}" style="color: #525252; text-decoration: none;">${escapeHtml(chrome.privacy)}</a>
          </p>

          <p style="margin: 16px 0 0; font-size: 12px; color: #a3a3a3;">
            ${escapeHtml(chrome.whitelist).replace(
              '{email}',
              `<a href="mailto:${escapeHtml(ENTITY.whitelistEmail)}" style="color: #737373;">${escapeHtml(ENTITY.whitelistEmail)}</a>`,
            )}
          </p>

          <p style="margin: 8px 0 0; font-size: 12px; color: #a3a3a3;">
            ${escapeHtml(legalFooterLine())}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
