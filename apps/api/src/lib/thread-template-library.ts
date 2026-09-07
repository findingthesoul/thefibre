// The STANDARD event templates (Sjoerd 2026-09-08: "just 5 variations of
// events… people can edit the settings of these elements — a one-day event
// can become a two-day event in the settings — but not separate items").
//
// Platform-owned, code-defined (like plan feature keys: adding one is a
// deploy, not a migration) — distinct from workspace-saved thread_template
// rows, which stay the Pro+ custom layer. The enrolment confirmation is NOT
// an element here: every thread gets the system messages via
// ensureSystemEngagements. Element TITLES/BODIES are seeded content the
// organiser edits (EN seed; the organiser writes their audience's language).
//
// Plan gating (build-plan 1e): thread_template_limit slices how many of
// these a workspace may use (Free 1 / Starter 5 / Pro+ all); adding or
// removing timeline elements needs thread_custom_templates (Pro+) — Free
// configures what the template gave, which is the whole design.

export type LibraryElement = {
  /** Blueprint-local key — messages anchor to activities by this. */
  key: string;
  type: 'event' | 'conversation' | 'workshop' | 'reflection' | 'practice' | 'message' | 'document' | 'inspiration';
  title: string;
  description?: string;
  /** Multi-day activities: how many daily_schedule rows to seed. */
  days?: number;
  /** Message trigger; omitted = draft, organiser schedules it. */
  trigger?:
    | { kind: 'on_enrolment' }
    | { kind: 'on_completion' }
    | { kind: 'relative'; anchor: string; offsetDays: number; time?: string };
};

export type LibraryTemplate = {
  /** Stable id — the app's catalogs carry the ×6 names/descriptions. */
  id: string;
  elements: LibraryElement[];
};

export const TEMPLATE_LIBRARY: LibraryTemplate[] = [
  {
    // 1 — the simplest possible: one event, one thank-you.
    id: 'single-event',
    elements: [
      { key: 'event', type: 'event', title: 'The event' },
      {
        key: 'thanks',
        type: 'message',
        title: 'Thank you',
        description: 'A warm word the day after.',
        trigger: { kind: 'relative', anchor: 'event', offsetDays: 1, time: '10:00' },
      },
    ],
  },
  {
    // 2 — the two-day gathering: ONE event element spanning two days
    // (settings turn it into one day or three — no new items needed).
    id: 'two-day-event',
    elements: [
      { key: 'event', type: 'event', title: 'The gathering', days: 2 },
      {
        key: 'thanks',
        type: 'message',
        title: 'Thank you',
        trigger: { kind: 'relative', anchor: 'event', offsetDays: 1, time: '10:00' },
      },
    ],
  },
  {
    // 3 — the guided event: welcomed in, prepared, followed up.
    id: 'guided-event',
    elements: [
      {
        key: 'welcome',
        type: 'message',
        title: 'Welcome',
        description: 'Sent the moment someone enrols.',
        trigger: { kind: 'on_enrolment' },
      },
      {
        key: 'prepare',
        type: 'message',
        title: 'Getting ready',
        description: 'Practical details, the day before.',
        trigger: { kind: 'relative', anchor: 'event', offsetDays: -1, time: '09:00' },
      },
      { key: 'event', type: 'event', title: 'The event' },
      {
        key: 'reflect',
        type: 'reflection',
        title: 'Looking back',
        trigger: { kind: 'relative', anchor: 'event', offsetDays: 1, time: '17:00' },
      },
      {
        key: 'thanks',
        type: 'message',
        title: 'Thank you',
        trigger: { kind: 'relative', anchor: 'event', offsetDays: 3, time: '10:00' },
      },
    ],
  },
  {
    // 4 — the workshop series: three sessions with practice in between,
    // closed by a completion message.
    id: 'workshop-series',
    elements: [
      {
        key: 'welcome',
        type: 'message',
        title: 'Welcome to the series',
        trigger: { kind: 'on_enrolment' },
      },
      { key: 's1', type: 'workshop', title: 'Session 1' },
      {
        key: 'practice1',
        type: 'practice',
        title: 'Practice between sessions',
        trigger: { kind: 'relative', anchor: 's1', offsetDays: 2, time: '09:00' },
      },
      { key: 's2', type: 'workshop', title: 'Session 2' },
      { key: 's3', type: 'workshop', title: 'Session 3' },
      {
        key: 'complete',
        type: 'message',
        title: 'You made it',
        trigger: { kind: 'on_completion' },
      },
    ],
  },
  {
    // 5 — the conversation circle: light, online, reminded and fed after.
    id: 'conversation-circle',
    elements: [
      {
        key: 'remind',
        type: 'message',
        title: 'See you tomorrow',
        trigger: { kind: 'relative', anchor: 'circle', offsetDays: -1, time: '10:00' },
      },
      { key: 'circle', type: 'conversation', title: 'The circle' },
      {
        key: 'feed',
        type: 'inspiration',
        title: 'To keep thinking about',
        trigger: { kind: 'relative', anchor: 'circle', offsetDays: 1, time: '10:00' },
      },
    ],
  },
];

/** The templates a plan may use: the first N of the library (null = all). */
export function templatesForLimit(limit: number | null): LibraryTemplate[] {
  return limit == null ? TEMPLATE_LIBRARY : TEMPLATE_LIBRARY.slice(0, Math.max(0, limit));
}
