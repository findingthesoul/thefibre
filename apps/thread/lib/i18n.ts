// The Thread — public-surface translations (Sjoerd 2026-07-02).
//
// THE RULE: every string a participant can see (public pages, enrol flow,
// embeds) lives HERE, in all locales. The locale list itself lives in
// @thefibre/shared/i18n (one definition for the whole platform); the
// catalog stays per-surface, next to its consumers. The catalog is typed
// so a key missing a translation fails `pnpm typecheck` — that is how the
// list stays complete as the product grows. Default locale: en.
//
// French entries are machine-drafted (marked // MT) pending native review.
//
// Internal/admin UI stays English; this is for the outside world.

import { makeT, type I18nEntry } from '@thefibre/shared/i18n';
import { PARTICIPANT_AUTH } from '@thefibre/shared/participant-auth-i18n';
import { INVOICE_FIELDS } from '@thefibre/shared/invoice-fields-i18n';

export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  isLocale,
  type Locale,
} from '@thefibre/shared/i18n';

const CATALOG = {
  // The invoicing-field labels, shared with the membership join form.
  ...INVOICE_FIELDS,

  // Shared participant sign-in strings (email code + Google) — one copy
  // for every participant portal, in @thefibre/shared/participant-auth-i18n.
  ...PARTICIPANT_AUTH,

  // ── shared ────────────────────────────────────────────────────────────
  free: {
    en: 'Free',
    nl: 'Gratis',
    es: 'Gratis',
    pt: 'Gratuito',
    de: 'Kostenlos',
    fr: 'Gratuit', // MT
  },
  event: {
    en: 'Event',
    nl: 'Evenement',
    es: 'Evento',
    pt: 'Evento',
    de: 'Veranstaltung',
    fr: 'Événement', // MT
  },
  journey: {
    en: 'Journey',
    nl: 'Reis',
    es: 'Recorrido',
    pt: 'Jornada',
    de: 'Reise',
    fr: 'Parcours', // MT
  },
  powered_by: {
    en: 'Powered by',
    nl: 'Mogelijk gemaakt door',
    es: 'Desarrollado por',
    pt: 'Desenvolvido por',
    de: 'Bereitgestellt von',
    fr: 'Propulsé par', // MT
  },
  online: {
    en: 'Online',
    nl: 'Online',
    es: 'En línea',
    pt: 'Online',
    de: 'Online',
    fr: 'En ligne', // MT
  },
  // Who hosts a session on the public agenda: "with Anna and Peter".
  with_hosts: {
    en: 'with {names}',
    nl: 'met {names}',
    es: 'con {names}', // MT
    pt: 'com {names}', // MT
    de: 'mit {names}', // MT
    fr: 'avec {names}', // MT
  },
  facilitated_in: {
    en: 'Facilitated in {language}',
    nl: 'Voertaal: {language}',
    es: 'Se facilita en {language}',
    pt: 'Facilitado em {language}',
    de: 'Durchgeführt auf {language}',
    fr: 'Animé en {language}', // MT
  },

  // ── organiser page ───────────────────────────────────────────────────
  threads_heading: {
    en: 'Threads',
    nl: 'Threads',
    es: 'Threads',
    pt: 'Threads',
    de: 'Threads',
    fr: 'Threads', // MT
  },
  nothing_public: {
    en: 'Nothing public right now.',
    nl: 'Op dit moment niets openbaars.',
    es: 'Nada público por ahora.',
    pt: 'Nada público no momento.',
    de: 'Derzeit nichts Öffentliches.',
    fr: 'Rien de public pour le moment.', // MT
  },

  filter_when: {
    en: 'When',
    nl: 'Wanneer',
    es: 'Cuándo', // MT
    pt: 'Quando', // MT
    de: 'Wann', // MT
    fr: 'Quand', // MT
  },
  filter_upcoming: {
    en: 'Upcoming',
    nl: 'Binnenkort',
    es: 'Próximamente', // MT
    pt: 'Em breve', // MT
    de: 'Demnächst', // MT
    fr: 'À venir', // MT
  },
  filter_this_month: {
    en: 'This month',
    nl: 'Deze maand',
    es: 'Este mes', // MT
    pt: 'Este mês', // MT
    de: 'Diesen Monat', // MT
    fr: 'Ce mois-ci', // MT
  },
  filter_next_month: {
    en: 'Next month',
    nl: 'Volgende maand',
    es: 'El mes que viene', // MT
    pt: 'No próximo mês', // MT
    de: 'Nächsten Monat', // MT
    fr: 'Le mois prochain', // MT
  },
  filter_past: {
    en: 'Past',
    nl: 'Afgelopen',
    es: 'Pasados', // MT
    pt: 'Passados', // MT
    de: 'Vergangen', // MT
    fr: 'Passés', // MT
  },
  filter_any_time: {
    en: 'Any time',
    nl: 'Altijd',
    es: 'Cualquier fecha', // MT
    pt: 'Qualquer data', // MT
    de: 'Jederzeit', // MT
    fr: 'À tout moment', // MT
  },
  filter_team: {
    en: 'Team',
    nl: 'Team',
    es: 'Equipo', // MT
    pt: 'Equipa', // MT
    de: 'Team', // MT
    fr: 'Équipe', // MT
  },
  filter_category: {
    en: 'Category',
    nl: 'Categorie',
    es: 'Categoría', // MT
    pt: 'Categoria', // MT
    de: 'Kategorie', // MT
    fr: 'Catégorie', // MT
  },
  filter_language: {
    en: 'Language',
    nl: 'Taal',
    es: 'Idioma', // MT
    pt: 'Idioma', // MT
    de: 'Sprache', // MT
    fr: 'Langue', // MT
  },
  filter_all: {
    en: 'All',
    nl: 'Alle',
    es: 'Todos', // MT
    pt: 'Todos', // MT
    de: 'Alle', // MT
    fr: 'Tous', // MT
  },
  filter_nothing: {
    en: 'Nothing matches these filters.',
    nl: 'Niets past bij deze filters.',
    es: 'Nada coincide con estos filtros.', // MT
    pt: 'Nada corresponde a estes filtros.', // MT
    de: 'Nichts passt zu diesen Filtern.', // MT
    fr: 'Rien ne correspond à ces filtres.', // MT
  },
  list_truncated: {
    en: 'Showing the first {n} threads.',
    nl: 'De eerste {n} threads worden getoond.',
    es: 'Se muestran los primeros {n} hilos.', // MT
    pt: 'A mostrar os primeiros {n} fios.', // MT
    de: 'Die ersten {n} Threads werden angezeigt.', // MT
    fr: 'Affichage des {n} premiers fils.', // MT
  },
  // ── thread page ──────────────────────────────────────────────────────
  agenda: {
    en: 'Agenda',
    nl: 'Programma',
    es: 'Agenda',
    pt: 'Programação',
    de: 'Programm',
    fr: 'Programme', // MT
  },
  spots_left: {
    en: '{n} spots left',
    nl: '{n} plekken vrij',
    es: 'Quedan {n} plazas',
    pt: 'Restam {n} vagas',
    de: 'Noch {n} Plätze frei',
    fr: 'Il reste {n} places', // MT
  },
  full: {
    en: 'Full',
    nl: 'Vol',
    es: 'Completo',
    pt: 'Lotado',
    de: 'Ausgebucht',
    fr: 'Complet', // MT
  },
  certificate_on_completion: {
    en: 'Certificate on completion',
    nl: 'Certificaat na afronding',
    es: 'Certificado al finalizar',
    pt: 'Certificado ao concluir',
    de: 'Zertifikat nach Abschluss',
    fr: 'Certificat à la fin', // MT
  },

  // ── enrol card ───────────────────────────────────────────────────────
  enrol: {
    en: 'Enrol',
    nl: 'Inschrijven',
    es: 'Inscribirse',
    pt: 'Inscrever-se',
    de: 'Anmelden',
    fr: "S'inscrire", // MT
  },
  name: {
    en: 'Name',
    nl: 'Naam',
    es: 'Nombre',
    pt: 'Nome',
    de: 'Name',
    fr: 'Nom', // MT
  },
  email: {
    en: 'Email',
    nl: 'E-mail',
    es: 'Correo electrónico',
    pt: 'E-mail',
    de: 'E-Mail',
    fr: 'E-mail', // MT
  },
  choose: {
    en: 'Choose…',
    nl: 'Kies…',
    es: 'Elegir…',
    pt: 'Escolher…',
    de: 'Auswählen…',
    fr: 'Choisir…', // MT
  },
  keep_me_posted: {
    en: 'Keep me posted about future threads from {organiser}.',
    nl: 'Houd me op de hoogte van nieuwe threads van {organiser}.',
    es: 'Mantenme al tanto de futuros threads de {organiser}.',
    pt: 'Quero receber novidades sobre futuros threads de {organiser}.',
    de: 'Halte mich über künftige Threads von {organiser} auf dem Laufenden.',
    fr: 'Tiens-moi au courant des prochains threads de {organiser}.', // MT
  },
  enrol_free: {
    en: 'Enrol for free',
    nl: 'Gratis inschrijven',
    es: 'Inscribirse gratis',
    pt: 'Inscrever-se gratuitamente',
    de: 'Kostenlos anmelden',
    fr: "S'inscrire gratuitement", // MT
  },
  enrol_paid: {
    en: 'Enrol — {price}',
    nl: 'Inschrijven — {price}',
    es: 'Inscribirse — {price}',
    pt: 'Inscrever-se — {price}',
    de: 'Anmelden — {price}',
    fr: "S'inscrire — {price}", // MT
  },
  enrolling: {
    en: 'Enrolling…',
    nl: 'Bezig met inschrijven…',
    es: 'Inscribiendo…',
    pt: 'Inscrevendo…',
    de: 'Anmeldung läuft…',
    fr: 'Inscription en cours…', // MT
  },
  // "Sign up by …" above the form (thread dates, 2026-10-16).
  // VAT on top (2026-10-15): prices are excl. VAT.
  country_for_vat: {
    en: 'Your country (for VAT)',
    nl: 'Je land (voor de btw)',
    es: 'Tu país (para el IVA)', // MT
    pt: 'O seu país (para o IVA)', // MT
    de: 'Dein Land (für die MwSt.)', // MT
    fr: 'Ton pays (pour la TVA)', // MT
  },
  vat_number_optional: {
    en: 'VAT number (businesses, optional)',
    nl: 'Btw-nummer (bedrijven, optioneel)',
    es: 'Número de IVA (empresas, opcional)', // MT
    pt: 'Número de IVA (empresas, opcional)', // MT
    de: 'USt-IdNr. (Unternehmen, optional)', // MT
    fr: 'Numéro de TVA (entreprises, facultatif)', // MT
  },
  vat_country_required: {
    en: 'Choose your country, so the VAT can be worked out.',
    nl: 'Kies je land, zodat de btw berekend kan worden.',
    es: 'Elige tu país para calcular el IVA.', // MT
    pt: 'Escolha o seu país para calcular o IVA.', // MT
    de: 'Wähle dein Land, damit die MwSt. berechnet werden kann.', // MT
    fr: 'Choisis ton pays pour calculer la TVA.', // MT
  },
  excl_vat: {
    en: 'Excl. VAT',
    nl: 'Excl. btw',
    es: 'Sin IVA', // MT
    pt: 'Sem IVA', // MT
    de: 'Ohne MwSt.', // MT
    fr: 'HT', // MT
  },
  vat: {
    en: 'VAT',
    nl: 'Btw',
    es: 'IVA', // MT
    pt: 'IVA', // MT
    de: 'MwSt.', // MT
    fr: 'TVA', // MT
  },
  vat_reverse_charged: {
    en: 'VAT reverse-charged',
    nl: 'Btw verlegd',
    es: 'IVA con inversión del sujeto pasivo', // MT
    pt: 'IVA autoliquidado', // MT
    de: 'MwSt. Reverse-Charge', // MT
    fr: 'TVA autoliquidée', // MT
  },
  vat_out_of_scope: {
    en: 'No VAT (outside the EU)',
    nl: 'Geen btw (buiten de EU)',
    es: 'Sin IVA (fuera de la UE)', // MT
    pt: 'Sem IVA (fora da UE)', // MT
    de: 'Keine MwSt. (außerhalb der EU)', // MT
    fr: 'Pas de TVA (hors UE)', // MT
  },
  total_incl_vat: {
    en: 'Total incl. VAT',
    nl: 'Totaal incl. btw',
    es: 'Total con IVA', // MT
    pt: 'Total com IVA', // MT
    de: 'Gesamt inkl. MwSt.', // MT
    fr: 'Total TTC', // MT
  },
  prices_excl_vat: {
    en: 'Prices are excl. VAT — choose your country to see the VAT.',
    nl: 'Prijzen zijn excl. btw — kies je land om de btw te zien.',
    es: 'Los precios no incluyen IVA: elige tu país para verlo.', // MT
    pt: 'Os preços não incluem IVA — escolha o seu país para o ver.', // MT
    de: 'Preise ohne MwSt. — wähle dein Land, um die MwSt. zu sehen.', // MT
    fr: 'Prix HT — choisis ton pays pour voir la TVA.', // MT
  },
  // UP TO AND INCLUDING the date shown, in every language: the date is the
  // LAST day one can sign up (signupByDate). "vóór" / "antes del" / "avant
  // le" mean BEFORE, so the same day read inclusive in one language and
  // exclusive in another (2026-10-16).
  signup_by: {
    en: 'Sign up by',
    nl: 'Schrijf je in t/m', // MT pending native review
    es: 'Inscríbete hasta el', // MT
    pt: 'Inscreva-se até', // MT
    de: 'Anmelden bis', // MT
    fr: "Inscrivez-vous jusqu'au", // MT
  },
  enrolment_closed: {
    en: 'Enrolment is closed for this thread.',
    nl: 'Inschrijven is gesloten voor deze thread.',
    es: 'Las inscripciones están cerradas para este thread.',
    pt: 'As inscrições estão encerradas para este thread.',
    de: 'Die Anmeldung für diesen Thread ist geschlossen.',
    fr: 'Les inscriptions sont closes pour ce thread.', // MT
  },
  enrolled_success: {
    en: "You're enrolled. A confirmation is on its way to your inbox — see you in the thread.",
    nl: 'Je bent ingeschreven. Een bevestiging is onderweg naar je inbox — tot in de thread.',
    es: 'Ya estás inscrito. Te llegará una confirmación a tu correo — nos vemos en el thread.',
    pt: 'Você está inscrito. Uma confirmação está a caminho do seu e-mail — até logo no thread.',
    de: 'Du bist angemeldet. Eine Bestätigung ist auf dem Weg in dein Postfach — bis gleich im Thread.',
    fr: 'Tu es inscrit·e. Une confirmation est en route vers ta boîte mail — à bientôt dans le thread.', // MT
  },
  payment_method: {
    en: 'Payment',
    nl: 'Betaling',
    es: 'Pago',
    pt: 'Pagamento',
    de: 'Zahlung',
    fr: 'Paiement', // MT
  },
  pay_online: {
    en: 'Pay online',
    nl: 'Online betalen',
    es: 'Pagar en línea',
    pt: 'Pagar online',
    de: 'Online bezahlen',
    fr: 'Payer en ligne', // MT
  },
  pay_by_invoice: {
    en: 'Receive an invoice',
    nl: 'Op factuur',
    es: 'Recibir una factura',
    pt: 'Receber uma fatura',
    de: 'Auf Rechnung',
    fr: 'Recevoir une facture', // MT
  },
  redirecting_payment: {
    en: 'Taking you to the payment page…',
    nl: 'Je gaat nu naar de betaalpagina…',
    es: 'Te llevamos a la página de pago…',
    pt: 'Levando você para a página de pagamento…',
    de: 'Du wirst zur Zahlungsseite weitergeleitet…',
    fr: 'Direction la page de paiement…', // MT
  },
  payment_success_msg: {
    en: 'Payment received — you are enrolled. A confirmation is on its way to your inbox.',
    nl: 'Betaling ontvangen — je bent ingeschreven. Een bevestiging is onderweg naar je inbox.',
    es: 'Pago recibido — estás inscrito. Te llegará una confirmación a tu correo.',
    pt: 'Pagamento recebido — você está inscrito. Uma confirmação está a caminho do seu e-mail.',
    de: 'Zahlung erhalten — du bist angemeldet. Eine Bestätigung ist auf dem Weg in dein Postfach.',
    fr: 'Paiement reçu — tu es inscrit·e. Une confirmation est en route vers ta boîte mail.', // MT
  },
  payment_cancelled_msg: {
    en: 'The payment was cancelled — nothing was charged. You can try again below.',
    nl: 'De betaling is geannuleerd — er is niets afgeschreven. Je kunt het hieronder opnieuw proberen.',
    es: 'El pago se canceló — no se cobró nada. Puedes intentarlo de nuevo abajo.',
    pt: 'O pagamento foi cancelado — nada foi cobrado. Você pode tentar novamente abaixo.',
    de: 'Die Zahlung wurde abgebrochen — es wurde nichts abgebucht. Du kannst es unten erneut versuchen.',
    fr: "Le paiement a été annulé — rien n'a été débité. Tu peux réessayer ci-dessous.", // MT
  },
  invoice_pending_msg: {
    en: 'Your enrolment is registered. The organiser will send you an invoice — your spot is confirmed once it is paid.',
    nl: 'Je aanmelding is geregistreerd. De organisator stuurt je een factuur — je plek is definitief zodra die is betaald.',
    es: 'Tu inscripción está registrada. El organizador te enviará una factura — tu plaza se confirma en cuanto esté pagada.',
    pt: 'Sua inscrição foi registrada. O organizador enviará uma fatura — sua vaga é confirmada assim que for paga.',
    de: 'Deine Anmeldung ist registriert. Die Organisation schickt dir eine Rechnung — dein Platz ist bestätigt, sobald sie bezahlt ist.',
    fr: "Ton inscription est enregistrée. L'organisateur t'enverra une facture — ta place est confirmée dès qu'elle est payée.", // MT
  },
  enrolment_pending_msg: {
    en: 'Your request has been received. The organiser will review it — you will get a confirmation email once you are approved.',
    nl: 'Je aanvraag is ontvangen. De organisator bekijkt hem — je krijgt een bevestigingsmail zodra je bent goedgekeurd.',
    es: 'Hemos recibido tu solicitud. El organizador la revisará — recibirás un correo de confirmación en cuanto te aprueben.',
    pt: 'Seu pedido foi recebido. O organizador vai analisá-lo — você receberá um e-mail de confirmação assim que for aprovado.',
    de: 'Deine Anfrage ist eingegangen. Die Organisation prüft sie — du erhältst eine Bestätigungsmail, sobald du zugelassen bist.',
    fr: "Ta demande a bien été reçue. L'organisateur va l'examiner — tu recevras un e-mail de confirmation dès que tu seras accepté·e.", // MT
  },
  // The eight invoicing-field labels moved to @thefibre/shared on
  // 2026-10-13 (INVOICE_FIELDS, spread in below) when the membership join
  // needed the same ones. The fields and the schema were already shared;
  // these were the last part living in one app's catalogue. Copy is still
  // the Thread's — it just lives where both forms can reach it.
  // The member-price invitation on the enrol form (2026-10-12). It is an
  // invitation to sign in, never a claim about the reader: the page cannot
  // know whether they are a member.
  member_price_free: {
    en: 'Member of this community? Sign in — it is included in your membership.',
    nl: 'Lid van deze community? Meld je aan — het zit bij je lidmaatschap.',
    es: '¿Miembro de esta comunidad? Inicia sesión — está incluido en tu membresía.', // MT
    pt: 'Membro desta comunidade? Entre — está incluído na sua assinatura.', // MT
    de: 'Mitglied dieser Community? Melde dich an — es ist in deiner Mitgliedschaft enthalten.', // MT
    fr: 'Membre de cette communauté ? Connecte-toi — c’est inclus dans ton adhésion.', // MT
  },
  member_price_percent: {
    en: 'Member of this community? Sign in for {pct}% off.',
    nl: 'Lid van deze community? Meld je aan voor {pct}% korting.',
    es: '¿Miembro de esta comunidad? Inicia sesión para un {pct}% de descuento.', // MT
    pt: 'Membro desta comunidade? Entre para ter {pct}% de desconto.', // MT
    de: 'Mitglied dieser Community? Melde dich an für {pct}% Rabatt.', // MT
    fr: 'Membre de cette communauté ? Connecte-toi pour {pct}% de réduction.', // MT
  },
  // What a signed-in MEMBER is told instead (2026-10-12). Different strings
  // on purpose: the invitation above asks a stranger to sign in, and saying
  // that to somebody who already has reads as a failure.
  your_member_price_free: {
    en: 'Included in your membership — you pay nothing.',
    nl: 'Zit bij je lidmaatschap — je betaalt niets.',
    es: 'Incluido en tu membresía — no pagas nada.', // MT
    pt: 'Incluído na sua assinatura — não paga nada.', // MT
    de: 'In deiner Mitgliedschaft enthalten — du zahlst nichts.', // MT
    fr: 'Inclus dans ton adhésion — tu ne paies rien.', // MT
  },
  your_member_price_percent: {
    en: 'Your member price: {pct}% off.',
    nl: 'Jouw ledenprijs: {pct}% korting.',
    es: 'Tu precio de miembro: {pct}% de descuento.', // MT
    pt: 'O seu preço de membro: {pct}% de desconto.', // MT
    de: 'Dein Mitgliederpreis: {pct}% Rabatt.', // MT
    fr: 'Ton tarif membre : {pct}% de réduction.', // MT
  },
  discount_code: {
    en: 'Discount code',
    nl: 'Kortingscode',
    es: 'Código de descuento',
    pt: 'Código de desconto',
    de: 'Rabattcode',
    fr: 'Code de réduction', // MT
  },
  apply: {
    en: 'Apply',
    nl: 'Toepassen',
    es: 'Aplicar',
    pt: 'Aplicar',
    de: 'Einlösen',
    fr: 'Appliquer', // MT
  },
  code_applied: {
    en: 'Code {code} applied.',
    nl: 'Code {code} toegepast.',
    es: 'Código {code} aplicado.',
    pt: 'Código {code} aplicado.',
    de: 'Code {code} eingelöst.',
    fr: 'Code {code} appliqué.', // MT
  },
  create_account: {
    en: 'Create your account',
    nl: 'Maak je account aan',
    es: 'Crea tu cuenta',
    pt: 'Crie sua conta',
    de: 'Konto erstellen',
    fr: 'Crée ton compte', // MT
  },
  sign_in_personal_page: {
    en: 'Sign in to your personal page',
    nl: 'Log in op je persoonlijke pagina',
    es: 'Inicia sesión en tu página personal',
    pt: 'Entre na sua página pessoal',
    de: 'Bei deiner persönlichen Seite anmelden',
    fr: 'Connecte-toi à ta page personnelle', // MT
  },
  // NOT "a Fibre account". This line is the first thing a participant reads
  // after enrolling, and docs/naming-brief.md §2 is explicit that Fibre is
  // backstage and "never the first thing a customer meets". The brand name is
  // dropped rather than swapped for Thread's: the sentence goes on to mention
  // bookings, which are Meet's, and "one account" is the true claim anyway.
  account_note: {
    en: 'One account for everything — your threads, bookings and certificates in one place.',
    nl: 'Eén account voor alles — je threads, boekingen en certificaten op één plek.',
    es: 'Una cuenta para todo — tus threads, reservas y certificados en un solo lugar.',
    pt: 'Uma conta para tudo — seus threads, reservas e certificados num só lugar.',
    de: 'Ein Konto für alles — deine Threads, Buchungen und Zertifikate an einem Ort.',
    fr: 'Un seul compte pour tout — tes threads, réservations et certificats au même endroit.', // MT
  },
  recent_activity: {
    en: 'Recent activity',
    nl: 'Recente activiteit',
    es: 'Actividad reciente',
    pt: 'Atividade recente',
    de: 'Letzte Aktivität',
    fr: 'Activité récente', // MT
  },
  already_enrolled: {
    en: "You're already enrolled with this email address. Everything about this thread lives on your personal page.",
    nl: 'Je bent al ingeschreven met dit e-mailadres. Alles over deze thread vind je op je persoonlijke pagina.',
    es: 'Ya estás inscrito con este correo. Todo sobre este thread está en tu página personal.',
    pt: 'Você já está inscrito com este e-mail. Tudo sobre este thread está na sua página pessoal.',
    de: 'Du bist mit dieser E-Mail-Adresse bereits angemeldet. Alles zu diesem Thread findest du auf deiner persönlichen Seite.',
    fr: 'Tu es déjà inscrit·e avec cette adresse e-mail. Tout ce qui concerne ce thread se trouve sur ta page personnelle.', // MT
  },
  open_personal_page: {
    en: 'Open your personal page',
    nl: 'Open je persoonlijke pagina',
    es: 'Abrir tu página personal',
    pt: 'Abrir sua página pessoal',
    de: 'Persönliche Seite öffnen',
    fr: 'Ouvrir ta page personnelle', // MT
  },
  name_email_required: {
    en: 'Name and email are required.',
    nl: 'Naam en e-mail zijn verplicht.',
    es: 'El nombre y el correo son obligatorios.',
    pt: 'Nome e e-mail são obrigatórios.',
    de: 'Name und E-Mail sind erforderlich.',
    fr: "Le nom et l'e-mail sont obligatoires.", // MT
  },
  fill_in_field: {
    en: 'Please fill in “{field}”.',
    nl: 'Vul “{field}” in.',
    es: 'Completa “{field}”.',
    pt: 'Preencha “{field}”.',
    de: 'Bitte fülle „{field}“ aus.',
    fr: 'Merci de remplir « {field} ».', // MT
  },
  email_consent_note: {
    en: "We'll email you about this thread (that's required to take part). Nothing else without your say-so.",
    nl: 'We mailen je over deze thread (nodig om mee te doen). Verder niets zonder jouw toestemming.',
    es: 'Te escribiremos sobre este thread (necesario para participar). Nada más sin tu permiso.',
    pt: 'Enviaremos e-mails sobre este thread (necessário para participar). Nada além disso sem a sua permissão.',
    de: 'Wir mailen dir zu diesem Thread (das ist zur Teilnahme nötig). Sonst nichts ohne dein Einverständnis.',
    fr: "On t'enverra des e-mails sur ce thread (nécessaire pour participer). Rien d'autre sans ton accord.", // MT
  },

  // ── policies ─────────────────────────────────────────────────────────
  policy_privacy: {
    en: 'privacy policy',
    nl: 'privacybeleid',
    es: 'política de privacidad',
    pt: 'política de privacidade',
    de: 'Datenschutzerklärung',
    fr: 'politique de confidentialité', // MT
  },
  policy_agree: {
    en: 'I agree to the {policy}.',
    nl: 'Ik ga akkoord met het {policy}.',
    es: 'Acepto la {policy}.',
    pt: 'Concordo com a {policy}.',
    de: 'Ich stimme der {policy} zu.',
    fr: "J'accepte la {policy}.", // MT
  },
  policy_required: {
    en: 'Please agree to the {policy} to enrol.',
    nl: 'Ga akkoord met het {policy} om in te schrijven.',
    es: 'Acepta la {policy} para inscribirte.',
    pt: 'Aceite a {policy} para se inscrever.',
    de: 'Bitte stimme der {policy} zu, um dich anzumelden.',
    fr: "Accepte la {policy} pour t'inscrire.", // MT
  },

  // ── participant portal ───────────────────────────────────────────────
  portal_title: {
    en: 'Your threads',
    nl: 'Jouw threads',
    es: 'Tus threads',
    pt: 'Seus threads',
    de: 'Deine Threads',
    fr: 'Tes threads', // MT
  },
  portal_hello: {
    en: 'Hi {name} — everything you are enrolled in, in one place.',
    nl: 'Hoi {name} — alles waarvoor je bent ingeschreven, op één plek.',
    es: 'Hola {name} — todo en lo que estás inscrito, en un solo lugar.',
    pt: 'Olá {name} — tudo em que você está inscrito, num só lugar.',
    de: 'Hallo {name} — alles, wofür du angemeldet bist, an einem Ort.',
    fr: 'Salut {name} — tout ce à quoi tu es inscrit·e, au même endroit.', // MT
  },
  portal_none: {
    en: 'No enrolments yet.',
    nl: 'Nog geen inschrijvingen.',
    es: 'Aún no hay inscripciones.',
    pt: 'Ainda não há inscrições.',
    de: 'Noch keine Anmeldungen.',
    fr: "Pas encore d'inscriptions.", // MT
  },
  portal_signin_note: {
    en: "Sign in with the email address you enrolled with to see everything you're part of.",
    nl: 'Log in met het e-mailadres waarmee je je hebt ingeschreven om alles te zien waar je deel van uitmaakt.',
    es: 'Inicia sesión con el correo con el que te inscribiste para ver todo aquello de lo que formas parte.',
    pt: 'Entre com o e-mail com que você se inscreveu para ver tudo de que faz parte.',
    de: 'Melde dich mit der E-Mail-Adresse an, mit der du dich eingeschrieben hast, um alles zu sehen, woran du teilnimmst.',
    fr: "Connecte-toi avec l'adresse e-mail utilisée pour t'inscrire afin de voir tout ce dont tu fais partie.", // MT
  },
  fellow_participants: {
    en: 'Also in this thread',
    nl: 'Ook in deze thread',
    es: 'También en este thread',
    pt: 'Também neste thread',
    de: 'Ebenfalls in diesem Thread',
    fr: 'Aussi dans ce thread', // MT
  },

  // ── sign-in (email code + Google): shared keys spread above; only the
  // Thread-specific portal_expired stays here ─────────────────────────
  portal_expired: {
    en: 'This link has expired — enrol again or use a newer email.',
    nl: 'Deze link is verlopen — schrijf je opnieuw in of gebruik een nieuwere e-mail.',
    es: 'Este enlace ha caducado — inscríbete de nuevo o usa un correo más reciente.',
    pt: 'Este link expirou — inscreva-se novamente ou use um e-mail mais recente.',
    de: 'Dieser Link ist abgelaufen — melde dich erneut an oder nutze eine neuere E-Mail.',
    fr: 'Ce lien a expiré — inscris-toi à nouveau ou utilise un e-mail plus récent.', // MT
  },

  whos_coming: {
    en: "Who's coming",
    nl: 'Wie komen er',
    es: 'Quiénes vienen',
    pt: 'Quem vem',
    de: 'Wer kommt',
    fr: 'Qui vient', // MT
  },
  show_my_name: {
    en: 'Show my name to other participants.',
    nl: 'Toon mijn naam aan andere deelnemers.',
    es: 'Mostrar mi nombre a otros participantes.',
    pt: 'Mostrar meu nome aos outros participantes.',
    de: 'Meinen Namen anderen Teilnehmenden zeigen.',
    fr: 'Montrer mon nom aux autres participants.', // MT
  },

  ticket: {
    en: 'Ticket',
    nl: 'Ticket',
    es: 'Entrada',
    pt: 'Ingresso',
    de: 'Ticket',
    fr: 'Billet', // MT
  },
  sold_out: {
    en: 'Sold out',
    nl: 'Uitverkocht',
    es: 'Agotado',
    pt: 'Esgotado',
    de: 'Ausverkauft',
    fr: 'Épuisé', // MT
  },

  // ── embeds ───────────────────────────────────────────────────────────
  view_and_enrol: {
    en: 'View & enrol',
    nl: 'Bekijk & schrijf in',
    es: 'Ver e inscribirse',
    pt: 'Ver e inscrever-se',
    de: 'Ansehen & anmelden',
    fr: "Voir et s'inscrire", // MT
  },
} satisfies Record<string, I18nEntry>;

export type I18nKey = keyof typeof CATALOG;

/** Translate a key; {placeholders} substituted from vars. */
export const t = makeT(CATALOG);
