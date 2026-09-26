// The Fibre as tools for a PERSON's own assistant — docs/mcp-personal-access-plan.md.
//
// The other catalogue in this package (tools.ts) acts as an APP with an app
// key. This one acts as a person: every call goes to the API's ordinary
// user routes with the person's own JWT and the X-App-ID of the app that
// owns the route, so RLS and every validator apply exactly as they do to a
// click in the browser. The tools reach nothing the person could not see in
// the app — and, unlike the in-app assistant, they may return names and
// notes, because the data goes to the person's own assistant on the
// person's own instruction, not to a model the platform pays for.
//
// Which tools are offered follows the grant's scopes (reads only in phase 1).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { registerSchedulePrompt, registerModelPrompt } from './person-prompt.js';
import { MODEL_SCHEMA_GUIDE } from '@thefibre/shared/business-models';

export { SCHEDULE_PROMPT_NAME, schedulePromptText } from './person-prompt.js';

export type PersonScope = 'connections:read' | 'thread:read' | 'thread:write' | 'models:read' | 'models:write';

export interface PersonClientOptions {
  apiUrl: string;
  /** The person's own Supabase JWT, minted for this call by the API. */
  jwt: string;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

export class PersonApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: unknown,
  ) {
    super(`${method} ${path} → ${status}`);
  }
  describe(): string {
    const detail = typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
    if (this.status === 403) return `Not allowed (403) — this needs an app you do not have in this workspace, or a role you do not hold.\n${detail}`;
    if (this.status === 404) return `Not found (404).\n${detail}`;
    return `The Fibre answered ${this.status}.\n${detail}`;
  }
}

/** One call to the API as the person. `appId` is the app that owns the route. */
export class PersonClient {
  private readonly apiUrl: string;
  private readonly jwt: string;
  private readonly fetchImpl: NonNullable<PersonClientOptions['fetch']>;
  constructor(opts: PersonClientOptions) {
    this.apiUrl = opts.apiUrl.replace(/\/+$/, '');
    this.jwt = opts.jwt;
    this.fetchImpl = opts.fetch ?? ((i, init) => fetch(i, init));
  }
  get<T = unknown>(appId: string, path: string, query?: Record<string, string | number | undefined | null>): Promise<T> {
    return this.request<T>('GET', appId, path, { query });
  }
  /** A write, as the person. The route's own validators and plan gates decide. */
  post<T = unknown>(appId: string, path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', appId, path, { body });
  }
  patch<T = unknown>(appId: string, path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', appId, path, { body });
  }
  put<T = unknown>(appId: string, path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', appId, path, { body });
  }
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT',
    appId: string,
    path: string,
    opts: { query?: Record<string, string | number | undefined | null>; body?: unknown },
  ): Promise<T> {
    let url = this.apiUrl + path;
    if (opts.query) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.query)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      const s = qs.toString();
      if (s) url += `?${s}`;
    }
    const headers: Record<string, string> = { authorization: `Bearer ${this.jwt}`, 'x-app-id': appId, accept: 'application/json' };
    const init: RequestInit = { method, headers };
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    const res = await this.fetchImpl(url, init);
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) throw new PersonApiError(res.status, method, path, parsed);
    return parsed as T;
  }
}

// ---------------------------------------------------------------------------
// The catalogue.
// ---------------------------------------------------------------------------
const CONNECTIONS = 'fibre-sales';
const THREAD = 'the-thread';
const PLATFORM = 'fibre-platform';
const MODELS = 'fibre-models';

type Shape = Record<string, z.ZodTypeAny>;
export interface PersonTool<S extends Shape = Shape> {
  name: string;
  title: string;
  description: string;
  scope: PersonScope;
  /** A write. MCP has no approval card of its own: the client asks the
   *  person before a non-read-only tool, and the description says plainly
   *  what will be created. Idempotency is the route's (slug uniqueness). */
  write?: boolean;
  /** Answers from the catalogue itself, no API call (a schema, a guide). */
  local?: boolean;
  input: S;
  run: (client: PersonClient, args: z.infer<z.ZodObject<S>>) => Promise<unknown>;
}
function tool<S extends Shape>(t: PersonTool<S>): PersonTool<Shape> {
  return t as unknown as PersonTool<Shape>;
}

type Row = Record<string, unknown>;
const uuid = z.string().uuid();

/** Keep a list to a sane size for a model, saying so when it was cut. */
function cap<T>(rows: T[] | undefined | null, n: number): { items: T[]; total: number; truncated: boolean } {
  const all = rows ?? [];
  return { items: all.slice(0, n), total: all.length, truncated: all.length > n };
}

