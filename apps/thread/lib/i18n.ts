// The Thread — public-surface translations (Sjoerd 2026-07-02).
//
// THE RULE: every string a participant can see (public pages, enrol flow,
// embeds) lives HERE, in all five languages. The catalog is typed so a key
// missing a translation fails `pnpm typecheck` — that is how the list stays
// complete as the product grows. Default locale: en.
//
// Internal/admin UI stays English; this is for the outside world.

export const LOCALES = ['en', 'nl', 'es', 'pt', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  nl: 'Nederlands',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
};

type Entry = Record<Locale, string>;

const CATALOG = {
  // ── shared ────────────────────────────────────────────────────────────
  free: {
    en: 'Free',
    nl: 'Gratis',
    es: 'Gratis',
    pt: 'Gratuito',
    de: 'Kostenlos',
  },
  event: {
    en: 'Event',
    nl: 'Evenement',
    es: 'Evento',
    pt: 'Evento',
    de: 'Veranstaltung',
  },
  journey: {
    en: 'Journey',
    nl: 'Reis',
    es: 'Recorrido',
    pt: 'Jornada',
    de: 'Reise',
  },
  powered_by: {
    en: 'Powered by',
    nl: 'Mogelijk gemaakt door',
    es: 'Desarrollado por',
    pt: 'Desenvolvido por',
    de: 'Bereitgestellt von',
  },
  online: {
    en: 'Online',
    nl: 'Online',
    es: 'En línea',
    pt: 'Online',
    de: 'Online',
  },

  // ── organiser page ───────────────────────────────────────────────────
  threads_heading: {
    en: 'Threads',
    nl: 'Threads',
    es: 'Threads',
    pt: 'Threads',
    de: 'Threads',
  },
  nothing_public: {
    en: 'Nothing public right now.',
    nl: 'Op dit moment niets openbaars.',
    es: 'Nada público por ahora.',
    pt: 'Nada público no momento.',
    de: 'Derzeit nichts Öffentliches.',
  },

  // ── thread page ──────────────────────────────────────────────────────
  agenda: {
    en: 'Agenda',
    nl: 'Programma',
    es: 'Agenda',
    pt: 'Programação',
    de: 'Programm',
  },
  spots_left: {
    en: '{n} spots left',
    nl: '{n} plekken vrij',
    es: 'Quedan {n} plazas',
    pt: 'Restam {n} vagas',
    de: 'Noch {n} Plätze frei',
  },
  full: {
    en: 'Full',
    nl: 'Vol',
    es: 'Completo',
    pt: 'Lotado',
    de: 'Ausgebucht',
  },
  certificate_on_completion: {
    en: 'Certificate on completion',
    nl: 'Certificaat na afronding',
    es: 'Certificado al finalizar',
    pt: 'Certificado ao concluir',
    de: 'Zertifikat nach Abschluss',
  },

  // ── enrol card ───────────────────────────────────────────────────────
  enrol: {
    en: 'Enrol',
    nl: 'Inschrijven',
    es: 'Inscribirse',
    pt: 'Inscrever-se',
    de: 'Anmelden',
  },
  name: {
    en: 'Name',
    nl: 'Naam',
    es: 'Nombre',
    pt: 'Nome',
    de: 'Name',
  },
  email: {
    en: 'Email',
    nl: 'E-mail',
    es: 'Correo electrónico',
    pt: 'E-mail',
    de: 'E-Mail',
  },
  choose: {
    en: 'Choose…',
    nl: 'Kies…',
    es: 'Elegir…',
    pt: 'Escolher…',
    de: 'Auswählen…',
  },
  keep_me_posted: {
    en: 'Keep me posted about future threads from {organiser}.',
    nl: 'Houd me op de hoogte van nieuwe threads van {organiser}.',
    es: 'Mantenme al tanto de futuros threads de {organiser}.',
    pt: 'Quero receber novidades sobre futuros threads de {organiser}.',
    de: 'Halte mich über künftige Threads von {organiser} auf dem Laufenden.',
  },
  enrol_free: {
    en: 'Enrol for free',
    nl: 'Gratis inschrijven',
    es: 'Inscribirse gratis',
    pt: 'Inscrever-se gratuitamente',
    de: 'Kostenlos anmelden',
  },
  enrol_paid: {
    en: 'Enrol — {price}',
    nl: 'Inschrijven — {price}',
    es: 'Inscribirse — {price}',
    pt: 'Inscrever-se — {price}',
    de: 'Anmelden — {price}',
  },
  enrolling: {
    en: 'Enrolling…',
    nl: 'Bezig met inschrijven…',
    es: 'Inscribiendo…',
    pt: 'Inscrevendo…',
    de: 'Anmeldung läuft…',
  },
  enrolment_closed: {
    en: 'Enrolment is closed for this thread.',
    nl: 'Inschrijven is gesloten voor deze thread.',
    es: 'Las inscripciones están cerradas para este thread.',
    pt: 'As inscrições estão encerradas para este thread.',
    de: 'Die Anmeldung für diesen Thread ist geschlossen.',
  },
  enrolled_success: {
    en: "You're enrolled. A confirmation is on its way to your inbox — see you in the thread.",
    nl: 'Je bent ingeschreven. Een bevestiging is onderweg naar je inbox — tot in de thread.',
    es: 'Ya estás inscrito. Te llegará una confirmación a tu correo — nos vemos en el thread.',
    pt: 'Você está inscrito. Uma confirmação está a caminho do seu e-mail — até logo no thread.',
    de: 'Du bist angemeldet. Eine Bestätigung ist auf dem Weg in dein Postfach — bis gleich im Thread.',
  },
  discount_code: {
    en: 'Discount code',
    nl: 'Kortingscode',
    es: 'Código de descuento',
    pt: 'Código de desconto',
    de: 'Rabattcode',
  },
  apply: {
    en: 'Apply',
    nl: 'Toepassen',
    es: 'Aplicar',
    pt: 'Aplicar',
    de: 'Einlösen',
  },
  code_applied: {
    en: 'Code {code} applied.',
    nl: 'Code {code} toegepast.',
    es: 'Código {code} aplicado.',
    pt: 'Código {code} aplicado.',
    de: 'Code {code} eingelöst.',
  },
  create_account: {
    en: 'Create your account',
    nl: 'Maak je account aan',
    es: 'Crea tu cuenta',
    pt: 'Crie sua conta',
    de: 'Konto erstellen',
  },
  sign_in_personal_page: {
    en: 'Sign in to your personal page',
    nl: 'Log in op je persoonlijke pagina',
    es: 'Inicia sesión en tu página personal',
    pt: 'Entre na sua página pessoal',
    de: 'Bei deiner persönlichen Seite anmelden',
  },
  account_note: {
    en: 'One Fibre account for everything — your threads, bookings and certificates in one place.',
    nl: 'Eén Fibre-account voor alles — je threads, boekingen en certificaten op één plek.',
    es: 'Una cuenta Fibre para todo — tus threads, reservas y certificados en un solo lugar.',
    pt: 'Uma conta Fibre para tudo — seus threads, reservas e certificados num só lugar.',
    de: 'Ein Fibre-Konto für alles — deine Threads, Buchungen und Zertifikate an einem Ort.',
  },
  recent_activity: {
    en: 'Recent activity',
    nl: 'Recente activiteit',
    es: 'Actividad reciente',
    pt: 'Atividade recente',
    de: 'Letzte Aktivität',
  },
  already_enrolled: {
    en: "You're already enrolled with this email address. Everything about this thread lives on your personal page.",
    nl: 'Je bent al ingeschreven met dit e-mailadres. Alles over deze thread vind je op je persoonlijke pagina.',
    es: 'Ya estás inscrito con este correo. Todo sobre este thread está en tu página personal.',
    pt: 'Você já está inscrito com este e-mail. Tudo sobre este thread está na sua página pessoal.',
    de: 'Du bist mit dieser E-Mail-Adresse bereits angemeldet. Alles zu diesem Thread findest du auf deiner persönlichen Seite.',
  },
  open_personal_page: {
    en: 'Open your personal page',
    nl: 'Open je persoonlijke pagina',
    es: 'Abrir tu página personal',
    pt: 'Abrir sua página pessoal',
    de: 'Persönliche Seite öffnen',
  },
  name_email_required: {
    en: 'Name and email are required.',
    nl: 'Naam en e-mail zijn verplicht.',
    es: 'El nombre y el correo son obligatorios.',
    pt: 'Nome e e-mail são obrigatórios.',
    de: 'Name und E-Mail sind erforderlich.',
  },
  fill_in_field: {
    en: 'Please fill in “{field}”.',
    nl: 'Vul “{field}” in.',
    es: 'Completa “{field}”.',
    pt: 'Preencha “{field}”.',
    de: 'Bitte fülle „{field}“ aus.',
  },
  something_wrong: {
    en: 'Something went wrong — please try again.',
    nl: 'Er ging iets mis — probeer het opnieuw.',
    es: 'Algo salió mal — inténtalo de nuevo.',
    pt: 'Algo deu errado — tente novamente.',
    de: 'Etwas ist schiefgelaufen — bitte versuche es erneut.',
  },
  email_consent_note: {
    en: "We'll email you about this thread (that's required to take part). Nothing else without your say-so.",
    nl: 'We mailen je over deze thread (nodig om mee te doen). Verder niets zonder jouw toestemming.',
    es: 'Te escribiremos sobre este thread (necesario para participar). Nada más sin tu permiso.',
    pt: 'Enviaremos e-mails sobre este thread (necessário para participar). Nada além disso sem a sua permissão.',
    de: 'Wir mailen dir zu diesem Thread (das ist zur Teilnahme nötig). Sonst nichts ohne dein Einverständnis.',
  },

  // ── policies ─────────────────────────────────────────────────────────
  policy_privacy: {
    en: 'privacy policy',
    nl: 'privacybeleid',
    es: 'política de privacidad',
    pt: 'política de privacidade',
    de: 'Datenschutzerklärung',
  },
  policy_agree: {
    en: 'I agree to the {policy}.',
    nl: 'Ik ga akkoord met het {policy}.',
    es: 'Acepto la {policy}.',
    pt: 'Concordo com a {policy}.',
    de: 'Ich stimme der {policy} zu.',
  },
  policy_required: {
    en: 'Please agree to the {policy} to enrol.',
    nl: 'Ga akkoord met het {policy} om in te schrijven.',
    es: 'Acepta la {policy} para inscribirte.',
    pt: 'Aceite a {policy} para se inscrever.',
    de: 'Bitte stimme der {policy} zu, um dich anzumelden.',
  },

  // ── participant portal ───────────────────────────────────────────────
  portal_title: {
    en: 'Your threads',
    nl: 'Jouw threads',
    es: 'Tus threads',
    pt: 'Seus threads',
    de: 'Deine Threads',
  },
  portal_hello: {
    en: 'Hi {name} — everything you are enrolled in, in one place.',
    nl: 'Hoi {name} — alles waarvoor je bent ingeschreven, op één plek.',
    es: 'Hola {name} — todo en lo que estás inscrito, en un solo lugar.',
    pt: 'Olá {name} — tudo em que você está inscrito, num só lugar.',
    de: 'Hallo {name} — alles, wofür du angemeldet bist, an einem Ort.',
  },
  portal_none: {
    en: 'No enrolments yet.',
    nl: 'Nog geen inschrijvingen.',
    es: 'Aún no hay inscripciones.',
    pt: 'Ainda não há inscrições.',
    de: 'Noch keine Anmeldungen.',
  },
  portal_expired: {
    en: 'This link has expired — enrol again or use a newer email.',
    nl: 'Deze link is verlopen — schrijf je opnieuw in of gebruik een nieuwere e-mail.',
    es: 'Este enlace ha caducado — inscríbete de nuevo o usa un correo más reciente.',
    pt: 'Este link expirou — inscreva-se novamente ou use um e-mail mais recente.',
    de: 'Dieser Link ist abgelaufen — melde dich erneut an oder nutze eine neuere E-Mail.',
  },

  whos_coming: {
    en: "Who's coming",
    nl: 'Wie komen er',
    es: 'Quiénes vienen',
    pt: 'Quem vem',
    de: 'Wer kommt',
  },
  show_my_name: {
    en: 'Show my name to other participants.',
    nl: 'Toon mijn naam aan andere deelnemers.',
    es: 'Mostrar mi nombre a otros participantes.',
    pt: 'Mostrar meu nome aos outros participantes.',
    de: 'Meinen Namen anderen Teilnehmenden zeigen.',
  },

  ticket: {
    en: 'Ticket',
    nl: 'Ticket',
    es: 'Entrada',
    pt: 'Ingresso',
    de: 'Ticket',
  },
  sold_out: {
    en: 'Sold out',
    nl: 'Uitverkocht',
    es: 'Agotado',
    pt: 'Esgotado',
    de: 'Ausverkauft',
  },

  // ── embeds ───────────────────────────────────────────────────────────
  view_and_enrol: {
    en: 'View & enrol',
    nl: 'Bekijk & schrijf in',
    es: 'Ver e inscribirse',
    pt: 'Ver e inscrever-se',
    de: 'Ansehen & anmelden',
  },
} satisfies Record<string, Entry>;

export type I18nKey = keyof typeof CATALOG;

export function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

/** Translate a key; {placeholders} substituted from vars. */
export function t(
  locale: Locale | string | null | undefined,
  key: I18nKey,
  vars?: Record<string, string | number>,
): string {
  const loc: Locale = isLocale(typeof locale === 'string' ? locale : null)
    ? (locale as Locale)
    : DEFAULT_LOCALE;
  let s = CATALOG[key][loc];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}
