// The person-shaped catalogue: every tool is one GET to a user route with
// the person's JWT and the owning app's X-App-ID; the list a client sees
// follows the grant's scopes; and the whole thing works over a real MCP
// transport. The API itself is not exercised — verify-mcp-personal.mjs does
// that against staging.

import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { PERSON_TOOLS, PersonClient, buildPersonServer, personToolsForScopes } from './person.js';

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
};

const OWNER: Record<string, string> = {
  '/api/v1/connections': 'fibre-sales',
  '/api/v1/notes': 'fibre-sales',
  '/api/v1/persons': 'fibre-platform',
  '/api/v1/thread': 'the-thread',
};

describe('the person catalogue', () => {
  it('has a sample for every tool and every tool reads as the person, as the owning app', async () => {
    for (const t of PERSON_TOOLS) {
      expect(SAMPLES, `no sample for ${t.name}`).toHaveProperty(t.name);
      const rec = recorder({ items: [], engagements: [], program: {} });
      const client = new PersonClient({ apiUrl: 'http://api.test', jwt: 'jwt-1', fetch: rec.fetch });
      await t.run(client, SAMPLES[t.name] as never);
      expect(rec.calls.length, t.name).toBeGreaterThan(0);
      for (const call of rec.calls) {
        const path = new URL(call.url).pathname;
        expect(call.headers.authorization, `${t.name} ${path}`).toBe('Bearer jwt-1');
        const owner = Object.entries(OWNER).find(([p]) => path.startsWith(p))?.[1];
        expect(owner, `${t.name} calls an unexpected route ${path}`).toBeDefined();
        expect(call.headers['x-app-id'], `${t.name} ${path}`).toBe(owner);
      }
    }
  });

  it('offers only what the grant’s scopes allow', () => {
    expect(personToolsForScopes([]).map((t) => t.name)).toEqual([]);
    const c = personToolsForScopes(['connections:read']).map((t) => t.name);
    expect(c).toContain('connections_today');
    expect(c).not.toContain('thread_list');
    const both = personToolsForScopes(['connections:read', 'thread:read']);
    expect(both.length).toBe(PERSON_TOOLS.length);
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
    const res = await mcp.callTool({ name: 'connections_today', arguments: {} });
    expect(res.isError).toBeFalsy();
    expect(new URL(rec.calls[0]!.url).pathname).toBe('/api/v1/connections/today');
  });
});
