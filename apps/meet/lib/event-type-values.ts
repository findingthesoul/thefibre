// The event-type VALUES, in a module with no 'use client'.
//
// This exists because of a crash. `components/event-type-picker.tsx` is a
// client module, and in the App Router every export of a 'use client' file
// becomes a client REFERENCE when a server component imports it — not the
// array. So `EVENT_TYPES.some(...)` inside a server page throws at render,
// and /meeting-types/new answered "Application error: a server-side exception
// has occurred" on production (2026-09-29). It typechecked, it built, and it
// failed only when the page was actually rendered.
//
// The picker keeps the presentation — icon, labels, grouping — because that
// is client business. The bare list of values lives here, where a server
// component can read it, and `meet-event-types.test.ts` asserts the two
// agree with each other and with the API's zod enum.

export const EVENT_TYPE_VALUES = [
  'one_on_one',
  'group',
  'round_robin',
  'collective',
  'one_off',
  'poll',
] as const;

export type EventTypeValue = (typeof EVENT_TYPE_VALUES)[number];

export function isEventTypeValue(v: string | undefined | null): v is EventTypeValue {
  return !!v && (EVENT_TYPE_VALUES as readonly string[]).includes(v);
}
