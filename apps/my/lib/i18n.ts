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
  // "You're offline" and "Try again" stay English in every language: they
  // quote public/offline.html, which is English on purpose.
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
    nl: "Op een iPhone: open deze pagina in Safari, druk op Deel en dan op Zet op beginscherm. Op Android: kies in het menu van Chrome App installeren (of Toevoegen aan startscherm). Op een Mac staat Voeg toe aan Dock in het Archief-menu van Safari.\nOpen de app één keer terwijl je online bent. Elk ticket dat je hebt wordt dan op dit apparaat bewaard: de code, waarvoor het is, wanneer en waar — verder niets.\nZonder verbinding toont de app ‘You're offline’ met je tickets eronder. Tik op een ticket om de code groot te tonen bij de deur.\nDruk op Try again zodra je weer bereik hebt om terug te gaan naar de live app.\nDe bewaarde tickets verdwijnen als je uitlogt.",
    es: "En un iPhone, abre esta página en Safari, pulsa Compartir y luego Añadir a pantalla de inicio. En Android, usa el menú de Chrome y elige Instalar app (o Añadir a pantalla de inicio). En un Mac, el menú Archivo de Safari tiene Añadir al Dock.\nAbre la app una vez con conexión. Cada entrada que tengas se guarda entonces en este dispositivo: el código, para qué es, cuándo y dónde; nada más.\nSin conexión, la app muestra «You're offline» y tus entradas debajo. Toca una entrada para mostrar su código a tamaño completo en la puerta.\nPulsa Try again cuando vuelva la cobertura para volver a la app en directo.\nLas entradas guardadas se eliminan al cerrar sesión.", // MT
    pt: "No iPhone, abra esta página no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início. No Android, use o menu do Chrome e escolha Instalar app (ou Adicionar à tela inicial). No Mac, o menu Arquivo do Safari tem Adicionar ao Dock.\nAbra o app uma vez com internet. Cada ingresso seu fica então guardado neste dispositivo: o código, para que é, quando e onde — mais nada.\nSem conexão, o app mostra “You're offline” e seus ingressos logo abaixo. Toque num ingresso para mostrar o código em tamanho grande na entrada.\nToque em Try again quando o sinal voltar para retornar ao app ao vivo.\nOs ingressos guardados são removidos quando você sai.", // MT
    de: "Auf dem iPhone: Öffne diese Seite in Safari, tippe auf Teilen und dann auf Zum Home-Bildschirm. Auf Android: Wähle im Chrome-Menü App installieren (oder Zum Startbildschirm hinzufügen). Auf dem Mac hat das Ablage-Menü von Safari Zum Dock hinzufügen.\nÖffne die App einmal, während du online bist. Jedes Ticket, das du hast, wird dann auf diesem Gerät gespeichert: der Code, wofür es ist, wann und wo – sonst nichts.\nOhne Verbindung zeigt die App „You're offline“ und darunter deine Tickets. Tippe auf ein Ticket, um seinen Code am Eingang groß zu zeigen.\nTippe auf Try again, sobald du wieder Empfang hast, um zur Live-App zurückzukehren.\nDie gespeicherten Tickets werden entfernt, wenn du dich abmeldest.", // MT
    fr: "Sur iPhone, ouvre cette page dans Safari, appuie sur Partager, puis Sur l’écran d’accueil. Sur Android, dans le menu de Chrome, choisis Installer l’application (ou Ajouter à l’écran d’accueil). Sur Mac, le menu Fichier de Safari propose Ajouter au Dock.\nOuvre l’app une fois en étant connecté·e. Chaque billet que tu as est alors gardé sur cet appareil : le code, à quoi il sert, quand et où, rien d’autre.\nSans connexion, l’app affiche « You're offline » avec tes billets en dessous. Touche un billet pour afficher son code en grand à l’entrée.\nAppuie sur Try again quand le réseau revient pour retrouver l’app en direct.\nLes billets gardés sont supprimés quand tu te déconnectes.", // MT
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
} satisfies Record<string, I18nEntry>;

export type MyKey = keyof typeof CATALOG;
export const t = makeT(CATALOG);
export { CATALOG as MY_CATALOG };
