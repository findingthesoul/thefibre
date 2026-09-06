// Strings for the SERVER-RENDERABLE shared chrome (settings hub, help page).
//
// These two modules are deliberately hook-free — `platformSettings()` is a
// plain function called from server pages — so `useLocale()` cannot reach
// them (a 'use client' catalog import would turn them into client refs).
// This file is plain TS: both server and client code may import it. The
// locale arrives as an explicit parameter from the caller's `uiLocale()`.
//
// Same rules as every catalog: all six locales or it fails typecheck;
// es/pt/de/fr machine-drafted lines carry `// MT`; NL is native quality
// (Sjoerd reviews). "The Fibre" and app names are brand — never translated.

import { makeT, type I18nEntry } from '../i18n.js';

const SERVER_CHROME = {
  // ── settings hub ─────────────────────────────────────────────────────
  section_you: {
    en: 'You',
    nl: 'Jij',
    es: 'Tú', // MT
    pt: 'Você', // MT
    de: 'Du', // MT
    fr: 'Toi', // MT
  },
  section_workspace: {
    en: 'Workspace',
    nl: 'Werkruimte',
    es: 'Espacio de trabajo', // MT
    pt: 'Espaço de trabalho', // MT
    de: 'Workspace', // MT
    fr: 'Espace de travail', // MT
  },
  in_the_fibre: {
    en: 'in The Fibre',
    nl: 'in The Fibre',
    es: 'en The Fibre', // MT
    pt: 'no The Fibre', // MT
    de: 'in The Fibre', // MT
    fr: 'dans The Fibre', // MT
  },
  st_profile_title: {
    en: 'Profile',
    nl: 'Profiel',
    es: 'Perfil', // MT
    pt: 'Perfil', // MT
    de: 'Profil', // MT
    fr: 'Profil', // MT
  },
  st_profile_desc: {
    en: 'Your name, photo, bio and timezone. Every app shows this one.',
    nl: 'Je naam, foto, bio en tijdzone. Elke app toont dit profiel.',
    es: 'Tu nombre, foto, bio y zona horaria. Todas las apps muestran este perfil.', // MT
    pt: 'Seu nome, foto, bio e fuso horário. Todos os apps mostram este perfil.', // MT
    de: 'Dein Name, Foto, deine Bio und Zeitzone. Jede App zeigt genau dieses Profil.', // MT
    fr: 'Ton nom, ta photo, ta bio et ton fuseau horaire. Chaque app affiche ce même profil.', // MT
  },
  st_connections_title: {
    en: 'Connections',
    nl: 'Koppelingen',
    es: 'Conexiones', // MT
    pt: 'Conexões', // MT
    de: 'Verbindungen', // MT
    fr: 'Connexions', // MT
  },
  st_connections_desc: {
    en: 'Your calendar and your personal meeting room — connected once, used by every app.',
    nl: 'Je agenda en je persoonlijke vergaderruimte — één keer gekoppeld, door elke app gebruikt.',
    es: 'Tu calendario y tu sala de reuniones personal — conectados una vez, usados por todas las apps.', // MT
    pt: 'Seu calendário e sua sala de reunião pessoal — conectados uma vez, usados por todos os apps.', // MT
    de: 'Dein Kalender und dein persönlicher Meetingraum — einmal verbunden, von jeder App genutzt.', // MT
    fr: 'Ton agenda et ta salle de réunion personnelle — connectés une fois, utilisés par chaque app.', // MT
  },
  st_payments_title: {
    en: 'Payments',
    nl: 'Betalingen',
    es: 'Pagos', // MT
    pt: 'Pagamentos', // MT
    de: 'Zahlungen', // MT
    fr: 'Paiements', // MT
  },
  st_payments_desc: {
    en: 'Where your money arrives: your Stripe account and the workspace’s.',
    nl: 'Waar je geld binnenkomt: jouw Stripe-account en dat van de werkruimte.',
    es: 'Dónde llega tu dinero: tu cuenta de Stripe y la del espacio de trabajo.', // MT
    pt: 'Onde seu dinheiro chega: sua conta Stripe e a do espaço de trabalho.', // MT
    de: 'Wo dein Geld ankommt: dein Stripe-Konto und das des Workspace.', // MT
    fr: 'Où arrive ton argent : ton compte Stripe et celui de l’espace de travail.', // MT
  },
  st_workspace_title: {
    en: 'Workspace',
    nl: 'Werkruimte',
    es: 'Espacio de trabajo', // MT
    pt: 'Espaço de trabalho', // MT
    de: 'Workspace', // MT
    fr: 'Espace de travail', // MT
  },
  st_workspace_desc: {
    en: 'Its name, logo, invoice details and the sender of its email.',
    nl: 'De naam, het logo, factuurgegevens en de afzender van de e-mail.',
    es: 'Su nombre, logo, datos de facturación y el remitente de su correo.', // MT
    pt: 'Seu nome, logo, dados de faturamento e o remetente do e-mail.', // MT
    de: 'Name, Logo, Rechnungsdaten und der Absender seiner E-Mails.', // MT
    fr: 'Son nom, son logo, ses coordonnées de facturation et l’expéditeur de ses e-mails.', // MT
  },
  st_members_title: {
    en: 'Members',
    nl: 'Leden',
    es: 'Miembros', // MT
    pt: 'Membros', // MT
    de: 'Mitglieder', // MT
    fr: 'Membres', // MT
  },
  st_members_desc: {
    en: 'Who is in the workspace, what they may do, and which apps they can use.',
    nl: 'Wie er in de werkruimte zit, wat ze mogen doen en welke apps ze kunnen gebruiken.',
    es: 'Quién está en el espacio, qué puede hacer y qué apps puede usar.', // MT
    pt: 'Quem está no espaço, o que pode fazer e quais apps pode usar.', // MT
    de: 'Wer im Workspace ist, was sie dürfen und welche Apps sie nutzen können.', // MT
    fr: 'Qui est dans l’espace, ce qu’ils peuvent faire et quelles apps ils peuvent utiliser.', // MT
  },
  st_apps_title: {
    en: 'Apps',
    nl: 'Apps',
    es: 'Apps', // MT
    pt: 'Apps', // MT
    de: 'Apps', // MT
    fr: 'Apps', // MT
  },
  st_apps_desc: {
    en: 'Which apps this workspace uses, and the keys that let your own software in.',
    nl: 'Welke apps deze werkruimte gebruikt, en de sleutels die je eigen software toegang geven.',
    es: 'Qué apps usa este espacio, y las claves que dan acceso a tu propio software.', // MT
    pt: 'Quais apps este espaço usa, e as chaves que dão acesso ao seu próprio software.', // MT
    de: 'Welche Apps dieser Workspace nutzt, und die Schlüssel für deine eigene Software.', // MT
    fr: 'Quelles apps cet espace utilise, et les clés qui laissent entrer ton propre logiciel.', // MT
  },
  st_currencies_title: {
    en: 'Currencies',
    nl: 'Valuta’s',
    es: 'Monedas', // MT
    pt: 'Moedas', // MT
    de: 'Währungen', // MT
    fr: 'Devises', // MT
  },
  st_currencies_desc: {
    en: 'Which currencies this workspace sells in, and the default — one list for everything priced.',
    nl: 'In welke valuta’s deze werkruimte verkoopt, en de standaard — één lijst voor alles met een prijs.',
    es: 'En qué monedas vende este espacio, y la predeterminada — una lista para todo lo que tiene precio.', // MT
    pt: 'Em quais moedas este espaço vende, e a padrão — uma lista para tudo que tem preço.', // MT
    de: 'In welchen Währungen dieser Workspace verkauft, und die Standardwährung — eine Liste für alles mit Preis.', // MT
    fr: 'Dans quelles devises cet espace vend, et celle par défaut — une seule liste pour tout ce qui a un prix.', // MT
  },
  st_plan_title: {
    en: 'Plan',
    nl: 'Abonnement',
    es: 'Plan', // MT
    pt: 'Plano', // MT
    de: 'Tarif', // MT
    fr: 'Formule', // MT
  },
  st_plan_desc: {
    en: 'What this workspace is on, and what it is using.',
    nl: 'Welk abonnement deze werkruimte heeft, en wat er wordt gebruikt.',
    es: 'Qué plan tiene este espacio, y qué está usando.', // MT
    pt: 'Qual plano este espaço tem, e o que está usando.', // MT
    de: 'Welchen Tarif dieser Workspace hat und was er nutzt.', // MT
    fr: 'La formule de cet espace, et ce qu’il utilise.', // MT
  },
  st_about_title: {
    en: 'How The Fibre works',
    nl: 'Hoe The Fibre werkt',
    es: 'Cómo funciona The Fibre', // MT
    pt: 'Como o The Fibre funciona', // MT
    de: 'Wie The Fibre funktioniert', // MT
    fr: 'Comment fonctionne The Fibre', // MT
  },
  st_about_desc: {
    en: 'The data wall, what each app owns, and why it is built this way.',
    nl: 'De datamuur, wat elke app bezit, en waarom het zo is gebouwd.',
    es: 'El muro de datos, qué posee cada app, y por qué está construido así.', // MT
    pt: 'O muro de dados, o que cada app possui, e por que foi construído assim.', // MT
    de: 'Die Datenmauer, was jeder App gehört und warum es so gebaut ist.', // MT
    fr: 'Le mur de données, ce que chaque app possède, et pourquoi c’est construit ainsi.', // MT
  },
  st_privacy_title: {
    en: 'Privacy',
    nl: 'Privacy',
    es: 'Privacidad', // MT
    pt: 'Privacidade', // MT
    de: 'Datenschutz', // MT
    fr: 'Confidentialité', // MT
  },
  st_privacy_desc: {
    en: 'Consents, your data, and asking for it to be removed.',
    nl: 'Toestemmingen, je gegevens, en vragen om verwijdering.',
    es: 'Consentimientos, tus datos, y cómo pedir que se eliminen.', // MT
    pt: 'Consentimentos, seus dados, e como pedir a remoção.', // MT
    de: 'Einwilligungen, deine Daten und wie du ihre Löschung anfragst.', // MT
    fr: 'Consentements, tes données, et comment demander leur suppression.', // MT
  },

  // ── help page ────────────────────────────────────────────────────────
  help_title: {
    en: 'Help',
    nl: 'Help',
    es: 'Ayuda', // MT
    pt: 'Ajuda', // MT
    de: 'Hilfe', // MT
    fr: 'Aide', // MT
  },
  help_getting_around: {
    en: 'Getting around {app}',
    nl: 'Wegwijs in {app}',
    es: 'Cómo moverte por {app}', // MT
    pt: 'Como navegar no {app}', // MT
    de: 'So findest du dich in {app} zurecht', // MT
    fr: 'Se repérer dans {app}', // MT
  },
  help_rest: {
    en: 'The rest of your Fibre',
    nl: 'De rest van je Fibre',
    es: 'El resto de tu Fibre', // MT
    pt: 'O resto do seu Fibre', // MT
    de: 'Der Rest deines Fibre', // MT
    fr: 'Le reste de ton Fibre', // MT
  },
  help_nothing_else: {
    en: 'Nothing else is switched on for you in this workspace.',
    nl: 'Er staat verder niets voor je aan in deze werkruimte.',
    es: 'No tienes nada más activado en este espacio de trabajo.', // MT
    pt: 'Nada mais está ativado para você neste espaço de trabalho.', // MT
    de: 'In diesem Workspace ist sonst nichts für dich freigeschaltet.', // MT
    fr: 'Rien d’autre n’est activé pour toi dans cet espace de travail.', // MT
  },
  help_each_one: {
    en: 'Each one has its own Help page, in the same place in its sidebar. You see this list because these apps are switched on for the workspace and you are a member of them.',
    nl: 'Elke app heeft een eigen Help-pagina, op dezelfde plek in de zijbalk. Je ziet deze lijst omdat deze apps aanstaan voor de werkruimte en jij er lid van bent.',
    es: 'Cada una tiene su propia página de Ayuda, en el mismo lugar de su barra lateral. Ves esta lista porque estas apps están activadas en el espacio y eres miembro de ellas.', // MT
    pt: 'Cada uma tem sua própria página de Ajuda, no mesmo lugar da barra lateral. Você vê esta lista porque esses apps estão ativados no espaço e você é membro deles.', // MT
    de: 'Jede hat ihre eigene Hilfeseite, an derselben Stelle in der Seitenleiste. Du siehst diese Liste, weil diese Apps für den Workspace aktiviert sind und du Mitglied bist.', // MT
    fr: 'Chacune a sa propre page d’aide, au même endroit dans sa barre latérale. Tu vois cette liste parce que ces apps sont activées pour l’espace et que tu en es membre.', // MT
  },
  help_read_more: {
    en: 'Read more',
    nl: 'Meer lezen',
    es: 'Leer más', // MT
    pt: 'Leia mais', // MT
    de: 'Mehr lesen', // MT
    fr: 'En savoir plus', // MT
  },
  help_how_works: {
    en: 'How The Fibre works',
    nl: 'Hoe The Fibre werkt',
    es: 'Cómo funciona The Fibre', // MT
    pt: 'Como o The Fibre funciona', // MT
    de: 'Wie The Fibre funktioniert', // MT
    fr: 'Comment fonctionne The Fibre', // MT
  },
  help_about_blurb: {
    en: 'What the platform holds and what each app holds, why so little is written down, what an outside app can and cannot reach, and a glossary of the words these pages use.',
    nl: 'Wat het platform bewaart en wat elke app bewaart, waarom er zo weinig wordt vastgelegd, wat een externe app wel en niet kan bereiken, en een woordenlijst van de termen op deze pagina’s.',
    es: 'Qué guarda la plataforma y qué guarda cada app, por qué se registra tan poco, qué puede y no puede alcanzar una app externa, y un glosario de los términos de estas páginas.', // MT
    pt: 'O que a plataforma guarda e o que cada app guarda, por que tão pouco é registrado, o que um app externo pode ou não alcançar, e um glossário dos termos destas páginas.', // MT
    de: 'Was die Plattform speichert und was jede App speichert, warum so wenig festgehalten wird, was eine externe App erreichen kann und was nicht, und ein Glossar der Begriffe dieser Seiten.', // MT
    fr: 'Ce que la plateforme conserve et ce que chaque app conserve, pourquoi si peu est consigné, ce qu’une app externe peut atteindre ou non, et un glossaire des termes de ces pages.', // MT
  },
} satisfies Record<string, I18nEntry>;

export const serverChromeT = makeT(SERVER_CHROME);
export type ServerChromeKey = keyof typeof SERVER_CHROME;
