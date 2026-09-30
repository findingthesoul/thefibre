// Meet's PUBLIC surface — every string a guest can see while booking.
//
// The signed-in app has spoken six languages since P3; this half never did,
// and the guest only ever sees this half (Sjoerd, 2026-09-30). Same typed
// catalog rule as Thread's public i18n and as `i18n-ui.ts` next door: a key
// missing a locale fails `pnpm typecheck`, which is how the list stays
// complete as the product grows.
//
// WHICH locale a given page is in is not decided here — that is
// `resolvePublicLocale` in @thefibre/shared, resolved by the API and handed
// to the page. One chain, for every app.
//
// Non-EN entries are machine-drafted and marked // MT pending native review,
// NL included: Sjoerd reads Dutch before it ships. User CONTENT — a meeting
// type's name, its description, a host's bio — is never translated.

import { makeT, type I18nEntry } from '@thefibre/shared/i18n';

export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  INTL_LOCALES,
  isLocale,
  toLocale,
  type Locale,
} from '@thefibre/shared/i18n';

const CATALOG = {
  // ── the host / team landing page ────────────────────────────────────────
  team_label: {
    en: 'Team',
    nl: 'Team',
    es: 'Equipo', // MT
    pt: 'Equipa', // MT
    de: 'Team', // MT
    fr: 'Équipe', // MT
  },
  book_a_meeting: {
    en: 'Book a meeting',
    nl: 'Een afspraak maken',
    es: 'Reservar una reunión', // MT
    pt: 'Marcar uma reunião', // MT
    de: 'Termin buchen', // MT
    fr: 'Réserver un rendez-vous', // MT
  },
  no_meeting_types: {
    en: 'No meeting types available yet.',
    nl: 'Nog geen afspraaktypes beschikbaar.',
    es: 'Aún no hay tipos de reunión disponibles.', // MT
    pt: 'Ainda não há tipos de reunião disponíveis.', // MT
    de: 'Noch keine Meeting-Typen verfügbar.', // MT
    fr: 'Aucun type de rendez-vous disponible pour l’instant.', // MT
  },
  minutes_short: {
    en: '{n} min',
    nl: '{n} min',
    es: '{n} min', // MT
    pt: '{n} min', // MT
    de: '{n} Min.', // MT
    fr: '{n} min', // MT
  },
  powered_by: {
    en: 'Powered by',
    nl: 'Mogelijk gemaakt door',
    es: 'Con la tecnología de', // MT
    pt: 'Com a tecnologia de', // MT
    de: 'Ermöglicht durch', // MT
    fr: 'Propulsé par', // MT
  },

  // ── the meeting-type page ───────────────────────────────────────────────
  all_meetings: {
    en: 'All meetings',
    nl: 'Alle afspraken',
    es: 'Todas las reuniones', // MT
    pt: 'Todas as reuniões', // MT
    de: 'Alle Termine', // MT
    fr: 'Tous les rendez-vous', // MT
  },
  back_to: {
    en: 'Back to {name}',
    nl: 'Terug naar {name}',
    es: 'Volver a {name}', // MT
    pt: 'Voltar a {name}', // MT
    de: 'Zurück zu {name}', // MT
    fr: 'Retour à {name}', // MT
  },
  minutes_long: {
    en: '{n} minutes',
    nl: '{n} minuten',
    es: '{n} minutos', // MT
    pt: '{n} minutos', // MT
    de: '{n} Minuten', // MT
    fr: '{n} minutes', // MT
  },
  up_to_invitees: {
    en: 'Up to {n} invitees per slot',
    nl: 'Maximaal {n} deelnemers per tijdslot',
    es: 'Hasta {n} invitados por franja', // MT
    pt: 'Até {n} convidados por horário', // MT
    de: 'Bis zu {n} Gäste pro Zeitfenster', // MT
    fr: 'Jusqu’à {n} invités par créneau', // MT
  },
  pay_online_or_invoice: {
    en: '— pay online or by invoice',
    nl: '— online betalen of op factuur',
    es: '— pago en línea o por factura', // MT
    pt: '— pagamento online ou por fatura', // MT
    de: '— online oder per Rechnung', // MT
    fr: '— paiement en ligne ou sur facture', // MT
  },
  paid_by_invoice: {
    en: '— paid by invoice',
    nl: '— betaling op factuur',
    es: '— pago por factura', // MT
    pt: '— pagamento por fatura', // MT
    de: '— Zahlung per Rechnung', // MT
    fr: '— paiement sur facture', // MT
  },
  paid_at_checkout: {
    en: '— paid at checkout',
    nl: '— direct afrekenen',
    es: '— pago al finalizar', // MT
    pt: '— pagamento no checkout', // MT
    de: '— Zahlung beim Checkout', // MT
    fr: '— paiement à la validation', // MT
  },

  // Conferencing. The product names stay — Google Meet is Google Meet.
  provider_google_meet: {
    en: 'Google Meet — link in invite',
    nl: 'Google Meet — link in de uitnodiging',
    es: 'Google Meet — enlace en la invitación', // MT
    pt: 'Google Meet — ligação no convite', // MT
    de: 'Google Meet — Link in der Einladung', // MT
    fr: 'Google Meet — lien dans l’invitation', // MT
  },
  provider_zoom: {
    en: 'Zoom — link in invite',
    nl: 'Zoom — link in de uitnodiging',
    es: 'Zoom — enlace en la invitación', // MT
    pt: 'Zoom — ligação no convite', // MT
    de: 'Zoom — Link in der Einladung', // MT
    fr: 'Zoom — lien dans l’invitation', // MT
  },
  provider_teams: {
    en: 'Microsoft Teams — link in invite',
    nl: 'Microsoft Teams — link in de uitnodiging',
    es: 'Microsoft Teams — enlace en la invitación', // MT
    pt: 'Microsoft Teams — ligação no convite', // MT
    de: 'Microsoft Teams — Link in der Einladung', // MT
    fr: 'Microsoft Teams — lien dans l’invitation', // MT
  },
  provider_in_person: {
    en: 'In person',
    nl: 'Op locatie',
    es: 'En persona', // MT
    pt: 'Presencial', // MT
    de: 'Vor Ort', // MT
    fr: 'En personne', // MT
  },
  provider_personal_room: {
    en: 'Personal meeting room',
    nl: 'Persoonlijke vergaderruimte',
    es: 'Sala de reuniones personal', // MT
    pt: 'Sala de reunião pessoal', // MT
    de: 'Persönlicher Meetingraum', // MT
    fr: 'Salle de réunion personnelle', // MT
  },
  provider_none: {
    en: 'No conferencing',
    nl: 'Geen videoverbinding',
    es: 'Sin videoconferencia', // MT
    pt: 'Sem videoconferência', // MT
    de: 'Keine Videokonferenz', // MT
    fr: 'Pas de visioconférence', // MT
  },

  // ── picking a time ──────────────────────────────────────────────────────
  select_date_time: {
    en: 'Select a date & time',
    nl: 'Kies een datum en tijd',
    es: 'Elige una fecha y hora', // MT
    pt: 'Escolhe uma data e hora', // MT
    de: 'Datum und Uhrzeit wählen', // MT
    fr: 'Choisis une date et une heure', // MT
  },
  pick_date_to_see_times: {
    en: 'Pick a date to see times.',
    nl: 'Kies een datum om tijden te zien.',
    es: 'Elige una fecha para ver los horarios.', // MT
    pt: 'Escolhe uma data para ver os horários.', // MT
    de: 'Wähle ein Datum, um Zeiten zu sehen.', // MT
    fr: 'Choisis une date pour voir les horaires.', // MT
  },
  no_times_on_day: {
    en: 'No times on this day.',
    nl: 'Geen tijden op deze dag.',
    es: 'No hay horarios este día.', // MT
    pt: 'Não há horários neste dia.', // MT
    de: 'An diesem Tag keine Zeiten.', // MT
    fr: 'Aucun horaire ce jour-là.', // MT
  },
  previous_month: {
    en: 'Previous month',
    nl: 'Vorige maand',
    es: 'Mes anterior', // MT
    pt: 'Mês anterior', // MT
    de: 'Voriger Monat', // MT
    fr: 'Mois précédent', // MT
  },
  next_month: {
    en: 'Next month',
    nl: 'Volgende maand',
    es: 'Mes siguiente', // MT
    pt: 'Mês seguinte', // MT
    de: 'Nächster Monat', // MT
    fr: 'Mois suivant', // MT
  },
  time_zone_label: {
    en: 'Time zone:',
    nl: 'Tijdzone:',
    es: 'Zona horaria:', // MT
    pt: 'Fuso horário:', // MT
    de: 'Zeitzone:', // MT
    fr: 'Fuseau horaire :', // MT
  },
  selected_label: {
    en: 'Selected',
    nl: 'Gekozen',
    es: 'Seleccionado', // MT
    pt: 'Selecionado', // MT
    de: 'Gewählt', // MT
    fr: 'Sélectionné', // MT
  },
  change_time: {
    en: 'Change time',
    nl: 'Tijd wijzigen',
    es: 'Cambiar la hora', // MT
    pt: 'Alterar a hora', // MT
    de: 'Zeit ändern', // MT
    fr: 'Changer l’horaire', // MT
  },
  reschedule_note: {
    en: 'We’ll move this booking to the new time and email everyone the updated details. Your answers — and any payment — carry over.',
    nl: 'We verzetten deze afspraak naar de nieuwe tijd en mailen iedereen de bijgewerkte gegevens. Je antwoorden — en een eventuele betaling — gaan mee.',
    es: 'Moveremos esta reserva a la nueva hora y enviaremos los datos actualizados por correo. Tus respuestas —y cualquier pago— se mantienen.', // MT
    pt: 'Vamos mudar esta marcação para a nova hora e enviar os dados atualizados por email. As tuas respostas — e qualquer pagamento — mantêm-se.', // MT
    de: 'Wir verschieben diesen Termin auf die neue Zeit und mailen allen die aktualisierten Angaben. Deine Antworten — und eine etwaige Zahlung — bleiben erhalten.', // MT
    fr: 'Nous déplaçons cette réservation à la nouvelle heure et envoyons les détails mis à jour par e-mail. Tes réponses — et tout paiement — sont conservés.', // MT
  },

  // ── your details ────────────────────────────────────────────────────────
  your_name: {
    en: 'Your name',
    nl: 'Je naam',
    es: 'Tu nombre', // MT
    pt: 'O teu nome', // MT
    de: 'Dein Name', // MT
    fr: 'Ton nom', // MT
  },
  email_label: {
    en: 'Email',
    nl: 'E-mailadres',
    es: 'Correo electrónico', // MT
    pt: 'Email', // MT
    de: 'E-Mail', // MT
    fr: 'E-mail', // MT
  },
  confirm_booking: {
    en: 'Confirm booking',
    nl: 'Afspraak bevestigen',
    es: 'Confirmar la reserva', // MT
    pt: 'Confirmar a marcação', // MT
    de: 'Buchung bestätigen', // MT
    fr: 'Confirmer la réservation', // MT
  },
  confirm_new_time: {
    en: 'Confirm new time',
    nl: 'Nieuwe tijd bevestigen',
    es: 'Confirmar la nueva hora', // MT
    pt: 'Confirmar a nova hora', // MT
    de: 'Neue Zeit bestätigen', // MT
    fr: 'Confirmer le nouvel horaire', // MT
  },
  confirm_attendance: {
    en: 'Confirm attendance',
    nl: 'Deelname bevestigen',
    es: 'Confirmar la asistencia', // MT
    pt: 'Confirmar a presença', // MT
    de: 'Teilnahme bestätigen', // MT
    fr: 'Confirmer la présence', // MT
  },
  pick_new_time: {
    en: 'Pick a new time',
    nl: 'Kies een nieuwe tijd',
    es: 'Elige una nueva hora', // MT
    pt: 'Escolhe uma nova hora', // MT
    de: 'Neue Zeit wählen', // MT
    fr: 'Choisis un nouvel horaire', // MT
  },

  working: {
    en: 'One moment…',
    nl: 'Een moment…',
    es: 'Un momento…', // MT
    pt: 'Um momento…', // MT
    de: 'Einen Moment…', // MT
    fr: 'Un instant…', // MT
  },
  search_timezones: {
    en: 'Search timezones…',
    nl: 'Zoek tijdzones…',
    es: 'Buscar zonas horarias…', // MT
    pt: 'Procurar fusos horários…', // MT
    de: 'Zeitzonen suchen…', // MT
    fr: 'Rechercher des fuseaux…', // MT
  },

  // ── who pays ────────────────────────────────────────────────────────────
  payment_label: {
    en: 'Payment',
    nl: 'Betaling',
    es: 'Pago', // MT
    pt: 'Pagamento', // MT
    de: 'Zahlung', // MT
    fr: 'Paiement', // MT
  },
  who_pays: {
    en: 'Who pays?',
    nl: 'Wie betaalt?',
    es: '¿Quién paga?', // MT
    pt: 'Quem paga?', // MT
    de: 'Wer zahlt?', // MT
    fr: 'Qui paie ?', // MT
  },
  payer_myself: {
    en: 'Myself',
    nl: 'Ikzelf',
    es: 'Yo mismo', // MT
    pt: 'Eu próprio', // MT
    de: 'Ich selbst', // MT
    fr: 'Moi-même', // MT
  },
  payer_organisation: {
    en: 'An organisation',
    nl: 'Een organisatie',
    es: 'Una organización', // MT
    pt: 'Uma organização', // MT
    de: 'Eine Organisation', // MT
    fr: 'Une organisation', // MT
  },
  billing_address: {
    en: 'Billing address',
    nl: 'Factuuradres',
    es: 'Dirección de facturación', // MT
    pt: 'Morada de faturação', // MT
    de: 'Rechnungsadresse', // MT
    fr: 'Adresse de facturation', // MT
  },
  country: {
    en: 'Country',
    nl: 'Land',
    es: 'País', // MT
    pt: 'País', // MT
    de: 'Land', // MT
    fr: 'Pays', // MT
  },
  postal_code: {
    en: 'Postal code',
    nl: 'Postcode',
    es: 'Código postal', // MT
    pt: 'Código postal', // MT
    de: 'Postleitzahl', // MT
    fr: 'Code postal', // MT
  },
  pay_online: {
    en: 'Pay online',
    nl: 'Online betalen',
    es: 'Pagar en línea', // MT
    pt: 'Pagar online', // MT
    de: 'Online bezahlen', // MT
    fr: 'Payer en ligne', // MT
  },
  receive_invoice: {
    en: 'Receive an invoice',
    nl: 'Een factuur ontvangen',
    es: 'Recibir una factura', // MT
    pt: 'Receber uma fatura', // MT
    de: 'Eine Rechnung erhalten', // MT
    fr: 'Recevoir une facture', // MT
  },

  // ── meeting poll ────────────────────────────────────────────────────────
  which_can_you_attend: {
    en: 'Which of these can you attend?',
    nl: 'Bij welke hiervan kun je zijn?',
    es: '¿A cuáles de estas puedes asistir?', // MT
    pt: 'A quais destas podes estar presente?', // MT
    de: 'Bei welchen davon kannst du?', // MT
    fr: 'À lesquelles peux-tu être présent ?', // MT
  },
  tick_every_slot: {
    en: 'Tick every slot that works. The host picks the winner from everyone’s votes.',
    nl: 'Vink elk moment aan dat je schikt. De host kiest de winnaar uit alle stemmen.',
    es: 'Marca cada franja que te venga bien. El anfitrión elige la ganadora con todos los votos.', // MT
    pt: 'Assinala cada horário que te sirva. O anfitrião escolhe o vencedor a partir de todos os votos.', // MT
    de: 'Hake jedes passende Zeitfenster ab. Der Gastgeber wählt anhand aller Stimmen aus.', // MT
    fr: 'Coche chaque créneau qui te convient. L’hôte choisit le gagnant à partir de tous les votes.', // MT
  },
  submit_votes: {
    en: 'Submit votes',
    nl: 'Stemmen versturen',
    es: 'Enviar los votos', // MT
    pt: 'Enviar os votos', // MT
    de: 'Stimmen senden', // MT
    fr: 'Envoyer les votes', // MT
  },
  no_candidate_slots: {
    en: 'The host hasn’t added candidate slots yet. Check back soon.',
    nl: 'De host heeft nog geen momenten voorgesteld. Kom straks terug.',
    es: 'El anfitrión aún no ha añadido franjas. Vuelve pronto.', // MT
    pt: 'O anfitrião ainda não adicionou horários. Volta em breve.', // MT
    de: 'Der Gastgeber hat noch keine Zeitfenster hinzugefügt. Schau später wieder vorbei.', // MT
    fr: 'L’hôte n’a pas encore proposé de créneaux. Reviens bientôt.', // MT
  },

  // ── one-off ─────────────────────────────────────────────────────────────
  no_time_set: {
    en: 'The host hasn’t set a time for this meeting yet.',
    nl: 'De host heeft nog geen tijd voor deze afspraak vastgelegd.',
    es: 'El anfitrión aún no ha fijado una hora para esta reunión.', // MT
    pt: 'O anfitrião ainda não definiu uma hora para esta reunião.', // MT
    de: 'Der Gastgeber hat für dieses Meeting noch keine Zeit festgelegt.', // MT
    fr: 'L’hôte n’a pas encore fixé d’horaire pour cette réunion.', // MT
  },
  scheduled_for: {
    en: 'Scheduled for',
    nl: 'Gepland op',
    es: 'Programado para', // MT
    pt: 'Agendado para', // MT
    de: 'Geplant für', // MT
    fr: 'Prévu le', // MT
  },

  // ── after booking: the confirmation and cancel pages ────────────────────
  request_received: {
    en: 'Request received',
    nl: 'Aanvraag ontvangen',
    es: 'Solicitud recibida', // MT
    pt: 'Pedido recebido', // MT
    de: 'Anfrage erhalten', // MT
    fr: 'Demande reçue', // MT
  },
  booking_confirmed: {
    en: 'Booking confirmed',
    nl: 'Afspraak bevestigd',
    es: 'Reserva confirmada', // MT
    pt: 'Marcação confirmada', // MT
    de: 'Buchung bestätigt', // MT
    fr: 'Réservation confirmée', // MT
  },
  request_is_in: {
    en: 'Your request is in, {first}.',
    nl: 'Je aanvraag staat genoteerd, {first}.',
    es: 'Tu solicitud está enviada, {first}.', // MT
    pt: 'O teu pedido foi enviado, {first}.', // MT
    de: 'Deine Anfrage ist eingegangen, {first}.', // MT
    fr: 'Ta demande est envoyée, {first}.', // MT
  },
  youre_booked: {
    en: 'You’re booked, {first}.',
    nl: 'Het staat, {first}.',
    es: 'Ya está reservado, {first}.', // MT
    pt: 'Está marcado, {first}.', // MT
    de: 'Es steht, {first}.', // MT
    fr: 'C’est réservé, {first}.', // MT
  },
  will_review: {
    en: '{host} will review and confirm. You’ll get an email either way — usually within a day.',
    nl: '{host} bekijkt het en bevestigt. Je krijgt hoe dan ook een mail — meestal binnen een dag.',
    es: '{host} lo revisará y lo confirmará. Recibirás un correo en cualquier caso, normalmente en un día.', // MT
    pt: '{host} vai rever e confirmar. Vais receber um email de qualquer forma — normalmente dentro de um dia.', // MT
    de: '{host} sieht es sich an und bestätigt. Du bekommst so oder so eine Mail — meist innerhalb eines Tages.', // MT
    fr: '{host} va l’examiner et confirmer. Tu recevras un e-mail dans tous les cas — généralement sous un jour.', // MT
  },
  the_host: {
    en: 'The host',
    nl: 'De host',
    es: 'El anfitrión', // MT
    pt: 'O anfitrião', // MT
    de: 'Der Gastgeber', // MT
    fr: 'L’hôte', // MT
  },
  your_host: {
    en: 'your host',
    nl: 'je host',
    es: 'tu anfitrión', // MT
    pt: 'o teu anfitrião', // MT
    de: 'dein Gastgeber', // MT
    fr: 'ton hôte', // MT
  },
  row_what: {
    en: 'What',
    nl: 'Wat',
    es: 'Qué', // MT
    pt: 'O quê', // MT
    de: 'Was', // MT
    fr: 'Quoi', // MT
  },
  row_when: {
    en: 'When',
    nl: 'Wanneer',
    es: 'Cuándo', // MT
    pt: 'Quando', // MT
    de: 'Wann', // MT
    fr: 'Quand', // MT
  },
  row_duration: {
    en: 'Duration',
    nl: 'Duur',
    es: 'Duración', // MT
    pt: 'Duração', // MT
    de: 'Dauer', // MT
    fr: 'Durée', // MT
  },
  row_with: {
    en: 'With',
    nl: 'Met',
    es: 'Con', // MT
    pt: 'Com', // MT
    de: 'Mit', // MT
    fr: 'Avec', // MT
  },
  row_where: {
    en: 'Where',
    nl: 'Waar',
    es: 'Dónde', // MT
    pt: 'Onde', // MT
    de: 'Wo', // MT
    fr: 'Où', // MT
  },
  email_on_its_way: {
    en: 'A confirmation email is on its way to',
    nl: 'Er is een bevestigingsmail onderweg naar',
    es: 'Se está enviando un correo de confirmación a', // MT
    pt: 'Está a caminho um email de confirmação para', // MT
    de: 'Eine Bestätigungsmail ist unterwegs an', // MT
    fr: 'Un e-mail de confirmation est en route vers', // MT
  },
  vat_invoice_emailed: {
    en: 'A VAT invoice has been emailed too, and is also available here:',
    nl: 'Er is ook een btw-factuur gemaild, en die staat hier:',
    es: 'También se ha enviado una factura con IVA, disponible aquí:', // MT
    pt: 'Também foi enviada uma fatura com IVA, disponível aqui:', // MT
    de: 'Eine Rechnung mit MwSt. wurde ebenfalls gemailt und ist hier verfügbar:', // MT
    fr: 'Une facture avec TVA a également été envoyée, et est disponible ici :', // MT
  },
  view_invoice_pdf: {
    en: 'View invoice (PDF) ↗',
    nl: 'Factuur bekijken (PDF) ↗',
    es: 'Ver la factura (PDF) ↗', // MT
    pt: 'Ver a fatura (PDF) ↗', // MT
    de: 'Rechnung ansehen (PDF) ↗', // MT
    fr: 'Voir la facture (PDF) ↗', // MT
  },
  receipt_emailed_no_invoice: {
    en: 'A receipt has been emailed too. (The host’s Stripe account doesn’t have automatic invoicing enabled yet — ask them if you need a VAT invoice.)',
    nl: 'Er is ook een bonnetje gemaild. (Het Stripe-account van de host heeft automatisch factureren nog niet aanstaan — vraag het even als je een btw-factuur nodig hebt.)',
    es: 'También se ha enviado un recibo. (La cuenta de Stripe del anfitrión aún no tiene la facturación automática activada; pídesela si necesitas una factura con IVA.)', // MT
    pt: 'Também foi enviado um recibo. (A conta Stripe do anfitrião ainda não tem faturação automática ativada — pede-lhe se precisares de uma fatura com IVA.)', // MT
    de: 'Ein Beleg wurde ebenfalls gemailt. (Das Stripe-Konto des Gastgebers hat die automatische Rechnungsstellung noch nicht aktiviert — frag nach, wenn du eine Rechnung mit MwSt. brauchst.)', // MT
    fr: 'Un reçu a également été envoyé. (Le compte Stripe de l’hôte n’a pas encore activé la facturation automatique — demande-lui si tu as besoin d’une facture avec TVA.)', // MT
  },
  chose_invoice: {
    en: 'You chose to pay by invoice, so {host} will send it to you separately.',
    nl: 'Je hebt gekozen voor betaling op factuur, dus {host} stuurt die apart naar je toe.',
    es: 'Elegiste pagar por factura, así que {host} te la enviará por separado.', // MT
    pt: 'Escolheste pagar por fatura, por isso {host} vai enviá-la em separado.', // MT
    de: 'Du hast Zahlung per Rechnung gewählt, also schickt {host} sie dir separat.', // MT
    fr: 'Tu as choisi de payer sur facture, donc {host} te l’enverra séparément.', // MT
  },
  add_to_calendar: {
    en: 'Add to calendar',
    nl: 'Aan agenda toevoegen',
    es: 'Añadir al calendario', // MT
    pt: 'Adicionar à agenda', // MT
    de: 'Zum Kalender hinzufügen', // MT
    fr: 'Ajouter à l’agenda', // MT
  },
  reschedule: {
    en: 'Reschedule',
    nl: 'Verzetten',
    es: 'Reprogramar', // MT
    pt: 'Remarcar', // MT
    de: 'Verschieben', // MT
    fr: 'Reprogrammer', // MT
  },
  cancel: {
    en: 'Cancel',
    nl: 'Annuleren',
    es: 'Cancelar', // MT
    pt: 'Cancelar', // MT
    de: 'Absagen', // MT
    fr: 'Annuler', // MT
  },
  back_to_booking_page: {
    en: '← Back to {name}',
    nl: '← Terug naar {name}',
    es: '← Volver a {name}', // MT
    pt: '← Voltar a {name}', // MT
    de: '← Zurück zu {name}', // MT
    fr: '← Retour à {name}', // MT
  },
  the_booking_page: {
    en: 'the booking page',
    nl: 'de boekingspagina',
    es: 'la página de reservas', // MT
    pt: 'a página de marcações', // MT
    de: 'die Buchungsseite', // MT
    fr: 'la page de réservation', // MT
  },

  // cancel page
  cancel_booking_eyebrow: {
    en: 'Cancel booking',
    nl: 'Afspraak annuleren',
    es: 'Cancelar la reserva', // MT
    pt: 'Cancelar a marcação', // MT
    de: 'Buchung absagen', // MT
    fr: 'Annuler la réservation', // MT
  },
  booking_cancelled_eyebrow: {
    en: 'Booking cancelled',
    nl: 'Afspraak geannuleerd',
    es: 'Reserva cancelada', // MT
    pt: 'Marcação cancelada', // MT
    de: 'Buchung abgesagt', // MT
    fr: 'Réservation annulée', // MT
  },
  already_cancelled: {
    en: 'This booking is already cancelled.',
    nl: 'Deze afspraak is al geannuleerd.',
    es: 'Esta reserva ya está cancelada.', // MT
    pt: 'Esta marcação já está cancelada.', // MT
    de: 'Dieser Termin ist bereits abgesagt.', // MT
    fr: 'Cette réservation est déjà annulée.', // MT
  },
  cancel_this_booking: {
    en: 'Cancel this booking?',
    nl: 'Deze afspraak annuleren?',
    es: '¿Cancelar esta reserva?', // MT
    pt: 'Cancelar esta marcação?', // MT
    de: 'Diesen Termin absagen?', // MT
    fr: 'Annuler cette réservation ?', // MT
  },
  cancel_button: {
    en: 'Cancel booking',
    nl: 'Afspraak annuleren',
    es: 'Cancelar la reserva', // MT
    pt: 'Cancelar a marcação', // MT
    de: 'Termin absagen', // MT
    fr: 'Annuler la réservation', // MT
  },
  cancelled_done: {
    en: 'Booking cancelled. A confirmation email is on its way.',
    nl: 'Afspraak geannuleerd. Er is een bevestigingsmail onderweg.',
    es: 'Reserva cancelada. Se está enviando un correo de confirmación.', // MT
    pt: 'Marcação cancelada. Está a caminho um email de confirmação.', // MT
    de: 'Termin abgesagt. Eine Bestätigungsmail ist unterwegs.', // MT
    fr: 'Réservation annulée. Un e-mail de confirmation est en route.', // MT
  },
  cancel_nothing_yet: {
    en: 'Changed your mind? Just close this page — nothing is cancelled until you confirm.',
    nl: 'Toch niet? Sluit deze pagina gewoon — er is niets geannuleerd tot je bevestigt.',
    es: '¿Cambiaste de idea? Cierra esta página: no se cancela nada hasta que confirmes.', // MT
    pt: 'Mudaste de ideias? Fecha esta página — nada é cancelado até confirmares.', // MT
    de: 'Doch nicht? Schließ diese Seite einfach — nichts wird abgesagt, bis du bestätigst.', // MT
    fr: 'Changé d’avis ? Ferme cette page — rien n’est annulé tant que tu n’as pas confirmé.', // MT
  },

  none_of_these: {
    en: 'None of these work for me',
    nl: 'Geen van deze kan ik',
    es: 'Ninguna me viene bien', // MT
    pt: 'Nenhuma me serve', // MT
    de: 'Keine davon passt mir', // MT
    fr: 'Aucune ne me convient', // MT
  },
  poll_comment_label: {
    en: 'Anything to add? (optional)',
    nl: 'Iets toe te voegen? (optioneel)',
    es: '¿Algo que añadir? (opcional)', // MT
    pt: 'Algo a acrescentar? (opcional)', // MT
    de: 'Noch etwas dazu? (optional)', // MT
    fr: 'Quelque chose à ajouter ? (facultatif)', // MT
  },
  poll_comment_placeholder: {
    en: 'e.g. I can do Tuesdays after three',
    nl: 'bijv. dinsdagen na drieën kan ik wel',
    es: 'p. ej. los martes después de las tres me van bien', // MT
    pt: 'ex.: às terças depois das três consigo', // MT
    de: 'z. B. dienstags nach drei ginge bei mir', // MT
    fr: 'p. ex. les mardis après quinze heures me vont', // MT
  },
  poll_thanks: {
    en: 'Thanks — your answer is in.',
    nl: 'Dank je — je antwoord staat genoteerd.',
    es: 'Gracias, tu respuesta está registrada.', // MT
    pt: 'Obrigado — a tua resposta ficou registada.', // MT
    de: 'Danke — deine Antwort ist da.', // MT
    fr: 'Merci — ta réponse est enregistrée.', // MT
  },

  // ── things that go wrong ────────────────────────────────────────────────
  err_could_not_load_slots: {
    en: 'Could not load slots.',
    nl: 'Kon de tijden niet laden.',
    es: 'No se han podido cargar los horarios.', // MT
    pt: 'Não foi possível carregar os horários.', // MT
    de: 'Zeiten konnten nicht geladen werden.', // MT
    fr: 'Impossible de charger les créneaux.', // MT
  },
  err_network: {
    en: 'Network error.',
    nl: 'Netwerkfout.',
    es: 'Error de red.', // MT
    pt: 'Erro de rede.', // MT
    de: 'Netzwerkfehler.', // MT
    fr: 'Erreur réseau.', // MT
  },
  err_network_retry: {
    en: 'Network error. Please try again.',
    nl: 'Netwerkfout. Probeer het opnieuw.',
    es: 'Error de red. Inténtalo de nuevo.', // MT
    pt: 'Erro de rede. Tenta novamente.', // MT
    de: 'Netzwerkfehler. Bitte versuche es erneut.', // MT
    fr: 'Erreur réseau. Réessaie.', // MT
  },
  err_name_email_required: {
    en: 'Name and email are required.',
    nl: 'Naam en e-mailadres zijn verplicht.',
    es: 'El nombre y el correo son obligatorios.', // MT
    pt: 'O nome e o email são obrigatórios.', // MT
    de: 'Name und E-Mail sind erforderlich.', // MT
    fr: 'Le nom et l’e-mail sont obligatoires.', // MT
  },
  err_name_email_slot_required: {
    en: 'Name, email, and a time slot are required.',
    nl: 'Naam, e-mailadres en een tijdslot zijn verplicht.',
    es: 'El nombre, el correo y una franja horaria son obligatorios.', // MT
    pt: 'O nome, o email e um horário são obrigatórios.', // MT
    de: 'Name, E-Mail und ein Zeitfenster sind erforderlich.', // MT
    fr: 'Le nom, l’e-mail et un créneau sont obligatoires.', // MT
  },
  err_tick_one_slot: {
    en: 'Tick at least one slot you can attend.',
    nl: 'Vink minstens één moment aan waarop je kunt.',
    es: 'Marca al menos una franja a la que puedas asistir.', // MT
    pt: 'Assinala pelo menos um horário em que possas estar.', // MT
    de: 'Hake mindestens ein Zeitfenster ab, an dem du kannst.', // MT
    fr: 'Coche au moins un créneau où tu peux être présent.', // MT
  },
  err_slot_gone: {
    en: 'That time just went. Please pick another.',
    nl: 'Die tijd is net weg. Kies een andere.',
    es: 'Esa hora acaba de ocuparse. Elige otra.', // MT
    pt: 'Essa hora acabou de ser ocupada. Escolhe outra.', // MT
    de: 'Diese Zeit ist gerade weg. Bitte wähle eine andere.', // MT
    fr: 'Cet horaire vient d’être pris. Choisis-en un autre.', // MT
  },
  err_slot_filled: {
    en: 'This slot just filled up. Please pick a different time.',
    nl: 'Dit tijdslot is net volgeboekt. Kies een andere tijd.',
    es: 'Esta franja acaba de llenarse. Elige otra hora.', // MT
    pt: 'Este horário acabou de ficar cheio. Escolhe outra hora.', // MT
    de: 'Dieses Zeitfenster ist gerade voll geworden. Bitte wähle eine andere Zeit.', // MT
    fr: 'Ce créneau vient d’être complet. Choisis un autre horaire.', // MT
  },
  err_meeting_full: {
    en: 'This meeting is already full.',
    nl: 'Deze afspraak zit al vol.',
    es: 'Esta reunión ya está completa.', // MT
    pt: 'Esta reunião já está cheia.', // MT
    de: 'Dieses Meeting ist bereits voll.', // MT
    fr: 'Cette réunion est déjà complète.', // MT
  },
  err_booking_cancelled: {
    en: 'This booking was cancelled — book a new time instead.',
    nl: 'Deze afspraak is geannuleerd — boek een nieuwe tijd.',
    es: 'Esta reserva se canceló: reserva una nueva hora.', // MT
    pt: 'Esta marcação foi cancelada — marca uma nova hora.', // MT
    de: 'Dieser Termin wurde abgesagt — buche eine neue Zeit.', // MT
    fr: 'Cette réservation a été annulée — réserve un nouvel horaire.', // MT
  },
} satisfies Record<string, I18nEntry>;

export type PublicKey = keyof typeof CATALOG;
export const publicT = makeT(CATALOG);
export { CATALOG as PUBLIC_CATALOG };