function count<T>(rows: T[], key: (r: T) => string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r) ?? 'unknown';
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const str = (v: unknown) => (typeof v === 'string' ? v : null);

// --- Business Models: the security checks before a write ---------------------
// Sjoerd: "make sure when talking to the system, that it always checks if it
// is clear which and where and it does not change the wrong models." So every
// write names the model and the team it means, in words, and the tool reads
// them back and compares before touching anything. A stale id, a guess, or a
// mix-up between two similar names is refused with the real name in the
// answer, and nothing is written.
const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
const WRITE_RULE =
  'Security check, every time: before calling, tell the person which model (its name and its team) and what will change, and wait for their yes. If their words could match more than one model, ask; never guess. Pass model_name exactly as shown to them: the tool reads the model back and refuses when the name does not match, so a wrong id never changes another model.';

async function checkModel(c: PersonClient, modelId: string, expected: string): Promise<{ row: Row; team: Row | null }> {
  const row = await c.get<Row>(MODELS, `/api/v1/models/${modelId}`);
  const team = one(row.team as Row | Row[] | null);
  const actual = str(row.name) ?? '';
  if (norm(actual) !== norm(expected)) {
    throw new Error(
      `Refused, nothing changed: model ${modelId} is called "${actual}" (${team ? `team ${String(team.name)}` : 'whole workspace'}), not "${expected}". Look at models_list, tell the person which model you mean by name and team, and pass that name.`,
    );
  }
  return { row, team };
}

/** The team a model goes into, checked by name: null with "workspace" for a
 *  workspace-wide model (admins only), otherwise a team from models_teams. */
async function checkTeam(c: PersonClient, teamId: string | null, expected: string): Promise<{ id: string | null; name: string }> {
  const r = await c.get<{ items: Row[]; is_admin?: boolean }>(MODELS, '/api/v1/models/teams');
  if (teamId === null) {
    if (!['workspace', 'whole workspace', 'workspace wide', 'workspace-wide'].includes(norm(expected))) {
      throw new Error(`Refused, nothing changed: team_id null means the whole workspace, but team_name says "${expected}". Pick the team's id from models_teams, or say "workspace" if the person wants everyone with the app to see it.`);
    }
    if (r.is_admin !== true) throw new Error('Refused, nothing changed: only a workspace admin may put a model on the whole workspace. Choose one of the teams from models_teams.');
    return { id: null, name: 'workspace' };
  }
  const team = (r.items ?? []).find((t) => t.id === teamId);
  if (!team) throw new Error(`Refused, nothing changed: team ${teamId} is not one the person may put a model in. models_teams lists the ones that are.`);
  const name = str(team.name) ?? '';
  if (norm(name) !== norm(expected)) {
    throw new Error(`Refused, nothing changed: team ${teamId} is called "${name}", not "${expected}". Confirm the team with the person by name and pass that name.`);
  }
  return { id: teamId, name };
}

/** A second model with the same name in the same place is almost always a
 *  mistake (the person meant "change it", or the assistant lost track). */
async function checkNameFree(c: PersonClient, teamId: string | null, name: string): Promise<void> {
  const r = await c.get<{ items: Row[] }>(MODELS, '/api/v1/models');
  const clash = (r.items ?? []).find((m) => norm(str(m.name) ?? '') === norm(name) && ((one(m.team as Row | Row[] | null)?.id ?? null) === teamId));
  if (clash) {
    throw new Error(
      `Refused, nothing changed: a model called "${String(clash.name)}" already exists ${teamId ? 'in that team' : 'on the whole workspace'} (id ${String(clash.id)}). To change it, use models_update or models_set_numbers with that id. To make a variation, use models_duplicate. If the person really wants a second one with the same name, pass allow_same_name: true.`,
    );
  }
}


