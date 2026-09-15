#!/usr/bin/env node
// A read-only MCP server over The Fibre API. Phase 1 of
// docs/ai-assistance-plan.md: one seat, local, staging, nothing written.
//
// ── What this is ────────────────────────────────────────────────────────────
//
// MCP (Model Context Protocol) is how an assistant the seat already pays for
// — Claude Desktop, Claude Code, anything that speaks it — gets handed a set
// of named tools. This process is that set. It runs on the seat's own machine,
// speaks the protocol over stdin/stdout, and turns each tool call into an
// ordinary API request made AS THE SEAT: their user token, the platform's
// slug in X-App-ID, RLS deciding what comes back. The assistant sees what the
// seat sees in a browser, and nothing a careless tool could widen.
//
// ── The three gates (plan §2) ───────────────────────────────────────────────
//
//   1. which tools exist and which fields they return — this file + shape.ts
//   2. RLS — the database, per row, on the seat's identity
//   3. app_membership — the database, for curator data
//
// Only the first is ours. It is deliberately small: fourteen reads, no
// writes, no note bodies, no message content (see shape.ts for the reasoning
// behind each line).
//
// ── Why a user session and not the app key ──────────────────────────────────
//
// The plan's phase 1 says "the existing workspace app key". Checked against
// middleware/app-context.ts on 2026-09-15: an app key reaches the activity
// stream (ids, no names), threads the KEY'S OWN APP published, flows it
// created, and link lookups by its own record ids. It cannot list, search or
// read a person, read a note, or see a thread a human published in The
// Thread. That credential was designed for an app that brings its own records
// and links them — not for a question about the workspace. Every question in
// plan §5 would come back empty. A user session answers them, and it is also
// the boundary the plan itself says is right for a seat ("her assistant sees
// exactly what she sees"). So phase 1 rehearses phase 2's boundary, on a
// token that lasts an hour, with no token infrastructure built.

import { McpServer, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ShapeOutput, ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { readConfig } from './env.js';
import { ApiError, Fibre } from './fibre.js';
import {
  activityEntry,
  activityRow,
  engagementRow,
  enrolmentRow,
  flowRunEntry,
  fullName,
  mergeTimeline,
  noteEntry,
  orgMembership,
  organisationMember,
  organisationSummary,
  personCard,
  personSummary,
  taskRow,
  threadSummary,
  type TimelineEntry,
} from './shape.js';

type Row = Record<string, unknown>;
type Items<T = Row> = { items: T[]; next?: string | null };

const uuid = z.string().uuid();

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

let cfg;
try {
  cfg = readConfig();
} catch (e) {
  console.error(`fibre-mcp: ${(e as Error).message}`);
  process.exit(1);
}
const api = new Fibre(cfg);

console.error(
  `fibre-mcp: read-only, against ${cfg.api}, as ${api.describe()}` +
    (cfg.envFile ? `, env from ${cfg.envFile}` : ''),
);

const server = new McpServer(
  { name: 'fibre', version: '0.1.0' },
  {
    instructions: [
      'The Fibre is a relationship platform for people facilitating change: persons and organisations, the activity between them, threads (programmes with enrolments), flows (processes with tasks), and notes.',
      'Every tool here READS, as the signed-in seat, bounded by the same permissions as their browser. Nothing writes.',
      'What the data honestly knows, and does not: activity carries a type and a subject, never what was said. A note on a timeline shows that it was written and when, never its body. A closeness of "unrated" means nobody rated it, not that it is weak. Two people appearing together is not a relationship.',
      'When a question needs a person, search first, then use the id. When you are unsure which of several people is meant, ask rather than guess.',
    ].join('\n'),
  },
);

const text = (v: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(v, null, 2) }],
});

/** Every tool goes through this, so an API refusal reads as a sentence and never as a stack trace. */
function tool<A extends ZodRawShapeCompat>(
  name: string,
  description: string,
  inputSchema: A,
  run: (args: ShapeOutput<A>) => Promise<unknown>,
) {
  const cb = (async (args: ShapeOutput<A>): Promise<CallToolResult> => {
      try {
        return text(await run(args));
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? e.status === 401
              ? 'The session was refused (401). If you pasted FIBRE_JWT, it has probably expired: tokens last an hour.'
              : e.status === 403
                ? `Not allowed for this seat (403): ${e.body.slice(0, 200)}`
                : e.status === 404
                  ? 'Not found, or not visible to this seat.'
                  : e.message
            : (e as Error).message;
        return { isError: true, content: [{ type: 'text', text: msg }] };
      }
    }) as unknown as ToolCallback<A>;
  server.registerTool(
    name,
    { description, inputSchema, annotations: { readOnlyHint: true, openWorldHint: false } },
    cb,
  );
}

