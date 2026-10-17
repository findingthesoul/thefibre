// Which calendar this person uses, remembered ON THIS DEVICE (Sjoerd,
// 2026-10-17): after picking Google, Outlook or Apple once, a session's
// calendar icon goes straight there, and the subscribe buttons put that one
// first. One key, shared by every calendar control in my.thread.
//
// localStorage, and nothing else: no profile field, no migration. Every read
// and write is guarded — a private window or blocked storage just means the
// menu shows every time, never an error.

export type CalendarChoice = 'google' | 'outlook' | 'apple';

export const CALENDAR_CHOICE_KEY = 'my.calendar.choice';

const CHOICES: readonly CalendarChoice[] = ['google', 'outlook', 'apple'];

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readCalendarChoice(store: StorageLike | null = storage()): CalendarChoice | null {
  try {
    const v = store?.getItem(CALENDAR_CHOICE_KEY);
    return CHOICES.includes(v as CalendarChoice) ? (v as CalendarChoice) : null;
  } catch {
    return null;
  }
}

export function writeCalendarChoice(choice: CalendarChoice, store: StorageLike | null = storage()): void {
  try {
    store?.setItem(CALENDAR_CHOICE_KEY, choice);
  } catch {
    // Blocked: the menu shows next time too. That is all.
  }
}
