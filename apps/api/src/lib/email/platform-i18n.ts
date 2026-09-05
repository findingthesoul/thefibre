// Platform lifecycle email strings ×6 (i18n P2 — same typed-catalog rule as
// certificate-i18n.ts: a key missing a locale fails typecheck).
//
// All non-EN strings are machine-drafted and marked // MT pending native
// review (NL included this round — Sjoerd reads NL before ship).
//
// Two deliberate anglicisms: "Settings → Plan" stays English in every locale
// because the app chrome it names IS English until P3 — translating the menu
// path would describe a screen that does not exist. Plan names (Free, Pro …)
// are product names, never translated.
//
// Locale resolution for platform emails lives here too (mirrors
// certificate-i18n's arrangement of catalog-next-to-consumer): the chain is
// user-level locale (identity_profile.locale — the profile SPoT) → 'en'.
// There is NO workspace-default step: platform emails often precede the
// workspace (the welcome fires at approval, before first sign-in), and no
// platform-level workspace locale concept exists (membership_settings.locale
// is app-local to Membership).

import { DEFAULT_LOCALE, makeT, toLocale, type I18nEntry, type Locale } from '@thefibre/shared';
import { adminClient } from '../../db.js';

/** user_profile-era name kept out on purpose — the profile SPoT is identity_profile. */
export async function platformEmailLocale(email: string | null | undefined): Promise<Locale> {
  if (!email) return DEFAULT_LOCALE;
  const { data } = await adminClient
    .from('identity_profile')
    .select('locale')
    .eq('email', email)
    .maybeSingle();
  return toLocale(data?.locale ?? null);
}

