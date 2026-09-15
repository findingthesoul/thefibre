// The one place the assistant's model and client live.
//
// docs/assistant-in-app.md. The model runs HERE, in the EU API — never in a
// Next.js app (hard rule 1) — and only through this client. The key is a Fly
// secret (docs/deploy.md); without it the assistant is switched off and the
// route answers 503, the same shape Stripe checkout takes without its key.

import Anthropic from '@anthropic-ai/sdk';

/** Pinned in one place. Change it here, nowhere else. */
export const ASSISTANT_MODEL = 'claude-opus-5';

/** Chat turns are short by design; a tool loop is several of these. */
export const ASSISTANT_MAX_TOKENS = 4096;

/** Tool-loop iterations per turn, so a confused model cannot run up a bill. */
export const ASSISTANT_MAX_ITERATIONS = 8;

let cached: Anthropic | null | undefined;

/** `null` when ANTHROPIC_API_KEY is not set — the feature is then off. */
export function assistantClient(): Anthropic | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  cached = apiKey ? new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 }) : null;
  return cached;
}

/** Test seam. */
export function setAssistantClientForTests(client: Anthropic | null | undefined): void {
  cached = client;
}

export function assistantEnabled(): boolean {
  return assistantClient() !== null;
}

// A client per workspace key. Keyed by the key itself (it never leaves this
// map, which never leaves the process); bounded so a churn of keys cannot
// grow it without end.
const byKey = new Map<string, Anthropic>();
export function clientForKey(apiKey: string): Anthropic {
  let c = byKey.get(apiKey);
  if (!c) {
    if (byKey.size > 200) byKey.clear();
    c = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
    byKey.set(apiKey, c);
  }
  return c;
}

/** Prove a key works before storing it: the cheapest authenticated call. */
export async function verifyKey(apiKey: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await new Anthropic({ apiKey, maxRetries: 0, timeout: 15_000 }).models.list({ limit: 1 });
    return { ok: true };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, reason: 'Anthropic did not accept this key.' };
    if (e instanceof Anthropic.PermissionDeniedError) return { ok: false, reason: 'This key is not allowed to use the API.' };
    if (e instanceof Anthropic.APIError) return { ok: false, reason: `Anthropic answered ${e.status}.` };
    return { ok: false, reason: 'Could not reach Anthropic to check the key.' };
  }
}
