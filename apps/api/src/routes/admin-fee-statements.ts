// POST /api/v1/admin/fee-statements/run — issue the monthly platform-fee
// statements by hand (super admin). The scheduler does this on the 2nd for
// the previous month; this is for a re-run, a first run, or a look before
// the month rolls (`dry_run`). Idempotent: an existing statement is reported
// as `exists` and nothing is sent twice. See lib/fee-statements.ts.
import { Hono } from 'hono';
import { z } from 'zod';
import { issueFeeStatements } from '../lib/fee-statements.js';
import { isSuperAdminUser } from '../lib/super-admin.js';

export const adminFeeStatementsRoutes = new Hono();

const RunBody = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  dry_run: z.boolean().optional(),
  send: z.boolean().optional(),
});

adminFeeStatementsRoutes.post('/run', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isSuperAdminUser(ctx))) return c.json({ error: 'super admin required' }, 403);
  const body = RunBody.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  try {
    const statements = await issueFeeStatements({
      month: body.data.month,
      dryRun: body.data.dry_run ?? false,
      send: body.data.send ?? true,
    });
    return c.json({ statements });
  } catch (e) {
    console.error('[admin/fee-statements] run failed', e);
    return c.json({ error: e instanceof Error ? e.message : 'failed' }, 500);
  }
});
