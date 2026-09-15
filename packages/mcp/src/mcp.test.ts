// What these tests prove, and what they don't.
//
// They prove the MCP layer is a faithful, thin client of the app-key contract:
//   1. every tool maps onto a (method, path) the API's own allow-list accepts,
//      with a scope no looser than the allow-list's — read straight from
//      apps/api/src/middleware/app-context.ts, so the table cannot drift from
//      this test without failing it;
//   2. the tool list a client sees is filtered by the key's scopes;
//   3. requests carry the key as a bearer and nothing else; a refusal from the
//      API comes back as a tool error, not an exception;
//   4. the whole thing works end-to-end over a real MCP transport.
//
// They do NOT exercise the API. verify-external-app.mjs does that.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { FibreClient, FibreApiError, type FetchLike, type WhoAmI } from './client.js';
import { TOOLS, toolsForScopes } from './tools.js';
import { buildServer } from './server.js';

const KEY = 'fibre_ak_test_0000000000000000';
const SLUG = 'my-app';
const U = '11111111-2222-4333-8444-555555555555';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// ---------------------------------------------------------------------------
// The API's allow-list, read from source. One regex per row; the row's own
// regex source is reused, so this is the table the middleware actually runs.
// ---------------------------------------------------------------------------
type Row = { method: string; test: RegExp; scope: string | null };
function readAllowList(): Row[] {
  const src = readFileSync(resolve(ROOT, 'apps/api/src/middleware/app-context.ts'), 'utf8');
  const rows: Row[] = [];
  const re = /\{\s*method:\s*'([A-Z]+)',\s*test:\s*\/(.+?)\/,\s*scope:\s*(null|'([^']+)')\s*\}/g;
  for (const m of src.matchAll(re)) {
    rows.push({ method: m[1]!, test: new RegExp(m[2]!), scope: m[4] ?? null });
  }
  return rows;
}

