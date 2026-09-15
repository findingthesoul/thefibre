// What each tool hands back, decided here and nowhere else.
//
// The API returns what a browser screen needs. An assistant needs less, and
// the difference is the first of the three gates in docs/ai-assistance-plan.md
// §2: "which tools the MCP server exposes" is decided at design time, and so
// is which FIELDS. Every function here is an allow-list. Nothing spreads a
// row through; a new column on the API side reaches an assistant only when
// somebody adds it to a list below, on purpose.
//
// Two lines drawn deliberately, both reversible, both worth deciding rather
// than inheriting:
//
//   NOTE BODIES DO NOT CROSS. A note is what a human observed, in their own
//   words, about a real person. `detect-tags.ts` refuses to send bodies to a
//   model; the same refusal holds here. The timeline says THAT a note was
//   written, when, of what kind, and whether it set a follow-up. Not what it
//   said. If Sjoerd wants bodies in a later phase, it is one field in one
//   list, and a conversation first.
//
//   ENGAGEMENT CONTENT DOES NOT CROSS. The body of a scheduled message is the
//   organiser's, not a participant's, so the reason is different: an
//   assistant asked "what goes out this week" needs titles and times, and a
//   wall of email HTML would drown the answer.
//
// Pure, so every shape is tested.

type Row = Record<string, unknown>;

const s = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const n = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const b = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const one = (v: unknown): Row | null => {
  if (!v || typeof v !== 'object') return null;
  if (Array.isArray(v)) return (v[0] as Row) ?? null;
  return v as Row;
};

