// Participant sign-in strings — the passwordless email-code + Google flow
// every participant-facing portal renders (Thread /my and public pages,
// Membership /my and oauth-continue). PENDING CONSUMER: apps/my (the
// visitor portal, my.thethread.app) is EN-only with no catalog of its own
// yet, deliberately — when it grows i18n, it adopts THIS catalog rather
// than a fourth copy. One copy here instead of one per app: the catalogs
// stay per-surface as a rule (see ../i18n.ts), but this flow IS one
// surface that happens to be served by several apps — same exception as
// ui/chrome-server-i18n.ts. Plain TS, hook-free, server-renderable.
//
// Copy is the Thread's (design-leading, 2026-07-02). All six locales per
// key or typecheck fails; only FR is machine-drafted (// MT), pending
// native review.
//
// Consume either way:
//   - spread `...PARTICIPANT_AUTH` into an app catalog so the app's own
//     typed `t()` serves these keys (Thread, Membership do this), or
//   - call `participantAuthT(locale, key)` directly.

import { makeT, type I18nEntry } from './i18n.js';

export const PARTICIPANT_AUTH = {
  sign_in_google: {
    en: 'Continue with Google',
    nl: 'Doorgaan met Google',
    es: 'Continuar con Google',
    pt: 'Continuar com o Google',
    de: 'Weiter mit Google',
    fr: 'Continuer avec Google', // MT
  },
  email_me_code: {
    en: 'Email me a code',
    nl: 'Mail mij een code',
    es: 'Envíame un código',
    pt: 'Envie-me um código',
    de: 'Code per E-Mail senden',
    fr: 'Recevoir un code par e-mail', // MT
  },
  code_sent: {
    en: 'We sent an 8-digit code to {email}.',
    nl: 'We hebben een 8-cijferige code gestuurd naar {email}.',
    es: 'Hemos enviado un código de 8 dígitos a {email}.',
    pt: 'Enviamos um código de 8 dígitos para {email}.',
    de: 'Wir haben einen 8-stelligen Code an {email} gesendet.',
    fr: 'Nous avons envoyé un code à 8 chiffres à {email}.', // MT
  },
  enter_code: {
    en: 'Enter the 8-digit code',
    nl: 'Voer de 8-cijferige code in',
    es: 'Introduce el código de 8 dígitos',
    pt: 'Digite o código de 8 dígitos',
    de: 'Gib den 8-stelligen Code ein',
    fr: 'Saisis le code à 8 chiffres', // MT
  },
  verify_code: {
    en: 'Verify code',
    nl: 'Code bevestigen',
    es: 'Verificar código',
    pt: 'Verificar código',
    de: 'Code bestätigen',
    fr: 'Vérifier le code', // MT
  },
  sending: {
    en: 'Sending…',
    nl: 'Versturen…',
    es: 'Enviando…',
    pt: 'Enviando…',
    de: 'Wird gesendet…',
    fr: 'Envoi en cours…', // MT
  },
  verifying: {
    en: 'Verifying…',
    nl: 'Verifiëren…',
    es: 'Verificando…',
    pt: 'Verificando…',
    de: 'Wird geprüft…',
    fr: 'Vérification…', // MT
  },
  redirecting: {
    en: 'Redirecting…',
    nl: 'Doorsturen…',
    es: 'Redirigiendo…',
    pt: 'Redirecionando…',
    de: 'Weiterleitung…',
    fr: 'Redirection…', // MT
  },
  use_different_email: {
    en: 'Use a different email',
    nl: 'Gebruik een ander e-mailadres',
    es: 'Usar otro correo',
    pt: 'Usar outro e-mail',
    de: 'Andere E-Mail-Adresse verwenden',
    fr: 'Utiliser une autre adresse e-mail', // MT
  },
  code_send_failed: {
    en: "We couldn't send the code — check the address and try again.",
    nl: 'We konden de code niet versturen — controleer het adres en probeer het opnieuw.',
    es: 'No pudimos enviar el código — revisa la dirección e inténtalo de nuevo.',
    pt: 'Não foi possível enviar o código — verifique o endereço e tente novamente.',
    de: 'Der Code konnte nicht gesendet werden — prüfe die Adresse und versuche es erneut.',
    fr: "Impossible d'envoyer le code — vérifie l'adresse et réessaie.", // MT
  },
  code_invalid: {
    en: "That code didn't work — check it and try again.",
    nl: 'Die code werkte niet — controleer de code en probeer het opnieuw.',
    es: 'Ese código no funcionó — revísalo e inténtalo de nuevo.',
    pt: 'Esse código não funcionou — verifique e tente novamente.',
    de: 'Dieser Code hat nicht funktioniert — prüfe ihn und versuche es erneut.',
    fr: "Ce code n'a pas fonctionné — vérifie-le et réessaie.", // MT
  },
  something_wrong: {
    en: 'Something went wrong — please try again.',
    nl: 'Er ging iets mis — probeer het opnieuw.',
    es: 'Algo salió mal — inténtalo de nuevo.',
    pt: 'Algo deu errado — tente novamente.',
    de: 'Etwas ist schiefgelaufen — bitte versuche es erneut.',
    fr: 'Un problème est survenu — réessaie.', // MT
  },
} satisfies Record<string, I18nEntry>;

export type ParticipantAuthKey = keyof typeof PARTICIPANT_AUTH;

/** Translate a participant-auth key directly (apps that don't spread). */
export const participantAuthT = makeT(PARTICIPANT_AUTH);
