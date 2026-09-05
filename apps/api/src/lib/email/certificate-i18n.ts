// Certificate emails, in the thread's page language (i18n P1 — closes the
// "certificate email EN-only" build-plan item). Same typed-catalog rule as
// everywhere: a key missing a locale fails typecheck.
//
// All non-EN strings are machine-drafted (MT) pending native review;
// NL reviewed by Sjoerd before ship, ES/PT/DE/FR burn down opportunistically.

import { makeT, type I18nEntry } from '@thefibre/shared';

const CATALOG = {
  cert_subject: {
    en: 'Your certificate — {title}',
    nl: 'Je certificaat — {title}',
    es: 'Tu certificado — {title}', // MT
    pt: 'Seu certificado — {title}', // MT
    de: 'Dein Zertifikat — {title}', // MT
    fr: 'Ton certificat — {title}', // MT
  },
  cert_congrats: {
    en: 'Congratulations, {name}!',
    nl: 'Gefeliciteerd, {name}!',
    es: '¡Enhorabuena, {name}!', // MT
    pt: 'Parabéns, {name}!', // MT
    de: 'Herzlichen Glückwunsch, {name}!', // MT
    fr: 'Félicitations, {name} !', // MT
  },
  cert_ready: {
    en: 'Your certificate for {title} is ready:',
    nl: 'Je certificaat voor {title} staat klaar:',
    es: 'Tu certificado de {title} está listo:', // MT
    pt: 'Seu certificado de {title} está pronto:', // MT
    de: 'Dein Zertifikat für {title} ist fertig:', // MT
    fr: 'Ton certificat pour {title} est prêt :', // MT
  },
  cert_number_line: {
    en: 'Certificate number: {number}',
    nl: 'Certificaatnummer: {number}',
    es: 'Número de certificado: {number}', // MT
    pt: 'Número do certificado: {number}', // MT
    de: 'Zertifikatsnummer: {number}', // MT
    fr: 'Numéro de certificat : {number}', // MT
  },
  cert_hi: {
    en: 'Hi {name},',
    nl: 'Hoi {name},',
    es: 'Hola {name}:', // MT
    pt: 'Olá {name},', // MT
    de: 'Hallo {name},', // MT
    fr: 'Bonjour {name},', // MT
  },
  cert_ready_sentence: {
    en: 'Congratulations — your certificate for {title} is ready.',
    nl: 'Gefeliciteerd — je certificaat voor {title} staat klaar.',
    es: 'Enhorabuena — tu certificado de {title} está listo.', // MT
    pt: 'Parabéns — seu certificado de {title} está pronto.', // MT
    de: 'Herzlichen Glückwunsch — dein Zertifikat für {title} ist fertig.', // MT
    fr: 'Félicitations — ton certificat pour {title} est prêt.', // MT
  },
  cert_view: {
    en: 'View your certificate',
    nl: 'Bekijk je certificaat',
    es: 'Ver tu certificado', // MT
    pt: 'Ver seu certificado', // MT
    de: 'Zertifikat ansehen', // MT
    fr: 'Voir ton certificat', // MT
  },
  cert_footer: {
    en: 'Certificate {number} — this page verifies it, prints it, and adds it to your LinkedIn profile.',
    nl: 'Certificaat {number} — deze pagina verifieert het, print het en voegt het toe aan je LinkedIn-profiel.',
    es: 'Certificado {number} — esta página lo verifica, lo imprime y lo añade a tu perfil de LinkedIn.', // MT
    pt: 'Certificado {number} — esta página o verifica, imprime e adiciona ao seu perfil do LinkedIn.', // MT
    de: 'Zertifikat {number} — diese Seite verifiziert es, druckt es und fügt es deinem LinkedIn-Profil hinzu.', // MT
    fr: 'Certificat {number} — cette page le vérifie, l’imprime et l’ajoute à ton profil LinkedIn.', // MT
  },
} satisfies Record<string, I18nEntry>;

export const certT = makeT(CATALOG);