export function fullName(p: Row | null | undefined): string | null {
  if (!p) return null;
  const name = [s(p.first_name), s(p.last_name)].filter(Boolean).join(' ').trim();
  return name || s(p.preferred_name) || s(p.email) || null;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export function personSummary(p: Row) {
  return {
    id: s(p.id),
    name: fullName(p),
    email: s(p.email),
    country: s(p.country),
  };
}

/** The card, as the Connections popup shows it (apps/connections/.../load.ts). */
export function personCard(p: Row) {
  return {
    id: s(p.id),
    name: fullName(p),
    first_name: s(p.first_name),
    last_name: s(p.last_name),
    preferred_name: s(p.preferred_name),
    email: s(p.email),
    email_secondary: s(p.email_secondary),
    phone: s(p.phone),
    phone_secondary: s(p.phone_secondary),
    linkedin_url: s(p.linkedin_url),
    city: s(p.city),
    country: s(p.country),
    created_at: s(p.created_at),
  };
}

export function orgMembership(m: Row) {
  const org = one(m.organisation) ?? one(m.org);
  return {
    organisation_id: s(m.org_id) ?? s(m.organisation_id) ?? s(org?.id),
    organisation: s(org?.name),
    role: s(m.role) ?? s(m.title),
    started_at: s(m.started_at),
    ended_at: s(m.ended_at),
  };
}

// ---------------------------------------------------------------------------
// Organisations
// ---------------------------------------------------------------------------

export function organisationSummary(o: Row) {
  return {
    id: s(o.id),
    name: s(o.name),
    short_name: s(o.short_name),
    domain: s(o.domain),
    country: s(o.country),
    sector: s(o.sector),
    org_type: s(o.org_type),
  };
}

export function organisationMember(m: Row) {
  const p = one(m.person);
  return {
    person_id: s(m.person_id) ?? s(p?.id),
    name: fullName(p),
    email: s(p?.email),
    role: s(m.role) ?? s(m.title),
    started_at: s(m.started_at),
    ended_at: s(m.ended_at),
  };
}

// ---------------------------------------------------------------------------
// The timeline: activity + notes (metadata) + flow runs, one list, newest first
// ---------------------------------------------------------------------------

export type TimelineEntry = {
  at: string | null;
  kind: 'activity' | 'note' | 'flow_run';
  /** Activity type, note kind, or the flow's name. */
  type: string | null;
  /** Activity subject, or the flow's current step. Never a note body. */
  subject: string | null;
  app: string | null;
  follow_up_at?: string | null;
  status?: string | null;
};

export function activityEntry(a: Row): TimelineEntry {
  const app = one(a.app);
  return {
    at: s(a.occurred_at),
    kind: 'activity',
    type: s(a.type),
    subject: s(a.subject),
    app: s(app?.name) ?? s(app?.slug) ?? s(a.app_id),
  };
}

/** A note, WITHOUT its body. See the header. */
export function noteEntry(nt: Row): TimelineEntry {
  return {
    at: s(nt.happened_at) ?? s(nt.created_at),
    kind: 'note',
    type: s(nt.kind) ?? 'note',
    subject: null,
    app: 'Connections',
    follow_up_at: s(nt.follow_up_at),
  };
}

export function flowRunEntry(r: Row): TimelineEntry {
  const flow = one(r.flow);
  const step = one(r.step);
  return {
    at: s(r.entered_at),
    kind: 'flow_run',
    type: s(flow?.name),
    subject: s(step?.name) ?? s(step?.key),
    app: 'Flow',
    status: s(r.status),
  };
}

export function mergeTimeline(entries: TimelineEntry[], limit: number): TimelineEntry[] {
  return [...entries]
    .sort((x, y) => (y.at ?? '').localeCompare(x.at ?? ''))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Activity across the workspace
// ---------------------------------------------------------------------------

export function activityRow(a: Row, personName: string | null) {
  const app = one(a.app);
  return {
    id: s(a.id),
    occurred_at: s(a.occurred_at),
    person_id: s(a.person_id),
    person: personName,
    type: s(a.type),
    subject: s(a.subject),
    app: s(app?.name) ?? s(app?.slug) ?? null,
  };
}

// ---------------------------------------------------------------------------
// The Thread
// ---------------------------------------------------------------------------

export function threadSummary(t: Row) {
  const program = one(t.program) ?? {};
  return {
    id: s(t.id),
    program_id: s(t.program_id) ?? s(program.id),
    title: s(t.title) ?? s(program.title),
    format: s(t.format) ?? s(program.format),
    status: s(t.status) ?? s(program.status),
    starts_on: s(t.starts_on) ?? s(program.starts_on),
    ends_on: s(t.ends_on) ?? s(program.ends_on),
    slug: s(t.slug),
    requires_approval: b(t.requires_approval),
    capacity: n(t.capacity),
    price_cents: n(t.price_cents),
    price_currency: s(t.price_currency),
    is_public_listed: b(t.is_public_listed),
  };
}

export function enrolmentRow(e: Row) {
  const p = one(e.person);
  return {
    enrolment_id: s(e.id),
    person_id: s(e.person_id) ?? s(p?.id),
    name: fullName(p),
    email: s(p?.email),
    status: s(e.status),
    progress_pct: n(e.progress_pct),
    enrolled_at: s(e.enrolled_at),
    completed_at: s(e.completed_at),
  };
}

/** Title, type and timing. Never `content`. */
export function engagementRow(g: Row) {
  return {
    id: s(g.id),
    type: s(g.type),
    status: s(g.status),
    title: s(g.title),
    starts_at: s(g.starts_at),
    ends_at: s(g.ends_at),
    scheduled_at: s(g.scheduled_at),
    trigger_kind: s(g.trigger_kind),
    location: s(g.location),
  };
}

// ---------------------------------------------------------------------------
// Flow tasks
// ---------------------------------------------------------------------------

export function taskRow(t: Row) {
  const contact = one(t.contact);
  const run = one(t.run);
  const org = one(run?.organisation);
  return {
    id: s(t.id),
    title: s(t.title),
    status: s(t.status),
    due_at: s(t.due_at),
    assignee_user_id: s(t.assignee_user_id),
    person_id: s(t.contact_id),
    person: fullName(contact),
    about: s(run?.subject_label),
    organisation: s(org?.name),
  };
}
