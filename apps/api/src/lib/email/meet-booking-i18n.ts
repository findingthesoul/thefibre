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

  // ── an invitation to a meeting poll ────────────────────────────────────
  invite_subject: {
    en: '{host} would like to find a time: {meeting}',
    nl: '{host} wil een moment prikken: {meeting}', // MT
    es: '{host} quiere encontrar una hora: {meeting}', // MT
    pt: '{host} quer encontrar uma hora: {meeting}', // MT
    de: '{host} möchte einen Termin finden: {meeting}', // MT
    fr: '{host} cherche un créneau : {meeting}', // MT
  },
  invite_title: {
    en: 'An invitation',
    nl: 'Een uitnodiging', // MT
    es: 'Una invitación', // MT
    pt: 'Um convite', // MT
    de: 'Eine Einladung', // MT
    fr: 'Une invitation', // MT
  },
  invite_lead: {
    en: '{host} is looking for a time that works for everyone for {meeting}.',
    nl: '{host} zoekt een moment dat iedereen schikt voor {meeting}.', // MT
    es: '{host} busca una hora que les venga bien a todos para {meeting}.', // MT
    pt: '{host} procura uma hora que sirva a todos para {meeting}.', // MT
    de: '{host} sucht eine Zeit, die allen passt, für {meeting}.', // MT
    fr: '{host} cherche un horaire qui convienne à tous pour {meeting}.', // MT
  },
  invite_cta: {
    en: 'Tell them when you can',
    nl: 'Geef door wanneer je kunt', // MT
    es: 'Di cuándo puedes', // MT
    pt: 'Diz quando podes', // MT
    de: 'Sag, wann du kannst', // MT
    fr: 'Indique quand tu peux', // MT
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

  // ── join link added, to the invitee (2026-10-16) ────────────────────────
  link_subject_invitee: {
    en: 'Join link: {meeting} with {host}',
    nl: 'Deelnamelink: {meeting} met {host}', // MT
    es: 'Enlace para unirte: {meeting} con {host}', // MT
    pt: 'Link para entrar: {meeting} com {host}', // MT
    de: 'Teilnahmelink: {meeting} mit {host}', // MT
    fr: 'Lien pour rejoindre : {meeting} avec {host}', // MT
  },
  link_title: {
    en: 'Join link',
    nl: 'Deelnamelink', // MT
    es: 'Enlace para unirte', // MT
    pt: 'Link para entrar', // MT
    de: 'Teilnahmelink', // MT
    fr: 'Lien pour rejoindre', // MT
  },
  link_headline_invitee: {
    en: 'Your booking with {host} has a join link.',
    nl: 'Je afspraak met {host} heeft een deelnamelink.', // MT
    es: 'Tu reserva con {host} tiene un enlace para unirte.', // MT
    pt: 'A tua marcação com {host} tem um link para entrar.', // MT
    de: 'Dein Termin mit {host} hat einen Teilnahmelink.', // MT
    fr: 'Ta réservation avec {host} a un lien pour rejoindre.', // MT
  },
  link_text_invitee: {
    en: 'Your booking now has a join link. The attached invitation updates the one in your calendar.',
    nl: 'Je afspraak heeft nu een deelnamelink. De bijgevoegde uitnodiging werkt die in je agenda bij.', // MT
    es: 'Tu reserva ya tiene un enlace para unirte. La invitación adjunta actualiza la de tu calendario.', // MT
    pt: 'A tua marcação tem agora um link para entrar. O convite em anexo atualiza o do teu calendário.', // MT
    de: 'Dein Termin hat jetzt einen Teilnahmelink. Die angehängte Einladung aktualisiert die in deinem Kalender.', // MT
    fr: "Ta réservation a maintenant un lien pour rejoindre. L'invitation jointe met à jour celle de ton agenda.", // MT
  },
  // "Email me a link to manage this booking" (security fix, 2026-10-16).
  manage_link_subject: {
    en: 'Your booking: {name}',
    nl: 'Je afspraak: {name}', // MT
    es: 'Tu reserva: {name}', // MT
    pt: 'A tua reserva: {name}', // MT
    de: 'Deine Buchung: {name}', // MT
    fr: 'Ta réservation : {name}', // MT
  },
  manage_link_intro: {
    en: 'Here is your link to see, move or cancel your booking "{name}":',
    nl: 'Hier is je link om je afspraak "{name}" te bekijken, te verzetten of te annuleren:', // MT
    es: 'Aquí tienes tu enlace para ver, mover o cancelar tu reserva «{name}»:', // MT
    pt: 'Aqui está a tua ligação para ver, mudar ou cancelar a tua reserva «{name}»:', // MT
    de: 'Hier ist dein Link, um deine Buchung „{name}“ anzusehen, zu verschieben oder abzusagen:', // MT
    fr: 'Voici ton lien pour voir, déplacer ou annuler ta réservation « {name} » :', // MT
  },
  manage_link_ignore: {
    en: 'If you did not ask for this, you can ignore it — nothing has changed.',
    nl: 'Heb je hier niet om gevraagd, dan kun je dit negeren — er is niets veranderd.', // MT
    es: 'Si no lo pediste, puedes ignorarlo: no ha cambiado nada.', // MT
    pt: 'Se não pediste isto, podes ignorar — nada mudou.', // MT
    de: 'Wenn du das nicht angefordert hast, kannst du es ignorieren — es hat sich nichts geändert.', // MT
    fr: 'Si tu ne l’as pas demandé, tu peux l’ignorer — rien n’a changé.', // MT
  },
  manage_link_greeting: {
    en: 'Hi {name},',
    nl: 'Hoi {name},', // MT
    es: 'Hola {name}:', // MT
    pt: 'Olá {name},', // MT
    de: 'Hallo {name},', // MT
    fr: 'Bonjour {name},', // MT
  },

  // ── Lifecycle mails that were hand-written English until 2026-10-17 ──
  // (lib/email/meet-lifecycle-templates.ts): expired, approval, declined,
  // payment due, Meet access, team invite and reminder.

  // ── Fallback names, when the real one is unknown ──
  fallback_host: {
    en: 'your host',
    nl: 'je host', // MT
    es: 'tu anfitrión', // MT
    pt: 'o teu anfitrião', // MT
    de: 'dein Host', // MT
    fr: 'ton hôte', // MT
  },
  fallback_teammate: {
    en: 'a teammate',
    nl: 'een teamgenoot', // MT
    es: 'un compañero de equipo', // MT
    pt: 'um colega de equipa', // MT
    de: 'ein Teammitglied', // MT
    fr: 'un membre de l’équipe', // MT
  },
  fallback_team: {
    en: 'a team',
    nl: 'een team', // MT
    es: 'un equipo', // MT
    pt: 'uma equipa', // MT
    de: 'ein Team', // MT
    fr: 'une équipe', // MT
  },

  // ── Request expired (invitee) ──
  expired_subject: {
    en: 'Your request expired: {meeting}',
    nl: 'Je verzoek is verlopen: {meeting}', // MT
    es: 'Tu solicitud ha caducado: {meeting}', // MT
    pt: 'O teu pedido expirou: {meeting}', // MT
    de: 'Deine Anfrage ist abgelaufen: {meeting}', // MT
    fr: 'Ta demande a expiré : {meeting}', // MT
  },
  expired_title: {
    en: 'Your request expired',
    nl: 'Je verzoek is verlopen', // MT
    es: 'Tu solicitud ha caducado', // MT
    pt: 'O teu pedido expirou', // MT
    de: 'Deine Anfrage ist abgelaufen', // MT
    fr: 'Ta demande a expiré', // MT
  },
  expired_body: {
    en: '{host} did not answer your request for {meeting} ({when}), so it has expired and the time is free again.',
    nl: '{host} heeft niet gereageerd op je verzoek voor {meeting} ({when}), dus het is verlopen en het tijdstip is weer vrij.', // MT
    es: '{host} no respondió a tu solicitud de {meeting} ({when}), así que ha caducado y el horario vuelve a estar libre.', // MT
    pt: '{host} não respondeu ao teu pedido para {meeting} ({when}), por isso expirou e o horário ficou livre de novo.', // MT
    de: '{host} hat auf deine Anfrage für {meeting} ({when}) nicht geantwortet, deshalb ist sie abgelaufen und der Termin ist wieder frei.', // MT
    fr: '{host} n’a pas répondu à ta demande pour {meeting} ({when}) : elle a expiré et le créneau est de nouveau libre.', // MT
  },
  expired_ask_line: {
    en: 'You can ask for another time: {url}',
    nl: 'Je kunt om een ander tijdstip vragen: {url}', // MT
    es: 'Puedes pedir otro horario: {url}', // MT
    pt: 'Podes pedir outro horário: {url}', // MT
    de: 'Du kannst um einen anderen Termin bitten: {url}', // MT
    fr: 'Tu peux demander un autre créneau : {url}', // MT
  },
  expired_ask_link: {
    en: 'Ask for another time →',
    nl: 'Vraag om een ander tijdstip →', // MT
    es: 'Pedir otro horario →', // MT
    pt: 'Pedir outro horário →', // MT
    de: 'Um einen anderen Termin bitten →', // MT
    fr: 'Demander un autre créneau →', // MT
  },

  // ── Request expired (host) ──
  expired_host_subject: {
    en: 'Expired without an answer: {meeting} — {invitee}',
    nl: 'Verlopen zonder antwoord: {meeting} — {invitee}', // MT
    es: 'Caducada sin respuesta: {meeting} — {invitee}', // MT
    pt: 'Expirou sem resposta: {meeting} — {invitee}', // MT
    de: 'Ohne Antwort abgelaufen: {meeting} — {invitee}', // MT
    fr: 'Expirée sans réponse : {meeting} — {invitee}', // MT
  },
  expired_host_title: {
    en: 'A request expired',
    nl: 'Een verzoek is verlopen', // MT
    es: 'Una solicitud ha caducado', // MT
    pt: 'Um pedido expirou', // MT
    de: 'Eine Anfrage ist abgelaufen', // MT
    fr: 'Une demande a expiré', // MT
  },
  expired_host_asked: {
    en: '{invitee} ({email}) asked for {meeting} on {when}.',
    nl: '{invitee} ({email}) vroeg om {meeting} op {when}.', // MT
    es: '{invitee} ({email}) pidió {meeting} el {when}.', // MT
    pt: '{invitee} ({email}) pediu {meeting} para {when}.', // MT
    de: '{invitee} ({email}) hat {meeting} für {when} angefragt.', // MT
    fr: '{invitee} ({email}) a demandé {meeting} le {when}.', // MT
  },
  expired_host_body: {
    en: 'It was not answered, so it has expired and the time is free again.',
    nl: 'Er is niet op gereageerd, dus het is verlopen en het tijdstip is weer vrij.', // MT
    es: 'No se respondió, así que ha caducado y el horario vuelve a estar libre.', // MT
    pt: 'Não foi respondido, por isso expirou e o horário ficou livre de novo.', // MT
    de: 'Sie wurde nicht beantwortet, deshalb ist sie abgelaufen und der Termin ist wieder frei.', // MT
    fr: 'Elle est restée sans réponse : elle a expiré et le créneau est de nouveau libre.', // MT
  },
  expired_host_line: {
    en: 'If you still want it, they can be asked to pick a time: {url}',
    nl: 'Wil je het toch nog, dan kun je ze een tijdstip laten kiezen: {url}', // MT
    es: 'Si aún lo quieres, puedes pedirle que elija un horario: {url}', // MT
    pt: 'Se ainda quiseres, podes pedir-lhe que escolha um horário: {url}', // MT
    de: 'Wenn du es noch möchtest, kannst du sie einen Termin wählen lassen: {url}', // MT
    fr: 'Si tu le souhaites encore, tu peux lui demander de choisir un créneau : {url}', // MT
  },
  expired_host_link: {
    en: 'Pick a time with them →',
    nl: 'Kies samen een tijdstip →', // MT
    es: 'Elegir un horario juntos →', // MT
    pt: 'Escolher um horário juntos →', // MT
    de: 'Gemeinsam einen Termin wählen →', // MT
    fr: 'Choisir un créneau ensemble →', // MT
  },

  // ── Approval needed (host) ──
  approval_subject: {
    en: 'Approval needed: {meeting} — {invitee}',
    nl: 'Goedkeuring nodig: {meeting} — {invitee}', // MT
    es: 'Se necesita aprobación: {meeting} — {invitee}', // MT
    pt: 'Aprovação necessária: {meeting} — {invitee}', // MT
    de: 'Freigabe nötig: {meeting} — {invitee}', // MT
    fr: 'Approbation requise : {meeting} — {invitee}', // MT
  },
  approval_subject_moved: {
    en: 'Approval needed (moved): {meeting} — {invitee}',
    nl: 'Goedkeuring nodig (verplaatst): {meeting} — {invitee}', // MT
    es: 'Se necesita aprobación (movida): {meeting} — {invitee}', // MT
    pt: 'Aprovação necessária (movido): {meeting} — {invitee}', // MT
    de: 'Freigabe nötig (verschoben): {meeting} — {invitee}', // MT
    fr: 'Approbation requise (déplacée) : {meeting} — {invitee}', // MT
  },
  approval_title: {
    en: 'Approval needed',
    nl: 'Goedkeuring nodig', // MT
    es: 'Se necesita aprobación', // MT
    pt: 'Aprovação necessária', // MT
    de: 'Freigabe nötig', // MT
    fr: 'Approbation requise', // MT
  },
  approval_title_moved: {
    en: 'Approval needed (moved)',
    nl: 'Goedkeuring nodig (verplaatst)', // MT
    es: 'Se necesita aprobación (movida)', // MT
    pt: 'Aprovação necessária (movido)', // MT
    de: 'Freigabe nötig (verschoben)', // MT
    fr: 'Approbation requise (déplacée)', // MT
  },
  approval_body: {
    en: '{invitee} ({email}) requested {meeting} for {when}.',
    nl: '{invitee} ({email}) vroeg {meeting} aan voor {when}.', // MT
    es: '{invitee} ({email}) solicitó {meeting} para el {when}.', // MT
    pt: '{invitee} ({email}) pediu {meeting} para {when}.', // MT
    de: '{invitee} ({email}) hat {meeting} für {when} angefragt.', // MT
    fr: '{invitee} ({email}) a demandé {meeting} pour le {when}.', // MT
  },
  approval_moved_from: {
    en: 'This request was moved. It was {when}.',
    nl: 'Dit verzoek is verplaatst. Het was {when}.', // MT
    es: 'Esta solicitud se ha movido. Era el {when}.', // MT
    pt: 'Este pedido foi movido. Era {when}.', // MT
    de: 'Diese Anfrage wurde verschoben. Sie war für {when}.', // MT
    fr: 'Cette demande a été déplacée. Elle était prévue le {when}.', // MT
  },
  approval_review_line: {
    en: 'Review and approve at {url}',
    nl: 'Bekijk en keur goed op {url}', // MT
    es: 'Revisa y aprueba en {url}', // MT
    pt: 'Revê e aprova em {url}', // MT
    de: 'Prüfen und freigeben unter {url}', // MT
    fr: 'Vérifie et approuve sur {url}', // MT
  },
  approval_review_link: {
    en: 'Review in Meet →',
    nl: 'Bekijken in Meet →', // MT
    es: 'Revisar en Meet →', // MT
    pt: 'Rever no Meet →', // MT
    de: 'In Meet prüfen →', // MT
    fr: 'Vérifier dans Meet →', // MT
  },

  // ── Declined (invitee) ──
  declined_subject: {
    en: 'Declined: {meeting}',
    nl: 'Afgewezen: {meeting}', // MT
    es: 'Rechazada: {meeting}', // MT
    pt: 'Recusado: {meeting}', // MT
    de: 'Abgelehnt: {meeting}', // MT
    fr: 'Refusée : {meeting}', // MT
  },
  declined_title: {
    en: 'Booking declined',
    nl: 'Boeking afgewezen', // MT
    es: 'Reserva rechazada', // MT
    pt: 'Marcação recusada', // MT
    de: 'Buchung abgelehnt', // MT
    fr: 'Réservation refusée', // MT
  },
  declined_body: {
    en: '{host} was unable to confirm your booking request for {meeting}.',
    nl: '{host} kon je boekingsverzoek voor {meeting} niet bevestigen.', // MT
    es: '{host} no pudo confirmar tu solicitud de reserva de {meeting}.', // MT
    pt: '{host} não conseguiu confirmar o teu pedido de marcação para {meeting}.', // MT
    de: '{host} konnte deine Buchungsanfrage für {meeting} nicht bestätigen.', // MT
    fr: '{host} n’a pas pu confirmer ta demande de réservation pour {meeting}.', // MT
  },
  declined_note: {
    en: 'Note from {host}: {note}',
    nl: 'Bericht van {host}: {note}', // MT
    es: 'Nota de {host}: {note}', // MT
    pt: 'Nota de {host}: {note}', // MT
    de: 'Nachricht von {host}: {note}', // MT
    fr: 'Message de {host} : {note}', // MT
  },

  // ── Payment due (invitee) ──
  payment_subject: {
    en: 'Payment for {meeting}',
    nl: 'Betaling voor {meeting}', // MT
    es: 'Pago de {meeting}', // MT
    pt: 'Pagamento de {meeting}', // MT
    de: 'Zahlung für {meeting}', // MT
    fr: 'Paiement pour {meeting}', // MT
  },
  payment_title: {
    en: 'Payment',
    nl: 'Betaling', // MT
    es: 'Pago', // MT
    pt: 'Pagamento', // MT
    de: 'Zahlung', // MT
    fr: 'Paiement', // MT
  },
  payment_body: {
    en: '{amount} is due for {meeting}.',
    nl: 'Er staat {amount} open voor {meeting}.', // MT
    es: 'Hay {amount} pendiente de pago por {meeting}.', // MT
    pt: 'Há {amount} a pagar por {meeting}.', // MT
    de: 'Für {meeting} sind {amount} fällig.', // MT
    fr: '{amount} sont dus pour {meeting}.', // MT
  },
  payment_line: {
    en: 'Pay online: {url}',
    nl: 'Online betalen: {url}', // MT
    es: 'Pagar en línea: {url}', // MT
    pt: 'Pagar online: {url}', // MT
    de: 'Online bezahlen: {url}', // MT
    fr: 'Payer en ligne : {url}', // MT
  },
  payment_button: {
    en: 'Pay online',
    nl: 'Online betalen', // MT
    es: 'Pagar en línea', // MT
    pt: 'Pagar online', // MT
    de: 'Online bezahlen', // MT
    fr: 'Payer en ligne', // MT
  },
  payment_transfer: {
    en: 'Prefer a bank transfer? Just ignore the button — the invoice stands.',
    nl: 'Liever een bankoverschrijving? Negeer dan de knop — de factuur blijft staan.', // MT
    es: '¿Prefieres una transferencia bancaria? Ignora el botón: la factura sigue siendo válida.', // MT
    pt: 'Preferes transferência bancária? Ignora o botão — a fatura mantém-se.', // MT
    de: 'Lieber per Überweisung? Ignoriere einfach den Button — die Rechnung bleibt gültig.', // MT
    fr: 'Tu préfères un virement ? Ignore simplement le bouton — la facture reste valable.', // MT
  },

  // ── Meet access invite (a workspace user) ──
  access_subject: {
    en: '{inviter} invited you to {meet}',
    nl: '{inviter} heeft je uitgenodigd voor {meet}', // MT
    es: '{inviter} te ha invitado a {meet}', // MT
    pt: '{inviter} convidou-te para o {meet}', // MT
    de: '{inviter} hat dich zu {meet} eingeladen', // MT
    fr: '{inviter} t’a invité·e sur {meet}', // MT
  },
  access_title: {
    en: 'Invitation',
    nl: 'Uitnodiging', // MT
    es: 'Invitación', // MT
    pt: 'Convite', // MT
    de: 'Einladung', // MT
    fr: 'Invitation', // MT
  },
  access_body: {
    en: '{inviter} added you to their {platform} workspace and granted you access to {meet}.',
    nl: '{inviter} heeft je toegevoegd aan de {platform}-werkruimte en je toegang gegeven tot {meet}.', // MT
    es: '{inviter} te ha añadido a su espacio de trabajo de {platform} y te ha dado acceso a {meet}.', // MT
    pt: '{inviter} adicionou-te ao espaço de trabalho do {platform} e deu-te acesso ao {meet}.', // MT
    de: '{inviter} hat dich zum {platform}-Arbeitsbereich hinzugefügt und dir Zugang zu {meet} gegeben.', // MT
    fr: '{inviter} t’a ajouté·e à son espace de travail {platform} et t’a donné accès à {meet}.', // MT
  },
  access_signin_line: {
    en: 'Sign in at {url} (using {email}) to start using {meet}.',
    nl: 'Log in op {url} (met {email}) om {meet} te gaan gebruiken.', // MT
    es: 'Inicia sesión en {url} (con {email}) para empezar a usar {meet}.', // MT
    pt: 'Inicia sessão em {url} (com {email}) para começares a usar o {meet}.', // MT
    de: 'Melde dich unter {url} an (mit {email}), um {meet} zu nutzen.', // MT
    fr: 'Connecte-toi sur {url} (avec {email}) pour commencer à utiliser {meet}.', // MT
  },
  access_signin_button: {
    en: 'Sign in to {platform}',
    nl: 'Inloggen bij {platform}', // MT
    es: 'Iniciar sesión en {platform}', // MT
    pt: 'Iniciar sessão no {platform}', // MT
    de: 'Bei {platform} anmelden', // MT
    fr: 'Se connecter à {platform}', // MT
  },
  access_use_email: {
    en: 'Sign in with {email}.',
    nl: 'Log in met {email}.', // MT
    es: 'Inicia sesión con {email}.', // MT
    pt: 'Inicia sessão com {email}.', // MT
    de: 'Melde dich mit {email} an.', // MT
    fr: 'Connecte-toi avec {email}.', // MT
  },

  // ── Team invite + reminder ──
  team_subject: {
    en: '{inviter} invited you to {team} on {platform}',
    nl: '{inviter} heeft je uitgenodigd voor {team} op {platform}', // MT
    es: '{inviter} te ha invitado a {team} en {platform}', // MT
    pt: '{inviter} convidou-te para {team} no {platform}', // MT
    de: '{inviter} hat dich zu {team} auf {platform} eingeladen', // MT
    fr: '{inviter} t’a invité·e dans {team} sur {platform}', // MT
  },
  team_title: {
    en: "You've been invited",
    nl: 'Je bent uitgenodigd', // MT
    es: 'Te han invitado', // MT
    pt: 'Foste convidado', // MT
    de: 'Du wurdest eingeladen', // MT
    fr: 'Tu as été invité·e', // MT
  },
  team_headline: {
    en: '{inviter} added you to {team}.',
    nl: '{inviter} heeft je toegevoegd aan {team}.', // MT
    es: '{inviter} te ha añadido a {team}.', // MT
    pt: '{inviter} adicionou-te a {team}.', // MT
    de: '{inviter} hat dich zu {team} hinzugefügt.', // MT
    fr: '{inviter} t’a ajouté·e à {team}.', // MT
  },
  team_text_lead: {
    en: '{inviter} invited you to the team "{team}" on {meet}.',
    nl: '{inviter} heeft je uitgenodigd voor het team "{team}" op {meet}.', // MT
    es: '{inviter} te ha invitado al equipo "{team}" en {meet}.', // MT
    pt: '{inviter} convidou-te para a equipa "{team}" no {meet}.', // MT
    de: '{inviter} hat dich in das Team "{team}" auf {meet} eingeladen.', // MT
    fr: '{inviter} t’a invité·e dans l’équipe « {team} » sur {meet}.', // MT
  },
  team_accept_line: {
    en: 'Accept the invite: {url}',
    nl: 'Accepteer de uitnodiging: {url}', // MT
    es: 'Acepta la invitación: {url}', // MT
    pt: 'Aceita o convite: {url}', // MT
    de: 'Einladung annehmen: {url}', // MT
    fr: 'Accepter l’invitation : {url}', // MT
  },
  team_how_text: {
    en: "You'll be asked to sign in with Google (using {email}) and then taken to a page to accept. After accepting you'll start receiving bookings.",
    nl: 'Je wordt gevraagd in te loggen met Google (met {email}) en komt dan op een pagina om te accepteren. Daarna ontvang je boekingen.', // MT
    es: 'Se te pedirá que inicies sesión con Google (con {email}) y luego irás a una página para aceptar. Después de aceptar empezarás a recibir reservas.', // MT
    pt: 'Vais ter de iniciar sessão com o Google (com {email}) e depois serás levado a uma página para aceitar. Depois de aceitares, começas a receber marcações.', // MT
    de: 'Du wirst gebeten, dich mit Google anzumelden (mit {email}), und kommst dann auf eine Seite zum Annehmen. Danach erhältst du Buchungen.', // MT
    fr: 'Tu devras te connecter avec Google (avec {email}), puis tu arriveras sur une page pour accepter. Ensuite, tu commenceras à recevoir des réservations.', // MT
  },
  team_how_html: {
    en: "Open the link below to review and accept. You'll be asked to sign in with Google.",
    nl: 'Open de link hieronder om te bekijken en te accepteren. Je wordt gevraagd in te loggen met Google.', // MT
    es: 'Abre el enlace de abajo para revisar y aceptar. Se te pedirá que inicies sesión con Google.', // MT
    pt: 'Abre a ligação abaixo para rever e aceitar. Vais ter de iniciar sessão com o Google.', // MT
    de: 'Öffne den Link unten, um die Einladung zu prüfen und anzunehmen. Du wirst gebeten, dich mit Google anzumelden.', // MT
    fr: 'Ouvre le lien ci-dessous pour vérifier et accepter. Tu devras te connecter avec Google.', // MT
  },
  team_accept_button: {
    en: 'Accept invite',
    nl: 'Uitnodiging accepteren', // MT
    es: 'Aceptar invitación', // MT
    pt: 'Aceitar convite', // MT
    de: 'Einladung annehmen', // MT
    fr: 'Accepter l’invitation', // MT
  },
  team_google_account: {
    en: 'Use your Google account for {email}.',
    nl: 'Gebruik je Google-account voor {email}.', // MT
    es: 'Usa tu cuenta de Google de {email}.', // MT
    pt: 'Usa a tua conta Google de {email}.', // MT
    de: 'Nutze dein Google-Konto für {email}.', // MT
    fr: 'Utilise ton compte Google pour {email}.', // MT
  },
  team_copy_link: {
    en: 'Or copy this link: {url}',
    nl: 'Of kopieer deze link: {url}', // MT
    es: 'O copia este enlace: {url}', // MT
    pt: 'Ou copia esta ligação: {url}', // MT
    de: 'Oder kopiere diesen Link: {url}', // MT
    fr: 'Ou copie ce lien : {url}', // MT
  },
  team_ignore: {
    en: "If you didn't expect this, just ignore the email.",
    nl: 'Had je dit niet verwacht, negeer deze e-mail dan.', // MT
    es: 'Si no lo esperabas, ignora este correo.', // MT
    pt: 'Se não estavas à espera disto, ignora este email.', // MT
    de: 'Wenn du das nicht erwartet hast, ignoriere diese E-Mail einfach.', // MT
    fr: 'Si tu ne t’y attendais pas, ignore simplement cet e-mail.', // MT
  },
  reminder_subject: {
    en: 'Reminder: accept your invite to {team}',
    nl: 'Herinnering: accepteer je uitnodiging voor {team}', // MT
    es: 'Recordatorio: acepta tu invitación a {team}', // MT
    pt: 'Lembrete: aceita o teu convite para {team}', // MT
    de: 'Erinnerung: nimm deine Einladung zu {team} an', // MT
    fr: 'Rappel : accepte ton invitation dans {team}', // MT
  },
  reminder_title: {
    en: 'Invitation reminder',
    nl: 'Herinnering aan je uitnodiging', // MT
    es: 'Recordatorio de invitación', // MT
    pt: 'Lembrete do convite', // MT
    de: 'Erinnerung an die Einladung', // MT
    fr: 'Rappel d’invitation', // MT
  },
  reminder_body: {
    en: 'Open the link below to accept the invite.',
    nl: 'Open de link hieronder om de uitnodiging te accepteren.', // MT
    es: 'Abre el enlace de abajo para aceptar la invitación.', // MT
    pt: 'Abre a ligação abaixo para aceitar o convite.', // MT
    de: 'Öffne den Link unten, um die Einladung anzunehmen.', // MT
    fr: 'Ouvre le lien ci-dessous pour accepter l’invitation.', // MT
  },
} satisfies Record<string, I18nEntry>;

export type MeetBookingKey = keyof typeof CATALOG;
export const meetT = makeT(CATALOG);
