// What the in-app assistant can do in The Thread, and — more importantly —
// what it is allowed to SEE.
//
// docs/assistant-in-app.md §2. Every tool here runs as the signed-in user, by
// calling this API's own user-facing Thread routes with the user's JWT, so RLS
// and every validator apply exactly as they do to a click in the interface.
// The assistant has no authority the person does not already have.
//
// THE ALLOW-LIST. Whatever a tool returns is what leaves the EU API for the
// model provider. That makes the SHAPE of a result a data-protection decision,
// not a convenience, so results are built field by field here and never passed
// through: titles, slugs, dates, statuses, counts and ids. Never a participant's
// name, email, phone, answers or billing; never a note body; never the activity
// log. A tool that needs personal data to work is not a v1 tool — see the doc
// for the open sub-processor decision that would have to come first.

import type Anthropic from '@anthropic-ai/sdk';

export type ToolKind = 'read' | 'write';

/** What the API needs to act as the user: their JWT. Nothing else. */
export interface ActorAuth {
  jwt: string;
}

export interface AssistantTool {
  name: string;
  kind: ToolKind;
  /** One line shown in the UI when the tool runs / is proposed. */
  label: (input: Record<string, unknown>) => string;
  definition: Anthropic.Beta.BetaTool;
  run: (auth: ActorAuth, input: Record<string, unknown>) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Self-call: the API calling its own routes as the user.
// ---------------------------------------------------------------------------
const APP_ID = 'the-thread';

function apiBase(): string {
  return process.env.ASSISTANT_API_BASE ?? `http://127.0.0.1:${process.env.API_PORT ?? 8080}`;
}

export class ToolCallError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`tool call → ${status}`);
  }
}

async function callApi<T = unknown>(
  auth: ActorAuth,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${auth.jwt}`,
    'x-app-id': APP_ID,
    accept: 'application/json',
  };
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${apiBase()}${path}`, init);
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) throw new ToolCallError(res.status, parsed);
  return parsed as T;
}

// ---------------------------------------------------------------------------
// Shapes — the allow-list, as code.
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : null);
const bool = (v: unknown) => (typeof v === 'boolean' ? v : null);
const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Rich text → a short plain-text excerpt. The intention is the organiser's own
 *  public copy, not personal data, but there is no reason to ship 2000 chars of
 *  HTML for every thread in a list. */
