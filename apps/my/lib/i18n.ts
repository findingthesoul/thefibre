// my.thread — every string the participant portal shows, in all six locales
// (2026-10-16; Sjoerd: "my.thread in six languages").
//
// THE RULE, the family's: a key missing a locale fails `pnpm typecheck`, so
// the catalog cannot go half-translated. The locale is the READER's
// (lib/locale.ts): server components take it from `pageLocale()`, client
// components from `useLocale()` (the layout wraps the app in a
// LocaleProvider, which the shared chrome — bottom nav, dialogs — reads too).
//
// Register is informal (je/du/tu/tú/você), as in Thread and Members, whose
// participant pages a reader reaches from here. "Thread" stays untranslated —
// it is the product word. Content is never translated: thread titles,
// organiser names, locations are what the organiser typed.
//
// es/pt/de/fr lines are machine-drafted (`// MT`) for native review; nl is
// written to native quality and reviewed by Sjoerd. pt is Brazilian, to match
// INTL_LOCALES.pt (pt-BR) — flip both together if review moves to pt-PT.
//
// The sign-in strings are NOT here twice: the email-code copy every
// participant surface shares comes from @thefibre/shared/participant-auth-i18n
// and is spread in below.
//
// Placeholders are {name}. Where a placeholder stands for a LINK or styled
// text rather than a string, render with `parts()` (lib/i18n-parts.tsx), so
// each language keeps its own word order around it.

import { makeT, type I18nEntry } from '@thefibre/shared/i18n';
import { PARTICIPANT_AUTH } from '@thefibre/shared/participant-auth-i18n';

