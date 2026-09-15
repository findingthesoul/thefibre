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
