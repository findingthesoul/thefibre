// Who may use the assistant, on whose key, within what budget.
//
// docs/assistant-in-app.md §1.4 + §6.2 (Sjoerd, 2026-09-15):
//   - Free: no assistant.
//   - Starter, Pro: an allowance on the PLATFORM's key — `assistant` flag +
//     `assistant_tokens_day` on billing_plan.features, read through lib/plan.
//   - Any workspace may bring its OWN Anthropic key (workspace_assistant).
//     That lifts the plan gate and the daily budget: they pay Anthropic.
//   - The daily budget protects the platform key. It is per workspace per
//     UTC day, counted in tokens in + out, written after every turn.
//
// The order below is the decision, in code: own key → plan + budget → off.

import type Anthropic from '@anthropic-ai/sdk';
import { adminClient } from '../../db.js';
import { can, planFor } from '../plan.js';
import { assistantClient, clientForKey, verifyKey } from './model.js';
import { decryptSecret, encryptSecret, hintOf } from './secret.js';

export const DEFAULT_TOKENS_PER_DAY = 200_000;

export type AccessSource = 'workspace' | 'platform';
export type OffReason = 'no_platform_key' | 'plan' | 'budget';

export interface Access {
  enabled: boolean;
  source: AccessSource | null;
  reason: OffReason | null;
  plan: { id: string; name: string; allows: boolean; tokens_day: number | null };
  budget: { day: string; used_tokens: number; limit_tokens: number | null };
  /** Last four characters of the workspace's own key, when one is connected. */
  key_hint: string | null;
  /** Only set when enabled. Never serialised. */
  client: Anthropic | null;
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function usedToday(workspaceId: string, day: string): Promise<number> {
  const { data } = await adminClient
    .from('assistant_usage')
    .select('input_tokens, output_tokens, source')
    .eq('workspace_id', workspaceId)
    .eq('day', day);
  // The budget is about the PLATFORM's spend; a workspace's own key is theirs.
  return (data ?? [])
    .filter((r) => r.source === 'platform')
    .reduce((n, r) => n + Number(r.input_tokens ?? 0) + Number(r.output_tokens ?? 0), 0);
}

async function workspaceKey(workspaceId: string): Promise<{ key: string; hint: string } | null> {
  const { data } = await adminClient
    .from('workspace_assistant')
    .select('key_ciphertext, key_hint')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (!data?.key_ciphertext) return null;
  try {
    return { key: decryptSecret(data.key_ciphertext as string), hint: data.key_hint as string };
  } catch (e) {
    // SSO_INTERNAL_SECRET rotated, or a corrupt row. Treat as "no key" and
    // say so once in the log; Settings will show "connect your key again".
    console.error(`[assistant] workspace ${workspaceId}: stored key unreadable — ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

export async function assistantAccess(workspaceId: string): Promise<Access> {
  const day = todayUTC();
  const [plan, own, used] = await Promise.all([planFor(workspaceId), workspaceKey(workspaceId), usedToday(workspaceId, day)]);
  const allows = await can(workspaceId, 'assistant');
  const limitRaw = plan.features.assistant_tokens_day;
  const limit = typeof limitRaw === 'number' && limitRaw > 0 ? limitRaw : allows ? DEFAULT_TOKENS_PER_DAY : null;
  const base = {
    plan: { id: plan.id, name: plan.name, allows, tokens_day: limit },
    budget: { day, used_tokens: used, limit_tokens: limit },
    key_hint: own?.hint ?? null,
  };

  if (own) {
    return { ...base, enabled: true, source: 'workspace', reason: null, client: clientForKey(own.key) };
  }
  const platform = assistantClient();
  if (!platform) return { ...base, enabled: false, source: null, reason: 'no_platform_key', client: null };
  if (!allows) return { ...base, enabled: false, source: null, reason: 'plan', client: null };
  if (limit !== null && used >= limit) return { ...base, enabled: false, source: null, reason: 'budget', client: null };
  return { ...base, enabled: true, source: 'platform', reason: null, client: platform };
}

/** What the API tells a client. The client is never in it. */
export function publicAccess(a: Access): Omit<Access, 'client'> {
  const { client: _client, ...rest } = a;
  return rest;
}

export async function recordUsage(
  workspaceId: string,
  source: AccessSource,
  usage: { input_tokens: number; output_tokens: number },
): Promise<void> {
  const day = todayUTC();
  // Read-add-write. Two turns from one workspace in the same instant can
  // under-count by one turn; a budget is a brake, not a ledger, so that is
  // accepted rather than paid for with a definer function.
  const { data } = await adminClient
    .from('assistant_usage')
    .select('turns, input_tokens, output_tokens')
    .eq('workspace_id', workspaceId)
    .eq('day', day)
    .eq('source', source)
    .maybeSingle();
  const { error } = await adminClient.from('assistant_usage').upsert(
    {
      workspace_id: workspaceId,
      day,
      source,
      turns: Number(data?.turns ?? 0) + 1,
      input_tokens: Number(data?.input_tokens ?? 0) + usage.input_tokens,
      output_tokens: Number(data?.output_tokens ?? 0) + usage.output_tokens,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,day,source' },
  );
  if (error) console.error('[assistant] usage write failed', error.message);
}

export async function saveWorkspaceKey(
  workspaceId: string,
  key: string,
  userId: string,
): Promise<{ ok: true; hint: string } | { ok: false; reason: string }> {
  const trimmed = key.trim();
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    return { ok: false, reason: 'That does not look like an Anthropic API key (they start with sk-ant-).' };
  }
  const check = await verifyKey(trimmed);
  if (!check.ok) return check;
  const hint = hintOf(trimmed);
  const { error } = await adminClient.from('workspace_assistant').upsert(
    {
      workspace_id: workspaceId,
      key_ciphertext: encryptSecret(trimmed),
      key_hint: hint,
      added_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id' },
  );
  if (error) return { ok: false, reason: error.message };
  return { ok: true, hint };
}

export async function removeWorkspaceKey(workspaceId: string): Promise<void> {
  await adminClient.from('workspace_assistant').delete().eq('workspace_id', workspaceId);
}

/** Last 30 days, for Settings → Assistant. Counts only. */
export async function usageHistory(workspaceId: string): Promise<
  { day: string; source: string; turns: number; input_tokens: number; output_tokens: number }[]
> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await adminClient
    .from('assistant_usage')
    .select('day, source, turns, input_tokens, output_tokens')
    .eq('workspace_id', workspaceId)
    .gte('day', since)
    .order('day', { ascending: false });
  return (data ?? []).map((r) => ({
    day: r.day as string,
    source: r.source as string,
    turns: Number(r.turns),
    input_tokens: Number(r.input_tokens),
    output_tokens: Number(r.output_tokens),
  }));
}
