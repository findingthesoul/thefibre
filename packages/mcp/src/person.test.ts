// The person-shaped catalogue: every tool is one GET to a user route with
// the person's JWT and the owning app's X-App-ID; the list a client sees
// follows the grant's scopes; and the whole thing works over a real MCP
// transport. The API itself is not exercised — verify-mcp-personal.mjs does
// that against staging.

import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { PERSON_TOOLS, PersonClient, buildPersonServer, personToolsForScopes, schedulePromptText, zonedIso } from './person.js';

const U = '11111111-2222-4333-8444-555555555555';

function recorder(answer: unknown = { ok: true }, status = 200) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {})) });
    return new Response(JSON.stringify(answer), { status, headers: { 'content-type': 'application/json' } });
  };
  return { calls, fetch };
}

const SAMPLES: Record<string, Record<string, unknown>> = {
  models_list: {},
  models_teams: {},
  models_get: { model_id: U },
  models_schema: {},
  models_create: { name: 'Example studio', team_id: null, definition: { name: 'Example studio', generators: [{ id: 'members' }] } },
  models_update: { model_id: U, name: 'Renamed' },
  models_set_numbers: { model_id: U, fixed: { team: 9000 } },
  models_save_scenario: { model_id: U, name: 'Careful' },
  models_duplicate: { model_id: U, name: 'Copy' },
  connections_today: { horizon: 'week' },
  connections_attention: { limit: 5 },
  connections_agenda: {},
  connections_landscape: {},
  connections_search: { q: 'marja' },
  connections_person: { person_id: U },
  connections_entries: { org_id: U },
  thread_list: {},
  thread_get: { thread_id: U },
  thread_templates: {},
  thread_enrolment_summary: { thread_id: U },
  thread_create: { title: 'Year programme fellowship', slug: 'year-programme-fellowship', starts_on: '2026-10-01' },
  thread_add_engagements: {
    thread_id: U,
    items: [
      { title: 'Fellowship introduced at the Quarterly Community Gathering', type: 'event', date: '2026-10-06' },
      { title: 'Invitation to all current facilitators', type: 'message', date: '2026-10-08' },
    ],
  },
};

const OWNER: Record<string, string> = {
  '/api/v1/connections': 'fibre-sales',
  '/api/v1/notes': 'fibre-sales',
  '/api/v1/persons': 'fibre-platform',
  '/api/v1/thread': 'the-thread',
  '/api/v1/models': 'fibre-models',
};

