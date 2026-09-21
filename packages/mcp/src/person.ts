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

export type PersonScope = 'connections:read' | 'thread:read';

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
  async get<T = unknown>(appId: string, path: string, query?: Record<string, string | number | undefined | null>): Promise<T> {
    let url = this.apiUrl + path;
    if (query) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      const s = qs.toString();
      if (s) url += `?${s}`;
    }
    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${this.jwt}`, 'x-app-id': appId, accept: 'application/json' },
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) throw new PersonApiError(res.status, 'GET', path, parsed);
    return parsed as T;
  }
}

// ---------------------------------------------------------------------------
// The catalogue.
// ---------------------------------------------------------------------------
const CONNECTIONS = 'fibre-sales';
const THREAD = 'the-thread';
const PLATFORM = 'fibre-platform';

type Shape = Record<string, z.ZodTypeAny>;
export interface PersonTool<S extends Shape = Shape> {
  name: string;
  title: string;
  description: string;
  scope: PersonScope;
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

export const PERSON_TOOLS: PersonTool[] = [
  // --- Connections ---------------------------------------------------------
  tool({
    name: 'connections_today',
    title: 'Who is waiting for you',
    description:
      'Your Connections "Today": the follow-ups you owe, the meetings to prepare for, and how much of the chosen horizon (today, tomorrow, this week, next week) is already spoken for. Start here when asked "who should I follow up with".',
    scope: 'connections:read',
    input: { horizon: z.enum(['today', 'tomorrow', 'week', 'next_week']).optional().describe('Defaults to today') },
    run: (c, a) => c.get(CONNECTIONS, '/api/v1/connections/today', { horizon: a.horizon }),
  }),
  tool({
    name: 'connections_attention',
    title: 'Who needs attention',
    description:
      'The people your Connections flags: going quiet, a promise overdue, a deal rotting, and the other attention conditions — each with why. Up to the limit you ask for.',
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
      "Meetings from your connected calendar with the people in them matched to your Connections. Says `connected: false` if you have not linked a calendar.",
    scope: 'connections:read',
    input: { days: z.number().int().min(1).max(30).optional().describe('How far ahead; defaults to the app’s own window') },
    run: (c, a) => c.get(CONNECTIONS, '/api/v1/connections/agenda', { days: a.days }),
  }),
  tool({
    name: 'connections_landscape',
    title: 'Your landscape',
    description:
      'The Connections landscape on one axis: which band each person sits in now, and how that moved over the period. Axes: relationship (default), and the others the workspace defines.',
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
    title: 'One person, in your Connections',
    description:
      'Everything your Connections holds on one person: where they sit and who they connect to (their neighbourhood), and your notes on them, newest first. Use connections_search first if you only have a name.',
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
];

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
    'Connections is a landscape of a person’s relationships, not a CRM: bands say how a relationship stands, attention conditions say who needs a move, and notes are the person’s own words about a meeting.',
    'When asked who to follow up with, start with connections_today, then connections_attention. To talk about one person, find them with connections_search and read connections_person.',
    'Nothing here writes. If the person wants to add a note or change a thread, tell them where in the app that happens.',
  ].join('\n');
}

export function buildPersonServer(opts: PersonServerOptions): McpServer {
  const server = new McpServer(
    { name: 'thefibre', title: 'The Fibre', version: opts.version },
    { instructions: personInstructions(opts.who, opts.scopes) },
  );
  for (const def of personToolsForScopes(opts.scopes)) {
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema: def.input,
        annotations: { title: def.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
