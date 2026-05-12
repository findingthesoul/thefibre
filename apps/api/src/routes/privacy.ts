import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';
import { CONSENT_PURPOSES } from '@thefibre/shared';

export const privacyRoutes = new Hono();

const ConsentGrant = z.object({
  person_id: z.string().uuid(),
  purpose_code: z.enum(CONSENT_PURPOSES),
  legal_basis: z.enum(['consent', 'legitimate_interest', 'contract', 'legal_obligation']),
  text_version: z.string().max(50).optional(),
});

privacyRoutes.post('/consent', async (c) => {
  const body = ConsentGrant.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const ipHeader =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip');

  const { data, error } = await db
    .from('consent_record')
    .insert({
      user_id: ctx.userId,
      person_id: body.data.person_id,
      purpose_code: body.data.purpose_code,
      legal_basis: body.data.legal_basis,
      text_version: body.data.text_version ?? null,
      ip_address: ipHeader ?? null,
    })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

privacyRoutes.delete('/consent/:purpose_code', async (c) => {
  const purpose = c.req.param('purpose_code');
  if (!(CONSENT_PURPOSES as readonly string[]).includes(purpose)) {
    return c.json({ error: 'unknown purpose' }, 400);
  }
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { error } = await db
    .from('consent_record')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', ctx.userId)
    .eq('purpose_code', purpose)
    .is('revoked_at', null);
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

const ErasureRequest = z.object({
  person_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

privacyRoutes.post('/erasure-request', async (c) => {
  const body = ErasureRequest.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('data_subject_request')
    .insert({
      person_id: body.data.person_id,
      type: 'erasure',
      notes: body.data.notes ?? null,
    })
    .select('id, type, status, requested_at, due_at')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});
