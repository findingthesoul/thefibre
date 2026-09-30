// Meet's booking emails, in every locale.
//
// These were hardcoded English while Meet's signed-in shell had spoken six
// languages for weeks — Sjoerd, 2026-09-30: "Ik dacht dat de hele app
// meertalig was." An invitee never sees the shell; the mail IS the product to
// them, so it was the half that mattered and the half that was missing.
//
// Same typed-catalog rule as every other catalog here: a key missing a locale
// fails `pnpm typecheck`, which is how the list stays complete as the product
// grows. WHICH locale a given mail is in is not decided here — that is
// resolveEmailLocale in @thefibre/shared, the one chain for the whole family.
//
// Non-EN entries are machine-drafted and marked // MT pending native review,
// NL included: Sjoerd reads Dutch before it ships.

import { makeT, type I18nEntry } from '@thefibre/shared';

const CATALOG = {
  // ── the detail block, shared by every booking mail ──────────────────────
  what: {
    en: 'What',
    nl: 'Wat', // MT
    es: 'Qué', // MT
    pt: 'O quê', // MT
    de: 'Was', // MT
    fr: 'Quoi', // MT
  },
  when: {
    en: 'When',
    nl: 'Wanneer', // MT
    es: 'Cuándo', // MT
    pt: 'Quando', // MT
    de: 'Wann', // MT
    fr: 'Quand', // MT
  },
  with_whom: {
    en: 'With',
    nl: 'Met', // MT
    es: 'Con', // MT
    pt: 'Com', // MT
    de: 'Mit', // MT
    fr: 'Avec', // MT
  },
  join: {
    en: 'Join',
    nl: 'Deelnemen', // MT
    es: 'Unirse', // MT
    pt: 'Entrar', // MT
    de: 'Beitreten', // MT
    fr: 'Rejoindre', // MT
  },
  where: {
    en: 'Where',
    nl: 'Waar', // MT
    es: 'Dónde', // MT
    pt: 'Onde', // MT
    de: 'Wo', // MT
    fr: 'Où', // MT
  },

  // ── the three actions ───────────────────────────────────────────────────
  add_to_calendar: {
    en: 'Add to calendar',
    nl: 'Aan agenda toevoegen', // MT
    es: 'Añadir al calendario', // MT
    pt: 'Adicionar à agenda', // MT
    de: 'Zum Kalender hinzufügen', // MT
    fr: 'Ajouter à l’agenda', // MT
  },
  reschedule: {
    en: 'Reschedule',
    nl: 'Verzetten', // MT
    es: 'Reprogramar', // MT
    pt: 'Remarcar', // MT
    de: 'Verschieben', // MT
    fr: 'Reprogrammer', // MT
  },
  cancel: {
    en: 'Cancel',
    nl: 'Annuleren', // MT
    es: 'Cancelar', // MT
    pt: 'Cancelar', // MT
    de: 'Absagen', // MT
    fr: 'Annuler', // MT
  },
  add_to_calendar_line: {
    en: 'Add to your calendar: {url}',
    nl: 'Zet het in je agenda: {url}', // MT
    es: 'Añádelo a tu calendario: {url}', // MT
    pt: 'Adiciona à tua agenda: {url}', // MT
    de: 'In deinen Kalender: {url}', // MT
    fr: 'Ajoute-le à ton agenda : {url}', // MT
  },
  different_time_line: {
    en: 'Need a different time? {url}',
    nl: 'Een ander moment nodig? {url}', // MT
    es: '¿Necesitas otra hora? {url}', // MT
    pt: 'Precisas de outra hora? {url}', // MT
    de: 'Brauchst du eine andere Zeit? {url}', // MT
    fr: 'Besoin d’un autre horaire ? {url}', // MT
  },
  need_cancel_line: {
    en: 'Need to cancel? {url}',
    nl: 'Toch annuleren? {url}', // MT
    es: '¿Necesitas cancelar? {url}', // MT
    pt: 'Precisas de cancelar? {url}', // MT
    de: 'Doch absagen? {url}', // MT
    fr: 'Besoin d’annuler ? {url}', // MT
  },

  // ── confirmation, to the invitee ────────────────────────────────────────
  confirmed_subject: {
    en: 'Confirmed: {meeting} with {host}',
    nl: 'Bevestigd: {meeting} met {host}', // MT
    es: 'Confirmado: {meeting} con {host}', // MT
    pt: 'Confirmado: {meeting} com {host}', // MT
    de: 'Bestätigt: {meeting} mit {host}', // MT
    fr: 'Confirmé : {meeting} avec {host}', // MT
  },
  confirmed_title: {
    en: 'Booking confirmed',
    nl: 'Boeking bevestigd', // MT
    es: 'Reserva confirmada', // MT
    pt: 'Marcação confirmada', // MT
    de: 'Buchung bestätigt', // MT
    fr: 'Réservation confirmée', // MT
  },
  confirmed_headline: {
    en: 'You’re booked, {first}.',
    nl: 'Het staat, {first}.', // MT
    es: 'Ya está reservado, {first}.', // MT
    pt: 'Está marcado, {first}.', // MT
    de: 'Es steht, {first}.', // MT
    fr: 'C’est réservé, {first}.', // MT
  },
  confirmed_text_lead: {
    en: 'You’re booked.',
    nl: 'Het staat genoteerd.', // MT
    es: 'Ya está reservado.', // MT
    pt: 'Está marcado.', // MT
    de: 'Es ist gebucht.', // MT
    fr: 'C’est réservé.', // MT
  },
  greeting: {
    en: 'Hi {first},',
    nl: 'Hoi {first},', // MT
    es: 'Hola {first}:', // MT
    pt: 'Olá {first},', // MT
    de: 'Hallo {first},', // MT
    fr: 'Bonjour {first},', // MT
  },

  // ── request received (approval pending), to the invitee ─────────────────
  requested_subject: {
    en: 'Request received: {meeting}',
    nl: 'Aanvraag ontvangen: {meeting}', // MT
    es: 'Solicitud recibida: {meeting}', // MT
    pt: 'Pedido recebido: {meeting}', // MT
    de: 'Anfrage erhalten: {meeting}', // MT
    fr: 'Demande reçue : {meeting}', // MT
  },
  requested_title: {
    en: 'Request received',
    nl: 'Aanvraag ontvangen', // MT
    es: 'Solicitud recibida', // MT
    pt: 'Pedido recebido', // MT
    de: 'Anfrage erhalten', // MT
    fr: 'Demande reçue', // MT
  },
  requested_headline: {
    en: 'Your request is with {host}.',
    nl: 'Je aanvraag ligt bij {host}.', // MT
    es: 'Tu solicitud está con {host}.', // MT
    pt: 'O teu pedido está com {host}.', // MT
    de: 'Deine Anfrage liegt bei {host}.', // MT
    fr: 'Ta demande est chez {host}.', // MT
  },
  requested_sub: {
    en: 'You’ll get a confirmation email once it’s approved.',
    nl: 'Je krijgt een bevestigingsmail zodra het is goedgekeurd.', // MT
    es: 'Recibirás un correo de confirmación en cuanto se apruebe.', // MT
    pt: 'Vais receber um email de confirmação assim que for aprovado.', // MT
    de: 'Du bekommst eine Bestätigungsmail, sobald es freigegeben ist.', // MT
    fr: 'Tu recevras un e-mail de confirmation dès que ce sera validé.', // MT
  },
  requested_ask_other_time: {
    en: 'Ask for a different time',
    nl: 'Vraag een ander moment', // MT
    es: 'Pedir otra hora', // MT
    pt: 'Pedir outra hora', // MT
    de: 'Andere Zeit vorschlagen', // MT
    fr: 'Demander un autre horaire', // MT
  },
  requested_withdraw: {
    en: 'Withdraw request',
    nl: 'Aanvraag intrekken', // MT
    es: 'Retirar la solicitud', // MT
    pt: 'Retirar o pedido', // MT
    de: 'Anfrage zurückziehen', // MT
    fr: 'Retirer la demande', // MT
  },
  requested_changed_mind: {
    en: 'Changed your mind? {url}',
    nl: 'Toch niet? {url}', // MT
    es: '¿Cambiaste de idea? {url}', // MT
    pt: 'Mudaste de ideias? {url}', // MT
    de: 'Doch nicht? {url}', // MT
    fr: 'Changé d’avis ? {url}', // MT
  },

  // ── cancellation, to the invitee ────────────────────────────────────────
  cancelled_subject_invitee: {
    en: 'Cancelled: {meeting} with {host}',
    nl: 'Geannuleerd: {meeting} met {host}', // MT
    es: 'Cancelado: {meeting} con {host}', // MT
    pt: 'Cancelado: {meeting} com {host}', // MT
    de: 'Abgesagt: {meeting} mit {host}', // MT
    fr: 'Annulé : {meeting} avec {host}', // MT
  },
  cancelled_title: {
    en: 'Booking cancelled',
    nl: 'Boeking geannuleerd', // MT
    es: 'Reserva cancelada', // MT
    pt: 'Marcação cancelada', // MT
    de: 'Buchung abgesagt', // MT
    fr: 'Réservation annulée', // MT
  },
  cancelled_headline_invitee: {
    en: 'Your booking with {host} was cancelled.',
    nl: 'Je afspraak met {host} is geannuleerd.', // MT
    es: 'Tu reserva con {host} se ha cancelado.', // MT
    pt: 'A tua marcação com {host} foi cancelada.', // MT
    de: 'Dein Termin mit {host} wurde abgesagt.', // MT
    fr: 'Ta réservation avec {host} a été annulée.', // MT
  },
  cancelled_text_invitee: {
    en: 'Your booking has been cancelled.',
    nl: 'Je afspraak is geannuleerd.', // MT
    es: 'Tu reserva ha sido cancelada.', // MT
    pt: 'A tua marcação foi cancelada.', // MT
    de: 'Dein Termin wurde abgesagt.', // MT
    fr: 'Ta réservation a été annulée.', // MT
  },

  // ── moved, to the invitee ───────────────────────────────────────────────
  moved_subject_invitee: {
    en: 'Moved: {meeting} with {host}',
    nl: 'Verzet: {meeting} met {host}', // MT
    es: 'Movido: {meeting} con {host}', // MT
    pt: 'Alterado: {meeting} com {host}', // MT
    de: 'Verschoben: {meeting} mit {host}', // MT
    fr: 'Déplacé : {meeting} avec {host}', // MT
  },
  moved_title: {
    en: 'Booking moved',
    nl: 'Boeking verzet', // MT
    es: 'Reserva movida', // MT
    pt: 'Marcação alterada', // MT
    de: 'Buchung verschoben', // MT
    fr: 'Réservation déplacée', // MT
  },
  moved_headline_invitee: {
    en: 'Your booking with {host} moved.',
    nl: 'Je afspraak met {host} is verzet.', // MT
    es: 'Tu reserva con {host} se ha movido.', // MT
    pt: 'A tua marcação com {host} foi alterada.', // MT
    de: 'Dein Termin mit {host} wurde verschoben.', // MT
    fr: 'Ta réservation avec {host} a été déplacée.', // MT
  },
  moved_text_invitee: {
    en: 'Your booking has moved.',
    nl: 'Je afspraak is verzet.', // MT
    es: 'Tu reserva se ha movido.', // MT
    pt: 'A tua marcação foi alterada.', // MT
    de: 'Dein Termin wurde verschoben.', // MT
    fr: 'Ta réservation a été déplacée.', // MT
  },
  was_label: {
    en: 'Was',
    nl: 'Was', // MT
    es: 'Antes', // MT
    pt: 'Antes', // MT
    de: 'Vorher', // MT
    fr: 'Avant', // MT
  },
} satisfies Record<string, I18nEntry>;

export type MeetBookingKey = keyof typeof CATALOG;
export const meetT = makeT(CATALOG);