export const PERSON_TOOLS: PersonTool[] = [
  // --- Connect (the app; slug fibre-sales; scope connections:read stays) ---------------------------------------------------------
  tool({
    name: 'connections_today',
    title: 'Who is waiting for you',
    description:
      'Your Connect "Today": the follow-ups you owe, the meetings to prepare for, and how much of the chosen horizon (today, tomorrow, this week, next week) is already spoken for. Start here when asked "who should I follow up with".',
    scope: 'connections:read',
    input: { horizon: z.enum(['today', 'tomorrow', 'week', 'next_week']).optional().describe('Defaults to today') },
    run: (c, a) => c.get(CONNECTIONS, '/api/v1/connections/today', { horizon: a.horizon }),
  }),
  tool({
    name: 'connections_attention',
    title: 'Who needs attention',
    description:
      'The people your Connect flags: going quiet, a promise overdue, a deal rotting, and the other attention conditions — each with why. Up to the limit you ask for.',
    scope: 'connections:read',
    input: { limit: z.number().int().min(1).max(100).optional() },
    run: async (c, a) => {
      const r = await c.get<Row>(CONNECTIONS, '/api/v1/connections/attention', { limit: a.limit ?? 30 });
      return r;
    },
  }),
  tool({
    name: 'connections_agenda',
    title: 'Your upcoming meetings',
    description:
      "Meetings from your connected calendar with the people in them matched to your Connect. Says `connected: false` if you have not linked a calendar.",
    scope: 'connections:read',
    input: { days: z.number().int().min(1).max(30).optional().describe('How far ahead; defaults to the app’s own window') },
    run: (c, a) => c.get(CONNECTIONS, '/api/v1/connections/agenda', { days: a.days }),
  }),
  tool({
    name: 'connections_landscape',
    title: 'Your landscape',
    description:
      'The Connect landscape on one axis: which band each person sits in now, and how that moved over the period. Axes: relationship (default), and the others the workspace defines.',
    scope: 'connections:read',
    input: {
      axis: z.string().max(40).optional().describe('An axis key; defaults to the main one'),
      since_days: z.number().int().min(1).max(365).optional(),
    },
    run: (c, a) => c.get(CONNECTIONS, '/api/v1/connections/landscape', { axis: a.axis, since_days: a.since_days }),
  }),
  tool({
    name: 'connections_search',
    title: 'Find a person',
    description: 'Search your workspace’s people by name or email, to get the id the other tools take.',
    scope: 'connections:read',
    input: { q: z.string().min(1).max(100) },
    run: async (c, a) => {
      const r = await c.get<{ items?: Row[]; data?: Row[] } | Row[]>(PLATFORM, '/api/v1/persons', { q: a.q, limit: 20 });
      const rows = Array.isArray(r) ? r : (r.items ?? r.data ?? []);
      return cap(
        rows.map((p) => ({
          id: p.id,
          name: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
          email: p.email ?? null,
          country: p.country ?? null,
        })),
        20,
      );
    },
  }),
  tool({
    name: 'connections_person',
    title: 'One person, in your Connect',
    description:
      'Everything your Connect holds on one person: where they sit and who they connect to (their neighbourhood), and your notes on them, newest first. Use connections_search first if you only have a name.',
    scope: 'connections:read',
    input: { person_id: uuid, notes_limit: z.number().int().min(1).max(50).optional() },
    run: async (c, a) => {
      const [neighbourhood, notes] = await Promise.all([
        c.get<Row>(CONNECTIONS, `/api/v1/connections/map/${a.person_id}/neighbourhood`),
        c.get<{ items?: Row[]; notes?: Row[] } | Row[]>(CONNECTIONS, '/api/v1/notes', { person_id: a.person_id }).catch((e: unknown) =>
          e instanceof PersonApiError && e.status === 404 ? { items: [] } : Promise.reject(e),
        ),
      ]);
      const n = notes as { items?: Row[]; notes?: Row[] } | Row[];
      const noteRows = Array.isArray(n) ? n : (n.items ?? n.notes ?? []);
      return { person_id: a.person_id, neighbourhood, notes: cap(noteRows, a.notes_limit ?? 10) };
    },
  }),
  tool({
    name: 'connections_entries',
    title: 'Who can get you in',
    description:
      'For an organisation, a person, a tag or a place: who in your network is the way in, and through whom. Pass exactly one target.',
    scope: 'connections:read',
    input: {
      org_id: uuid.optional(),
      person_id: uuid.optional(),
      tag_id: uuid.optional(),
      location: z.string().max(120).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    run: (c, a) => c.get(CONNECTIONS, '/api/v1/connections/entries', a),
  }),

  // --- The Thread, as the person -------------------------------------------
  tool({
    name: 'thread_list',
    title: 'Your threads',
    description: 'The events and journeys you organise: title, slug, status, dates.',
    scope: 'thread:read',
    input: {},
    run: async (c) => {
      const r = await c.get<{ items: Row[] }>(THREAD, '/api/v1/thread/threads');
      return cap(
        (r.items ?? []).map((t) => {
          const p = one(t.program as Row | Row[] | null);
          return { id: t.id, title: p?.title ?? null, slug: t.slug, format: p?.format ?? null, status: p?.status ?? null, starts_on: p?.starts_on ?? null, ends_on: p?.ends_on ?? null };
        }),
        50,
      );
    },
  }),
  tool({
    name: 'thread_get',
    title: 'One thread',
    description: 'A thread with its settings and its timeline (agenda items and messages, with their timing and triggers).',
    scope: 'thread:read',
    input: { thread_id: uuid },
    run: async (c, a) => {
      const t = await c.get<Row>(THREAD, `/api/v1/thread/threads/${a.thread_id}`);
      const p = one(t.program as Row | Row[] | null);
      const eng = Array.isArray(t.engagements) ? (t.engagements as Row[]) : [];
      return {
        id: t.id,
        title: p?.title ?? null,
        slug: t.slug,
        status: p?.status ?? null,
        starts_on: p?.starts_on ?? null,
        ends_on: p?.ends_on ?? null,
        is_public_listed: t.is_public_listed,
        requires_approval: t.requires_approval,
        capacity: t.capacity,
        price_cents: t.price_cents,
        price_currency: t.price_currency,
        engagements: eng.map((e) => ({ id: e.id, type: e.type, title: e.title, status: e.status, starts_at: e.starts_at, ends_at: e.ends_at, trigger_kind: e.trigger_kind, scheduled_at: e.scheduled_at })),
      };
    },
  }),
  tool({
    name: 'thread_templates',
    title: 'Your thread templates',
    description: 'The templates you can build a thread from, with their format, duration and how many items they lay down.',
    scope: 'thread:read',
    input: {},
    run: async (c) => {
      const r = await c.get<{ items: Row[] }>(THREAD, '/api/v1/thread/thread-templates');
      return cap(
        (r.items ?? []).map((t) => {
          const st = (t.structure ?? {}) as Row;
          const eng = Array.isArray(st.engagements) ? (st.engagements as Row[]) : [];
          return { id: t.id, title: t.title, scope: t.scope, format: st.format ?? null, duration_days: st.duration_days ?? null, engagement_count: eng.length };
        }),
        50,
      );
    },
  }),
  tool({
    name: 'thread_enrolment_summary',
    title: 'How registration is going',
    description: 'Registrations on one of your threads as counts: total, by status, by payment state, checked in, waiting for your approval. Who they are is in The Thread itself.',
    scope: 'thread:read',
    input: { thread_id: uuid },
    run: async (c, a) => {
      const r = await c.get<{ items: Row[] }>(THREAD, '/api/v1/thread/enrolments', { thread_id: a.thread_id });
      const rows = r.items ?? [];
      const enrol = (x: Row) => one(x.enrolment as Row | Row[] | null);
      return {
        thread_id: a.thread_id,
        total: rows.length,
        by_status: count(rows, (x) => str(enrol(x)?.status)),
        by_payment_status: count(rows, (x) => str(x.payment_status)),
        checked_in: rows.filter((x) => !!x.checked_in_at).length,
        awaiting_approval: rows.filter((x) => str(enrol(x)?.status) === 'invited' && str(x.payment_status) !== 'pending').length,
      };
    },
  }),

  // --- The Thread, writing as the person (thread:write; phase 4, first tool) --
  tool({
    name: 'thread_create',
    title: 'Create a thread',
    description:
      'Create a new thread for the person, as a DRAFT — nothing is published or emailed. Two ways: pass template_id (from thread_templates) and the template’s items are laid down with dates rebased onto starts_on; or omit it for a blank event or journey. Before calling: confirm the template (or blank), the title and the start date with the person; suggest a slug from the title (lowercase, hyphens, unique for them). A slug already in use is refused by The Fibre and you propose another. A new thread comes with The Thread’s own "You’re enrolled" confirmation message already on its timeline; everything else you add is a draft. Publishing, prices and tickets happen in The Thread itself.',
    scope: 'thread:write',
    write: true,
    input: {
      title: z.string().min(1).max(200),
      slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase kebab-case'),
      template_id: uuid.optional().describe('A template from thread_templates; omit for a blank thread'),
      format: z.enum(['event', 'journey']).optional().describe('Blank threads only; defaults to event'),
      starts_on: z.string().date().optional().describe('YYYY-MM-DD'),
      ends_on: z.string().date().optional().describe('YYYY-MM-DD, blank threads only'),
      intention: z.string().max(2000).optional().describe('A short intention in plain words, blank threads only'),
    },
    run: async (c, a) => {
      const created = a.template_id
        ? await c.post<Row>(THREAD, `/api/v1/thread/thread-templates/${a.template_id}/instantiate`, {
            title: a.title,
            slug: a.slug,
            starts_on: a.starts_on ?? null,
          })
        : await c.post<Row>(THREAD, '/api/v1/thread/threads', {
            title: a.title,
            format: a.format ?? 'event',
            slug: a.slug,
            starts_on: a.starts_on ?? null,
            ends_on: a.ends_on ?? null,
            intention: a.intention ?? null,
          });
      return {
        created: true,
        thread_id: created.id,
        title: a.title,
        slug: a.slug,
        status: 'draft',
        from_template: a.template_id ?? null,
        open_in_thread: `/threads/${String(created.id)}`,
      };
    },
  }),
  tool({
    name: 'thread_add_engagements',
    title: 'Lay a schedule onto a thread',
    description:
      'Add a list of items to a thread’s timeline in one go, ALL AS DRAFTS — nothing is published, sent or shown until the person publishes each one in The Thread. Two families: agenda items (type event, conversation or workshop: something on a date, with a start and end time, inside the thread’s dates; set show_in_agenda false for an internal milestone the participants should not see) and messages (type message, reflection, practice, document or inspiration: something that will be EMAILED to everyone enrolled at date + time once published). Dates are YYYY-MM-DD, times HH:MM in the thread’s timezone. Use this after thread_create when the person has given a schedule; confirm the list with them first, and say which rows became messages. Needs a plan with custom timelines; a refusal names that.',
    scope: 'thread:write',
    write: true,
    input: {
      thread_id: uuid,
      timezone: z.string().max(64).optional().describe('IANA zone, e.g. Europe/Amsterdam; defaults to the thread’s'),
      items: z
        .array(
          z.object({
            title: z.string().min(1).max(200),
            type: z.enum(['event', 'conversation', 'workshop', 'message', 'reflection', 'practice', 'document', 'inspiration']),
            date: z.string().date(),
            start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().describe('HH:MM; agenda items default 10:00, messages 09:00'),
            end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().describe('HH:MM; agenda items default start + 1h'),
            description: z.string().max(2000).optional(),
            location: z.string().max(300).optional(),
            show_in_agenda: z.boolean().optional().describe('Agenda items only; false = an internal milestone'),
          }),
        )
        .min(1)
        .max(60),
    },
    run: async (c, a) => {
      const thread = await c.get<Row>(THREAD, `/api/v1/thread/threads/${a.thread_id}`);
      const tz = a.timezone ?? str(thread.timezone) ?? 'Europe/Amsterdam';
      const results: Row[] = [];
      for (const it of a.items) {
        const isAgenda = AGENDA_TYPES.has(it.type);
        const start = it.start ?? (isAgenda ? '10:00' : '09:00');
        const end = it.end ?? plusOneHour(start);
        const body: Row = { title: it.title, type: it.type, status: 'draft' };
        if (it.description) body.description = it.description;
        if (isAgenda) {
          body.starts_at = zonedIso(it.date, start, tz);
          body.ends_at = zonedIso(it.date, end, tz);
          if (it.location) body.location = it.location;
          if (it.show_in_agenda !== undefined) body.show_in_agenda = it.show_in_agenda;
        } else {
          body.trigger_kind = 'fixed';
          body.scheduled_at = zonedIso(it.date, start, tz);
        }
        try {
          const e = await c.post<Row>(THREAD, `/api/v1/thread/threads/${a.thread_id}/engagements`, body);
          results.push({ ok: true, id: e.id, title: it.title, type: it.type, date: it.date, family: isAgenda ? 'agenda' : 'message' });
        } catch (err) {
          results.push({ ok: false, title: it.title, type: it.type, date: it.date, error: err instanceof PersonApiError ? err.describe().split('\n')[0] : String(err) });
          // A plan gate or a locked thread refuses every item the same way; stop early.
          if (err instanceof PersonApiError && (err.status === 403 || err.status === 423)) break;
        }
      }
      const added = results.filter((r) => r.ok).length;
      return { thread_id: a.thread_id, timezone: tz, added, failed: results.length - added, all_drafts: true, items: results };
    },
  }),
  // --- Business Models, as the person (models:read / models:write) ---------
  tool({
    name: 'models_list',
    title: 'Your business models',
    description: 'The business models the person may open in Business Models: name, tagline, which team it belongs to (or the whole workspace), when it last changed.',
    scope: 'models:read',
    input: {},
    run: async (c) => {
      const r = await c.get<{ items: Row[]; is_admin?: boolean }>(MODELS, '/api/v1/models');
      return {
        ...cap(
          (r.items ?? []).map((m) => {
            const team = one(m.team as Row | Row[] | null);
            return { id: m.id, name: m.name, slug: m.slug, tagline: m.tagline ?? null, team: team ? { id: team.id, name: team.name } : null, updated_at: m.updated_at };
          }),
          50,
        ),
        is_admin: r.is_admin === true,
      };
    },
  }),
  tool({
    name: 'models_teams',
    title: 'Teams a business model can belong to',
    description: 'The teams the person may put a business model in, with their standing in each (admin, lead or member). Admins may also create workspace-wide models (team_id null). Only admins and team leads can create.',
    scope: 'models:read',
    input: {},
    run: async (c) => c.get<{ items: Row[]; is_admin: boolean }>(MODELS, '/api/v1/models/teams'),
  }),
  tool({
    name: 'models_get',
    title: 'One business model',
    description: 'A business model with its full definition (turnover generators, costs, investment, canvas) and the numbers the team has edited. Use it to read a model back or as the example for a new one.',
    scope: 'models:read',
    input: { model_id: uuid },
    run: async (c, a) => c.get<Row>(MODELS, `/api/v1/models/${a.model_id}`),
  }),
  tool({
    name: 'models_schema',
    title: 'How to write a business model definition',
    description: 'The format a business model definition must have, with a small complete example. Read this before models_create when writing a model from a story.',
    scope: 'models:read',
    local: true,
    input: {},
    run: async () => MODEL_SCHEMA_GUIDE,
  }),
  tool({
    name: 'models_create',
    title: 'Create a business model',
    description:
      'Create a business model in Business Models from a definition (see models_schema): turnover generators each with a volume, a price and their own cost structure, generic fixed costs, one-off investment, and the Business Model Canvas text. The team then turns the numbers in the app. Security check, every time: before calling, tell the person the model name and the team it goes into and wait for their yes (models_teams says where they may create; admins may pass team_id null for the whole workspace). Pass team_name as confirmed: the tool checks it against team_id and refuses a mismatch. A model with the same name in the same place is refused too, so "create" never silently doubles or replaces an existing one; to change one, use models_update. This tool only ever creates; it never changes an existing model. Every number in the definition is a placeholder for the team to replace; say so in the help texts. Nothing is shared outside the team.',
    scope: 'models:write',
    write: true,
    input: {
      name: z.string().min(1).max(200),
      tagline: z.string().max(300).optional(),
      team_id: uuid.nullable().describe('A team from models_teams, or null for the whole workspace (admins only)'),
      team_name: z.string().min(1).max(200).describe('The team’s name as the person confirmed it, or "workspace" for a workspace-wide model. Checked against team_id.'),
      allow_same_name: z.boolean().optional().describe('Only when the person explicitly wants a second model with a name that already exists there'),
      definition: z
        .object({ name: z.string().min(1).max(200), generators: z.array(z.record(z.unknown())).min(1).max(40) })
        .passthrough()
        .describe('The definition, in the format models_schema describes'),
    },
    run: async (c, a) => {
      const place = await checkTeam(c, a.team_id, a.team_name);
      if (!a.allow_same_name) await checkNameFree(c, place.id, a.name);
      const created = await c.post<Row>(MODELS, '/api/v1/models', {
        name: a.name,
        tagline: a.tagline ?? null,
        team_id: place.id,
        definition: a.definition,
      });
      const team = one(created.team as Row | Row[] | null);
      return { created: true, model_id: created.id, name: created.name, slug: created.slug, team: team ? { id: team.id, name: team.name } : { id: null, name: 'workspace' }, open_in_models: `/models/${String(created.id)}` };
    },
  }),

  tool({
    name: 'models_update',
    title: 'Change a business model',
    description:
      'Change a business model’s name, tagline, description or its whole definition (the structure: generators, costs, canvas, funnel). Read it first with models_get, change what the person asked, send the full definition back. Admins and team leads only. Pass if_updated_at from models_get: if someone changed the model meanwhile the call is refused with the current version, so nothing is overwritten silently. The numbers the team typed are untouched; use models_set_numbers for those. ' +
      WRITE_RULE,
    scope: 'models:write',
    write: true,
    input: {
      model_id: uuid,
      model_name: z.string().min(1).max(200).describe('The model’s current name, as the person confirmed it; checked against model_id'),
      if_updated_at: z.string().optional().describe('updated_at as models_get returned it'),
      name: z.string().min(1).max(200).optional(),
      tagline: z.string().max(300).optional(),
      description: z.string().max(2000).optional(),
      definition: z.object({ name: z.string().min(1).max(200), generators: z.array(z.record(z.unknown())).min(1).max(40) }).passthrough().optional(),
    },
    run: async (c, a) => {
      const { model_id, model_name, ...patch } = a;
      const { team } = await checkModel(c, model_id, model_name);
      const r = await c.patch<Row>(MODELS, `/api/v1/models/${model_id}`, patch);
      return { updated: true, model_id: r.id, name: r.name, team: team ? { id: team.id, name: team.name } : { id: null, name: 'workspace' }, updated_at: r.updated_at };
    },
  }),
  tool({
    name: 'models_set_numbers',
    title: 'Set numbers in a business model',
    description:
      'Change some of the numbers of a model — the variables of a generator ({ generators: { "<generator id>": { "<input or cost id>": value } } }), a fixed cost ({ fixed: { "<id>": value } }), an investment line, a setting, a funnel rate ({ transitions: { "<transition id>": percent } }), new clients typed for months ({ periods: { "<segment id>": { "7": 12 } } }), the horizon or the reference month. Only what you send changes; the rest stays. Every active member of the team may. Confirm the numbers with the person first. ' +
      WRITE_RULE,
    scope: 'models:write',
    write: true,
    input: {
      model_id: uuid,
      model_name: z.string().min(1).max(200).describe('The model’s name, as the person confirmed it; checked against model_id'),
      settings: z.record(z.number()).optional(),
      generators: z.record(z.record(z.number())).optional(),
      fixed: z.record(z.number()).optional(),
      investment: z.record(z.number()).optional(),
      transitions: z.record(z.number()).optional(),
      periods: z.record(z.record(z.number())).optional(),
      periodRates: z.record(z.record(z.number())).optional(),
      refMonth: z.number().int().min(1).max(240).optional(),
      horizon: z.number().int().min(12).max(240).optional(),
    },
    run: async (c, a) => {
      const { model_id, model_name, ...numbers } = a;
      const { row, team } = await checkModel(c, model_id, model_name);
      const r = await c.put<Row>(MODELS, `/api/v1/models/${model_id}/numbers`, numbers);
      return { updated: true, model_id: r.id, name: row.name, team: team ? { id: team.id, name: team.name } : { id: null, name: 'workspace' }, updated_at: r.updated_at };
    },
  }),
  tool({
    name: 'models_save_scenario',
    title: 'Save the current numbers as a scenario',
    description: 'Save the model’s current numbers under a name, so the team can compare and switch between variations in the app. Set the numbers first with models_set_numbers, then save; a scenario with the same name is replaced. ' + WRITE_RULE,
    scope: 'models:write',
    write: true,
    input: { model_id: uuid, model_name: z.string().min(1).max(200).describe('The model’s name, as the person confirmed it; checked against model_id'), name: z.string().min(1).max(120) },
    run: async (c, a) => {
      const { row, team } = await checkModel(c, a.model_id, a.model_name);
      const r = await c.post<Row>(MODELS, `/api/v1/models/${a.model_id}/scenarios`, { name: a.name });
      return { ...r, model_name: row.name, team: team ? { id: team.id, name: team.name } : { id: null, name: 'workspace' } };
    },
  }),
  tool({
    name: 'models_duplicate',
    title: 'Duplicate a business model',
    description: 'A copy of a model, definition and numbers and scenarios, under a new name, in a team the person leads (models_teams) or workspace wide for admins. The way to make a variation of the structure without touching the original. ' + WRITE_RULE + ' When you move the copy to another team, pass team_name as confirmed too.',
    scope: 'models:write',
    write: true,
    input: {
      model_id: uuid,
      model_name: z.string().min(1).max(200).describe('The original’s name, as the person confirmed it; checked against model_id'),
      name: z.string().min(1).max(200).optional(),
      team_id: uuid.nullable().optional().describe('Omit to keep the original’s team'),
      team_name: z.string().min(1).max(200).optional().describe('Required when team_id is given: that team’s name as confirmed, or "workspace"'),
    },
    run: async (c, a) => {
      await checkModel(c, a.model_id, a.model_name);
      if (a.team_id !== undefined) {
        if (!a.team_name) throw new Error('Refused, nothing changed: team_id was given without team_name. Confirm the target team with the person and pass its name.');
        await checkTeam(c, a.team_id, a.team_name);
      }
      const r = await c.post<Row>(MODELS, `/api/v1/models/${a.model_id}/duplicate`, { name: a.name, team_id: a.team_id });
      const team = one(r.team as Row | Row[] | null);
      return { created: true, model_id: r.id, name: r.name, team: team ? { id: team.id, name: team.name } : null, open_in_models: `/models/${String(r.id)}` };
    },
  }),

];

const AGENDA_TYPES = new Set(['event', 'conversation', 'workshop']);

function plusOneHour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${String(((h ?? 0) + 1) % 24).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` + `HH:MM` in an IANA zone → ISO 8601 with that zone's offset. */
export function zonedIso(date: string, hhmm: string, tz: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  // Offset of `tz` at that wall-clock instant, found by formatting a UTC guess.
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  const offsetMin = Math.round((asIfUtc - guess) / 60_000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return `${date}T${hhmm}:00${off}`;
}

export function personToolsForScopes(scopes: readonly string[]): PersonTool[] {
  return PERSON_TOOLS.filter((t) => scopes.includes(t.scope));
}

// ---------------------------------------------------------------------------
// The server for one grant.
// ---------------------------------------------------------------------------
export interface PersonServerOptions {
  client: PersonClient;
  scopes: readonly string[];
  /** For the instructions. */
  who: { workspace: string; clientName: string };
  version: string;
}

export function personInstructions(who: PersonServerOptions['who'], scopes: readonly string[]): string {
  return [
    `You are connected to The Fibre as the person who signed in, in the workspace "${who.workspace}", through ${who.clientName}.`,
    `What you may read: ${scopes.join(', ') || 'nothing'}. Everything here is that person's own data, shown to them at their request; treat it as theirs and do not repeat it into places they did not ask for.`,
    '',
    'Connect is a landscape of a person’s relationships, not a CRM: bands say how a relationship stands, attention conditions say who needs a move, and notes are the person’s own words about a meeting.',
    'When asked who to follow up with, start with connections_today, then connections_attention. To talk about one person, find them with connections_search and read connections_person.',
    scopes.includes('models:read')
      ? 'Business Models holds one model per venture: turnover generators with their own costs, generic costs, investment, break even, on a Business Model Canvas. models_list shows what the person may open; models_get reads one back. To write a model from a story, read models_schema first, draft the definition, and confirm name and team before models_create. With models:write you may also change a model (models_update, definition and words; models_set_numbers, the numbers; models_save_scenario; models_duplicate for a variation of the structure). Always read first, change only what was asked, pass if_updated_at so nobody is overwritten, and confirm before a write.'
      : '',
    scopes.includes('thread:write')
      ? 'Two things here write, both as DRAFTS: thread_create makes a new thread (blank, or from one of the person’s templates), and thread_add_engagements lays a list of dated items onto it. Before creating, confirm template-or-blank, title, dates and slug (suggest one from the title). For a schedule the person pastes, use the plan_thread_from_schedule prompt’s method: rows people attend become agenda items, rows that get sent become messages, internal steps become agenda items hidden from the agenda; the thread’s start and end must span every row. Nothing is published or emailed until the person publishes it in The Thread. Changing a thread, adding a Connect note, publishing: in the app; say where.'
      : 'Nothing here writes. If the person wants to create or change a thread, or add a note, tell them where in the app that happens.',
  ].join('\n');
}

export function buildPersonServer(opts: PersonServerOptions): McpServer {
  const server = new McpServer(
    { name: 'thefibre', title: 'The Fibre', version: opts.version },
    { instructions: personInstructions(opts.who, opts.scopes) },
  );
  if (opts.scopes.includes('thread:write')) registerSchedulePrompt(server);
  if (opts.scopes.includes('models:write')) registerModelPrompt(server);
  for (const def of personToolsForScopes(opts.scopes)) {
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema: def.input,
        annotations: {
          title: def.title,
          readOnlyHint: !def.write,
          destructiveHint: false,
          // A create is not idempotent in the MCP sense (a retry with a new
          // slug makes a second thread); the same slug is refused by the API.
          idempotentHint: !def.write,
          openWorldHint: false,
        },
      },
      async (args: Record<string, unknown>): Promise<CallToolResult> => {
        try {
          const parsed = z.object(def.input).parse(args ?? {});
          const out = await def.run(opts.client, parsed);
          return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
        } catch (e) {
          const text = e instanceof PersonApiError ? e.describe() : e instanceof Error ? `${e.name}: ${e.message}` : String(e);
          return { content: [{ type: 'text', text }], isError: true };
        }
      },
    );
  }
  return server;
}
