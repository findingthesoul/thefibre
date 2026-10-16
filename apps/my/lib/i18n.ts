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
} satisfies Record<string, I18nEntry>;

export type MyKey = keyof typeof CATALOG;
export const t = makeT(CATALOG);
export { CATALOG as MY_CATALOG };