// A small cache so enriching an activity list with names costs one lookup per
// person per process, not per row.
const nameCache = new Map<string, string | null>();
async function personName(id: string): Promise<string | null> {
  if (nameCache.has(id)) return nameCache.get(id) ?? null;
  let name: string | null = null;
  try {
    name = fullName(await api.get<Row>(`/api/v1/persons/${id}`));
  } catch {
    name = null; // merged away, deleted, or simply not visible to this seat
  }
  nameCache.set(id, name);
  return name;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

tool(
  'whoami',
  'Who the assistant is acting as: the seat, their workspace, their role, and which apps they are a member of. Call this first if unsure what can be seen.',
  {},
  async () => {
    const me = await api.get<Row>('/api/v1/auth/me');
    const user = (me.user ?? {}) as Row;
    const ws = (me.workspace ?? {}) as Row;
    return {
      user: { id: user.id, name: user.full_name, email: user.email },
      workspace: { id: ws.id, slug: ws.slug, name: ws.name },
      apps: ((me.memberships ?? []) as Row[]).map((m) => {
        const app = (Array.isArray(m.app) ? m.app[0] : m.app) as Row | undefined;
        return { app: app?.name ?? app?.slug, role: m.role };
      }),
      acting_via: cfg.api,
      read_only: true,
    };
  },
);

tool(
  'search_people',
  'Find people in the workspace by name or email. Returns id, name, email and country. Use the id with get_person or person_timeline.',
  { q: z.string().min(1).max(100).describe('Part of a first name, last name or email'), limit: z.number().int().min(1).max(100).default(20) },
  async ({ q, limit }) => {
    const r = await api.get<Items>('/api/v1/persons', { q, limit });
    return { people: r.items.map(personSummary), more: Boolean(r.next) };
  },
);

tool(
  'get_person',
  'One person: contact card, current and past organisation roles, and which apps hold data on them. No notes, no activity (use person_timeline for those).',
  { person_id: uuid },
  async ({ person_id }) => {
    const [p, m, apps] = await Promise.all([
      api.get<Row>(`/api/v1/persons/${person_id}`),
      api.get<Row>(`/api/v1/persons/${person_id}/memberships`).catch(() => ({}) as Row),
      api.get<Items | Row[]>(`/api/v1/persons/${person_id}/apps`).catch(() => [] as Row[]),
    ]);
    const appRows = Array.isArray(apps) ? apps : ((apps as Items).items ?? []);
    return {
      person: personCard(p),
      organisations: ((m.org_memberships ?? []) as Row[]).map(orgMembership),
      has_account: m.has_account ?? null,
      apps_with_data: appRows.map((a) => (a as Row).name ?? (a as Row).slug ?? (a as Row).app_id),
    };
  },
);

tool(
  'person_timeline',
  'What happened with one person, newest first: activity events (type and subject, never content), notes (that one was written, when, of what kind, and any follow-up date; never the body), and the processes they are in. This is how you answer "when did we last speak" and "what happened last time".',
  { person_id: uuid, limit: z.number().int().min(1).max(200).default(50) },
  async ({ person_id, limit }) => {
    const [acts, notes, runs] = await Promise.all([
      api.get<Items>('/api/v1/activities', { person_id, limit: 100 }),
      api.get<Items>('/api/v1/notes', { person_id, limit: 100 }).catch(() => ({ items: [] }) as Items),
      api.get<Items>(`/api/v1/flow/contacts/${person_id}/runs`).catch(() => ({ items: [] }) as Items),
    ]);
    const entries: TimelineEntry[] = [
      ...acts.items.map(activityEntry),
      ...notes.items.map(noteEntry),
      ...runs.items.map(flowRunEntry),
    ];
    const timeline = mergeTimeline(entries, limit);
    return {
      person_id,
      last_contact_at: timeline.find((e) => e.kind !== 'flow_run')?.at ?? null,
      counts: { activity: acts.items.length, notes: notes.items.length, flow_runs: runs.items.length },
      timeline,
    };
  },
);

tool(
  'recent_activity',
  'The workspace activity stream, newest first, with person names filled in. Each row is a type plus a short subject from the app that wrote it; no content ever crosses. Filter by type (e.g. note_added, meeting_booked, enrolled) or by days.',
  {
    days: z.number().int().min(1).max(400).default(30).describe('Only events in the last N days'),
    type: z.string().max(64).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  },
  async ({ days, type, limit }) => {
    const since = Date.now() - days * 86_400_000;
    const r = await api.get<Items>('/api/v1/activities', { limit, type });
    const items = r.items.filter((a) => {
      const at = a.occurred_at;
      return typeof at === 'string' && Date.parse(at) >= since;
    });
    const ids = [...new Set(items.map((a) => a.person_id).filter((x): x is string => typeof x === 'string'))];
    // Bounded: at most 25 name lookups per call; the rest keep their id.
    await Promise.all(ids.slice(0, 25).map(personName));
    return {
      since: new Date(since).toISOString(),
      events: items.map((a) => activityRow(a, nameCache.get(a.person_id as string) ?? null)),
      // Only "more" when the window was not exhausted inside this page.
      more: Boolean(r.next) && items.length === r.items.length,
    };
  },
);

tool(
  'search_organisations',
  'Find organisations by name, former name, abbreviation or domain.',
  { q: z.string().min(1).max(100), limit: z.number().int().min(1).max(100).default(20) },
  async ({ q, limit }) => {
    const r = await api.get<Items>('/api/v1/organisations', { q, limit });
    return { organisations: r.items.map(organisationSummary), more: Boolean(r.next) };
  },
);

tool(
  'get_organisation',
  'One organisation and the people currently connected to it, with their roles.',
  { organisation_id: uuid },
  async ({ organisation_id }) => {
    const [o, m] = await Promise.all([
      api.get<Row>(`/api/v1/organisations/${organisation_id}`),
      api.get<Items>(`/api/v1/organisations/${organisation_id}/members`).catch(() => ({ items: [] }) as Items),
    ]);
    return { organisation: organisationSummary(o), people: m.items.map(organisationMember) };
  },
);

tool(
  'list_threads',
  'Every thread (programme) this seat can see in The Thread: title, format, status, dates, whether it needs approval, price and capacity. Use thread_participants for who is in one.',
  { status: z.enum(['draft', 'active', 'completed', 'archived']).optional() },
  async ({ status }) => {
    const r = await api.get<Items>('/api/v1/thread/threads');
    const threads = r.items.map(threadSummary).filter((t) => !status || t.status === status);
    return { threads };
  },
);

tool(
  'thread_participants',
  'Who is enrolled in a thread and where each stands (status, progress, completed), plus its agenda: sessions and scheduled messages by title, type and time. Message content is not returned. "Who is coming on Thursday" and "who applied and is still waiting" start here.',
  { thread_id: uuid },
  async ({ thread_id }) => {
    const t = await api.get<Row>(`/api/v1/thread/threads/${thread_id}`);
    const summary = threadSummary(t);
    const programId = summary.program_id;
    const enrol = programId
      ? await api.get<Items>(`/api/v1/programs/${programId}/enrolments`).catch(() => ({ items: [] }) as Items)
      : ({ items: [] } as Items);
    const participants = enrol.items.map(enrolmentRow);
    return {
      thread: summary,
      participants,
      awaiting_decision: summary.requires_approval
        ? participants.filter((p) => p.status === 'invited').map((p) => p.name)
        : [],
      agenda: ((t.engagements ?? []) as Row[]).map(engagementRow),
    };
  },
);

tool(
  'who_needs_attention',
  'People who need something, each with the fact that says so in words (never a score): gone quiet, a follow-up overdue, a promise unkept. This is the "who is drifting" question, answered from what is recorded.',
  { limit: z.number().int().min(1).max(200).default(50) },
  async ({ limit }) => {
    const r = await api.get<Items>('/api/v1/connections/attention', { limit });
    return {
      people: r.items.map((row) => ({
        person_id: row.person_id,
        name: fullName(row.person as Row | null),
        condition: row.condition,
        since: row.since,
        detail: row.detail,
      })),
    };
  },
);

tool(
  'today',
  'What this seat owes (open tasks due or overdue) and what is coming at them that needs preparation (a thread starting with people not yet reached, a meeting with someone not spoken to in a while, a deal moving). Each preparation row surfaces on its own lead time, not on the day.',
  { horizon: z.enum(['today', 'tomorrow', 'week', 'next_week']).default('today') },
  async ({ horizon }) => {
    const r = await api.get<Row>('/api/v1/connections/today', { horizon });
    const owed = ((r.owed ?? []) as Row[]).map((o) => ({
      task_id: o.id,
      title: o.title,
      due_at: o.due_at,
      overdue: o.overdue,
      person: fullName(o.person as Row | null),
      organisation: ((o.organisation as Row | null)?.name as string | undefined) ?? null,
      minutes: o.minutes,
    }));
    const prepare = ((r.prepare ?? []) as Row[]).map((p) => ({
      signal: p.signal,
      subject: p.subject,
      happens_at: p.happens_at,
      prepare_at: p.prepare_at,
      days_until: p.days_until,
      count: p.count,
      of: p.of,
      days_since_spoken: p.days_since_spoken,
      person: fullName(p.person as Row | null),
      link: p.link,
      minutes: p.minutes,
    }));
    return { now: r.now, horizon, segments: r.segments, calendar: r.calendar, owed, prepare };
  },
);

tool(
  'landscape',
  'The shape of the whole community on one axis, as counts per band, and who moved between bands in the period. Axes: maturity (the relationship ladder), closeness (unrated → advocate; "unrated" is a fact, not a low score), cadence (never_spoken → in_rhythm), opportunity, contribution (who brings others).',
  {
    axis: z.enum(['maturity', 'closeness', 'cadence', 'opportunity', 'contribution']).default('maturity'),
    since_days: z.number().int().min(1).max(400).default(30),
  },
  async ({ axis, since_days }) => {
    const r = await api.get<Row>('/api/v1/connections/landscape', { axis, since_days });
    return {
      axis,
      since_days,
      total: r.total,
      arrived: r.arrived,
      bands: r.bands,
      moved_total: r.moved_total,
      moved: ((r.moved ?? []) as Row[]).map((m) => ({
        person_id: m.person_id,
        name: fullName(m.person as Row | null),
        from: m.from,
        to: m.to,
        up: m.up,
      })),
    };
  },
);

tool(
  'open_tasks',
  'Open tasks in Flow: mine (default) or everyone\'s. Each with its due date, the person it concerns and the process it belongs to. "What is still open on this, and who owns it."',
  {
    scope: z.enum(['mine', 'all']).default('mine'),
    status: z.enum(['open', 'done', 'all']).default('open'),
  },
  async ({ scope, status }) => {
    const r = await api.get<Items>('/api/v1/flow/tasks', { scope, status });
    return { tasks: r.items.map(taskRow) };
  },
);

tool(
  'agenda',
  'The seat\'s own calendar for the next days, with each attendee already matched to a person in the workspace where the email is exact. Unmatched attendees stay unmatched; nobody is created. Returns connected:false if no calendar is linked.',
  { days: z.number().int().min(1).max(14).default(1) },
  async ({ days }) => api.get<Row>('/api/v1/connections/agenda', { days }),
);

// ---------------------------------------------------------------------------
// One prompt: the preparation brief (plan §4.1), as a recipe over the tools
// rather than a composition the server computes. The assistant does the
// composing; the seat sees every step.
// ---------------------------------------------------------------------------

server.registerPrompt(
  'prepare_for_thread',
  {
    title: 'Preparation brief for a thread',
    description: 'Before a session: who is coming, what happened with each of them last time, who is new, who has gone quiet.',
    argsSchema: { thread_id: z.string().describe('The thread id (from list_threads)') },
  },
  ({ thread_id }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Prepare me for thread ${thread_id}.`,
            '1. Call thread_participants for it.',
            '2. For each participant, call person_timeline and note the last contact date and the last two events.',
            '3. Call who_needs_attention and mark anyone on this thread who appears there.',
            '4. Write a short brief: who is coming, who is new to us (no timeline at all), who has gone quiet (no contact in 60 days), and who is still awaiting a decision.',
            'Keep it under 250 words. State facts from the tools; where the record is silent, say so rather than guess. The brief should sharpen my attention, not replace it.',
          ].join('\n'),
        },
      },
    ],
  }),
);

// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
