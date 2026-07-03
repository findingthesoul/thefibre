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
  payment_method: {
    en: 'Payment',
    nl: 'Betaling',
    es: 'Pago',
    pt: 'Pagamento',
    de: 'Zahlung',
  },
  pay_online: {
    en: 'Pay online',
    nl: 'Online betalen',
    es: 'Pagar en línea',
    pt: 'Pagar online',
    de: 'Online bezahlen',
  },
  pay_by_invoice: {
    en: 'Receive an invoice',
    nl: 'Op factuur',
    es: 'Recibir una factura',
    pt: 'Receber uma fatura',
    de: 'Auf Rechnung',
  },
  redirecting_payment: {
    en: 'Taking you to the payment page…',
    nl: 'Je gaat nu naar de betaalpagina…',
    es: 'Te llevamos a la página de pago…',
    pt: 'Levando você para a página de pagamento…',
    de: 'Du wirst zur Zahlungsseite weitergeleitet…',
  },
  payment_success_msg: {
    en: 'Payment received — you are enrolled. A confirmation is on its way to your inbox.',
    nl: 'Betaling ontvangen — je bent ingeschreven. Een bevestiging is onderweg naar je inbox.',
    es: 'Pago recibido — estás inscrito. Te llegará una confirmación a tu correo.',
    pt: 'Pagamento recebido — você está inscrito. Uma confirmação está a caminho do seu e-mail.',
    de: 'Zahlung erhalten — du bist angemeldet. Eine Bestätigung ist auf dem Weg in dein Postfach.',
  },
  payment_cancelled_msg: {
    en: 'The payment was cancelled — nothing was charged. You can try again below.',
    nl: 'De betaling is geannuleerd — er is niets afgeschreven. Je kunt het hieronder opnieuw proberen.',
    es: 'El pago se canceló — no se cobró nada. Puedes intentarlo de nuevo abajo.',
    pt: 'O pagamento foi cancelado — nada foi cobrado. Você pode tentar novamente abaixo.',
    de: 'Die Zahlung wurde abgebrochen — es wurde nichts abgebucht. Du kannst es unten erneut versuchen.',
  },
  invoice_pending_msg: {
    en: 'Your enrolment is registered. The organiser will send you an invoice — your spot is confirmed once it is paid.',
    nl: 'Je aanmelding is geregistreerd. De organisator stuurt je een factuur — je plek is definitief zodra die is betaald.',
    es: 'Tu inscripción está registrada. El organizador te enviará una factura — tu plaza se confirma en cuanto esté pagada.',
    pt: 'Sua inscrição foi registrada. O organizador enviará uma fatura — sua vaga é confirmada assim que for paga.',
    de: 'Deine Anmeldung ist registriert. Die Organisation schickt dir eine Rechnung — dein Platz ist bestätigt, sobald sie bezahlt ist.',
  },
  enrolment_pending_msg: {
    en: 'Your request has been received. The organiser will review it — you will get a confirmation email once you are approved.',
    nl: 'Je aanvraag is ontvangen. De organisator bekijkt hem — je krijgt een bevestigingsmail zodra je bent goedgekeurd.',
    es: 'Hemos recibido tu solicitud. El organizador la revisará — recibirás un correo de confirmación en cuanto te aprueben.',
    pt: 'Seu pedido foi recebido. O organizador vai analisá-lo — você receberá um e-mail de confirmação assim que for aprovado.',
    de: 'Deine Anfrage ist eingegangen. Die Organisation prüft sie — du erhältst eine Bestätigungsmail, sobald du zugelassen bist.',
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
  portal_signin_note: {
    en: "Sign in with the email address you enrolled with to see everything you're part of.",
    nl: 'Log in met het e-mailadres waarmee je je hebt ingeschreven om alles te zien waar je deel van uitmaakt.',
    es: 'Inicia sesión con el correo con el que te inscribiste para ver todo aquello de lo que formas parte.',
    pt: 'Entre com o e-mail com que você se inscreveu para ver tudo de que faz parte.',
    de: 'Melde dich mit der E-Mail-Adresse an, mit der du dich eingeschrieben hast, um alles zu sehen, woran du teilnimmst.',
  },
  fellow_participants: {
    en: 'Also in this thread',
    nl: 'Ook in deze thread',
    es: 'También en este thread',
    pt: 'Também neste thread',
    de: 'Ebenfalls in diesem Thread',
  },

  // ── sign-in (email code + Google) ────────────────────────────────────
  sign_in_google: {
    en: 'Continue with Google',
    nl: 'Doorgaan met Google',
    es: 'Continuar con Google',
    pt: 'Continuar com o Google',
    de: 'Weiter mit Google',
  },
  email_me_code: {
    en: 'Email me a code',
    nl: 'Mail mij een code',
    es: 'Envíame un código',
    pt: 'Envie-me um código',
    de: 'Code per E-Mail senden',
  },
  code_sent: {
    en: 'We sent an 8-digit code to {email}.',
    nl: 'We hebben een 8-cijferige code gestuurd naar {email}.',
    es: 'Hemos enviado un código de 8 dígitos a {email}.',
    pt: 'Enviamos um código de 8 dígitos para {email}.',
    de: 'Wir haben einen 8-stelligen Code an {email} gesendet.',
  },
  enter_code: {
    en: 'Enter the 8-digit code',
    nl: 'Voer de 8-cijferige code in',
    es: 'Introduce el código de 8 dígitos',
    pt: 'Digite o código de 8 dígitos',
    de: 'Gib den 8-stelligen Code ein',
  },
  verify_code: {
    en: 'Verify code',
    nl: 'Code bevestigen',
    es: 'Verificar código',
    pt: 'Verificar código',
    de: 'Code bestätigen',
  },
  sending: {
    en: 'Sending…',
    nl: 'Versturen…',
    es: 'Enviando…',
    pt: 'Enviando…',
    de: 'Wird gesendet…',
  },
  verifying: {
    en: 'Verifying…',
    nl: 'Verifiëren…',
    es: 'Verificando…',
    pt: 'Verificando…',
    de: 'Wird geprüft…',
  },
  redirecting: {
    en: 'Redirecting…',
    nl: 'Doorsturen…',
    es: 'Redirigiendo…',
    pt: 'Redirecionando…',
    de: 'Weiterleitung…',
  },
  use_different_email: {
    en: 'Use a different email',
    nl: 'Gebruik een ander e-mailadres',
    es: 'Usar otro correo',
    pt: 'Usar outro e-mail',
    de: 'Andere E-Mail-Adresse verwenden',
  },
  code_send_failed: {
    en: "We couldn't send the code — check the address and try again.",
    nl: 'We konden de code niet versturen — controleer het adres en probeer het opnieuw.',
    es: 'No pudimos enviar el código — revisa la dirección e inténtalo de nuevo.',
    pt: 'Não foi possível enviar o código — verifique o endereço e tente novamente.',
    de: 'Der Code konnte nicht gesendet werden — prüfe die Adresse und versuche es erneut.',
  },
  code_invalid: {
    en: "That code didn't work — check it and try again.",
    nl: 'Die code werkte niet — controleer de code en probeer het opnieuw.',
    es: 'Ese código no funcionó — revísalo e inténtalo de nuevo.',
    pt: 'Esse código não funcionou — verifique e tente novamente.',
    de: 'Dieser Code hat nicht funktioniert — prüfe ihn und versuche es erneut.',
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