function excerpt(html: unknown, max = 400): string | null {
  const s = str(html);
  if (!s) return null;
  const plain = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

function shapeThread(t: Row, withDetail: boolean): Row {
  const program = one(t.program as Row | Row[] | null);
  const team = one(t.team as Row | Row[] | null);
  const cats = Array.isArray(t.categories)
    ? (t.categories as Row[]).map((c) => str(one(c.category as Row | Row[] | null)?.name)).filter(Boolean)
    : [];
  const base: Row = {
    id: t.id,
    title: program?.title ?? null,
    slug: t.slug,
    format: program?.format ?? null,
    status: program?.status ?? null,
    starts_on: program?.starts_on ?? null,
    ends_on: program?.ends_on ?? null,
    is_public_listed: bool(t.is_public_listed),
    requires_approval: bool(t.requires_approval),
    capacity: num(t.capacity),
    price_cents: num(t.price_cents),
    price_currency: str(t.price_currency),
    team: team?.name ?? null,
    categories: cats,
    locked: !!t.locked_at,
  };
  if (!withDetail) return base;
  return {
    ...base,
    intention_excerpt: excerpt(t.intention),
    timezone: str(t.timezone),
    language: str(t.language),
    public_interaction: str(t.public_interaction),
    payment_methods: Array.isArray(t.payment_methods) ? t.payment_methods : null,
    share_participants_public: bool(t.share_participants_public),
    share_participants_participants: bool(t.share_participants_participants),
    certificate_enabled: bool(t.certificate_enabled),
    registration_field_count: Array.isArray(t.registration_fields) ? t.registration_fields.length : 0,
  };
}

function shapeTemplate(t: Row): Row {
  const st = (t.structure ?? {}) as Row;
  const engagements = Array.isArray(st.engagements) ? (st.engagements as Row[]) : [];
  return {
    id: t.id,
    title: t.title,
    scope: t.scope,
    format: str(st.format),
    duration_days: num(st.duration_days),
    engagement_count: engagements.length,
    engagement_types: [...new Set(engagements.map((e) => str(e.type)).filter(Boolean))],
    requires_approval: bool(st.requires_approval),
    price_cents: num(st.price_cents),
    price_currency: str(st.price_currency),
  };
}

function count<T>(rows: T[], key: (r: T) => string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r) ?? 'unknown';
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The tools.
// ---------------------------------------------------------------------------
const uuid = { type: 'string', description: 'A uuid' } as const;
const dateOnly = { type: ['string', 'null'], description: 'YYYY-MM-DD, or null' } as const;

function def(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): Anthropic.Beta.BetaTool {
  return {
    name,
    description,
    strict: true,
    input_schema: { type: 'object', properties, required, additionalProperties: false },
  };
}

export const THREAD_TOOLS: AssistantTool[] = [
  {
    name: 'list_threads',
    kind: 'read',
    label: () => 'Looked at your threads',
    definition: def(
      'list_threads',
      "The organiser's threads (events and journeys) in this workspace: title, slug, status, dates, listing, capacity and price. No participant data.",
      {},
    ),
    run: async (auth) => {
      const r = await callApi<{ items: Row[] }>(auth, 'GET', '/api/v1/thread/threads');
      return { threads: (r.items ?? []).map((t) => shapeThread(t, false)) };
    },
  },
  {
    name: 'get_thread',
    kind: 'read',
    label: () => 'Read a thread',
    definition: def('get_thread', 'One thread in detail: its settings and a short excerpt of its intention.', {
      thread_id: uuid,
    }, ['thread_id']),
    run: async (auth, input) => {
      const t = await callApi<Row>(auth, 'GET', `/api/v1/thread/threads/${encodeURIComponent(String(input.thread_id))}`);
      return shapeThread(t, true);
    },
  },
  {
    name: 'list_templates',
    kind: 'read',
    label: () => 'Looked at your templates',
    definition: def(
      'list_templates',
      'The thread templates this organiser can build from: title, scope, format, duration, and what kind of engagements they lay down.',
      {},
    ),
    run: async (auth) => {
      const r = await callApi<{ items: Row[] }>(auth, 'GET', '/api/v1/thread/thread-templates');
      return { templates: (r.items ?? []).map(shapeTemplate) };
    },
  },
  {
    name: 'enrolment_summary',
    kind: 'read',
    label: () => 'Counted registrations',
    definition: def(
      'enrolment_summary',
      'How registration stands on one thread, as COUNTS only: total, by status, by payment state, checked in, waiting for approval. Never who — names and emails stay in The Thread.',
      { thread_id: uuid },
      ['thread_id'],
    ),
    run: async (auth, input) => {
      const id = encodeURIComponent(String(input.thread_id));
      const r = await callApi<{ items: Row[] }>(auth, 'GET', `/api/v1/thread/enrolments?thread_id=${id}`);
      const rows = r.items ?? [];
      const enrol = (x: Row) => one(x.enrolment as Row | Row[] | null);
      return {
        thread_id: input.thread_id,
        total: rows.length,
        by_status: count(rows, (x) => str(enrol(x)?.status)),
        by_payment_status: count(rows, (x) => str(x.payment_status)),
        checked_in: rows.filter((x) => !!x.checked_in_at).length,
        awaiting_approval: rows.filter((x) => str(enrol(x)?.status) === 'invited' && str(x.payment_status) !== 'pending').length,
        completed: rows.filter((x) => !!enrol(x)?.completed_at).length,
      };
    },
  },
  {
    name: 'create_thread_from_template',
    kind: 'write',
    label: (i) => `Create "${String(i.title ?? '')}" from a template`,
    definition: def(
      'create_thread_from_template',
      "Create a new thread from one of the organiser's templates: the template's structure and engagements are laid down and its dates rebased onto starts_on. The thread starts as a draft; nothing is public until it is activated. Always confirm the template, title and start date with the person before calling this. The slug must be lowercase kebab-case and unique for this organiser.",
      {
        template_id: uuid,
        title: { type: 'string', description: 'The thread title, 1–200 characters' },
        slug: { type: 'string', description: 'lowercase-kebab-case, 2–80 characters' },
        starts_on: dateOnly,
      },
      ['template_id', 'title', 'slug', 'starts_on'],
    ),
    run: async (auth, input) => {
      const id = encodeURIComponent(String(input.template_id));
      const t = await callApi<Row>(auth, 'POST', `/api/v1/thread/thread-templates/${id}/instantiate`, {
        title: input.title,
        slug: input.slug,
        starts_on: input.starts_on ?? null,
      });
      return { created: true, thread_id: t.id, slug: input.slug, title: input.title, status: 'draft', open_path: `/threads/${String(t.id)}` };
    },
  },
  {
    name: 'create_thread',
    kind: 'write',
    label: (i) => `Create "${String(i.title ?? '')}"`,
    definition: def(
      'create_thread',
      'Create a new, empty thread (no template). It starts as a draft. Confirm title, format and dates with the person first. Prefer create_thread_from_template when a template fits.',
      {
        title: { type: 'string' },
        format: { type: 'string', enum: ['event', 'journey'] },
        slug: { type: 'string', description: 'lowercase-kebab-case, 2–80 characters' },
        starts_on: dateOnly,
        ends_on: dateOnly,
        intention: { type: ['string', 'null'], description: 'A short intention in plain words, or null' },
      },
      ['title', 'format', 'slug', 'starts_on', 'ends_on', 'intention'],
    ),
    run: async (auth, input) => {
      const t = await callApi<Row>(auth, 'POST', '/api/v1/thread/threads', {
        title: input.title,
        format: input.format,
        slug: input.slug,
        starts_on: input.starts_on ?? null,
        ends_on: input.ends_on ?? null,
        intention: input.intention ?? null,
      });
      return { created: true, thread_id: t.id, slug: input.slug, title: input.title, status: 'draft', open_path: `/threads/${String(t.id)}` };
    },
  },
  {
    name: 'update_thread',
    kind: 'write',
    label: (i) => {
      const keys = Object.keys(i).filter((k) => k !== 'thread_id' && i[k] !== null && i[k] !== undefined);
      return keys.includes('status') ? `Set the thread to ${String(i.status)}` : `Change ${keys.join(', ') || 'the thread'}`;
    },
    definition: def(
      'update_thread',
      'Change a thread: title, dates, status (draft → active makes the page live AND opens registration; completed; archived), public listing, approval requirement, capacity, price. Pass null for fields you are not changing. Money destinations, tickets, certificates and registration fields cannot be changed from here.',
      {
        thread_id: uuid,
        title: { type: ['string', 'null'] },
        // No `enum` next to a two-type array: Anthropic's strict validator
        // rejects "Enum value 'draft' does not match declared type
        // ['string','null']" (found on staging 2026-09-16, first live turn).
        // The values are in the description; the route's zod enum is the
        // check that matters, and a wrong one comes back as a 400 the model
        // can read.
        status: { type: ['string', 'null'], description: 'draft | active | completed | archived, or null to leave it' },
        starts_on: dateOnly,
        ends_on: dateOnly,
        is_public_listed: { type: ['boolean', 'null'] },
        requires_approval: { type: ['boolean', 'null'] },
        capacity: { type: ['integer', 'null'], description: 'A positive number, or null for no limit' },
        price_cents: { type: ['integer', 'null'], description: 'Whole cents; null = free' },
        price_currency: { type: ['string', 'null'], description: 'Three-letter code, e.g. EUR' },
        intention: { type: ['string', 'null'] },
      },
      [
        'thread_id', 'title', 'status', 'starts_on', 'ends_on', 'is_public_listed',
        'requires_approval', 'capacity', 'price_cents', 'price_currency', 'intention',
      ],
    ),
    run: async (auth, input) => {
      const { thread_id, ...rest } = input;
      const patch: Row = {};
      for (const [k, v] of Object.entries(rest)) if (v !== null && v !== undefined) patch[k] = v;
      // capacity: null means "no limit" in the API but "not changing" here. To
      // clear a capacity the person does it in the editor; the tool never
      // sends an explicit null for anything.
      const t = await callApi<Row>(auth, 'PATCH', `/api/v1/thread/threads/${encodeURIComponent(String(thread_id))}`, patch);
      return { updated: Object.keys(patch), ...shapeThread(t, false) };
    },
  },

  // -------------------------------------------------------------------------
  // The timeline — engagements on a thread (Sjoerd, 2026-09-16: "expand the
  // reach"). Agenda items (event, conversation, workshop) and messages
  // (reflection, practice, message, document, inspiration) plus certificate.
  // A message-family item EMAILS everyone enrolled once the thread is active,
  // which is why every write here still goes through the approval card. What
  // reaches the model is the item's shape — type, title, timing, trigger —
  // never the message body.
  // -------------------------------------------------------------------------
  {
    name: 'list_engagements',
    kind: 'read',
    label: () => 'Looked at the timeline',
    definition: def(
      'list_engagements',
      "The engagements on one thread, in timeline order: agenda items with their timing and place, messages with their send trigger. Type, title, status and timing only — not the message text.",
      { thread_id: uuid },
      ['thread_id'],
    ),
    run: async (auth, input) => {
      const t = await callApi<Row>(auth, 'GET', `/api/v1/thread/threads/${encodeURIComponent(String(input.thread_id))}`);
      const rows = Array.isArray(t.engagements) ? (t.engagements as Row[]) : [];
      return { thread_id: input.thread_id, engagements: rows.map(shapeEngagement) };
    },
  },
  {
    name: 'add_engagement',
    kind: 'write',
    label: (i) => `Add “${String(i.title ?? '')}” to the timeline`,
    definition: def(
      'add_engagement',
      'Add one engagement to a thread. Agenda types (event, conversation, workshop) need starts_at/ends_at inside the thread dates. Message types (reflection, practice, message, document, inspiration) are emails to everyone enrolled, sent on a trigger: on_enrolment, on_approval, on_completion, fixed (scheduled_at) or relative (trigger_anchor start|end plus trigger_offset_days and trigger_time). Say what will be sent and when before proposing a message. Pass null for fields that do not apply. The message text itself is written in the editor, not here.',
      {
        thread_id: uuid,
        title: { type: 'string', description: '1–200 characters' },
        type: { type: 'string', enum: ['event', 'conversation', 'workshop', 'reflection', 'practice', 'message', 'document', 'inspiration'] },
        description: { type: ['string', 'null'], description: 'Short plain text, or null' },
        starts_at: { type: ['string', 'null'], description: 'ISO 8601 with offset, agenda items only' },
        ends_at: { type: ['string', 'null'], description: 'ISO 8601 with offset, agenda items only' },
        location: { type: ['string', 'null'] },
        trigger_kind: { type: ['string', 'null'], description: 'fixed | on_enrolment | on_approval | on_completion | relative — messages only' },
        trigger_anchor: { type: ['string', 'null'], description: 'start | end — with trigger_kind relative' },
        trigger_offset_days: { type: ['integer', 'null'], description: 'Days before (negative) or after (positive) the anchor' },
        trigger_time: { type: ['string', 'null'], description: 'HH:MM' },
        scheduled_at: { type: ['string', 'null'], description: 'ISO 8601 with offset — with trigger_kind fixed' },
      },
      ['thread_id', 'title', 'type', 'description', 'starts_at', 'ends_at', 'location', 'trigger_kind', 'trigger_anchor', 'trigger_offset_days', 'trigger_time', 'scheduled_at'],
    ),
    run: async (auth, input) => {
      const { thread_id, ...rest } = input;
      const body: Row = {};
      for (const [k, v] of Object.entries(rest)) if (v !== null && v !== undefined) body[k] = v;
      const e = await callApi<Row>(auth, 'POST', `/api/v1/thread/threads/${encodeURIComponent(String(thread_id))}/engagements`, body);
      return { created: true, ...shapeEngagement(e) };
    },
  },
  {
    name: 'update_engagement',
    kind: 'write',
    label: (i) => {
      const keys = Object.keys(i).filter((k) => k !== 'engagement_id' && i[k] !== null && i[k] !== undefined);
      return `Change ${keys.join(', ') || 'an engagement'} on the timeline`;
    },
    definition: def(
      'update_engagement',
      'Change an engagement: title, timing, place, trigger, or publish/unpublish it (status draft|published). Pass null for fields you are not changing. Use list_engagements first to get the id.',
      {
        engagement_id: uuid,
        title: { type: ['string', 'null'] },
        status: { type: ['string', 'null'], description: 'draft | published' },
        description: { type: ['string', 'null'] },
        starts_at: { type: ['string', 'null'] },
        ends_at: { type: ['string', 'null'] },
        location: { type: ['string', 'null'] },
        trigger_kind: { type: ['string', 'null'], description: 'fixed | on_enrolment | on_approval | on_completion | relative' },
        trigger_anchor: { type: ['string', 'null'], description: 'start | end' },
        trigger_offset_days: { type: ['integer', 'null'] },
        trigger_time: { type: ['string', 'null'], description: 'HH:MM' },
        scheduled_at: { type: ['string', 'null'] },
      },
      ['engagement_id', 'title', 'status', 'description', 'starts_at', 'ends_at', 'location', 'trigger_kind', 'trigger_anchor', 'trigger_offset_days', 'trigger_time', 'scheduled_at'],
    ),
    run: async (auth, input) => {
      const { engagement_id, ...rest } = input;
      const patch: Row = {};
      for (const [k, v] of Object.entries(rest)) if (v !== null && v !== undefined) patch[k] = v;
      const e = await callApi<Row>(auth, 'PATCH', `/api/v1/thread/engagements/${encodeURIComponent(String(engagement_id))}`, patch);
      return { updated: Object.keys(patch), ...shapeEngagement(e) };
    },
  },
  {
    name: 'delete_engagement',
    kind: 'write',
    label: (i) => `Delete “${String(i.title ?? 'an engagement')}” from the timeline`,
    definition: def(
      'delete_engagement',
      'Remove an engagement from a thread. Pass its title too, so the person sees what they are approving. A message that has already gone out cannot be unsent; a draft thread has sent nothing.',
      { engagement_id: uuid, title: { type: 'string', description: 'The engagement title, for the confirmation card' } },
      ['engagement_id', 'title'],
    ),
    run: async (auth, input) => {
      await callApi(auth, 'DELETE', `/api/v1/thread/engagements/${encodeURIComponent(String(input.engagement_id))}`);
      return { deleted: true, engagement_id: input.engagement_id, title: input.title };
    },
  },
];

function shapeEngagement(e: Row): Row {
  return {
    id: e.id,
    type: str(e.type),
    title: str(e.title),
    status: str(e.status),
    position: num(e.position),
    starts_at: str(e.starts_at),
    ends_at: str(e.ends_at),
    location: str(e.location),
    show_in_agenda: bool(e.show_in_agenda),
    trigger_kind: str(e.trigger_kind),
    trigger_anchor: str(e.trigger_anchor),
    trigger_offset_days: num(e.trigger_offset_days),
    trigger_time: str(e.trigger_time),
    scheduled_at: str(e.scheduled_at),
    description_excerpt: excerpt(e.description, 160),
  };
}

export const TOOLS_BY_NAME = new Map(THREAD_TOOLS.map((t) => [t.name, t]));

/** A tool result the model can read. Errors are text, never thrown. */
export async function runTool(tool: AssistantTool, auth: ActorAuth, input: Record<string, unknown>): Promise<{ ok: boolean; content: string }> {
  try {
    const out = await tool.run(auth, input);
    return { ok: true, content: JSON.stringify(out) };
  } catch (e) {
    if (e instanceof ToolCallError) {
      const body = typeof e.body === 'string' ? e.body : JSON.stringify(e.body);
      return { ok: false, content: `The Thread answered ${e.status}: ${body}` };
    }
    return { ok: false, content: `Failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
