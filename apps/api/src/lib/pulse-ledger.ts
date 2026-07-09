import { adminClient } from '../db.js';
import { syncOpportunityRun } from './pulse-pipeline.js';

// ===========================================================================
// P4 — the ledger↔plan loop (proposal: "the past of the chart becomes fact").
//
// Two directions:
//  - settleFromPurchase(): recordPurchase() calls this after every ledger
//    write. A paid purchase settles what it belongs to — Pulse-issued
//    invoices (purchase.item_ref = commitment id) settle the whole
//    opportunity (lines settled, stage → done, Flow run completes); a paid
//    purchase already linked to a specific line settles that line.
//  - autoMatchPurchases(): conservative matcher for Meet/Thread money that
//    was also planned in Pulse — links an unlinked purchase to an unsettled
//    line when counterparty person AND exact amount match (unique candidate
//    only). Paid → settled; pending → linked (which also stops the ledger
//    receivable from double-counting in the projection).
// ===========================================================================

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10));

export async function settleFromPurchase(purchaseId: string): Promise<void> {
  try {
    const { data: p } = await adminClient
      .from('purchase')
      .select('id, workspace_id, app_id, item_ref, status, paid_at, app:app_id (slug)')
      .eq('id', purchaseId)
      .maybeSingle();
    if (!p || p.status !== 'paid') return;
    const slug = (Array.isArray(p.app) ? p.app[0] : p.app)?.slug;

    // Pulse-issued invoice: item_ref IS the commitment id.
    if (slug === 'fibre-pulse' && p.item_ref) {
      const { data: cm } = await adminClient
        .from('pulse_commitment')
        .select('id, workspace_id, label, stage, person_id, organisation_id, owner_user_id')
        .eq('id', p.item_ref)
        .is('deleted_at', null)
        .maybeSingle();
      if (!cm) return;
      await adminClient
        .from('pulse_commitment_line')
        .update({ settled_at: day(p.paid_at), purchase_id: p.id })
        .eq('commitment_id', cm.id)
        .is('settled_at', null);
      const { data: updated } = await adminClient
        .from('pulse_commitment')
        .update({ stage: 'done', probability: 100, updated_at: new Date().toISOString() })
        .eq('id', cm.id)
        .select('id, workspace_id, label, stage, person_id, organisation_id, owner_user_id')
        .single();
      if (updated) await syncOpportunityRun(updated.workspace_id, updated as any);
      return;
    }

    // Any purchase already linked to a line: settle that line.
    await adminClient
      .from('pulse_commitment_line')
      .update({ settled_at: day(p.paid_at) })
      .eq('purchase_id', p.id)
      .is('settled_at', null);
  } catch (e) {
    console.error('[pulse-ledger] settleFromPurchase threw', e);
  }
}

// Throttled like the stages sync — the matching set is small but there's no
// need to re-run it on every projection read.
const lastMatchAt = new Map<string, number>();

export async function autoMatchPurchases(workspaceId: string): Promise<void> {
  const last = lastMatchAt.get(workspaceId) ?? 0;
  if (Date.now() - last < 60_000) return;
  lastMatchAt.set(workspaceId, Date.now());

  try {
    // Unlinked purchases (not referenced by any line, not Pulse-issued).
    const { data: purchases } = await adminClient
      .from('purchase')
      .select('id, person_id, amount_cents, status, paid_at, app:app_id (slug)')
      .eq('workspace_id', workspaceId)
      .in('status', ['pending', 'paid']);
    if (!purchases?.length) return;

    const { data: lines } = await adminClient
      .from('pulse_commitment_line')
      .select(
        'id, amount_cents, purchase_id, settled_at, commitment:commitment_id (id, workspace_id, person_id, deleted_at)',
      )
      .is('settled_at', null);
    const openLines = (lines ?? []).filter((l) => {
      const cm = Array.isArray(l.commitment) ? l.commitment[0] : l.commitment;
      return cm && cm.workspace_id === workspaceId && !cm.deleted_at;
    });
    if (!openLines.length) return;

    const linked = new Set(openLines.map((l) => l.purchase_id).filter(Boolean));
    for (const p of purchases) {
      const slug = (Array.isArray(p.app) ? p.app[0] : p.app)?.slug;
      if (slug === 'fibre-pulse' || linked.has(p.id) || !p.person_id) continue;
      // Conservative: exact amount + same person + exactly ONE candidate.
      const candidates = openLines.filter((l) => {
        const cm = Array.isArray(l.commitment) ? l.commitment[0] : l.commitment;
        return (
          !l.purchase_id &&
          l.amount_cents === p.amount_cents &&
          cm?.person_id === p.person_id
        );
      });
      if (candidates.length !== 1) continue;
      const line = candidates[0]!;
      const patch: Record<string, unknown> = { purchase_id: p.id };
      if (p.status === 'paid') patch.settled_at = day(p.paid_at);
      const { error } = await adminClient
        .from('pulse_commitment_line')
        .update(patch)
        .eq('id', line.id);
      if (!error) {
        line.purchase_id = p.id; // don't double-assign within this run
        linked.add(p.id);
      }
    }
  } catch (e) {
    console.error('[pulse-ledger] autoMatchPurchases threw', e);
  }
}
