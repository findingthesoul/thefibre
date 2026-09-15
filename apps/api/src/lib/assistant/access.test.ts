// The access decision, as Sjoerd made it on 2026-09-15: own key → plan +
// budget on the platform key → off. Free never gets the platform key. The
// database and the plan library are stubbed; nothing here talks to Postgres
// or Anthropic.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- stubs ------------------------------------------------------------------
const db = {
  workspace_assistant: new Map<string, { key_ciphertext: string; key_hint: string }>(),
  usage: [] as { workspace_id: string; day: string; source: string; input_tokens: number; output_tokens: number; turns: number }[],
  upserts: [] as Record<string, unknown>[],
};

function table(name: string) {
  const filters: Record<string, unknown> = {};
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => {
      filters[k] = v;
      return q;
    },
    gte: () => q,
    order: () => q,
    maybeSingle: async () => {
      if (name === 'workspace_assistant') return { data: db.workspace_assistant.get(String(filters.workspace_id)) ?? null };
      if (name === 'assistant_usage') {
        const row = db.usage.find((r) => r.workspace_id === filters.workspace_id && r.day === filters.day && r.source === filters.source);
        return { data: row ?? null };
      }
      return { data: null };
    },
    then: (resolve: (v: { data: unknown[] }) => void) => {
      const rows = db.usage.filter((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v));
      resolve({ data: rows });
    },
    upsert: async (row: Record<string, unknown>) => {
      db.upserts.push(row);
      return { error: null };
    },
    delete: () => ({ eq: async () => ({ error: null }) }),
  };
  return q;
}

vi.mock('../../db.js', () => ({ adminClient: { from: (name: string) => table(name) } }));

const plan = { id: 'pro', name: 'Pro', features: {} as Record<string, unknown> };
vi.mock('../plan.js', () => ({
  planFor: async () => plan,
  can: async (_ws: string, f: string) => plan.features[f] === true,
}));

let platformOn = true;
vi.mock('./model.js', () => ({
  assistantClient: () => (platformOn ? { tag: 'platform' } : null),
  clientForKey: (k: string) => ({ tag: `key:${k}` }),
  verifyKey: async (k: string) => (k.endsWith('good') ? { ok: true } : { ok: false, reason: 'refused' }),
}));

const { assistantAccess, recordUsage, saveWorkspaceKey, DEFAULT_TOKENS_PER_DAY } = await import('./access.js');
const { encryptSecret } = await import('./secret.js');

const WS = 'ws-1';
const today = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  process.env.SSO_INTERNAL_SECRET = 'a-secret-long-enough-for-tests-0123456789';
  db.workspace_assistant.clear();
  db.usage = [];
  db.upserts = [];
  plan.id = 'pro';
  plan.name = 'Pro';
  plan.features = { assistant: true, assistant_tokens_day: 1000 };
  platformOn = true;
});

describe('assistantAccess', () => {
  it('Free has no assistant, whatever key the platform holds', async () => {
    plan.id = 'free';
    plan.name = 'Free';
    plan.features = {};
    const a = await assistantAccess(WS);
    expect(a.enabled).toBe(false);
    expect(a.reason).toBe('plan');
    expect(a.client).toBeNull();
  });

  it('Pro runs on the platform key within the daily budget', async () => {
    db.usage.push({ workspace_id: WS, day: today, source: 'platform', input_tokens: 400, output_tokens: 100, turns: 3 });
    const a = await assistantAccess(WS);
    expect(a.enabled).toBe(true);
    expect(a.source).toBe('platform');
    expect(a.budget).toEqual({ day: today, used_tokens: 500, limit_tokens: 1000 });
    expect((a.client as unknown as { tag: string }).tag).toBe('platform');
  });

  it('a workspace over budget is paused, not cut off', async () => {
    db.usage.push({ workspace_id: WS, day: today, source: 'platform', input_tokens: 900, output_tokens: 200, turns: 9 });
    const a = await assistantAccess(WS);
    expect(a.enabled).toBe(false);
    expect(a.reason).toBe('budget');
  });

  it('usage on a workspace key does not count against the platform budget', async () => {
    db.usage.push({ workspace_id: WS, day: today, source: 'workspace', input_tokens: 99_999, output_tokens: 1, turns: 50 });
    const a = await assistantAccess(WS);
    expect(a.enabled).toBe(true);
    expect(a.budget.used_tokens).toBe(0);
  });

  it('a workspace key wins over plan and budget, and the hint is all that shows', async () => {
    plan.id = 'free';
    plan.features = {};
    platformOn = false;
    db.workspace_assistant.set(WS, { key_ciphertext: encryptSecret('sk-ant-workspace-key-good'), key_hint: 'good' });
    const a = await assistantAccess(WS);
    expect(a.enabled).toBe(true);
    expect(a.source).toBe('workspace');
    expect(a.key_hint).toBe('good');
    expect((a.client as unknown as { tag: string }).tag).toBe('key:sk-ant-workspace-key-good');
    expect(JSON.stringify({ ...a, client: undefined })).not.toContain('sk-ant-workspace');
  });

  it('without a platform key and without an own key it is simply off', async () => {
    platformOn = false;
    const a = await assistantAccess(WS);
    expect(a.enabled).toBe(false);
    expect(a.reason).toBe('no_platform_key');
  });

  it('the default budget applies when the plan sets none', async () => {
    plan.features = { assistant: true };
    const a = await assistantAccess(WS);
    expect(a.budget.limit_tokens).toBe(DEFAULT_TOKENS_PER_DAY);
  });

  it('an unreadable stored key (secret rotated) falls back rather than crashing', async () => {
    db.workspace_assistant.set(WS, { key_ciphertext: encryptSecret('sk-ant-old-secret-good'), key_hint: 'good' });
    process.env.SSO_INTERNAL_SECRET = 'a-different-secret-after-rotation-9876543210';
    const a = await assistantAccess(WS);
    expect(a.source).toBe('platform');
    expect(a.key_hint).toBeNull();
  });
});

describe('saveWorkspaceKey', () => {
  it('refuses something that is not an Anthropic key before calling anyone', async () => {
    const r = await saveWorkspaceKey(WS, 'fibre_ak_not_an_anthropic_key_at_all', 'u1');
    expect(r).toMatchObject({ ok: false });
    expect(db.upserts).toHaveLength(0);
  });

  it('checks the key with Anthropic and stores only ciphertext + hint', async () => {
    const r = await saveWorkspaceKey(WS, 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz-good', 'u1');
    expect(r).toEqual({ ok: true, hint: 'good' });
    const row = db.upserts[0]!;
    expect(row.key_hint).toBe('good');
    expect(String(row.key_ciphertext)).not.toContain('sk-ant');
    expect(row.added_by).toBe('u1');
  });

  it('does not store a key Anthropic refuses', async () => {
    const r = await saveWorkspaceKey(WS, 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz-bad', 'u1');
    expect(r).toMatchObject({ ok: false, reason: 'refused' });
    expect(db.upserts).toHaveLength(0);
  });
});

describe('recordUsage', () => {
  it('adds to today’s row for the paying key', async () => {
    db.usage.push({ workspace_id: WS, day: today, source: 'platform', input_tokens: 10, output_tokens: 5, turns: 1 });
    await recordUsage(WS, 'platform', { input_tokens: 30, output_tokens: 7 });
    expect(db.upserts[0]).toMatchObject({ workspace_id: WS, day: today, source: 'platform', turns: 2, input_tokens: 40, output_tokens: 12 });
  });
});