/** A fake fetch that records the request and answers with a canned body. */
function recorder(answer: unknown = { ok: true }, status = 200) {
  const calls: { method: string; url: string; headers: Record<string, string>; body: unknown }[] = [];
  const fetch: FetchLike = async (url, init) => {
    const headers = Object.fromEntries(
      Object.entries((init?.headers as Record<string, string>) ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    );
    calls.push({
      method: init?.method ?? 'GET',
      url,
      headers,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify(answer), {
      status,
      headers: { 'content-type': 'application/json', ...(status === 429 ? { 'retry-after': '7' } : {}) },
    });
  };
  return { calls, fetch };
}

// Sample arguments per tool. Every tool must have one — a new tool without
// a sample fails the coverage assertion below, so it cannot ship untested.
const ref = { app_entity: 'thing', app_record_id: 'r-1' };
const SAMPLES: Record<string, Record<string, unknown>> = {
  fibre_whoami: {},
  fibre_get_manifest: {},
  fibre_link_record: { ...ref, match_on: { email: 'a@b.co' } },
  fibre_link_records: { links: [{ ...ref, match_on: { email: 'a@b.co' } }] },
  fibre_get_link: ref,
  fibre_get_person: ref,
  fibre_get_organisation: ref,
  fibre_add_org_membership: { person: ref, organisation: ref, title: 'Chair' },
  fibre_log_activity: { person_id: U, type: 'note', subject: 'Hello' },
  fibre_list_activities: { person_id: U, limit: 10 },
  fibre_thread_templates: {},
  fibre_thread_publish: { title: 'T', format: 'event', slug: 'my-event' },
  fibre_thread_list: {},
  fibre_thread_get: { thread_id: U },
  fibre_thread_update: { thread_id: U, status: 'active' },
  fibre_thread_add_host: { thread_id: U, person: ref },
  fibre_thread_enrolments: { thread_id: U },
  fibre_thread_approve_enrolment: { enrolment_id: U },
  fibre_thread_decline_enrolment: { enrolment_id: U },
  fibre_thread_checkin_lookup: { code: 'a'.repeat(32) },
  fibre_thread_checkin: { enrolment_id: U, undo: true },
  fibre_thread_engagements: { thread_id: U },
  fibre_thread_add_engagement: { thread_id: U, engagement: { source_ref: U, title: 'Opening', type: 'session' } },
  fibre_thread_update_engagement: { engagement_id: U, changes: { title: 'Renamed' } },
  fibre_thread_delete_engagement: { engagement_id: U },
  fibre_flow_list: {},
  fibre_flow_get: { flow_id: U },
  fibre_flow_start_run: { flow_id: U, subject_label: 'Athens', source_ref: U },
  fibre_flow_runs: { flow_id: U },
  fibre_flow_get_run: { run_id: U },
  fibre_flow_move_run: { run_id: U, step_key: 'grow' },
  fibre_flow_add_task: { run_id: U, title: 'Book venue' },
  fibre_flow_update_task: { task_id: U, status: 'done' },
  fibre_flow_get_note: { run_id: U, step_key: 'grow' },
  fibre_flow_set_note: { run_id: U, step_key: 'grow', body: 'Went well' },
};

describe('the tool catalogue is a thin client of the app-key allow-list', () => {
  const rows = readAllowList();

  it('found the allow-list in the API source', () => {
    expect(rows.length).toBeGreaterThan(30);
  });

  it('has unique tool names and a sample for every tool', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(SAMPLES, `no sample args for ${n}`).toHaveProperty(n);
    for (const n of Object.keys(SAMPLES)) expect(names, `sample for unknown tool ${n}`).toContain(n);
  });

  for (const def of TOOLS) {
    it(`${def.name} → a route the allow-list accepts, at a scope no looser than the API's`, async () => {
      const rec = recorder();
      const client = new FibreClient({ apiUrl: 'http://api.test', appKey: KEY, fetch: rec.fetch });
      await def.run(client, SLUG, SAMPLES[def.name] as never);
      expect(rec.calls).toHaveLength(1);
      const call = rec.calls[0]!;
      const path = new URL(call.url).pathname;
      const match = rows.find((r) => r.method === call.method && r.test.test(path));
      expect(match, `${call.method} ${path} is not in the allow-list`).toBeDefined();
      // The API's scope for the row, or null. A tool may demand MORE than the
      // row (delete engagement rides write:messages on both sides) but never
      // offer itself to a key the API would refuse.
      if (match!.scope !== null) {
        expect(def.scope, `${def.name} would be offered without ${match!.scope}`).not.toBeNull();
      }
      if (def.scope !== null && match!.scope !== null && def.scope !== match!.scope) {
        // The one sanctioned divergence: none today. Fail loudly if one appears.
        throw new Error(`${def.name} gates on ${def.scope} but the API row gates on ${match!.scope}`);
      }
    });
  }

  it('offers only the tools a key\'s scopes allow', () => {
    const none = toolsForScopes([]).map((t) => t.name);
    expect(none).toEqual(['fibre_whoami', 'fibre_get_manifest']);

    const flowsRead = toolsForScopes(['read:flows']).map((t) => t.name);
    expect(flowsRead).toContain('fibre_flow_get_run');
    expect(flowsRead).not.toContain('fibre_flow_move_run');
    expect(flowsRead).not.toContain('fibre_log_activity');
  });
});

describe('FibreClient', () => {
  it('refuses something that is not an app key', () => {
    expect(() => new FibreClient({ appKey: 'eyJhbGciOi...' })).toThrow(/does not look like an app key/);
  });

  it('sends the key as a bearer, JSON in, JSON out, query strings without empties', async () => {
    const rec = recorder({ items: [], next: null });
    const c = new FibreClient({ apiUrl: 'http://api.test/', appKey: KEY, fetch: rec.fetch });
    const out = await c.request('GET', '/api/v1/activities', undefined, { limit: 5, type: undefined, after: '' });
    expect(out).toEqual({ items: [], next: null });
    const call = rec.calls[0]!;
    expect(call.url).toBe('http://api.test/api/v1/activities?limit=5');
    expect(call.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(call.headers['x-app-id']).toBeUndefined();
    expect(call.body).toBeUndefined();
  });

  it('treats 207 as an answer and everything else non-2xx as an error it can describe', async () => {
    const partial = recorder({ total: 2, linked: 1, failed: 1, results: [] }, 207);
    const c1 = new FibreClient({ apiUrl: 'http://api.test', appKey: KEY, fetch: partial.fetch });
    await expect(c1.request('POST', '/x', {})).resolves.toMatchObject({ failed: 1 });

    const denied = recorder({ error: 'scope write:messages required' }, 403);
    const c2 = new FibreClient({ apiUrl: 'http://api.test', appKey: KEY, fetch: denied.fetch });
    const err = await c2.request('POST', '/x', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FibreApiError);
    expect((err as FibreApiError).describe()).toMatch(/not allowed.*403[\s\S]*write:messages/);

    const braked = recorder({ error: 'slow down' }, 429);
    const c3 = new FibreClient({ apiUrl: 'http://api.test', appKey: KEY, fetch: braked.fetch });
    const e3 = (await c3.request('GET', '/x').catch((e: unknown) => e)) as FibreApiError;
    expect(e3.describe()).toMatch(/retry after 7s/);
  });
});

describe('over a real MCP transport', () => {
  const whoami: WhoAmI = {
    auth: 'app_key',
    app_slug: SLUG,
    workspace_id: U,
    scopes: ['read:persons', 'write:activities'],
  };

  async function connect(fetch: FetchLike) {
    const fibre = new FibreClient({ apiUrl: 'http://api.test', appKey: KEY, fetch });
    const server = buildServer({ client: fibre, whoami, version: '0.0.0-test' });
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    await server.connect(serverT);
    const mcp = new Client({ name: 'test', version: '0' });
    await mcp.connect(clientT);
    return { mcp, server };
  }

  it('lists exactly the scoped tools, with honest annotations', async () => {
    const { mcp } = await connect(recorder().fetch);
    const { tools } = await mcp.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(toolsForScopes(whoami.scopes).map((t) => t.name).sort());
    const log = tools.find((t) => t.name === 'fibre_log_activity')!;
    expect(log.annotations?.readOnlyHint).toBe(false);
    const get = tools.find((t) => t.name === 'fibre_get_person')!;
    expect(get.annotations?.readOnlyHint).toBe(true);
    expect(get.inputSchema.required).toEqual(expect.arrayContaining(['app_entity', 'app_record_id']));
  });

  it('carries the server instructions', async () => {
    const { mcp } = await connect(recorder().fetch);
    expect(mcp.getInstructions()).toMatch(/app "my-app"/);
    expect(mcp.getInstructions()).toMatch(/read:persons, write:activities/);
  });

  it('runs a tool call through to the API and returns its answer as text', async () => {
    const rec = recorder({ id: U, type: 'note', subject: 'Hello', occurred_at: '2026-09-15T10:00:00Z' });
    const { mcp } = await connect(rec.fetch);
    const res = await mcp.callTool({
      name: 'fibre_log_activity',
      arguments: { person_id: U, type: 'note', subject: 'Hello' },
    });
    expect(res.isError).toBeFalsy();
    const text = (res.content as { type: string; text: string }[])[0]!.text;
    expect(JSON.parse(text)).toMatchObject({ subject: 'Hello' });
    expect(rec.calls[0]).toMatchObject({ method: 'POST', body: { person_id: U, type: 'note', subject: 'Hello' } });
    expect(new URL(rec.calls[0]!.url).pathname).toBe('/api/v1/activities');
  });

  it('turns an API refusal into a tool error the model can read, not a crash', async () => {
    const { mcp } = await connect(recorder({ error: 'person not found in this workspace' }, 404).fetch);
    const res = await mcp.callTool({
      name: 'fibre_log_activity',
      arguments: { person_id: U, type: 'note', subject: 'Hello' },
    });
    expect(res.isError).toBe(true);
    expect((res.content as { text: string }[])[0]!.text).toMatch(/Not found \(404\)[\s\S]*person not found/);
  });

  it('rejects arguments the schema does not allow before anything reaches the API', async () => {
    const rec = recorder();
    const { mcp } = await connect(rec.fetch);
    const res = await mcp
      .callTool({ name: 'fibre_log_activity', arguments: { person_id: 'not-a-uuid', type: 'note', subject: 'x' } })
      .catch((e: unknown) => ({ isError: true, content: [{ type: 'text', text: String(e) }] }));
    expect(res.isError).toBe(true);
    expect(rec.calls).toHaveLength(0);
  });
});