const CATALOG = {
  ...PARTICIPANT_AUTH,

  // ── the frame: nav, bell, app switcher ───────────────────────────────
  nav_home: {
    en: 'Home',
    nl: 'Home',
    es: 'Inicio', // MT
    pt: 'Início', // MT
    de: 'Start', // MT
    fr: 'Accueil', // MT
  },
  nav_next: {
    en: 'Next',
    nl: 'Volgende',
    es: 'Lo próximo', // MT
    pt: 'A seguir', // MT
    de: 'Als Nächstes', // MT
    fr: 'À venir', // MT
  },
  nav_upcoming: {
    en: 'Upcoming',
    nl: 'Agenda',
    es: 'Agenda', // MT
    pt: 'Agenda', // MT
    de: 'Kalender', // MT
    fr: 'Agenda', // MT
  },
  nav_members: {
    en: 'Members',
    nl: 'Leden',
    es: 'Miembros', // MT
    pt: 'Membros', // MT
    de: 'Mitglieder', // MT
    fr: 'Membres', // MT
  },
  nav_you: {
    en: 'You',
    nl: 'Jij',
    es: 'Tú', // MT
    pt: 'Você', // MT
    de: 'Du', // MT
    fr: 'Toi', // MT
  },
  nav_memberships: {
    en: 'Memberships',
    nl: 'Lidmaatschappen',
    es: 'Membresías', // MT
    pt: 'Assinaturas', // MT
    de: 'Mitgliedschaften', // MT
    fr: 'Adhésions', // MT
  },
  nav_purchases: {
    en: 'Purchases',
    nl: 'Aankopen',
    es: 'Compras', // MT
    pt: 'Compras', // MT
    de: 'Käufe', // MT
    fr: 'Achats', // MT
  },
  nav_shop: {
    en: 'Shop',
    nl: 'Winkel',
    es: 'Tienda', // MT
    pt: 'Loja', // MT
    de: 'Shop', // MT
    fr: 'Boutique', // MT
  },
  shop_blurb: {
    en: 'What your communities offer you: add to your membership, buy, or subscribe.',
    nl: 'Wat je community’s je aanbieden: toevoegen aan je lidmaatschap, kopen of abonneren.',
    es: 'Lo que te ofrecen tus comunidades: añadir a tu membresía, comprar o suscribirte.', // MT
    pt: 'O que as suas comunidades lhe oferecem: adicionar à adesão, comprar ou subscrever.', // MT
    de: 'Was deine Communitys dir anbieten: zur Mitgliedschaft hinzufügen, kaufen oder abonnieren.', // MT
    fr: 'Ce que tes communautés te proposent : ajouter à ton adhésion, acheter ou t’abonner.', // MT
  },
  shop_members_only: {
    en: 'For members',
    nl: 'Voor leden',
    es: 'Para miembros', // MT
    pt: 'Para membros', // MT
    de: 'Für Mitglieder', // MT
    fr: 'Pour les membres', // MT
  },
  shop_open: {
    en: 'For everyone',
    nl: 'Voor iedereen',
    es: 'Para todos', // MT
    pt: 'Para todos', // MT
    de: 'Für alle', // MT
    fr: 'Pour tous', // MT
  },
  shop_owned: {
    en: 'You have this',
    nl: 'Heb je al',
    es: 'Ya lo tienes', // MT
    pt: 'Já tem', // MT
    de: 'Hast du schon', // MT
    fr: 'Tu l’as déjà', // MT
  },
  shop_add: {
    en: 'Add to membership',
    nl: 'Toevoegen aan lidmaatschap',
    es: 'Añadir a la membresía', // MT
    pt: 'Adicionar à adesão', // MT
    de: 'Zur Mitgliedschaft hinzufügen', // MT
    fr: 'Ajouter à l’adhésion', // MT
  },
  shop_buy: {
    en: 'Buy',
    nl: 'Kopen',
    es: 'Comprar', // MT
    pt: 'Comprar', // MT
    de: 'Kaufen', // MT
    fr: 'Acheter', // MT
  },
  shop_subscribe: {
    en: 'Subscribe',
    nl: 'Abonneren',
    es: 'Suscribirse', // MT
    pt: 'Subscrever', // MT
    de: 'Abonnieren', // MT
    fr: 'S’abonner', // MT
  },
  shop_stop_in_purchases: {
    en: 'Stop renewal in Purchases',
    nl: 'Verlenging stoppen bij Aankopen',
    es: 'Detener la renovación en Compras', // MT
    pt: 'Parar a renovação em Compras', // MT
    de: 'Verlängerung unter Käufe beenden', // MT
    fr: 'Arrêter le renouvellement dans Achats', // MT
  },
  shop_empty_title: {
    en: 'Nothing on offer right now',
    nl: 'Op dit moment geen aanbod',
    es: 'Nada disponible por ahora', // MT
    pt: 'Nada disponível de momento', // MT
    de: 'Gerade kein Angebot', // MT
    fr: 'Rien à proposer pour l’instant', // MT
  },
  shop_empty_body: {
    en: 'When a community you belong to offers something you can add or buy, it shows here.',
    nl: 'Als een community waar je bij hoort iets aanbiedt dat je kunt toevoegen of kopen, zie je het hier.',
    es: 'Cuando una comunidad a la que perteneces ofrezca algo que puedas añadir o comprar, aparecerá aquí.', // MT
    pt: 'Quando uma comunidade a que pertence oferecer algo que possa adicionar ou comprar, aparece aqui.', // MT
    de: 'Wenn eine Community, zu der du gehörst, etwas anbietet, das du hinzufügen oder kaufen kannst, erscheint es hier.', // MT
    fr: 'Quand une communauté dont tu fais partie propose quelque chose à ajouter ou acheter, cela apparaît ici.', // MT
  },
  shop_failed: {
    en: 'The shop did not load just now. Try again in a moment.',
    nl: 'De winkel laadde nu niet. Probeer het zo opnieuw.',
    es: 'La tienda no se cargó ahora. Inténtalo de nuevo en un momento.', // MT
    pt: 'A loja não carregou agora. Tente de novo daqui a pouco.', // MT
    de: 'Der Shop wurde gerade nicht geladen. Versuche es gleich noch einmal.', // MT
    fr: 'La boutique ne s’est pas chargée. Réessaie dans un instant.', // MT
  },
  shop_need_details: {
    en: 'Add your country under Purchases → Billing details first; prices are shown before VAT.',
    nl: 'Vul eerst je land in bij Aankopen → Factuurgegevens; prijzen zijn exclusief btw.',
    es: 'Indica primero tu país en Compras → Datos de facturación; los precios no incluyen IVA.', // MT
    pt: 'Indique primeiro o seu país em Compras → Dados de faturação; os preços não incluem IVA.', // MT
    de: 'Gib zuerst dein Land unter Käufe → Rechnungsdaten an; Preise verstehen sich ohne MwSt.', // MT
    fr: 'Indique d’abord ton pays dans Achats → Coordonnées de facturation ; les prix sont hors TVA.', // MT
  },
  shop_paid_thanks: {
    en: 'Thank you — your payment went through. It appears here in a moment; refresh if it has not yet.',
    nl: 'Dank je — je betaling is gelukt. Hij verschijnt hier zo; ververs de pagina als hij er nog niet staat.',
    es: 'Gracias: tu pago se ha realizado. Aparecerá aquí en un momento; actualiza si aún no está.', // MT
    pt: 'Obrigado — o seu pagamento foi efetuado. Aparece aqui dentro de momentos; atualize se ainda não estiver.', // MT
    de: 'Danke – deine Zahlung ist durch. Sie erscheint hier gleich; lade neu, falls sie noch fehlt.', // MT
    fr: 'Merci — ton paiement est passé. Il apparaît ici dans un instant ; actualise s’il n’y est pas encore.', // MT
  },
  shop_members_unavailable: {
    en: 'Couldn’t load your member offers just now. Refresh to try again.',
    nl: 'Je ledenaanbod kon nu niet worden geladen. Ververs de pagina om het opnieuw te proberen.',
    es: 'No se pudieron cargar tus ofertas de miembro ahora. Actualiza para volver a intentarlo.', // MT
    pt: 'Não foi possível carregar as suas ofertas de membro agora. Atualize para tentar de novo.', // MT
    de: 'Deine Mitgliederangebote konnten gerade nicht geladen werden. Lade neu, um es erneut zu versuchen.', // MT
    fr: 'Impossible de charger tes offres de membre pour l’instant. Actualise pour réessayer.', // MT
  },
  shop_already: {
    en: 'You already have {name}.',
    nl: 'Je hebt {name} al.',
    es: 'Ya tienes {name}.', // MT
    pt: 'Já tem {name}.', // MT
    de: 'Du hast {name} schon.', // MT
    fr: 'Tu as déjà {name}.', // MT
  },
  drive_all_files: {
    en: 'All files',
    nl: 'Alle bestanden',
    es: 'Todos los archivos', // MT
    pt: 'Todos os ficheiros', // MT
    de: 'Alle Dateien', // MT
    fr: 'Tous les fichiers', // MT
  },
  drive_empty: {
    en: 'This folder is empty.',
    nl: 'Deze map is leeg.',
    es: 'Esta carpeta está vacía.', // MT
    pt: 'Esta pasta está vazia.', // MT
    de: 'Dieser Ordner ist leer.', // MT
    fr: 'Ce dossier est vide.', // MT
  },
  drive_not_found: {
    en: 'This folder isn’t available to you.',
    nl: 'Deze map is niet voor jou beschikbaar.',
    es: 'Esta carpeta no está disponible para ti.', // MT
    pt: 'Esta pasta não está disponível para si.', // MT
    de: 'Dieser Ordner ist für dich nicht verfügbar.', // MT
    fr: 'Ce dossier ne t’est pas accessible.', // MT
  },
  drive_not_shared: {
    en: 'This folder can’t be opened right now: it is no longer shared with the community. Let the community know.',
    nl: 'Deze map kan nu niet worden geopend: hij wordt niet meer met de community gedeeld. Laat het de community weten.',
    es: 'Esta carpeta no se puede abrir ahora: ya no se comparte con la comunidad. Avisa a la comunidad.', // MT
    pt: 'Esta pasta não pode ser aberta agora: já não é partilhada com a comunidade. Avise a comunidade.', // MT
    de: 'Dieser Ordner kann gerade nicht geöffnet werden: Er wird nicht mehr mit der Community geteilt. Sag der Community Bescheid.', // MT
    fr: 'Ce dossier ne peut pas être ouvert : il n’est plus partagé avec la communauté. Préviens la communauté.', // MT
  },
  drive_unavailable: {
    en: 'Google Drive isn’t answering right now. Try again in a moment.',
    nl: 'Google Drive reageert nu niet. Probeer het zo opnieuw.',
    es: 'Google Drive no responde ahora. Inténtalo de nuevo en un momento.', // MT
    pt: 'O Google Drive não está a responder. Tente de novo daqui a pouco.', // MT
    de: 'Google Drive antwortet gerade nicht. Versuche es gleich noch einmal.', // MT
    fr: 'Google Drive ne répond pas pour l’instant. Réessaie dans un instant.', // MT
  },
  drive_failed: {
    en: 'The folder didn’t load just now. Try again in a moment.',
    nl: 'De map laadde nu niet. Probeer het zo opnieuw.',
    es: 'La carpeta no se cargó ahora. Inténtalo de nuevo en un momento.', // MT
    pt: 'A pasta não carregou agora. Tente de novo daqui a pouco.', // MT
    de: 'Der Ordner wurde gerade nicht geladen. Versuche es gleich noch einmal.', // MT
    fr: 'Le dossier ne s’est pas chargé. Réessaie dans un instant.', // MT
  },
  drive_too_large: {
    en: 'Too large to download here',
    nl: 'Te groot om hier te downloaden',
    es: 'Demasiado grande para descargar aquí', // MT
    pt: 'Demasiado grande para transferir aqui', // MT
    de: 'Zu groß zum Herunterladen hier', // MT
    fr: 'Trop volumineux pour être téléchargé ici', // MT
  },
  drive_not_exportable: {
    en: 'Can’t be downloaded',
    nl: 'Kan niet worden gedownload',
    es: 'No se puede descargar', // MT
    pt: 'Não pode ser transferido', // MT
    de: 'Kann nicht heruntergeladen werden', // MT
    fr: 'Ne peut pas être téléchargé', // MT
  },
  drive_download_failed: {
    en: 'That file couldn’t be downloaded just now. Try again in a moment.',
    nl: 'Dat bestand kon nu niet worden gedownload. Probeer het zo opnieuw.',
    es: 'Ese archivo no se pudo descargar ahora. Inténtalo de nuevo en un momento.', // MT
    pt: 'Esse ficheiro não pôde ser transferido agora. Tente de novo daqui a pouco.', // MT
    de: 'Diese Datei konnte gerade nicht heruntergeladen werden. Versuche es gleich noch einmal.', // MT
    fr: 'Ce fichier n’a pas pu être téléchargé. Réessaie dans un instant.', // MT
  },
  drive_changed: {
    en: 'Changed {date}',
    nl: 'Gewijzigd {date}',
    es: 'Modificado {date}', // MT
    pt: 'Alterado {date}', // MT
    de: 'Geändert {date}', // MT
    fr: 'Modifié {date}', // MT
  },
  drive_as_pdf: {
    en: 'PDF',
    nl: 'PDF',
    es: 'PDF', // MT
    pt: 'PDF', // MT
    de: 'PDF', // MT
    fr: 'PDF', // MT
  },
  drive_too_large_over: {
    en: 'Over {size}, too large to download here',
    nl: 'Groter dan {size}, te groot om hier te downloaden',
    es: 'Más de {size}: demasiado grande para descargar aquí', // MT
    pt: 'Mais de {size}: demasiado grande para transferir aqui', // MT
    de: 'Über {size}, zu groß zum Herunterladen hier', // MT
    fr: 'Plus de {size} : trop volumineux pour être téléchargé ici', // MT
  },
  drive_export_too_large: {
    en: 'This document is too large to turn into a PDF here (over {size}).',
    nl: 'Dit document is te groot om hier een pdf van te maken (meer dan {size}).',
    es: 'Este documento es demasiado grande para convertirlo en PDF aquí (más de {size}).', // MT
    pt: 'Este documento é demasiado grande para converter em PDF aqui (mais de {size}).', // MT
    de: 'Dieses Dokument ist zu groß, um es hier in ein PDF umzuwandeln (über {size}).', // MT
    fr: 'Ce document est trop volumineux pour être converti en PDF ici (plus de {size}).', // MT
  },
  drive_not_configured: {
    en: 'Google Drive isn’t set up here yet.',
    nl: 'Google Drive is hier nog niet ingesteld.',
    es: 'Google Drive aún no está configurado aquí.', // MT
    pt: 'O Google Drive ainda não está configurado aqui.', // MT
    de: 'Google Drive ist hier noch nicht eingerichtet.', // MT
    fr: 'Google Drive n’est pas encore configuré ici.', // MT
  },
  drive_not_exportable_long: {
    en: 'That file can’t be downloaded here.',
    nl: 'Dat bestand kan hier niet worden gedownload.',
    es: 'Ese archivo no se puede descargar aquí.', // MT
    pt: 'Esse ficheiro não pode ser transferido aqui.', // MT
    de: 'Diese Datei kann hier nicht heruntergeladen werden.', // MT
    fr: 'Ce fichier ne peut pas être téléchargé ici.', // MT
  },
  nav_files: {
    en: 'Files',
    nl: 'Bestanden',
    es: 'Archivos', // MT
    pt: 'Arquivos', // MT
    de: 'Dateien', // MT
    fr: 'Fichiers', // MT
  },
  notifications: {
    en: 'Notifications',
    nl: 'Meldingen',
    es: 'Notificaciones', // MT
    pt: 'Notificações', // MT
    de: 'Benachrichtigungen', // MT
    fr: 'Notifications', // MT
  },
  notifications_unread: {
    en: 'Notifications, {n} unread',
    nl: 'Meldingen, {n} ongelezen',
    es: 'Notificaciones, {n} sin leer', // MT
    pt: 'Notificações, {n} não lidas', // MT
    de: 'Benachrichtigungen, {n} ungelesen', // MT
    fr: 'Notifications, {n} non lues', // MT
  },
  your_other_apps: {
    en: 'Your other apps',
    nl: 'Je andere apps',
    es: 'Tus otras apps', // MT
    pt: 'Seus outros apps', // MT
    de: 'Deine anderen Apps', // MT
    fr: 'Tes autres apps', // MT
  },
  your_apps: {
    en: 'Your apps',
    nl: 'Je apps',
    es: 'Tus apps', // MT
    pt: 'Seus apps', // MT
    de: 'Deine Apps', // MT
    fr: 'Tes apps', // MT
  },

  // ── signed out ───────────────────────────────────────────────────────
  // English is SURFACES['my-portal'].tagline, word for word (i18n.test.ts
  // holds the two together): the registry is what menus elsewhere show.
  tagline: {
    en: 'Everything you’re part of, in one place.',
    nl: 'Alles waar je bij hoort, op één plek.',
    es: 'Todo aquello de lo que formas parte, en un solo lugar.', // MT
    pt: 'Tudo de que você faz parte, em um só lugar.', // MT
    de: 'Alles, wovon du ein Teil bist, an einem Ort.', // MT
    fr: 'Tout ce dont tu fais partie, au même endroit.', // MT
  },
  language: {
    en: 'Language',
    nl: 'Taal',
    es: 'Idioma', // MT
    pt: 'Idioma', // MT
    de: 'Sprache', // MT
    fr: 'Langue', // MT
  },
  your_email: {
    en: 'Your email',
    nl: 'Je e-mailadres',
    es: 'Tu correo electrónico', // MT
    pt: 'Seu e-mail', // MT
    de: 'Deine E-Mail-Adresse', // MT
    fr: 'Ton adresse e-mail', // MT
  },
  email_hint: {
    en: 'Use the address you booked with — that’s how we find your things.',
    nl: 'Gebruik het adres waarmee je hebt geboekt — zo vinden we je spullen.',
    es: 'Usa la dirección con la que reservaste: así encontramos lo tuyo.', // MT
    pt: 'Use o endereço com que você reservou — é assim que encontramos suas coisas.', // MT
    de: 'Nimm die Adresse, mit der du gebucht hast – so finden wir deine Sachen.', // MT
    fr: 'Utilise l’adresse avec laquelle tu as réservé : c’est ainsi que nous retrouvons tes affaires.', // MT
  },
  code_placeholder: {
    en: '8-digit code',
    nl: '8-cijferige code',
    es: 'Código de 8 dígitos', // MT
    pt: 'Código de 8 dígitos', // MT
    de: '8-stelliger Code', // MT
    fr: 'Code à 8 chiffres', // MT
  },
  sign_in: {
    en: 'Sign in',
    nl: 'Inloggen',
    es: 'Entrar', // MT
    pt: 'Entrar', // MT
    de: 'Anmelden', // MT
    fr: 'Se connecter', // MT
  },
  // Supabase's rate limit, which used to reach the reader as its own English
  // sentence. Every other failure is PARTICIPANT_AUTH's two.
  code_wait: {
    en: 'Please wait a minute before asking for another code.',
    nl: 'Wacht even een minuut voordat je een nieuwe code vraagt.',
    es: 'Espera un minuto antes de pedir otro código.', // MT
    pt: 'Aguarde um minuto antes de pedir outro código.', // MT
    de: 'Bitte warte eine Minute, bevor du einen neuen Code anforderst.', // MT
    fr: 'Attends une minute avant de demander un nouveau code.', // MT
  },

  // ── the error page ───────────────────────────────────────────────────
  error_title: {
    en: 'Your page did not load this time.',
    nl: 'Je pagina laadde deze keer niet.',
    es: 'Tu página no se ha cargado esta vez.', // MT
    pt: 'Sua página não carregou desta vez.', // MT
    de: 'Deine Seite hat diesmal nicht geladen.', // MT
    fr: 'Ta page ne s’est pas chargée cette fois.', // MT
  },
  error_body: {
    en: 'Nothing has changed on your side — your tickets and memberships are where they were. Try again in a moment.',
    nl: 'Aan jouw kant is niets veranderd — je tickets en lidmaatschappen staan waar ze stonden. Probeer het zo nog eens.',
    es: 'No ha cambiado nada por tu parte: tus entradas y membresías siguen donde estaban. Vuelve a intentarlo en un momento.', // MT
    pt: 'Nada mudou do seu lado — seus ingressos e assinaturas continuam onde estavam. Tente de novo daqui a pouco.', // MT
    de: 'Bei dir hat sich nichts geändert – deine Tickets und Mitgliedschaften sind noch da. Versuch es gleich noch einmal.', // MT
    fr: 'Rien n’a changé de ton côté : tes billets et adhésions sont toujours là. Réessaie dans un instant.', // MT
  },
  try_again: {
    en: 'Try again',
    nl: 'Opnieuw proberen',
    es: 'Reintentar', // MT
    pt: 'Tentar de novo', // MT
    de: 'Erneut versuchen', // MT
    fr: 'Réessayer', // MT
  },

  // ── Next ─────────────────────────────────────────────────────────────
  hello: {
    en: 'Hello, {name}',
    nl: 'Hallo, {name}',
    es: 'Hola, {name}', // MT
    pt: 'Olá, {name}', // MT
    de: 'Hallo, {name}', // MT
    fr: 'Bonjour, {name}', // MT
  },
  nothing_coming: {
    en: 'Nothing coming up.',
    nl: 'Er staat niets gepland.',
    es: 'No hay nada próximamente.', // MT
    pt: 'Nada por vir.', // MT
    de: 'Nichts in Sicht.', // MT
    fr: 'Rien à venir.', // MT
  },
  nothing_coming_body: {
    en: 'When you book a place or a call, it appears here — soonest first. If you expected something, check you signed in with the address you booked with.',
    nl: 'Als je een plek of een gesprek boekt, verschijnt het hier — het eerstvolgende bovenaan. Verwachtte je iets? Kijk dan of je bent ingelogd met het adres waarmee je hebt geboekt.',
    es: 'Cuando reserves una plaza o una llamada, aparecerá aquí, lo más próximo primero. Si esperabas algo, comprueba que has entrado con la dirección con la que reservaste.', // MT
    pt: 'Quando você reservar uma vaga ou uma conversa, ela aparece aqui — a mais próxima primeiro. Se esperava algo, confira se entrou com o endereço com que reservou.', // MT
    de: 'Wenn du einen Platz oder ein Gespräch buchst, erscheint es hier – das Nächste zuerst. Falls du etwas erwartet hast, prüfe, ob du dich mit der Adresse angemeldet hast, mit der du gebucht hast.', // MT
    fr: 'Quand tu réserves une place ou un appel, il apparaît ici, le plus proche en premier. Si tu attendais quelque chose, vérifie que tu t’es connecté·e avec l’adresse utilisée pour réserver.', // MT
  },
  // {link} is subscribe_link, rendered as a link to /you.
  subscribe_line: {
    en: '{link} to follow every session, so moved dates move.',
    nl: '{link} om elke sessie te volgen, zodat verschoven data meeschuiven.',
    es: '{link} para seguir cada sesión, así las fechas que cambian se actualizan solas.', // MT
    pt: '{link} para acompanhar cada sessão, assim as datas alteradas se atualizam sozinhas.', // MT
    de: '{link}, um jeder Sitzung zu folgen – verschobene Termine verschieben sich mit.', // MT
    fr: '{link} pour suivre chaque séance : les dates déplacées se mettent à jour d’elles-mêmes.', // MT
  },
  subscribe_link: {
    en: 'Subscribe your calendar',
    nl: 'Abonneer je agenda',
    es: 'Suscribe tu calendario', // MT
    pt: 'Assine no seu calendário', // MT
    de: 'Abonniere deinen Kalender', // MT
    fr: 'Abonne ton agenda', // MT
  },

  // ── the timeline ─────────────────────────────────────────────────────
  join: {
    en: 'Join',
    nl: 'Deelnemen',
    es: 'Unirse', // MT
    pt: 'Entrar', // MT
    de: 'Beitreten', // MT
    fr: 'Rejoindre', // MT
  },
  certificate: {
    en: 'Certificate',
    nl: 'Certificaat',
    es: 'Certificado', // MT
    pt: 'Certificado', // MT
    de: 'Zertifikat', // MT
    fr: 'Certificat', // MT
  },
  you_host: {
    en: 'You’re hosting',
    nl: 'Jij host',
    es: 'Tú presentas', // MT
    pt: 'Você é o anfitrião', // MT
    de: 'Du bist Gastgeber:in', // MT
    fr: 'Tu animes', // MT
  },
  you_facilitate: {
    en: 'You’re facilitating',
    nl: 'Jij begeleidt',
    es: 'Tú facilitas', // MT
    pt: 'Você facilita', // MT
    de: 'Du moderierst', // MT
    fr: 'Tu facilites', // MT
  },
  // A meet's line when it has no location: the person it is with.
  with_people: {
    en: 'with {names}',
    nl: 'met {names}',
    es: 'con {names}', // MT
    pt: 'com {names}', // MT
    de: 'mit {names}', // MT
    fr: 'avec {names}', // MT
  },
  have_ticket: {
    en: 'You have a ticket',
    nl: 'Je hebt een ticket',
    es: 'Tienes una entrada', // MT
    pt: 'Você tem um ingresso', // MT
    de: 'Du hast ein Ticket', // MT
    fr: 'Tu as un billet', // MT
  },
  everyone: {
    en: 'Everyone',
    nl: 'Iedereen',
    es: 'Todos', // MT
    pt: 'Todos', // MT
    de: 'Alle', // MT
    fr: 'Tous', // MT
  },
  all_threads: {
    en: 'All threads',
    nl: 'Alle threads',
    es: 'Todos los threads', // MT
    pt: 'Todos os threads', // MT
    de: 'Alle Threads', // MT
    fr: 'Tous les threads', // MT
  },
  owed_one: {
    en: '1 still needs an answer',
    nl: '1 wacht nog op je antwoord',
    es: '1 aún necesita respuesta', // MT
    pt: '1 ainda precisa de resposta', // MT
    de: '1 wartet noch auf deine Antwort', // MT
    fr: '1 attend encore ta réponse', // MT
  },
  owed_many: {
    en: '{n} still need an answer',
    nl: '{n} wachten nog op je antwoord',
    es: '{n} aún necesitan respuesta', // MT
    pt: '{n} ainda precisam de resposta', // MT
    de: '{n} warten noch auf deine Antwort', // MT
    fr: '{n} attendent encore ta réponse', // MT
  },
  show_all: {
    en: '· show all',
    nl: '· toon alles',
    es: '· ver todo', // MT
    pt: '· ver tudo', // MT
    de: '· alle zeigen', // MT
    fr: '· tout afficher', // MT
  },
  nothing_in: {
    en: 'Nothing coming up in {title}.',
    nl: 'Niets gepland in {title}.',
    es: 'Nada próximamente en {title}.', // MT
    pt: 'Nada por vir em {title}.', // MT
    de: 'Nichts in Sicht in {title}.', // MT
    fr: 'Rien à venir dans {title}.', // MT
  },
  this_thread: {
    en: 'this thread',
    nl: 'deze thread',
    es: 'este thread', // MT
    pt: 'este thread', // MT
    de: 'diesem Thread', // MT
    fr: 'ce thread', // MT
  },
  nothing_with: {
    en: 'Nothing coming up with {name}.',
    nl: 'Niets gepland bij {name}.',
    es: 'Nada próximamente con {name}.', // MT
    pt: 'Nada por vir com {name}.', // MT
    de: 'Nichts in Sicht bei {name}.', // MT
    fr: 'Rien à venir avec {name}.', // MT
  },
  hide_earlier: {
    en: 'Hide earlier',
    nl: 'Eerdere verbergen',
    es: 'Ocultar anteriores', // MT
    pt: 'Ocultar anteriores', // MT
    de: 'Frühere ausblenden', // MT
    fr: 'Masquer les précédents', // MT
  },
  earlier: {
    en: 'Earlier ({n})',
    nl: 'Eerder ({n})',
    es: 'Anteriores ({n})', // MT
    pt: 'Anteriores ({n})', // MT
    de: 'Früher ({n})', // MT
    fr: 'Précédents ({n})', // MT
  },

  // ── RSVP ─────────────────────────────────────────────────────────────
  rsvp_label: {
    en: 'RSVP',
    nl: 'RSVP',
    es: 'RSVP', // MT
    pt: 'RSVP', // MT
    de: 'Zusage', // MT
    fr: 'RSVP', // MT
  },
  rsvp_coming: {
    en: 'Coming',
    nl: 'Ik kom',
    es: 'Voy', // MT
    pt: 'Vou', // MT
    de: 'Ich komme', // MT
    fr: 'Je viens', // MT
  },
  rsvp_not_coming: {
    en: 'Can’t come',
    nl: 'Kan niet',
    es: 'No puedo ir', // MT
    pt: 'Não posso ir', // MT
    de: 'Kann nicht', // MT
    fr: 'Je ne peux pas', // MT
  },
  rsvp_none: {
    en: 'No answer yet',
    nl: 'Nog geen antwoord',
    es: 'Sin respuesta aún', // MT
    pt: 'Ainda sem resposta', // MT
    de: 'Noch keine Antwort', // MT
    fr: 'Pas encore de réponse', // MT
  },
  // The NEXT state, inside "Tap for {next}" — lower case where the language
  // writes it so mid-sentence.
  rsvp_next_coming: {
    en: 'coming',
    nl: 'ik kom',
    es: 'voy', // MT
    pt: 'vou', // MT
    de: 'ich komme', // MT
    fr: 'je viens', // MT
  },
  rsvp_next_not_coming: {
    en: 'can’t come',
    nl: 'kan niet',
    es: 'no puedo ir', // MT
    pt: 'não posso ir', // MT
    de: 'kann nicht', // MT
    fr: 'je ne peux pas', // MT
  },
  rsvp_next_none: {
    en: 'no answer',
    nl: 'geen antwoord',
    es: 'sin respuesta', // MT
    pt: 'sem resposta', // MT
    de: 'keine Antwort', // MT
    fr: 'pas de réponse', // MT
  },
  rsvp_aria: {
    en: '{now} — {title}. Tap for {next}.',
    nl: '{now} — {title}. Tik voor ‘{next}’.',
    es: '{now} — {title}. Toca para «{next}».', // MT
    pt: '{now} — {title}. Toque para “{next}”.', // MT
    de: '{now} — {title}. Tippen für „{next}“.', // MT
    fr: '{now} — {title}. Touche pour « {next} ».', // MT
  },
  rsvp_title: {
    en: '{now} · tap for {next}',
    nl: '{now} · tik voor ‘{next}’',
    es: '{now} · toca para «{next}»', // MT
    pt: '{now} · toque para “{next}”', // MT
    de: '{now} · tippen für „{next}“', // MT
    fr: '{now} · touche pour « {next} »', // MT
  },
  rsvp_hint: {
    en: '{now}. Tap for {next}.',
    nl: '{now}. Tik voor ‘{next}’.',
    es: '{now}. Toca para «{next}».', // MT
    pt: '{now}. Toque para “{next}”.', // MT
    de: '{now}. Tippen für „{next}“.', // MT
    fr: '{now}. Touche pour « {next} ».', // MT
  },
  rsvp_failed: {
    en: 'That didn’t save. Check your connection and try again.',
    nl: 'Dat is niet opgeslagen. Controleer je verbinding en probeer het opnieuw.',
    es: 'No se ha guardado. Comprueba tu conexión e inténtalo de nuevo.', // MT
    pt: 'Não foi salvo. Verifique sua conexão e tente de novo.', // MT
    de: 'Das wurde nicht gespeichert. Prüfe deine Verbindung und versuch es noch einmal.', // MT
    fr: 'Ce n’a pas été enregistré. Vérifie ta connexion et réessaie.', // MT
  },

  // ── a thread's sheet ─────────────────────────────────────────────────
  open_link: {
    en: 'Open link',
    nl: 'Link openen',
    es: 'Abrir enlace', // MT
    pt: 'Abrir link', // MT
    de: 'Link öffnen', // MT
    fr: 'Ouvrir le lien', // MT
  },
  add_to_calendar: {
    en: 'Add to calendar',
    nl: 'Toevoegen aan agenda',
    es: 'Añadir al calendario', // MT
    pt: 'Adicionar ao calendário', // MT
    de: 'Zum Kalender hinzufügen', // MT
    fr: 'Ajouter à l’agenda', // MT
  },
  add_all_to_calendar: {
    en: 'Add all to calendar',
    nl: 'Alles toevoegen aan agenda',
    es: 'Añadir todo al calendario', // MT
    pt: 'Adicionar tudo ao calendário', // MT
    de: 'Alle zum Kalender hinzufügen', // MT
    fr: 'Tout ajouter à l’agenda', // MT
  },
  qr_enlarge: {
    en: 'Show the check-in code full size',
    nl: 'Toon de check-incode op volle grootte',
    es: 'Mostrar el código de acceso a tamaño completo', // MT
    pt: 'Mostrar o código de check-in em tamanho grande', // MT
    de: 'Check-in-Code in voller Größe zeigen', // MT
    fr: 'Afficher le code d’entrée en grand', // MT
  },
  qr_alt: {
    en: 'Check-in code for {title}',
    nl: 'Check-incode voor {title}',
    es: 'Código de acceso para {title}', // MT
    pt: 'Código de check-in para {title}', // MT
    de: 'Check-in-Code für {title}', // MT
    fr: 'Code d’entrée pour {title}', // MT
  },
  ticket_for: {
    en: 'Ticket for {title}',
    nl: 'Ticket voor {title}',
    es: 'Entrada para {title}', // MT
    pt: 'Ingresso para {title}', // MT
    de: 'Ticket für {title}', // MT
    fr: 'Billet pour {title}', // MT
  },
  already_checked_in: {
    en: 'Already checked in',
    nl: 'Al ingecheckt',
    es: 'Ya registrado', // MT
    pt: 'Check-in já feito', // MT
    de: 'Bereits eingecheckt', // MT
    fr: 'Déjà enregistré', // MT
  },
  checked_in: {
    en: 'Checked in',
    nl: 'Ingecheckt',
    es: 'Registrado', // MT
    pt: 'Check-in feito', // MT
    de: 'Eingecheckt', // MT
    fr: 'Enregistré', // MT
  },
  show_at_door: {
    en: 'Show this at the door',
    nl: 'Laat dit zien bij de deur',
    es: 'Muéstralo en la entrada', // MT
    pt: 'Mostre isto na entrada', // MT
    de: 'Zeig das am Eingang', // MT
    fr: 'Montre-le à l’entrée', // MT
  },
  tap_to_show: {
    en: 'Tap to show at the door',
    nl: 'Tik om te laten zien bij de deur',
    es: 'Toca para mostrarlo en la entrada', // MT
    pt: 'Toque para mostrar na entrada', // MT
    de: 'Tippen, um es am Eingang zu zeigen', // MT
    fr: 'Touche pour le montrer à l’entrée', // MT
  },
  tap_to_enlarge: {
    en: 'Tap the code to enlarge.',
    nl: 'Tik op de code om hem te vergroten.',
    es: 'Toca el código para ampliarlo.', // MT
    pt: 'Toque no código para ampliar.', // MT
    de: 'Tippe auf den Code, um ihn zu vergrößern.', // MT
    fr: 'Touche le code pour l’agrandir.', // MT
  },
  tap_to_close: {
    en: 'Tap anywhere to close',
    nl: 'Tik ergens om te sluiten',
    es: 'Toca en cualquier lugar para cerrar', // MT
    pt: 'Toque em qualquer lugar para fechar', // MT
    de: 'Irgendwo tippen zum Schließen', // MT
    fr: 'Touche n’importe où pour fermer', // MT
  },
  add_apple_wallet: {
    en: 'Add to Apple Wallet',
    nl: 'Toevoegen aan Apple Wallet',
    es: 'Añadir a Apple Wallet', // MT
    pt: 'Adicionar à Apple Wallet', // MT
    de: 'Zu Apple Wallet hinzufügen', // MT
    fr: 'Ajouter à Apple Wallet', // MT
  },
  save_google_wallet: {
    en: 'Save to Google Wallet',
    nl: 'Opslaan in Google Wallet',
    es: 'Guardar en Google Wallet', // MT
    pt: 'Salvar na Google Wallet', // MT
    de: 'In Google Wallet speichern', // MT
    fr: 'Enregistrer dans Google Wallet', // MT
  },
  agenda: {
    en: 'Agenda',
    nl: 'Programma',
    es: 'Programa', // MT
    pt: 'Programação', // MT
    de: 'Programm', // MT
    fr: 'Programme', // MT
  },
  no_agenda: {
    en: 'No agenda published yet.',
    nl: 'Nog geen programma gepubliceerd.',
    es: 'Aún no se ha publicado el programa.', // MT
    pt: 'Nenhuma programação publicada ainda.', // MT
    de: 'Noch kein Programm veröffentlicht.', // MT
    fr: 'Aucun programme publié pour l’instant.', // MT
  },
  open_full_page: {
    en: 'Open the full page',
    nl: 'Open de volledige pagina',
    es: 'Abrir la página completa', // MT
    pt: 'Abrir a página completa', // MT
    de: 'Ganze Seite öffnen', // MT
    fr: 'Ouvrir la page complète', // MT
  },

  // ── a certificate ────────────────────────────────────────────────────
  cert_issued: {
    en: '{number} · issued {date}',
    nl: '{number} · uitgereikt op {date}',
    es: '{number} · emitido el {date}', // MT
    pt: '{number} · emitido em {date}', // MT
    de: '{number} · ausgestellt am {date}', // MT
    fr: '{number} · délivré le {date}', // MT
  },
  view_online: {
    en: 'View online',
    nl: 'Online bekijken',
    es: 'Ver en línea', // MT
    pt: 'Ver online', // MT
    de: 'Online ansehen', // MT
    fr: 'Voir en ligne', // MT
  },
  cert_preview_failed: {
    en: 'The preview could not be loaded. The link above still opens it.',
    nl: 'De voorvertoning kon niet worden geladen. De link hierboven opent hem nog steeds.',
    es: 'No se pudo cargar la vista previa. El enlace de arriba sigue abriéndolo.', // MT
    pt: 'Não foi possível carregar a prévia. O link acima ainda abre o certificado.', // MT
    de: 'Die Vorschau konnte nicht geladen werden. Der Link oben öffnet es trotzdem.', // MT
    fr: 'L’aperçu n’a pas pu être chargé. Le lien ci-dessus l’ouvre quand même.', // MT
  },

  // ── Upcoming, and joining from it ─────────────────────────────────────
  upcoming_subtitle: {
    en: 'What your membership lets you join, at your price.',
    nl: 'Waar je lidmaatschap je toegang toe geeft, tegen jouw prijs.',
    es: 'Lo que tu membresía te permite unirte, a tu precio.', // MT
    pt: 'O que sua assinatura permite que você participe, pelo seu preço.', // MT
    de: 'Woran du mit deiner Mitgliedschaft teilnehmen kannst, zu deinem Preis.', // MT
    fr: 'Ce que ton adhésion te permet de rejoindre, à ton prix.', // MT
  },
  list_failed: {
    en: 'This list could not be loaded.',
    nl: 'Deze lijst kon niet worden geladen.',
    es: 'No se ha podido cargar esta lista.', // MT
    pt: 'Não foi possível carregar esta lista.', // MT
    de: 'Diese Liste konnte nicht geladen werden.', // MT
    fr: 'Cette liste n’a pas pu être chargée.', // MT
  },
  upcoming_failed_body: {
    en: 'Try again in a moment. Your memberships and what you joined are unaffected.',
    nl: 'Probeer het zo nog eens. Je lidmaatschappen en waar je aan meedoet blijven zoals ze zijn.',
    es: 'Vuelve a intentarlo en un momento. Tus membresías y aquello a lo que te uniste no se ven afectados.', // MT
    pt: 'Tente de novo daqui a pouco. Suas assinaturas e o que você já entrou não são afetados.', // MT
    de: 'Versuch es gleich noch einmal. Deine Mitgliedschaften und Anmeldungen sind davon nicht betroffen.', // MT
    fr: 'Réessaie dans un instant. Tes adhésions et ce que tu as rejoint ne sont pas affectés.', // MT
  },
  upcoming_none_title: {
    en: 'None of your memberships includes a team calendar.',
    nl: 'Geen van je lidmaatschappen bevat een teamagenda.',
    es: 'Ninguna de tus membresías incluye un calendario de equipo.', // MT
    pt: 'Nenhuma das suas assinaturas inclui um calendário de equipe.', // MT
    de: 'Keine deiner Mitgliedschaften enthält einen Teamkalender.', // MT
    fr: 'Aucune de tes adhésions n’inclut d’agenda d’équipe.', // MT
  },
  upcoming_none_body: {
    en: 'When one does, everything on that calendar appears here, at the price your membership makes it.',
    nl: 'Zodra dat wel zo is, verschijnt alles uit die agenda hier, tegen de prijs die je lidmaatschap ervoor geeft.',
    es: 'Cuando alguna lo incluya, todo lo de ese calendario aparecerá aquí, al precio que te da tu membresía.', // MT
    pt: 'Quando alguma incluir, tudo daquele calendário aparece aqui, pelo preço que sua assinatura garante.', // MT
    de: 'Sobald eine das tut, erscheint hier alles aus diesem Kalender, zu dem Preis, den deine Mitgliedschaft dir gibt.', // MT
    fr: 'Dès qu’une l’inclura, tout ce qui figure dans cet agenda apparaîtra ici, au prix que te donne ton adhésion.', // MT
  },
  upcoming_end_title: {
    en: 'That is everything.',
    nl: 'Dat is alles.',
    es: 'Eso es todo.', // MT
    pt: 'Isso é tudo.', // MT
    de: 'Das ist alles.', // MT
    fr: 'C’est tout.', // MT
  },
  upcoming_end_body: {
    en: 'There is nothing further on your calendars.',
    nl: 'Er staat verder niets in je agenda’s.',
    es: 'No hay nada más en tus calendarios.', // MT
    pt: 'Não há mais nada nos seus calendários.', // MT
    de: 'In deinen Kalendern steht nichts weiter.', // MT
    fr: 'Il n’y a rien de plus dans tes agendas.', // MT
  },
  upcoming_empty_title: {
    en: 'Nothing coming up right now.',
    nl: 'Op dit moment staat er niets gepland.',
    es: 'Ahora mismo no hay nada próximamente.', // MT
    pt: 'Nada por vir agora.', // MT
    de: 'Gerade ist nichts in Sicht.', // MT
    fr: 'Rien à venir pour l’instant.', // MT
  },
  upcoming_empty_body: {
    en: 'New threads on your team calendars appear here as soon as they are published. Anything you already joined is under Next.',
    nl: 'Nieuwe threads in je teamagenda’s verschijnen hier zodra ze gepubliceerd zijn. Waar je al aan meedoet, staat onder Volgende.',
    es: 'Los nuevos threads de tus calendarios de equipo aparecen aquí en cuanto se publican. Aquello a lo que ya te uniste está en Lo próximo.', // MT
    pt: 'Novos threads nos seus calendários de equipe aparecem aqui assim que são publicados. O que você já entrou fica em A seguir.', // MT
    de: 'Neue Threads in deinen Teamkalendern erscheinen hier, sobald sie veröffentlicht sind. Woran du schon teilnimmst, steht unter Als Nächstes.', // MT
    fr: 'Les nouveaux threads de tes agendas d’équipe apparaissent ici dès leur publication. Ce que tu as déjà rejoint se trouve dans À venir.', // MT
  },
  signup_not_open: {
    en: 'Sign-up not open yet.',
    nl: 'Aanmelden is nog niet open.',
    es: 'La inscripción aún no está abierta.', // MT
    pt: 'As inscrições ainda não estão abertas.', // MT
    de: 'Die Anmeldung ist noch nicht geöffnet.', // MT
    fr: 'Les inscriptions ne sont pas encore ouvertes.', // MT
  },
  signup_on_page: {
    en: 'Sign up on its page',
    nl: 'Aanmelden via de pagina',
    es: 'Inscríbete en su página', // MT
    pt: 'Inscreva-se na página', // MT
    de: 'Auf der Seite anmelden', // MT
    fr: 'S’inscrire sur sa page', // MT
  },
  more: {
    en: 'More',
    nl: 'Meer',
    es: 'Más', // MT
    pt: 'Mais', // MT
    de: 'Mehr', // MT
    fr: 'Plus', // MT
  },
  // The price line (join-price.tsx).
  price_included: {
    en: 'included in your membership',
    nl: 'inbegrepen in je lidmaatschap',
    es: 'incluido en tu membresía', // MT
    pt: 'incluído na sua assinatura', // MT
    de: 'in deiner Mitgliedschaft enthalten', // MT
    fr: 'inclus dans ton adhésion', // MT
  },
  price_instead: {
    en: 'instead of {price}',
    nl: 'in plaats van {price}',
    es: 'en lugar de {price}', // MT
    pt: 'em vez de {price}', // MT
    de: 'statt {price}', // MT
    fr: 'au lieu de {price}', // MT
  },
  price_incl_vat: {
    en: 'incl. VAT',
    nl: 'incl. btw',
    es: 'IVA incl.', // MT
    pt: 'impostos incl.', // MT
    de: 'inkl. MwSt.', // MT
    fr: 'TTC', // MT
  },
  // Joining from the list (upcoming/join-button.tsx).
  join_for: {
    en: 'Join for {price}',
    nl: 'Doe mee voor {price}',
    es: 'Únete por {price}', // MT
    pt: 'Participe por {price}', // MT
    de: 'Für {price} teilnehmen', // MT
    fr: 'Rejoindre pour {price}', // MT
  },
  joining: {
    en: 'Joining…',
    nl: 'Aanmelden…',
    es: 'Uniéndote…', // MT
    pt: 'Entrando…', // MT
    de: 'Wird angemeldet…', // MT
    fr: 'Inscription…', // MT
  },
  cancel: {
    en: 'Cancel',
    nl: 'Annuleren',
    es: 'Cancelar', // MT
    pt: 'Cancelar', // MT
    de: 'Abbrechen', // MT
    fr: 'Annuler', // MT
  },
  join_in: {
    en: 'You’re in. It is under Next now.',
    nl: 'Je doet mee. Het staat nu onder Volgende.',
    es: 'Ya estás dentro. Ahora está en Lo próximo.', // MT
    pt: 'Você está dentro. Agora está em A seguir.', // MT
    de: 'Du bist dabei. Es steht jetzt unter Als Nächstes.', // MT
    fr: 'C’est fait. C’est maintenant dans À venir.', // MT
  },
  join_already: {
    en: 'You’re already signed up for this one. It is under Next.',
    nl: 'Je bent hier al voor aangemeld. Het staat onder Volgende.',
    es: 'Ya estás inscrito en este. Está en Lo próximo.', // MT
    pt: 'Você já está inscrito neste. Está em A seguir.', // MT
    de: 'Dafür bist du schon angemeldet. Es steht unter Als Nächstes.', // MT
    fr: 'Tu es déjà inscrit·e. C’est dans À venir.', // MT
  },
  // {link} is join_invoice_link, a link to /purchases.
  join_invoice: {
    en: 'You have an open invoice for this one. {link}.',
    nl: 'Je hebt hier een openstaande factuur voor. {link}.',
    es: 'Tienes una factura pendiente para este. {link}.', // MT
    pt: 'Você tem uma fatura em aberto para este. {link}.', // MT
    de: 'Dafür hast du eine offene Rechnung. {link}.', // MT
    fr: 'Tu as une facture en attente pour celui-ci. {link}.', // MT
  },
  join_invoice_link: {
    en: 'See it under Purchases',
    nl: 'Bekijk hem onder Aankopen',
    es: 'Mírala en Compras', // MT
    pt: 'Veja em Compras', // MT
    de: 'Sieh sie dir unter Käufe an', // MT
    fr: 'Vois-la dans Achats', // MT
  },
  join_closed_membership: {
    en: 'Your place on this one came with a membership that has ended. Contact the organiser if you would like to join.',
    nl: 'Je plek hierbij hoorde bij een lidmaatschap dat is afgelopen. Neem contact op met de organisator als je wilt meedoen.',
    es: 'Tu plaza en este venía con una membresía que ha terminado. Contacta con quien lo organiza si quieres unirte.', // MT
    pt: 'Sua vaga neste vinha com uma assinatura que terminou. Fale com quem organiza se quiser participar.', // MT
    de: 'Dein Platz hier gehörte zu einer Mitgliedschaft, die beendet ist. Wende dich an die Veranstalter:in, wenn du teilnehmen möchtest.', // MT
    fr: 'Ta place venait avec une adhésion qui a pris fin. Contacte l’organisateur si tu veux participer.', // MT
  },
  join_closed: {
    en: 'Your place on this one is closed. Contact the organiser if you would like to join.',
    nl: 'Je plek hierbij is gesloten. Neem contact op met de organisator als je wilt meedoen.',
    es: 'Tu plaza en este está cerrada. Contacta con quien lo organiza si quieres unirte.', // MT
    pt: 'Sua vaga neste está fechada. Fale com quem organiza se quiser participar.', // MT
    de: 'Dein Platz hier ist geschlossen. Wende dich an die Veranstalter:in, wenn du teilnehmen möchtest.', // MT
    fr: 'Ta place est fermée. Contacte l’organisateur si tu veux participer.', // MT
  },
  join_pending: {
    en: 'Asked. The organiser confirms places for this one, and you will get an email when they do.',
    nl: 'Aangevraagd. De organisator bevestigt de plekken hiervoor; je krijgt een e-mail zodra dat gebeurt.',
    es: 'Solicitado. Quien organiza confirma las plazas de este, y recibirás un correo cuando lo haga.', // MT
    pt: 'Pedido feito. Quem organiza confirma as vagas deste, e você recebe um e-mail quando isso acontecer.', // MT
    de: 'Angefragt. Die Veranstalter:in bestätigt die Plätze hierfür, und du bekommst eine E-Mail, sobald das passiert.', // MT
    fr: 'Demande envoyée. L’organisateur confirme les places, et tu recevras un e-mail quand ce sera fait.', // MT
  },
  // {link} is privacy_statement, a link to the policy.
  agree_privacy: {
    en: 'I agree to the {link}.',
    nl: 'Ik ga akkoord met de {link}.',
    es: 'Acepto la {link}.', // MT
    pt: 'Eu concordo com a {link}.', // MT
    de: 'Ich stimme der {link} zu.', // MT
    fr: 'J’accepte la {link}.', // MT
  },
  privacy_statement: {
    en: 'privacy statement',
    nl: 'privacyverklaring',
    es: 'declaración de privacidad', // MT
    pt: 'declaração de privacidade', // MT
    de: 'Datenschutzerklärung', // MT
    fr: 'déclaration de confidentialité', // MT
  },
  open_its_page: {
    en: 'Open its page',
    nl: 'Open de pagina',
    es: 'Abrir su página', // MT
    pt: 'Abrir a página', // MT
    de: 'Seite öffnen', // MT
    fr: 'Ouvrir sa page', // MT
  },
  join_err_network: {
    en: 'Could not reach the server. Try again.',
    nl: 'De server was niet bereikbaar. Probeer het opnieuw.',
    es: 'No se ha podido conectar con el servidor. Inténtalo de nuevo.', // MT
    pt: 'Não foi possível falar com o servidor. Tente de novo.', // MT
    de: 'Der Server war nicht erreichbar. Versuch es noch einmal.', // MT
    fr: 'Impossible de joindre le serveur. Réessaie.', // MT
  },
  join_err_no_payments: {
    en: 'Sign-up is not open yet: the organiser cannot take payments.',
    nl: 'Aanmelden is nog niet open: de organisator kan nog geen betalingen ontvangen.',
    es: 'La inscripción aún no está abierta: quien organiza no puede cobrar pagos.', // MT
    pt: 'As inscrições ainda não estão abertas: quem organiza não pode receber pagamentos.', // MT
    de: 'Die Anmeldung ist noch nicht geöffnet: Die Veranstalter:in kann keine Zahlungen annehmen.', // MT
    fr: 'Les inscriptions ne sont pas encore ouvertes : l’organisateur ne peut pas encore recevoir de paiements.', // MT
  },
  join_err_invoice_only: {
    en: 'This one cannot be paid by card. Sign up on its page to pay by invoice.',
    nl: 'Hiervoor kun je niet met een kaart betalen. Meld je aan via de pagina om op factuur te betalen.',
    es: 'Este no se puede pagar con tarjeta. Inscríbete en su página para pagar con factura.', // MT
    pt: 'Este não pode ser pago com cartão. Inscreva-se na página para pagar por fatura.', // MT
    de: 'Das lässt sich nicht mit Karte bezahlen. Melde dich auf der Seite an, um per Rechnung zu zahlen.', // MT
    fr: 'Celui-ci ne peut pas être payé par carte. Inscris-toi sur sa page pour payer sur facture.', // MT
  },
  join_err_full: {
    en: 'This one is full.',
    nl: 'Deze is vol.',
    es: 'Este está completo.', // MT
    pt: 'Este está lotado.', // MT
    de: 'Das ist ausgebucht.', // MT
    fr: 'C’est complet.', // MT
  },
  join_err_sold_out: {
    en: 'This ticket is sold out.',
    nl: 'Dit ticket is uitverkocht.',
    es: 'Esta entrada está agotada.', // MT
    pt: 'Este ingresso esgotou.', // MT
    de: 'Dieses Ticket ist ausverkauft.', // MT
    fr: 'Ce billet est épuisé.', // MT
  },
  join_err_closed: {
    en: 'Sign-up for this one has closed.',
    nl: 'Aanmelden hiervoor is gesloten.',
    es: 'La inscripción para este se ha cerrado.', // MT
    pt: 'As inscrições para este foram encerradas.', // MT
    de: 'Die Anmeldung dafür ist geschlossen.', // MT
    fr: 'Les inscriptions sont closes.', // MT
  },
  join_err_too_many: {
    en: 'Too many tries in a short time. Wait a few minutes and try again.',
    nl: 'Te veel pogingen in korte tijd. Wacht een paar minuten en probeer het opnieuw.',
    es: 'Demasiados intentos en poco tiempo. Espera unos minutos e inténtalo de nuevo.', // MT
    pt: 'Tentativas demais em pouco tempo. Espere alguns minutos e tente de novo.', // MT
    de: 'Zu viele Versuche in kurzer Zeit. Warte ein paar Minuten und versuch es noch einmal.', // MT
    fr: 'Trop de tentatives en peu de temps. Attends quelques minutes et réessaie.', // MT
  },
  join_err_privacy: {
    en: 'Tick the privacy statement to join.',
    nl: 'Vink de privacyverklaring aan om mee te doen.',
    es: 'Marca la declaración de privacidad para unirte.', // MT
    pt: 'Marque a declaração de privacidade para participar.', // MT
    de: 'Hake die Datenschutzerklärung an, um teilzunehmen.', // MT
    fr: 'Coche la déclaration de confidentialité pour participer.', // MT
  },
  join_err_session: {
    en: 'Your session ended. Sign in again to join.',
    nl: 'Je sessie is verlopen. Log opnieuw in om mee te doen.',
    es: 'Tu sesión ha terminado. Vuelve a entrar para unirte.', // MT
    pt: 'Sua sessão terminou. Entre de novo para participar.', // MT
    de: 'Deine Sitzung ist abgelaufen. Melde dich erneut an, um teilzunehmen.', // MT
    fr: 'Ta session a expiré. Reconnecte-toi pour participer.', // MT
  },
  join_err_server: {
    en: 'Something went wrong on our side. Try again in a moment.',
    nl: 'Er ging aan onze kant iets mis. Probeer het zo nog eens.',
    es: 'Algo ha fallado por nuestra parte. Inténtalo de nuevo en un momento.', // MT
    pt: 'Algo deu errado do nosso lado. Tente de novo daqui a pouco.', // MT
    de: 'Bei uns ist etwas schiefgelaufen. Versuch es gleich noch einmal.', // MT
    fr: 'Un problème est survenu de notre côté. Réessaie dans un instant.', // MT
  },
  join_err_generic: {
    en: 'Could not join this one.',
    nl: 'Meedoen lukte niet.',
    es: 'No se ha podido unir a este.', // MT
    pt: 'Não foi possível participar deste.', // MT
    de: 'Die Teilnahme hat nicht geklappt.', // MT
    fr: 'Impossible de rejoindre celui-ci.', // MT
  },

  // ── Files and Notifications ───────────────────────────────────────────
  page_failed: {
    en: 'This page could not be loaded.',
    nl: 'Deze pagina kon niet worden geladen.',
    es: 'No se ha podido cargar esta página.', // MT
    pt: 'Não foi possível carregar esta página.', // MT
    de: 'Diese Seite konnte nicht geladen werden.', // MT
    fr: 'Cette page n’a pas pu être chargée.', // MT
  },
  try_again_moment: {
    en: 'Try again in a moment.',
    nl: 'Probeer het zo nog eens.',
    es: 'Vuelve a intentarlo en un momento.', // MT
    pt: 'Tente de novo daqui a pouco.', // MT
    de: 'Versuch es gleich noch einmal.', // MT
    fr: 'Réessaie dans un instant.', // MT
  },
  files_none_title: {
    en: 'No files yet.',
    nl: 'Nog geen bestanden.',
    es: 'Aún no hay archivos.', // MT
    pt: 'Nenhum arquivo ainda.', // MT
    de: 'Noch keine Dateien.', // MT
    fr: 'Pas encore de fichiers.', // MT
  },
  files_none_body: {
    en: 'Documents from your communities, and the ones your threads send you, are gathered here.',
    nl: 'Documenten van je community’s, en die je threads je sturen, komen hier samen.',
    es: 'Aquí se reúnen los documentos de tus comunidades y los que te envían tus threads.', // MT
    pt: 'Os documentos das suas comunidades, e os que seus threads enviam, ficam reunidos aqui.', // MT
    de: 'Hier sammeln sich die Dokumente deiner Communitys und die, die dir deine Threads schicken.', // MT
    fr: 'Les documents de tes communautés, et ceux que tes threads t’envoient, sont rassemblés ici.', // MT
  },
  from_community: {
    en: 'From your community',
    nl: 'Van je community',
    es: 'De tu comunidad', // MT
    pt: 'Da sua comunidade', // MT
    de: 'Aus deiner Community', // MT
    fr: 'De ta communauté', // MT
  },
  from_threads: {
    en: 'From your threads',
    nl: 'Van je threads',
    es: 'De tus threads', // MT
    pt: 'Dos seus threads', // MT
    de: 'Aus deinen Threads', // MT
    fr: 'De tes threads', // MT
  },
  // Notifications: what each bell row is, by kind.
  notif_subtitle: {
    en: 'Changes to your sessions, and what is new on your calendars.',
    nl: 'Wijzigingen in je sessies, en wat er nieuw is in je agenda’s.',
    es: 'Cambios en tus sesiones y novedades en tus calendarios.', // MT
    pt: 'Mudanças nas suas sessões e o que há de novo nos seus calendários.', // MT
    de: 'Änderungen an deinen Sitzungen und Neues in deinen Kalendern.', // MT
    fr: 'Les changements de tes séances, et les nouveautés de tes agendas.', // MT
  },
  notif_new_thread: {
    en: 'New on the calendar',
    nl: 'Nieuw in de agenda',
    es: 'Nuevo en el calendario', // MT
    pt: 'Novo no calendário', // MT
    de: 'Neu im Kalender', // MT
    fr: 'Nouveau dans l’agenda', // MT
  },
  notif_session_added: {
    en: 'New session',
    nl: 'Nieuwe sessie',
    es: 'Nueva sesión', // MT
    pt: 'Nova sessão', // MT
    de: 'Neue Sitzung', // MT
    fr: 'Nouvelle séance', // MT
  },
  notif_session_moved: {
    en: 'Moved',
    nl: 'Verplaatst',
    es: 'Cambiada de fecha', // MT
    pt: 'Remarcada', // MT
    de: 'Verschoben', // MT
    fr: 'Déplacée', // MT
  },
  notif_session_cancelled: {
    en: 'Cancelled',
    nl: 'Geannuleerd',
    es: 'Cancelada', // MT
    pt: 'Cancelada', // MT
    de: 'Abgesagt', // MT
    fr: 'Annulée', // MT
  },
  notif_none_title: {
    en: 'Nothing yet.',
    nl: 'Nog niets.',
    es: 'Nada todavía.', // MT
    pt: 'Nada ainda.', // MT
    de: 'Noch nichts.', // MT
    fr: 'Rien pour l’instant.', // MT
  },
  notif_none_body: {
    en: 'When a session of a thread you take part in is added, moved or cancelled, it shows here — and so does a new thread on a calendar your membership includes.',
    nl: 'Als er een sessie wordt toegevoegd, verplaatst of geannuleerd in een thread waar je aan meedoet, zie je dat hier — net als een nieuwe thread in een agenda die bij je lidmaatschap hoort.',
    es: 'Cuando se añade, cambia o cancela una sesión de un thread en el que participas, aparece aquí; también un nuevo thread en un calendario que incluye tu membresía.', // MT
    pt: 'Quando uma sessão de um thread de que você participa é adicionada, remarcada ou cancelada, aparece aqui — assim como um novo thread num calendário incluído na sua assinatura.', // MT
    de: 'Wenn eine Sitzung eines Threads, an dem du teilnimmst, hinzugefügt, verschoben oder abgesagt wird, siehst du das hier – ebenso einen neuen Thread in einem Kalender, den deine Mitgliedschaft enthält.', // MT
    fr: 'Quand une séance d’un thread auquel tu participes est ajoutée, déplacée ou annulée, elle apparaît ici, tout comme un nouveau thread dans un agenda inclus dans ton adhésion.', // MT
  },
  everything_coming: {
    en: 'Everything coming up',
    nl: 'Alles wat eraan komt',
    es: 'Todo lo que viene', // MT
    pt: 'Tudo o que vem por aí', // MT
    de: 'Alles, was ansteht', // MT
    fr: 'Tout ce qui arrive', // MT
  },
  older: {
    en: 'Older',
    nl: 'Ouder',
    es: 'Anteriores', // MT
    pt: 'Mais antigas', // MT
    de: 'Ältere', // MT
    fr: 'Plus anciennes', // MT
  },

  // ── Home (the community page) ─────────────────────────────────────────
  community_none_title: {
    en: 'You are not a member of a community yet.',
    nl: 'Je bent nog geen lid van een community.',
    es: 'Aún no eres miembro de ninguna comunidad.', // MT
    pt: 'Você ainda não é membro de uma comunidade.', // MT
    de: 'Du bist noch in keiner Community Mitglied.', // MT
    fr: 'Tu n’es encore membre d’aucune communauté.', // MT
  },
  community_none_body: {
    en: 'When you join one, its page is here: an introduction, its documents and what is next.',
    nl: 'Zodra je lid wordt, staat de pagina hier: een introductie, documenten en wat eraan komt.',
    es: 'Cuando te unas a una, su página estará aquí: una presentación, sus documentos y lo que viene.', // MT
    pt: 'Quando você entrar em uma, a página dela fica aqui: uma apresentação, os documentos e o que vem a seguir.', // MT
    de: 'Sobald du einer beitrittst, ist ihre Seite hier: eine Einführung, ihre Dokumente und was als Nächstes kommt.', // MT
    fr: 'Quand tu en rejoins une, sa page est ici : une présentation, ses documents et ce qui arrive.', // MT
  },
  documents: {
    en: 'Documents',
    nl: 'Documenten',
    es: 'Documentos', // MT
    pt: 'Documentos', // MT
    de: 'Dokumente', // MT
    fr: 'Documents', // MT
  },
  see_under_upcoming: {
    en: 'See it under Upcoming',
    nl: 'Bekijk het onder Agenda',
    es: 'Míralo en Agenda', // MT
    pt: 'Veja em Agenda', // MT
    de: 'Sieh es dir unter Kalender an', // MT
    fr: 'Vois-le dans Agenda', // MT
  },
  community_empty: {
    en: 'Nothing here yet. Your community can add an introduction and documents.',
    nl: 'Hier staat nog niets. Je community kan een introductie en documenten toevoegen.',
    es: 'Aún no hay nada aquí. Tu comunidad puede añadir una presentación y documentos.', // MT
    pt: 'Nada aqui ainda. Sua comunidade pode adicionar uma apresentação e documentos.', // MT
    de: 'Hier ist noch nichts. Deine Community kann eine Einführung und Dokumente hinzufügen.', // MT
    fr: 'Rien ici pour l’instant. Ta communauté peut ajouter une présentation et des documents.', // MT
  },

  // ── Members ───────────────────────────────────────────────────────────
  members_failed: {
    en: "We couldn't load this right now. Nothing has changed — try again in a moment.",
    nl: 'Dit lukte nu niet te laden. Er is niets veranderd — probeer het zo nog eens.',
    es: 'No hemos podido cargarlo ahora. No ha cambiado nada; vuelve a intentarlo en un momento.', // MT
    pt: 'Não conseguimos carregar isto agora. Nada mudou — tente de novo daqui a pouco.', // MT
    de: 'Das ließ sich gerade nicht laden. Es hat sich nichts geändert – versuch es gleich noch einmal.', // MT
    fr: 'Impossible de charger ceci pour le moment. Rien n’a changé : réessaie dans un instant.', // MT
  },
  members_failed_private: {
    en: "We couldn't load this right now. Nothing has changed, and nobody has been shown anything — try again in a moment.",
    nl: 'Dit lukte nu niet te laden. Er is niets veranderd en niemand heeft iets te zien gekregen — probeer het zo nog eens.',
    es: 'No hemos podido cargarlo ahora. No ha cambiado nada y no se ha mostrado nada a nadie; vuelve a intentarlo en un momento.', // MT
    pt: 'Não conseguimos carregar isto agora. Nada mudou e nada foi mostrado a ninguém — tente de novo daqui a pouco.', // MT
    de: 'Das ließ sich gerade nicht laden. Es hat sich nichts geändert, und niemandem wurde etwas gezeigt – versuch es gleich noch einmal.', // MT
    fr: 'Impossible de charger ceci pour le moment. Rien n’a changé et rien n’a été montré à personne : réessaie dans un instant.', // MT
  },
  members_no_list_any: {
    en: 'None of your communities has a member list.',
    nl: 'Geen van je community’s heeft een ledenlijst.',
    es: 'Ninguna de tus comunidades tiene lista de miembros.', // MT
    pt: 'Nenhuma das suas comunidades tem lista de membros.', // MT
    de: 'Keine deiner Communitys hat eine Mitgliederliste.', // MT
    fr: 'Aucune de tes communautés n’a de liste de membres.', // MT
  },
  members_not_shown_here: {
    en: "You're not shown in this one",
    nl: 'Je wordt hier niet getoond',
    es: 'No apareces en esta', // MT
    pt: 'Você não aparece nesta', // MT
    de: 'Du wirst hier nicht angezeigt', // MT
    fr: 'Tu n’apparais pas dans celle-ci', // MT
  },
  members_of: {
    en: 'Members of {name}',
    nl: 'Leden van {name}',
    es: 'Miembros de {name}', // MT
    pt: 'Membros de {name}', // MT
    de: 'Mitglieder von {name}', // MT
    fr: 'Membres de {name}', // MT
  },
  back_to_you: {
    en: 'Back to you',
    nl: 'Terug naar Jij',
    es: 'Volver a Tú', // MT
    pt: 'Voltar para Você', // MT
    de: 'Zurück zu Du', // MT
    fr: 'Retour à Toi', // MT
  },
  members_no_list: {
    en: "This community doesn't have a member list.",
    nl: 'Deze community heeft geen ledenlijst.',
    es: 'Esta comunidad no tiene lista de miembros.', // MT
    pt: 'Esta comunidade não tem lista de membros.', // MT
    de: 'Diese Community hat keine Mitgliederliste.', // MT
    fr: 'Cette communauté n’a pas de liste de membres.', // MT
  },
  members_you_hidden: {
    en: "You're not shown to other members.",
    nl: 'Je wordt niet getoond aan andere leden.',
    es: 'No apareces para otros miembros.', // MT
    pt: 'Você não aparece para outros membros.', // MT
    de: 'Du wirst anderen Mitgliedern nicht angezeigt.', // MT
    fr: 'Tu n’apparais pas aux autres membres.', // MT
  },
  // {link} is "You" (nav_you), a link to /you.
  members_you_hidden_body: {
    en: 'You can see everyone here who has chosen to appear. To appear yourself, turn that on — and off again whenever you like — on your {link} page.',
    nl: 'Je ziet iedereen die ervoor gekozen heeft om hier te verschijnen. Wil je zelf verschijnen, zet dat dan aan — en weer uit wanneer je wilt — op je pagina {link}.',
    es: 'Puedes ver a todas las personas que han elegido aparecer. Para aparecer tú, actívalo (y desactívalo cuando quieras) en tu página {link}.', // MT
    pt: 'Você vê todos que escolheram aparecer aqui. Para aparecer também, ative isso — e desative quando quiser — na sua página {link}.', // MT
    de: 'Du siehst hier alle, die sich entschieden haben zu erscheinen. Um selbst zu erscheinen, schalte das auf deiner Seite {link} ein – und jederzeit wieder aus.', // MT
    fr: 'Tu vois ici toutes les personnes qui ont choisi d’apparaître. Pour apparaître toi aussi, active-le (et désactive-le quand tu veux) sur ta page {link}.', // MT
  },
  members_only_you: {
    en: "You're the only one here so far. Nobody else has chosen to appear yet.",
    nl: 'Je bent hier tot nu toe de enige. Niemand anders heeft er nog voor gekozen om te verschijnen.',
    es: 'Por ahora eres la única persona aquí. Nadie más ha elegido aparecer todavía.', // MT
    pt: 'Por enquanto você é a única pessoa aqui. Ninguém mais escolheu aparecer ainda.', // MT
    de: 'Bisher bist du hier allein. Sonst hat sich noch niemand entschieden zu erscheinen.', // MT
    fr: 'Tu es seul·e ici pour l’instant. Personne d’autre n’a encore choisi d’apparaître.', // MT
  },
  members_nobody: {
    en: 'Nobody has chosen to appear in this list yet.',
    nl: 'Nog niemand heeft ervoor gekozen om in deze lijst te verschijnen.',
    es: 'Nadie ha elegido aparecer en esta lista todavía.', // MT
    pt: 'Ninguém escolheu aparecer nesta lista ainda.', // MT
    de: 'Noch niemand hat sich entschieden, in dieser Liste zu erscheinen.', // MT
    fr: 'Personne n’a encore choisi d’apparaître dans cette liste.', // MT
  },
  members_search_placeholder: {
    en: 'Search by name, place or interest',
    nl: 'Zoek op naam, plaats of interesse',
    es: 'Busca por nombre, lugar o interés', // MT
    pt: 'Busque por nome, lugar ou interesse', // MT
    de: 'Nach Name, Ort oder Interesse suchen', // MT
    fr: 'Rechercher par nom, lieu ou intérêt', // MT
  },
  members_search_label: {
    en: 'Search members',
    nl: 'Leden zoeken',
    es: 'Buscar miembros', // MT
    pt: 'Buscar membros', // MT
    de: 'Mitglieder suchen', // MT
    fr: 'Rechercher des membres', // MT
  },
  members_no_match: {
    en: 'Nobody matches “{q}”. Search looks at names, places and interests — not contact details.',
    nl: 'Niemand past bij ‘{q}’. Zoeken kijkt naar namen, plaatsen en interesses — niet naar contactgegevens.',
    es: 'Nadie coincide con «{q}». La búsqueda mira nombres, lugares e intereses, no datos de contacto.', // MT
    pt: 'Ninguém corresponde a “{q}”. A busca considera nomes, lugares e interesses — não dados de contato.', // MT
    de: 'Niemand passt zu „{q}“. Die Suche berücksichtigt Namen, Orte und Interessen – keine Kontaktdaten.', // MT
    fr: 'Personne ne correspond à « {q} ». La recherche porte sur les noms, lieux et intérêts, pas sur les coordonnées.', // MT
  },
  member: {
    en: 'Member',
    nl: 'Lid',
    es: 'Miembro', // MT
    pt: 'Membro', // MT
    de: 'Mitglied', // MT
    fr: 'Membre', // MT
  },
  back_to_members_of: {
    en: 'Back to members of {name}',
    nl: 'Terug naar leden van {name}',
    es: 'Volver a los miembros de {name}', // MT
    pt: 'Voltar aos membros de {name}', // MT
    de: 'Zurück zu den Mitgliedern von {name}', // MT
    fr: 'Retour aux membres de {name}', // MT
  },
  back_to_members: {
    en: 'Back to members',
    nl: 'Terug naar leden',
    es: 'Volver a los miembros', // MT
    pt: 'Voltar aos membros', // MT
    de: 'Zurück zu den Mitgliedern', // MT
    fr: 'Retour aux membres', // MT
  },
  member_unavailable: {
    en: 'This member isn’t available to you.',
    nl: 'Dit lid is voor jou niet beschikbaar.',
    es: 'Este miembro no está disponible para ti.', // MT
    pt: 'Este membro não está disponível para você.', // MT
    de: 'Dieses Mitglied ist für dich nicht verfügbar.', // MT
    fr: 'Ce membre ne t’est pas accessible.', // MT
  },
  website: {
    en: 'Website',
    nl: 'Website',
    es: 'Sitio web', // MT
    pt: 'Site', // MT
    de: 'Website', // MT
    fr: 'Site web', // MT
  },

  // ── Help ────────────────────────────────────────────────────────────
  // A guide's steps are ONE string, a step per line (guideSteps splits it).
  // They name buttons by the words on them, so a step must say what this
  // catalog says on the button — and for You, Memberships and Purchases,
  // what phase 2 will say there (until then those pages are English).
  // The install guide quotes the offline page ("You’re offline", "Try
  // again") in each language's own words, as that page shows them since
  // 2026-10-17 (offline_title, try_again).
  help_signin_title: {
    en: "Sign in, and sign out",
    nl: "Inloggen en uitloggen",
    es: "Entrar y salir", // MT
    pt: "Entrar e sair", // MT
    de: "Anmelden und abmelden", // MT
    fr: "Se connecter et se déconnecter", // MT
  },
  help_signin_steps: {
    en: "Enter the email address you booked or joined with — that is how we find your things — and press Email me a code.\nOpen the email and type the 8-digit code, then press Sign in. Pressed the wrong address? Use a different email.\nThere is no password. You stay signed in on this device until you sign out.\nTo sign out, open You and press Sign out at the bottom. Any tickets kept on this device are removed with it.",
    nl: "Vul het e-mailadres in waarmee je hebt geboekt of je hebt aangemeld — zo vinden we je spullen — en druk op Mail mij een code.\nOpen de e-mail, typ de 8-cijferige code en druk op Inloggen. Verkeerd adres ingevuld? Gebruik een ander e-mailadres.\nEr is geen wachtwoord. Je blijft op dit apparaat ingelogd tot je uitlogt.\nUitloggen doe je onder Jij, met Uitloggen onderaan. Tickets die op dit apparaat bewaard zijn, verdwijnen dan ook.",
    es: "Escribe la dirección de correo con la que reservaste o te uniste —así encontramos lo tuyo— y pulsa Envíame un código.\nAbre el correo, escribe el código de 8 dígitos y pulsa Entrar. ¿Te equivocaste de dirección? Usar otro correo.\nNo hay contraseña. Sigues con la sesión abierta en este dispositivo hasta que la cierres.\nPara salir, abre Tú y pulsa Cerrar sesión abajo del todo. Las entradas guardadas en este dispositivo se eliminan con ello.", // MT
    pt: "Digite o e-mail com que você reservou ou entrou — é assim que encontramos suas coisas — e toque em Envie-me um código.\nAbra o e-mail, digite o código de 8 dígitos e toque em Entrar. Digitou o endereço errado? Usar outro e-mail.\nNão há senha. Você continua conectado neste dispositivo até sair.\nPara sair, abra Você e toque em Sair, no fim da página. Os ingressos guardados neste dispositivo são removidos junto.", // MT
    de: "Gib die E-Mail-Adresse ein, mit der du gebucht hast oder beigetreten bist – so finden wir deine Sachen – und tippe auf Code per E-Mail senden.\nÖffne die E-Mail, gib den 8-stelligen Code ein und tippe auf Anmelden. Falsche Adresse? Andere E-Mail-Adresse verwenden.\nEs gibt kein Passwort. Du bleibst auf diesem Gerät angemeldet, bis du dich abmeldest.\nZum Abmelden öffne Du und tippe ganz unten auf Abmelden. Auf diesem Gerät gespeicherte Tickets werden dabei entfernt.", // MT
    fr: "Saisis l’adresse e-mail avec laquelle tu as réservé ou adhéré (c’est ainsi que nous retrouvons tes affaires) et appuie sur Recevoir un code par e-mail.\nOuvre l’e-mail, tape le code à 8 chiffres, puis appuie sur Se connecter. Mauvaise adresse ? Utiliser une autre adresse e-mail.\nIl n’y a pas de mot de passe. Tu restes connecté·e sur cet appareil jusqu’à ce que tu te déconnectes.\nPour te déconnecter, ouvre Toi et appuie sur Se déconnecter tout en bas. Les billets gardés sur cet appareil sont supprimés en même temps.", // MT
  },
  help_ticket_title: {
    en: "Find your ticket and the check-in code",
    nl: "Je ticket en de check-incode vinden",
    es: "Encontrar tu entrada y el código de acceso", // MT
    pt: "Encontrar seu ingresso e o código de check-in", // MT
    de: "Dein Ticket und den Check-in-Code finden", // MT
    fr: "Trouver ton billet et le code d’entrée", // MT
  },
  help_ticket_steps: {
    en: "Open Next. A small QR mark under a row means you hold a ticket for it.\nTap the row. The check-in code sits at the top of the sheet, under \"Show this at the door\".\nTap the code to show it full size, and tap anywhere to close it again.\nOnce the door has scanned it, the same place reads \"Already checked in\".\nWallet buttons appear next to the code only when the organiser offers Apple or Google Wallet passes.",
    nl: "Open Volgende. Een klein QR-teken onder een regel betekent dat je er een ticket voor hebt.\nTik op de regel. De check-incode staat bovenaan, onder ‘Laat dit zien bij de deur’.\nTik op de code om hem groot te tonen, en tik ergens om hem weer te sluiten.\nIs hij bij de deur gescand, dan staat daar ‘Al ingecheckt’.\nWallet-knoppen staan alleen naast de code als de organisator passes voor Apple of Google Wallet aanbiedt.",
    es: "Abre Lo próximo. Una pequeña marca QR bajo una fila indica que tienes entrada.\nToca la fila. El código de acceso está arriba del todo, bajo «Muéstralo en la entrada».\nToca el código para verlo a tamaño completo y toca en cualquier lugar para cerrarlo.\nCuando lo hayan escaneado en la entrada, ahí pondrá «Ya registrado».\nLos botones de Wallet solo aparecen junto al código si quien organiza ofrece pases de Apple o Google Wallet.", // MT
    pt: "Abra A seguir. Uma pequena marca de QR abaixo de uma linha indica que você tem ingresso.\nToque na linha. O código de check-in fica no topo, em “Mostre isto na entrada”.\nToque no código para vê-lo em tamanho grande e toque em qualquer lugar para fechar.\nDepois de escaneado na entrada, ali aparece “Check-in já feito”.\nOs botões de Wallet só aparecem ao lado do código quando quem organiza oferece passes da Apple ou do Google Wallet.", // MT
    de: "Öffne Als Nächstes. Ein kleines QR-Zeichen unter einer Zeile bedeutet, dass du dafür ein Ticket hast.\nTippe auf die Zeile. Der Check-in-Code steht oben, unter „Zeig das am Eingang“.\nTippe auf den Code, um ihn groß zu zeigen, und irgendwo, um ihn wieder zu schließen.\nSobald er am Eingang gescannt wurde, steht dort „Bereits eingecheckt“.\nWallet-Schaltflächen erscheinen neben dem Code nur, wenn die Veranstalter:in Pässe für Apple oder Google Wallet anbietet.", // MT
    fr: "Ouvre À venir. Une petite marque QR sous une ligne signifie que tu as un billet.\nTouche la ligne. Le code d’entrée se trouve en haut, sous « Montre-le à l’entrée ».\nTouche le code pour l’afficher en grand, puis n’importe où pour le refermer.\nUne fois scanné à l’entrée, on y lit « Déjà enregistré ».\nLes boutons Wallet n’apparaissent à côté du code que si l’organisateur propose des cartes Apple ou Google Wallet.", // MT
  },
  help_calendar_title: {
    en: "Add sessions to your calendar",
    nl: "Sessies in je agenda zetten",
    es: "Añadir sesiones a tu calendario", // MT
    pt: "Adicionar sessões ao seu calendário", // MT
    de: "Sitzungen in deinen Kalender eintragen", // MT
    fr: "Ajouter des séances à ton agenda", // MT
  },
  help_calendar_steps: {
    en: "For one session: tap its row on Next, then press the calendar icon beside the session in the Agenda. Your calendar gets a copy — if the organiser moves it, the copy does not move.\nFor a whole programme with several dated sessions, press Add all to calendar above the Agenda.\nTo follow everything live, open You, find Your calendar and press Subscribe.\nPress Open in Apple Calendar, or Copy address and add it in Google Calendar on a computer: Other calendars, then From URL. Google's phone app cannot add one.\nKeep the address private — anyone who has it sees your sessions. Make a new address if it gets out; the old one stops working.",
    nl: "Voor één sessie: tik op de regel onder Volgende en druk op het agenda-icoon naast de sessie in het Programma. Je agenda krijgt een kopie — verplaatst de organisator de sessie, dan schuift de kopie niet mee.\nVoor een heel programma met meerdere sessies druk je op Alles toevoegen aan agenda boven het Programma.\nWil je alles live volgen, open dan Jij, zoek Je agenda en druk op Abonneren.\nDruk op Openen in Apple Agenda, of kopieer het adres en voeg het op een computer toe in Google Agenda: Andere agenda’s, dan Via URL. De telefoonapp van Google kan dat niet.\nHoud het adres voor jezelf — wie het heeft, ziet je sessies. Maak een nieuw adres als het uitlekt; het oude werkt dan niet meer.",
    es: "Para una sesión: toca su fila en Lo próximo y pulsa el icono de calendario junto a la sesión en el Programa. Tu calendario recibe una copia; si quien organiza la cambia de fecha, la copia no cambia.\nPara un programa entero con varias sesiones con fecha, pulsa Añadir todo al calendario encima del Programa.\nPara seguirlo todo en directo, abre Tú, busca Tu calendario y pulsa Suscribirse.\nPulsa Abrir en Calendario de Apple, o copia la dirección y añádela en Google Calendar desde un ordenador: Otros calendarios y luego Desde URL. La app de Google para el móvil no puede hacerlo.\nNo compartas la dirección: quien la tenga ve tus sesiones. Crea una nueva si se filtra; la anterior deja de funcionar.", // MT
    pt: "Para uma sessão: toque na linha em A seguir e depois no ícone de calendário ao lado da sessão na Programação. Seu calendário recebe uma cópia — se quem organiza mudar a data, a cópia não muda.\nPara uma programação inteira com várias sessões datadas, toque em Adicionar tudo ao calendário, acima da Programação.\nPara acompanhar tudo ao vivo, abra Você, encontre Seu calendário e toque em Assinar.\nToque em Abrir no Calendário da Apple, ou copie o endereço e adicione no Google Agenda num computador: Outras agendas, depois A partir do URL. O app do Google no celular não consegue.\nMantenha o endereço em sigilo — quem o tiver vê suas sessões. Crie um novo se ele vazar; o antigo para de funcionar.", // MT
    de: "Für eine Sitzung: Tippe unter Als Nächstes auf ihre Zeile und dann auf das Kalendersymbol neben der Sitzung im Programm. Dein Kalender bekommt eine Kopie – verschiebt die Veranstalter:in sie, bleibt die Kopie, wo sie ist.\nFür ein ganzes Programm mit mehreren Terminen tippe über dem Programm auf Alle zum Kalender hinzufügen.\nUm alles live zu verfolgen, öffne Du, suche Dein Kalender und tippe auf Abonnieren.\nTippe auf In Apple Kalender öffnen, oder kopiere die Adresse und füge sie am Computer in Google Kalender hinzu: Weitere Kalender, dann Per URL. Die Google-App auf dem Handy kann das nicht.\nBehalte die Adresse für dich – wer sie hat, sieht deine Sitzungen. Erstelle eine neue, falls sie nach außen gelangt; die alte funktioniert dann nicht mehr.", // MT
    fr: "Pour une séance : touche sa ligne dans À venir, puis l’icône d’agenda à côté de la séance dans le Programme. Ton agenda en reçoit une copie ; si l’organisateur la déplace, la copie ne bouge pas.\nPour tout un programme avec plusieurs séances datées, appuie sur Tout ajouter à l’agenda au-dessus du Programme.\nPour tout suivre en direct, ouvre Toi, trouve Ton agenda et appuie sur S’abonner.\nAppuie sur Ouvrir dans Calendrier Apple, ou copie l’adresse et ajoute-la dans Google Agenda sur un ordinateur : Autres agendas, puis À partir de l’URL. L’application mobile de Google ne le permet pas.\nGarde l’adresse pour toi : qui la possède voit tes séances. Crée une nouvelle adresse si elle circule ; l’ancienne cesse de fonctionner.", // MT
  },
  help_install_title: {
    en: "Install it as an app and use it with no signal",
    nl: "Installeren als app en gebruiken zonder bereik",
    es: "Instalarla como app y usarla sin cobertura", // MT
    pt: "Instalar como app e usar sem sinal", // MT
    de: "Als App installieren und ohne Empfang nutzen", // MT
    fr: "L’installer comme une app et l’utiliser sans réseau", // MT
  },
  help_install_steps: {
    en: "On an iPhone, open this page in Safari, press Share, then Add to Home Screen. On Android, use Chrome's menu and choose Install app (or Add to Home screen). On a Mac, Safari's File menu has Add to Dock.\nOpen the app once while you are online. Every ticket you hold is then kept on this device: the code, what it is for, when and where — nothing else.\nWith no connection, the app shows \"You're offline\" and your tickets under it. Tap a ticket to show its code full size for the door.\nPress Try again once the signal is back to return to the live app.\nThe kept tickets are removed when you sign out.",
    nl: "Op een iPhone: open deze pagina in Safari, druk op Deel en dan op Zet op beginscherm. Op Android: kies in het menu van Chrome App installeren (of Toevoegen aan startscherm). Op een Mac staat Voeg toe aan Dock in het Archief-menu van Safari.\nOpen de app één keer terwijl je online bent. Elk ticket dat je hebt wordt dan op dit apparaat bewaard: de code, waarvoor het is, wanneer en waar — verder niets.\nZonder verbinding toont de app ‘Je bent offline’ met je tickets eronder. Tik op een ticket om de code groot te tonen bij de deur.\nDruk op Opnieuw proberen zodra je weer bereik hebt om terug te gaan naar de live app.\nDe bewaarde tickets verdwijnen als je uitlogt.",
    es: "En un iPhone, abre esta página en Safari, pulsa Compartir y luego Añadir a pantalla de inicio. En Android, usa el menú de Chrome y elige Instalar app (o Añadir a pantalla de inicio). En un Mac, el menú Archivo de Safari tiene Añadir al Dock.\nAbre la app una vez con conexión. Cada entrada que tengas se guarda entonces en este dispositivo: el código, para qué es, cuándo y dónde; nada más.\nSin conexión, la app muestra «Estás sin conexión» y tus entradas debajo. Toca una entrada para mostrar su código a tamaño completo en la puerta.\nPulsa Reintentar cuando vuelva la cobertura para volver a la app en directo.\nLas entradas guardadas se eliminan al cerrar sesión.", // MT
    pt: "No iPhone, abra esta página no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início. No Android, use o menu do Chrome e escolha Instalar app (ou Adicionar à tela inicial). No Mac, o menu Arquivo do Safari tem Adicionar ao Dock.\nAbra o app uma vez com internet. Cada ingresso seu fica então guardado neste dispositivo: o código, para que é, quando e onde — mais nada.\nSem conexão, o app mostra “Você está offline” e seus ingressos logo abaixo. Toque num ingresso para mostrar o código em tamanho grande na entrada.\nToque em Tentar de novo quando o sinal voltar para retornar ao app ao vivo.\nOs ingressos guardados são removidos quando você sai.", // MT
    de: "Auf dem iPhone: Öffne diese Seite in Safari, tippe auf Teilen und dann auf Zum Home-Bildschirm. Auf Android: Wähle im Chrome-Menü App installieren (oder Zum Startbildschirm hinzufügen). Auf dem Mac hat das Ablage-Menü von Safari Zum Dock hinzufügen.\nÖffne die App einmal, während du online bist. Jedes Ticket, das du hast, wird dann auf diesem Gerät gespeichert: der Code, wofür es ist, wann und wo – sonst nichts.\nOhne Verbindung zeigt die App „Du bist offline“ und darunter deine Tickets. Tippe auf ein Ticket, um seinen Code am Eingang groß zu zeigen.\nTippe auf Erneut versuchen, sobald du wieder Empfang hast, um zur Live-App zurückzukehren.\nDie gespeicherten Tickets werden entfernt, wenn du dich abmeldest.", // MT
    fr: "Sur iPhone, ouvre cette page dans Safari, appuie sur Partager, puis Sur l’écran d’accueil. Sur Android, dans le menu de Chrome, choisis Installer l’application (ou Ajouter à l’écran d’accueil). Sur Mac, le menu Fichier de Safari propose Ajouter au Dock.\nOuvre l’app une fois en étant connecté·e. Chaque billet que tu as est alors gardé sur cet appareil : le code, à quoi il sert, quand et où, rien d’autre.\nSans connexion, l’app affiche « Tu es hors ligne » avec tes billets en dessous. Touche un billet pour afficher son code en grand à l’entrée.\nAppuie sur Réessayer quand le réseau revient pour retrouver l’app en direct.\nLes billets gardés sont supprimés quand tu te déconnectes.", // MT
  },
  help_memberships_title: {
    en: "See your memberships, change your card, stop or add to it",
    nl: "Je lidmaatschappen bekijken, je kaart wijzigen, stoppen of uitbreiden",
    es: "Ver tus membresías, cambiar tu tarjeta, detenerlas o ampliarlas", // MT
    pt: "Ver suas assinaturas, trocar o cartão, parar ou ampliar", // MT
    de: "Deine Mitgliedschaften ansehen, die Karte ändern, beenden oder erweitern", // MT
    fr: "Voir tes adhésions, changer ta carte, les arrêter ou les compléter", // MT
  },

  help_memberships_steps: {
    en: "Open Memberships. Each community you belong to is a card with its tier and status — active, grace, lapsed or cancelled — and what the membership includes.\nGrace means a payment is overdue but your access continues for now. Lapsed means it has ended; rejoin with the community to get it back.\nEverything about paying for it is done here, in Purchases, never on another site: press \"change\" beside your card to use a different one, Stop renewal to let it end at the end of the period, and Add or change to add to it or move to another tier.\nIf it says the membership is managed directly by the community, they bill you outside this app — contact them directly.",
    nl: "Open Lidmaatschappen. Elke community waar je lid van bent is een kaart met je niveau en status — actief, respijt, verlopen of opgezegd — en wat het lidmaatschap omvat.\nRespijt betekent dat een betaling achterloopt, maar dat je toegang voorlopig doorloopt. Verlopen betekent dat het is afgelopen; word opnieuw lid bij de community om het terug te krijgen.\nAlles rond het betalen regel je hier, onder Aankopen, nooit op een andere site: druk op ‘wijzigen’ naast je kaart om een andere te gebruiken, op Verlenging stoppen om het aan het eind van de periode te laten aflopen, en op Toevoegen of wijzigen om iets toe te voegen of naar een ander niveau te gaan.\nStaat er dat de community het lidmaatschap zelf beheert, dan factureert de community je buiten deze app — neem dan rechtstreeks contact op.",
    es: "Abre Membresías. Cada comunidad a la que perteneces es una tarjeta con tu nivel y estado (activa, en gracia, vencida o cancelada) y lo que incluye la membresía.\nEn gracia significa que hay un pago atrasado pero tu acceso continúa por ahora. Vencida significa que ha terminado; vuelve a unirte a la comunidad para recuperarla.\nTodo lo relativo al pago se hace aquí, en Compras, nunca en otro sitio: pulsa «cambiar» junto a tu tarjeta para usar otra, Detener la renovación para que termine al final del periodo, y Añadir o cambiar para ampliarla o pasar a otro nivel.\nSi indica que la comunidad gestiona la membresía directamente, te factura fuera de esta app: contacta con ella directamente.", // MT
    pt: "Abra Assinaturas. Cada comunidade de que você participa é um cartão com seu nível e status — ativa, em carência, vencida ou cancelada — e o que a assinatura inclui.\nEm carência significa que um pagamento está atrasado, mas seu acesso continua por enquanto. Vencida significa que terminou; entre de novo na comunidade para recuperá-la.\nTudo sobre o pagamento é feito aqui, em Compras, nunca em outro site: toque em “alterar” ao lado do cartão para usar outro, Parar renovação para que termine no fim do período, e Adicionar ou alterar para ampliá-la ou mudar de nível.\nSe aparecer que a comunidade gerencia a assinatura diretamente, ela cobra você fora deste app — fale diretamente com ela.", // MT
    de: "Öffne Mitgliedschaften. Jede Community, zu der du gehörst, ist eine Karte mit deiner Stufe und deinem Status – aktiv, Kulanzzeit, abgelaufen oder gekündigt – und dem, was die Mitgliedschaft umfasst.\nKulanzzeit heißt: Eine Zahlung ist überfällig, aber dein Zugang läuft vorerst weiter. Abgelaufen heißt: Sie ist beendet; tritt der Community erneut bei, um sie zurückzubekommen.\nAlles rund ums Bezahlen erledigst du hier, unter Käufe, nie auf einer anderen Website: Tippe neben deiner Karte auf „ändern“, um eine andere zu verwenden, auf Verlängerung beenden, damit sie zum Ende des Zeitraums ausläuft, und auf Hinzufügen oder ändern, um etwas hinzuzufügen oder die Stufe zu wechseln.\nSteht dort, dass die Community die Mitgliedschaft direkt verwaltet, stellt sie dir außerhalb dieser App Rechnungen – wende dich direkt an sie.", // MT
    fr: "Ouvre Adhésions. Chaque communauté dont tu fais partie est une carte avec ton niveau et ton statut (active, en période de grâce, expirée ou annulée) et ce que comprend l’adhésion.\nEn période de grâce : un paiement est en retard, mais ton accès continue pour l’instant. Expirée : elle a pris fin ; adhère de nouveau à la communauté pour la retrouver.\nTout ce qui concerne le paiement se fait ici, dans Achats, jamais sur un autre site : appuie sur « modifier » à côté de ta carte pour en utiliser une autre, sur Arrêter le renouvellement pour qu’elle prenne fin à la fin de la période, et sur Ajouter ou modifier pour la compléter ou changer de niveau.\nS’il est indiqué que la communauté gère directement l’adhésion, elle te facture en dehors de cette app : contacte-la directement.", // MT
  },

  help_files_title: {
    en: "Find a document",
    nl: "Een document vinden",
    es: "Encontrar un documento", // MT
    pt: "Encontrar um documento", // MT
    de: "Ein Dokument finden", // MT
    fr: "Trouver un document", // MT
  },
  help_files_steps: {
    en: "Open Files. Every document you can open is here, per community.\nFrom your community lists what your community shares with its members, including what it shares with your tier only.\nFrom your threads lists the documents your threads have sent you, with the day each one came. A document a thread will send later appears once it is sent.\nTap a file to open it. The address it opens is valid for one minute, so a forwarded link stops working; send the person to Files instead.",
    nl: "Open Bestanden. Elk document dat je kunt openen staat hier, per community.\nVan je community toont wat je community met haar leden deelt, ook wat ze alleen met jouw niveau deelt.\nVan je threads toont de documenten die je threads je hebben gestuurd, met de dag waarop ze kwamen. Een document dat een thread later stuurt, verschijnt zodra het verstuurd is.\nTik op een bestand om het te openen. Het adres dat opent is één minuut geldig, dus een doorgestuurde link werkt niet meer; verwijs iemand liever naar Bestanden.",
    es: "Abre Archivos. Aquí está cada documento que puedes abrir, por comunidad.\nDe tu comunidad muestra lo que tu comunidad comparte con sus miembros, incluido lo que comparte solo con tu nivel.\nDe tus threads muestra los documentos que te han enviado tus threads, con el día en que llegó cada uno. Un documento que un thread enviará más adelante aparece en cuanto se envía.\nToca un archivo para abrirlo. La dirección que se abre vale un minuto, así que un enlace reenviado deja de funcionar; envía a la persona a Archivos.", // MT
    pt: "Abra Arquivos. Todo documento que você pode abrir está aqui, por comunidade.\nDa sua comunidade mostra o que a sua comunidade compartilha com os membros, inclusive o que compartilha só com o seu nível.\nDos seus threads mostra os documentos que seus threads enviaram, com o dia em que cada um chegou. Um documento que um thread vai enviar depois aparece assim que for enviado.\nToque num arquivo para abri-lo. O endereço aberto vale por um minuto, então um link encaminhado para de funcionar; mande a pessoa para Arquivos.", // MT
    de: "Öffne Dateien. Jedes Dokument, das du öffnen kannst, ist hier, nach Community.\nAus deiner Community zeigt, was deine Community mit ihren Mitgliedern teilt, auch das, was sie nur mit deiner Stufe teilt.\nAus deinen Threads zeigt die Dokumente, die dir deine Threads geschickt haben, mit dem Tag, an dem sie kamen. Ein Dokument, das ein Thread später schickt, erscheint, sobald es verschickt ist.\nTippe auf eine Datei, um sie zu öffnen. Die Adresse, die sich öffnet, gilt eine Minute, ein weitergeleiteter Link funktioniert also nicht mehr; schick die Person stattdessen zu Dateien.", // MT
    fr: "Ouvre Fichiers. Chaque document que tu peux ouvrir est ici, par communauté.\nDe ta communauté liste ce que ta communauté partage avec ses membres, y compris ce qu’elle réserve à ton niveau.\nDe tes threads liste les documents que tes threads t’ont envoyés, avec le jour de leur arrivée. Un document qu’un thread enverra plus tard apparaît dès son envoi.\nTouche un fichier pour l’ouvrir. L’adresse ouverte est valable une minute, donc un lien transféré cesse de fonctionner ; envoie plutôt la personne vers Fichiers.", // MT
  },
  help_purchases_title: {
    en: "See your purchases and download invoices",
    nl: "Je aankopen bekijken en facturen downloaden",
    es: "Ver tus compras y descargar facturas", // MT
    pt: "Ver suas compras e baixar faturas", // MT
    de: "Deine Käufe ansehen und Rechnungen herunterladen", // MT
    fr: "Voir tes achats et télécharger les factures", // MT
  },
  help_purchases_steps: {
    en: "Open Purchases. Everything you have paid for — a ticket, a booking, a membership — is one row with the community, the date and the amount.\nA row that is not paid shows its status, and the line at the top counts what is still outstanding.\nPress PDF on a row to download the invoice.\nIf something is missing, check you signed in with the address you paid with. Your name on an invoice comes from You — correct it there and press Save.",
    nl: "Open Aankopen. Alles waarvoor je hebt betaald — een ticket, een boeking, een lidmaatschap — is één regel met de community, de datum en het bedrag.\nEen regel die niet betaald is toont zijn status, en de regel bovenaan telt op wat nog openstaat.\nDruk op PDF bij een regel om de factuur te downloaden.\nMist er iets, kijk dan of je bent ingelogd met het adres waarmee je hebt betaald. Je naam op een factuur komt van Jij — verbeter hem daar en druk op Opslaan.",
    es: "Abre Compras. Todo lo que has pagado (una entrada, una reserva, una membresía) es una fila con la comunidad, la fecha y el importe.\nUna fila sin pagar muestra su estado, y la línea de arriba suma lo que queda pendiente.\nPulsa PDF en una fila para descargar la factura.\nSi falta algo, comprueba que has entrado con la dirección con la que pagaste. Tu nombre en una factura viene de Tú: corrígelo allí y pulsa Guardar.", // MT
    pt: "Abra Compras. Tudo o que você pagou — um ingresso, uma reserva, uma assinatura — é uma linha com a comunidade, a data e o valor.\nUma linha não paga mostra o status, e a linha do topo soma o que ainda está em aberto.\nToque em PDF numa linha para baixar a fatura.\nSe faltar algo, confira se entrou com o endereço com que pagou. Seu nome na fatura vem de Você — corrija lá e toque em Salvar.", // MT
    de: "Öffne Käufe. Alles, wofür du bezahlt hast – ein Ticket, eine Buchung, eine Mitgliedschaft –, ist eine Zeile mit Community, Datum und Betrag.\nEine unbezahlte Zeile zeigt ihren Status, und die Zeile oben zählt zusammen, was noch offen ist.\nTippe bei einer Zeile auf PDF, um die Rechnung herunterzuladen.\nFehlt etwas, prüfe, ob du mit der Adresse angemeldet bist, mit der du bezahlt hast. Dein Name auf einer Rechnung kommt aus Du – korrigiere ihn dort und tippe auf Speichern.", // MT
    fr: "Ouvre Achats. Tout ce que tu as payé (un billet, une réservation, une adhésion) est une ligne avec la communauté, la date et le montant.\nUne ligne non payée affiche son statut, et la ligne du haut totalise ce qui reste dû.\nAppuie sur PDF sur une ligne pour télécharger la facture.\nS’il manque quelque chose, vérifie que tu t’es connecté·e avec l’adresse utilisée pour payer. Ton nom sur une facture vient de Toi : corrige-le là et appuie sur Enregistrer.", // MT
  },
  help_how_to: {
    en: "How to",
    nl: "Hoe doe je",
    es: "Cómo se hace", // MT
    pt: "Como fazer", // MT
    de: "So geht’s", // MT
    fr: "Comment faire", // MT
  },
  help_open: {
    en: "Open →",
    nl: "Openen →",
    es: "Abrir →", // MT
    pt: "Abrir →", // MT
    de: "Öffnen →", // MT
    fr: "Ouvrir →", // MT
  },
  help_organiser_note: {
    en: "Questions about a booking, a place or a refund go to the organiser who runs it — their name is on the row.",
    nl: "Vragen over een boeking, een plek of een terugbetaling stel je aan de organisator — hun naam staat op de regel.",
    es: "Las preguntas sobre una reserva, una plaza o un reembolso van a quien lo organiza: su nombre aparece en la fila.", // MT
    pt: "Dúvidas sobre uma reserva, uma vaga ou um reembolso vão para quem organiza — o nome está na linha.", // MT
    de: "Fragen zu einer Buchung, einem Platz oder einer Erstattung gehen an die Veranstalter:in – der Name steht in der Zeile.", // MT
    fr: "Les questions sur une réservation, une place ou un remboursement s’adressent à l’organisateur : son nom figure sur la ligne.", // MT
  },

  // ── Unsubscribe (the link in every digest) ────────────────────────────
  unsub_title: {
    en: 'Stop these emails',
    nl: 'Stop deze e-mails',
    es: 'Dejar de recibir estos correos', // MT
    pt: 'Parar estes e-mails', // MT
    de: 'Diese E-Mails abbestellen', // MT
    fr: 'Ne plus recevoir ces e-mails', // MT
  },
  unsub_body: {
    en: 'You will stop getting emails about new and changed threads on this community’s calendars. They still show under Notifications when you sign in, and you can turn the emails back on under You.',
    nl: 'Je krijgt geen e-mails meer over nieuwe en gewijzigde threads in de agenda’s van deze community. Ze staan nog wel onder Meldingen als je inlogt, en je kunt de e-mails weer aanzetten onder Jij.',
    es: 'Dejarás de recibir correos sobre threads nuevos y modificados en los calendarios de esta comunidad. Seguirán apareciendo en Notificaciones cuando entres, y puedes volver a activar los correos en Tú.', // MT
    pt: 'Você deixará de receber e-mails sobre threads novos e alterados nos calendários desta comunidade. Eles continuam aparecendo em Notificações quando você entra, e você pode reativar os e-mails em Você.', // MT
    de: 'Du bekommst keine E-Mails mehr über neue und geänderte Threads in den Kalendern dieser Community. Sie erscheinen weiterhin unter Benachrichtigungen, wenn du dich anmeldest, und du kannst die E-Mails unter Du wieder einschalten.', // MT
    fr: 'Tu ne recevras plus d’e-mails sur les threads nouveaux ou modifiés des agendas de cette communauté. Ils restent visibles dans Notifications quand tu te connectes, et tu peux réactiver les e-mails dans Toi.', // MT
  },
  unsub_stopping: {
    en: 'Stopping…',
    nl: 'Bezig met stoppen…',
    es: 'Deteniendo…', // MT
    pt: 'Parando…', // MT
    de: 'Wird abbestellt…', // MT
    fr: 'Arrêt en cours…', // MT
  },
  unsub_done: {
    en: 'Done. No more of these emails.',
    nl: 'Klaar. Geen e-mails meer van deze soort.',
    es: 'Hecho. No recibirás más estos correos.', // MT
    pt: 'Pronto. Você não vai mais receber estes e-mails.', // MT
    de: 'Erledigt. Keine dieser E-Mails mehr.', // MT
    fr: 'C’est fait. Tu ne recevras plus ces e-mails.', // MT
  },
  unsub_done_from: {
    en: 'Done. No more of these emails from {community}.',
    nl: 'Klaar. Geen e-mails meer van deze soort van {community}.',
    es: 'Hecho. No recibirás más estos correos de {community}.', // MT
    pt: 'Pronto. Você não vai mais receber estes e-mails de {community}.', // MT
    de: 'Erledigt. Keine dieser E-Mails mehr von {community}.', // MT
    fr: 'C’est fait. Tu ne recevras plus ces e-mails de {community}.', // MT
  },
  unsub_failed: {
    en: 'This link did not work. Sign in and turn the emails off under You instead.',
    nl: 'Deze link werkte niet. Log in en zet de e-mails uit onder Jij.',
    es: 'Este enlace no ha funcionado. Entra y desactiva los correos en Tú.', // MT
    pt: 'Este link não funcionou. Entre e desative os e-mails em Você.', // MT
    de: 'Dieser Link hat nicht funktioniert. Melde dich an und schalte die E-Mails unter Du aus.', // MT
    fr: 'Ce lien n’a pas fonctionné. Connecte-toi et désactive les e-mails dans Toi.', // MT
  },

  // ── Help, the page title ──────────────────────────────────────────────
  // The same words as the shared chrome's Help link (bottom nav, More sheet).
  help: {
    en: 'Help',
    nl: 'Help',
    es: 'Ayuda', // MT
    pt: 'Ajuda', // MT
    de: 'Hilfe', // MT
    fr: 'Aide', // MT
  },

  // ── Purchases, renewals, Add or change, a cancellation request ────────
  purchases_failed: {
    en: 'We could not load your invoices just now. Nothing is lost — this is us, not your payment. Reload the page in a moment, and tell the community you joined if it keeps happening.',
    nl: 'We konden je facturen nu niet laden. Er is niets verloren — dit ligt aan ons, niet aan je betaling. Laad de pagina zo opnieuw, en laat het de community weten waar je lid van bent als het blijft gebeuren.',
    es: 'No hemos podido cargar tus facturas ahora. No se ha perdido nada: el problema es nuestro, no de tu pago. Recarga la página en un momento y avisa a la comunidad a la que te uniste si sigue pasando.', // MT
    pt: 'Não conseguimos carregar suas faturas agora. Nada se perdeu — o problema é nosso, não do seu pagamento. Recarregue a página daqui a pouco e avise a comunidade em que você entrou se continuar acontecendo.', // MT
    de: 'Wir konnten deine Rechnungen gerade nicht laden. Es ist nichts verloren – das liegt an uns, nicht an deiner Zahlung. Lade die Seite gleich neu und sag der Community Bescheid, der du beigetreten bist, falls es so bleibt.', // MT
    fr: 'Impossible de charger tes factures pour le moment. Rien n’est perdu : le problème vient de nous, pas de ton paiement. Recharge la page dans un instant et préviens la communauté que tu as rejointe si cela continue.', // MT
  },
  purchases_none_title: {
    en: 'Nothing invoiced yet.',
    nl: 'Nog niets gefactureerd.',
    es: 'Aún no hay nada facturado.', // MT
    pt: 'Nada faturado ainda.', // MT
    de: 'Noch nichts in Rechnung gestellt.', // MT
    fr: 'Rien de facturé pour l’instant.', // MT
  },
  purchases_none_body: {
    en: 'Anything you pay for — a membership, a ticket, a booking — appears here with its invoice to download. If you expected something, check you signed in with the address you paid with.',
    nl: 'Alles waarvoor je betaalt — een lidmaatschap, een ticket, een boeking — verschijnt hier met de factuur om te downloaden. Verwachtte je iets? Kijk dan of je bent ingelogd met het adres waarmee je hebt betaald.',
    es: 'Todo lo que pagues (una membresía, una entrada, una reserva) aparece aquí con su factura para descargar. Si esperabas algo, comprueba que has entrado con la dirección con la que pagaste.', // MT
    pt: 'Tudo o que você paga — uma assinatura, um ingresso, uma reserva — aparece aqui com a fatura para baixar. Se esperava algo, confira se entrou com o endereço com que pagou.', // MT
    de: 'Alles, wofür du bezahlst – eine Mitgliedschaft, ein Ticket, eine Buchung –, erscheint hier mit seiner Rechnung zum Herunterladen. Falls du etwas erwartet hast, prüfe, ob du mit der Adresse angemeldet bist, mit der du bezahlt hast.', // MT
    fr: 'Tout ce que tu paies (une adhésion, un billet, une réservation) apparaît ici avec sa facture à télécharger. Si tu attendais quelque chose, vérifie que tu t’es connecté·e avec l’adresse utilisée pour payer.', // MT
  },
  outstanding_one: {
    en: 'One invoice is still outstanding.',
    nl: 'Er staat nog één factuur open.',
    es: 'Aún queda una factura pendiente.', // MT
    pt: 'Ainda há uma fatura em aberto.', // MT
    de: 'Eine Rechnung ist noch offen.', // MT
    fr: 'Une facture est encore en attente.', // MT
  },
  outstanding_many: {
    en: '{n} invoices are still outstanding.',
    nl: 'Er staan nog {n} facturen open.',
    es: 'Aún quedan {n} facturas pendientes.', // MT
    pt: 'Ainda há {n} faturas em aberto.', // MT
    de: '{n} Rechnungen sind noch offen.', // MT
    fr: '{n} factures sont encore en attente.', // MT
  },
  // What an invoice row says it was, when the purchase carries no label.
  sold_membership: {
    en: 'Membership',
    nl: 'Lidmaatschap',
    es: 'Membresía', // MT
    pt: 'Assinatura', // MT
    de: 'Mitgliedschaft', // MT
    fr: 'Adhésion', // MT
  },
  sold_meeting: {
    en: 'Meeting',
    nl: 'Gesprek',
    es: 'Reunión', // MT
    pt: 'Reunião', // MT
    de: 'Termin', // MT
    fr: 'Rendez-vous', // MT
  },
  purchase: {
    en: 'Purchase',
    nl: 'Aankoop',
    es: 'Compra', // MT
    pt: 'Compra', // MT
    de: 'Kauf', // MT
    fr: 'Achat', // MT
  },
  billing_title: {
    en: 'Billing details',
    nl: 'Factuurgegevens',
    es: 'Datos de facturación', // MT
    pt: 'Dados de faturamento', // MT
    de: 'Rechnungsdaten', // MT
    fr: 'Coordonnées de facturation', // MT
  },
  billing_from_checkout: {
    en: 'As given at your last payment — check them and save to keep them here.',
    nl: 'Zoals opgegeven bij je laatste betaling — controleer ze en sla ze op om ze hier te bewaren.',
    es: 'Tal como los diste en tu último pago: revísalos y guárdalos para conservarlos aquí.', // MT
    pt: 'Como informados no seu último pagamento — confira e salve para mantê-los aqui.', // MT
    de: 'So wie bei deiner letzten Zahlung angegeben – prüfe sie und speichere sie, um sie hier zu behalten.', // MT
    fr: 'Tels que donnés lors de ton dernier paiement : vérifie-les et enregistre-les pour les garder ici.', // MT
  },
  billing_used_next: {
    en: 'Used for your next invoices. Invoices already issued keep the details they were issued with.',
    nl: 'Gebruikt voor je volgende facturen. Facturen die al zijn uitgereikt houden de gegevens waarmee ze zijn opgesteld.',
    es: 'Se usan para tus próximas facturas. Las facturas ya emitidas conservan los datos con los que se emitieron.', // MT
    pt: 'Usados nas suas próximas faturas. As faturas já emitidas mantêm os dados com que foram emitidas.', // MT
    de: 'Werden für deine nächsten Rechnungen verwendet. Bereits ausgestellte Rechnungen behalten die Angaben, mit denen sie ausgestellt wurden.', // MT
    fr: 'Utilisées pour tes prochaines factures. Les factures déjà émises gardent les informations avec lesquelles elles ont été établies.', // MT
  },
  f_name: {
    en: 'Name',
    nl: 'Naam',
    es: 'Nombre', // MT
    pt: 'Nome', // MT
    de: 'Name', // MT
    fr: 'Nom', // MT
  },
  f_company: {
    en: 'Company (optional)',
    nl: 'Bedrijf (optioneel)',
    es: 'Empresa (opcional)', // MT
    pt: 'Empresa (opcional)', // MT
    de: 'Firma (optional)', // MT
    fr: 'Entreprise (facultatif)', // MT
  },
  f_address: {
    en: 'Address',
    nl: 'Adres',
    es: 'Dirección', // MT
    pt: 'Endereço', // MT
    de: 'Adresse', // MT
    fr: 'Adresse', // MT
  },
  f_postal_code: {
    en: 'Postal code',
    nl: 'Postcode',
    es: 'Código postal', // MT
    pt: 'CEP', // MT
    de: 'Postleitzahl', // MT
    fr: 'Code postal', // MT
  },
  f_city: {
    en: 'City',
    nl: 'Plaats',
    es: 'Ciudad', // MT
    pt: 'Cidade', // MT
    de: 'Ort', // MT
    fr: 'Ville', // MT
  },
  f_country: {
    en: 'Country',
    nl: 'Land',
    es: 'País', // MT
    pt: 'País', // MT
    de: 'Land', // MT
    fr: 'Pays', // MT
  },
  choose_country: {
    en: 'Choose a country',
    nl: 'Kies een land',
    es: 'Elige un país', // MT
    pt: 'Escolha um país', // MT
    de: 'Wähle ein Land', // MT
    fr: 'Choisis un pays', // MT
  },
  f_vat: {
    en: 'VAT number (businesses, optional)',
    nl: 'Btw-nummer (bedrijven, optioneel)',
    es: 'Número de IVA (empresas, opcional)', // MT
    pt: 'Número fiscal (empresas, opcional)', // MT
    de: 'USt-IdNr. (Unternehmen, optional)', // MT
    fr: 'Numéro de TVA (entreprises, facultatif)', // MT
  },
  save: {
    en: 'Save',
    nl: 'Opslaan',
    es: 'Guardar', // MT
    pt: 'Salvar', // MT
    de: 'Speichern', // MT
    fr: 'Enregistrer', // MT
  },
  saving: {
    en: 'Saving…',
    nl: 'Opslaan…',
    es: 'Guardando…', // MT
    pt: 'Salvando…', // MT
    de: 'Wird gespeichert…', // MT
    fr: 'Enregistrement…', // MT
  },
  saved: {
    en: 'Saved.',
    nl: 'Opgeslagen.',
    es: 'Guardado.', // MT
    pt: 'Salvo.', // MT
    de: 'Gespeichert.', // MT
    fr: 'Enregistré.', // MT
  },
  could_not_save: {
    en: 'Could not save ({status}).',
    nl: 'Opslaan lukte niet ({status}).',
    es: 'No se ha podido guardar ({status}).', // MT
    pt: 'Não foi possível salvar ({status}).', // MT
    de: 'Speichern hat nicht geklappt ({status}).', // MT
    fr: 'Impossible d’enregistrer ({status}).', // MT
  },
  billing_sub_error: {
    en: 'could not update the payment details just now — tell the community if this stays.',
    nl: 'de betaalgegevens konden nu niet worden bijgewerkt — laat het de community weten als dit zo blijft.',
    es: 'no se han podido actualizar los datos de pago ahora; avisa a la comunidad si sigue así.', // MT
    pt: 'não foi possível atualizar os dados de pagamento agora — avise a comunidade se continuar assim.', // MT
    de: 'die Zahlungsdaten konnten gerade nicht aktualisiert werden – sag der Community Bescheid, falls das so bleibt.', // MT
    fr: 'impossible de mettre à jour les informations de paiement pour le moment ; préviens la communauté si cela persiste.', // MT
  },
  billing_sub_vat: {
    en: 'from your next invoice, {vat}.',
    nl: 'vanaf je volgende factuur, {vat}.',
    es: 'a partir de tu próxima factura, {vat}.', // MT
    pt: 'a partir da sua próxima fatura, {vat}.', // MT
    de: 'ab deiner nächsten Rechnung, {vat}.', // MT
    fr: 'à partir de ta prochaine facture, {vat}.', // MT
  },
  billing_sub_updated: {
    en: 'details updated.',
    nl: 'gegevens bijgewerkt.',
    es: 'datos actualizados.', // MT
    pt: 'dados atualizados.', // MT
    de: 'Angaben aktualisiert.', // MT
    fr: 'informations mises à jour.', // MT
  },
  // Renewals: a membership's and a product subscription's.
  your_memberships: {
    en: 'Your memberships',
    nl: 'Je lidmaatschappen',
    es: 'Tus membresías', // MT
    pt: 'Suas assinaturas', // MT
    de: 'Deine Mitgliedschaften', // MT
    fr: 'Tes adhésions', // MT
  },
  your_subscriptions: {
    en: 'Your subscriptions',
    nl: 'Je abonnementen',
    es: 'Tus suscripciones', // MT
    pt: 'Suas assinaturas avulsas', // MT
    de: 'Deine Abonnements', // MT
    fr: 'Tes abonnements', // MT
  },
  add_or_change: {
    en: 'Add or change',
    nl: 'Toevoegen of wijzigen',
    es: 'Añadir o cambiar', // MT
    pt: 'Adicionar ou alterar', // MT
    de: 'Hinzufügen oder ändern', // MT
    fr: 'Ajouter ou modifier', // MT
  },
  stop_renewal: {
    en: 'Stop renewal',
    nl: 'Verlenging stoppen',
    es: 'Detener la renovación', // MT
    pt: 'Parar renovação', // MT
    de: 'Verlängerung beenden', // MT
    fr: 'Arrêter le renouvellement', // MT
  },
  resume_renewal: {
    en: 'Resume renewal',
    nl: 'Verlenging hervatten',
    es: 'Reanudar la renovación', // MT
    pt: 'Retomar renovação', // MT
    de: 'Verlängerung fortsetzen', // MT
    fr: 'Reprendre le renouvellement', // MT
  },
  renew_managed: {
    en: 'This membership is managed directly by the community.',
    nl: 'Dit lidmaatschap wordt rechtstreeks door de community beheerd.',
    es: 'Esta membresía la gestiona directamente la comunidad.', // MT
    pt: 'Esta assinatura é gerenciada diretamente pela comunidade.', // MT
    de: 'Diese Mitgliedschaft wird direkt von der Community verwaltet.', // MT
    fr: 'Cette adhésion est gérée directement par la communauté.', // MT
  },
  renew_unavailable: {
    en: 'The renewal could not be read just now.',
    nl: 'De verlenging kon nu niet worden gelezen.',
    es: 'No se ha podido leer la renovación ahora.', // MT
    pt: 'Não foi possível ler a renovação agora.', // MT
    de: 'Die Verlängerung konnte gerade nicht gelesen werden.', // MT
    fr: 'Le renouvellement n’a pas pu être lu pour le moment.', // MT
  },
  renew_stops: {
    en: 'Does not renew. Active until {date}.',
    nl: 'Wordt niet verlengd. Actief tot en met {date}.',
    es: 'No se renueva. Activa hasta el {date}.', // MT
    pt: 'Não renova. Ativa até {date}.', // MT
    de: 'Wird nicht verlängert. Aktiv bis {date}.', // MT
    fr: 'Ne se renouvelle pas. Active jusqu’au {date}.', // MT
  },
  renew_stops_product: {
    en: 'Does not renew. Yours until {date}.',
    nl: 'Wordt niet verlengd. Van jou tot en met {date}.',
    es: 'No se renueva. Tuyo hasta el {date}.', // MT
    pt: 'Não renova. Seu até {date}.', // MT
    de: 'Wird nicht verlängert. Deins bis {date}.', // MT
    fr: 'Ne se renouvelle pas. À toi jusqu’au {date}.', // MT
  },
  renews_on_at: {
    en: 'Renews on {date} at {total}.',
    nl: 'Wordt verlengd op {date} voor {total}.',
    es: 'Se renueva el {date} por {total}.', // MT
    pt: 'Renova em {date} por {total}.', // MT
    de: 'Wird am {date} für {total} verlängert.', // MT
    fr: 'Se renouvelle le {date} pour {total}.', // MT
  },
  renews_on_at_vat: {
    en: 'Renews on {date} at {total} incl. VAT ({subtotal} + VAT {tax}).',
    nl: 'Wordt verlengd op {date} voor {total} incl. btw ({subtotal} + btw {tax}).',
    es: 'Se renueva el {date} por {total} IVA incl. ({subtotal} + IVA {tax}).', // MT
    pt: 'Renova em {date} por {total} com impostos ({subtotal} + impostos {tax}).', // MT
    de: 'Wird am {date} für {total} inkl. MwSt. verlängert ({subtotal} + MwSt. {tax}).', // MT
    fr: 'Se renouvelle le {date} pour {total} TTC ({subtotal} + TVA {tax}).', // MT
  },
  renews_on: {
    en: 'Renews on {date}.',
    nl: 'Wordt verlengd op {date}.',
    es: 'Se renueva el {date}.', // MT
    pt: 'Renova em {date}.', // MT
    de: 'Wird am {date} verlängert.', // MT
    fr: 'Se renouvelle le {date}.', // MT
  },
  renew_change_failed: {
    en: 'Could not change the renewal ({status}).',
    nl: 'De verlenging kon niet worden gewijzigd ({status}).',
    es: 'No se ha podido cambiar la renovación ({status}).', // MT
    pt: 'Não foi possível alterar a renovação ({status}).', // MT
    de: 'Die Verlängerung konnte nicht geändert werden ({status}).', // MT
    fr: 'Impossible de modifier le renouvellement ({status}).', // MT
  },
  stop_q: {
    en: 'Stop the renewal?',
    nl: 'De verlenging stoppen?',
    es: '¿Detener la renovación?', // MT
    pt: 'Parar a renovação?', // MT
    de: 'Verlängerung beenden?', // MT
    fr: 'Arrêter le renouvellement ?', // MT
  },
  resume_q: {
    en: 'Resume the renewal?',
    nl: 'De verlenging hervatten?',
    es: '¿Reanudar la renovación?', // MT
    pt: 'Retomar a renovação?', // MT
    de: 'Verlängerung fortsetzen?', // MT
    fr: 'Reprendre le renouvellement ?', // MT
  },
  stop_msg: {
    en: 'Your {tier} membership of {community} stays active until {date}, and nothing more is charged. You can resume it until then.',
    nl: 'Je {tier}-lidmaatschap van {community} blijft actief tot en met {date}, en er wordt niets meer afgeschreven. Tot dan kun je het hervatten.',
    es: 'Tu membresía {tier} de {community} sigue activa hasta el {date} y no se cobra nada más. Puedes reanudarla hasta entonces.', // MT
    pt: 'Sua assinatura {tier} de {community} continua ativa até {date}, e nada mais é cobrado. Você pode retomá-la até lá.', // MT
    de: 'Deine {tier}-Mitgliedschaft bei {community} bleibt bis {date} aktiv, und es wird nichts mehr berechnet. Bis dahin kannst du sie fortsetzen.', // MT
    fr: 'Ton adhésion {tier} à {community} reste active jusqu’au {date}, et plus rien n’est prélevé. Tu peux la reprendre d’ici là.', // MT
  },
  resume_msg: {
    en: 'Your {tier} membership of {community} will renew on {date} again.',
    nl: 'Je {tier}-lidmaatschap van {community} wordt weer verlengd op {date}.',
    es: 'Tu membresía {tier} de {community} se renovará de nuevo el {date}.', // MT
    pt: 'Sua assinatura {tier} de {community} voltará a renovar em {date}.', // MT
    de: 'Deine {tier}-Mitgliedschaft bei {community} wird am {date} wieder verlängert.', // MT
    fr: 'Ton adhésion {tier} à {community} se renouvellera de nouveau le {date}.', // MT
  },
  end_of_period: {
    en: 'the end of this period',
    nl: 'het einde van deze periode',
    es: 'el final de este periodo', // MT
    pt: 'o fim deste período', // MT
    de: 'zum Ende dieses Zeitraums', // MT
    fr: 'la fin de cette période', // MT
  },
  its_renewal_date: {
    en: 'its renewal date',
    nl: 'de verlengingsdatum',
    es: 'su fecha de renovación', // MT
    pt: 'a data de renovação', // MT
    de: 'zum Verlängerungsdatum', // MT
    fr: 'sa date de renouvellement', // MT
  },
  stop_msg_product: {
    en: '{what} from {community} stays yours until {date}, and nothing more is charged. You can resume it until then.',
    nl: '{what} van {community} blijft van jou tot en met {date}, en er wordt niets meer afgeschreven. Tot dan kun je het hervatten.',
    es: '{what} de {community} sigue siendo tuyo hasta el {date} y no se cobra nada más. Puedes reanudarlo hasta entonces.', // MT
    pt: '{what} de {community} continua seu até {date}, e nada mais é cobrado. Você pode retomar até lá.', // MT
    de: '{what} von {community} bleibt bis {date} deins, und es wird nichts mehr berechnet. Bis dahin kannst du es fortsetzen.', // MT
    fr: '{what} de {community} reste à toi jusqu’au {date}, et plus rien n’est prélevé. Tu peux le reprendre d’ici là.', // MT
  },
  resume_msg_product: {
    en: '{what} from {community} will renew on {date} again.',
    nl: '{what} van {community} wordt weer verlengd op {date}.',
    es: '{what} de {community} se renovará de nuevo el {date}.', // MT
    pt: '{what} de {community} voltará a renovar em {date}.', // MT
    de: '{what} von {community} wird am {date} wieder verlängert.', // MT
    fr: '{what} de {community} se renouvellera de nouveau le {date}.', // MT
  },
  this_subscription: {
    en: 'this subscription',
    nl: 'dit abonnement',
    es: 'esta suscripción', // MT
    pt: 'esta assinatura', // MT
    de: 'dieses Abonnement', // MT
    fr: 'cet abonnement', // MT
  },
  // The card renewals are charged to (card-change.tsx).
  card_line: {
    en: 'Card · {brand} ···· {last4}',
    nl: 'Kaart · {brand} ···· {last4}',
    es: 'Tarjeta · {brand} ···· {last4}', // MT
    pt: 'Cartão · {brand} ···· {last4}', // MT
    de: 'Karte · {brand} ···· {last4}', // MT
    fr: 'Carte · {brand} ···· {last4}', // MT
  },
  no_card: {
    en: 'No card on file',
    nl: 'Geen kaart bekend',
    es: 'No hay tarjeta guardada', // MT
    pt: 'Nenhum cartão cadastrado', // MT
    de: 'Keine Karte hinterlegt', // MT
    fr: 'Aucune carte enregistrée', // MT
  },
  change: {
    en: 'change',
    nl: 'wijzigen',
    es: 'cambiar', // MT
    pt: 'alterar', // MT
    de: 'ändern', // MT
    fr: 'modifier', // MT
  },
  something_wrong_status: {
    en: 'Something went wrong ({status}).',
    nl: 'Er ging iets mis ({status}).',
    es: 'Algo ha fallado ({status}).', // MT
    pt: 'Algo deu errado ({status}).', // MT
    de: 'Etwas ist schiefgelaufen ({status}).', // MT
    fr: 'Un problème est survenu ({status}).', // MT
  },
  change_card_title: {
    en: 'Change your card',
    nl: 'Je kaart wijzigen',
    es: 'Cambiar tu tarjeta', // MT
    pt: 'Trocar seu cartão', // MT
    de: 'Karte ändern', // MT
    fr: 'Changer ta carte', // MT
  },
  change_card_desc: {
    en: 'Your new card is used from the next renewal. Nothing is charged now.',
    nl: 'Je nieuwe kaart wordt gebruikt vanaf de volgende verlenging. Er wordt nu niets afgeschreven.',
    es: 'Tu nueva tarjeta se usará desde la próxima renovación. Ahora no se cobra nada.', // MT
    pt: 'Seu novo cartão é usado a partir da próxima renovação. Nada é cobrado agora.', // MT
    de: 'Deine neue Karte wird ab der nächsten Verlängerung verwendet. Jetzt wird nichts berechnet.', // MT
    fr: 'Ta nouvelle carte sera utilisée dès le prochain renouvellement. Rien n’est prélevé maintenant.', // MT
  },
  loading: {
    en: 'Loading…',
    nl: 'Laden…',
    es: 'Cargando…', // MT
    pt: 'Carregando…', // MT
    de: 'Wird geladen…', // MT
    fr: 'Chargement…', // MT
  },
  card_not_confirmed: {
    en: 'The card could not be confirmed.',
    nl: 'De kaart kon niet worden bevestigd.',
    es: 'No se ha podido confirmar la tarjeta.', // MT
    pt: 'Não foi possível confirmar o cartão.', // MT
    de: 'Die Karte konnte nicht bestätigt werden.', // MT
    fr: 'La carte n’a pas pu être confirmée.', // MT
  },
  card_saved: {
    en: 'Saved. Your membership now renews on your {brand} card ending {last4}. A confirmation is on its way.',
    nl: 'Opgeslagen. Je lidmaatschap wordt nu verlengd met je {brand}-kaart eindigend op {last4}. Er is een bevestiging onderweg.',
    es: 'Guardado. Tu membresía se renueva ahora con tu tarjeta {brand} terminada en {last4}. Te enviamos una confirmación.', // MT
    pt: 'Salvo. Sua assinatura agora renova no seu cartão {brand} final {last4}. Uma confirmação está a caminho.', // MT
    de: 'Gespeichert. Deine Mitgliedschaft wird jetzt mit deiner {brand}-Karte mit der Endung {last4} verlängert. Eine Bestätigung ist unterwegs.', // MT
    fr: 'Enregistré. Ton adhésion se renouvelle désormais avec ta carte {brand} se terminant par {last4}. Une confirmation est en route.', // MT
  },
  close: {
    en: 'Close',
    nl: 'Sluiten',
    es: 'Cerrar', // MT
    pt: 'Fechar', // MT
    de: 'Schließen', // MT
    fr: 'Fermer', // MT
  },
  save_card: {
    en: 'Save card',
    nl: 'Kaart opslaan',
    es: 'Guardar tarjeta', // MT
    pt: 'Salvar cartão', // MT
    de: 'Karte speichern', // MT
    fr: 'Enregistrer la carte', // MT
  },
  // Add or change (change-membership.tsx). per_* stand inside sentences.
  per_month: {
    en: 'month',
    nl: 'maand',
    es: 'mes', // MT
    pt: 'mês', // MT
    de: 'Monat', // MT
    fr: 'mois', // MT
  },
  per_year: {
    en: 'year',
    nl: 'jaar',
    es: 'año', // MT
    pt: 'ano', // MT
    de: 'Jahr', // MT
    fr: 'an', // MT
  },
  one_moment: {
    en: 'One moment…',
    nl: 'Een moment…',
    es: 'Un momento…', // MT
    pt: 'Um momento…', // MT
    de: 'Einen Moment…', // MT
    fr: 'Un instant…', // MT
  },
  pay_amount: {
    en: 'Pay {amount}',
    nl: 'Betaal {amount}',
    es: 'Pagar {amount}', // MT
    pt: 'Pagar {amount}', // MT
    de: '{amount} bezahlen', // MT
    fr: 'Payer {amount}', // MT
  },
  confirm: {
    en: 'Confirm',
    nl: 'Bevestigen',
    es: 'Confirmar', // MT
    pt: 'Confirmar', // MT
    de: 'Bestätigen', // MT
    fr: 'Confirmer', // MT
  },
  change_done_addon: {
    en: '{name} is added to your membership.',
    nl: '{name} is toegevoegd aan je lidmaatschap.',
    es: '{name} se ha añadido a tu membresía.', // MT
    pt: '{name} foi adicionado à sua assinatura.', // MT
    de: '{name} wurde deiner Mitgliedschaft hinzugefügt.', // MT
    fr: '{name} a été ajouté à ton adhésion.', // MT
  },
  change_done_tier: {
    en: 'You are now a {name} member.',
    nl: 'Je bent nu {name}-lid.',
    es: 'Ahora eres miembro {name}.', // MT
    pt: 'Agora você é membro {name}.', // MT
    de: 'Du bist jetzt {name}-Mitglied.', // MT
    fr: 'Tu es maintenant membre {name}.', // MT
  },
  receipt_on_way: {
    en: 'Your receipt is on its way and appears under Purchases.',
    nl: 'Je bon is onderweg en staat onder Aankopen.',
    es: 'Tu recibo está en camino y aparece en Compras.', // MT
    pt: 'Seu recibo está a caminho e aparece em Compras.', // MT
    de: 'Deine Quittung ist unterwegs und erscheint unter Käufe.', // MT
    fr: 'Ton reçu est en route et apparaît dans Achats.', // MT
  },
  add_to_membership: {
    en: 'Add to your membership',
    nl: 'Toevoegen aan je lidmaatschap',
    es: 'Añadir a tu membresía', // MT
    pt: 'Adicionar à sua assinatura', // MT
    de: 'Zu deiner Mitgliedschaft hinzufügen', // MT
    fr: 'Ajouter à ton adhésion', // MT
  },
  renews_with_per: {
    en: 'Renews with your membership, per {per}',
    nl: 'Wordt verlengd met je lidmaatschap, per {per}',
    es: 'Se renueva con tu membresía, por {per}', // MT
    pt: 'Renova com sua assinatura, por {per}', // MT
    de: 'Verlängert sich mit deiner Mitgliedschaft, pro {per}', // MT
    fr: 'Se renouvelle avec ton adhésion, par {per}', // MT
  },
  one_off: {
    en: 'One-off',
    nl: 'Eenmalig',
    es: 'Pago único', // MT
    pt: 'Avulso', // MT
    de: 'Einmalig', // MT
    fr: 'Ponctuel', // MT
  },
  change_your_membership: {
    en: 'Change your membership',
    nl: 'Je lidmaatschap wijzigen',
    es: 'Cambiar tu membresía', // MT
    pt: 'Alterar sua assinatura', // MT
    de: 'Mitgliedschaft ändern', // MT
    fr: 'Modifier ton adhésion', // MT
  },
  price_per: {
    en: '{price} / {per}',
    nl: '{price} / {per}',
    es: '{price} / {per}', // MT
    pt: '{price} / {per}', // MT
    de: '{price} / {per}', // MT
    fr: '{price} / {per}', // MT
  },
  less_than_now: {
    en: 'Less than now',
    nl: 'Minder dan nu',
    es: 'Menos que ahora', // MT
    pt: 'Menos que agora', // MT
    de: 'Weniger als jetzt', // MT
    fr: 'Moins qu’aujourd’hui', // MT
  },
  more_than_now: {
    en: 'More than now',
    nl: 'Meer dan nu',
    es: 'Más que ahora', // MT
    pt: 'Mais que agora', // MT
    de: 'Mehr als jetzt', // MT
    fr: 'Plus qu’aujourd’hui', // MT
  },
  nothing_to_change: {
    en: 'There is nothing to add or change to here right now.',
    nl: 'Er is hier op dit moment niets toe te voegen of te wijzigen.',
    es: 'Ahora mismo no hay nada que añadir o cambiar aquí.', // MT
    pt: 'Não há nada para adicionar ou alterar aqui agora.', // MT
    de: 'Hier gibt es gerade nichts hinzuzufügen oder zu ändern.', // MT
    fr: 'Il n’y a rien à ajouter ou à modifier ici pour l’instant.', // MT
  },
  prices_excl_vat: {
    en: 'Prices are excl. VAT.',
    nl: 'Prijzen zijn excl. btw.',
    es: 'Precios sin IVA.', // MT
    pt: 'Preços sem impostos.', // MT
    de: 'Preise zzgl. MwSt.', // MT
    fr: 'Prix HT.', // MT
  },
  // {amount} is rendered bold, so it is a slot; {vat} is quote_vat or empty.
  quote_pay_now: {
    en: 'You pay {amount} now{vat}, for the rest of this period, with the card on your membership.',
    nl: 'Je betaalt nu {amount}{vat}, voor de rest van deze periode, met de kaart van je lidmaatschap.',
    es: 'Pagas {amount} ahora{vat}, por el resto de este periodo, con la tarjeta de tu membresía.', // MT
    pt: 'Você paga {amount} agora{vat}, pelo resto deste período, com o cartão da sua assinatura.', // MT
    de: 'Du zahlst jetzt {amount}{vat} für den Rest dieses Zeitraums, mit der Karte deiner Mitgliedschaft.', // MT
    fr: 'Tu paies {amount} maintenant{vat}, pour le reste de cette période, avec la carte de ton adhésion.', // MT
  },
  quote_vat: {
    en: ' (incl. {tax} VAT)',
    nl: ' (incl. {tax} btw)',
    es: ' (IVA de {tax} incl.)', // MT
    pt: ' (com {tax} de impostos)', // MT
    de: ' (inkl. {tax} MwSt.)', // MT
    fr: ' (dont {tax} de TVA)', // MT
  },
  quote_credit_refund: {
    en: 'Nothing is charged now. The {amount} difference for the rest of this period is refunded to your card.',
    nl: 'Er wordt nu niets afgeschreven. Het verschil van {amount} voor de rest van deze periode wordt teruggestort op je kaart.',
    es: 'Ahora no se cobra nada. La diferencia de {amount} por el resto de este periodo se reembolsa en tu tarjeta.', // MT
    pt: 'Nada é cobrado agora. A diferença de {amount} pelo resto deste período é reembolsada no seu cartão.', // MT
    de: 'Jetzt wird nichts berechnet. Die Differenz von {amount} für den Rest dieses Zeitraums wird deiner Karte gutgeschrieben.', // MT
    fr: 'Rien n’est prélevé maintenant. La différence de {amount} pour le reste de cette période est remboursée sur ta carte.', // MT
  },
  quote_credit_credit: {
    en: 'Nothing is charged now. The {amount} difference for the rest of this period is credited against your next invoice.',
    nl: 'Er wordt nu niets afgeschreven. Het verschil van {amount} voor de rest van deze periode wordt verrekend met je volgende factuur.',
    es: 'Ahora no se cobra nada. La diferencia de {amount} por el resto de este periodo se descuenta de tu próxima factura.', // MT
    pt: 'Nada é cobrado agora. A diferença de {amount} pelo resto deste período é abatida da sua próxima fatura.', // MT
    de: 'Jetzt wird nichts berechnet. Die Differenz von {amount} für den Rest dieses Zeitraums wird mit deiner nächsten Rechnung verrechnet.', // MT
    fr: 'Rien n’est prélevé maintenant. La différence de {amount} pour le reste de cette période est déduite de ta prochaine facture.', // MT
  },
  nothing_charged: {
    en: 'Nothing is charged now.',
    nl: 'Er wordt nu niets afgeschreven.',
    es: 'Ahora no se cobra nada.', // MT
    pt: 'Nada é cobrado agora.', // MT
    de: 'Jetzt wird nichts berechnet.', // MT
    fr: 'Rien n’est prélevé maintenant.', // MT
  },
  then_every_month: {
    en: 'Then {amount}{vat} on {date}, and every month after.',
    nl: 'Daarna {amount}{vat} op {date}, en vanaf dan elke maand.',
    es: 'Después, {amount}{vat} el {date}, y cada mes a partir de entonces.', // MT
    pt: 'Depois, {amount}{vat} em {date}, e todo mês a partir daí.', // MT
    de: 'Danach {amount}{vat} am {date} und von da an jeden Monat.', // MT
    fr: 'Puis {amount}{vat} le {date}, et chaque mois ensuite.', // MT
  },
  then_every_year: {
    en: 'Then {amount}{vat} on {date}, and every year after.',
    nl: 'Daarna {amount}{vat} op {date}, en vanaf dan elk jaar.',
    es: 'Después, {amount}{vat} el {date}, y cada año a partir de entonces.', // MT
    pt: 'Depois, {amount}{vat} em {date}, e todo ano a partir daí.', // MT
    de: 'Danach {amount}{vat} am {date} und von da an jedes Jahr.', // MT
    fr: 'Puis {amount}{vat} le {date}, et chaque année ensuite.', // MT
  },
  then_vat: {
    en: ' incl. VAT',
    nl: ' incl. btw',
    es: ' IVA incl.', // MT
    pt: ' com impostos', // MT
    de: ' inkl. MwSt.', // MT
    fr: ' TTC', // MT
  },
  working_price: {
    en: 'Working out the price…',
    nl: 'De prijs wordt berekend…',
    es: 'Calculando el precio…', // MT
    pt: 'Calculando o preço…', // MT
    de: 'Der Preis wird berechnet…', // MT
    fr: 'Calcul du prix…', // MT
  },
  // A cancellation request (cancellation.tsx), inside a thread's sheet.
  cancel_requested: {
    en: 'Cancellation requested on {date}. The organiser will let you know.',
    nl: 'Annulering aangevraagd op {date}. De organisator laat het je weten.',
    es: 'Cancelación solicitada el {date}. Quien organiza te avisará.', // MT
    pt: 'Cancelamento pedido em {date}. Quem organiza vai avisar você.', // MT
    de: 'Stornierung am {date} angefragt. Die Veranstalter:in meldet sich bei dir.', // MT
    fr: 'Annulation demandée le {date}. L’organisateur te tiendra informé·e.', // MT
  },
  withdraw_request: {
    en: 'Withdraw request',
    nl: 'Aanvraag intrekken',
    es: 'Retirar solicitud', // MT
    pt: 'Retirar pedido', // MT
    de: 'Anfrage zurückziehen', // MT
    fr: 'Retirer la demande', // MT
  },
  cancel_approved: {
    en: 'Your place was cancelled at your request.',
    nl: 'Je plek is op jouw verzoek geannuleerd.',
    es: 'Tu plaza se canceló a petición tuya.', // MT
    pt: 'Sua vaga foi cancelada a seu pedido.', // MT
    de: 'Dein Platz wurde auf deinen Wunsch storniert.', // MT
    fr: 'Ta place a été annulée à ta demande.', // MT
  },
  cancel_rejected: {
    en: 'The organiser kept your place.',
    nl: 'De organisator heeft je plek behouden.',
    es: 'Quien organiza ha mantenido tu plaza.', // MT
    pt: 'Quem organiza manteve sua vaga.', // MT
    de: 'Die Veranstalter:in hat deinen Platz behalten.', // MT
    fr: 'L’organisateur a conservé ta place.', // MT
  },
  request_cancellation: {
    en: 'Request cancellation',
    nl: 'Annulering aanvragen',
    es: 'Solicitar cancelación', // MT
    pt: 'Pedir cancelamento', // MT
    de: 'Stornierung anfragen', // MT
    fr: 'Demander l’annulation', // MT
  },
  cancel_explain: {
    en: 'The organiser decides. Until they do, your place stays yours. If you paid, they also decide about a refund.',
    nl: 'De organisator beslist. Tot die tijd blijft je plek van jou. Heb je betaald, dan beslist de organisator ook over een terugbetaling.',
    es: 'Quien organiza decide. Hasta entonces, tu plaza sigue siendo tuya. Si pagaste, también decide sobre el reembolso.', // MT
    pt: 'Quem organiza decide. Até lá, sua vaga continua sua. Se você pagou, também decide sobre o reembolso.', // MT
    de: 'Die Veranstalter:in entscheidet. Bis dahin bleibt dein Platz deiner. Wenn du bezahlt hast, entscheidet sie auch über eine Erstattung.', // MT
    fr: 'L’organisateur décide. D’ici là, ta place reste la tienne. Si tu as payé, il décide aussi du remboursement.', // MT
  },
  reason_optional: {
    en: 'Reason (optional)',
    nl: 'Reden (optioneel)',
    es: 'Motivo (opcional)', // MT
    pt: 'Motivo (opcional)', // MT
    de: 'Grund (optional)', // MT
    fr: 'Raison (facultatif)', // MT
  },
  send_request: {
    en: 'Send request',
    nl: 'Aanvraag versturen',
    es: 'Enviar solicitud', // MT
    pt: 'Enviar pedido', // MT
    de: 'Anfrage senden', // MT
    fr: 'Envoyer la demande', // MT
  },

  // ── Memberships ───────────────────────────────────────────────────────
  memberships_none_title: {
    en: 'You are not a member anywhere yet.',
    nl: 'Je bent nog nergens lid.',
    es: 'Aún no eres miembro de ninguna parte.', // MT
    pt: 'Você ainda não é membro de nenhum lugar.', // MT
    de: 'Du bist noch nirgends Mitglied.', // MT
    fr: 'Tu n’es encore membre nulle part.', // MT
  },
  memberships_none_body: {
    en: 'A membership appears here when you join a community. If you expected one, check you signed in with the address you joined with.',
    nl: 'Een lidmaatschap verschijnt hier zodra je lid wordt van een community. Verwachtte je er een? Kijk dan of je bent ingelogd met het adres waarmee je lid bent geworden.',
    es: 'Una membresía aparece aquí cuando te unes a una comunidad. Si esperabas una, comprueba que has entrado con la dirección con la que te uniste.', // MT
    pt: 'Uma assinatura aparece aqui quando você entra numa comunidade. Se esperava uma, confira se entrou com o endereço com que se inscreveu.', // MT
    de: 'Eine Mitgliedschaft erscheint hier, sobald du einer Community beitrittst. Falls du eine erwartet hast, prüfe, ob du mit der Adresse angemeldet bist, mit der du beigetreten bist.', // MT
    fr: 'Une adhésion apparaît ici quand tu rejoins une communauté. Si tu en attendais une, vérifie que tu t’es connecté·e avec l’adresse utilisée pour adhérer.', // MT
  },
  // A membership's status badge. The same words as Help's memberships guide.
  state_active: {
    en: 'Active',
    nl: 'Actief',
    es: 'Activa', // MT
    pt: 'Ativa', // MT
    de: 'Aktiv', // MT
    fr: 'Active', // MT
  },
  state_grace: {
    en: 'Grace',
    nl: 'Respijt',
    es: 'En gracia', // MT
    pt: 'Em carência', // MT
    de: 'Kulanzzeit', // MT
    fr: 'Période de grâce', // MT
  },
  state_lapsed: {
    en: 'Lapsed',
    nl: 'Verlopen',
    es: 'Vencida', // MT
    pt: 'Vencida', // MT
    de: 'Abgelaufen', // MT
    fr: 'Expirée', // MT
  },
  state_cancelled: {
    en: 'Cancelled',
    nl: 'Opgezegd',
    es: 'Cancelada', // MT
    pt: 'Cancelada', // MT
    de: 'Gekündigt', // MT
    fr: 'Annulée', // MT
  },
  note_grace: {
    en: 'Payment is overdue. Your access continues for now.',
    nl: 'Er loopt een betaling achter. Je toegang loopt voorlopig door.',
    es: 'Hay un pago atrasado. Tu acceso continúa por ahora.', // MT
    pt: 'Há um pagamento atrasado. Seu acesso continua por enquanto.', // MT
    de: 'Eine Zahlung ist überfällig. Dein Zugang läuft vorerst weiter.', // MT
    fr: 'Un paiement est en retard. Ton accès continue pour l’instant.', // MT
  },
  note_lapsed: {
    en: 'This has lapsed. Rejoin to get it back.',
    nl: 'Dit is verlopen. Word opnieuw lid om het terug te krijgen.',
    es: 'Ha vencido. Vuelve a unirte para recuperarla.', // MT
    pt: 'Ela venceu. Entre de novo para recuperá-la.', // MT
    de: 'Sie ist abgelaufen. Tritt erneut bei, um sie zurückzubekommen.', // MT
    fr: 'Elle a expiré. Adhère de nouveau pour la retrouver.', // MT
  },
  note_cancelled: {
    en: 'This has been cancelled.',
    nl: 'Dit is opgezegd.',
    es: 'Se ha cancelado.', // MT
    pt: 'Ela foi cancelada.', // MT
    de: 'Sie wurde gekündigt.', // MT
    fr: 'Elle a été annulée.', // MT
  },
  renews_date: {
    en: 'Renews {date}',
    nl: 'Wordt verlengd op {date}',
    es: 'Se renueva el {date}', // MT
    pt: 'Renova em {date}', // MT
    de: 'Verlängert sich am {date}', // MT
    fr: 'Se renouvelle le {date}', // MT
  },
  member_since: {
    en: 'Member since {date}',
    nl: 'Lid sinds {date}',
    es: 'Miembro desde el {date}', // MT
    pt: 'Membro desde {date}', // MT
    de: 'Mitglied seit {date}', // MT
    fr: 'Membre depuis le {date}', // MT
  },
  what_includes: {
    en: 'What this includes',
    nl: 'Wat dit omvat',
    es: 'Qué incluye', // MT
    pt: 'O que inclui', // MT
    de: 'Was das umfasst', // MT
    fr: 'Ce que cela comprend', // MT
  },
  belonging_only: {
    en: 'Belonging to {community}, and nothing else listed.',
    nl: 'Erbij horen bij {community}, verder staat er niets vermeld.',
    es: 'Pertenecer a {community}, y nada más indicado.', // MT
    pt: 'Fazer parte de {community}, e nada mais listado.', // MT
    de: 'Zugehörigkeit zu {community}, sonst ist nichts aufgeführt.', // MT
    fr: 'L’appartenance à {community}, rien d’autre n’est indiqué.', // MT
  },
  what_join: {
    en: 'What you can join',
    nl: 'Waar je aan mee kunt doen',
    es: 'A qué puedes unirte', // MT
    pt: 'Do que você pode participar', // MT
    de: 'Woran du teilnehmen kannst', // MT
    fr: 'Ce que tu peux rejoindre', // MT
  },
  signup_not_open_lc: {
    en: 'sign-up not open yet',
    nl: 'aanmelden nog niet open',
    es: 'inscripción aún no abierta', // MT
    pt: 'inscrições ainda não abertas', // MT
    de: 'Anmeldung noch nicht geöffnet', // MT
    fr: 'inscriptions pas encore ouvertes', // MT
  },
  what_you_paid: {
    en: 'What you paid',
    nl: 'Wat je hebt betaald',
    es: 'Lo que has pagado', // MT
    pt: 'O que você pagou', // MT
    de: 'Was du bezahlt hast', // MT
    fr: 'Ce que tu as payé', // MT
  },
  card_renewal_addons: {
    en: 'Card, renewal and add-ons',
    nl: 'Kaart, verlenging en extra’s',
    es: 'Tarjeta, renovación y extras', // MT
    pt: 'Cartão, renovação e extras', // MT
    de: 'Karte, Verlängerung und Extras', // MT
    fr: 'Carte, renouvellement et options', // MT
  },
  your_products: {
    en: 'Your products',
    nl: 'Je producten',
    es: 'Tus productos', // MT
    pt: 'Seus produtos', // MT
    de: 'Deine Produkte', // MT
    fr: 'Tes produits', // MT
  },
  bought_on: {
    en: 'Bought {date}',
    nl: 'Gekocht op {date}',
    es: 'Comprado el {date}', // MT
    pt: 'Comprado em {date}', // MT
    de: 'Gekauft am {date}', // MT
    fr: 'Acheté le {date}', // MT
  },

  // ── The You page ──────────────────────────────────────────────────────
  // The You page: its tabs and panels (you/page.tsx, you-tabs.tsx).
  tab_profile: {
    en: 'Profile',
    nl: 'Profiel',
    es: 'Perfil', // MT
    pt: 'Perfil', // MT
    de: 'Profil', // MT
    fr: 'Profil', // MT
  },
  tab_memberships: {
    en: 'Memberships & purchases',
    nl: 'Lidmaatschappen & aankopen',
    es: 'Membresías y compras', // MT
    pt: 'Assinaturas e compras', // MT
    de: 'Mitgliedschaften & Käufe', // MT
    fr: 'Adhésions et achats', // MT
  },
  tab_billing: {
    en: 'Billing',
    nl: 'Facturatie',
    es: 'Facturación', // MT
    pt: 'Faturamento', // MT
    de: 'Abrechnung', // MT
    fr: 'Facturation', // MT
  },
  tab_privacy: {
    en: 'Privacy',
    nl: 'Privacy',
    es: 'Privacidad', // MT
    pt: 'Privacidade', // MT
    de: 'Datenschutz', // MT
    fr: 'Confidentialité', // MT
  },
  f_email: {
    en: 'Email',
    nl: 'E-mail',
    es: 'Correo electrónico', // MT
    pt: 'E-mail', // MT
    de: 'E-Mail', // MT
    fr: 'E-mail', // MT
  },
  editing_unreachable: {
    en: 'Editing is not reachable right now. Try again in a moment.',
    nl: 'Bewerken is nu niet bereikbaar. Probeer het zo nog eens.',
    es: 'La edición no está disponible ahora. Vuelve a intentarlo en un momento.', // MT
    pt: 'A edição não está disponível agora. Tente de novo daqui a pouco.', // MT
    de: 'Bearbeiten ist gerade nicht erreichbar. Versuch es gleich noch einmal.', // MT
    fr: 'La modification n’est pas accessible pour le moment. Réessaie dans un instant.', // MT
  },
  dir_title: {
    en: 'Being found by other members',
    nl: 'Gevonden worden door andere leden',
    es: 'Que otros miembros te encuentren', // MT
    pt: 'Ser encontrado por outros membros', // MT
    de: 'Von anderen Mitgliedern gefunden werden', // MT
    fr: 'Être trouvé·e par les autres membres', // MT
  },
  dir_failed: {
    en: "We couldn't load this right now; your setting is unchanged.",
    nl: 'Dit lukte nu niet te laden; je instelling is niet veranderd.',
    es: 'No hemos podido cargarlo ahora; tu ajuste no ha cambiado.', // MT
    pt: 'Não conseguimos carregar isto agora; sua configuração não mudou.', // MT
    de: 'Das ließ sich gerade nicht laden; deine Einstellung ist unverändert.', // MT
    fr: 'Impossible de charger ceci pour le moment ; ton réglage n’a pas changé.', // MT
  },
  mships_failed: {
    en: "We couldn't load your memberships right now. Try again in a moment.",
    nl: 'Je lidmaatschappen konden nu niet worden geladen. Probeer het zo nog eens.',
    es: 'No hemos podido cargar tus membresías ahora. Vuelve a intentarlo en un momento.', // MT
    pt: 'Não conseguimos carregar suas assinaturas agora. Tente de novo daqui a pouco.', // MT
    de: 'Deine Mitgliedschaften ließen sich gerade nicht laden. Versuch es gleich noch einmal.', // MT
    fr: 'Impossible de charger tes adhésions pour le moment. Réessaie dans un instant.', // MT
  },
  nothing_renews: {
    en: 'Nothing renews for you at the moment.',
    nl: 'Er wordt op dit moment niets voor je verlengd.',
    es: 'Ahora mismo no se te renueva nada.', // MT
    pt: 'Nada renova para você no momento.', // MT
    de: 'Bei dir verlängert sich gerade nichts.', // MT
    fr: 'Rien ne se renouvelle pour toi en ce moment.', // MT
  },
  // {link} is "Purchases" (nav_purchases), a link.
  every_invoice_under: {
    en: 'Every invoice, and what you paid, is under {link}.',
    nl: 'Elke factuur, en wat je hebt betaald, staat onder {link}.',
    es: 'Todas las facturas, y lo que has pagado, están en {link}.', // MT
    pt: 'Todas as faturas, e o que você pagou, estão em {link}.', // MT
    de: 'Jede Rechnung und was du bezahlt hast, findest du unter {link}.', // MT
    fr: 'Chaque facture, et ce que tu as payé, se trouve dans {link}.', // MT
  },
  billing_none: {
    en: 'No billing details yet. They are filled in the first time you pay.',
    nl: 'Nog geen factuurgegevens. Die worden ingevuld de eerste keer dat je betaalt.',
    es: 'Aún no hay datos de facturación. Se rellenan la primera vez que pagas.', // MT
    pt: 'Ainda não há dados de faturamento. Eles são preenchidos na primeira vez que você paga.', // MT
    de: 'Noch keine Rechnungsdaten. Sie werden beim ersten Bezahlen ausgefüllt.', // MT
    fr: 'Pas encore de coordonnées de facturation. Elles sont remplies lors de ton premier paiement.', // MT
  },
  billing_failed: {
    en: 'Your billing details could not be loaded right now.',
    nl: 'Je factuurgegevens konden nu niet worden geladen.',
    es: 'No se han podido cargar tus datos de facturación ahora.', // MT
    pt: 'Não foi possível carregar seus dados de faturamento agora.', // MT
    de: 'Deine Rechnungsdaten konnten gerade nicht geladen werden.', // MT
    fr: 'Tes coordonnées de facturation n’ont pas pu être chargées pour le moment.', // MT
  },
  not_organiser_note: {
    en: 'This page is everything you take part in. The Thread itself — where programmes are built and run — is for organisers, and you would need to be invited to a workspace to open it.',
    nl: 'Deze pagina is alles waar je aan meedoet. The Thread zelf — waar programma’s worden gemaakt en gedraaid — is voor organisatoren, en je moet voor een workspace worden uitgenodigd om het te openen.',
    es: 'Esta página es todo aquello en lo que participas. The Thread en sí —donde se crean y gestionan los programas— es para quienes organizan, y necesitarías una invitación a un espacio de trabajo para abrirlo.', // MT
    pt: 'Esta página é tudo de que você participa. O The Thread em si — onde os programas são criados e conduzidos — é para quem organiza, e você precisaria ser convidado para um espaço de trabalho para abri-lo.', // MT
    de: 'Diese Seite ist alles, woran du teilnimmst. The Thread selbst – wo Programme gebaut und durchgeführt werden – ist für Veranstalter:innen, und du müsstest in einen Workspace eingeladen werden, um es zu öffnen.', // MT
    fr: 'Cette page rassemble tout ce à quoi tu participes. The Thread lui-même, où les programmes sont conçus et menés, est réservé aux organisateurs : il faudrait être invité·e dans un espace de travail pour l’ouvrir.', // MT
  },
  back_to: {
    en: 'Back to {site}',
    nl: 'Terug naar {site}',
    es: 'Volver a {site}', // MT
    pt: 'Voltar para {site}', // MT
    de: 'Zurück zu {site}', // MT
    fr: 'Retour à {site}', // MT
  },
  sign_out: {
    en: 'Sign out',
    nl: 'Uitloggen',
    es: 'Cerrar sesión', // MT
    pt: 'Sair', // MT
    de: 'Abmelden', // MT
    fr: 'Se déconnecter', // MT
  },
  signing_out: {
    en: 'Signing out…',
    nl: 'Uitloggen…',
    es: 'Cerrando sesión…', // MT
    pt: 'Saindo…', // MT
    de: 'Wird abgemeldet…', // MT
    fr: 'Déconnexion…', // MT
  },
  // The profile form (details-form.tsx).
  first_name: {
    en: 'First name',
    nl: 'Voornaam',
    es: 'Nombre', // MT
    pt: 'Nome', // MT
    de: 'Vorname', // MT
    fr: 'Prénom', // MT
  },
  last_name: {
    en: 'Last name',
    nl: 'Achternaam',
    es: 'Apellidos', // MT
    pt: 'Sobrenome', // MT
    de: 'Nachname', // MT
    fr: 'Nom', // MT
  },
  email_fixed: {
    en: 'This is how every community finds you, so it cannot be changed here.',
    nl: 'Hiermee vindt elke community je, dus dit kun je hier niet wijzigen.',
    es: 'Así te encuentra cada comunidad, por eso no se puede cambiar aquí.', // MT
    pt: 'É assim que cada comunidade encontra você, por isso não pode ser alterado aqui.', // MT
    de: 'Darüber findet dich jede Community, deshalb lässt es sich hier nicht ändern.', // MT
    fr: 'C’est ainsi que chaque communauté te retrouve, elle ne peut donc pas être modifiée ici.', // MT
  },
  no_preference: {
    en: 'No preference',
    nl: 'Geen voorkeur',
    es: 'Sin preferencia', // MT
    pt: 'Sem preferência', // MT
    de: 'Keine Präferenz', // MT
    fr: 'Aucune préférence', // MT
  },
  language_hint: {
    en: 'What emails and pages arrive in, everywhere.',
    nl: 'De taal van e-mails en pagina’s, overal.',
    es: 'El idioma de los correos y las páginas, en todas partes.', // MT
    pt: 'O idioma dos e-mails e das páginas, em todo lugar.', // MT
    de: 'In dieser Sprache kommen E-Mails und Seiten an, überall.', // MT
    fr: 'La langue des e-mails et des pages, partout.', // MT
  },
  face_title: {
    en: 'Your profile',
    nl: 'Je profiel',
    es: 'Tu perfil', // MT
    pt: 'O seu perfil', // MT
    de: 'Dein Profil', // MT
    fr: 'Ton profil', // MT
  },
  face_desc: {
    en: 'The same profile you have in The Thread: what other members see of you, and your guests if you host.',
    nl: 'Hetzelfde profiel als in The Thread: wat andere leden van je zien, en je gasten als je host bent.',
    es: 'El mismo perfil que tienes en The Thread: lo que otros miembros ven de ti, y tus invitados si organizas.', // MT
    pt: 'O mesmo perfil que tem no The Thread: o que os outros membros veem de si, e os seus convidados se organizar.', // MT
    de: 'Dasselbe Profil wie in The Thread: was andere Mitglieder von dir sehen, und deine Gäste, wenn du Gastgeber bist.', // MT
    fr: 'Le même profil que dans The Thread : ce que les autres membres voient de toi, et tes invités si tu organises.', // MT
  },
  face_photo_hint: {
    en: 'Saved as soon as you choose it. Location data in the photo is removed.',
    nl: 'Opgeslagen zodra je hem kiest. Locatiegegevens in de foto worden verwijderd.',
    es: 'Se guarda en cuanto la eliges. Se eliminan los datos de ubicación de la foto.', // MT
    pt: 'Guardada assim que a escolhe. Os dados de localização da foto são removidos.', // MT
    de: 'Wird gespeichert, sobald du es auswählst. Standortdaten im Foto werden entfernt.', // MT
    fr: 'Enregistrée dès que tu la choisis. Les données de localisation de la photo sont supprimées.', // MT
  },
  face_photo_too_big: {
    en: 'That photo is over 4 MB. Choose a smaller one, or save it as a JPEG first.',
    nl: 'Die foto is groter dan 4 MB. Kies een kleinere, of sla hem eerst op als JPEG.',
    es: 'Esa foto pesa más de 4 MB. Elige una más pequeña o guárdala antes como JPEG.', // MT
    pt: 'Essa foto tem mais de 4 MB. Escolha uma mais pequena ou guarde-a primeiro como JPEG.', // MT
    de: 'Das Foto ist größer als 4 MB. Wähle ein kleineres oder speichere es zuerst als JPEG.', // MT
    fr: 'Cette photo dépasse 4 Mo. Choisis-en une plus petite, ou enregistre-la d’abord en JPEG.', // MT
  },
  g_title: {
    en: 'Google account',
    nl: 'Google-account',
    es: 'Cuenta de Google', // MT
    pt: 'Conta Google', // MT
    de: 'Google-Konto', // MT
    fr: 'Compte Google', // MT
  },
  g_suggested: {
    en: 'Your membership includes a Google account. We suggest:',
    nl: 'Je lidmaatschap bevat een Google-account. Ons voorstel:',
    es: 'Tu membresía incluye una cuenta de Google. Te sugerimos:', // MT
    pt: 'A sua adesão inclui uma conta Google. Sugerimos:', // MT
    de: 'Deine Mitgliedschaft enthält ein Google-Konto. Unser Vorschlag:', // MT
    fr: 'Ton adhésion comprend un compte Google. Nous proposons :', // MT
  },
  g_use: {
    en: 'Use this address',
    nl: 'Dit adres gebruiken',
    es: 'Usar esta dirección', // MT
    pt: 'Usar este endereço', // MT
    de: 'Diese Adresse verwenden', // MT
    fr: 'Utiliser cette adresse', // MT
  },
  g_other: {
    en: 'Ask for another',
    nl: 'Een ander vragen',
    es: 'Pedir otra', // MT
    pt: 'Pedir outro', // MT
    de: 'Eine andere anfragen', // MT
    fr: 'En demander une autre', // MT
  },
  g_address: {
    en: 'Address',
    nl: 'Adres',
    es: 'Dirección', // MT
    pt: 'Endereço', // MT
    de: 'Adresse', // MT
    fr: 'Adresse', // MT
  },
  g_note: {
    en: 'A note for the community (optional)',
    nl: 'Een notitie voor de community (optioneel)',
    es: 'Una nota para la comunidad (opcional)', // MT
    pt: 'Uma nota para a comunidade (opcional)', // MT
    de: 'Eine Notiz für die Community (optional)', // MT
    fr: 'Une note pour la communauté (facultatif)', // MT
  },
  g_send: {
    en: 'Ask for it',
    nl: 'Aanvragen',
    es: 'Solicitarla', // MT
    pt: 'Pedir', // MT
    de: 'Anfragen', // MT
    fr: 'La demander', // MT
  },
  g_requested: {
    en: 'You asked for {address}. The community creates it and lets you know.',
    nl: 'Je vroeg {address} aan. De community maakt het aan en laat het je weten.',
    es: 'Pediste {address}. La comunidad la crea y te avisa.', // MT
    pt: 'Pediu {address}. A comunidade cria-a e avisa-o.', // MT
    de: 'Du hast {address} angefragt. Die Community legt sie an und sagt dir Bescheid.', // MT
    fr: 'Tu as demandé {address}. La communauté la crée et te prévient.', // MT
  },
  g_change: {
    en: 'Ask for a different one',
    nl: 'Een ander aanvragen',
    es: 'Pedir otra distinta', // MT
    pt: 'Pedir outro', // MT
    de: 'Eine andere anfragen', // MT
    fr: 'En demander une autre', // MT
  },
  g_created: {
    en: 'Your Google account: {address}',
    nl: 'Je Google-account: {address}',
    es: 'Tu cuenta de Google: {address}', // MT
    pt: 'A sua conta Google: {address}', // MT
    de: 'Dein Google-Konto: {address}', // MT
    fr: 'Ton compte Google : {address}', // MT
  },
  g_declined: {
    en: 'The community declined your request.',
    nl: 'De community heeft je aanvraag afgewezen.',
    es: 'La comunidad rechazó tu solicitud.', // MT
    pt: 'A comunidade recusou o seu pedido.', // MT
    de: 'Die Community hat deine Anfrage abgelehnt.', // MT
    fr: 'La communauté a refusé ta demande.', // MT
  },
  g_reason: {
    en: 'Reason: {reason}',
    nl: 'Reden: {reason}',
    es: 'Motivo: {reason}', // MT
    pt: 'Motivo: {reason}', // MT
    de: 'Grund: {reason}', // MT
    fr: 'Raison : {reason}', // MT
  },
  g_ask_again: {
    en: 'Ask again',
    nl: 'Opnieuw aanvragen',
    es: 'Volver a pedir', // MT
    pt: 'Pedir de novo', // MT
    de: 'Erneut anfragen', // MT
    fr: 'Redemander', // MT
  },
  g_taken: {
    en: 'That address is already taken. Try another.',
    nl: 'Dat adres is al bezet. Probeer een ander.',
    es: 'Esa dirección ya está ocupada. Prueba otra.', // MT
    pt: 'Esse endereço já está ocupado. Tente outro.', // MT
    de: 'Diese Adresse ist schon vergeben. Versuche eine andere.', // MT
    fr: 'Cette adresse est déjà prise. Essaie une autre.', // MT
  },
  g_bad: {
    en: 'Use letters, numbers, dots, dashes or underscores.',
    nl: 'Gebruik letters, cijfers, punten, streepjes of underscores.',
    es: 'Usa letras, números, puntos, guiones o guiones bajos.', // MT
    pt: 'Use letras, números, pontos, hífens ou sublinhados.', // MT
    de: 'Verwende Buchstaben, Zahlen, Punkte, Bindestriche oder Unterstriche.', // MT
    fr: 'Utilise des lettres, chiffres, points, tirets ou tirets bas.', // MT
  },
  did_not_save: {
    en: 'That did not save.',
    nl: 'Dat is niet opgeslagen.',
    es: 'No se ha guardado.', // MT
    pt: 'Não foi salvo.', // MT
    de: 'Das wurde nicht gespeichert.', // MT
    fr: 'Ce n’a pas été enregistré.', // MT
  },
  name_used_by: {
    en: 'Your name is used by {n} communities. Saving corrects it in all of them.',
    nl: 'Je naam wordt door {n} community’s gebruikt. Opslaan verbetert hem in allemaal.',
    es: 'Tu nombre lo usan {n} comunidades. Al guardar, se corrige en todas.', // MT
    pt: 'Seu nome é usado por {n} comunidades. Salvar corrige em todas.', // MT
    de: 'Dein Name wird von {n} Communitys verwendet. Speichern korrigiert ihn in allen.', // MT
    fr: 'Ton nom est utilisé par {n} communautés. Enregistrer le corrige partout.', // MT
  },
  // The billing card (billing-card.tsx), read-only.
  bc_company: {
    en: 'Company',
    nl: 'Bedrijf',
    es: 'Empresa', // MT
    pt: 'Empresa', // MT
    de: 'Firma', // MT
    fr: 'Entreprise', // MT
  },
  vat_number: {
    en: 'VAT number',
    nl: 'Btw-nummer',
    es: 'Número de IVA', // MT
    pt: 'Número fiscal', // MT
    de: 'USt-IdNr.', // MT
    fr: 'Numéro de TVA', // MT
  },
  // {link} is "Purchases" (nav_purchases), a link.
  change_them_under: {
    en: 'Change them under {link}.',
    nl: 'Wijzig ze onder {link}.',
    es: 'Cámbialos en {link}.', // MT
    pt: 'Altere-os em {link}.', // MT
    de: 'Ändere sie unter {link}.', // MT
    fr: 'Modifie-les dans {link}.', // MT
  },
  // Emails about the calendars (notify-card.tsx).
  notify_title: {
    en: 'Emails about new and changed threads',
    nl: 'E-mails over nieuwe en gewijzigde threads',
    es: 'Correos sobre threads nuevos y modificados', // MT
    pt: 'E-mails sobre threads novos e alterados', // MT
    de: 'E-Mails zu neuen und geänderten Threads', // MT
    fr: 'E-mails sur les threads nouveaux ou modifiés', // MT
  },
  this_community: {
    en: 'This community',
    nl: 'Deze community',
    es: 'Esta comunidad', // MT
    pt: 'Esta comunidade', // MT
    de: 'Diese Community', // MT
    fr: 'Cette communauté', // MT
  },
  notify_hint: {
    en: 'One email after a quiet quarter of an hour, never one per change.',
    nl: 'Eén e-mail na een stil kwartier, nooit één per wijziging.',
    es: 'Un correo tras un cuarto de hora sin cambios, nunca uno por cambio.', // MT
    pt: 'Um e-mail depois de quinze minutos sem mudanças, nunca um por mudança.', // MT
    de: 'Eine E-Mail nach einer ruhigen Viertelstunde, nie eine pro Änderung.', // MT
    fr: 'Un e-mail après un quart d’heure calme, jamais un par changement.', // MT
  },
  notify_failed: {
    en: 'That did not save. Check your connection and try again.',
    nl: 'Dat is niet opgeslagen. Controleer je verbinding en probeer het opnieuw.',
    es: 'No se ha guardado. Comprueba tu conexión e inténtalo de nuevo.', // MT
    pt: 'Não foi salvo. Verifique sua conexão e tente de novo.', // MT
    de: 'Das wurde nicht gespeichert. Prüfe deine Verbindung und versuch es noch einmal.', // MT
    fr: 'Ce n’a pas été enregistré. Vérifie ta connexion et réessaie.', // MT
  },
  // The calendar subscription (calendar-card.tsx). Help's calendar guide names
  // these buttons: Subscribe, Open in Apple Calendar, Copy address.
  cal_title: {
    en: 'Your calendar',
    nl: 'Je agenda',
    es: 'Tu calendario', // MT
    pt: 'Seu calendário', // MT
    de: 'Dein Kalender', // MT
    fr: 'Ton agenda', // MT
  },
  cal_intro: {
    en: 'Follow every session you are taking part in. When an organiser moves a date, your calendar follows — you do not have to add anything again.',
    nl: 'Volg elke sessie waar je aan meedoet. Als een organisator een datum verplaatst, schuift je agenda mee — je hoeft niets opnieuw toe te voegen.',
    es: 'Sigue cada sesión en la que participas. Cuando quien organiza cambia una fecha, tu calendario la sigue: no tienes que volver a añadir nada.', // MT
    pt: 'Acompanhe cada sessão de que você participa. Quando quem organiza muda uma data, seu calendário acompanha — você não precisa adicionar nada de novo.', // MT
    de: 'Folge jeder Sitzung, an der du teilnimmst. Wenn eine Veranstalter:in einen Termin verschiebt, zieht dein Kalender mit – du musst nichts erneut hinzufügen.', // MT
    fr: 'Suis chaque séance à laquelle tu participes. Quand un organisateur déplace une date, ton agenda suit : tu n’as rien à rajouter.', // MT
  },
  cal_address: {
    en: 'Your calendar address',
    nl: 'Je agenda-adres',
    es: 'La dirección de tu calendario', // MT
    pt: 'O endereço do seu calendário', // MT
    de: 'Deine Kalenderadresse', // MT
    fr: 'L’adresse de ton agenda', // MT
  },
  copied: {
    en: 'Copied',
    nl: 'Gekopieerd',
    es: 'Copiado', // MT
    pt: 'Copiado', // MT
    de: 'Kopiert', // MT
    fr: 'Copié', // MT
  },
  copy_address: {
    en: 'Copy address',
    nl: 'Adres kopiëren',
    es: 'Copiar dirección', // MT
    pt: 'Copiar endereço', // MT
    de: 'Adresse kopieren', // MT
    fr: 'Copier l’adresse', // MT
  },
  open_apple_calendar: {
    en: 'Open in Apple Calendar',
    nl: 'Openen in Apple Agenda',
    es: 'Abrir en Calendario de Apple', // MT
    pt: 'Abrir no Calendário da Apple', // MT
    de: 'In Apple Kalender öffnen', // MT
    fr: 'Ouvrir dans Calendrier Apple', // MT
  },
  // {google} is the bold product name "Google Calendar".
  cal_google: {
    en: '{google} — on a computer, open calendar.google.com, then Other calendars → From URL and paste this. Its phone app cannot add one, on Android or iPhone; once the computer has it, it appears on your phone by itself. This page is where the address lives, so open it on the computer rather than typing it across.',
    nl: '{google} — open op een computer calendar.google.com, dan Andere agenda’s → Via URL en plak dit. De telefoonapp kan er geen toevoegen, op Android noch iPhone; zodra de computer hem heeft, verschijnt hij vanzelf op je telefoon. Het adres staat op deze pagina, dus open hem op de computer in plaats van het over te typen.',
    es: '{google}: en un ordenador, abre calendar.google.com, luego Otros calendarios → Desde URL y pega esto. Su app para el móvil no puede añadirlo, ni en Android ni en iPhone; cuando el ordenador lo tiene, aparece solo en tu móvil. La dirección está en esta página, así que ábrela en el ordenador en lugar de copiarla a mano.', // MT
    pt: '{google} — num computador, abra calendar.google.com, depois Outras agendas → A partir do URL e cole isto. O app do celular não consegue adicionar, nem no Android nem no iPhone; quando o computador tiver, aparece sozinho no seu celular. O endereço está nesta página, então abra-a no computador em vez de digitar.', // MT
    de: '{google} – öffne am Computer calendar.google.com, dann Weitere Kalender → Per URL und füge das ein. Die Handy-App kann keinen hinzufügen, weder auf Android noch auf dem iPhone; sobald der Computer ihn hat, erscheint er von selbst auf deinem Handy. Die Adresse steht auf dieser Seite, also öffne sie am Computer, statt sie abzutippen.', // MT
    fr: '{google} : sur un ordinateur, ouvre calendar.google.com, puis Autres agendas → À partir de l’URL et colle ceci. L’application mobile ne peut pas l’ajouter, ni sur Android ni sur iPhone ; une fois sur l’ordinateur, il apparaît tout seul sur ton téléphone. L’adresse se trouve sur cette page : ouvre-la sur l’ordinateur plutôt que de la recopier.', // MT
  },
  cal_own: {
    en: 'It arrives as its own calendar beside yours. The sessions show up in your day, and you cannot edit them — which is what keeps them correct.',
    nl: 'Hij komt binnen als een eigen agenda naast de jouwe. De sessies staan in je dag, en je kunt ze niet bewerken — zo blijven ze kloppen.',
    es: 'Llega como un calendario propio junto al tuyo. Las sesiones aparecen en tu día y no puedes editarlas, y eso es lo que las mantiene correctas.', // MT
    pt: 'Ele chega como um calendário próprio ao lado do seu. As sessões aparecem no seu dia, e você não pode editá-las — é isso que as mantém corretas.', // MT
    de: 'Er kommt als eigener Kalender neben deinem an. Die Sitzungen erscheinen in deinem Tag, und du kannst sie nicht bearbeiten – genau das hält sie richtig.', // MT
    fr: 'Il arrive comme un agenda à part, à côté du tien. Les séances apparaissent dans ta journée et tu ne peux pas les modifier : c’est ce qui les garde exactes.', // MT
  },
  cal_private: {
    en: 'Keep the address private: anyone who has it can see your sessions.',
    nl: 'Houd het adres voor jezelf: iedereen die het heeft, kan je sessies zien.',
    es: 'No compartas la dirección: quien la tenga puede ver tus sesiones.', // MT
    pt: 'Mantenha o endereço em sigilo: quem o tiver pode ver suas sessões.', // MT
    de: 'Behalte die Adresse für dich: Wer sie hat, sieht deine Sitzungen.', // MT
    fr: 'Garde l’adresse pour toi : qui la possède peut voir tes séances.', // MT
  },
  cal_old: {
    en: 'You have a calendar address from before this page could show it again. Make a new one to see it — the old one stops working.',
    nl: 'Je hebt een agenda-adres van voordat deze pagina het opnieuw kon tonen. Maak een nieuw adres om het te zien — het oude werkt dan niet meer.',
    es: 'Tienes una dirección de calendario de antes de que esta página pudiera volver a mostrarla. Crea una nueva para verla; la antigua dejará de funcionar.', // MT
    pt: 'Você tem um endereço de calendário de antes de esta página poder mostrá-lo de novo. Crie um novo para vê-lo — o antigo para de funcionar.', // MT
    de: 'Du hast eine Kalenderadresse aus der Zeit, bevor diese Seite sie wieder anzeigen konnte. Erstelle eine neue, um sie zu sehen – die alte funktioniert dann nicht mehr.', // MT
    fr: 'Tu as une adresse d’agenda antérieure au moment où cette page a pu la réafficher. Crée-en une nouvelle pour la voir ; l’ancienne cessera de fonctionner.', // MT
  },
  cal_last: {
    en: 'Last collected {when}.',
    nl: 'Voor het laatst opgehaald {when}.',
    es: 'Última recogida {when}.', // MT
    pt: 'Última coleta {when}.', // MT
    de: 'Zuletzt abgerufen {when}.', // MT
    fr: 'Dernière récupération {when}.', // MT
  },
  cal_never: {
    en: 'Nothing has collected it yet — if you just added it, give your calendar an hour.',
    nl: 'Nog niets heeft hem opgehaald — heb je hem net toegevoegd, geef je agenda dan een uur.',
    es: 'Nada lo ha recogido todavía: si acabas de añadirlo, dale una hora a tu calendario.', // MT
    pt: 'Nada o coletou ainda — se você acabou de adicionar, dê uma hora ao seu calendário.', // MT
    de: 'Noch nichts hat ihn abgerufen – wenn du ihn gerade hinzugefügt hast, gib deinem Kalender eine Stunde.', // MT
    fr: 'Rien ne l’a encore récupéré : si tu viens de l’ajouter, laisse une heure à ton agenda.', // MT
  },
  make_new_address: {
    en: 'Make a new address',
    nl: 'Nieuw adres maken',
    es: 'Crear una dirección nueva', // MT
    pt: 'Criar um novo endereço', // MT
    de: 'Neue Adresse erstellen', // MT
    fr: 'Créer une nouvelle adresse', // MT
  },
  subscribe: {
    en: 'Subscribe',
    nl: 'Abonneren',
    es: 'Suscribirse', // MT
    pt: 'Assinar', // MT
    de: 'Abonnieren', // MT
    fr: 'S’abonner', // MT
  },
  stop_calendar: {
    en: 'Stop the calendar',
    nl: 'Agenda stoppen',
    es: 'Detener el calendario', // MT
    pt: 'Parar o calendário', // MT
    de: 'Kalender beenden', // MT
    fr: 'Arrêter l’agenda', // MT
  },
  cal_new_warning: {
    en: 'Making a new address stops the old one working everywhere you added it.',
    nl: 'Een nieuw adres maken laat het oude overal stoppen waar je het hebt toegevoegd.',
    es: 'Crear una dirección nueva hace que la antigua deje de funcionar allí donde la añadiste.', // MT
    pt: 'Criar um novo endereço faz o antigo parar de funcionar em todo lugar onde você o adicionou.', // MT
    de: 'Eine neue Adresse sorgt dafür, dass die alte überall dort nicht mehr funktioniert, wo du sie hinzugefügt hast.', // MT
    fr: 'Créer une nouvelle adresse désactive l’ancienne partout où tu l’as ajoutée.', // MT
  },
  did_not_work: {
    en: 'That did not work.',
    nl: 'Dat werkte niet.',
    es: 'No ha funcionado.', // MT
    pt: 'Não funcionou.', // MT
    de: 'Das hat nicht geklappt.', // MT
    fr: 'Ça n’a pas fonctionné.', // MT
  },
  just_now: {
    en: 'just now',
    nl: 'zojuist',
    es: 'hace un momento', // MT
    pt: 'agora mesmo', // MT
    de: 'gerade eben', // MT
    fr: 'à l’instant', // MT
  },
  in_last_hour: {
    en: 'in the last hour',
    nl: 'in het afgelopen uur',
    es: 'en la última hora', // MT
    pt: 'na última hora', // MT
    de: 'in der letzten Stunde', // MT
    fr: 'dans la dernière heure', // MT
  },
  hours_ago_one: {
    en: '{n} hour ago',
    nl: '{n} uur geleden',
    es: 'hace {n} hora', // MT
    pt: 'há {n} hora', // MT
    de: 'vor {n} Stunde', // MT
    fr: 'il y a {n} heure', // MT
  },
  hours_ago_many: {
    en: '{n} hours ago',
    nl: '{n} uur geleden',
    es: 'hace {n} horas', // MT
    pt: 'há {n} horas', // MT
    de: 'vor {n} Stunden', // MT
    fr: 'il y a {n} heures', // MT
  },
  days_ago_one: {
    en: '{n} day ago',
    nl: '{n} dag geleden',
    es: 'hace {n} día', // MT
    pt: 'há {n} dia', // MT
    de: 'vor {n} Tag', // MT
    fr: 'il y a {n} jour', // MT
  },
  days_ago_many: {
    en: '{n} days ago',
    nl: '{n} dagen geleden',
    es: 'hace {n} días', // MT
    pt: 'há {n} dias', // MT
    de: 'vor {n} Tagen', // MT
    fr: 'il y a {n} jours', // MT
  },
  // Being found by other members (directory-card.tsx).
  dir_intro: {
    en: 'Off unless you turn it on. You can turn it off again here at any time.',
    nl: 'Uit, tenzij je het aanzet. Je kunt het hier altijd weer uitzetten.',
    es: 'Desactivado a menos que lo actives. Puedes volver a desactivarlo aquí cuando quieras.', // MT
    pt: 'Desativado, a menos que você ative. Você pode desativar de novo aqui a qualquer momento.', // MT
    de: 'Aus, solange du es nicht einschaltest. Du kannst es hier jederzeit wieder ausschalten.', // MT
    fr: 'Désactivé tant que tu ne l’actives pas. Tu peux le désactiver ici à tout moment.', // MT
  },
  dir_appear: {
    en: 'Appear in the member list of {community}',
    nl: 'Verschijnen in de ledenlijst van {community}',
    es: 'Aparecer en la lista de miembros de {community}', // MT
    pt: 'Aparecer na lista de membros de {community}', // MT
    de: 'In der Mitgliederliste von {community} erscheinen', // MT
    fr: 'Apparaître dans la liste des membres de {community}', // MT
  },
  dir_listed: {
    en: 'Other members of this community can find you.',
    nl: 'Andere leden van deze community kunnen je vinden.',
    es: 'Otros miembros de esta comunidad pueden encontrarte.', // MT
    pt: 'Outros membros desta comunidade podem encontrar você.', // MT
    de: 'Andere Mitglieder dieser Community können dich finden.', // MT
    fr: 'Les autres membres de cette communauté peuvent te trouver.', // MT
  },
  dir_unlisted: {
    en: 'Nobody can find you here.',
    nl: 'Niemand kan je hier vinden.',
    es: 'Nadie puede encontrarte aquí.', // MT
    pt: 'Ninguém pode encontrar você aqui.', // MT
    de: 'Niemand kann dich hier finden.', // MT
    fr: 'Personne ne peut te trouver ici.', // MT
  },
  dir_see: {
    en: 'See the members of {community}',
    nl: 'Bekijk de leden van {community}',
    es: 'Ver los miembros de {community}', // MT
    pt: 'Ver os membros de {community}', // MT
    de: 'Die Mitglieder von {community} ansehen', // MT
    fr: 'Voir les membres de {community}', // MT
  },
  dir_show_contact: {
    en: 'Show my contact details',
    nl: 'Mijn contactgegevens tonen',
    es: 'Mostrar mis datos de contacto', // MT
    pt: 'Mostrar meus dados de contato', // MT
    de: 'Meine Kontaktdaten zeigen', // MT
    fr: 'Afficher mes coordonnées', // MT
  },
  dir_default_on: {
    en: "Following this community's default, which is on.",
    nl: 'Volgt de standaard van deze community, en die staat aan.',
    es: 'Sigue el ajuste predeterminado de esta comunidad, que está activado.', // MT
    pt: 'Segue o padrão desta comunidade, que está ativado.', // MT
    de: 'Folgt der Voreinstellung dieser Community, und die ist an.', // MT
    fr: 'Suit le réglage par défaut de cette communauté, qui est activé.', // MT
  },
  dir_default_off: {
    en: "Following this community's default, which is off.",
    nl: 'Volgt de standaard van deze community, en die staat uit.',
    es: 'Sigue el ajuste predeterminado de esta comunidad, que está desactivado.', // MT
    pt: 'Segue o padrão desta comunidade, que está desativado.', // MT
    de: 'Folgt der Voreinstellung dieser Community, und die ist aus.', // MT
    fr: 'Suit le réglage par défaut de cette communauté, qui est désactivé.', // MT
  },
  dir_own: {
    en: 'Your own choice, whatever the community default is.',
    nl: 'Je eigen keuze, wat de standaard van de community ook is.',
    es: 'Tu propia elección, sea cual sea el ajuste de la comunidad.', // MT
    pt: 'Sua própria escolha, seja qual for o padrão da comunidade.', // MT
    de: 'Deine eigene Wahl, egal was die Community voreinstellt.', // MT
    fr: 'Ton propre choix, quel que soit le réglage de la communauté.', // MT
  },
  dir_save_failed: {
    en: 'could not save that choice',
    nl: 'die keuze kon niet worden opgeslagen',
    es: 'no se ha podido guardar esa elección', // MT
    pt: 'não foi possível salvar essa escolha', // MT
    de: 'diese Auswahl konnte nicht gespeichert werden', // MT
    fr: 'impossible d’enregistrer ce choix', // MT
  },
  // Removing your data (remove-data.tsx). Counts come in one/many pairs.
  rd_title: {
    en: 'Removing your data',
    nl: 'Je gegevens laten verwijderen',
    es: 'Eliminar tus datos', // MT
    pt: 'Remover seus dados', // MT
    de: 'Deine Daten entfernen lassen', // MT
    fr: 'Supprimer tes données', // MT
  },
  rd_pending: {
    en: 'You asked on {asked}. Someone has to answer by {due}, and will write to you at this address.',
    nl: 'Je hebt het gevraagd op {asked}. Iemand moet uiterlijk {due} antwoorden, en schrijft je op dit adres.',
    es: 'Lo pediste el {asked}. Alguien tiene que responder antes del {due} y te escribirá a esta dirección.', // MT
    pt: 'Você pediu em {asked}. Alguém precisa responder até {due} e vai escrever para você neste endereço.', // MT
    de: 'Du hast es am {asked} angefragt. Jemand muss bis {due} antworten und schreibt dir an diese Adresse.', // MT
    fr: 'Tu l’as demandé le {asked}. Quelqu’un doit répondre d’ici le {due} et t’écrira à cette adresse.', // MT
  },
  rd_intro: {
    en: 'You can ask for everything we hold about you to be removed. Here is what that means, before you decide.',
    nl: 'Je kunt vragen om alles wat we over je bewaren te verwijderen. Dit is wat dat betekent, voordat je beslist.',
    es: 'Puedes pedir que se elimine todo lo que guardamos sobre ti. Esto es lo que significa, antes de que decidas.', // MT
    pt: 'Você pode pedir que tudo o que guardamos sobre você seja removido. Veja o que isso significa antes de decidir.', // MT
    de: 'Du kannst verlangen, dass alles, was wir über dich speichern, entfernt wird. Das bedeutet es, bevor du dich entscheidest.', // MT
    fr: 'Tu peux demander que tout ce que nous conservons sur toi soit supprimé. Voici ce que cela implique, avant que tu décides.', // MT
  },
  rd_removed: {
    en: 'Would be removed',
    nl: 'Wordt verwijderd',
    es: 'Se eliminaría', // MT
    pt: 'Seria removido', // MT
    de: 'Würde entfernt', // MT
    fr: 'Serait supprimé', // MT
  },
  rd_kept: {
    en: 'Kept anyway',
    nl: 'Blijft toch bewaard',
    es: 'Se conserva de todos modos', // MT
    pt: 'Mantido mesmo assim', // MT
    de: 'Bleibt trotzdem', // MT
    fr: 'Conservé malgré tout', // MT
  },
  rd_kept_note: {
    en: 'Invoices are financial records. We are required to keep them for several years, and that is not something anyone here can waive.',
    nl: 'Facturen zijn financiële administratie. We zijn verplicht ze een aantal jaren te bewaren, en daar kan niemand hier van afzien.',
    es: 'Las facturas son registros financieros. Estamos obligados a conservarlas varios años, y nadie aquí puede renunciar a ello.', // MT
    pt: 'Faturas são registros financeiros. Somos obrigados a guardá-las por vários anos, e ninguém aqui pode abrir mão disso.', // MT
    de: 'Rechnungen sind Finanzunterlagen. Wir müssen sie mehrere Jahre aufbewahren, und darauf kann hier niemand verzichten.', // MT
    fr: 'Les factures sont des documents comptables. Nous sommes tenus de les conserver plusieurs années, et personne ici ne peut y renoncer.', // MT
  },
  rd_blocked: {
    en: 'Has to be sorted first',
    nl: 'Moet eerst geregeld worden',
    es: 'Hay que resolverlo primero', // MT
    pt: 'Precisa ser resolvido antes', // MT
    de: 'Muss zuerst geklärt werden', // MT
    fr: 'Doit d’abord être réglé', // MT
  },
  count_invoice_one: {
    en: '{n} invoice',
    nl: '{n} factuur',
    es: '{n} factura', // MT
    pt: '{n} fatura', // MT
    de: '{n} Rechnung', // MT
    fr: '{n} facture', // MT
  },
  count_invoice_many: {
    en: '{n} invoices',
    nl: '{n} facturen',
    es: '{n} facturas', // MT
    pt: '{n} faturas', // MT
    de: '{n} Rechnungen', // MT
    fr: '{n} factures', // MT
  },
  rd_organise_one: {
    en: '{n} thread you organise',
    nl: '{n} thread die je organiseert',
    es: '{n} thread que organizas', // MT
    pt: '{n} thread que você organiza', // MT
    de: '{n} Thread, den du veranstaltest', // MT
    fr: '{n} thread que tu organises', // MT
  },
  rd_organise_many: {
    en: '{n} threads you organise',
    nl: '{n} threads die je organiseert',
    es: '{n} threads que organizas', // MT
    pt: '{n} threads que você organiza', // MT
    de: '{n} Threads, die du veranstaltest', // MT
    fr: '{n} threads que tu organises', // MT
  },
  rd_enrolled_p1_t1: {
    en: '{n} person is enrolled in it.',
    nl: '{n} persoon is ervoor ingeschreven.',
    es: '{n} persona está inscrita en él.', // MT
    pt: '{n} pessoa está inscrita nele.', // MT
    de: '{n} Person ist dafür angemeldet.', // MT
    fr: '{n} personne y est inscrite.', // MT
  },
  rd_enrolled_p1_tn: {
    en: '{n} person is enrolled in them.',
    nl: '{n} persoon is ervoor ingeschreven.',
    es: '{n} persona está inscrita en ellos.', // MT
    pt: '{n} pessoa está inscrita neles.', // MT
    de: '{n} Person ist dafür angemeldet.', // MT
    fr: '{n} personne y est inscrite.', // MT
  },
  rd_enrolled_pn_t1: {
    en: '{n} people are enrolled in it.',
    nl: '{n} mensen zijn ervoor ingeschreven.',
    es: '{n} personas están inscritas en él.', // MT
    pt: '{n} pessoas estão inscritas nele.', // MT
    de: '{n} Personen sind dafür angemeldet.', // MT
    fr: '{n} personnes y sont inscrites.', // MT
  },
  rd_enrolled_pn_tn: {
    en: '{n} people are enrolled in them.',
    nl: '{n} mensen zijn ervoor ingeschreven.',
    es: '{n} personas están inscritas en ellos.', // MT
    pt: '{n} pessoas estão inscritas neles.', // MT
    de: '{n} Personen sind dafür angemeldet.', // MT
    fr: '{n} personnes y sont inscrites.', // MT
  },
  // {in} is rd_in_workspaces or empty.
  rd_blocked_rest: {
    en: 'Their place depends on your account, and your name is on what they have been sent. Those threads need handing to someone else or closing before your account can go{in}. We will say so when we reply; you do not have to sort it out first.',
    nl: 'Hun plek hangt af van jouw account, en jouw naam staat op wat ze toegestuurd hebben gekregen. Die threads moeten aan iemand anders worden overgedragen of worden afgesloten voordat je account weg kan{in}. Dat zeggen we als we antwoorden; je hoeft het niet eerst zelf te regelen.',
    es: 'Su plaza depende de tu cuenta, y tu nombre figura en lo que se les ha enviado. Esos threads tienen que pasar a otra persona o cerrarse antes de que tu cuenta pueda eliminarse{in}. Te lo diremos al responder; no tienes que resolverlo tú antes.', // MT
    pt: 'A vaga deles depende da sua conta, e seu nome está no que foi enviado a eles. Esses threads precisam ser passados para outra pessoa ou encerrados antes que sua conta possa ser removida{in}. Diremos isso ao responder; você não precisa resolver antes.', // MT
    de: 'Ihr Platz hängt von deinem Konto ab, und dein Name steht auf dem, was ihnen geschickt wurde. Diese Threads müssen an jemand anderen übergeben oder geschlossen werden, bevor dein Konto gehen kann{in}. Das sagen wir dir in unserer Antwort; du musst es nicht vorher klären.', // MT
    fr: 'Leur place dépend de ton compte, et ton nom figure sur ce qui leur a été envoyé. Ces threads doivent être confiés à quelqu’un d’autre ou fermés avant que ton compte puisse être supprimé{in}. Nous te le dirons dans notre réponse ; tu n’as pas à t’en occuper avant.', // MT
  },
  rd_in_workspaces: {
    en: ' — in {list}',
    nl: ' — in {list}',
    es: ' (en {list})', // MT
    pt: ' — em {list}', // MT
    de: ' – in {list}', // MT
    fr: ' (dans {list})', // MT
  },
  count_enrolment_one: {
    en: '{n} enrolment',
    nl: '{n} inschrijving',
    es: '{n} inscripción', // MT
    pt: '{n} inscrição', // MT
    de: '{n} Anmeldung', // MT
    fr: '{n} inscription', // MT
  },
  count_enrolment_many: {
    en: '{n} enrolments',
    nl: '{n} inschrijvingen',
    es: '{n} inscripciones', // MT
    pt: '{n} inscrições', // MT
    de: '{n} Anmeldungen', // MT
    fr: '{n} inscriptions', // MT
  },
  count_booking_one: {
    en: '{n} booking',
    nl: '{n} boeking',
    es: '{n} reserva', // MT
    pt: '{n} reserva', // MT
    de: '{n} Buchung', // MT
    fr: '{n} réservation', // MT
  },
  count_booking_many: {
    en: '{n} bookings',
    nl: '{n} boekingen',
    es: '{n} reservas', // MT
    pt: '{n} reservas', // MT
    de: '{n} Buchungen', // MT
    fr: '{n} réservations', // MT
  },
  count_membership_one: {
    en: '{n} membership',
    nl: '{n} lidmaatschap',
    es: '{n} membresía', // MT
    pt: '{n} assinatura', // MT
    de: '{n} Mitgliedschaft', // MT
    fr: '{n} adhésion', // MT
  },
  count_membership_many: {
    en: '{n} memberships',
    nl: '{n} lidmaatschappen',
    es: '{n} membresías', // MT
    pt: '{n} assinaturas', // MT
    de: '{n} Mitgliedschaften', // MT
    fr: '{n} adhésions', // MT
  },
  rd_your_details: {
    en: 'Your details',
    nl: 'Je gegevens',
    es: 'Tus datos', // MT
    pt: 'Seus dados', // MT
    de: 'Deine Angaben', // MT
    fr: 'Tes informations', // MT
  },
  rd_and_details: {
    en: '{list}, and your details',
    nl: '{list}, en je gegevens',
    es: '{list} y tus datos', // MT
    pt: '{list} e seus dados', // MT
    de: '{list} und deine Angaben', // MT
    fr: '{list}, et tes informations', // MT
  },
  rd_ask: {
    en: 'Ask for my data to be removed',
    nl: 'Vraag om mijn gegevens te verwijderen',
    es: 'Pedir que se eliminen mis datos', // MT
    pt: 'Pedir a remoção dos meus dados', // MT
    de: 'Entfernung meiner Daten anfragen', // MT
    fr: 'Demander la suppression de mes données', // MT
  },
  rd_reason: {
    en: 'Anything you want to say (optional)',
    nl: 'Wil je nog iets kwijt? (optioneel)',
    es: '¿Algo que quieras decir? (opcional)', // MT
    pt: 'Algo que queira dizer (opcional)', // MT
    de: 'Möchtest du etwas dazu sagen? (optional)', // MT
    fr: 'Quelque chose à ajouter (facultatif)', // MT
  },
  rd_placeholder: {
    en: 'I no longer want an account here.',
    nl: 'Ik wil hier geen account meer.',
    es: 'Ya no quiero una cuenta aquí.', // MT
    pt: 'Não quero mais uma conta aqui.', // MT
    de: 'Ich möchte hier kein Konto mehr.', // MT
    fr: 'Je ne veux plus de compte ici.', // MT
  },
  rd_explain: {
    en: 'This sends a request to a person, who has thirty days to answer and will write to you at this address. Nothing is deleted the moment you press it.',
    nl: 'Dit stuurt een verzoek naar een persoon, die dertig dagen heeft om te antwoorden en je op dit adres schrijft. Er wordt niets verwijderd op het moment dat je erop drukt.',
    es: 'Esto envía una solicitud a una persona, que tiene treinta días para responder y te escribirá a esta dirección. No se elimina nada en el momento en que lo pulsas.', // MT
    pt: 'Isto envia um pedido a uma pessoa, que tem trinta dias para responder e vai escrever para você neste endereço. Nada é apagado no momento em que você toca.', // MT
    de: 'Damit geht eine Anfrage an einen Menschen, der dreißig Tage Zeit hat zu antworten und dir an diese Adresse schreibt. Nichts wird in dem Moment gelöscht, in dem du darauf tippst.', // MT
    fr: 'Cela envoie une demande à une personne, qui a trente jours pour répondre et t’écrira à cette adresse. Rien n’est supprimé au moment où tu appuies.', // MT
  },
  rd_send: {
    en: 'Send the request',
    nl: 'Verzoek versturen',
    es: 'Enviar la solicitud', // MT
    pt: 'Enviar o pedido', // MT
    de: 'Anfrage senden', // MT
    fr: 'Envoyer la demande', // MT
  },
  not_now: {
    en: 'Not now',
    nl: 'Niet nu',
    es: 'Ahora no', // MT
    pt: 'Agora não', // MT
    de: 'Nicht jetzt', // MT
    fr: 'Pas maintenant', // MT
  },
  did_not_send: {
    en: 'That did not send.',
    nl: 'Dat is niet verstuurd.',
    es: 'No se ha enviado.', // MT
    pt: 'Não foi enviado.', // MT
    de: 'Das wurde nicht gesendet.', // MT
    fr: 'Ce n’a pas été envoyé.', // MT
  },

  // ── Install my.thread (a phone, not yet installed) ────────────────────
  // The install bar on a phone (InstallPrompt from @thefibre/shared). The iOS
  // steps name Safari's own menu items as iOS shows them in each language;
  // {share} is the Share icon.
  install_title: {
    en: 'Install my.thread on your phone',
    nl: 'Zet my.thread op je telefoon',
    es: 'Instala my.thread en tu móvil', // MT
    pt: 'Instale o my.thread no seu celular', // MT
    de: 'Installiere my.thread auf deinem Handy', // MT
    fr: 'Installe my.thread sur ton téléphone', // MT
  },
  install_button: {
    en: 'Install',
    nl: 'Installeren',
    es: 'Instalar', // MT
    pt: 'Instalar', // MT
    de: 'Installieren', // MT
    fr: 'Installer', // MT
  },
  install_ios_steps: {
    en: 'In Safari, tap {share} Share, then “Add to Home Screen”.',
    nl: 'Tik in Safari op {share} Deel en dan op ‘Zet op beginscherm’.',
    es: 'En Safari, toca {share} Compartir y luego «Añadir a pantalla de inicio».', // MT
    pt: 'No Safari, toque em {share} Compartilhar e depois em “Adicionar à Tela de Início”.', // MT
    de: 'Tippe in Safari auf {share} Teilen und dann auf „Zum Home-Bildschirm“.', // MT
    fr: 'Dans Safari, touche {share} Partager, puis « Sur l’écran d’accueil ».', // MT
  },
  install_help: {
    en: 'How it works',
    nl: 'Hoe het werkt',
    es: 'Cómo funciona', // MT
    pt: 'Como funciona', // MT
    de: 'So funktioniert’s', // MT
    fr: 'Comment ça marche', // MT
  },

  // ── Web push on this device ───────────────────────────────────────────
  // Web push on this device (push-card.tsx, on You → Notifications).
  push_title: {
    en: 'Notifications on this device',
    nl: 'Meldingen op dit apparaat',
    es: 'Notificaciones en este dispositivo', // MT
    pt: 'Notificações neste dispositivo', // MT
    de: 'Benachrichtigungen auf diesem Gerät', // MT
    fr: 'Notifications sur cet appareil', // MT
  },
  push_intro: {
    en: 'Changes to your sessions, and new threads on your calendars, as a notification on this phone or computer.',
    nl: 'Wijzigingen in je sessies, en nieuwe threads in je agenda’s, als melding op deze telefoon of computer.',
    es: 'Cambios en tus sesiones y nuevos threads en tus calendarios, como notificación en este móvil u ordenador.', // MT
    pt: 'Mudanças nas suas sessões e novos threads nos seus calendários, como notificação neste celular ou computador.', // MT
    de: 'Änderungen an deinen Sitzungen und neue Threads in deinen Kalendern, als Benachrichtigung auf diesem Handy oder Computer.', // MT
    fr: 'Les changements de tes séances et les nouveaux threads de tes agendas, en notification sur ce téléphone ou cet ordinateur.', // MT
  },
  push_rules: {
    en: 'Never between 22:00 and 08:00, unless a session in the next 12 hours changes. At most six a day.',
    nl: 'Nooit tussen 22:00 en 08:00, tenzij er een sessie in de komende 12 uur verandert. Hooguit zes per dag.',
    es: 'Nunca entre las 22:00 y las 08:00, salvo que cambie una sesión de las próximas 12 horas. Seis al día como máximo.', // MT
    pt: 'Nunca entre 22:00 e 08:00, a menos que mude uma sessão nas próximas 12 horas. No máximo seis por dia.', // MT
    de: 'Nie zwischen 22:00 und 08:00 Uhr, außer eine Sitzung in den nächsten 12 Stunden ändert sich. Höchstens sechs am Tag.', // MT
    fr: 'Jamais entre 22 h et 8 h, sauf si une séance des 12 prochaines heures change. Six par jour au maximum.', // MT
  },
  push_turn_on: {
    en: 'Turn on notifications on this device',
    nl: 'Meldingen aanzetten op dit apparaat',
    es: 'Activar notificaciones en este dispositivo', // MT
    pt: 'Ativar notificações neste dispositivo', // MT
    de: 'Benachrichtigungen auf diesem Gerät einschalten', // MT
    fr: 'Activer les notifications sur cet appareil', // MT
  },
  push_turning_on: {
    en: 'Turning on…',
    nl: 'Aanzetten…',
    es: 'Activando…', // MT
    pt: 'Ativando…', // MT
    de: 'Wird eingeschaltet…', // MT
    fr: 'Activation…', // MT
  },
  push_on: {
    en: 'On for this device.',
    nl: 'Aan voor dit apparaat.',
    es: 'Activadas en este dispositivo.', // MT
    pt: 'Ativadas neste dispositivo.', // MT
    de: 'Auf diesem Gerät eingeschaltet.', // MT
    fr: 'Activées sur cet appareil.', // MT
  },
  push_turn_off: {
    en: 'Turn off',
    nl: 'Uitzetten',
    es: 'Desactivar', // MT
    pt: 'Desativar', // MT
    de: 'Ausschalten', // MT
    fr: 'Désactiver', // MT
  },
  push_blocked: {
    en: 'Notifications are blocked for my.thread in this browser’s settings.',
    nl: 'Meldingen zijn voor my.thread geblokkeerd in de instellingen van deze browser.',
    es: 'Las notificaciones de my.thread están bloqueadas en los ajustes de este navegador.', // MT
    pt: 'As notificações do my.thread estão bloqueadas nas configurações deste navegador.', // MT
    de: 'Benachrichtigungen für my.thread sind in den Einstellungen dieses Browsers blockiert.', // MT
    fr: 'Les notifications de my.thread sont bloquées dans les réglages de ce navigateur.', // MT
  },
  push_unsupported: {
    en: 'This browser can’t show notifications.',
    nl: 'Deze browser kan geen meldingen tonen.',
    es: 'Este navegador no puede mostrar notificaciones.', // MT
    pt: 'Este navegador não consegue mostrar notificações.', // MT
    de: 'Dieser Browser kann keine Benachrichtigungen anzeigen.', // MT
    fr: 'Ce navigateur ne peut pas afficher de notifications.', // MT
  },
  push_ios: {
    en: 'On an iPhone or iPad, add my.thread to your Home Screen first, then turn this on there.',
    nl: 'Zet my.thread op een iPhone of iPad eerst op je beginscherm, en zet dit daar aan.',
    es: 'En un iPhone o iPad, añade primero my.thread a tu pantalla de inicio y actívalo desde ahí.', // MT
    pt: 'Num iPhone ou iPad, adicione primeiro o my.thread à Tela de Início e ative isto lá.', // MT
    de: 'Füge my.thread auf einem iPhone oder iPad zuerst zum Home-Bildschirm hinzu und schalte es dort ein.', // MT
    fr: 'Sur iPhone ou iPad, ajoute d’abord my.thread à ton écran d’accueil, puis active ceci depuis là.', // MT
  },
  push_ios_link: {
    en: 'How to add it',
    nl: 'Hoe je het toevoegt',
    es: 'Cómo añadirlo', // MT
    pt: 'Como adicionar', // MT
    de: 'So fügst du es hinzu', // MT
    fr: 'Comment l’ajouter', // MT
  },
  push_other_devices: {
    en: 'Your other devices',
    nl: 'Je andere apparaten',
    es: 'Tus otros dispositivos', // MT
    pt: 'Seus outros dispositivos', // MT
    de: 'Deine anderen Geräte', // MT
    fr: 'Tes autres appareils', // MT
  },
  push_a_device: {
    en: 'A device',
    nl: 'Een apparaat',
    es: 'Un dispositivo', // MT
    pt: 'Um dispositivo', // MT
    de: 'Ein Gerät', // MT
    fr: 'Un appareil', // MT
  },
  push_since: {
    en: 'since {date}',
    nl: 'sinds {date}',
    es: 'desde el {date}', // MT
    pt: 'desde {date}', // MT
    de: 'seit {date}', // MT
    fr: 'depuis le {date}', // MT
  },
  push_remove: {
    en: 'Remove',
    nl: 'Verwijderen',
    es: 'Quitar', // MT
    pt: 'Remover', // MT
    de: 'Entfernen', // MT
    fr: 'Retirer', // MT
  },
  push_failed: {
    en: 'That did not work. Try again in a moment.',
    nl: 'Dat lukte niet. Probeer het zo nog eens.',
    es: 'No ha funcionado. Vuelve a intentarlo en un momento.', // MT
    pt: 'Não funcionou. Tente de novo daqui a pouco.', // MT
    de: 'Das hat nicht geklappt. Versuch es gleich noch einmal.', // MT
    fr: 'Ça n’a pas fonctionné. Réessaie dans un instant.', // MT
  },

  // ── Errors, in the reader’s language ──────────────────────────────────
  // Sign-in errors, by Supabase's error code (lib/errors.ts). Never its own
  // English message.
  code_expired: {
    en: 'This code no longer works. Ask for a new one.',
    nl: 'Deze code werkt niet meer. Vraag een nieuwe aan.',
    es: 'Este código ya no funciona. Pide uno nuevo.', // MT
    pt: 'Este código não funciona mais. Peça um novo.', // MT
    de: 'Dieser Code funktioniert nicht mehr. Fordere einen neuen an.', // MT
    fr: 'Ce code ne fonctionne plus. Demandes-en un nouveau.', // MT
  },
  send_new_code: {
    en: 'Send a new code',
    nl: 'Stuur een nieuwe code',
    es: 'Enviar un código nuevo', // MT
    pt: 'Enviar um novo código', // MT
    de: 'Neuen Code senden', // MT
    fr: 'Envoyer un nouveau code', // MT
  },
  new_code_sent: {
    en: 'A new code is on its way.',
    nl: 'Er is een nieuwe code onderweg.',
    es: 'Hay un código nuevo en camino.', // MT
    pt: 'Um novo código está a caminho.', // MT
    de: 'Ein neuer Code ist unterwegs.', // MT
    fr: 'Un nouveau code est en route.', // MT
  },
  code_wait_seconds: {
    en: 'Please wait {n} seconds, then ask for another code.',
    nl: 'Wacht nog {n} seconden en vraag dan een nieuwe code.',
    es: 'Espera {n} segundos y luego pide otro código.', // MT
    pt: 'Aguarde {n} segundos e peça outro código.', // MT
    de: 'Bitte warte {n} Sekunden und fordere dann einen neuen Code an.', // MT
    fr: 'Attends {n} secondes, puis demande un autre code.', // MT
  },
  email_invalid: {
    en: 'That doesn’t look like an email address. Check it and try again.',
    nl: 'Dat lijkt geen e-mailadres. Controleer het en probeer het opnieuw.',
    es: 'Eso no parece una dirección de correo. Revísala e inténtalo de nuevo.', // MT
    pt: 'Isso não parece um endereço de e-mail. Confira e tente de novo.', // MT
    de: 'Das sieht nicht nach einer E-Mail-Adresse aus. Prüfe sie und versuch es noch einmal.', // MT
    fr: 'Cela ne ressemble pas à une adresse e-mail. Vérifie-la et réessaie.', // MT
  },
  // What an API refusal means, by status, when it sends no code we know.
  err_session_ended: {
    en: 'Your session ended. Sign in again.',
    nl: 'Je sessie is verlopen. Log opnieuw in.',
    es: 'Tu sesión ha terminado. Vuelve a entrar.', // MT
    pt: 'Sua sessão terminou. Entre de novo.', // MT
    de: 'Deine Sitzung ist abgelaufen. Melde dich erneut an.', // MT
    fr: 'Ta session a expiré. Reconnecte-toi.', // MT
  },
  err_not_allowed: {
    en: 'You can’t do that from here.',
    nl: 'Dat kan vanaf hier niet.',
    es: 'No puedes hacer eso desde aquí.', // MT
    pt: 'Você não pode fazer isso daqui.', // MT
    de: 'Das geht von hier aus nicht.', // MT
    fr: 'Tu ne peux pas faire cela d’ici.', // MT
  },
  err_gone: {
    en: 'That is no longer there. Reload the page.',
    nl: 'Dat bestaat niet meer. Laad de pagina opnieuw.',
    es: 'Eso ya no existe. Recarga la página.', // MT
    pt: 'Isso não existe mais. Recarregue a página.', // MT
    de: 'Das gibt es nicht mehr. Lade die Seite neu.', // MT
    fr: 'Cela n’existe plus. Recharge la page.', // MT
  },
  err_conflict: {
    en: 'Something changed in the meantime. Reload the page and try again.',
    nl: 'Er is intussen iets veranderd. Laad de pagina opnieuw en probeer het nog eens.',
    es: 'Algo ha cambiado mientras tanto. Recarga la página e inténtalo de nuevo.', // MT
    pt: 'Algo mudou nesse meio-tempo. Recarregue a página e tente de novo.', // MT
    de: 'Inzwischen hat sich etwas geändert. Lade die Seite neu und versuch es noch einmal.', // MT
    fr: 'Quelque chose a changé entre-temps. Recharge la page et réessaie.', // MT
  },
  err_offline: {
    en: 'Could not reach the server. Check your connection and try again.',
    nl: 'De server was niet bereikbaar. Controleer je verbinding en probeer het opnieuw.',
    es: 'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.', // MT
    pt: 'Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.', // MT
    de: 'Der Server war nicht erreichbar. Prüfe deine Verbindung und versuch es noch einmal.', // MT
    fr: 'Impossible de joindre le serveur. Vérifie ta connexion et réessaie.', // MT
  },
  // The last resort: a validation message the API sent only in English.
  err_failed_detail: {
    en: 'That did not work: {detail}',
    nl: 'Dat lukte niet: {detail}',
    es: 'No ha funcionado: {detail}', // MT
    pt: 'Não funcionou: {detail}', // MT
    de: 'Das hat nicht geklappt: {detail}', // MT
    fr: 'Ça n’a pas fonctionné : {detail}', // MT
  },

  // ── The offline page ──────────────────────────────────────────────────
  // The offline page (public/offline.html). It cannot import this file: it is
  // precached static HTML. It carries a copy of these keys, and offline.test.ts
  // holds the two together.
  offline_doc_title: {
    en: 'My Thread — offline',
    nl: 'My Thread — offline',
    es: 'My Thread — sin conexión', // MT
    pt: 'My Thread — offline', // MT
    de: 'My Thread — offline', // MT
    fr: 'My Thread — hors ligne', // MT
  },
  offline_title: {
    en: 'You’re offline',
    nl: 'Je bent offline',
    es: 'Estás sin conexión', // MT
    pt: 'Você está offline', // MT
    de: 'Du bist offline', // MT
    fr: 'Tu es hors ligne', // MT
  },
  offline_lede: {
    en: 'My Thread needs a connection to show what you’re part of.',
    nl: 'My Thread heeft een verbinding nodig om te laten zien waar je bij hoort.',
    es: 'My Thread necesita conexión para mostrar aquello de lo que formas parte.', // MT
    pt: 'O My Thread precisa de conexão para mostrar do que você faz parte.', // MT
    de: 'My Thread braucht eine Verbindung, um zu zeigen, wovon du ein Teil bist.', // MT
    fr: 'My Thread a besoin d’une connexion pour montrer ce dont tu fais partie.', // MT
  },
  offline_lede_tickets: {
    en: 'Your tickets are here. Everything else needs a connection.',
    nl: 'Je tickets staan hier. Voor de rest is een verbinding nodig.',
    es: 'Tus entradas están aquí. Todo lo demás necesita conexión.', // MT
    pt: 'Seus ingressos estão aqui. Todo o resto precisa de conexão.', // MT
    de: 'Deine Tickets sind hier. Alles andere braucht eine Verbindung.', // MT
    fr: 'Tes billets sont ici. Tout le reste nécessite une connexion.', // MT
  },
  your_tickets: {
    en: 'Your tickets',
    nl: 'Je tickets',
    es: 'Tus entradas', // MT
    pt: 'Seus ingressos', // MT
    de: 'Deine Tickets', // MT
    fr: 'Tes billets', // MT
  },
  offline_note: {
    en: 'Kept on this device from the last time you were online.',
    nl: 'Bewaard op dit apparaat sinds de laatste keer dat je online was.',
    es: 'Guardadas en este dispositivo desde la última vez que tuviste conexión.', // MT
    pt: 'Guardados neste dispositivo desde a última vez que você esteve online.', // MT
    de: 'Auf diesem Gerät gespeichert, seit du zuletzt online warst.', // MT
    fr: 'Conservés sur cet appareil depuis ta dernière connexion.', // MT
  },
  your_ticket: {
    en: 'Your ticket',
    nl: 'Je ticket',
    es: 'Tu entrada', // MT
    pt: 'Seu ingresso', // MT
    de: 'Dein Ticket', // MT
    fr: 'Ton billet', // MT
  },
  your_ticket_lc: {
    en: 'your ticket',
    nl: 'je ticket',
    es: 'tu entrada', // MT
    pt: 'seu ingresso', // MT
    de: 'dein Ticket', // MT
    fr: 'ton billet', // MT
  },
  check_in_code: {
    en: 'Check-in code',
    nl: 'Check-incode',
    es: 'Código de acceso', // MT
    pt: 'Código de check-in', // MT
    de: 'Check-in-Code', // MT
    fr: 'Code d’entrée', // MT
  },

  // ── Calendar subscribe buttons ────────────────────────────────────────
  // One-click subscribe buttons on the calendar card (lib/calendar-links.ts).
  add_google_calendar: {
    en: 'Add to Google Calendar',
    nl: 'Toevoegen aan Google Agenda',
    es: 'Añadir a Google Calendar', // MT
    pt: 'Adicionar ao Google Agenda', // MT
    de: 'Zu Google Kalender hinzufügen', // MT
    fr: 'Ajouter à Google Agenda', // MT
  },
  add_outlook: {
    en: 'Add to Outlook.com',
    nl: 'Toevoegen aan Outlook.com',
    es: 'Añadir a Outlook.com', // MT
    pt: 'Adicionar ao Outlook.com', // MT
    de: 'Zu Outlook.com hinzufügen', // MT
    fr: 'Ajouter à Outlook.com', // MT
  },

  // ── Add-to-calendar menus ─────────────────────────────────────────────
  // The add-to-calendar menus in a thread's dialog (detail.tsx).
  menu_google: {
    en: 'Google Calendar',
    nl: 'Google Agenda',
    es: 'Google Calendar', // MT
    pt: 'Google Agenda', // MT
    de: 'Google Kalender', // MT
    fr: 'Google Agenda', // MT
  },
  menu_outlook: {
    en: 'Outlook.com',
    nl: 'Outlook.com',
    es: 'Outlook.com', // MT
    pt: 'Outlook.com', // MT
    de: 'Outlook.com', // MT
    fr: 'Outlook.com', // MT
  },
  menu_ics: {
    en: 'Apple or other (.ics)',
    nl: 'Apple of andere (.ics)',
    es: 'Apple u otro (.ics)', // MT
    pt: 'Apple ou outro (.ics)', // MT
    de: 'Apple oder andere (.ics)', // MT
    fr: 'Apple ou autre (.ics)', // MT
  },
  menu_note_single: {
    en: 'A copy: it won’t move if the session moves. Subscribe your calendar to follow moves.',
    nl: 'Een kopie: die schuift niet mee als de sessie verschuift. Abonneer je agenda om wijzigingen te volgen.',
    es: 'Una copia: no se mueve si cambia la sesión. Suscribe tu calendario para seguir los cambios.', // MT
    pt: 'Uma cópia: não muda se a sessão mudar. Assine no seu calendário para acompanhar as mudanças.', // MT
    de: 'Eine Kopie: Sie verschiebt sich nicht mit, wenn die Sitzung verschoben wird. Abonniere deinen Kalender, um Änderungen zu folgen.', // MT
    fr: 'Une copie : elle ne bouge pas si la séance est déplacée. Abonne ton agenda pour suivre les changements.', // MT
  },
  menu_subscribe_all: {
    en: 'Subscribe: Google, Outlook or Apple',
    nl: 'Abonneren: Google, Outlook of Apple',
    es: 'Suscribirse: Google, Outlook o Apple', // MT
    pt: 'Assinar: Google, Outlook ou Apple', // MT
    de: 'Abonnieren: Google, Outlook oder Apple', // MT
    fr: 'S’abonner : Google, Outlook ou Apple', // MT
  },
  menu_download_all: {
    en: 'Download all sessions (.ics)',
    nl: 'Alle sessies downloaden (.ics)',
    es: 'Descargar todas las sesiones (.ics)', // MT
    pt: 'Baixar todas as sessões (.ics)', // MT
    de: 'Alle Sitzungen herunterladen (.ics)', // MT
    fr: 'Télécharger toutes les séances (.ics)', // MT
  },
  menu_note_all: {
    en: 'Subscribing follows every session, so moved dates move. A download is a copy that won’t.',
    nl: 'Een abonnement volgt elke sessie, dus verschoven data schuiven mee. Een download is een kopie die dat niet doet.',
    es: 'Suscribirse sigue cada sesión, así las fechas que cambian se actualizan. Una descarga es una copia que no.', // MT
    pt: 'Assinar acompanha cada sessão, então as datas alteradas se atualizam. Um download é uma cópia que não.', // MT
    de: 'Ein Abonnement folgt jeder Sitzung, verschobene Termine ziehen mit. Ein Download ist eine Kopie, die das nicht tut.', // MT
    fr: 'S’abonner suit chaque séance : les dates déplacées suivent. Un téléchargement est une copie qui ne suit pas.', // MT
  },

  // ── Remembered calendar ───────────────────────────────────────────────
  // Beside a session icon that remembers this device's calendar.
  other_calendar: {
    en: 'Other calendar…',
    nl: 'Andere agenda…',
    es: 'Otro calendario…', // MT
    pt: 'Outro calendário…', // MT
    de: 'Anderer Kalender…', // MT
    fr: 'Autre agenda…', // MT
  },

  // ── A thread without sessions on Next ─────────────────────────────────
  // A thread on Next with no dated session yet: its start, said as a start.
  starts_on_date: {
    en: 'Starts {date}',
    nl: 'Begint {date}',
    es: 'Empieza el {date}', // MT
    pt: 'Começa em {date}', // MT
    de: 'Beginnt am {date}', // MT
    fr: 'Commence le {date}', // MT
  },

  // ── Option B: threads without sessions ────────────────────────────────
  // Option B (held for Sjoerd): enrolled threads with no sessions yet, in their own section above the dated list.
  threads_coming_soon: {
    en: 'Your threads — programme coming soon',
    nl: 'Je threads — programma volgt nog',
    es: 'Tus threads: programa próximamente', // MT
    pt: 'Seus threads — programação em breve', // MT
    de: 'Deine Threads – Programm folgt bald', // MT
    fr: 'Tes threads — programme à venir', // MT
  },

  // ── Calendar feed followed (calendar window skips invitations) ────────
  cal_follows: {
    en: "Your calendar follows this feed, so you won't get separate invitations.",
    nl: 'Je agenda volgt deze feed, dus je krijgt geen losse uitnodigingen.',
    es: 'Tu calendario sigue este feed, así que no recibirás invitaciones aparte.', // MT
    pt: 'Seu calendário segue este feed, então você não receberá convites separados.', // MT
    de: 'Dein Kalender folgt diesem Feed, deshalb bekommst du keine separaten Einladungen.', // MT
    fr: 'Ton agenda suit ce flux, tu ne recevras donc pas d’invitations séparées.', // MT
  },
} satisfies Record<string, I18nEntry>;

export type MyKey = keyof typeof CATALOG;
export const t = makeT(CATALOG);
export { CATALOG as MY_CATALOG };
