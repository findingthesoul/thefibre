// The in-app assistant — docs/assistant-in-app.md.
//
// POST /api/v1/assistant/chat            one turn; the client holds the conversation
// GET  /api/v1/assistant/status          may THIS workspace use it, on whose key, how much is left
// GET  /api/v1/assistant/usage           last 30 days, counts only
// PUT  /api/v1/assistant/workspace-key   connect the workspace's own Anthropic key (admin)
// DELETE                                 disconnect it (admin)
//
// User sessions only. An app key has no person behind it and this is a
// person's assistant; the allow-list in middleware/app-context.ts already
// keeps keys out, and the check below makes it explicit.

import { Hono } from 'hono';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { ASSISTANT_MODEL } from '../lib/assistant/model.js';
import {
  assistantAccess,
  publicAccess,
  recordUsage,
  removeWorkspaceKey,
  saveWorkspaceKey,
  usageHistory,
} from '../lib/assistant/access.js';
import { runTurn, type Msg } from '../lib/assistant/loop.js';
import { hit } from '../lib/rate-limit.js';
import { requireWorkspaceAdmin } from './apps.js';

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

function offMessage(reason: string | null): string {
  switch (reason) {
    case 'plan':
      return 'The assistant is not part of this workspace’s plan. Settings → Assistant has the options.';
    case 'budget':
      return 'This workspace has used its assistant allowance for today. It resets at midnight UTC; a workspace can also connect its own key in Settings → Assistant.';
    case 'no_platform_key':
      return 'The assistant is not switched on for this deployment.';
    default:
      return 'The assistant is not available.';
  }
}

assistantRoutes.get('/status', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ enabled: false, reason: 'user session required' }, 403);
  const access = await assistantAccess(ctx.workspaceId);
  return c.json({ ...publicAccess(access), model: ASSISTANT_MODEL });
});

assistantRoutes.get('/usage', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 403);
  return c.json({ items: await usageHistory(ctx.workspaceId) });
});

const KeyBody = z.object({ key: z.string().min(20).max(400) });

assistantRoutes.put('/workspace-key', async (c) => {
  const ctx = c.get('ctx');
  const denied = await requireWorkspaceAdmin(ctx);
  if (denied) return c.json({ error: denied }, 403);
  const body = KeyBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'a key is required' }, 400);
  const r = await saveWorkspaceKey(ctx.workspaceId, body.data.key, ctx.userId);
  if (!r.ok) return c.json({ error: r.reason }, 400);
  // The key itself is not echoed. The hint is all anyone sees from here on.
  return c.json({ ok: true, key_hint: r.hint });
});

assistantRoutes.delete('/workspace-key', async (c) => {
  const ctx = c.get('ctx');
  const denied = await requireWorkspaceAdmin(ctx);
  if (denied) return c.json({ error: denied }, 403);
  await removeWorkspaceKey(ctx.workspaceId);
  return c.json({ ok: true });
});

assistantRoutes.post('/chat', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId) {
    return c.json({ error: 'the assistant acts for a signed-in person' }, 403);
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

  const access = await assistantAccess(ctx.workspaceId);
  if (!access.enabled || !access.client || !access.source) {
    return c.json({ error: offMessage(access.reason), reason: access.reason }, access.reason === 'budget' ? 429 : 403);
  }

  const startedAt = Date.now();
  try {
    const out = await runTurn({
      client: access.client,
      auth: { jwt: ctx.jwt, userId: ctx.userId, workspaceId: ctx.workspaceId },
      messages: body.data.messages as Msg[],
      approve: body.data.approve,
      decline: body.data.decline,
      today: body.data.today ?? new Date().toISOString().slice(0, 10),
      locale: body.data.locale ?? 'en',
    });
    await recordUsage(ctx.workspaceId, access.source, out.usage);
    // Usage, never content: enough to see what the feature costs per
    // workspace, nothing that says what anyone asked.
    console.log(
      `[assistant] ws=${ctx.workspaceId} user=${ctx.userId} key=${access.source} in=${out.usage.input_tokens} cached=${out.usage.cache_read_input_tokens} out=${out.usage.output_tokens} steps=${out.steps.length} stop=${out.stop} ms=${Date.now() - startedAt}`,
    );
    return c.json(out);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return c.json({ error: 'the assistant is busy — try again in a moment' }, 503);
    }
    if (e instanceof Anthropic.AuthenticationError) {
      console.error(`[assistant] the ${access.source} key was refused by Anthropic`);
      return c.json(
        {
          error:
            access.source === 'workspace'
              ? 'Anthropic refused this workspace’s key. Reconnect it in Settings → Assistant.'
              : 'assistant misconfigured',
        },
        503,
      );
    }
    if (e instanceof Anthropic.APIError) {
      console.error(`[assistant] model API ${e.status}: ${e.message}`);
      return c.json({ error: 'the assistant could not answer' }, 502);
    }
    console.error('[assistant] turn failed', e);
    return c.json({ error: 'the assistant could not answer' }, 500);
  }
});
