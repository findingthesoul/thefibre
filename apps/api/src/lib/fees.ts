// Plan-aware platform fee — ONE implementation of the workspace_meet_fee
// resolution that had been copy-pasted into four payment paths (Meet
// checkout, Thread enrol checkout, Thread webhook payout, payment links).
// Free plan: 2% capped at €2; Pro/Org: waived. The RPC owns the numbers —
// the literals below are only the never-under-skim fallback when the
// lookup fails.

import { adminClient } from '../db.js';

export async function platformFeeCents(
  workspaceId: string,
  grossCents: number,
): Promise<number> {
  let feePct = 0.02;
  let feeCapCents: number | null = 200;
  try {
    const { data: feeRows } = await adminClient.rpc('workspace_meet_fee', {
      ws_id: workspaceId,
    });
    const row = Array.isArray(feeRows) ? feeRows[0] : null;
    if (row) {
      // numeric comes back as a string from PostgREST sometimes; coerce.
      const rawPct = (row as { pct: number | string }).pct;
      feePct = typeof rawPct === 'string' ? parseFloat(rawPct) : rawPct;
      feeCapCents = (row as { cap_cents: number | null }).cap_cents;
    }
  } catch (e) {
    console.warn('[fees] workspace_meet_fee lookup failed, defaulting to Free rate', e);
  }
  const computed = Math.floor(grossCents * feePct);
  return feeCapCents !== null ? Math.min(computed, feeCapCents) : computed;
}
