// The words on a lock screen, in the reader's language (web push,
// docs/web-push-plan.md §8). A push is a TITLE and a link, nothing more: the
// kind of change and the subject the bell row already carries — a title the
// person could already see. The words match my.thread's bell (notif_* in
// apps/my/lib/i18n.ts), so the push and the row it points at agree.
//
// Locale comes from platformEmailLocale, the same resolver the digest email
// uses. es/pt/de/fr are machine-drafted (// MT); nl is native.

import { makeT, type I18nEntry } from '@thefibre/shared';

const CATALOG = {
  push_new_one: {
    en: 'New on the calendar: {subject}',
    nl: 'Nieuw in de agenda: {subject}',
    es: 'Nuevo en el calendario: {subject}', // MT
    pt: 'Novo no calendário: {subject}', // MT
    de: 'Neu im Kalender: {subject}', // MT
    fr: 'Nouveau dans l’agenda : {subject}', // MT
  },
  // Several new threads in one community, after the quiet window.
  push_new_many: {
    en: '{n} new on the calendar · {community}',
    nl: '{n} nieuw in de agenda · {community}',
    es: '{n} nuevos en el calendario · {community}', // MT
    pt: '{n} novos no calendário · {community}', // MT
    de: '{n} neu im Kalender · {community}', // MT
    fr: '{n} nouveautés dans l’agenda · {community}', // MT
  },
  push_session_added: {
    en: 'New session: {subject}',
    nl: 'Nieuwe sessie: {subject}',
    es: 'Nueva sesión: {subject}', // MT
    pt: 'Nova sessão: {subject}', // MT
    de: 'Neue Sitzung: {subject}', // MT
    fr: 'Nouvelle séance : {subject}', // MT
  },
  push_session_moved: {
    en: 'Moved: {subject}',
    nl: 'Verplaatst: {subject}',
    es: 'Cambiada de fecha: {subject}', // MT
    pt: 'Remarcada: {subject}', // MT
    de: 'Verschoben: {subject}', // MT
    fr: 'Déplacée : {subject}', // MT
  },
  push_session_cancelled: {
    en: 'Cancelled: {subject}',
    nl: 'Geannuleerd: {subject}',
    es: 'Cancelada: {subject}', // MT
    pt: 'Cancelada: {subject}', // MT
    de: 'Abgesagt: {subject}', // MT
    fr: 'Annulée : {subject}', // MT
  },
  // Appended when one push stands for several changes of one kind.
  push_and_more: {
    en: '{title} (+{n} more)',
    nl: '{title} (+{n} meer)',
    es: '{title} (+{n} más)', // MT
    pt: '{title} (+{n} mais)', // MT
    de: '{title} (+{n} weitere)', // MT
    fr: '{title} (+{n} autres)', // MT
  },
} satisfies Record<string, I18nEntry>;

export const pushT = makeT(CATALOG);
export { CATALOG as PUSH_CATALOG };