const CATALOG = {
  ws_subject: {
    en: 'Your {platform} workspace is ready',
    nl: 'Je {platform}-werkruimte staat klaar', // MT
    es: 'Tu espacio de trabajo de {platform} está listo', // MT
    pt: 'Seu espaço de trabalho do {platform} está pronto', // MT
    de: 'Dein {platform}-Arbeitsbereich ist bereit', // MT
    fr: 'Ton espace de travail {platform} est prêt', // MT
  },
  ws_headline: {
    en: 'Your workspace is ready',
    nl: 'Je werkruimte staat klaar', // MT
    es: 'Tu espacio de trabajo está listo', // MT
    pt: 'Seu espaço de trabalho está pronto', // MT
    de: 'Dein Arbeitsbereich ist bereit', // MT
    fr: 'Ton espace de travail est prêt', // MT
  },
  ws_intro: {
    en: 'Hi {name} — your request for access has been approved, and a workspace called {workspace} is waiting for you.',
    nl: 'Hoi {name} — je aanvraag voor toegang is goedgekeurd, en er staat een werkruimte met de naam {workspace} voor je klaar.', // MT
    es: 'Hola {name}: tu solicitud de acceso ha sido aprobada y un espacio de trabajo llamado {workspace} te está esperando.', // MT
    pt: 'Olá {name} — seu pedido de acesso foi aprovado e um espaço de trabalho chamado {workspace} está esperando por você.', // MT
    de: 'Hallo {name} — deine Zugangsanfrage wurde genehmigt, und ein Arbeitsbereich namens {workspace} wartet auf dich.', // MT
    fr: 'Bonjour {name} — ta demande d’accès a été approuvée, et un espace de travail nommé {workspace} t’attend.', // MT
  },
  ws_intro_no_name: {
    en: 'Hi — your request for access has been approved, and a workspace called {workspace} is waiting for you.',
    nl: 'Hoi — je aanvraag voor toegang is goedgekeurd, en er staat een werkruimte met de naam {workspace} voor je klaar.', // MT
    es: 'Hola: tu solicitud de acceso ha sido aprobada y un espacio de trabajo llamado {workspace} te está esperando.', // MT
    pt: 'Olá — seu pedido de acesso foi aprovado e um espaço de trabalho chamado {workspace} está esperando por você.', // MT
    de: 'Hallo — deine Zugangsanfrage wurde genehmigt, und ein Arbeitsbereich namens {workspace} wartet auf dich.', // MT
    fr: 'Bonjour — ta demande d’accès a été approuvée, et un espace de travail nommé {workspace} t’attend.', // MT
  },
  ws_signin_line: {
    en: 'Sign in with this email address (Google or a one-time code both work):',
    nl: 'Meld je aan met dit e-mailadres (Google of een eenmalige code werken allebei):', // MT
    es: 'Inicia sesión con esta dirección de correo (Google o un código de un solo uso funcionan igual):', // MT
    pt: 'Entre com este endereço de e-mail (Google ou um código de uso único funcionam):', // MT
    de: 'Melde dich mit dieser E-Mail-Adresse an (Google oder ein Einmalcode funktionieren beide):', // MT
    fr: 'Connecte-toi avec cette adresse e-mail (Google ou un code à usage unique fonctionnent tous les deux) :', // MT
  },
  ws_button: {
    en: 'Sign in',
    nl: 'Aanmelden', // MT
    es: 'Iniciar sesión', // MT
    pt: 'Entrar', // MT
    de: 'Anmelden', // MT
    fr: 'Se connecter', // MT
  },
  ws_use_email: {
    en: 'Use this email address — Google or a one-time code both work.',
    nl: 'Gebruik dit e-mailadres — Google of een eenmalige code werken allebei.', // MT
    es: 'Usa esta dirección de correo — Google o un código de un solo uso funcionan igual.', // MT
    pt: 'Use este endereço de e-mail — Google ou um código de uso único funcionam.', // MT
    de: 'Verwende diese E-Mail-Adresse — Google oder ein Einmalcode funktionieren beide.', // MT
    fr: 'Utilise cette adresse e-mail — Google ou un code à usage unique fonctionnent tous les deux.', // MT
  },
  ws_plan_line: {
    en: "You asked for the {plan} package — your workspace starts on Free, and you can activate {plan} under Settings → Plan once you're in.",
    nl: 'Je vroeg om het {plan}-pakket — je werkruimte start op Free, en je kunt {plan} activeren onder Settings → Plan zodra je binnen bent.', // MT
    es: 'Pediste el paquete {plan} — tu espacio de trabajo empieza en Free, y puedes activar {plan} en Settings → Plan en cuanto entres.', // MT
    pt: 'Você pediu o pacote {plan} — seu espaço de trabalho começa no Free, e você pode ativar {plan} em Settings → Plan assim que entrar.', // MT
    de: 'Du hast das {plan}-Paket angefragt — dein Arbeitsbereich startet auf Free, und du kannst {plan} unter Settings → Plan aktivieren, sobald du drin bist.', // MT
    fr: 'Tu as demandé le forfait {plan} — ton espace de travail démarre sur Free, et tu peux activer {plan} dans Settings → Plan une fois connecté.', // MT
  },
  ws_ignore: {
    en: 'If you did not request access to {platform}, you can ignore this email — nothing happens until you sign in.',
    nl: 'Heb je geen toegang tot {platform} aangevraagd, dan kun je deze e-mail negeren — er gebeurt niets totdat je je aanmeldt.', // MT
    es: 'Si no solicitaste acceso a {platform}, puedes ignorar este correo — no pasa nada hasta que inicies sesión.', // MT
    pt: 'Se você não pediu acesso ao {platform}, pode ignorar este e-mail — nada acontece até você entrar.', // MT
    de: 'Wenn du keinen Zugang zu {platform} angefragt hast, kannst du diese E-Mail ignorieren — es passiert nichts, bis du dich anmeldest.', // MT
    fr: 'Si tu n’as pas demandé l’accès à {platform}, tu peux ignorer cet e-mail — rien ne se passe tant que tu ne te connectes pas.', // MT
  },
  ws_support: {
    en: 'Questions? Our friendly {support_team} is always happy to help.',
    nl: 'Vragen? Ons vriendelijke {support_team} helpt je graag.', // MT
    es: '¿Preguntas? Nuestro amable {support_team} siempre está encantado de ayudarte.', // MT
    pt: 'Dúvidas? Nossa {support_team} terá prazer em ajudar.', // MT
    de: 'Fragen? Unser freundliches {support_team} hilft dir gerne.', // MT
    fr: 'Des questions ? Notre {support_team} se fera un plaisir de t’aider.', // MT
  },
  ws_support_team: {
    en: 'support team',
    nl: 'supportteam', // MT
    es: 'equipo de soporte', // MT
    pt: 'equipe de suporte', // MT
    de: 'Support-Team', // MT
    fr: 'équipe de support', // MT
  },
  footer_help: {
    en: 'Help',
    nl: 'Help', // MT
    es: 'Ayuda', // MT
    pt: 'Ajuda', // MT
    de: 'Hilfe', // MT
    fr: 'Aide', // MT
  },
  footer_about: {
    en: 'About us',
    nl: 'Over ons', // MT
    es: 'Sobre nosotros', // MT
    pt: 'Sobre nós', // MT
    de: 'Über uns', // MT
    fr: 'À propos', // MT
  },
  footer_legal: {
    en: 'Legal',
    nl: 'Juridisch', // MT
    es: 'Legal', // MT
    pt: 'Legal', // MT
    de: 'Rechtliches', // MT
    fr: 'Mentions légales', // MT
  },
  footer_privacy: {
    en: 'Privacy',
    nl: 'Privacy', // MT
    es: 'Privacidad', // MT
    pt: 'Privacidade', // MT
    de: 'Datenschutz', // MT
    fr: 'Confidentialité', // MT
  },
  ws_whitelist: {
    en: 'To make sure our emails arrive, please add {email} to your contacts.',
    nl: 'Voeg {email} toe aan je contacten zodat onze e-mails zeker aankomen.', // MT
    es: 'Para asegurarte de que nuestros correos lleguen, añade {email} a tus contactos.', // MT
    pt: 'Para garantir que nossos e-mails cheguem, adicione {email} aos seus contatos.', // MT
    de: 'Damit unsere E-Mails sicher ankommen, füge bitte {email} zu deinen Kontakten hinzu.', // MT
    fr: 'Pour bien recevoir nos e-mails, ajoute {email} à tes contacts.', // MT
  },
} satisfies Record<string, I18nEntry>;

export const platformT = makeT(CATALOG);
