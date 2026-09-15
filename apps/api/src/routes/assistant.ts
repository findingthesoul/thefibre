// The in-app assistant — docs/assistant-in-app.md.
//
// POST /api/v1/assistant/chat   one turn; the client holds the conversation
// GET  /api/v1/assistant/status is the feature on for this deployment?
//
// User sessions only. An app key has no person behind it and this is a
// person's assistant; the allow-list in middleware/app-context.ts already
// keeps keys out, and the check below makes it explicit.

import { Hono } from 'hono';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { assistantClient, ASSISTANT_MODEL } from '../lib/assistant/model.js';
import { runTurn, type Msg } from '../lib/assistant/loop.js';
import { hit } from '../lib/rate-limit.js';

export const assistantRoutes = new Hono();

// Per user: enough for a working session, not enough to run up a bill by
// holding Enter. The brake on public POSTs does not cover this route.
const TURNS_PER_WINDOW = 40;
const WINDOW_MS = 10 * 60_000;

// Rough shape only — the SDK types the blocks; the API validates them. The
// caps stop a client from posting a novel.
const ChatBody = z.object({
  app: z.literal('the-thread'),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.unknown() })).max(80),
  approve: z.string().max(80).optional(),
  decline: z.string().max(80).optional(),
  locale: z.string().max(10).optional(),
  today: z.string().date().optional(),
});

assistantRoutes.get('/status', (c) => {
  return c.json({ enabled: assistantClient() !== null, model: ASSISTANT_MODEL });
});

assistantRoutes.post('/chat', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId) {
    return c.json({ error: 'the assistant acts for a signed-in person' }, 403);
  }
  const client = assistantClient();
  if (!client) {
    return c.json({ error: 'assistant not configured: ANTHROPIC_API_KEY is not set on this API' }, 503);
  }

  const raw = await c.req.text();
  if (raw.length > 400_000) return c.json({ error: 'conversation too long — start a new one' }, 413);
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    return c.json({ error: 'invalid JSON' }, 400);
  }
  const body = ChatBody.safeParse(json);
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  if (body.data.approve && body.data.decline) return c.json({ error: 'approve or decline, not both' }, 400);

  const brake = hit(`assistant:${ctx.userId}`, TURNS_PER_WINDOW, WINDOW_MS);
  if (!brake.allowed) {
    c.header('Retry-After', String(brake.resetSeconds));
    return c.json({ error: `that is a lot of questions in a short time — try again in ${brake.resetSeconds}s` }, 429);
  }

  const startedAt = Date.now();
  try {
    const out = await runTurn({
      client,
      auth: { jwt: ctx.jwt, userId: ctx.userId, workspaceId: ctx.workspaceId },
      messages: body.data.messages as Msg[],
      approve: body.data.approve,
      decline: body.data.decline,
      today: body.data.today ?? new Date().toISOString().slice(0, 10),
      locale: body.data.locale ?? 'en',
    });
    // Usage, never content: enough to see what the feature costs per
    // workspace, nothing that says what anyone asked.
    console.log(
      `[assistant] ws=${ctx.workspaceId} user=${ctx.userId} in=${out.usage.input_tokens} cached=${out.usage.cache_read_input_tokens} out=${out.usage.output_tokens} steps=${out.steps.length} stop=${out.stop} ms=${Date.now() - startedAt}`,
    );
    return c.json(out);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return c.json({ error: 'the assistant is busy — try again in a moment' }, 503);
    }
    if (e instanceof Anthropic.AuthenticationError) {
      console.error('[assistant] the ANTHROPIC_API_KEY on this API was refused');
      return c.json({ error: 'assistant misconfigured' }, 503);
    }
    if (e instanceof Anthropic.APIError) {
      console.error(`[assistant] model API ${e.status}: ${e.message}`);
      return c.json({ error: 'the assistant could not answer' }, 502);
    }
    console.error('[assistant] turn failed', e);
    return c.json({ error: 'the assistant could not answer' }, 500);
  }
});