describe('the person catalogue', () => {
  it('has a sample for every tool and every tool reads as the person, as the owning app', async () => {
    for (const t of PERSON_TOOLS) {
      expect(SAMPLES, `no sample for ${t.name}`).toHaveProperty(t.name);
      const rec = recorder({ items: [], engagements: [], program: {} });
      const client = new PersonClient({ apiUrl: 'http://api.test', jwt: 'jwt-1', fetch: rec.fetch });
      await t.run(client, SAMPLES[t.name] as never);
      if (t.local) expect(rec.calls.length, `${t.name} is local and must not call the API`).toBe(0);
      else expect(rec.calls.length, t.name).toBeGreaterThan(0);
      for (const call of rec.calls) {
        const path = new URL(call.url).pathname;
        expect(call.headers.authorization, `${t.name} ${path}`).toBe('Bearer jwt-1');
        const owner = Object.entries(OWNER).find(([p]) => path.startsWith(p))?.[1];
        expect(owner, `${t.name} calls an unexpected route ${path}`).toBeDefined();
        expect(call.headers['x-app-id'], `${t.name} ${path}`).toBe(owner);
      }
    }
  });

  it('offers only what the grant’s scopes allow, and writes only behind thread:write', () => {
    expect(personToolsForScopes([]).map((t) => t.name)).toEqual([]);
    const c = personToolsForScopes(['connections:read']).map((t) => t.name);
    expect(c).toContain('connections_today');
    expect(c).not.toContain('thread_list');
    const reads = personToolsForScopes(['connections:read', 'thread:read']);
    expect(reads.every((t) => !t.write)).toBe(true);
    expect(reads.map((t) => t.name)).not.toContain('thread_create');
    const all = personToolsForScopes(['connections:read', 'thread:read', 'thread:write', 'models:read', 'models:write']);
    expect(all.length).toBe(PERSON_TOOLS.length);
    expect(all.filter((t) => t.write).map((t) => t.name).sort()).toEqual(['models_create', 'models_duplicate', 'models_save_scenario', 'models_set_numbers', 'models_update', 'thread_add_engagements', 'thread_create']);
  });

  it('thread_create posts as the person to the real routes, and lands a draft', async () => {
    const rec = recorder({ id: U });
    const client = new PersonClient({ apiUrl: 'http://api.test', jwt: 'j', fetch: rec.fetch });
    const t = PERSON_TOOLS.find((x) => x.name === 'thread_create')!;
    const out = (await t.run(client, { title: 'Year programme fellowship', slug: 'year-programme-fellowship', starts_on: '2026-10-01', ends_on: '2027-12-31' } as never)) as Record<string, unknown>;
    expect(rec.calls[0]!.url).toBe('http://api.test/api/v1/thread/threads');
    expect(rec.calls[0]!.headers['x-app-id']).toBe('the-thread');
    expect(out).toMatchObject({ created: true, thread_id: U, status: 'draft', from_template: null });

    const rec2 = recorder({ id: 'new' });
    const client2 = new PersonClient({ apiUrl: 'http://api.test', jwt: 'j', fetch: rec2.fetch });
    await t.run(client2, { title: 'T', slug: 't', template_id: U, starts_on: '2026-10-01' } as never);
    expect(new URL(rec2.calls[0]!.url).pathname).toBe(`/api/v1/thread/thread-templates/${U}/instantiate`);
  });

  it('thread_add_engagements sorts rows into agenda items and fixed-time messages, all drafts, in the thread’s zone', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetch = async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response(JSON.stringify({ id: `e${bodies.length}` }), { status: 201 });
      }
      return new Response(JSON.stringify({ id: U, timezone: 'Europe/Amsterdam' }), { status: 200 });
    };
    const client = new PersonClient({ apiUrl: 'http://api.test', jwt: 'j', fetch });
    const t = PERSON_TOOLS.find((x) => x.name === 'thread_add_engagements')!;
    const out = (await t.run(client, {
      thread_id: U,
      items: [
        { title: 'Gathering', type: 'event', date: '2026-10-06' },
        { title: 'Invitation', type: 'message', date: '2026-10-08' },
        { title: 'Responses written', type: 'event', date: '2026-11-23', show_in_agenda: false },
      ],
    } as never)) as Record<string, unknown>;
    expect(out).toMatchObject({ added: 3, failed: 0, all_drafts: true, timezone: 'Europe/Amsterdam' });
    expect(bodies[0]).toMatchObject({ type: 'event', status: 'draft', starts_at: '2026-10-06T10:00:00+02:00', ends_at: '2026-10-06T11:00:00+02:00' });
    expect(bodies[1]).toMatchObject({ type: 'message', status: 'draft', trigger_kind: 'fixed', scheduled_at: '2026-10-08T09:00:00+02:00' });
    expect(bodies[1]).not.toHaveProperty('starts_at');
    // November is winter time: +01:00, and the internal flag rides along.
    expect(bodies[2]).toMatchObject({ show_in_agenda: false, starts_at: '2026-11-23T10:00:00+01:00' });
    expect(bodies.every((b) => b.status === 'draft')).toBe(true);
  });

  it('a plan refusal on the first item stops the batch and says why', async () => {
    const fetch = async (url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ error: 'adding timeline elements needs a higher plan' }), { status: 403 })
        : new Response(JSON.stringify({ id: U, timezone: 'UTC' }), { status: 200 });
    const client = new PersonClient({ apiUrl: 'http://api.test', jwt: 'j', fetch });
    const t = PERSON_TOOLS.find((x) => x.name === 'thread_add_engagements')!;
    const out = (await t.run(client, { thread_id: U, items: [{ title: 'a', type: 'event', date: '2026-10-06' }, { title: 'b', type: 'event', date: '2026-10-07' }] } as never)) as { added: number; items: unknown[] };
    expect(out.added).toBe(0);
    expect(out.items).toHaveLength(1);
    expect(JSON.stringify(out.items[0])).toMatch(/Not allowed \(403\)/);
  });

  it('zonedIso gives the zone’s own offset, summer and winter', () => {
    expect(zonedIso('2026-07-01', '10:00', 'Europe/Amsterdam')).toBe('2026-07-01T10:00:00+02:00');
    expect(zonedIso('2026-12-18', '09:00', 'Europe/Amsterdam')).toBe('2026-12-18T09:00:00+01:00');
    expect(zonedIso('2026-12-18', '09:00', 'UTC')).toBe('2026-12-18T09:00:00+00:00');
    expect(zonedIso('2026-12-18', '09:00', 'America/New_York')).toBe('2026-12-18T09:00:00-05:00');
  });

  it('the schedule prompt is offered only with thread:write and carries the pasted rows', () => {
    const text = schedulePromptText('Tue 6 Oct\tFellowship introduced [event]\nThu 8 Oct\tInvitation sent', 'Year programme fellowship');
    expect(text).toMatch(/called "Year programme fellowship"/);
    expect(text).toMatch(/Fellowship introduced \[event\]/);
    expect(text).toMatch(/thread_add_engagements/);
  });

  it('registration counts reach the assistant as counts', async () => {
    const rec = recorder({
      items: [
        { payment_status: 'paid', checked_in_at: 'x', enrolment: { status: 'enrolled' }, person: { first_name: 'Marja', email: 'm@example.org' } },
        { payment_status: null, checked_in_at: null, enrolment: { status: 'invited' }, person: { first_name: 'Daniel' } },
      ],
    });
    const client = new PersonClient({ apiUrl: 'http://api.test', jwt: 'j', fetch: rec.fetch });
    const t = PERSON_TOOLS.find((x) => x.name === 'thread_enrolment_summary')!;
    const out = JSON.stringify(await t.run(client, { thread_id: U } as never));
    expect(out).toContain('"total":2');
    expect(out).not.toContain('Marja');
    expect(out).not.toContain('example.org');
  });

  it('works end to end over an MCP transport, read-only annotations and all', async () => {
    const rec = recorder({ now: 'x', horizon: 'today', segments: [], calendar: 'none', owed: [], prepare: [] });
    const client = new PersonClient({ apiUrl: 'http://api.test', jwt: 'j', fetch: rec.fetch });
    const server = buildPersonServer({ client, scopes: ['connections:read'], who: { workspace: 'Solidarity Lab', clientName: 'Claude' }, version: '0-test' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st);
    const mcp = new Client({ name: 'test', version: '0' });
    await mcp.connect(ct);
    expect(mcp.getInstructions()).toMatch(/Solidarity Lab/);
    const { tools } = await mcp.listTools();
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
    // No write scope → no prompt either (the server does not even advertise prompts).
    const listed = await mcp.listPrompts().then((r) => r.prompts.map((p) => p.name)).catch(() => []);
    expect(listed).toEqual([]);
    const res = await mcp.callTool({ name: 'connections_today', arguments: {} });
    expect(res.isError).toBeFalsy();
    expect(new URL(rec.calls[0]!.url).pathname).toBe('/api/v1/connections/today');
  });

  it('with thread:write the write tools are marked as such and the schedule prompt is offered', async () => {
    const rec = recorder({ id: U });
    const client = new PersonClient({ apiUrl: 'http://api.test', jwt: 'j', fetch: rec.fetch });
    const server = buildPersonServer({ client, scopes: ['thread:read', 'thread:write'], who: { workspace: 'soul.com', clientName: 'Claude' }, version: '0-test' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st);
    const mcp = new Client({ name: 'test', version: '0' });
    await mcp.connect(ct);
    const { tools } = await mcp.listTools();
    const create = tools.find((t) => t.name === 'thread_create')!;
    expect(create.annotations?.readOnlyHint).toBe(false);
    expect(tools.find((t) => t.name === 'thread_list')!.annotations?.readOnlyHint).toBe(true);
    const { prompts } = await mcp.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(['plan_thread_from_schedule']);
    const got = await mcp.getPrompt({ name: 'plan_thread_from_schedule', arguments: { schedule: 'Tue 6 Oct\tGathering [event]', title: 'Fellowship' } });
    const text = (got.messages[0]!.content as { text: string }).text;
    expect(text).toMatch(/Gathering \[event\]/);
    expect(mcp.getInstructions()).toMatch(/thread_add_engagements/);
  });
});
